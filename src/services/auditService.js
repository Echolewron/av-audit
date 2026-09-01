const { db } = require('../db/database');
const { getDayKeyLA, formatDayLabelLA } = require('../utils/timezone');
const { DEFAULT_LOG_RETENTION_DAYS } = require('../config/config');
const { humanizeAuditLog } = require('../utils/auditHumanizer');

class AuditService {
  getUserRoleMap() {
    const allUsers = db.users.findAll();
    const allRoles = db.roles.findAll();
    const rolesMap = new Map(allRoles.map(r => [r.id, r]));

    const userMap = new Map();
    for (const u of allUsers) {
      const userRoles = (u.role_ids || []).map(rid => rolesMap.get(rid)).filter(Boolean);
      // Sort to find highest role (admin first, then lowest position number)
      userRoles.sort((a, b) => {
        if (a.is_admin && !b.is_admin) return -1;
        if (!a.is_admin && b.is_admin) return 1;
        return (a.position || 999) - (b.position || 999);
      });
      const topRole = userRoles[0];
      userMap.set(u.username.toLowerCase(), {
        userId: u.id,
        username: u.username,
        roleName: topRole ? topRole.name : 'Standard User',
        roleColor: topRole ? topRole.color_hex : '#8b949e'
      });
      userMap.set(u.id, userMap.get(u.username.toLowerCase()));
    }
    return { userMap, allUsers, allRoles };
  }

  getLogs({ user, actionType, startDate, endDate, search } = {}) {
    let logs = db.audit.findAll();
    const { userMap, allUsers } = this.getUserRoleMap();

    // Map enriched properties on all logs
    const enrichedLogs = logs.map(l => {
      const uInfo = userMap.get((l.username || '').toLowerCase()) || userMap.get(l.user_id) || {
        roleName: l.username === 'System' || l.username === 'system' ? 'System' : 'Standard User',
        roleColor: l.username === 'System' || l.username === 'system' ? '#8b949e' : '#58a6ff'
      };

      const human = humanizeAuditLog(l);
      const normalizedCategory = (l.action_type || l.category || 'GENERAL').toUpperCase();

      return {
        ...l,
        category: normalizedCategory,
        action_type: normalizedCategory,
        human_action: human.action,
        human_summary: human.summary,
        actor_role_name: uInfo.roleName,
        actor_role_color: uInfo.roleColor
      };
    });

    let filtered = enrichedLogs;

    if (user && user.trim() && user !== 'ALL') {
      const u = user.trim().toLowerCase();
      filtered = filtered.filter(l => (l.username || '').toLowerCase() === u || l.user_id === u);
    }

    if (actionType && actionType !== 'ALL') {
      const normCat = actionType.trim().toUpperCase();
      filtered = filtered.filter(l => (l.category || '').toUpperCase() === normCat || (l.action_type || '').toUpperCase() === normCat);
    }

    if (startDate) {
      filtered = filtered.filter(l => l.day_key_la >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(l => l.day_key_la <= endDate);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(l =>
        (l.human_action && l.human_action.toLowerCase().includes(q)) ||
        (l.human_summary && l.human_summary.toLowerCase().includes(q)) ||
        (l.username && l.username.toLowerCase().includes(q)) ||
        (l.actor_role_name && l.actor_role_name.toLowerCase().includes(q)) ||
        (l.category && l.category.toLowerCase().includes(q)) ||
        (l.action_name && l.action_name.toLowerCase().includes(q)) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q)
      );
    }

    // Group logs by day (calculated in America/Los_Angeles)
    const groupedMap = new Map();

    for (const log of filtered) {
      const dayKey = log.day_key_la || getDayKeyLA(log.timestamp);
      if (!groupedMap.has(dayKey)) {
        groupedMap.set(dayKey, {
          dayKey,
          dayLabel: formatDayLabelLA(log.timestamp),
          logs: []
        });
      }
      groupedMap.get(dayKey).logs.push(log);
    }

    // Sort days descending (most recent day first)
    const dayGroups = Array.from(groupedMap.values()).sort((a, b) => b.dayKey.localeCompare(a.dayKey));

    // Compile distinct user list for filter
    const distinctUsersMap = new Map();
    for (const u of allUsers) {
      const uInfo = userMap.get(u.username.toLowerCase());
      distinctUsersMap.set(u.username, {
        id: u.id,
        username: u.username,
        roleName: uInfo ? uInfo.roleName : 'Standard User',
        roleColor: uInfo ? uInfo.roleColor : '#8b949e'
      });
    }
    // Also include any other actors from logs like 'System'
    for (const log of enrichedLogs) {
      if (log.username && !distinctUsersMap.has(log.username)) {
        distinctUsersMap.set(log.username, {
          id: log.user_id || log.username,
          username: log.username,
          roleName: log.actor_role_name || 'User',
          roleColor: log.actor_role_color || '#8b949e'
        });
      }
    }

    return {
      totalCount: filtered.length,
      retentionDays: db.settings.get().retention_days || DEFAULT_LOG_RETENTION_DAYS,
      dayGroups,
      users: Array.from(distinctUsersMap.values()).sort((a, b) => a.username.localeCompare(b.username))
    };
  }

  getRetentionSetting() {
    return {
      retention_days: db.settings.get().retention_days || DEFAULT_LOG_RETENTION_DAYS
    };
  }

  updateRetentionSetting(days, actingUser, ipAddress) {
    const num = parseInt(days, 10);
    if (isNaN(num) || num < 1 || num > 365) {
      throw new Error('Retention days must be an integer between 1 and 365.');
    }

    db.settings.set('retention_days', num);

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'AUDIT',
      actionName: 'RETENTION_CONFIG_UPDATED',
      details: { newRetentionDays: num },
      ipAddress
    });

    return { retention_days: num };
  }

  purgeTodayLogs(actingUser, ipAddress) {
    const deletedCount = db.audit.purgeToday();

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'AUDIT',
      actionName: 'PURGE_TODAY_LOGS',
      details: { deletedCount },
      ipAddress
    });

    return { success: true, deletedCount };
  }

  purgeAllLogs(actingUser, ipAddress) {
    const deletedCount = db.audit.purgeAll();

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'AUDIT',
      actionName: 'PURGE_ALL_LOGS',
      details: { deletedCount },
      ipAddress
    });

    return { success: true, deletedCount };
  }

  runAutomatedRetentionPurge() {
    const retentionDays = db.settings.get().retention_days || DEFAULT_LOG_RETENTION_DAYS;
    const count = db.audit.purgeRetention(retentionDays);
    if (count > 0) {
      console.log(`[Retention Job] Auto-purged ${count} logs older than ${retentionDays} days.`);
    }
    return count;
  }
}

module.exports = new AuditService();
