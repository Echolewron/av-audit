const express = require('express');
const router = express.Router();
const updateService = require('../services/updateService');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// Check for updates
router.get('/check', authMiddleware, requirePermission('system', 'manage_updates'), async (req, res) => {
  try {
    const status = await updateService.checkForUpdates();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'CHECK_FAILED', message: err.message });
  }
});

// Apply update
router.post('/apply', authMiddleware, requirePermission('system', 'manage_updates'), async (req, res) => {
  try {
    const io = req.app.get('io');
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await updateService.applyUpdate(io, req.user, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'UPDATE_FAILED', message: err.message });
  }
});

module.exports = router;
