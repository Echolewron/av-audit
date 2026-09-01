const { TIMEZONE } = require('../config/config');

// Helper to get current Date or parse input
function toDate(d) {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  return new Date(d);
}

// Format time as h:mm:ss A in America/Los_Angeles (12-hour American format with seconds)
function formatTimeLA(date) {
  const d = toDate(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  return formatter.format(d);
}

// Format submission time as "MMM D, h:mm A" e.g., "Aug 18, 2:30 PM"
function formatSubmissionTimeLA(date) {
  const d = toDate(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return formatter.format(d);
}

// Format day key as "YYYY-MM-DD" in America/Los_Angeles (for grouping audit logs by day)
function getDayKeyLA(date) {
  const d = toDate(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(d);
  let year = '', month = '', day = '';
  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    if (p.type === 'month') month = p.value;
    if (p.type === 'day') day = p.value;
  }
  return `${year}-${month}-${day}`;
}

// Format friendly day label e.g., "Today (Aug 18, 2026)" or "Yesterday (Aug 17, 2026)" or "Aug 15, 2026"
function formatDayLabelLA(date) {
  const d = toDate(date);
  const todayKey = getDayKeyLA(new Date());
  const targetKey = getDayKeyLA(d);
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDayKeyLA(yesterday);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const formatted = formatter.format(d);

  if (targetKey === todayKey) {
    return `Today (${formatted})`;
  } else if (targetKey === yesterdayKey) {
    return `Yesterday (${formatted})`;
  }
  return formatted;
}

// Format full string in American format (no PT suffix)
function formatFullLA(date) {
  const d = toDate(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  return formatter.format(d);
}

// Get day of week in America/Los_Angeles ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun') and 0-6 index
function getDayOfWeekLA(date) {
  const d = toDate(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short'
  });
  const shortName = formatter.format(d); // e.g. 'Mon', 'Fri'
  const dayIndexMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return {
    code: shortName, // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
    index: dayIndexMap[shortName] !== undefined ? dayIndexMap[shortName] : d.getDay()
  };
}

module.exports = {
  TIMEZONE,
  formatTimeLA,
  formatSubmissionTimeLA,
  getDayKeyLA,
  formatDayLabelLA,
  formatFullLA,
  getDayOfWeekLA
};
