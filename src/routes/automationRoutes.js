const express = require('express');
const router = express.Router();
const automationService = require('../services/automationService');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(authMiddleware);

// Trigger automation
router.post('/execute', requirePermission('checklists', 'execute_automations'), async (req, res) => {
  try {
    const { method, url, headers, body, checklistId, itemId, itemTitle } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await automationService.executeAutomation(
      { method, url, headers, body, checklistId, itemId, itemTitle },
      req.user,
      ipAddress
    );

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'AUTOMATION_FAILED', message: err.message });
  }
});

module.exports = router;
