const fs = require('fs');
const path = require('path');

// Load user-defined configuration from config.json if available
const CONFIG_FILE_PATH = path.resolve(__dirname, '../../config.json');
let userConfig = {};

if (fs.existsSync(CONFIG_FILE_PATH)) {
  try {
    const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
    userConfig = JSON.parse(raw);
  } catch (err) {
    console.error('Warning: Failed to parse config.json, using defaults:', err.message);
  }
}

const serverConfig = userConfig.server || {};
const authConfig = userConfig.auth || {};
const retentionConfig = userConfig.retention || {};

const PORT = process.env.PORT || serverConfig.port || 3011;
const SESSION_SECRET = process.env.SESSION_SECRET || 'av_audit_secure_session_secret_2026';
const TIMEZONE = serverConfig.timezone || 'America/Los_Angeles';
const SESSION_COOKIE_NAME = 'av_audit_session';

// Session duration in ms
const sessionDurationHours = parseFloat(authConfig.sessionDurationHours) || 2;
const SESSION_DURATION_MS = sessionDurationHours * 60 * 60 * 1000;

// Inactivity warning duration (how long "Are you still there" countdown appears)
const inactivityWarningMinutes = parseFloat(authConfig.inactivityWarningMinutes) || 10;
const INACTIVITY_WARNING_MS = inactivityWarningMinutes * 60 * 1000;

// Default admin credentials
const DEFAULT_ADMIN_USERNAME = (authConfig.defaultAdminUsername || 'admin').trim();
const DEFAULT_ADMIN_PASSWORD = authConfig.defaultAdminPassword || 'admin123';

const DEFAULT_LOG_RETENTION_DAYS = parseInt(retentionConfig.defaultLogRetentionDays, 10) || 30;
const CHECKLIST_SUBMISSION_PURGE_HOURS = parseInt(retentionConfig.checklistSubmissionPurgeHours, 10) || 6;

/**
 * Resolves relative or localhost URLs dynamically to the active configured PORT
 */
function resolveUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) {
    return `http://127.0.0.1:${PORT}${trimmed}`;
  }
  return trimmed.replace(/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)?$/i, (match, path) => {
    return `http://127.0.0.1:${PORT}${path || ''}`;
  });
}

module.exports = {
  PORT,
  TIMEZONE,
  SESSION_SECRET,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  INACTIVITY_WARNING_MS,
  sessionDurationHours,
  inactivityWarningMinutes,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_LOG_RETENTION_DAYS,
  CHECKLIST_SUBMISSION_PURGE_HOURS,
  DATA_DIR: process.env.DATA_DIR || './data',
  resolveUrl
};
