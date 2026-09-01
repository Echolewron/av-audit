const { db } = require('../db/database');
const { canUserModifyRole, canUserAssignPermissions } = require('../middleware/rbac');

class RoleService {
  getAllRoles() {
    return db.roles.findAll();
  }

  getRoleById(id) {
    return db.roles.findById(id);
  }

  createRole({ name, color_hex, position, permissions, is_default, is_admin }, actingUser, ipAddress) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Role name is required.');
    }

    // Permission Grant Limitation Check
    if (!canUserAssignPermissions(actingUser, permissions)) {
      throw new Error('You cannot grant permissions that your own role does not explicitly possess.');
    }

    // Only Admins can create another Admin role
    if (is_admin && !actingUser.isAdmin) {
      throw new Error('Only administrators can create Admin roles.');
    }

    const allRoles = db.roles.findAll();
    let targetPos = position;
    if (!targetPos || targetPos < 1) {
      targetPos = allRoles.length + 1;
    }

    // Discord-style hierarchy check: Cannot place a new role higher or equal to acting user's position
    if (!actingUser.isAdmin && targetPos <= actingUser.highestPosition) {
      targetPos = actingUser.highestPosition + 1;
    }

    if (is_default) {
      // Unset other default roles
      allRoles.forEach(r => {
        if (r.is_default) {
          db.roles.update(r.id, { is_default: false });
        }
      });
    }

    const newRole = db.roles.create({
      name: name.trim(),
      color_hex: color_hex || '#8b949e',
      position: targetPos,
      permissions: Array.isArray(permissions) ? permissions : [],
      is_default: Boolean(is_default),
      is_admin: Boolean(is_admin)
    });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ROLE',
      actionName: 'ROLE_CREATED',
      details: { roleId: newRole.id, roleName: newRole.name, position: newRole.position, is_admin: newRole.is_admin },
      ipAddress
    });

    return newRole;
  }

  updateRole(roleId, updates, actingUser, ipAddress) {
    const role = db.roles.findById(roleId);
    if (!role) {
      throw new Error('Role not found.');
    }

    // Position-Based Authority Check: Users can only modify roles *below* their highest role
    if (!canUserModifyRole(actingUser, role)) {
      throw new Error(`You cannot modify role "${role.name}" because it is equal to or higher than your highest role in the hierarchy.`);
    }

    // Permission Grant Limitation Check
    if (updates.permissions && !canUserAssignPermissions(actingUser, updates.permissions)) {
      throw new Error('You cannot assign permissions that your own role does not explicitly possess.');
    }

    // Admin toggle check
    if (updates.is_admin !== undefined && updates.is_admin !== role.is_admin && !actingUser.isAdmin) {
      throw new Error('Only administrators can modify the Make Admin setting.');
    }

    if (updates.is_default) {
      const allRoles = db.roles.findAll();
      allRoles.forEach(r => {
        if (r.id !== roleId && r.is_default) {
          db.roles.update(r.id, { is_default: false });
        }
      });
    }

    const updated = db.roles.update(roleId, {
      name: updates.name ? updates.name.trim() : role.name,
      color_hex: updates.color_hex || role.color_hex,
      permissions: updates.permissions !== undefined ? updates.permissions : role.permissions,
      is_default: updates.is_default !== undefined ? Boolean(updates.is_default) : role.is_default,
      is_admin: updates.is_admin !== undefined ? Boolean(updates.is_admin) : role.is_admin
    });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ROLE',
      actionName: 'ROLE_UPDATED',
      details: { roleId: updated.id, roleName: updated.name, changes: updates },
      ipAddress
    });

    return updated;
  }

  deleteRole(roleId, actingUser, ipAddress) {
    const role = db.roles.findById(roleId);
    if (!role) {
      throw new Error('Role not found.');
    }

    if (!canUserModifyRole(actingUser, role)) {
      throw new Error(`You cannot delete role "${role.name}" because it is equal to or higher than your highest role in the hierarchy.`);
    }

    if (role.is_admin && db.roles.findAll().filter(r => r.is_admin).length <= 1) {
      throw new Error('Cannot delete the sole administrator role.');
    }

    // Remove role from users who have it
    const allUsers = db.users.findAll();
    allUsers.forEach(u => {
      if (u.role_ids && u.role_ids.includes(roleId)) {
        const newRoles = u.role_ids.filter(id => id !== roleId);
        db.users.update(u.id, { role_ids: newRoles });
      }
    });

    db.roles.delete(roleId);

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ROLE',
      actionName: 'ROLE_DELETED',
      details: { roleId, roleName: role.name },
      ipAddress
    });

    return { success: true };
  }

  reorderRoles(orderedRoleIds, actingUser, ipAddress) {
    if (!Array.isArray(orderedRoleIds)) {
      throw new Error('Role IDs array required.');
    }

    const allRoles = db.roles.findAll();

    // If not admin, verify that user isn't modifying roles above/equal to themselves
    if (!actingUser.isAdmin) {
      for (const role of allRoles) {
        if (role.position <= actingUser.highestPosition) {
          const oldIndex = allRoles.findIndex(r => r.id === role.id);
          const newIndex = orderedRoleIds.indexOf(role.id);
          if (oldIndex !== newIndex) {
            throw new Error('You cannot reorder roles that are equal to or higher than your position in the hierarchy.');
          }
        }
      }
    }

    const reordered = db.roles.reorder(orderedRoleIds);

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ROLE',
      actionName: 'ROLE_HIERARCHY_REORDERED',
      details: { orderedRoleIds },
      ipAddress
    });

    return reordered;
  }
}

module.exports = new RoleService();
