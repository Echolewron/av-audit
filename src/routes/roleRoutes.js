const express = require('express');
const router = express.Router();
const roleService = require('../services/roleService');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { PERMISSION_REGISTRY, PERMISSION_METADATA } = require('../config/permissions');

router.use(authMiddleware);

// Get permission registry definitions and metadata
router.get('/registry', (req, res) => {
  res.json({
    registry: PERMISSION_REGISTRY,
    metadata: PERMISSION_METADATA
  });
});

// Get all roles
router.get('/', (req, res) => {
  try {
    const roles = roleService.getAllRoles();
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_ROLES_FAILED', message: err.message });
  }
});

// Create role
router.post('/', requirePermission('roles', 'manage_roles'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const role = roleService.createRole(req.body, req.user, ipAddress);
    if (req.app.get('io')) {
      req.app.get('io').emit('permissions_updated', { roleId: role.id, action: 'create' });
    }
    res.status(201).json({ success: true, role });
  } catch (err) {
    res.status(400).json({ error: 'CREATE_ROLE_FAILED', message: err.message });
  }
});

// Update role
router.put('/:id', requirePermission('roles', 'manage_roles'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const role = roleService.updateRole(req.params.id, req.body, req.user, ipAddress);
    if (req.app.get('io')) {
      req.app.get('io').emit('permissions_updated', { roleId: role.id, action: 'update' });
    }
    res.json({ success: true, role });
  } catch (err) {
    res.status(400).json({ error: 'UPDATE_ROLE_FAILED', message: err.message });
  }
});

// Delete role
router.delete('/:id', requirePermission('roles', 'manage_roles'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = roleService.deleteRole(req.params.id, req.user, ipAddress);
    if (req.app.get('io')) {
      req.app.get('io').emit('permissions_updated', { roleId: req.params.id, action: 'delete' });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'DELETE_ROLE_FAILED', message: err.message });
  }
});

// Reorder role hierarchy
router.post('/reorder', requirePermission('roles', 'manage_roles'), (req, res) => {
  try {
    const { orderedRoleIds } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const roles = roleService.reorderRoles(orderedRoleIds, req.user, ipAddress);
    if (req.app.get('io')) {
      req.app.get('io').emit('permissions_updated', { action: 'reorder' });
    }
    res.json({ success: true, roles });
  } catch (err) {
    res.status(400).json({ error: 'REORDER_ROLES_FAILED', message: err.message });
  }
});

module.exports = router;
