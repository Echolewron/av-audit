const { db } = require('../db/database');

/**
 * Server-Side Dashboard Automation & HTTP Polling Service
 * Handles server-side triggers, sequence execution, variable evaluation,
 * real-time /info ingestion, and scheduled HTTP polling using a MacroDroid-style
 * multi-automation list architecture.
 */
class DashboardAutomationService {
  constructor() {
    this.io = null;
    this.activePollingTimers = new Map(); // key: `${dashboardId}:${widgetId}:${automationId}`, value: timerId
  }

  init(io) {
    this.io = io;
    this.refreshAll();
    console.log('[Dashboard Automation Engine] Initialized and active with multi-rule architecture.');
  }

  /**
   * Normalizes widget automations into a standardized Array of MacroDroid-style rules.
   * Handles seamless backward compatibility with legacy object configs.
   */
  normalizeAutomations(rawAutomations) {
    if (!rawAutomations) return [];
    if (Array.isArray(rawAutomations)) {
      return rawAutomations.map((a, idx) => ({
        id: a.id || `auto_${Date.now()}_${idx}`,
        name: a.name || `Automation #${idx + 1}`,
        enabled: a.enabled !== undefined ? Boolean(a.enabled) : true,
        trigger: (typeof a.trigger === 'object' && a.trigger !== null) ? {
          type: a.trigger.type || 'onTap',
          infoKey: a.trigger.infoKey || '',
          url: a.trigger.url || '',
          interval: parseFloat(a.trigger.interval || 1.0) || 1.0
        } : (typeof a.trigger === 'string' ? { type: a.trigger, infoKey: '', url: '', interval: 1.0 } : { type: 'onTap', infoKey: '', url: '', interval: 1.0 }),
        actions: Array.isArray(a.actions) ? a.actions : []
      }));
    }

    // Legacy object format migration
    const rules = [];
    let idx = 1;
    const legacy = typeof rawAutomations === 'object' ? rawAutomations : {};

    for (const [key, val] of Object.entries(legacy)) {
      if (key === 'onConditionFailed') continue; // onConditionFailed is removed
      if (key === 'onInfo') {
        const infoKey = (val && typeof val === 'object' && val.key) ? val.key : '';
        const actions = Array.isArray(val) ? val : (val && Array.isArray(val.actions) ? val.actions : []);
        rules.push({
          id: `auto_migrated_${idx++}`,
          name: infoKey ? `On /info: ${infoKey}` : 'On /info Ingestion',
          enabled: true,
          trigger: { type: 'onInfo', infoKey, url: '', interval: 1.0 },
          actions
        });
      } else if (key === 'onPolling') {
        const url = (val && typeof val === 'object' && val.url) ? val.url : '';
        const interval = parseFloat(val && val.interval) || 1.0;
        const actions = Array.isArray(val) ? val : (val && Array.isArray(val.actions) ? val.actions : []);
        rules.push({
          id: `auto_migrated_${idx++}`,
          name: url ? `Polling: ${url}` : 'HTTP Polling',
          enabled: true,
          trigger: { type: 'onPolling', url, interval },
          actions
        });
      } else if (Array.isArray(val)) {
        rules.push({
          id: `auto_migrated_${idx++}`,
          name: `On ${key}`,
          enabled: true,
          trigger: { type: key, infoKey: '', url: '', interval: 1.0 },
          actions: val
        });
      }
    }
    return rules;
  }

  normalizePayload(rawData) {
    if (!rawData || typeof rawData !== 'object') {
      return { data: rawData, value: rawData };
    }
    const dataContext = { ...rawData };
    if (rawData.record && typeof rawData.record === 'object') {
      Object.assign(dataContext, rawData.record);
      dataContext.record = rawData.record;
    }
    if (rawData.data && typeof rawData.data === 'object') {
      Object.assign(dataContext, rawData.data);
      dataContext.data = rawData.data;
    }
    return dataContext;
  }

  evalTemplateString(template, context = { widget: {}, data: {} }) {
    if (template === undefined || template === null) return '';
    if (typeof template !== 'string') return String(template);

    const widget = context.widget || {};
    const data = this.normalizePayload(context.data);

    let result = template.replace(/\$\{([^}]+)\}/g, (match, expr) => {
      try {
        const fn = new Function('widget', 'data', `"use strict"; return (${expr});`);
        const val = fn(widget, data);
        return val !== undefined && val !== null ? val : '';
      } catch (e) {
        return match;
      }
    });

    if (result.includes('+') || result.includes('?') || result.includes('data.') || result.includes('widget.')) {
      try {
        const fn = new Function('widget', 'data', `"use strict"; return (${result});`);
        const val = fn(widget, data);
        if (val !== undefined && val !== null) return String(val);
      } catch (e) { }
    }

    return result;
  }

  evalExpression(expr, context = { widget: {}, data: {} }, fallback = null) {
    if (expr === undefined || expr === null || expr === '') return fallback;
    if (typeof expr === 'number' || typeof expr === 'boolean') return expr;
    const widget = context.widget || {};
    const data = this.normalizePayload(context.data);

    try {
      if (typeof expr === 'string') {
        let cleanExpr = expr.trim();
        if (/^#[0-9A-Fa-f]{3,8}$/.test(cleanExpr) || /^rgba?\([^)]+\)$/.test(cleanExpr)) {
          return cleanExpr;
        }
        if (cleanExpr.startsWith('${') && cleanExpr.endsWith('}') && !cleanExpr.slice(2, -1).includes('${')) {
          cleanExpr = cleanExpr.slice(2, -1).trim();
        } else if (cleanExpr.includes('${')) {
          return this.evalTemplateString(cleanExpr, { widget, data });
        }

        const fn = new Function('widget', 'data', `"use strict"; return (${cleanExpr});`);
        const val = fn(widget, data);
        if (val !== undefined) return val;
      }
    } catch (e) {
      try {
        if (typeof expr === 'string' && expr.includes('${')) {
          return this.evalTemplateString(expr, { widget, data });
        }
      } catch (e2) {}
    }
    return fallback !== null ? fallback : expr;
  }

  findWidgetInDashboard(dashboard, widgetId) {
    if (!dashboard) return null;
    if (Array.isArray(dashboard.badges)) {
      const badge = dashboard.badges.find(b => b.id === widgetId);
      if (badge) return { widget: badge, isBadge: true, sectionId: null };
    }
    if (Array.isArray(dashboard.sections)) {
      for (const sec of dashboard.sections) {
        if (Array.isArray(sec.cards)) {
          const card = sec.cards.find(c => c.id === widgetId);
          if (card) return { widget: card, isBadge: false, sectionId: sec.id };
        }
      }
    }
    return null;
  }

  normalizeColorValue(val) {
    if (typeof val !== 'string') return val;
    val = val.trim();
    if (/^[0-9A-Fa-f]{3,8}$/.test(val)) {
      return '#' + val;
    }
    return val;
  }

  async executeSequence(dashboardId, widgetId, triggerName, payloadData = {}, options = {}) {
    const dashboard = db.dashboards.findById(dashboardId);
    if (!dashboard) return null;

    const found = this.findWidgetInDashboard(dashboard, widgetId);
    if (!found) return null;

    const { widget, isBadge, sectionId } = found;
    let hasChanged = false;

    // Apply interactive state/value updates from client if provided
    if (payloadData && typeof payloadData === 'object') {
      if (payloadData.state !== undefined && widget.state !== payloadData.state) {
        widget.state = payloadData.state;
        hasChanged = true;
      }
      if (payloadData.value !== undefined && widget.value !== payloadData.value) {
        widget.value = payloadData.value;
        hasChanged = true;
      }
      if (payloadData.display !== undefined && widget.display !== payloadData.display) {
        widget.display = payloadData.display;
        hasChanged = true;
      }
    }

    const automations = this.normalizeAutomations(widget.automations || widget.pipelines);

    // Filter matching rules
    const matchingRules = automations.filter(auto => {
      if (auto.enabled === false) return false;
      if (options.automationId && auto.id !== options.automationId) return false;
      if (auto.trigger && auto.trigger.type === triggerName) {
        if (triggerName === 'onInfo' && options.infoKey) {
          return auto.trigger.infoKey === options.infoKey;
        }
        return true;
      }
      return false;
    });

    const normalizedData = this.normalizePayload(payloadData);
    let localContext = {
      widget: { ...widget },
      data: normalizedData
    };

    for (const rule of matchingRules) {
      const actions = Array.isArray(rule.actions) ? rule.actions : [];

      for (let i = 0; i < actions.length; i++) {
        const step = actions[i];
        const actionType = step.type || step.action;

        if (actionType === 'delay') {
          const sec = parseFloat(step.seconds !== undefined ? step.seconds : (step.ms ? step.ms / 1000 : 1)) || 0.5;
          await new Promise(r => setTimeout(r, sec * 1000));
        } else if (actionType === 'set_property') {
          const prop = step.property || step.key;
          const rawVal = step.value;
          if (prop) {
            let evaluatedVal = this.evalExpression(rawVal, localContext);
            if (prop === 'color' || prop === 'accentColor') {
              evaluatedVal = this.normalizeColorValue(evaluatedVal);
            }
            widget[prop] = evaluatedVal;
            localContext.widget[prop] = evaluatedVal;
            hasChanged = true;

            // If graph card, append data
            if (prop === 'new_data' || (prop === 'value' && widget.type === 'graph')) {
              if (!Array.isArray(widget.data)) widget.data = [];
              const numVal = parseFloat(evaluatedVal);
              if (!isNaN(numVal)) {
                widget.data.push(numVal);
                const maxLen = Number(widget.graph_length) || 20;
                if (widget.data.length > maxLen) {
                  widget.data = widget.data.slice(-maxLen);
                }
              }
            }
          }
        } else if (actionType === 'webhook') {
          const evaluatedUrl = this.evalTemplateString(step.url || '', localContext);
          const evaluatedBody = this.evalTemplateString(step.body || step.payload || '', localContext);
          const method = (step.method || 'GET').toUpperCase();

          try {
            const fetchOptions = {
              method,
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(10000)
            };
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && evaluatedBody) {
              fetchOptions.body = evaluatedBody;
            }

            const res = await fetch(evaluatedUrl, fetchOptions);
            const text = await res.text();
            let parsed = null;
            try { parsed = JSON.parse(text); } catch (e) { parsed = text; }

            const webhookResData = this.normalizePayload(typeof parsed === 'object' ? parsed : { response: parsed });
            localContext.data = Object.assign({}, localContext.data, webhookResData);
          } catch (err) {
            console.error(`[Server Automation] Webhook failed for widget ${widgetId}:`, err.message);
          }
        } else if (actionType === 'condition') {
          const condExpr = step.expression || step.expr || 'true';
          const passes = Boolean(this.evalExpression(condExpr, localContext));
          if (!passes) {
            // Cleanly halt this automation sequence when condition fails
            break;
          }
        }
      }
    }

    if (hasChanged) {
      // Save canvas state
      db.dashboards.update(dashboard.id, {
        badges: dashboard.badges || [],
        sections: dashboard.sections || []
      });

      // Broadcast real-time update
      if (this.io) {
        this.io.emit('widget_updated', {
          dashboardId: dashboard.id,
          widgetId: widget.id,
          widget,
          isBadge,
          sectionId
        });
        this.io.emit('dashboard_canvas_updated', {
          dashboardId: dashboard.id,
          canvas: {
            badges: dashboard.badges || [],
            sections: dashboard.sections || []
          }
        });
      }
    }

    return widget;
  }

  async handleInfoIngestion(key, payload) {
    const allDashboards = db.dashboards.findAll();
    for (const dashboard of allDashboards) {
      const allWidgets = [];
      if (Array.isArray(dashboard.badges)) {
        dashboard.badges.forEach(b => allWidgets.push({ widget: b, isBadge: true }));
      }
      if (Array.isArray(dashboard.sections)) {
        dashboard.sections.forEach(sec => {
          (sec.cards || []).forEach(c => allWidgets.push({ widget: c, isBadge: false }));
        });
      }

      for (const { widget, isBadge } of allWidgets) {
        const automations = this.normalizeAutomations(widget.automations || widget.pipelines);
        const matchingInfoRules = automations.filter(a =>
          a.enabled !== false &&
          a.trigger &&
          a.trigger.type === 'onInfo' &&
          (a.trigger.infoKey === key || (!a.trigger.infoKey && widget.infoKey === key))
        );

        for (const rule of matchingInfoRules) {
          await this.executeSequence(dashboard.id, widget.id, 'onInfo', payload, {
            infoKey: key,
            automationId: rule.id
          });
        }
      }
    }
  }

  refreshDashboard(dashboardId) {
    // Clear existing timers for this dashboard
    for (const [key, timerId] of this.activePollingTimers.entries()) {
      if (key.startsWith(`${dashboardId}:`)) {
        clearInterval(timerId);
        this.activePollingTimers.delete(key);
      }
    }

    const dashboard = db.dashboards.findById(dashboardId);
    if (!dashboard) return;

    const allWidgets = [];
    if (Array.isArray(dashboard.badges)) {
      dashboard.badges.forEach(b => allWidgets.push({ widget: b, isBadge: true }));
    }
    if (Array.isArray(dashboard.sections)) {
      dashboard.sections.forEach(sec => {
        (sec.cards || []).forEach(c => allWidgets.push({ widget: c, isBadge: false }));
      });
    }

    allWidgets.forEach(({ widget, isBadge }) => {
      const automations = this.normalizeAutomations(widget.automations || widget.pipelines);
      const pollingRules = automations.filter(a => a.enabled !== false && a.trigger && a.trigger.type === 'onPolling');

      pollingRules.forEach(rule => {
        const pollingConfig = rule.trigger || {};
        if (pollingConfig.url || (Array.isArray(rule.actions) && rule.actions.length > 0)) {
          const intervalSec = Math.max(0.5, parseFloat(pollingConfig.interval || 1.0) || 1.0);
          const timerKey = `${dashboardId}:${widget.id}:${rule.id}`;

          const pollOnce = async () => {
            let payload = {};
            if (pollingConfig.url) {
              try {
                const res = await fetch(pollingConfig.url, { signal: AbortSignal.timeout(8000) });
                if (res.ok) {
                  const text = await res.text();
                  try { payload = JSON.parse(text); } catch (e) { payload = { response: text, data: text }; }
                }
              } catch (err) {
                console.warn(`[Server Polling] Failed fetching ${pollingConfig.url}:`, err.message);
              }
            }
            await this.executeSequence(dashboardId, widget.id, 'onPolling', payload, { automationId: rule.id });
          };

          // Initial poll immediately
          pollOnce();

          const timerId = setInterval(pollOnce, intervalSec * 1000);
          this.activePollingTimers.set(timerKey, timerId);
        }
      });
    });
  }

  refreshAll() {
    this.stopAll();
    const allDashboards = db.dashboards.findAll();
    allDashboards.forEach(d => this.refreshDashboard(d.id));
  }

  stopAll() {
    for (const timerId of this.activePollingTimers.values()) {
      clearInterval(timerId);
    }
    this.activePollingTimers.clear();
  }
}

const dashboardAutomationService = new DashboardAutomationService();
module.exports = dashboardAutomationService;
