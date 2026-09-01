const bcrypt = require('bcryptjs');
const { db } = require('../db/database');

class AccountService {
  getPendingUsers() {
    return db.users.findAll()
      .filter(u => u.status === 'PENDING')
      .map(u => ({
        id: u.id,
        username: u.username,
        status: u.status,
        created_at: u.created_at
      }));
  }

  getUserDirectory({ search, status } = {}) {
    const allUsers = db.users.findAll();
    const allRoles = db.roles.findAll();
    const rolesMap = new Map(allRoles.map(r => [r.id, r]));

    let filtered = allUsers;

    if (status) {
      filtered = filtered.filter(u => u.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(u => u.username.toLowerCase().includes(q));
    }

    return filtered.map(u => ({
      id: u.id,
      username: u.username,
      status: u.status,
      role_ids: u.role_ids || [],
      roles: (u.role_ids || []).map(rid => rolesMap.get(rid)).filter(Boolean),
      created_at: u.created_at,
      updated_at: u.updated_at
    }));
  }

  approvePendingUser(userId, actingUser, ipAddress) {
    const user = db.users.findById(userId);
    if (!user) throw new Error('User not found.');
    if (user.status !== 'PENDING') throw new Error('User is not in pending status.');

    // Assign default role
    const defaultRole = db.roles.findDefaultRole();
    const roleIds = defaultRole ? [defaultRole.id] : [];

    const updated = db.users.update(userId, {
      status: 'ACTIVE',
      role_ids: roleIds
    });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ACCOUNT',
      actionName: 'USER_APPROVED',
      details: { targetUserId: user.id, targetUsername: user.username, assignedRole: defaultRole ? defaultRole.name : 'None' },
      ipAddress
    });

    return {
      id: updated.id,
      username: updated.username,
      status: updated.status,
      role_ids: updated.role_ids
    };
  }

  rejectPendingUser(userId, actingUser, ipAddress) {
    const user = db.users.findById(userId);
    if (!user) throw new Error('User not found.');
    if (user.status !== 'PENDING') throw new Error('User is not in pending status.');

    db.users.delete(userId);

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ACCOUNT',
      actionName: 'USER_REJECTED',
      details: { targetUserId: user.id, targetUsername: user.username },
      ipAddress
    });

    return { success: true };
  }

  async overwritePassword(userId, newPassword, actingUser, ipAddress) {
    if (!newPassword || newPassword.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    const user = db.users.findById(userId);
    if (!user) throw new Error('User not found.');

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    db.users.update(userId, { password_hash });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ACCOUNT',
      actionName: 'PASSWORD_RESET',
      details: { targetUserId: user.id, targetUsername: user.username },
      ipAddress
    });

    return { success: true, message: `Password for ${user.username} has been updated.` };
  }

  toggleSuspension(userId, actingUser, ipAddress) {
    const user = db.users.findById(userId);
    if (!user) throw new Error('User not found.');

    // Prevent suspending self if admin
    if (user.id === actingUser.id) {
      throw new Error('You cannot suspend your own account.');
    }

    const newStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    db.users.update(userId, { status: newStatus });

    // Invalidate sessions if suspended
    if (newStatus === 'SUSPENDED') {
      const sessions = db.get().sessions.filter(s => s.user_id === userId);
      sessions.forEach(s => db.sessions.delete(s.token));
    }

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ACCOUNT',
      actionName: newStatus === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      details: { targetUserId: user.id, targetUsername: user.username, status: newStatus },
      ipAddress
    });

    return {
      id: user.id,
      username: user.username,
      status: newStatus
    };
  }

  updateUserRoles(userId, roleIds, actingUser, ipAddress) {
    const user = db.users.findById(userId);
    if (!user) throw new Error('User not found.');

    if (!Array.isArray(roleIds)) {
      throw new Error('Role IDs must be an array.');
    }

    const { DEFAULT_ADMIN_USERNAME } = require('../config/config');
    const allRoles = db.roles.findAll();
    let finalRoleIds = [...roleIds];

    // Protect default root admin user from ever losing admin role
    if (user.username === (DEFAULT_ADMIN_USERNAME || 'admin') || user.id === 'user_admin_01') {
      const adminRole = allRoles.find(r => r.is_admin);
      if (adminRole && !finalRoleIds.includes(adminRole.id)) {
        finalRoleIds = [adminRole.id, ...finalRoleIds];
      }
    }

    // Verify all roles exist
    const validRoleIds = finalRoleIds.filter(rid => allRoles.some(r => r.id === rid));

    db.users.update(userId, { role_ids: validRoleIds });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ROLE',
      actionName: 'USER_ROLES_UPDATED',
      details: { targetUserId: user.id, targetUsername: user.username, role_ids: validRoleIds },
      ipAddress
    });

    return {
      id: user.id,
      username: user.username,
      role_ids: validRoleIds
    };
  }

  deleteUser(userId, actingUser, ipAddress) {
    const user = db.users.findById(userId);
    if (!user) throw new Error('User not found.');

    if (user.id === actingUser.id) {
      throw new Error('You cannot delete your own account.');
    }

    // Invalidate sessions
    const sessions = db.get().sessions.filter(s => s.user_id === userId);
    sessions.forEach(s => db.sessions.delete(s.token));

    db.users.delete(userId);

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'ACCOUNT',
      actionName: 'USER_DELETED',
      details: { targetUserId: user.id, targetUsername: user.username },
      ipAddress
    });

    return { success: true, message: `Account @${user.username} has been permanently deleted.` };
  }
}

module.exports = new AccountService();
