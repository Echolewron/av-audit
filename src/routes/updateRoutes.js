const express = require('express');
const router = express.Router();
const updateService = require('../services/updateService');
const { authMiddleware } = require('../middleware/auth');

// Check for updates
router.get('/check', authMiddleware, async (req, res) => {
  try {
    const status = await updateService.checkForUpdates();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'CHECK_FAILED', message: err.message });
  }
});

// Apply update (Admin only)
router.post('/apply', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can initiate system updates.' });
    }

    const io = req.app.get('io');
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await updateService.applyUpdate(io, req.user, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'UPDATE_FAILED', message: err.message });
  }
});

module.exports = router;
