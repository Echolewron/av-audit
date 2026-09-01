// Audit Log Humanizer Utility
// Converts technical audit log codes, action names, and raw details into clean, user-friendly plain English.

function humanizeAuditLog(log, dbState = null) {
  const actionType = (log.action_type || log.category || 'GENERAL').toUpperCase();
  const rawAction = (log.action_name || log.action || '').toUpperCase();
  const details = log.details || {};
  
  let action = '';
  let summary = '';

  // Extract common fields safely
  const getString = (key) => (typeof details === 'object' && details !== null ? details[key] : null);
  const rawMsg = typeof details === 'string' ? details : details.message;

  switch (rawAction) {
    // 🔐 AUTHENTICATION
    case 'LOGIN_SUCCESS':
      action = 'Signed In';
      summary = 'User successfully signed in to the console.';
      break;
    case 'LOGIN_FAILED':
      action = 'Sign-in Failed';
      const reason = getString('reason') || 'Invalid credentials';
      summary = `Unsuccessful sign-in attempt (${reason}).`;
      break;
    case 'LOGIN_BLOCKED_PENDING':
      action = 'Sign-in Blocked';
      summary = 'Sign-in blocked because account is pending approval.';
      break;
    case 'LOGIN_BLOCKED_SUSPENDED':
      action = 'Sign-in Blocked';
      summary = 'Sign-in blocked because account has been suspended.';
      break;
    case 'LOGOUT':
      action = 'Signed Out';
      summary = 'User signed out of the console.';
      break;
    case 'SYSTEM_INITIALIZATION':
      action = 'System Initialized';
      summary = 'AV Audit platform initialized with default security policies.';
      break;

    // 👤 ACCOUNT MANAGEMENT
    case 'USER_REGISTERED':
      action = 'Account Registered';
      const regUser = getString('username') || log.username || 'User';
      summary = `New account registered for @${regUser} (Pending approval).`;
      break;
    case 'USER_APPROVED':
      action = 'Approved Account';
      const appUser = getString('targetUsername') || 'user';
      const roleAssigned = getString('assignedRole');
      summary = `Approved account for @${appUser}${roleAssigned && roleAssigned !== 'None' ? ` and assigned role "${roleAssigned}"` : ''}.`;
      break;
    case 'USER_REJECTED':
      action = 'Rejected Account';
      const rejUser = getString('targetUsername') || 'user';
      summary = `Rejected and removed registration request for @${rejUser}.`;
      break;
    case 'USER_SUSPENDED':
      action = 'Suspended Account';
      const susUser = getString('targetUsername') || 'user';
      summary = `Suspended account for @${susUser} and terminated active sessions.`;
      break;
    case 'USER_REACTIVATED':
      action = 'Reactivated Account';
      const reactUser = getString('targetUsername') || 'user';
      summary = `Restored and reactivated account for @${reactUser}.`;
      break;
    case 'PASSWORD_RESET':
      action = 'Reset Password';
      const passUser = getString('targetUsername') || 'user';
      summary = `Updated password for @${passUser}.`;
      break;

    // 🛡️ ROLES & HIERARCHY
    case 'ROLE_CREATED':
      action = 'Created Role';
      const createdRole = getString('roleName') || 'New Role';
      summary = `Created new role "${createdRole}".`;
      break;
    case 'ROLE_UPDATED':
      action = 'Updated Role';
      const updatedRole = getString('roleName') || 'Role';
      summary = `Updated settings and permissions for role "${updatedRole}".`;
      break;
    case 'ROLE_DELETED':
      action = 'Deleted Role';
      const deletedRole = getString('roleName') || 'Role';
      summary = `Deleted role "${deletedRole}".`;
      break;
    case 'ROLE_HIERARCHY_REORDERED':
      action = 'Reordered Hierarchy';
      summary = 'Reordered priority hierarchy for roles.';
      break;
    case 'USER_ROLES_UPDATED':
      action = 'Assigned Roles';
      const targetRolesUser = getString('targetUsername') || 'user';
      summary = `Updated assigned role permissions for @${targetRolesUser}.`;
      break;

    // ✅ CHECKLISTS
    case 'CHECKLIST_CREATED':
      action = 'Spawned Checklist';
      const chkTitle = getString('title') || 'Checklist';
      summary = `Spawned active checklist "${chkTitle}".`;
      break;
    case 'ITEM_CHECKED':
      action = 'Completed Task';
      const checkedTitle = getString('itemTitle') || 'Item';
      summary = `Checked "${checkedTitle}".`;
      break;
    case 'ITEM_UNCHECKED':
      action = 'Unchecked Task';
      const uncheckedTitle = getString('itemTitle') || 'Item';
      summary = `Unchecked "${uncheckedTitle}".`;
      break;
    case 'ITEM_NOTE_UPDATED':
      action = 'Updated Note';
      const noteTitle = getString('itemTitle') || 'Item';
      const hasIssue = getString('has_issue');
      const note = getString('issue_note');
      if (hasIssue) {
        summary = `Flagged issue on "${noteTitle}"${note ? `: "${note}"` : ''}.`;
      } else if (note) {
        summary = `Added note to "${noteTitle}": "${note}".`;
      } else {
        summary = `Cleared note on "${noteTitle}".`;
      }
      break;
    case 'CHECKLIST_STRUCTURE_MODIFIED':
      action = 'Modified Structure';
      summary = 'Updated checklist tasks or reordered checklist items.';
      break;
    case 'CHECKLIST_SUBMITTED':
      action = 'Submitted Checklist';
      const subTitle = getString('title') || 'Checklist';
      summary = `Completed and submitted checklist "${subTitle}".`;
      break;
    case 'CHECKLIST_UNSUBMITTED':
      action = 'Reopened Checklist';
      const unsubTitle = getString('title') || 'Checklist';
      summary = `Reopened submitted checklist "${unsubTitle}".`;
      break;
    case 'CHECKLIST_DELETED':
      action = 'Deleted Checklist';
      const delChkTitle = getString('title') || 'Checklist';
      summary = `Deleted active checklist "${delChkTitle}".`;
      break;
    case 'ALL_CHECKLISTS_DELETED':
      action = 'Purged Checklists';
      const purgedChkCount = getString('count') || 'all';
      summary = `Deleted all ${purgedChkCount} active checklists.`;
      break;

    // 📄 TEMPLATES
    case 'TEMPLATE_CREATED':
      action = 'Created Template';
      const tplCreated = getString('title') || 'Template';
      const tplItems = getString('itemCount');
      summary = `Created template "${tplCreated}"${tplItems ? ` with ${tplItems} items` : ''}.`;
      break;
    case 'TEMPLATE_UPDATED':
      action = 'Updated Template';
      const tplUpdated = getString('title') || 'Template';
      summary = `Updated template "${tplUpdated}".`;
      break;
    case 'TEMPLATE_DELETED':
      action = 'Deleted Template';
      const tplDeleted = getString('title') || 'Template';
      summary = `Deleted template "${tplDeleted}".`;
      break;
    case 'ALL_TEMPLATES_DELETED':
      action = 'Purged Templates';
      const purgedTplCount = getString('count') || 'all';
      summary = `Deleted all ${purgedTplCount} templates.`;
      break;
    case 'TEMPLATE_INLINE_SYNCED':
      action = 'Synced Template';
      const tplSynced = getString('title') || 'Template';
      summary = `Synced template "${tplSynced}" from checklist edits.`;
      break;

    // ⚡ AUTOMATION
    case 'AUTOMATION_EXECUTED':
      action = 'Triggered Webhook';
      const autoMethod = getString('method') || 'HTTP';
      const autoItem = getString('itemTitle') || 'Automation item';
      const autoSuccess = getString('success');
      const autoStatus = getString('status');
      summary = `${autoMethod} webhook for "${autoItem}" (${autoSuccess ? 'Success 200' : `Failed ${autoStatus || ''}`.trim()}).`;
      break;

    // 📊 DASHBOARDS
    case 'CREATE_DASHBOARD':
      action = 'Created Dashboard';
      const dashName = getString('name') || 'Dashboard';
      summary = `Created custom dashboard "${dashName}".`;
      break;
    case 'UPDATE_DASHBOARD':
      action = 'Updated Dashboard';
      const dashUpName = getString('name') || 'Dashboard';
      summary = `Updated custom dashboard "${dashUpName}".`;
      break;
    case 'DELETE_DASHBOARD':
      action = 'Deleted Dashboard';
      const dashDelName = getString('name') || 'Dashboard';
      summary = `Deleted custom dashboard "${dashDelName}".`;
      break;

    // 🎙️ SERMON SENDER
    case 'SEND_SERMON':
      action = 'Sent Sermon';
      summary = rawMsg ? rawMsg.replace(/Size: [\d.]+ MB/, (m) => m) : 'Successfully recorded and emailed sermon audio file.';
      break;
    case 'RESEND_SERMON':
      action = 'Resent Sermon';
      summary = rawMsg || 'Resent sermon audio recording via email.';
      break;
    case 'DELETE_SERMON_SUBMISSION':
      action = 'Deleted Sermon';
      summary = rawMsg || 'Deleted sermon submission and audio file.';
      break;
    case 'UPDATE_SERMON_SETTINGS':
      action = 'Updated Sermon Config';
      summary = rawMsg || 'Updated Sermon Sender email and compression configuration.';
      break;

    // ⚙️ AUDIT SYSTEM
    case 'RETENTION_CONFIG_UPDATED':
      action = 'Updated Retention';
      const retDays = getString('newRetentionDays') || '30';
      summary = `Changed automated log retention threshold to ${retDays} days.`;
      break;
    case 'PURGE_TODAY_LOGS':
      action = 'Purged Today\'s Logs';
      const delTodayCount = getString('deletedCount') || 0;
      summary = `Purged ${delTodayCount} log entries from today.`;
      break;
    case 'PURGE_ALL_LOGS':
      action = 'Purged All Logs';
      const delAllCount = getString('deletedCount') || 0;
      summary = `Purged all ${delAllCount} historical audit logs.`;
      break;

    // 🔄 DEFAULT FALLBACK
    default:
      // Clean up raw action string
      if (rawAction) {
        action = rawAction.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      } else {
        action = 'System Event';
      }

      if (typeof details === 'string' && details.trim()) {
        summary = details.trim();
      } else if (typeof details === 'object' && details !== null) {
        if (details.message) {
          summary = details.message;
        } else {
          // Format object nicely without JSON brackets or technical keys
          const parts = [];
          for (const [k, v] of Object.entries(details)) {
            if (k.toLowerCase().includes('id') || k.toLowerCase().includes('hash')) continue;
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
              const cleanKey = k.replace(/_/g, ' ');
              parts.push(`${cleanKey}: ${v}`);
            }
          }
          summary = parts.length > 0 ? parts.join(', ') : 'Action executed.';
        }
      } else {
        summary = 'Action executed.';
      }
      break;
  }

  return {
    action,
    summary
  };
}

module.exports = {
  humanizeAuditLog
};
