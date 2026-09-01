const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { SESSION_COOKIE_NAME, SESSION_DURATION_MS } = require('../config/config');

// Cookie options
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_DURATION_MS
};

// Public Client Config (Session timing & countdown durations)
router.get('/client-config', (req, res) => {
  const { sessionDurationHours, inactivityWarningMinutes, SESSION_DURATION_MS, INACTIVITY_WARNING_MS } = require('../config/config');
  const packageJson = require('../../package.json');
  res.json({
    version: packageJson.version || '1.0.0',
    sessionDurationHours,
    inactivityWarningMinutes,
    sessionDurationMs: SESSION_DURATION_MS,
    inactivityWarningMs: INACTIVITY_WARNING_MS
  });
});

// Register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await authService.register({ username, password, ipAddress });

    const io = req.app.get('io');
    if (io) {
      io.emit('accounts:pending_updated', { action: 'register', user: result });
      io.emit('accounts_updated', { action: 'register' });
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({
      error: err.code || 'REGISTRATION_FAILED',
      field: err.field,
      message: err.message
    });
  }
});

// Check account registration/approval status without requiring active session
router.get('/check-status', (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'USERNAME_REQUIRED', message: 'Username is required.' });
  }
  const { db } = require('../db/database');
  const user = db.users.findByUsername(username.trim());
  if (!user) {
    return res.json({ status: 'NOT_FOUND', username });
  }
  res.json({
    status: user.status,
    username: user.username,
    id: user.id
  });
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await authService.login({ username, password, ipAddress });

    // Set HTTP-only session cookie
    res.cookie(SESSION_COOKIE_NAME, result.token, cookieOptions);

    res.json({
      success: true,
      user: result.user
    });
  } catch (err) {
    const statusCode = err.code === 'ACCOUNT_PENDING' || err.code === 'ACCOUNT_SUSPENDED' ? 403 : 401;
    res.status(statusCode).json({
      error: err.code || 'LOGIN_FAILED',
      field: err.field,
      message: err.message,
      status: err.status
    });
  }
});

// Extend session by 2 hours ("I'm still here" heartbeat renewal)
router.post('/extend-session', authMiddleware, (req, res) => {
  try {
    const { db } = require('../db/database');
    const ipAddress = req.ip || req.connection.remoteAddress;
    const extended = db.sessions.extend(req.sessionToken, SESSION_DURATION_MS);
    if (!extended) {
      return res.status(401).json({ error: 'SESSION_EXPIRED', message: 'Session has expired' });
    }

    // Refresh HTTP-only cookie with full 2-hour maxAge
    res.cookie(SESSION_COOKIE_NAME, req.sessionToken, cookieOptions);

    db.audit.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'AUTH',
      actionName: 'SESSION_EXTENDED',
      details: { reason: 'User confirmed presence via inactivity warning' },
      ipAddress
    });

    res.json({
      success: true,
      message: 'Session extended by 2 hours successfully',
      expires_at: extended.expires_at
    });
  } catch (err) {
    res.status(500).json({ error: 'EXTEND_FAILED', message: err.message });
  }
});

// Change Password (requires current password & new password)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await authService.changePassword({
      userId: req.user.id,
      currentPassword,
      newPassword,
      ipAddress
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({
      error: err.code || 'PASSWORD_CHANGE_FAILED',
      field: err.field,
      message: err.message
    });
  }
});

// Logout
router.post('/logout', optionalAuthMiddleware, async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    await authService.logout({
      sessionToken: req.sessionToken,
      user: req.user,
      ipAddress
    });
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'LOGOUT_FAILED', message: err.message });
  }
});

// Get current profile
router.get('/me', authMiddleware, (req, res) => {
  const packageJson = require('../../package.json');
  res.json({
    appVersion: packageJson.version || '1.0.0',
    user: {
      id: req.user.id,
      username: req.user.username,
      status: req.user.status,
      role_ids: req.user.role_ids,
      roles: req.user.roles,
      isAdmin: req.user.isAdmin,
      permissions: req.user.permissions,
      highestPosition: req.user.highestPosition
    }
  });
});

module.exports = router;
