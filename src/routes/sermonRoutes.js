const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const sermonService = require('../services/sermonService');

router.use(authMiddleware);

// Setup multer storage for incoming audio recordings
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, sermonService.UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    const tempName = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, tempName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max upload size
  },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.wma'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file format. Please upload an MP3, WAV, or M4A file.'));
    }
  }
});

// GET /api/sermons/settings - Fetch sermon sender settings
router.get('/settings', (req, res) => {
  try {
    const settings = db.sermons.getSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_SETTINGS_FAILED', message: err.message });
  }
});

// PUT /api/sermons/settings - Update sermon sender settings (manage_settings permission required)
router.put('/settings', requirePermission('sermon_sender', 'manage_settings'), (req, res) => {
  try {
    const {
      sender_email,
      sender_app_password,
      receiver_email,
      subject_template,
      body_template,
      retention_days,
      target_file_size_mb
    } = req.body;

    const updated = db.sermons.updateSettings({
      sender_email,
      sender_app_password,
      receiver_email,
      subject_template,
      body_template,
      retention_days,
      target_file_size_mb
    });

    const ipAddress = req.ip || req.connection.remoteAddress;
    db.audit.log({
      userId: req.user.id,
      username: req.user.username,
      action: 'UPDATE_SERMON_SETTINGS',
      category: 'SERMON_SENDER',
      details: `Updated Sermon Sender configuration (Sender: ${updated.sender_email || 'Not configured'}, Receiver: ${updated.receiver_email || 'Not configured'}, Retention: ${updated.retention_days} days)`,
      ipAddress
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'UPDATE_SETTINGS_FAILED', message: err.message });
  }
});

// GET /api/sermons/submissions - Fetch previously submitted sermons
router.get('/submissions', requirePermission('sermon_sender', 'view_history'), (req, res) => {
  try {
    sermonService.cleanupExpiredSubmissions();
    const submissions = db.sermons.getAllSubmissions();
    res.json({ submissions });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_SUBMISSIONS_FAILED', message: err.message });
  }
});

// POST /api/sermons/send - Upload, compress, and send sermon recording
router.post('/send', requirePermission('sermon_sender', 'access_nav'), upload.single('audio_file'), async (req, res) => {
  let tempFilePath = null;
  let compressedFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'FILE_REQUIRED', message: 'Please select an audio file to send.' });
    }

    tempFilePath = req.file.path;
    const rawTitle = req.body.title || 'Untitled Sermon';
    const title = sermonService.formatTitleCase(rawTitle);
    const context = (req.body.context || 'General').trim();
    const isCustomContext = req.body.is_custom_context === 'true' || req.body.is_custom_context === true;

    const settings = db.sermons.getSettings();
    if (!settings.sender_email || !settings.sender_app_password || !settings.receiver_email) {
      // Clean up uploaded file
      try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (_) {}
      return res.status(400).json({
        error: 'CONFIG_INCOMPLETE',
        message: 'Sermon Sender Gmail credentials not configured. Please open Settings and configure Sender Email, App Password, and Receiver Email.'
      });
    }

    const outputFileName = sermonService.generateOutputFilename(context, title);
    compressedFilePath = path.join(sermonService.UPLOADS_DIR, outputFileName);

    const io = req.app.get('io');
    const socketId = req.body.socket_id;
    const onProgress = (msg) => {
      if (io) {
        if (socketId) {
          io.to(socketId).emit('sermon:progress', { message: msg });
        } else {
          io.emit('sermon:progress', { message: msg });
        }
      }
    };

    // 1. Compress file to target size (default 15MB)
    const targetSizeMB = settings.target_file_size_mb || 15;
    const compResult = await sermonService.compressAudio(tempFilePath, compressedFilePath, targetSizeMB, onProgress);

    // Delete temporary raw upload if distinct from compressed output
    if (tempFilePath !== compressedFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }

    // 2. Email file to receiver
    const emailResult = await sermonService.sendSermonEmail({
      title,
      context,
      date: sermonService.formatDate(),
      filePath: compressedFilePath,
      config: settings
    });

    // 3. Record in database
    const submission = db.sermons.createSubmission({
      title,
      context,
      is_custom_context: isCustomContext,
      original_filename: req.file.originalname,
      compressed_filename: outputFileName,
      file_path: compressedFilePath,
      original_size_bytes: req.file.size,
      compressed_size_bytes: compResult.finalSize,
      recipient_email: settings.receiver_email,
      sender_email: settings.sender_email,
      email_subject: emailResult.subject,
      status: 'sent',
      created_by_user_id: req.user.id,
      created_by_username: req.user.username
    });

    const ipAddress = req.ip || req.connection.remoteAddress;
    db.audit.log({
      userId: req.user.id,
      username: req.user.username,
      action: 'SEND_SERMON',
      category: 'SERMON_SENDER',
      details: `Successfully sent sermon "${title}" (${context}) to ${settings.receiver_email} (Size: ${(compResult.finalSize / (1024 * 1024)).toFixed(2)} MB)`,
      ipAddress
    });

    // Broadcast real-time websocket update
    if (io) {
      io.emit('sermon:submissions_updated', { action: 'create', submission });
    }

    res.json({
      success: true,
      submission,
      email: emailResult
    });
  } catch (err) {
    console.error('Failed to process and send sermon:', err);

    // Clean up files if failed before save
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }

    res.status(500).json({
      error: 'SEND_FAILED',
      message: err.message || 'An error occurred while compressing or sending the sermon.'
    });
  }
});

// POST /api/sermons/:id/resend - Resend an existing sermon submission
router.post('/:id/resend', requirePermission('sermon_sender', 'access_nav'), async (req, res) => {
  try {
    const submission = db.sermons.getSubmissionById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Sermon submission not found.' });
    }

    if (!submission.file_path || !fs.existsSync(submission.file_path)) {
      return res.status(410).json({ error: 'FILE_EXPIRED', message: 'The recording file for this submission has expired or was removed.' });
    }

    const settings = db.sermons.getSettings();
    if (!settings.sender_email || !settings.sender_app_password || !settings.receiver_email) {
      return res.status(400).json({
        error: 'CONFIG_INCOMPLETE',
        message: 'Sermon Sender Gmail credentials not configured. Please open Settings and configure Sender Email, App Password, and Receiver Email.'
      });
    }

    // Resend email using the ORIGINAL date sermon was sent/created on
    const originalDate = submission.created_at ? new Date(submission.created_at) : new Date();
    const formattedOriginalDate = sermonService.formatDate(originalDate);

    const emailResult = await sermonService.sendSermonEmail({
      title: submission.title,
      context: submission.context,
      date: formattedOriginalDate,
      filePath: submission.file_path,
      config: settings
    });

    const updated = db.sermons.updateSubmission(submission.id, {
      status: 'sent',
      error_message: null,
      last_sent_at: new Date().toISOString(),
      send_count: (submission.send_count || 1) + 1
    });

    const ipAddress = req.ip || req.connection.remoteAddress;
    db.audit.log({
      userId: req.user.id,
      username: req.user.username,
      action: 'RESEND_SERMON',
      category: 'SERMON_SENDER',
      details: `Resent sermon "${submission.title}" (${submission.context}) with original date ${formattedOriginalDate} to ${settings.receiver_email}`,
      ipAddress
    });

    // Broadcast real-time websocket update
    const io = req.app.get('io');
    if (io) {
      io.emit('sermon:submissions_updated', { action: 'update', submission: updated });
    }

    res.json({ success: true, submission: updated, email: emailResult });
  } catch (err) {
    console.error('Failed to resend sermon:', err);
    res.status(500).json({ error: 'RESEND_FAILED', message: err.message });
  }
});

// DELETE /api/sermons/:id - Delete a sermon submission and recording file
router.delete('/:id', requirePermission('sermon_sender', 'view_history'), (req, res) => {
  try {
    const submission = db.sermons.getSubmissionById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Sermon submission not found.' });
    }

    if (submission.file_path && fs.existsSync(submission.file_path)) {
      try { fs.unlinkSync(submission.file_path); } catch (_) {}
    }

    db.sermons.deleteSubmission(submission.id);

    const ipAddress = req.ip || req.connection.remoteAddress;
    db.audit.log({
      userId: req.user.id,
      username: req.user.username,
      action: 'DELETE_SERMON_SUBMISSION',
      category: 'SERMON_SENDER',
      details: `Deleted sermon submission "${submission.title}"`,
      ipAddress
    });

    // Broadcast real-time websocket update
    const io = req.app.get('io');
    if (io) {
      io.emit('sermon:submissions_updated', { action: 'delete', submissionId: submission.id });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DELETE_FAILED', message: err.message });
  }
});

module.exports = router;
