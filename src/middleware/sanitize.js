// Sanitization to neutralize malicious script and HTML injections
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript\s*:/gi, '');
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    // We do not sanitize raw automation body if it is meant to be a valid JSON or payload
    if (key === 'body' || key === 'headers') {
      result[key] = value;
    } else if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    // Preserve body while escaping hazardous HTML where appropriate
    // Note: For password fields or raw config payloads, we don't escape HTML chars
    const rawPassword = req.body.password;
    const rawNewPassword = req.body.newPassword;
    const rawAutomation = req.body.automation;

    req.body = sanitizeObject(req.body);

    if (rawPassword !== undefined) req.body.password = rawPassword;
    if (rawNewPassword !== undefined) req.body.newPassword = rawNewPassword;
    if (rawAutomation !== undefined) req.body.automation = rawAutomation;
  }
  next();
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeMiddleware
};
