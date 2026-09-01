const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(authMiddleware);

// Get audit logs grouped by day
router.get('/logs', requirePermission('audit', 'access_nav'), (req, res) => {
  try {
    const { user, actionType, startDate, endDate, search } = req.query;
    const data = auditService.getLogs({ user, actionType, startDate, endDate, search });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'FETCH_LOGS_FAILED', message: err.message });
  }
});

// Get retention settings
router.get('/retention', requirePermission('audit', 'configure_retention'), (req, res) => {
  try {
    const data = auditService.getRetentionSetting();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'FETCH_RETENTION_FAILED', message: err.message });
  }
});

// Update retention setting
router.put('/retention', requirePermission('audit', 'configure_retention'), (req, res) => {
  try {
    const { retention_days } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const updated = auditService.updateRetentionSetting(retention_days, req.user, ipAddress);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(400).json({ error: 'UPDATE_RETENTION_FAILED', message: err.message });
  }
});

// Purge today's logs
router.post('/purge-today', requirePermission('audit', 'delete_logs'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = auditService.purgeTodayLogs(req.user, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'PURGE_FAILED', message: err.message });
  }
});

// Purge all logs
router.post('/purge-all', requirePermission('audit', 'delete_logs'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = auditService.purgeAllLogs(req.user, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'PURGE_FAILED', message: err.message });
  }
});

module.exports = router;
