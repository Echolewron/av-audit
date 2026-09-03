const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { resolveUrl } = require('../config/config');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const dashboardAutomationService = require('../services/dashboardAutomationService');

router.use(authMiddleware);

// GET /api/dashboards - List all dashboards authorized for the current user
router.get('/', (req, res) => {
  try {
    const dashboards = db.dashboards.findForUser(req.user);
    res.json({ dashboards });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_DASHBOARDS_FAILED', message: err.message });
  }
});

// GET /api/dashboards/:id - Get a single dashboard if authorized
router.get('/:id', (req, res) => {
  try {
    const dashboard = db.dashboards.findById(req.params.id);
    if (!dashboard) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Dashboard not found' });
    }

    // Check authorization
    const authorizedDashboards = db.dashboards.findForUser(req.user);
    const isAuthorized = authorizedDashboards.some(d => d.id === dashboard.id);
    if (!isAuthorized && !req.user.isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this dashboard.' });
    }

    res.json({ dashboard });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_DASHBOARD_FAILED', message: err.message });
  }
});

// POST /api/dashboards - Create a new dashboard
router.post('/', requirePermission('dashboards', 'manage_dashboards'), (req, res) => {
  try {
    const { name, description, color_code, allowed_roles } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dashboard name is required.' });
    }

    const created = db.dashboards.create({
      name: name.trim(),
      description: (description || '').trim(),
      color_code: color_code || '#58a6ff',
      allowed_roles: Array.isArray(allowed_roles) && allowed_roles.length > 0 ? allowed_roles : ['*'],
      created_by: req.user.id
    });

    const ipAddress = req.ip || req.connection.remoteAddress;
    db.audit.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'DASHBOARD',
      actionName: 'CREATE_DASHBOARD',
      details: { dashboardId: created.id, name: created.name, description: created.description, color_code: created.color_code },
      ipAddress
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('dashboards_updated', { action: 'create', dashboard: created });
    }

    res.status(201).json({ success: true, dashboard: created });
  } catch (err) {
    res.status(400).json({ error: 'CREATE_DASHBOARD_FAILED', message: err.message });
  }
});

// PUT /api/dashboards/:id - Update dashboard settings (rename, description, color, allowed roles)
router.put('/:id', requirePermission('dashboards', 'manage_dashboards'), (req, res) => {
  try {
    const existing = db.dashboards.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Dashboard not found' });
    }

    const { name, description, color_code, allowed_roles } = req.body;
    const updates = {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dashboard name cannot be empty.' });
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = description ? description.trim() : '';
    }
    if (color_code !== undefined) updates.color_code = color_code;
    if (allowed_roles !== undefined) {
      updates.allowed_roles = Array.isArray(allowed_roles) && allowed_roles.length > 0 ? allowed_roles : ['*'];
    }

    const updated = db.dashboards.update(req.params.id, updates);

    const ipAddress = req.ip || req.connection.remoteAddress;
    db.audit.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'DASHBOARD',
      actionName: 'UPDATE_DASHBOARD',
      details: { dashboardId: updated.id, name: updated.name, color_code: updated.color_code, allowed_roles: updated.allowed_roles },
      ipAddress
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('dashboards_updated', { action: 'update', dashboard: updated });
    }

    res.json({ success: true, dashboard: updated });
  } catch (err) {
    res.status(400).json({ error: 'UPDATE_DASHBOARD_FAILED', message: err.message });
  }
});

// PUT /api/dashboards/:id/canvas - Update dashboard badges, sections, and layout
router.put('/:id/canvas', requirePermission('dashboards', 'manage_dashboards'), (req, res) => {
  try {
    const existing = db.dashboards.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Dashboard not found' });
    }

    const { badges, sections, widgets } = req.body;
    const updates = {};
    if (badges !== undefined) updates.badges = Array.isArray(badges) ? badges : [];
    if (sections !== undefined) updates.sections = Array.isArray(sections) ? sections : [];
    if (widgets !== undefined) updates.widgets = Array.isArray(widgets) ? widgets : [];

    const updated = db.dashboards.update(req.params.id, updates);

    // Refresh server-side background polling jobs for this dashboard
    dashboardAutomationService.refreshDashboard(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('dashboard_canvas_updated', { dashboardId: req.params.id, dashboard: updated });
    }

    res.json({ success: true, dashboard: updated });
  } catch (err) {
    res.status(400).json({ error: 'UPDATE_CANVAS_FAILED', message: err.message });
  }
});

// POST /api/dashboards/:id/widgets/:widgetId/trigger - Execute server-side trigger from client interaction
router.post('/:id/widgets/:widgetId/trigger', async (req, res) => {
  try {
    const { id: dashboardId, widgetId } = req.params;
    const { triggerName, payloadData = {} } = req.body;

    if (!triggerName) {
      return res.status(400).json({ error: 'TRIGGER_REQUIRED', message: 'Trigger name is required.' });
    }

    const updatedWidget = await dashboardAutomationService.executeSequence(
      dashboardId,
      widgetId,
      triggerName,
      payloadData
    );

    if (!updatedWidget) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Dashboard or widget not found.' });
    }

    const dashboard = db.dashboards.findById(dashboardId);
    const found = dashboardAutomationService.findWidgetInDashboard(dashboard, widgetId);

    res.json({
      success: true,
      widget: updatedWidget,
      isBadge: found ? found.isBadge : false,
      sectionId: found ? found.sectionId : null
    });
  } catch (err) {
    res.status(500).json({ error: 'TRIGGER_FAILED', message: err.message });
  }
});

// POST /api/dashboards/execute-action - Server-side webhook / pipeline step dispatcher with variable interpolation
router.post('/execute-action', async (req, res) => {
  try {
    const { step, widgetState = {} } = req.body;
    if (!step) {
      return res.status(400).json({ error: 'STEP_REQUIRED', message: 'Pipeline step object is required.' });
    }

    // Helper for variable interpolation in strings: ${widget.slider}, ${widget.number}, ${widget.active}, ${widget.state}
    const interpolate = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/\$\{widget\.([a-zA-Z0-9_]+)\}/g, (match, key) => {
        return widgetState[key] !== undefined ? widgetState[key] : match;
      });
    };

    if (step.type === 'webhook') {
      const method = (step.method || 'POST').toUpperCase();
      const url = interpolate(step.url);
      if (!url) {
        return res.status(400).json({ error: 'URL_REQUIRED', message: 'Webhook URL is required.' });
      }

      let parsedHeaders = { 'Content-Type': 'application/json' };
      if (typeof step.headers === 'string' && step.headers.trim()) {
        try {
          parsedHeaders = JSON.parse(interpolate(step.headers));
        } catch (e) {
          const lines = step.headers.split('\n');
          for (const line of lines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0) {
              parsedHeaders[line.slice(0, colonIdx).trim()] = interpolate(line.slice(colonIdx + 1).trim());
            }
          }
        }
      } else if (typeof step.headers === 'object' && step.headers !== null) {
        parsedHeaders = step.headers;
      }

      let body = undefined;
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && step.body) {
        body = interpolate(typeof step.body === 'object' ? JSON.stringify(step.body) : String(step.body));
      }

      const fetchOptions = {
        method,
        headers: parsedHeaders,
        signal: AbortSignal.timeout(10000)
      };
      if (body) fetchOptions.body = body;

      const targetUrl = resolveUrl(url);
      const fetchRes = await fetch(targetUrl, fetchOptions);
      const text = await fetchRes.text();
      let parsedData = null;
      try {
        parsedData = JSON.parse(text);
      } catch (e) {
        parsedData = null;
      }
      const dataPayload = (parsedData && typeof parsedData === 'object') ? (parsedData.data !== undefined ? parsedData.data : parsedData) : text;

      return res.json({
        success: fetchRes.ok,
        status: fetchRes.status,
        responsePreview: text.slice(0, 2000),
        data: dataPayload
      });
    }

    if (step.type === 'set_state' && step.key) {
      const val = step.value !== undefined ? step.value : true;
      const updated = db.infoState.set(step.key, val);
      const io = req.app.get('io');
      if (io) {
        io.emit('state:updated', { key: step.key, data: updated, timestamp: new Date().toISOString() });
      }
      return res.json({ success: true, key: step.key, data: updated });
    }

    res.json({ success: true, message: 'Step processed' });
  } catch (err) {
    res.status(500).json({ error: 'ACTION_EXECUTION_FAILED', message: err.message });
  }
});

// DELETE /api/dashboards/:id - Delete a dashboard
router.delete('/:id', requirePermission('dashboards', 'manage_dashboards'), (req, res) => {
  try {
    const existing = db.dashboards.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Dashboard not found' });
    }

    const allDashboards = db.dashboards.findAll();
    if (allDashboards.length <= 1) {
      return res.status(400).json({ error: 'DELETE_FORBIDDEN', message: 'Cannot delete the only remaining dashboard.' });
    }

    const success = db.dashboards.delete(req.params.id);

    const ipAddress = req.ip || req.connection.remoteAddress;
    db.audit.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'DASHBOARD',
      actionName: 'DELETE_DASHBOARD',
      details: { dashboardId: req.params.id, name: existing.name },
      ipAddress
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('dashboards_updated', { action: 'delete', dashboardId: req.params.id });
    }

    res.json({ success: true, message: 'Dashboard deleted successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'DELETE_DASHBOARD_FAILED', message: err.message });
  }
});

module.exports = router;
