const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
const { SESSION_DURATION_MS } = require('../config/config');

class AuthService {
  async register({ username, password, ipAddress }) {
    if (!username || typeof username !== 'string' || username.trim().length < 4) {
      throw new Error('Username must be at least 4 characters long.');
    }
    if (!password || typeof password !== 'string' || password.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    const cleanUsername = username.trim();
    const existing = db.users.findByUsername(cleanUsername);
    if (existing) {
      const err = new Error('Username already exists');
      err.code = 'USERNAME_TAKEN';
      err.field = 'username';
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = db.users.create({
      username: cleanUsername,
      password_hash,
      role_ids: [],
      status: 'PENDING'
    });

    db.audit.log({
      userId: newUser.id,
      username: newUser.username,
      actionType: 'ACCOUNT',
      actionName: 'USER_REGISTERED',
      details: { username: newUser.username, status: 'PENDING' },
      ipAddress
    });

    return {
      id: newUser.id,
      username: newUser.username,
      status: newUser.status,
      message: 'Account registered successfully. Your account is pending administrator approval.'
    };
  }

  async login({ username, password, ipAddress }) {
    if (!username || !password) {
      const err = new Error('Username and password are required.');
      err.code = 'REQUIRED_FIELDS_MISSING';
      throw err;
    }

    const user = db.users.findByUsername(username.trim());
    if (!user) {
      db.audit.log({
        userId: 'unknown',
        username: username.trim(),
        actionType: 'AUTH',
        actionName: 'LOGIN_FAILED',
        details: { reason: 'User not found', username: username.trim() },
        ipAddress
      });
      const err = new Error("User doesn't exist");
      err.code = 'USER_NOT_FOUND';
      err.field = 'username';
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      db.audit.log({
        userId: user.id,
        username: user.username,
        actionType: 'AUTH',
        actionName: 'LOGIN_FAILED',
        details: { reason: 'Incorrect password' },
        ipAddress
      });
      const err = new Error('Incorrect password');
      err.code = 'INVALID_PASSWORD';
      err.field = 'password';
      throw err;
    }

    if (user.status === 'PENDING') {
      db.audit.log({
        userId: user.id,
        username: user.username,
        actionType: 'AUTH',
        actionName: 'LOGIN_BLOCKED_PENDING',
        details: { status: 'PENDING' },
        ipAddress
      });
      const err = new Error('Your account is pending approval by an administrator.');
      err.code = 'ACCOUNT_PENDING';
      err.status = 'PENDING';
      throw err;
    }

    if (user.status === 'SUSPENDED') {
      db.audit.log({
        userId: user.id,
        username: user.username,
        actionType: 'AUTH',
        actionName: 'LOGIN_BLOCKED_SUSPENDED',
        details: { status: 'SUSPENDED' },
        ipAddress
      });
      const err = new Error('Your account has been suspended. Please contact an administrator.');
      err.code = 'ACCOUNT_SUSPENDED';
      err.status = 'SUSPENDED';
      throw err;
    }

    // Create session token
    const token = uuidv4();
    db.sessions.create(user.id, token, SESSION_DURATION_MS);

    db.audit.log({
      userId: user.id,
      username: user.username,
      actionType: 'AUTH',
      actionName: 'LOGIN_SUCCESS',
      details: { role_ids: user.role_ids },
      ipAddress
    });

    const allRoles = db.roles.findAll();
    const userRoles = allRoles.filter(r => (user.role_ids || []).includes(r.id));
    const isAdmin = userRoles.some(r => r.is_admin);
    const permissions = [...new Set(userRoles.flatMap(r => r.permissions || []))];

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        status: user.status,
        role_ids: user.role_ids,
        roles: userRoles,
        isAdmin,
        permissions
      }
    };
  }

  async changePassword({ userId, currentPassword, newPassword, ipAddress }) {
    if (!currentPassword || !newPassword) {
      const err = new Error('Current password and new password are required.');
      err.code = 'REQUIRED_FIELDS_MISSING';
      throw err;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 4) {
      const err = new Error('New password must be at least 4 characters long.');
      err.code = 'INVALID_PASSWORD_LENGTH';
      err.field = 'newPassword';
      throw err;
    }
    const user = db.users.findById(userId);
    if (!user) {
      const err = new Error('User account not found.');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      db.audit.log({
        userId: user.id,
        username: user.username,
        actionType: 'ACCOUNT',
        actionName: 'PASSWORD_CHANGE_FAILED',
        details: { reason: 'Incorrect current password' },
        ipAddress
      });
      const err = new Error('Incorrect current password.');
      err.code = 'INVALID_CURRENT_PASSWORD';
      err.field = 'currentPassword';
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);
    db.users.update(user.id, { password_hash });

    db.audit.log({
      userId: user.id,
      username: user.username,
      actionType: 'ACCOUNT',
      actionName: 'PASSWORD_CHANGED',
      details: { message: 'User updated their personal password' },
      ipAddress
    });

    return { success: true, message: 'Password updated successfully.' };
  }

  async logout({ sessionToken, user, ipAddress }) {
    if (sessionToken) {
      db.sessions.delete(sessionToken);
    }
    if (user) {
      db.audit.log({
        userId: user.id,
        username: user.username,
        actionType: 'AUTH',
        actionName: 'LOGOUT',
        details: {},
        ipAddress
      });
    }
    return { success: true };
  }
}

module.exports = new AuthService();
