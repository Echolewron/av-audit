const express = require('express');
const router = express.Router();
const templateService = require('../services/templateService');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(authMiddleware);

// Get all templates
router.get('/', (req, res) => {
  try {
    const templates = templateService.getAllTemplates();
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_TEMPLATES_FAILED', message: err.message });
  }
});

// Get single template
router.get('/:id', (req, res) => {
  try {
    const template = templateService.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_TEMPLATE_FAILED', message: err.message });
  }
});

// Create template
router.post('/', requirePermission('checklists', 'edit_templates'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const template = templateService.createTemplate(req.body, req.user, ipAddress);
    res.status(201).json({ success: true, template });
  } catch (err) {
    res.status(400).json({ error: 'CREATE_TEMPLATE_FAILED', message: err.message });
  }
});

// Update template
router.put('/:id', requirePermission('checklists', 'edit_templates'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const template = templateService.updateTemplate(req.params.id, req.body, req.user, ipAddress);
    res.json({ success: true, template });
  } catch (err) {
    res.status(400).json({ error: 'UPDATE_TEMPLATE_FAILED', message: err.message });
  }
});

// Delete all templates
router.delete('/', requirePermission('checklists', 'edit_templates'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = templateService.deleteAllTemplates(req.user, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'DELETE_ALL_TEMPLATES_FAILED', message: err.message });
  }
});

// Delete template
router.delete('/:id', requirePermission('checklists', 'edit_templates'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = templateService.deleteTemplate(req.params.id, req.user, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'DELETE_TEMPLATE_FAILED', message: err.message });
  }
});

// Duplicate template
router.post('/:id/duplicate', requirePermission('checklists', 'edit_templates'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const template = templateService.duplicateTemplate(req.params.id, req.user, ipAddress);
    res.status(201).json({ success: true, template });
  } catch (err) {
    res.status(400).json({ error: 'DUPLICATE_TEMPLATE_FAILED', message: err.message });
  }
});

module.exports = router;
