const express = require('express');
const router = express.Router();
const accountService = require('../services/accountService');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(authMiddleware);

// Get pending approval queue
router.get('/pending', requirePermission('accounts', 'admit_pending'), (req, res) => {
  try {
    const list = accountService.getPendingUsers();
    res.json({ pendingUsers: list });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
  }
});

// Approve pending user
router.post('/pending/:id/approve', requirePermission('accounts', 'admit_pending'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = accountService.approvePendingUser(req.params.id, req.user, ipAddress);

    const io = req.app.get('io');
    if (io) {
      io.emit('accounts:pending_updated', { action: 'approve', userId: req.params.id });
      io.emit('accounts_updated', { action: 'approve', userId: req.params.id });
      io.emit('permissions_updated', { userId: req.params.id, action: 'approval' });
    }

    res.json({ success: true, user: result });
  } catch (err) {
    res.status(400).json({ error: 'APPROVE_FAILED', message: err.message });
  }
});

// Reject pending user
router.post('/pending/:id/reject', requirePermission('accounts', 'admit_pending'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = accountService.rejectPendingUser(req.params.id, req.user, ipAddress);

    const io = req.app.get('io');
    if (io) {
      io.emit('accounts:pending_updated', { action: 'reject', userId: req.params.id });
      io.emit('accounts_updated', { action: 'reject', userId: req.params.id });
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'REJECT_FAILED', message: err.message });
  }
});

// User directory
router.get('/directory', requirePermission('accounts', 'view_users'), (req, res) => {
  try {
    const { search, status } = req.query;
    const users = accountService.getUserDirectory({ search, status });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'DIRECTORY_FAILED', message: err.message });
  }
});

// Password overwrite
router.post('/:id/password', requirePermission('accounts', 'modify_passwords'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await accountService.overwritePassword(req.params.id, newPassword, req.user, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'PASSWORD_RESET_FAILED', message: err.message });
  }
});

// Toggle suspension
router.post('/:id/toggle-suspension', requirePermission('accounts', 'toggle_suspension'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = accountService.toggleSuspension(req.params.id, req.user, ipAddress);
    const io = req.app.get('io');
    if (io) {
      io.emit('permissions_updated', { userId: req.params.id, action: 'suspension' });
      io.emit('accounts_updated', { action: 'suspension', userId: req.params.id });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'SUSPENSION_FAILED', message: err.message });
  }
});

// Assign roles
router.post('/:id/roles', requirePermission('roles', 'manage_roles'), (req, res) => {
  try {
    const { role_ids } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = accountService.updateUserRoles(req.params.id, role_ids, req.user, ipAddress);
    const io = req.app.get('io');
    if (io) {
      io.emit('permissions_updated', { userId: req.params.id, action: 'role_assignment' });
      io.emit('accounts_updated', { action: 'role_assignment', userId: req.params.id });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'ROLE_ASSIGN_FAILED', message: err.message });
  }
});

// Delete account permanently
router.delete('/:id', (req, res) => {
  const canView = req.user.isAdmin || (req.user.permissions && (req.user.permissions.includes('accounts.view_users') || req.user.permissions.includes('accounts.admit_pending')));
  if (!canView) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have permission to delete accounts.' });
  }

  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = accountService.deleteUser(req.params.id, req.user, ipAddress);
    const io = req.app.get('io');
    if (io) {
      io.emit('accounts:pending_updated', { action: 'delete', userId: req.params.id });
      io.emit('accounts_updated', { action: 'delete', userId: req.params.id });
      io.emit('permissions_updated', { userId: req.params.id, action: 'deletion' });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'DELETE_FAILED', message: err.message });
  }
});

module.exports = router;
