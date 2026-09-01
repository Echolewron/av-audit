const { hasPermission } = require('../config/permissions');

// Middleware to enforce specific module permission
function requirePermission(module, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (req.user.isAdmin) {
      return next();
    }

    const permitted = hasPermission(req.user.permissions, module, action, req.user.isAdmin);
    if (!permitted) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `You do not possess the required permission: ${module}.${action}`,
        requiredPermission: `${module}.${action}`
      });
    }

    next();
  };
}

// Middleware to check any of multiple permissions
function requireAnyPermission(permissionPairs) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (req.user.isAdmin) {
      return next();
    }

    for (const [module, action] of permissionPairs) {
      if (hasPermission(req.user.permissions, module, action, req.user.isAdmin)) {
        return next();
      }
    }

    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied: Insufficient permissions',
      requiredPermissions: permissionPairs.map(([m, a]) => `${m}.${a}`)
    });
  };
}

// Helper: Check if user can modify a specific role based on position authority
function canUserModifyRole(actingUser, targetRole) {
  if (actingUser.isAdmin) return true;
  if (!targetRole) return true; // creating new role allowed if has manage_roles
  // Discord-style rule: User can only modify roles strictly BELOW their highest role position
  // Position 1 is top, Position 2 is lower, Position 3 is lower still.
  // So actingUser.highestPosition must be numerically LESS than targetRole.position
  return actingUser.highestPosition < targetRole.position;
}

// Helper: Check if user can assign the requested permissions
function canUserAssignPermissions(actingUser, requestedPermissions) {
  if (actingUser.isAdmin) return true;
  if (!Array.isArray(requestedPermissions)) return true;

  const userPerms = new Set(actingUser.permissions || []);
  for (const perm of requestedPermissions) {
    if (!userPerms.has(perm) && !userPerms.has('*')) {
      return false;
    }
  }
  return true;
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  canUserModifyRole,
  canUserAssignPermissions
};
