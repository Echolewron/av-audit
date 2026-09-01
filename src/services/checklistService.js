const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
const { formatTimeLA, formatSubmissionTimeLA, getDayOfWeekLA } = require('../utils/timezone');
const { CHECKLIST_SUBMISSION_PURGE_HOURS } = require('../config/config');
const templateService = require('./templateService');

// Check if a template item is visible/active on a given day of the week
function isItemActiveOnDay(item, currentDay) {
  if (!item || !Array.isArray(item.days) || item.days.length === 0) {
    return true; // No day filter configured -> visible on every day
  }
  if (!currentDay) return true;

  const dayCode = currentDay.code.toLowerCase(); // e.g. 'mon', 'fri'
  const dayIndex = currentDay.index; // 0..6

  return item.days.some(d => {
    if (typeof d === 'string') {
      const normalized = d.trim().toLowerCase();
      return normalized.startsWith(dayCode.slice(0, 3));
    }
    if (typeof d === 'number') {
      return d === dayIndex;
    }
    return false;
  });
}

// Recursively instantiate checklist items from template snapshot, filtering by day dependencies
function instantiateItems(tmplItems, parentOptional = false, currentDay = null) {
  if (!Array.isArray(tmplItems)) return [];
  const instantiated = [];

  for (const item of tmplItems) {
    // If this item is day-restricted and not active today, omit it and all its children
    if (!isItemActiveOnDay(item, currentDay)) {
      continue;
    }

    const isSection = item.type === 'section';
    const isSelfOptional = Boolean(item.is_optional || item.optional);
    const isOptional = parentOptional || isSelfOptional;

    if (isSection) {
      const subItems = instantiateItems(item.items || item.children || [], isOptional, currentDay);
      instantiated.push({
        id: item.id || `sec_${uuidv4()}`,
        type: 'section',
        title: item.title || 'Untitled Section',
        color: item.color || '#58a6ff',
        is_optional: isSelfOptional,
        order: item.order || 1,
        items: subItems
      });
    } else {
      const subTasks = instantiateItems(item.children || [], isOptional, currentDay);
      instantiated.push({
        id: item.id || `item_${uuidv4()}`,
        type: 'task',
        title: item.title,
        description: item.description || '',
        order: item.order || 1,
        is_optional: isOptional,
        checked: false,
        checked_by: null,
        checked_by_role: null,
        checked_by_color: null,
        checked_at: null,
        checked_at_la: null,
        has_issue: false,
        issue_note: '',
        has_automation: Boolean(item.has_automation),
        automation: item.automation || null,
        children: subTasks
      });
    }
  }

  return instantiated;
}

// Calculate progress percentage and blocked count recursively (optional tasks do not count towards progress)
function calculateChecklistStats(items) {
  let requiredLeaves = 0;
  let checkedRequiredLeaves = 0;
  let allLeaves = 0;
  let checkedAllLeaves = 0;
  let hasBlocked = false;

  function traverse(nodes, parentOptional = false) {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      const isSection = node.type === 'section';
      const isSelfOptional = Boolean(node.is_optional || node.optional);
      const isOptional = parentOptional || isSelfOptional;

      if (node.has_issue) {
        hasBlocked = true;
      }

      if (isSection) {
        const secChildren = node.items || node.children || [];
        if (secChildren.length > 0) {
          traverse(secChildren, isOptional);
        }
      } else {
        if (node.children && node.children.length > 0) {
          traverse(node.children, isOptional);
          // Parent node is checked if all children are checked
          node.checked = node.children.every(c => c.checked);
        } else {
          allLeaves++;
          if (node.checked) {
            checkedAllLeaves++;
          }
          if (!isOptional) {
            requiredLeaves++;
            if (node.checked) {
              checkedRequiredLeaves++;
            }
          }
        }
      }
    }
  }

  traverse(items);

  let progress = 0;
  if (requiredLeaves > 0) {
    progress = Math.round((checkedRequiredLeaves / requiredLeaves) * 100);
  } else if (allLeaves > 0) {
    progress = Math.round((checkedAllLeaves / allLeaves) * 100);
  }

  return {
    totalLeaves: requiredLeaves > 0 ? requiredLeaves : allLeaves,
    checkedLeaves: requiredLeaves > 0 ? checkedRequiredLeaves : checkedAllLeaves,
    progress,
    hasBlocked
  };
}

class ChecklistService {
  getAllChecklists() {
    // Run lazy purge check for 24h expired
    db.checklists.purgeSubmittedExpired();
    
    const all = db.checklists.findAll();
    const allTemplates = db.templates.findAll();
    const tmplMap = new Map(allTemplates.map(t => [t.id, t]));

    // Sort: IN_PROGRESS first (by created_at asc/desc), then SUBMITTED at the end (by submitted_at asc)
    return all.map(chk => {
      const tmpl = tmplMap.get(chk.template_id);
      const stats = calculateChecklistStats(chk.items);
      return Object.assign({}, chk, {
        template_title: tmpl ? tmpl.title : 'Custom Template',
        progress: chk.status === 'SUBMITTED' ? 100 : stats.progress,
        has_blocked: stats.hasBlocked
      });
    }).sort((a, b) => {
      if (a.status === 'IN_PROGRESS' && b.status === 'SUBMITTED') return -1;
      if (a.status === 'SUBMITTED' && b.status === 'IN_PROGRESS') return 1;
      if (a.status === 'SUBMITTED' && b.status === 'SUBMITTED') {
        return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  getChecklistById(id) {
    const chk = db.checklists.findById(id);
    if (!chk) return null;

    const tmpl = db.templates.findById(chk.template_id);
    const stats = calculateChecklistStats(chk.items);

    return Object.assign({}, chk, {
      template_title: tmpl ? tmpl.title : 'Custom Template',
      progress: chk.status === 'SUBMITTED' ? 100 : stats.progress,
      has_blocked: stats.hasBlocked
    });
  }

  createChecklistFromTemplate({ template_id, custom_title, target_date }, actingUser, ipAddress) {
    const template = db.templates.findById(template_id);
    if (!template) throw new Error('Template not found.');

    const currentDay = getDayOfWeekLA(target_date || new Date());
    const title = (custom_title && custom_title.trim()) ? custom_title.trim() : template.title;
    const itemsSnapshot = instantiateItems(template.items, false, currentDay);
    const stats = calculateChecklistStats(itemsSnapshot);

    const newChecklist = db.checklists.create({
      template_id: template.id,
      title,
      items: itemsSnapshot,
      submission_automation: template.submission_automation || null,
      status: 'IN_PROGRESS',
      progress: stats.progress,
      created_by: actingUser.username,
      submitted_at: null,
      submitted_at_la: null,
      purge_at: null
    });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'CHECKLIST',
      actionName: 'CHECKLIST_CREATED',
      details: { checklistId: newChecklist.id, title: newChecklist.title, templateId: template.id },
      ipAddress
    });

    return this.getChecklistById(newChecklist.id);
  }

  toggleItemCheck(checklistId, itemId, checked, actingUser, ipAddress) {
    const chk = db.checklists.findById(checklistId);
    if (!chk) throw new Error('Checklist not found.');

    let targetItem = null;

    function findAndToggle(nodes) {
      if (!Array.isArray(nodes)) return false;
      for (const node of nodes) {
        if (node.id === itemId) {
          targetItem = node;
          node.checked = Boolean(checked);
          const userRoleName = (actingUser.roles && actingUser.roles[0] && actingUser.roles[0].name) || (actingUser.isAdmin ? 'Administrator' : 'User');
          const userRoleColor = (actingUser.roles && actingUser.roles[0] && actingUser.roles[0].color_hex) || (actingUser.isAdmin ? '#a371f7' : '#58a6ff');
          if (node.checked) {
            const now = new Date();
            node.checked_by = actingUser.username;
            node.checked_by_role = userRoleName;
            node.checked_by_color = userRoleColor;
            node.checked_at = now.toISOString();
            node.checked_at_la = formatTimeLA(now);
          } else {
            node.checked_by = null;
            node.checked_by_role = null;
            node.checked_by_color = null;
            node.checked_at = null;
            node.checked_at_la = null;
          }
          // If parent with children is checked, toggle all descendants
          const subNodes = node.items || node.children;
          if (subNodes && subNodes.length > 0) {
            setAllDescendants(subNodes, node.checked, actingUser.username, userRoleName, userRoleColor);
          }
          return true;
        }
        const subNodes = node.items || node.children;
        if (subNodes && subNodes.length > 0) {
          if (findAndToggle(subNodes)) {
            return true;
          }
        }
      }
      return false;
    }

    function setAllDescendants(nodes, isChecked, username, roleName, roleColor) {
      if (!Array.isArray(nodes)) return;
      const now = new Date();
      for (const node of nodes) {
        node.checked = isChecked;
        if (isChecked) {
          node.checked_by = username;
          node.checked_by_role = roleName;
          node.checked_by_color = roleColor;
          node.checked_at = now.toISOString();
          node.checked_at_la = formatTimeLA(now);
        } else {
          node.checked_by = null;
          node.checked_by_role = null;
          node.checked_by_color = null;
          node.checked_at = null;
          node.checked_at_la = null;
        }
        const subNodes = node.items || node.children;
        if (subNodes) {
          setAllDescendants(subNodes, isChecked, username, roleName, roleColor);
        }
      }
    }

    findAndToggle(chk.items);

    if (!targetItem) {
      throw new Error('Checklist item not found.');
    }

    const stats = calculateChecklistStats(chk.items);
    chk.progress = stats.progress;

    db.checklists.update(chk.id, {
      items: chk.items,
      progress: chk.progress
    });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'CHECKLIST',
      actionName: targetItem.checked ? 'ITEM_CHECKED' : 'ITEM_UNCHECKED',
      details: { checklistId: chk.id, itemId: targetItem.id, itemTitle: targetItem.title, checked: targetItem.checked },
      ipAddress
    });

    // Automatically submit checklist when 100% completed
    if (chk.progress === 100 && chk.status !== 'SUBMITTED') {
      return this.submitChecklist(chk.id, actingUser, ipAddress);
    } else if (chk.progress < 100 && chk.status === 'SUBMITTED') {
      return this.unsubmitChecklist(chk.id, actingUser, ipAddress);
    }

    return this.getChecklistById(chk.id);
  }

  updateItemNotes(checklistId, itemId, { has_issue, issue_note }, actingUser, ipAddress) {
    const chk = db.checklists.findById(checklistId);
    if (!chk) throw new Error('Checklist not found.');

    let targetItem = null;

    function findAndUpdate(nodes) {
      if (!Array.isArray(nodes)) return false;
      for (const node of nodes) {
        if (node.id === itemId) {
          targetItem = node;
          if (has_issue !== undefined) node.has_issue = Boolean(has_issue);
          if (issue_note !== undefined) node.issue_note = issue_note;
          return true;
        }
        const subNodes = node.items || node.children;
        if (subNodes && findAndUpdate(subNodes)) {
          return true;
        }
      }
      return false;
    }

    findAndUpdate(chk.items);

    if (!targetItem) {
      throw new Error('Checklist item not found.');
    }

    const stats = calculateChecklistStats(chk.items);

    db.checklists.update(chk.id, {
      items: chk.items,
      progress: stats.progress
    });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'CHECKLIST',
      actionName: 'ITEM_NOTE_UPDATED',
      details: { checklistId: chk.id, itemId: targetItem.id, has_issue: targetItem.has_issue, issue_note: targetItem.issue_note },
      ipAddress
    });

    return this.getChecklistById(chk.id);
  }

  // In-line modification of checklist structure (add/delete/reorder items)
  updateChecklistStructure(checklistId, newItems, actingUser, ipAddress) {
    const chk = db.checklists.findById(checklistId);
    if (!chk) throw new Error('Checklist not found.');

    const stats = calculateChecklistStats(newItems);

    const updated = db.checklists.update(chk.id, {
      items: newItems,
      progress: stats.progress
    });

    // In-Line Template Modification check:
    // If user has template editing permissions, auto-sync back to template
    const userHasTemplateEdit = actingUser.isAdmin || (actingUser.permissions && actingUser.permissions.includes('checklists.edit_templates'));
    if (userHasTemplateEdit && chk.template_id) {
      templateService.syncTemplateFromChecklist(chk.template_id, newItems, actingUser, ipAddress);
    }

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'CHECKLIST',
      actionName: 'CHECKLIST_STRUCTURE_MODIFIED',
      details: { checklistId: chk.id, syncedToTemplate: userHasTemplateEdit },
      ipAddress
    });

    return this.getChecklistById(chk.id);
  }

  submitChecklist(checklistId, actingUser, ipAddress) {
    const chk = db.checklists.findById(checklistId);
    if (!chk) throw new Error('Checklist not found.');

    const now = new Date();
    const purgeTime = new Date(now.getTime() + (CHECKLIST_SUBMISSION_PURGE_HOURS * 60 * 60 * 1000));

    const submitted = db.checklists.update(chk.id, {
      status: 'SUBMITTED',
      progress: 100,
      submitted_at: now.toISOString(),
      submitted_at_la: formatSubmissionTimeLA(now),
      purge_at: purgeTime.toISOString()
    });

    // Auto-execute submission automation webhook if configured
    if (chk.submission_automation && chk.submission_automation.url) {
      try {
        const autoService = require('./automationService');
        autoService.executeAutomation({
          method: chk.submission_automation.method || 'POST',
          url: chk.submission_automation.url,
          headers: chk.submission_automation.headers,
          body: chk.submission_automation.body || JSON.stringify({
            event: 'CHECKLIST_SUBMITTED',
            checklistId: chk.id,
            title: chk.title,
            submittedBy: actingUser.username,
            submittedAt: submitted.submitted_at_la
          }),
          checklistId: chk.id,
          itemId: 'submission_hook',
          itemTitle: `On-Submission Webhook: ${chk.title}`
        }, actingUser, ipAddress).catch(e => console.error('[Submission Hook Error]', e.message));
      } catch (err) {
        console.error('[Submission Hook Exception]', err);
      }
    }

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'CHECKLIST',
      actionName: 'CHECKLIST_SUBMITTED',
      details: { checklistId: chk.id, title: chk.title, submitted_at_la: submitted.submitted_at_la, triggeredAutomation: Boolean(chk.submission_automation) },
      ipAddress
    });

    return this.getChecklistById(chk.id);
  }

  unsubmitChecklist(checklistId, actingUser, ipAddress) {
    const chk = db.checklists.findById(checklistId);
    if (!chk) throw new Error('Checklist not found.');

    const stats = calculateChecklistStats(chk.items);

    const unsubmitted = db.checklists.update(chk.id, {
      status: 'IN_PROGRESS',
      progress: stats.progress,
      submitted_at: null,
      submitted_at_la: null,
      purge_at: null
    });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'CHECKLIST',
      actionName: 'CHECKLIST_UNSUBMITTED',
      details: { checklistId: chk.id, title: chk.title, restoredProgress: stats.progress },
      ipAddress
    });

    return this.getChecklistById(chk.id);
  }

  deleteChecklist(checklistId, actingUser, ipAddress) {
    const chk = db.checklists.findById(checklistId);
    if (!chk) throw new Error('Checklist not found.');

    db.checklists.delete(checklistId);

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'CHECKLIST',
      actionName: 'CHECKLIST_DELETED',
      details: { checklistId, title: chk.title },
      ipAddress
    });

    return { success: true };
  }

  deleteAllChecklists(actingUser, ipAddress = '127.0.0.1') {
    const count = db.checklists.deleteAll();

    if (count === 0) {
      return { success: true, count: 0, message: 'No active checklists to delete' };
    }

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'CHECKLIST',
      actionName: 'ALL_CHECKLISTS_DELETED',
      details: { count },
      ipAddress
    });

    return { success: true, count, message: `Successfully deleted all ${count} active checklists` };
  }

  getPublicChecklistById(id) {
    const chk = this.getChecklistById(id);
    if (!chk) return null;

    // Sanitize automation details to prevent exposing internal webhook target URLs/headers to public read-only viewers
    function sanitizeItems(items) {
      if (!Array.isArray(items)) return [];
      return items.map(item => {
        const isSection = item.type === 'section';
        if (isSection) {
          return {
            id: item.id,
            type: 'section',
            title: item.title,
            color: item.color,
            is_optional: item.is_optional,
            order: item.order,
            items: sanitizeItems(item.items || item.children || [])
          };
        }
        return {
          id: item.id,
          type: 'task',
          title: item.title,
          description: item.description,
          order: item.order,
          is_optional: item.is_optional,
          checked: item.checked,
          checked_by: item.checked_by,
          checked_by_role: item.checked_by_role,
          checked_by_color: item.checked_by_color,
          checked_at: item.checked_at,
          checked_at_la: item.checked_at_la,
          has_issue: item.has_issue,
          issue_note: item.issue_note,
          has_automation: Boolean(item.has_automation),
          automation: item.has_automation ? { method: (item.automation && item.automation.method) || 'GET' } : null,
          children: sanitizeItems(item.children || [])
        };
      });
    }

    return {
      id: chk.id,
      title: chk.title,
      template_id: chk.template_id,
      template_title: chk.template_title,
      status: chk.status,
      progress: chk.progress,
      has_blocked: chk.has_blocked,
      created_by: chk.created_by,
      created_at: chk.created_at,
      created_at_la: chk.created_at_la,
      submitted_at: chk.submitted_at,
      submitted_at_la: chk.submitted_at_la,
      items: sanitizeItems(chk.items),
      is_public_read_only: true
    };
  }

  generatePreviewSvg(chk) {
    const escapeXml = (unsafe) => {
      return String(unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const isSubmitted = chk.status === 'SUBMITTED';
    
    // Scan task tree for blocked issues
    let blockedCount = 0;
    let firstBlockedTitle = '';
    function findBlockedItems(nodes) {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node.has_issue) {
          blockedCount++;
          if (!firstBlockedTitle) firstBlockedTitle = node.title || 'Blocked Task';
        }
        if (node.items) findBlockedItems(node.items);
        if (node.children) findBlockedItems(node.children);
      }
    }
    findBlockedItems(chk.items);

    const hasBlocked = Boolean((chk.has_blocked || blockedCount > 0) && !isSubmitted);
    const progress = isSubmitted ? 100 : (chk.progress || 0);

    // Accent color: Green normally, Red if blocked items exist, Blue if submitted
    const accentColor = hasBlocked ? '#f85149' : (isSubmitted ? '#58a6ff' : '#18edb3');
    const isCompleted = (progress === 100 && !hasBlocked);

    let badgeText = 'IN-PROGRESS';
    let badgeBg = 'rgba(24, 237, 179, 0.15)';
    let badgeBorder = '#18edb3';
    let badgeColor = '#18edb3';
    let badgeWidth = 160;

    if (hasBlocked) {
      badgeText = blockedCount > 1 ? `! ${blockedCount} ISSUES REPORTED` : `! ISSUE REPORTED`;
      badgeBg = 'rgba(248, 81, 73, 0.2)';
      badgeBorder = '#f85149';
      badgeColor = '#f85149';
      badgeWidth = 230;
    } else if (isSubmitted) {
      badgeText = '✓ SUBMITTED';
      badgeBg = 'rgba(88, 166, 255, 0.2)';
      badgeBorder = '#58a6ff';
      badgeColor = '#58a6ff';
      badgeWidth = 160;
    } else if (isCompleted) {
      badgeText = '✓ 100% COMPLETE';
      badgeBg = 'rgba(24, 237, 179, 0.2)';
      badgeBorder = '#18edb3';
      badgeColor = '#18edb3';
      badgeWidth = 180;
    }

    let progressLabelText = 'Checklist Progress';
    let progressLabelColor = '#8b949e';

    if (hasBlocked) {
      progressLabelText = blockedCount > 1 ? `Blocked Items Reported (${blockedCount} Issues)` : `Blocked Items Reported`;
      progressLabelColor = '#f85149';
    } else if (isCompleted) {
      progressLabelText = 'All Items Completed';
      progressLabelColor = '#18edb3';
    } else if (isSubmitted) {
      progressLabelText = 'Submitted Checklist';
      progressLabelColor = '#58a6ff';
    }

    // Wrap long titles across multiple lines
    const rawTitle = String(chk.title || 'Checklist').trim();
    const words = rawTitle.split(/\s+/);
    const lines = [];
    let currentLine = '';
    const maxChars = 28;

    for (const word of words) {
      if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    if (lines.length === 0) lines.push('Checklist');

    let textElements = '';
    if (lines.length === 1) {
      textElements = `<text x="80" y="275" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="58" letter-spacing="-0.5">${escapeXml(lines[0])}</text>`;
    } else if (lines.length === 2) {
      textElements = `<text fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="50" letter-spacing="-0.5">
      <tspan x="80" y="235">${escapeXml(lines[0])}</tspan>
      <tspan x="80" y="305">${escapeXml(lines[1])}</tspan>
    </text>`;
    } else {
      const l1 = lines[0];
      const l2 = lines[1];
      const l3 = lines.slice(2).join(' ');
      textElements = `<text fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="44" letter-spacing="-0.5">
      <tspan x="80" y="200">${escapeXml(l1)}</tspan>
      <tspan x="80" y="260">${escapeXml(l2)}</tspan>
      <tspan x="80" y="320">${escapeXml(l3.length > 34 ? l3.substring(0, 32) + '...' : l3)}</tspan>
    </text>`;
    }

    const progressFillWidth = Math.max(28, Math.round((progress / 100) * 1040));

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${accentColor}"/>
    </linearGradient>
    <linearGradient id="logoGrad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#18edb3"/>
      <stop offset="100%" stop-color="#0d8363"/>
    </linearGradient>
  </defs>

  <!-- Plain Card Dark Background -->
  <rect width="1200" height="630" fill="#0d1117"/>

  <!-- 1. AV Audit Logo & Header -->
  <g transform="translate(80, 75)">
    <rect width="56" height="56" rx="14" fill="url(#logoGrad)"/>
    <text x="28" y="37" fill="#04100c" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="24" text-anchor="middle" letter-spacing="-0.5">AV</text>
    <text x="78" y="39" fill="#f0f6fc" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="30" letter-spacing="1.5">AV AUDIT CHECKLIST</text>
  </g>

  <!-- Status Pill Badge (Top-Right) -->
  <g transform="translate(${1120 - badgeWidth}, 82)">
    <rect width="${badgeWidth}" height="42" rx="21" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1.8"/>
    <text x="${badgeWidth / 2}" y="27" fill="${badgeColor}" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="16" text-anchor="middle" letter-spacing="1">${escapeXml(badgeText)}</text>
  </g>

  <!-- 2. Checklist Name (Wrapped & Adaptable) -->
  ${textElements}

  <!-- 3. Linear Progress Bar & Percentage -->
  <g transform="translate(80, 440)">
    <!-- Percentage Label -->
    <text x="0" y="5" fill="${progressLabelColor}" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="34" letter-spacing="-0.2">${progressLabelText}</text>
    <text x="1040" y="10" fill="${accentColor}" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="54" text-anchor="end">${progress}%</text>

    <!-- Linear Progress Bar -->
    <rect x="0" y="35" width="1040" height="28" rx="14" fill="#21262d"/>
    <rect x="0" y="35" width="${progressFillWidth}" height="28" rx="14" fill="url(#barGrad)"/>
  </g>
</svg>`;
  }

  generatePreviewPng(chk) {
    const { Resvg } = require('@resvg/resvg-js');
    const svg = this.generatePreviewSvg(chk);
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 }
    });
    return resvg.render().asPng();
  }
}

module.exports = new ChecklistService();
