const { db } = require('../db/database');
const { SESSION_COOKIE_NAME, SESSION_DURATION_MS } = require('../config/config');

function authMiddleware(req, res, next) {
  const token = req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null;

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in.'
    });
  }

  const session = db.sessions.get(token);
  if (!session) {
    // Clear invalid cookie
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please log in again.'
    });
  }

  const user = db.users.findById(session.user_id);
  if (!user) {
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(401).json({
      error: 'USER_NOT_FOUND',
      message: 'User account not found.'
    });
  }

  if (user.status === 'SUSPENDED') {
    return res.status(403).json({
      error: 'ACCOUNT_SUSPENDED',
      message: 'Your account has been suspended. Please contact an administrator.'
    });
  }

  if (user.status === 'PENDING') {
    return res.status(403).json({
      error: 'ACCOUNT_PENDING',
      message: 'Your account is pending approval by an administrator.'
    });
  }

  // Populate roles and permissions
  const allRoles = db.roles.findAll();
  const userRoles = allRoles.filter(r => (user.role_ids || []).includes(r.id));
  
  let isAdmin = userRoles.some(r => r.is_admin === true);
  const permissionsSet = new Set();
  let highestPosition = 999999;

  for (const role of userRoles) {
    if (role.position < highestPosition) {
      highestPosition = role.position;
    }
    if (Array.isArray(role.permissions)) {
      for (const p of role.permissions) {
        permissionsSet.add(p);
      }
    }
  }

  // Slide expiration window
  db.sessions.create(user.id, token, SESSION_DURATION_MS);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DURATION_MS
  });

  req.user = {
    id: user.id,
    username: user.username,
    status: user.status,
    role_ids: user.role_ids || [],
    roles: userRoles,
    isAdmin,
    highestPosition,
    permissions: Array.from(permissionsSet),
    theme: user.theme || 'dark'
  };
  req.sessionToken = token;

  next();
}

// Optional Auth (does not block if no token, but populates req.user if valid)
function optionalAuthMiddleware(req, res, next) {
  const token = req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null;
  if (!token) return next();

  const session = db.sessions.get(token);
  if (!session) return next();

  const user = db.users.findById(session.user_id);
  if (!user) return next();

  const allRoles = db.roles.findAll();
  const userRoles = allRoles.filter(r => (user.role_ids || []).includes(r.id));
  const isAdmin = userRoles.some(r => r.is_admin === true);
  const permissionsSet = new Set();
  let highestPosition = 999999;

  for (const role of userRoles) {
    if (role.position < highestPosition) highestPosition = role.position;
    if (Array.isArray(role.permissions)) {
      for (const p of role.permissions) permissionsSet.add(p);
    }
  }

  req.user = {
    id: user.id,
    username: user.username,
    status: user.status,
    role_ids: user.role_ids || [],
    roles: userRoles,
    isAdmin,
    highestPosition,
    permissions: Array.from(permissionsSet),
    theme: user.theme || 'dark'
  };
  req.sessionToken = token;
  next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};
