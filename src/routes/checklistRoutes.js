const express = require('express');
const router = express.Router();
const checklistService = require('../services/checklistService');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// Public preview PNG endpoint for rich messenger link preview cards (raster format required by WhatsApp, Discord, Slack, iMessage)
router.get('/:id/preview.png', (req, res) => {
  try {
    const checklist = checklistService.getChecklistById(req.params.id);
    if (!checklist) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Checklist not found' });
    }
    const pngBuffer = checklistService.generatePreviewPng(checklist);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.send(pngBuffer);
  } catch (err) {
    console.error('Error generating preview PNG:', err);
    res.status(500).json({ error: 'PREVIEW_PNG_FAILED', message: err.message });
  }
});

// Public preview SVG endpoint
router.get('/:id/preview.svg', (req, res) => {
  try {
    const checklist = checklistService.getChecklistById(req.params.id);
    if (!checklist) {
      return res.status(404).send('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="100%" height="100%" fill="#090d12"/><text x="50%" y="50%" fill="#8b949e" font-family="sans-serif" font-size="16" text-anchor="middle">Checklist Not Found</text></svg>');
    }
    const svg = checklistService.generatePreviewSvg(checklist);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=10');
    res.send(svg);
  } catch (err) {
    res.status(500).send('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="100%" height="100%" fill="#090d12"/><text x="50%" y="50%" fill="#f85149" font-family="sans-serif" font-size="16" text-anchor="middle">Error Generating Preview</text></svg>');
  }
});

// Public sanitized checklist endpoint for read-only viewing
router.get('/:id/public', (req, res) => {
  try {
    const checklist = checklistService.getPublicChecklistById(req.params.id);
    if (!checklist) return res.status(404).json({ error: 'NOT_FOUND', message: 'Checklist not found or expired' });
    res.json({ checklist });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_CHECKLIST_FAILED', message: err.message });
  }
});

router.use(authMiddleware);

// Get all checklists
router.get('/', requirePermission('checklists', 'view_active'), (req, res) => {
  try {
    const checklists = checklistService.getAllChecklists();
    res.json({ checklists });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_CHECKLISTS_FAILED', message: err.message });
  }
});

// Get single checklist
router.get('/:id', requirePermission('checklists', 'view_active'), (req, res) => {
  try {
    const checklist = checklistService.getChecklistById(req.params.id);
    if (!checklist) return res.status(404).json({ error: 'NOT_FOUND', message: 'Checklist not found' });
    res.json({ checklist });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_CHECKLIST_FAILED', message: err.message });
  }
});

// Create new checklist from template
router.post('/', requirePermission('checklists', 'create_active'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const checklist = checklistService.createChecklistFromTemplate(req.body, req.user, ipAddress);
    
    // Broadcast via global socket if io is attached
    if (req.app.get('io')) {
      req.app.get('io').emit('checklist_created', checklist);
    }

    res.status(201).json({ success: true, checklist });
  } catch (err) {
    res.status(400).json({ error: 'CREATE_CHECKLIST_FAILED', message: err.message });
  }
});

// Toggle item check state
router.post('/:id/toggle', requirePermission('checklists', 'view_active'), (req, res) => {
  try {
    const { itemId, checked } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const updated = checklistService.toggleItemCheck(req.params.id, itemId, checked, req.user, ipAddress);

    if (req.app.get('io')) {
      req.app.get('io').to(`checklist_${req.params.id}`).emit('checklist_updated', updated);
      req.app.get('io').emit('checklist_card_updated', {
        id: updated.id,
        progress: updated.progress,
        status: updated.status,
        has_blocked: updated.has_blocked
      });
    }

    res.json({ success: true, checklist: updated });
  } catch (err) {
    res.status(400).json({ error: 'TOGGLE_FAILED', message: err.message });
  }
});

// Update item notes / issue flags
router.post('/:id/notes', requirePermission('checklists', 'view_active'), (req, res) => {
  try {
    const { itemId, has_issue, issue_note } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const updated = checklistService.updateItemNotes(req.params.id, itemId, { has_issue, issue_note }, req.user, ipAddress);

    if (req.app.get('io')) {
      req.app.get('io').to(`checklist_${req.params.id}`).emit('checklist_updated', updated);
      req.app.get('io').emit('checklist_card_updated', {
        id: updated.id,
        progress: updated.progress,
        status: updated.status,
        has_blocked: updated.has_blocked
      });
    }

    res.json({ success: true, checklist: updated });
  } catch (err) {
    res.status(400).json({ error: 'NOTE_UPDATE_FAILED', message: err.message });
  }
});

// Update checklist structure (in-line modification)
router.put('/:id/structure', requirePermission('checklists', 'edit_templates'), (req, res) => {
  try {
    const { items } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const updated = checklistService.updateChecklistStructure(req.params.id, items, req.user, ipAddress);

    if (req.app.get('io')) {
      req.app.get('io').to(`checklist_${req.params.id}`).emit('checklist_updated', updated);
      req.app.get('io').emit('checklist_card_updated', {
        id: updated.id,
        progress: updated.progress,
        status: updated.status,
        has_blocked: updated.has_blocked
      });
    }

    res.json({ success: true, checklist: updated });
  } catch (err) {
    res.status(400).json({ error: 'STRUCTURE_UPDATE_FAILED', message: err.message });
  }
});

// Submit checklist
router.post('/:id/submit', requirePermission('checklists', 'view_active'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const updated = checklistService.submitChecklist(req.params.id, req.user, ipAddress);

    if (req.app.get('io')) {
      req.app.get('io').to(`checklist_${req.params.id}`).emit('checklist_updated', updated);
      req.app.get('io').emit('checklist_submitted', updated);
    }

    res.json({ success: true, checklist: updated });
  } catch (err) {
    res.status(400).json({ error: 'SUBMIT_FAILED', message: err.message });
  }
});

// Unsubmit / Reopen checklist
router.post('/:id/unsubmit', requirePermission('checklists', 'view_active'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const updated = checklistService.unsubmitChecklist(req.params.id, req.user, ipAddress);

    if (req.app.get('io')) {
      req.app.get('io').to(`checklist_${req.params.id}`).emit('checklist_updated', updated);
      req.app.get('io').emit('checklist_card_updated', {
        id: updated.id,
        progress: updated.progress,
        status: updated.status,
        has_blocked: updated.has_blocked
      });
      req.app.get('io').emit('checklist_unsubmitted', updated);
    }

    res.json({ success: true, checklist: updated });
  } catch (err) {
    res.status(400).json({ error: 'UNSUBMIT_FAILED', message: err.message });
  }
});

// Delete all checklists
router.delete('/', requirePermission('checklists', 'delete_active'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = checklistService.deleteAllChecklists(req.user, ipAddress);

    if (req.app.get('io')) {
      req.app.get('io').emit('checklist_deleted', { id: 'ALL' });
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'DELETE_ALL_CHECKLISTS_FAILED', message: err.message });
  }
});

// Delete checklist
router.delete('/:id', requirePermission('checklists', 'delete_active'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = checklistService.deleteChecklist(req.params.id, req.user, ipAddress);

    if (req.app.get('io')) {
      req.app.get('io').emit('checklist_deleted', { id: req.params.id });
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'DELETE_CHECKLIST_FAILED', message: err.message });
  }
});

module.exports = router;
