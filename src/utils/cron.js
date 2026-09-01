const { db } = require('../db/database');
const auditService = require('../services/auditService');

function startBackgroundJobs() {
  console.log('[Background Jobs] Initialized.');

  // Run initial retention check and checklist purge on start
  auditService.runAutomatedRetentionPurge();
  db.checklists.purgeSubmittedExpired();
  db.sessions.purgeExpired();

  // Periodic checklist purge (every 10 minutes)
  const checklistInterval = setInterval(() => {
    try {
      db.checklists.purgeSubmittedExpired();
    } catch (err) {
      console.error('[Background Jobs] Error in checklist purge:', err);
    }
  }, 10 * 60 * 1000);

  // Periodic audit retention cleanup (every hour)
  const auditInterval = setInterval(() => {
    try {
      auditService.runAutomatedRetentionPurge();
    } catch (err) {
      console.error('[Background Jobs] Error in audit retention purge:', err);
    }
  }, 60 * 60 * 1000);

  // Periodic session purge (every 30 minutes)
  const sessionInterval = setInterval(() => {
    try {
      db.sessions.purgeExpired();
    } catch (err) {
      console.error('[Background Jobs] Error in session purge:', err);
    }
  }, 30 * 60 * 1000);

  return {
    stop: () => {
      clearInterval(checklistInterval);
      clearInterval(auditInterval);
      clearInterval(sessionInterval);
    }
  };
}

module.exports = {
  startBackgroundJobs
};
