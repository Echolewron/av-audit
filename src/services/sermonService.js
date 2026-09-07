const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const nodemailer = require('nodemailer');
const { db } = require('../db/database');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/sermons');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Title Case Formatter: Capitalizes first letter of each word and trims whitespace
function formatTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Short context initials (matching auto_sermon_sender Python script)
function getShortSermonContext(context) {
  if (!context || typeof context !== 'string') return 'S';
  const words = context.trim().split(/[\s\-_]+/);
  const initials = words.map(w => w.charAt(0).toUpperCase()).join('');
  return initials || 'S';
}

// Format date as MM.DD.YYYY
function formatDate(dateObj = new Date()) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}.${dd}.${yyyy}`;
}

// Generate formatted output MP3 filename
function generateOutputFilename(context, title, dateObj = new Date()) {
  const shortContext = getShortSermonContext(context);
  const safeTitle = formatTitleCase(title).replace(/[^a-zA-Z0-9_\-]/g, '_');
  const dateFormatted = formatDate(dateObj);
  return `${shortContext}_${safeTitle}-${dateFormatted}.mp3`;
}

// Template variable interpolation: {title}, {context}, {date}
function renderTemplate(template, vars = {}) {
  if (!template || typeof template !== 'string') return '';
  const title = vars.title || '';
  const context = vars.context || '';
  const date = vars.date || formatDate();

  return template
    .replace(/\{title\}/gi, title)
    .replace(/\{context\}/gi, context)
    .replace(/\{date\}/gi, date);
}

const ffmpegHelper = require('../utils/ffmpegHelper');

// Probe audio duration in seconds using ffprobe or ffmpeg
function getAudioDuration(filePath, ffmpegBin = 'ffmpeg') {
  return new Promise((resolve) => {
    // Try ffprobe first if available
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], (error, stdout) => {
      if (!error && stdout && !isNaN(parseFloat(stdout.trim()))) {
        return resolve(parseFloat(stdout.trim()));
      }

      // Fallback: parse ffmpeg -i stderr for Duration: 00:00:00.00
      const ffmpeg = spawn(ffmpegBin, ['-i', filePath]);
      let stderrData = '';
      ffmpeg.stderr.on('data', data => {
        stderrData += data.toString();
      });
      ffmpeg.on('close', () => {
        const match = stderrData.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
        if (match) {
          const hours = parseFloat(match[1]) || 0;
          const mins = parseFloat(match[2]) || 0;
          const secs = parseFloat(match[3]) || 0;
          const totalSecs = (hours * 3600) + (mins * 60) + secs;
          return resolve(totalSecs);
        }
        // Default fallback duration: 3600s (1 hour) if cannot be determined
        resolve(3600);
      });
      ffmpeg.on('error', () => resolve(3600));
    });
  });
}

// Compress audio to target size in MB (default 15MB) using ffmpeg
async function compressAudio(inputPath, outputPath, targetSizeMB = 15, onProgress = () => {}) {
  // 1. Ensure FFmpeg is available (auto-downloads to bin/ if not found)
  const ffmpegPath = await ffmpegHelper.ensureFFmpeg((info) => {
    if (typeof onProgress === 'function') {
      onProgress(typeof info === 'string' ? info : info.message);
    }
  });

  const stats = fs.statSync(inputPath);
  const inputSizeBits = stats.size * 8;
  const targetSizeBits = targetSizeMB * 8 * 1_000_000;

  // If already within target size and ends with .mp3, copy directly
  if (inputSizeBits <= targetSizeBits && inputPath.toLowerCase().endsWith('.mp3')) {
    if (path.resolve(inputPath) !== path.resolve(outputPath)) {
      fs.copyFileSync(inputPath, outputPath);
    }
    const finalStats = fs.statSync(outputPath);
    return {
      outputPath,
      compressed: false,
      finalSize: finalStats.size,
      bitrate: null
    };
  }

  if (typeof onProgress === 'function') {
    onProgress('Calculating optimal bitrate for target size...');
  }

  // Calculate target bitrate based on duration
  const durationSec = await getAudioDuration(inputPath, ffmpegPath);
  const safeDuration = Math.max(1, durationSec);
  let targetBitrateK = Math.floor(targetSizeBits / safeDuration / 1000);
  // Ensure sane bounds: between 16k and 320k
  targetBitrateK = Math.min(320, Math.max(16, targetBitrateK));

  if (typeof onProgress === 'function') {
    onProgress(`Compressing audio with FFmpeg (~${targetSizeMB}MB target)...`);
  }

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', inputPath,
      '-vn', // No video
      '-codec:a', 'libmp3lame',
      '-b:a', `${targetBitrateK}k`,
      '-y', // Overwrite output
      outputPath
    ];

    const proc = spawn(ffmpegPath, ffmpegArgs);
    let errOutput = '';

    proc.stderr.on('data', data => {
      errOutput += data.toString();
    });

    proc.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) {
        const finalStats = fs.statSync(outputPath);
        resolve({
          outputPath,
          compressed: true,
          finalSize: finalStats.size,
          bitrate: `${targetBitrateK}k`
        });
      } else {
        reject(new Error(`FFmpeg failed with exit code ${code}: ${errOutput.slice(-300)}`));
      }
    });

    proc.on('error', err => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}

// Send email with attachment via nodemailer (Gmail SMTP)
async function sendSermonEmail({ title, context, date, filePath, config }) {
  const senderEmail = (config.sender_email || '').trim();
  const senderPassword = (config.sender_app_password || '').trim();
  const receiverEmail = (config.receiver_email || '').trim();
  const senderName = (config.sender_name && config.sender_name.trim()) ? config.sender_name.trim() : 'AV Audit Recordings Sender';

  if (!senderEmail || !senderPassword || !receiverEmail) {
    throw new Error('Incomplete Gmail configuration. Please set Sender Email, App Password, and Receiver Email in Sermon Settings.');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Attachment file not found at path: ${filePath}`);
  }

  const dateFormatted = date || formatDate();
  const titleFormatted = formatTitleCase(title);

  const subjectTemplate = config.subject_template || '{context} Sermon {date}';
  const bodyTemplate = config.body_template || 'God bless you. This is the recording for the sermon delivered on {date}, "{title}."\n\n[This email was automatically generated by AV Audit Recordings Sender]';

  const subject = renderTemplate(subjectTemplate, { title: titleFormatted, context, date: dateFormatted });
  const body = renderTemplate(bodyTemplate, { title: titleFormatted, context, date: dateFormatted });

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: senderEmail,
      pass: senderPassword
    }
  });

  const filename = path.basename(filePath);
  const cleanSenderName = senderName.replace(/["\r\n]/g, '');

  const mailOptions = {
    from: `"${cleanSenderName}" <${senderEmail}>`,
    to: receiverEmail,
    subject: subject,
    text: body,
    attachments: [
      {
        filename: filename,
        path: filePath
      }
    ]
  };

  const info = await transporter.sendMail(mailOptions);
  return {
    messageId: info.messageId,
    subject,
    body,
    recipient: receiverEmail
  };
}

// Silently trigger administrative webhook if configured
async function triggerRecordingWebhook(config, payload) {
  try {
    const webhookUrl = (config && config.webhook_url ? config.webhook_url : '').trim();
    if (!webhookUrl) return;

    const method = (config && config.webhook_method ? config.webhook_method : 'POST').toUpperCase();
    const isGet = method === 'GET';

    const fetchOptions = {
      method: isGet ? 'GET' : 'POST',
      signal: AbortSignal.timeout(10000)
    };

    if (isGet) {
      fetchOptions.headers = {
        'User-Agent': 'AV-Audit-Recordings-Sender/1.0'
      };
    } else {
      const customBody = (config && config.webhook_body ? config.webhook_body : '').trim();
      if (customBody) {
        // Substitute template tokens
        const sub = payload.submission || {};
        const user = payload.user || {};
        const sizeMb = sub.compressed_size_bytes ? (sub.compressed_size_bytes / (1024 * 1024)).toFixed(2) : '0';

        const tokenMap = {
          '{id}': sub.id || '',
          '{title}': sub.title || '',
          '{context}': sub.context || '',
          '{date}': sub.created_at || new Date().toISOString(),
          '{recipient}': sub.recipient_email || '',
          '{sender}': sub.sender_email || '',
          '{sender_name}': sub.sender_name || '',
          '{size}': sizeMb + ' MB',
          '{size_mb}': sizeMb,
          '{size_bytes}': String(sub.compressed_size_bytes || 0),
          '{status}': sub.status || 'sent',
          '{event}': payload.event || 'recording.sent',
          '{username}': user.username || ''
        };

        let renderedBody = customBody;
        for (const [k, v] of Object.entries(tokenMap)) {
          renderedBody = renderedBody.split(k).join(String(v));
        }

        let isJson = false;
        try {
          JSON.parse(renderedBody);
          isJson = true;
        } catch (_) {}

        fetchOptions.headers = {
          'Content-Type': isJson ? 'application/json' : 'text/plain',
          'User-Agent': 'AV-Audit-Recordings-Sender/1.0'
        };
        fetchOptions.body = renderedBody;
      } else {
        fetchOptions.headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'AV-Audit-Recordings-Sender/1.0'
        };
        fetchOptions.body = JSON.stringify(payload);
      }
    }

    await fetch(webhookUrl, fetchOptions);
  } catch (err) {
    // Silent catch for administrative webhook - UI must remain unaffected
    console.warn(`[Recordings Webhook] Silent trigger notice for ${config && config.webhook_url}:`, err.message);
  }
}

// Cleanup expired recordings based on retention policy
function cleanupExpiredSubmissions() {
  try {
    const settings = db.sermons.getSettings();
    const retentionDays = settings.retention_days || 14;
    const expiredList = db.sermons.cleanupExpired(retentionDays);

    expiredList.forEach(sub => {
      if (sub.file_path && fs.existsSync(sub.file_path)) {
        try {
          fs.unlinkSync(sub.file_path);
        } catch (e) {
          console.warn(`Could not delete expired sermon file ${sub.file_path}:`, e.message);
        }
      }
    });

    if (expiredList.length > 0) {
      console.log(`[Sermon Service] Cleaned up ${expiredList.length} expired sermon recordings (Retention: ${retentionDays} days).`);
    }
  } catch (err) {
    console.error('[Sermon Service] Error during retention cleanup:', err);
  }
}

module.exports = {
  UPLOADS_DIR,
  formatTitleCase,
  getShortSermonContext,
  formatDate,
  generateOutputFilename,
  renderTemplate,
  getAudioDuration,
  compressAudio,
  sendSermonEmail,
  triggerRecordingWebhook,
  cleanupExpiredSubmissions
};
