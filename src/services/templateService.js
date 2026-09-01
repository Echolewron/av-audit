const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');

// Recursively clean and assign IDs to items, sections, and their children
function normalizeItems(items, parentOptional = false, regenerateIds = false) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const isSection = item.type === 'section';
    const isSelfOptional = Boolean(item.is_optional || item.optional);
    const isOptional = parentOptional || isSelfOptional;
    const hasAuto = Boolean(item.has_automation && item.automation && item.automation.url);
    const days = Array.isArray(item.days) ? item.days.filter(d => typeof d === 'string' || typeof d === 'number') : [];

    if (isSection) {
      return {
        id: (regenerateIds || !item.id) ? `sec_${uuidv4()}` : item.id,
        type: 'section',
        title: (item.title || 'Untitled Section').trim(),
        color: item.color || '#58a6ff',
        is_optional: isSelfOptional,
        days,
        order: typeof item.order === 'number' ? item.order : index + 1,
        items: normalizeItems(item.items || item.children || [], isOptional, regenerateIds)
      };
    }

    return {
      id: (regenerateIds || !item.id) ? `item_${uuidv4()}` : item.id,
      type: 'task',
      title: (item.title || 'Untitled Task').trim(),
      description: (item.description || '').trim(),
      order: typeof item.order === 'number' ? item.order : index + 1,
      is_optional: isOptional,
      days,
      has_automation: hasAuto,
      automation: hasAuto ? {
        method: (item.automation.method || 'GET').toUpperCase(),
        url: item.automation.url.trim(),
        headers: typeof item.automation.headers === 'string' ? item.automation.headers : JSON.stringify(item.automation.headers || {}),
        body: item.automation.body || ''
      } : null,
      children: normalizeItems(item.children || [], isOptional, regenerateIds)
    };
  });
}

class TemplateService {
  getAllTemplates() {
    return db.templates.findAll();
  }

  getTemplateById(id) {
    return db.templates.findById(id);
  }

  createTemplate({ title, description, items, submission_automation, schedules }, actingUser, ipAddress) {
    if (!title || !title.trim()) {
      throw new Error('Template title is required.');
    }

    const normalized = normalizeItems(items || [], false, true);

    let subAuto = null;
    if (submission_automation && submission_automation.url && submission_automation.url.trim()) {
      subAuto = {
        enabled: Boolean(submission_automation.enabled !== false),
        method: (submission_automation.method || 'POST').toUpperCase(),
        url: submission_automation.url.trim(),
        headers: typeof submission_automation.headers === 'string' ? submission_automation.headers : JSON.stringify(submission_automation.headers || {}),
        body: submission_automation.body || ''
      };
    }

    const cleanSchedules = Array.isArray(schedules) ? schedules.filter(s => s && Array.isArray(s.days) && s.days.length > 0 && s.time) : [];

    const newTemplate = db.templates.create({
      title: title.trim(),
      description: (description || '').trim(),
      items: normalized,
      submission_automation: subAuto,
      schedules: cleanSchedules,
      created_by: actingUser.username
    });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'TEMPLATE',
      actionName: 'TEMPLATE_CREATED',
      details: { templateId: newTemplate.id, title: newTemplate.title, itemCount: normalized.length, hasSubmissionAutomation: Boolean(subAuto) },
      ipAddress
    });

    return newTemplate;
  }

  updateTemplate(id, { title, description, items, submission_automation, schedules }, actingUser, ipAddress) {
    const template = db.templates.findById(id);
    if (!template) throw new Error('Template not found.');

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = (description || '').trim();
    if (items !== undefined) updates.items = normalizeItems(items);
    if (schedules !== undefined) {
      updates.schedules = Array.isArray(schedules) ? schedules.filter(s => s && Array.isArray(s.days) && s.days.length > 0 && s.time) : [];
    }
    if (submission_automation !== undefined) {
      if (submission_automation && submission_automation.url && submission_automation.url.trim()) {
        updates.submission_automation = {
          enabled: Boolean(submission_automation.enabled !== false),
          method: (submission_automation.method || 'POST').toUpperCase(),
          url: submission_automation.url.trim(),
          headers: typeof submission_automation.headers === 'string' ? submission_automation.headers : JSON.stringify(submission_automation.headers || {}),
          body: submission_automation.body || ''
        };
      } else {
        updates.submission_automation = null;
      }
    }

    const updated = db.templates.update(id, updates);

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'TEMPLATE',
      actionName: 'TEMPLATE_UPDATED',
      details: { templateId: id, title: updated.title },
      ipAddress
    });

    return updated;
  }

  deleteTemplate(id, actingUser, ipAddress) {
    const template = db.templates.findById(id);
    if (!template) throw new Error('Template not found.');

    db.templates.delete(id);

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'TEMPLATE',
      actionName: 'TEMPLATE_DELETED',
      details: { templateId: id, title: template.title },
      ipAddress
    });

    return { success: true };
  }

  deleteAllTemplates(actingUser, ipAddress = '127.0.0.1') {
    const count = db.templates.deleteAll();

    if (count === 0) {
      return { success: true, count: 0, message: 'No templates to delete' };
    }

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'TEMPLATE',
      actionName: 'ALL_TEMPLATES_DELETED',
      details: { count },
      ipAddress
    });

    return { success: true, count, message: `Successfully deleted all ${count} templates` };
  }

  duplicateTemplate(id, actingUser, ipAddress) {
    const template = db.templates.findById(id);
    if (!template) throw new Error('Template not found.');

    const newTitle = `${template.title} (Copy)`;
    return this.createTemplate({
      title: newTitle,
      description: template.description,
      items: template.items,
      submission_automation: template.submission_automation,
      schedules: template.schedules
    }, actingUser, ipAddress);
  }

  // In-line sync: update the template items based on modified active checklist items
  syncTemplateFromChecklist(templateId, items, actingUser, ipAddress) {
    const template = db.templates.findById(templateId);
    if (!template) return null;

    // Convert checklist execution items into template structure (stripping runtime check state while preserving hierarchy and automation)
    function stripRuntimeState(chItems) {
      if (!Array.isArray(chItems)) return [];
      return chItems.map((item, idx) => ({
        id: item.id || `item_${uuidv4()}`,
        title: item.title,
        description: item.description || '',
        days: Array.isArray(item.days) ? item.days : [],
        order: typeof item.order === 'number' ? item.order : idx + 1,
        has_automation: Boolean(item.has_automation),
        automation: item.has_automation && item.automation ? {
          method: item.automation.method || 'GET',
          url: item.automation.url,
          headers: item.automation.headers || '',
          body: item.automation.body || ''
        } : null,
        children: stripRuntimeState(item.children || [])
      }));
    }

    const stripped = stripRuntimeState(items);
    const updated = db.templates.update(templateId, { items: stripped });

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'TEMPLATE',
      actionName: 'TEMPLATE_INLINE_SYNCED',
      details: { templateId, title: template.title },
      ipAddress
    });

    return updated;
  }
}

module.exports = new TemplateService();
