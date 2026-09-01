// AV Audit - Home Assistant Lovelace-Inspired Multi-Dashboard Flight Control Center
const dashboardView = {
  dashboards: [],
  activeDashboardId: null,
  searchTerm: '',
  roles: [],
  infoState: {},
  isEditMode: false,
  activeCardConfig: null,
  activeCardSectionId: null,
  activeModalTab: 'properties',
  activeTrigger: 'onTap',
  isCodeEditorMode: false,
  activePollingTimers: [],
  sortableInstances: [],
  presetColors: [
    '#38bdf8', '#10b981', '#f59e0b', '#f85149', '#a855f7', '#94a3b8',
    '#ac725e', '#d06b64', '#f83a22', '#fa573c', '#ff7537', '#ffad46',
    '#42d692', '#16a765', '#7bd148', '#b3dc6c', '#fbe983', '#fad165',
    '#92e1c0', '#9fe1e7', '#9fc6e7', '#4986e7', '#b99aff', '#c2c2c2'
  ],
  isDropdownOpen: false,
  isLoadingDashboards: false,

  // Card Types & Properties Schema
  cardSchemas: {
    alert: {
      name: 'Alert Button',
      description: 'Flashing warning button with tap dismissal',
      properties: ['label', 'subtitle', 'icon', 'color', 'enabled', 'alert_on'],
      triggers: ['onTap', 'onInfo', 'onPolling'],
      defaults: {
        type: 'alert',
        label: 'System Alert',
        subtitle: 'Tap to dismiss',
        icon: '🚨',
        color: '#f85149',
        enabled: true,
        alert_on: true,
        cols: 6,
        rows: 1,
        automations: [
          {
            id: 'auto_dismiss_1',
            name: 'Dismiss on Tap',
            enabled: true,
            isExpanded: true,
            trigger: { type: 'onTap', infoKey: '', url: '', interval: 1.0 },
            actions: [{ type: 'set_property', property: 'alert_on', value: 'false' }]
          }
        ]
      }
    },
    button: {
      name: 'Button',
      description: 'Tap action & state pill',
      properties: ['label', 'subtitle', 'icon', 'color', 'enabled'],
      triggers: ['onTap', 'onInfo', 'onPolling'],
      defaults: {
        type: 'button',
        label: 'New Button',
        subtitle: 'Tap to trigger',
        icon: '💡',
        color: '#38bdf8',
        enabled: true,
        cols: 6,
        rows: 1,
        automations: [
          {
            id: 'auto_tap_1',
            name: 'On Tap Feedback',
            enabled: true,
            trigger: { type: 'onTap', infoKey: '', url: '', interval: 1.0 },
            actions: [{ type: 'set_property', property: 'subtitle', value: '"Triggered at " + new Date().toLocaleTimeString()' }]
          }
        ]
      }
    },
    toggle: {
      name: 'Toggle Switch',
      description: 'Discrete ON/OFF switch',
      properties: ['label', 'subtitle', 'icon', 'color', 'enabled', 'state'],
      triggers: ['onTap', 'onToggleOn', 'onToggleOff', 'onInfo', 'onPolling'],
      defaults: {
        type: 'toggle',
        label: 'Power Switch',
        subtitle: 'Main Relay',
        icon: '⚡',
        color: '#10b981',
        enabled: true,
        state: 'off',
        cols: 6,
        rows: 1,
        automations: [
          {
            id: 'auto_toggle_on',
            name: 'Turn On',
            enabled: true,
            trigger: { type: 'onToggleOn', infoKey: '', url: '', interval: 1.0 },
            actions: [{ type: 'set_property', property: 'state', value: '"on"' }]
          },
          {
            id: 'auto_toggle_off',
            name: 'Turn Off',
            enabled: true,
            trigger: { type: 'onToggleOff', infoKey: '', url: '', interval: 1.0 },
            actions: [{ type: 'set_property', property: 'state', value: '"off"' }]
          }
        ]
      }
    },
    slider: {
      name: 'Slider / Fader',
      description: 'Numeric track fader',
      properties: ['label', 'subtitle', 'icon', 'color', 'enabled', 'value', 'min', 'max'],
      triggers: ['onTap', 'onChange', 'onInfo', 'onPolling'],
      defaults: {
        type: 'slider',
        label: 'Volume Fader',
        subtitle: 'DSP Out 1',
        icon: '🎚️',
        color: '#f59e0b',
        enabled: true,
        value: 50,
        min: 0,
        max: 100,
        cols: 6,
        rows: 1,
        automations: [
          {
            id: 'auto_change_1',
            name: 'On Slider Change',
            enabled: true,
            trigger: { type: 'onChange', infoKey: '', url: '', interval: 1.0 },
            actions: []
          }
        ]
      }
    },
    stepper: {
      name: 'Number Stepper',
      description: '+ / - value stepper',
      properties: ['label', 'subtitle', 'icon', 'color', 'enabled', 'value', 'min', 'max', 'step_value'],
      triggers: ['onTap', 'onChange', 'onInfo', 'onPolling'],
      defaults: {
        type: 'stepper',
        label: 'Mic Gain',
        subtitle: 'Ch 1 Preamp',
        icon: '🎙️',
        color: '#a855f7',
        enabled: true,
        value: 0,
        min: -20,
        max: 60,
        step_value: 1,
        cols: 6,
        rows: 1,
        automations: [
          {
            id: 'auto_stepper_1',
            name: 'On Stepper Change',
            enabled: true,
            trigger: { type: 'onChange', infoKey: '', url: '', interval: 1.0 },
            actions: []
          }
        ]
      }
    },
    progress: {
      name: 'Linear Progress Bar',
      description: 'Horizontal progress gauge',
      properties: ['label', 'subtitle', 'icon', 'color', 'enabled', 'value', 'min', 'max'],
      triggers: ['onTap', 'onInfo', 'onPolling'],
      defaults: {
        type: 'progress',
        label: 'Lamp Hours',
        subtitle: 'Projector 1',
        icon: '📽️',
        color: '#38bdf8',
        enabled: true,
        value: 75,
        min: 0,
        max: 100,
        cols: 6,
        rows: 1,
        automations: []
      }
    },
    gauge: {
      name: 'Circular Progress Gauge',
      description: 'Radial circular meter',
      properties: ['label', 'subtitle', 'icon', 'color', 'enabled', 'value', 'min', 'max'],
      triggers: ['onTap', 'onInfo', 'onPolling'],
      defaults: {
        type: 'gauge',
        label: 'CPU Load',
        subtitle: 'Server Core',
        icon: '🖥️',
        color: '#ef4444',
        enabled: true,
        value: 42,
        min: 0,
        max: 100,
        cols: 6,
        rows: 1,
        automations: []
      }
    },
    graph: {
      name: 'Graph',
      description: 'Sensor trend sparkline',
      properties: ['label', 'subtitle', 'icon', 'color', 'enabled', 'data', 'display', 'new_data', 'graph_length'],
      triggers: ['onTap', 'onInfo', 'onPolling'],
      defaults: {
        type: 'graph',
        label: 'DSP Temp',
        subtitle: 'Thermal Sensor',
        icon: '🌡️',
        color: '#f59e0b',
        enabled: true,
        data: [22, 25, 28, 32, 35, 42.5],
        display: '42.5 °C',
        new_data: 42.5,
        graph_length: 20,
        cols: 6,
        rows: 1,
        automations: []
      }
    },
    badge: {
      name: 'Status Pill Badge',
      description: 'Top status pill badge',
      properties: ['label', 'icon', 'display', 'color'],
      triggers: ['onTap', 'onInfo', 'onPolling'],
      defaults: {
        type: 'badge',
        label: 'System Status',
        icon: '🏷️',
        display: 'Online',
        color: '#38bdf8',
        automations: []
      }
    }
  },

  normalizeCardType(type) {
    if (!type) return 'button';
    const t = String(type).toLowerCase();
    if (t === 'alert' || t === 'warning' || t === 'alarm') return 'alert';
    if (t === 'badge' || t === 'pill' || t === 'status_pill') return 'badge';
    if (t === 'tile') return 'button';
    if (t === 'sensor' || t === 'sparkline') return 'graph';
    if (t === 'circular_progress') return 'gauge';
    if (t === 'linear_progress') return 'progress';
    if (this.cardSchemas[t]) return t;
    return 'button';
  },

  normalizeColorValue(val) {
    if (typeof val !== 'string') return val;
    val = val.trim();
    if (/^[0-9A-Fa-f]{3,8}$/.test(val)) {
      return '#' + val;
    }
    return val;
  },

  getColorWithAlpha(color, opacity = 0.2) {
    if (!color) return `rgba(56, 189, 248, ${opacity})`;
    color = this.normalizeColorValue(color);
    if (color.startsWith('#')) {
      let hex = color.slice(1);
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
    }
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
    }
    if (color.startsWith('rgba(')) {
      return color;
    }
    return color;
  },

  canManageDashboards() {
    return window.app && typeof window.app.hasPermission === 'function'
      ? window.app.hasPermission('dashboards', 'manage_dashboards')
      : false;
  },

  init() {
    this.bindEvents();
    this.setupSocketListeners();
    this.loadInfoState();

    this.loadDashboards();
    this.updatePermissionsUI();
  },

  render() {
    this.loadDashboards(this.activeDashboardId);
    this.updatePermissionsUI();
  },

  canAccessDashboards() {
    if (!window.app || !window.app.user) return false;
    if (window.app.user.isAdmin) return true;
    return window.app.hasPermission('dashboards', 'access_nav') || window.app.hasPermission('dashboards', 'manage_dashboards');
  },

  updatePermissionsUI() {
    const canManage = this.canManageDashboards();
    const btnToggleEdit = document.getElementById('btn-toggle-dashboard-edit');
    const btnExport = document.getElementById('btn-export-dashboard');
    const btnImport = document.getElementById('btn-import-dashboard');
    const btnOpenSettings = document.getElementById('btn-open-dashboard-settings');
    const btnOpenCreate = document.getElementById('btn-open-create-dashboard');
    const dropdownFooter = document.getElementById('dashboard-dropdown-footer');

    if (btnToggleEdit) btnToggleEdit.style.display = canManage ? 'inline-flex' : 'none';
    if (btnExport) btnExport.style.display = canManage ? 'inline-flex' : 'none';
    if (btnImport) btnImport.style.display = canManage ? 'inline-flex' : 'none';
    if (btnOpenSettings) btnOpenSettings.style.display = canManage ? 'inline-flex' : 'none';
    if (btnOpenCreate) btnOpenCreate.style.display = canManage ? 'inline-flex' : 'none';
    if (dropdownFooter) dropdownFooter.style.display = canManage ? 'block' : 'none';
  },

  async loadInfoState() {
    try {
      const res = await api.info.getAll();
      this.infoState = res.state || {};
    } catch (err) {
      console.warn('Could not load initial infoState:', err);
    }
  },

  bindEvents() {
    const switcherBtn = document.getElementById('btn-dashboard-switcher');
    const dropdownMenu = document.getElementById('dashboard-dropdown-menu');
    const searchInput = document.getElementById('input-search-dashboards');
    const clearSearchBtn = document.getElementById('btn-clear-dashboard-search');
    const btnOpenCreate = document.getElementById('btn-open-create-dashboard');
    const btnOpenSettings = document.getElementById('btn-open-dashboard-settings');
    const btnToggleEdit = document.getElementById('btn-toggle-dashboard-edit');
    const btnExport = document.getElementById('btn-export-dashboard');
    const btnImport = document.getElementById('btn-import-dashboard');
    const inputImport = document.getElementById('input-import-dashboard-file');

    // Export Dashboard button
    if (btnExport) {
      btnExport.addEventListener('click', (e) => {
        e.preventDefault();
        this.exportDashboard();
      });
    }

    // Import Dashboard button & file input
    if (btnImport && inputImport) {
      btnImport.addEventListener('click', (e) => {
        e.preventDefault();
        inputImport.click();
      });
      inputImport.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.handleImportFile(file);
        }
      });
    }

    // Switcher Dropdown Toggle
    if (switcherBtn) {
      switcherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.dashboards.length === 0) return;
        this.toggleDropdown();
      });
    }

    // Dismiss dropdown on outside click
    document.addEventListener('click', (e) => {
      if (this.isDropdownOpen && dropdownMenu && !dropdownMenu.contains(e.target) && e.target !== switcherBtn && !switcherBtn.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Dismiss dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isDropdownOpen) {
        this.closeDropdown();
      }
    });

    // Search filter input
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        if (clearSearchBtn) {
          clearSearchBtn.style.display = this.searchTerm ? 'inline-flex' : 'none';
        }
        this.renderDropdownList();
      });
      searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    // Clear search button
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (searchInput) {
          searchInput.value = '';
          this.searchTerm = '';
          clearSearchBtn.style.display = 'none';
          this.renderDropdownList();
          searchInput.focus();
        }
      });
    }

    // Edit Mode Toggle
    if (btnToggleEdit) {
      btnToggleEdit.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleEditMode();
      });
    }

    // Open Create Dashboard modal
    if (btnOpenCreate) {
      btnOpenCreate.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.closeDropdown();
        await this.openCreateModal();
      });
    }

    // Submit Create Dashboard
    const formCreate = document.getElementById('form-create-dashboard');
    const btnSubmitCreate = document.getElementById('btn-submit-create-dashboard');
    if (btnSubmitCreate) {
      btnSubmitCreate.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleCreateSubmit();
      });
    }
    if (formCreate) {
      formCreate.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateSubmit();
      });
    }

    // Open Dashboard Settings modal
    if (btnOpenSettings) {
      btnOpenSettings.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.openSettingsModal();
      });
    }

    // Submit Dashboard Settings
    const formSettings = document.getElementById('form-dashboard-settings');
    const btnSubmitSettings = document.getElementById('btn-submit-save-dashboard-settings');
    if (btnSubmitSettings) {
      btnSubmitSettings.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSettingsSubmit();
      });
    }
    if (formSettings) {
      formSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSettingsSubmit();
      });
    }

    // Delete Dashboard button
    const btnDeleteDash = document.getElementById('btn-delete-dashboard');
    if (btnDeleteDash) {
      btnDeleteDash.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleDeleteDashboard();
      });
    }

    // Modal navigation tabs for Card Config
    const cardTabs = document.querySelectorAll('#card-config-tabs .lovelace-tab-btn');
    cardTabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.dataset.tab;
        this.switchCardConfigTab(tab);
      });
    });

    // Card Config Form Input Bindings
    this.bindCardConfigFormEvents();

    // Section modal save & delete
    const btnSaveSection = document.getElementById('btn-save-section-config');
    if (btnSaveSection) {
      btnSaveSection.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSaveSection();
      });
    }

    const btnDeleteSection = document.getElementById('btn-delete-section');
    if (btnDeleteSection) {
      btnDeleteSection.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleDeleteSection();
      });
    }

    // Badge modal save & delete
    const btnSaveBadge = document.getElementById('btn-save-badge-config');
    if (btnSaveBadge) {
      btnSaveBadge.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSaveBadge();
      });
    }

    const btnDeleteBadge = document.getElementById('btn-delete-badge');
    if (btnDeleteBadge) {
      btnDeleteBadge.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleDeleteBadge();
      });
    }
  },

  setupSocketListeners() {
    if (this._socketListenersAttached) return;
    this._socketListenersAttached = true;

    // Real-Time Ingestion: /info/:key updates
    const handleInfoUpdate = (data) => {
      if (!data || !data.key) return;
      const key = data.key;
      const payloadData = (data.data && typeof data.data === 'object') ? data.data : data.data;
      this.infoState[key] = payloadData;
      this.updateLiveCardsByKey(key);
    };

    window.addEventListener('socket_info_updated', (e) => handleInfoUpdate(e.detail));
    window.addEventListener('socket_state_updated', (e) => handleInfoUpdate(e.detail));

    // Real-Time Widget Updates from Server-Side Automations & Polling
    const handleWidgetUpdate = (msg) => {
      if (!msg) return;
      if (msg.dashboardId === this.activeDashboardId && msg.widget) {
        const current = this.getActiveDashboard();
        if (current) {
          if (msg.isBadge && Array.isArray(current.badges)) {
            const idx = current.badges.findIndex(b => b.id === msg.widgetId);
            if (idx >= 0) current.badges[idx] = msg.widget;
            else current.badges.push(msg.widget);
            this.updateBadgeElementInDom(msg.widget);
          } else if (Array.isArray(current.sections)) {
            current.sections.forEach(sec => {
              if (Array.isArray(sec.cards)) {
                const cIdx = sec.cards.findIndex(c => c.id === msg.widgetId);
                if (cIdx >= 0) sec.cards[cIdx] = msg.widget;
              }
            });
            this.updateCardElementInDom(msg.widget);
          }
        }
      }
    };

    window.addEventListener('socket_widget_updated', (e) => handleWidgetUpdate(e.detail));

    // Dashboard Structure & Canvas Sync
    window.addEventListener('socket_dashboards_updated', () => {
      this.loadDashboards(this.activeDashboardId);
    });

    window.addEventListener('socket_dashboard_canvas_updated', (e) => {
      const msg = e.detail;
      if (msg && msg.dashboardId === this.activeDashboardId) {
        const current = this.getActiveDashboard();
        if (current) {
          if (msg.canvas) {
            current.badges = msg.canvas.badges || current.badges;
            current.sections = msg.canvas.sections || current.sections;
          } else if (msg.dashboard) {
            current.badges = msg.dashboard.badges || current.badges;
            current.sections = msg.dashboard.sections || current.sections;
          }
          if (!this.isEditMode) {
            this.renderActiveDashboard();
          }
        }
      }
    });
  },

  async load() {
    await this.loadDashboards();
  },

  async loadDashboards(preferredId = null) {
    if (this.isLoadingDashboards) return;
    this.isLoadingDashboards = true;

    try {
      const res = await api.dashboards.getAll();
      this.dashboards = res.dashboards || [];

      if (this.dashboards.length > 0) {
        if (preferredId && this.dashboards.some(d => d.id === preferredId)) {
          this.activeDashboardId = preferredId;
        } else if (!this.activeDashboardId || !this.dashboards.some(d => d.id === this.activeDashboardId)) {
          this.activeDashboardId = this.dashboards[0].id;
        }
      } else {
        this.activeDashboardId = null;
      }

      this.renderDropdownList();
      this.renderActiveDashboard();
      this.updatePermissionsUI();
    } catch (err) {
      console.error('Failed to load dashboards:', err);
      helpers.showToast('Failed to load dashboards', 'error');
    } finally {
      this.isLoadingDashboards = false;
    }
  },

  getActiveDashboard() {
    if (!this.activeDashboardId) return null;
    return this.dashboards.find(d => d.id === this.activeDashboardId) || null;
  },

  toggleEditMode() {
    const canManage = window.app && typeof window.app.hasPermission === 'function'
      ? window.app.hasPermission('dashboards', 'manage_dashboards')
      : false;
    if (!canManage) {
      helpers.showToast('You do not have permission to edit dashboards.', 'warning');
      return;
    }

    this.isEditMode = !this.isEditMode;
    const btn = document.getElementById('btn-toggle-dashboard-edit');
    const btnText = document.getElementById('btn-dashboard-edit-text');

    if (btn) {
      btn.classList.toggle('active', this.isEditMode);
    }
    if (btnText) {
      btnText.textContent = this.isEditMode ? 'Done Editing' : 'Edit Dashboard';
    }

    this.renderActiveDashboard();
  },

  async loadRoles(force = false) {
    if (this.roles.length > 0 && !force) return;
    try {
      const res = await api.roles.getAll();
      this.roles = res.roles || [];
    } catch (err) {
      console.error('Failed to load roles for dashboard picker:', err);
    }
  },

  // ================= SAFE TEMPLATE INTERPOLATION & EXPRESSION EVALUATION =================
  normalizePayload(rawData) {
    if (!rawData || typeof rawData !== 'object') {
      return { data: rawData, value: rawData };
    }
    let dataContext = { ...rawData };
    if (rawData.record && typeof rawData.record === 'object') {
      Object.assign(dataContext, rawData.record);
      dataContext.record = rawData.record;
    }
    if (rawData.data && typeof rawData.data === 'object') {
      Object.assign(dataContext, rawData.data);
      dataContext.data = rawData.data;
    }
    return dataContext;
  },

  evalTemplateString(template, context = { widget: {}, data: {} }) {
    if (template === undefined || template === null) return '';
    if (typeof template !== 'string') return String(template);

    const widget = context.widget || {};
    const data = this.normalizePayload(context.data);

    // Direct ${widget.prop} or ${data.prop} pattern replacement
    let result = template.replace(/\$\{([^}]+)\}/g, (match, expr) => {
      try {
        const fn = new Function('widget', 'data', `"use strict"; return (${expr});`);
        const val = fn(widget, data);
        return val !== undefined && val !== null ? val : '';
      } catch (e) {
        return match;
      }
    });

    // Check if entire template is a JS expression without ${} wrappers (e.g. "Tablet " + data.battery + "%" or "stage " + widget.value + "%")
    if (result.includes('+') || result.includes('?') || result.includes('data.') || result.includes('widget.')) {
      try {
        const fn = new Function('widget', 'data', `"use strict"; return (${result});`);
        const val = fn(widget, data);
        if (val !== undefined && val !== null) return String(val);
      } catch (e) { }
    }

    return result;
  },

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
  },

  // Evaluate all dynamic properties of a card
  evaluateCardProperties(card, payloadData = {}) {
    const normType = this.normalizeCardType(card.type);

    let rawData = payloadData || {};
    let data = rawData;
    if (rawData && typeof rawData === 'object' && rawData.data !== undefined && Object.keys(rawData).length === 1) {
      data = Object.assign({}, rawData.data, { data: rawData.data });
    } else if (rawData && typeof rawData === 'object' && rawData.data !== undefined) {
      data = Object.assign({}, rawData, rawData.data);
    }

    const context = {
      widget: { ...card, type: normType },
      data
    };

    // 1. First evaluate numeric and discrete state properties so context.widget is populated with updated values
    const min = Number(this.evalExpression(card.min !== undefined ? card.min : 0, context, 0));
    const max = Number(this.evalExpression(card.max !== undefined ? card.max : 100, context, 100));
    const step_value = Number(this.evalExpression(card.step_value !== undefined ? card.step_value : (card.step || 1), context, 1));
    let val = Number(this.evalExpression(card.value !== undefined ? card.value : (card.val !== undefined ? card.val : 50), context, 50));
    if (isNaN(val)) val = 0;

    let state = card.state !== undefined ? card.state : 'off';
    if (typeof state === 'string') state = this.evalTemplateString(state, context);
    const isStateOn = state === true || String(state).toLowerCase() === 'on' || String(state).toLowerCase() === 'true';

    const icon = card.icon || '💡';
    const rawColor = card.color !== undefined ? card.color : (card.accentColor || '#38bdf8');
    let color = this.evalExpression(rawColor, context, '#38bdf8');
    color = this.normalizeColorValue(color);
    if (typeof color !== 'string' || !color.trim()) color = '#38bdf8';
    color = color.trim();
    const enabled = card.enabled !== undefined ? Boolean(this.evalExpression(card.enabled, context, true)) : true;
    let alert_on = true;
    if (card.alert_on !== undefined) {
      const evalAlert = this.evalExpression(card.alert_on, context, true);
      alert_on = evalAlert === true || evalAlert === 'true' || evalAlert === 1 || evalAlert === '1' || evalAlert === 'on';
    }

    // Update context.widget with evaluated values so expressions referencing ${widget.value}, ${widget.state}, etc. work
    context.widget.value = val;
    context.widget.val = val;
    context.widget.min = min;
    context.widget.max = max;
    context.widget.step_value = step_value;
    context.widget.state = isStateOn ? 'on' : 'off';
    context.widget.isStateOn = isStateOn;
    context.widget.color = color;
    context.widget.enabled = enabled;
    context.widget.icon = icon;
    context.widget.alert_on = alert_on;

    // 2. Now evaluate label, subtitle, and display using the updated widget values
    const rawLabel = card.label !== undefined ? card.label : (card.name || card.title || 'Card');
    const label = this.evalTemplateString(rawLabel, context);
    const subtitle = this.evalTemplateString(card.subtitle || '', context);

    const range = (max - min) || 1;
    const valPct = Math.max(0, Math.min(100, ((val - min) / range) * 100));

    // 3. Graph Specific: data, display, new_data, graph_length
    let dataList = Array.isArray(card.data) ? [...card.data] : [];
    if (typeof card.data === 'string') {
      try { dataList = JSON.parse(card.data); } catch (e) { dataList = card.data.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n)); }
    }
    const graph_length = Number(card.graph_length) || 20;
    if (dataList.length > graph_length) {
      dataList = dataList.slice(-graph_length);
    }
    const display = this.evalTemplateString(card.display !== undefined ? card.display : (card.state || `${val}`), context);

    return {
      type: normType,
      label,
      subtitle,
      icon,
      color,
      enabled,
      alert_on,
      state: isStateOn ? 'on' : 'off',
      isStateOn,
      value: val,
      min,
      max,
      step_value,
      valPct,
      dataList,
      display,
      graph_length
    };
  },

  // Evaluate dynamic properties of a status pill badge
  evaluateBadgeProperties(badge, payloadData = {}) {
    let rawData = payloadData || {};
    let data = rawData;
    if (rawData && typeof rawData === 'object' && rawData.data !== undefined && Object.keys(rawData).length === 1) {
      data = Object.assign({}, rawData.data, { data: rawData.data });
    } else if (rawData && typeof rawData === 'object' && rawData.data !== undefined) {
      data = Object.assign({}, rawData, rawData.data);
    }

    const context = {
      widget: { ...badge, type: 'badge' },
      data
    };

    const icon = badge.icon || '🏷️';
    const rawColor = badge.color !== undefined ? badge.color : (badge.colorExpr || '#38bdf8');
    let color = this.evalExpression(rawColor, context, '#38bdf8');
    color = this.normalizeColorValue(color);
    if (typeof color !== 'string' || !color.trim()) color = '#38bdf8';
    color = color.trim();

    context.widget.icon = icon;
    context.widget.color = color;

    const rawLabel = badge.label !== undefined ? badge.label : (badge.name || badge.title || '');
    const label = this.evalTemplateString(rawLabel, context);

    const rawDisplay = badge.display !== undefined ? badge.display : (badge.state || badge.fallbackText || badge.infoExpr || '');
    const display = this.evalTemplateString(rawDisplay, context);

    return {
      label,
      icon,
      display,
      color
    };
  },

  // ================= RENDER ACTIVE DASHBOARD CANVAS & BADGES =================
  renderActiveDashboard() {
    const current = this.getActiveDashboard();
    const switcherBtn = document.getElementById('btn-dashboard-switcher');
    const colorDot = document.getElementById('current-dashboard-color-dot');
    const titleEl = document.getElementById('current-dashboard-title');
    const descEl = document.getElementById('current-dashboard-description');
    const stageContainer = document.getElementById('dashboard-stage-container');

    // Stop and restart polling timers
    this.stopPollingTimers();

    if (!current || this.dashboards.length === 0) {
      if (switcherBtn) {
        switcherBtn.disabled = true;
        switcherBtn.classList.add('disabled');
      }
      if (titleEl) titleEl.textContent = 'No Dashboards Available';
      if (descEl) descEl.textContent = 'You do not currently have access to any dashboards.';
      if (colorDot) {
        colorDot.style.backgroundColor = '#6e7681';
        colorDot.style.color = '#6e7681';
      }
      if (stageContainer) {
        stageContainer.innerHTML = `
          <div class="dashboard-stage-empty">
            <div class="dashboard-empty-icon-box">🎛️</div>
            <h3>No Dashboard Available</h3>
            <p>You do not currently have access to any dashboards.</p>
          </div>
        `;
      }
      this.closeDropdown();
      return;
    }

    if (switcherBtn) {
      switcherBtn.disabled = false;
      switcherBtn.classList.remove('disabled');
    }

    const color = current.color_code || '#58a6ff';
    if (titleEl) titleEl.textContent = current.name || 'Untitled Dashboard';
    if (descEl) {
      descEl.textContent = current.description || '';
      descEl.style.display = current.description ? 'block' : 'none';
    }
    if (colorDot) {
      colorDot.style.backgroundColor = color;
      colorDot.style.color = color;
    }

    // Apply edit-mode-active class to entire dashboard view and body
    const viewDash = document.getElementById('view-dashboard');
    if (viewDash) viewDash.classList.toggle('edit-mode-active', this.isEditMode);
    document.body.classList.toggle('editing-mode', this.isEditMode);

    // Render Top Badges Row
    this.renderBadgesRow(current.badges || []);

    // Render Lovelace Sections
    this.renderSections(current.sections || [], stageContainer);

    // Ensure no client-side polling timers linger (server handles all polling)
    this.stopPollingTimers();
  },

  renderBadgesRow(badges) {
    const badgesRow = document.getElementById('dashboard-badges-row');
    if (!badgesRow) return;

    badgesRow.classList.toggle('edit-mode-active', this.isEditMode);

    const badgesHtml = (badges || []).map(badge => {
      const p = this.evaluateBadgeProperties(badge, (badge.infoKey && this.infoState[badge.infoKey]) ? this.infoState[badge.infoKey] : {});
      const hasLabel = Boolean(p.label && p.label.trim());
      const hasDisplay = Boolean(p.display && p.display.trim());

      let contentHtml = '';
      if (hasLabel && hasDisplay) {
        contentHtml = `<span class="badge-label">${helpers.escapeHtml(p.label)}:</span> <span class="badge-text" style="color: ${p.color};">${helpers.escapeHtml(p.display)}</span>`;
      } else if (hasDisplay) {
        contentHtml = `<span class="badge-text" style="color: ${p.color};">${helpers.escapeHtml(p.display)}</span>`;
      } else if (hasLabel) {
        contentHtml = `<span class="badge-text" style="color: ${p.color};">${helpers.escapeHtml(p.label)}</span>`;
      }

      const hasContent = Boolean(contentHtml);

      return `
        <div class="ha-badge ${!hasContent ? 'ha-badge-icon-only' : ''}" data-badge-id="${badge.id}" title="${helpers.escapeHtml(p.label || p.display || 'Status Pill')}">
          <div class="badge-edit-overlay" data-badge-id="${badge.id}">
            <span class="badge-action-btn btn-edit-badge" data-badge-id="${badge.id}" title="Edit Status Pill">✏️</span>
            <span class="badge-action-btn btn-delete-badge" data-badge-id="${badge.id}" title="Remove Status Pill">🗑️</span>
          </div>
          <span class="badge-icon">${p.icon}</span>
          ${contentHtml}
        </div>
      `;
    }).join('');

    const addBadgeHtml = `
      <button type="button" class="add-badge-btn" id="btn-add-badge-trigger" title="Add Status Pill Badge" style="${this.isEditMode ? 'display: inline-flex !important;' : 'display: none !important;'}">
        +
      </button>
    `;

    badgesRow.className = 'dashboard-badges-row badges-row' + (this.isEditMode ? ' edit-mode-active' : '');
    badgesRow.innerHTML = badgesHtml + addBadgeHtml;

    // Attach click events
    badgesRow.querySelectorAll('.ha-badge').forEach(el => {
      const badgeId = el.dataset.badgeId;
      const current = this.getActiveDashboard();
      if (!current) return;
      const badge = (current.badges || []).find(b => b.id === badgeId);
      if (!badge) return;

      const btnEdit = el.querySelector('.btn-edit-badge');
      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openBadgeModal(badgeId);
        });
      }

      const btnDelete = el.querySelector('.btn-delete-badge');
      if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleDeleteBadge(badgeId);
        });
      }

      el.addEventListener('click', (e) => {
        if (e.target.closest('.badge-edit-overlay')) return;
        if (this.isEditMode) {
          e.stopPropagation();
          this.openBadgeModal(badgeId);
        } else {
          el.classList.add('badge-optimistic-tap');
          setTimeout(() => el.classList.remove('badge-optimistic-tap'), 250);
          this.executeTrigger(badge, 'onTap', { widget: badge });
        }
      });
    });

    const addBadgeBtn = document.getElementById('btn-add-badge-trigger');
    if (addBadgeBtn) {
      addBadgeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openBadgeModal(null);
      });
    }
  },

  renderSections(sections, container) {
    if (!container) return;
    this.destroySortables();

    if (this.isEditMode) {
      container.classList.add('edit-mode-active');
    } else {
      container.classList.remove('edit-mode-active');
    }

    if (!sections || sections.length === 0) {
      container.innerHTML = `
        <div class="dashboard-stage-empty">
          <div class="dashboard-empty-icon-box">🎛️</div>
          <h3>${this.getActiveDashboard().name || 'Dashboard Canvas'}</h3>
          <p>No control sections configured yet. Toggle <strong>Edit Dashboard</strong> to add your first section and cards.</p>
        </div>
        <div class="sections-container" style="padding-top:0;">
          <div class="add-section-container" id="btn-add-section-banner">
            <span style="font-size: 1.5rem;">+</span><span>Add Section</span>
          </div>
        </div>
      `;
      const btnAddEmpty = document.getElementById('btn-add-section-banner');
      if (btnAddEmpty) btnAddEmpty.addEventListener('click', () => this.handleAddSectionDirect());
      return;
    }

    const sectionsHtml = sections.map((sec) => {
      const cardsHtml = (sec.cards || []).map(card => this.renderCardHtml(card, sec.id)).join('');

      return `
        <div class="ha-section" data-section-id="${sec.id}">
          <!-- Home Assistant Style Section Edit Tab Handle & Delete Button -->
          <div class="section-edit-tab">
            <button type="button" class="section-tab-handle" data-section-id="${sec.id}" title="Drag to reorder section">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="4" y1="9" x2="20" y2="9"></line>
                <line x1="4" y1="15" x2="20" y2="15"></line>
              </svg>
            </button>
            <button type="button" class="section-tab-delete btn-delete-sec" data-section-id="${sec.id}" title="Delete Section">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>

          <div class="section-header-bar">
            <div class="section-title">
              ${this.isEditMode ? `
                <input type="text" class="section-title-input" data-section-id="${sec.id}" value="${helpers.escapeHtml(sec.title || 'Section')}" placeholder="Section Title" title="Click to rename section">
              ` : `
                <span>${helpers.escapeHtml(sec.title || 'Section')}</span>
              `}
            </div>
          </div>

          <div class="cards-grid" id="grid_${sec.id}" data-section-id="${sec.id}">
            ${cardsHtml}
            <div class="add-card-slot" data-section-id="${sec.id}" title="Add Card to this Section">+</div>
          </div>
        </div>
      `;
    }).join('');

    const addSectionContainer = `
      <div class="add-section-container" id="btn-add-section-banner">
        <span style="font-size: 1.5rem;">+</span><span>Add Section</span>
      </div>
    `;

    container.innerHTML = `<div class="sections-container">${sectionsHtml}${addSectionContainer}</div>`;

    // Attach Section & Card Interaction Listeners
    this.attachCanvasInteractiveListeners(container);
  },

  // ================= 8 OVERHAULED CARD & BADGE RENDERERS =================
  renderCardHtml(card, sectionId, isPreview = false) {
    const p = this.evaluateCardProperties(card);
    const cols = Number(card.cols || card.colSpan || 6);
    const rows = Number(card.rows || card.rowSpan || 1);
    const type = p.type;
    const accentColor = p.color || '#38bdf8';
    const disabledClass = !p.enabled ? 'card-disabled' : '';

    // Status Pill Badge Preview in Modal
    if (type === 'badge') {
      const pBadge = this.evaluateBadgeProperties(card);
      const hasLabel = Boolean(pBadge.label && pBadge.label.trim());
      const hasDisplay = Boolean(pBadge.display && pBadge.display.trim());

      let contentHtml = '';
      if (hasLabel && hasDisplay) {
        contentHtml = `<span class="badge-label">${helpers.escapeHtml(pBadge.label)}:</span> <span class="badge-text" style="color: ${pBadge.color};">${helpers.escapeHtml(pBadge.display)}</span>`;
      } else if (hasDisplay) {
        contentHtml = `<span class="badge-text" style="color: ${pBadge.color};">${helpers.escapeHtml(pBadge.display)}</span>`;
      } else if (hasLabel) {
        contentHtml = `<span class="badge-text" style="color: ${pBadge.color};">${helpers.escapeHtml(pBadge.label)}</span>`;
      }

      return `
        <div style="display: flex; justify-content: center; align-items: center; padding: 2rem 0;">
          <div class="ha-badge" style="transform: scale(1.25); box-shadow: 0 4px 16px rgba(0,0,0,0.4);">
            <span class="badge-icon">${pBadge.icon}</span>
            ${contentHtml}
          </div>
        </div>
      `;
    }

    let cardControlsHtml = '';

    // 1. Toggle Switch
    if (type === 'toggle') {
      cardControlsHtml = `
        <div class="ha-toggle-switch ${p.isStateOn ? 'checked' : ''}" data-card-id="${card.id}" onclick="event.stopPropagation()">
          <span class="ha-toggle-slider" style="${p.isStateOn ? `background-color: ${accentColor}; box-shadow: 0 0 8px ${accentColor};` : ''}"></span>
        </div>
      `;
    }
    // 2. Circular Progress Gauge
    else if (type === 'gauge') {
      const radius = 17;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (p.valPct / 100) * circumference;

      cardControlsHtml = `
        <div class="circular-progress-box">
          <svg class="circular-svg" viewBox="0 0 44 44">
            <circle class="circle-bg" cx="22" cy="22" r="${radius}" />
            <circle class="circle-fill" cx="22" cy="22" r="${radius}" 
              style="stroke: ${accentColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};" />
          </svg>
          <span class="circular-val-text">${Math.round(p.value)}</span>
        </div>
      `;
    }

    // Main top row
    const editOverlayHtml = !isPreview ? `
      <div class="card-edit-overlay">
        <button type="button" class="card-edit-btn btn-edit-card" data-section-id="${sectionId}" data-card-id="${card.id}" title="Configure">✏️</button>
        <button type="button" class="card-edit-btn btn-duplicate-card" data-section-id="${sectionId}" data-card-id="${card.id}" title="Duplicate">📋</button>
        <button type="button" class="card-edit-btn btn-delete-card" data-section-id="${sectionId}" data-card-id="${card.id}" title="Delete">🗑️</button>
      </div>
    ` : '';

    let inner = `
      ${editOverlayHtml}
      <div class="tile-main-row">
        <div class="tile-icon-circle" style="background: ${this.getColorWithAlpha(accentColor, 0.13)}; color: ${accentColor}; border: 1px solid ${this.getColorWithAlpha(accentColor, 0.33)};">
          ${p.icon}
        </div>
        <div class="tile-info">
          <span class="tile-name">${helpers.escapeHtml(p.label)}</span>
          <span class="tile-state">${helpers.escapeHtml(p.subtitle || (type === 'toggle' ? (p.isStateOn ? 'ON' : 'OFF') : ''))}</span>
        </div>
        ${cardControlsHtml}
      </div>
    `;

    // 3. Linear Progress Bar
    if (type === 'progress') {
      inner += `
        <div class="linear-progress-wrapper" style="margin-top: 8px;">
          <div class="linear-progress-track" style="background: rgba(255,255,255,0.06); height: 8px; border-radius: 4px; overflow: hidden;">
            <div class="linear-progress-bar" style="width: ${p.valPct}%; background: ${accentColor}; height: 100%; border-radius: 4px; transition: width 0.3s ease;"></div>
          </div>
        </div>
      `;
    }
    // 4. Slider Fader
    else if (type === 'slider') {
      inner += `
        <div class="tile-slider-track" data-card-id="${card.id}" style="background: ${this.getColorWithAlpha(accentColor, 0.1)}; border-color: ${this.getColorWithAlpha(accentColor, 0.25)};">
          <div class="tile-slider-fill" style="width: ${p.valPct}%; background: ${accentColor};"></div>
          <div class="tile-slider-handle" style="left: ${p.valPct}%;"></div>
        </div>
      `;
    }
    // 5. Stepper
    else if (type === 'stepper') {
      inner += `
        <div class="climate-stepper-row" style="border-color: ${this.getColorWithAlpha(accentColor, 0.2)};">
          <button type="button" class="step-btn btn-step-down" data-card-id="${card.id}" ${!p.enabled ? 'disabled' : ''}>–</button>
          <span class="stepper-val">${p.value}</span>
          <button type="button" class="step-btn btn-step-up" data-card-id="${card.id}" ${!p.enabled ? 'disabled' : ''}>+</button>
        </div>
      `;
    }
    // 6. Graph (Sparkline Area Trend)
    else if (type === 'graph') {
      const graphSvgHtml = this.generateGraphSvg(p.dataList, accentColor, card.id || 'preview');
      inner += `
        <div class="sensor-graph-box">
          <div class="sensor-big-val" style="color: ${accentColor};">${helpers.escapeHtml(p.display)}</div>
          ${graphSvgHtml}
        </div>
      `;
    }

    const alertClass = type === 'alert' ? (p.alert_on ? 'ha-card-alert ha-card-alert-active' : 'ha-card-alert ha-card-alert-inactive') : '';

    return `
      <div class="ha-card span-col-${cols} span-row-${rows} ${disabledClass} ${alertClass}"
        style="grid-column: span ${cols} !important; grid-row: span ${rows} !important;"
        data-card-id="${card.id}"
        data-section-id="${sectionId}"
        data-cols="${cols}"
        data-rows="${rows}">
        ${inner}
      </div>
    `;
  },

  generateGraphSvg(dataList, accentColor = '#38bdf8', cardId = 'spark') {
    accentColor = this.normalizeColorValue(accentColor) || '#38bdf8';
    const width = 200;
    const height = 50;
    const paddingTop = 6;
    const paddingBottom = 4;
    const paddingLeft = 3;
    const paddingRight = 4;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    let cleanData = (dataList || []).map(v => Number(v)).filter(v => !isNaN(v));
    if (cleanData.length === 0) cleanData = [50, 50];
    if (cleanData.length === 1) cleanData = [cleanData[0], cleanData[0]];

    const min = Math.min(...cleanData);
    const max = Math.max(...cleanData);
    const range = (max - min) || 1;

    const coords = cleanData.map((val, idx) => {
      const x = paddingLeft + (idx / (cleanData.length - 1)) * plotWidth;
      const y = (height - paddingBottom) - ((val - min) / range) * plotHeight;
      return { x, y };
    });

    const getSplinePath = (pts) => {
      if (pts.length <= 1) return `M0,${pts[0]?.y || 25} L${width},${pts[0]?.y || 25}`;
      if (pts.length === 2) {
        return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
      }
      let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = i > 0 ? pts[i - 1] : pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = i < pts.length - 2 ? pts[i + 2] : p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      return d;
    };

    const strokePath = getSplinePath(coords);
    const lastPt = coords[coords.length - 1];
    const firstPt = coords[0];
    const areaPath = `${strokePath} L${lastPt.x.toFixed(1)},${height} L${firstPt.x.toFixed(1)},${height} Z`;

    const sanitizedId = String(cardId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const gradId = `graph_grad_${sanitizedId}`;
    const beaconLeftPct = ((lastPt.x / width) * 100).toFixed(1);
    const beaconTopPct = ((lastPt.y / height) * 100).toFixed(1);

    return `
      <div class="sparkline-wrapper">
        <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.42"/>
              <stop offset="50%" stop-color="${accentColor}" stop-opacity="0.14"/>
              <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.0"/>
            </linearGradient>
            <filter id="glow_${gradId}" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="${accentColor}" flood-opacity="0.35"/>
            </filter>
          </defs>
          <path class="sparkline-area" d="${areaPath}" fill="url(#${gradId})" />
          <path class="sparkline-line" d="${strokePath}" fill="none" stroke="${accentColor}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow_${gradId})" />
        </svg>
        <div class="graph-live-beacon" style="left: ${beaconLeftPct}%; top: ${beaconTopPct}%; --beacon-color: ${accentColor};">
          <span class="beacon-halo"></span>
          <span class="beacon-core"></span>
        </div>
      </div>
    `;
  },

  generateGraphPath(points, width = 100, height = 25) {
    if (!points || points.length === 0) {
      return `M0,${height / 2} L${width},${height / 2}`;
    }
    if (points.length === 1) {
      return `M0,${height / 2} L${width},${height / 2}`;
    }

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = (max - min) || 1;
    const stepX = width / (points.length - 1);

    return points.map((val, idx) => {
      const x = (idx * stepX).toFixed(1);
      const y = (height - ((val - min) / range) * (height - 6) - 3).toFixed(1);
      return `${idx === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  },

  // Update a single card DOM element live
  updateCardElementInDom(card) {
    if (!card || !card.id) return;
    const cardEl = document.querySelector(`.ha-card[data-card-id="${card.id}"]`);
    if (!cardEl) return;
    const sectionId = cardEl.dataset.sectionId || this.activeCardSectionId;
    const temp = document.createElement('div');
    temp.innerHTML = this.renderCardHtml(card, sectionId);
    const newEl = temp.firstElementChild;
    if (newEl) {
      cardEl.innerHTML = newEl.innerHTML;
      cardEl.className = newEl.className;
      this.attachCardInteractiveListeners(cardEl, card, sectionId);
    }
  },

  // Update a single status pill badge DOM element live
  updateBadgeElementInDom(badge) {
    if (!badge || !badge.id) return;
    const badgeEl = document.querySelector(`.ha-badge[data-badge-id="${badge.id}"]`);
    if (!badgeEl) return;
    const p = this.evaluateBadgeProperties(badge, (badge.infoKey && this.infoState[badge.infoKey]) ? this.infoState[badge.infoKey] : {});
    const hasLabel = Boolean(p.label && p.label.trim());
    const hasDisplay = Boolean(p.display && p.display.trim());

    let contentHtml = '';
    if (hasLabel && hasDisplay) {
      contentHtml = `<span class="badge-label">${helpers.escapeHtml(p.label)}:</span> <span class="badge-text" style="color: ${p.color};">${helpers.escapeHtml(p.display)}</span>`;
    } else if (hasDisplay) {
      contentHtml = `<span class="badge-text" style="color: ${p.color};">${helpers.escapeHtml(p.display)}</span>`;
    } else if (hasLabel) {
      contentHtml = `<span class="badge-text" style="color: ${p.color};">${helpers.escapeHtml(p.label)}</span>`;
    }

    const hasContent = Boolean(contentHtml);
    badgeEl.className = `ha-badge ${!hasContent ? 'ha-badge-icon-only' : ''}`;
    badgeEl.title = p.label || p.display || 'Status Pill';
    badgeEl.innerHTML = `
      <div class="badge-edit-overlay" data-badge-id="${badge.id}">
        <span class="badge-action-btn btn-edit-badge" data-badge-id="${badge.id}" title="Edit Status Pill">✏️</span>
        <span class="badge-action-btn btn-delete-badge" data-badge-id="${badge.id}" title="Remove Status Pill">🗑️</span>
      </div>
      <span class="badge-icon">${p.icon}</span>
      ${contentHtml}
    `;

    const btnEdit = badgeEl.querySelector('.btn-edit-badge');
    if (btnEdit) {
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openBadgeModal(badge.id);
      });
    }

    const btnDelete = badgeEl.querySelector('.btn-delete-badge');
    if (btnDelete) {
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDeleteBadge(badge.id);
      });
    }
  },

  // ================= REAL-TIME DOM UPDATE ON INGESTION =================
  updateLiveCardsByKey(infoKey) {
    const current = this.getActiveDashboard();
    if (!current) return;

    // Update Badges
    (current.badges || []).forEach(badge => {
      const automations = this.normalizeAutomations(badge.automations || badge.pipelines);
      const matches = automations.some(a => a.enabled !== false && a.trigger && a.trigger.type === 'onInfo' && (a.trigger.infoKey === infoKey || (!a.trigger.infoKey && badge.infoKey === infoKey)));
      if (matches) {
        this.updateBadgeElementInDom(badge);
      }
    });

    // Update Cards
    (current.sections || []).forEach(sec => {
      (sec.cards || []).forEach(card => {
        const automations = this.normalizeAutomations(card.automations || card.pipelines);
        const matches = automations.some(a => a.enabled !== false && a.trigger && a.trigger.type === 'onInfo' && (a.trigger.infoKey === infoKey || (!a.trigger.infoKey && card.infoKey === infoKey)));
        if (matches) {
          this.updateCardElementInDom(card);
        }
      });
    });
  },

  // ================= SERVER TRIGGER DISPATCHER & LOCAL SEQUENCE RUNNER =================
  async executeTrigger(card, triggerName, payloadData = {}) {
    if (!card) return;

    // 1. Dispatch to server engine for official execution, sequence processing & multi-client sync
    if (this.activeDashboardId && card.id) {
      try {
        const res = await api.dashboards.triggerWidget(this.activeDashboardId, card.id, triggerName, payloadData);
        if (res && res.widget) {
          const current = this.getActiveDashboard();
          if (current) {
            if (res.isBadge && Array.isArray(current.badges)) {
              const idx = current.badges.findIndex(b => b.id === card.id);
              if (idx >= 0) current.badges[idx] = res.widget;
              else current.badges.push(res.widget);
              this.updateBadgeElementInDom(res.widget);
            } else if (Array.isArray(current.sections)) {
              current.sections.forEach(sec => {
                if (Array.isArray(sec.cards)) {
                  const cIdx = sec.cards.findIndex(c => c.id === card.id);
                  if (cIdx >= 0) sec.cards[cIdx] = res.widget;
                }
              });
              this.updateCardElementInDom(res.widget);
            }
          }
        }
      } catch (err) {
        console.warn(`[Client Trigger] Server trigger dispatch error for ${card.id}:`, err);
      }
    }

    // 2. If card modal preview is open, execute locally for instant modal live preview feedback
    if (this.activeCardConfig && this.activeCardConfig.id === card.id) {
      this.executeLocalModalSequence(this.activeCardConfig, triggerName, payloadData);
    }
  },

  async executeLocalModalSequence(card, triggerName, payloadData = {}) {
    const automations = this.normalizeAutomations(card.automations || card.pipelines);
    const matchingRules = automations.filter(a => a.enabled !== false && a.trigger && a.trigger.type === triggerName);
    if (matchingRules.length === 0) return;

    const normalizedData = this.normalizePayload(payloadData);
    let localContext = {
      widget: { ...card },
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
            card[prop] = evaluatedVal;
            localContext.widget[prop] = evaluatedVal;
            this.updateModalLivePreview();
          }
        } else if (actionType === 'condition') {
          const condExpr = step.expression || step.expr || 'true';
          const passes = Boolean(this.evalExpression(condExpr, localContext));
          if (!passes) {
            break;
          }
        }
      }
    }
  },

  startPollingTimers() {
    this.stopPollingTimers();
  },

  stopPollingTimers() {
    if (this.activePollingTimers && this.activePollingTimers.length > 0) {
      this.activePollingTimers.forEach(id => clearInterval(id));
      this.activePollingTimers = [];
    }
  },

  destroySortables() {
    if (this.sortableInstances && this.sortableInstances.length > 0) {
      this.sortableInstances.forEach(inst => {
        try { inst.destroy(); } catch (e) { }
      });
      this.sortableInstances = [];
    }
  },

  attachCanvasInteractiveListeners(container) {
    // 1. Add Card buttons
    container.querySelectorAll('.add-card-slot').forEach(btn => {
      btn.addEventListener('click', () => {
        const secId = btn.dataset.sectionId;
        this.openCardConfigModal(secId, null);
      });
    });

    // 2. Delete Section Buttons
    container.querySelectorAll('.btn-delete-sec').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const secId = btn.dataset.sectionId;
        const current = this.getActiveDashboard();
        if (!current || !current.sections) return;
        const sec = current.sections.find(s => s.id === secId);
        if (!sec) return;

        const confirmed = confirm(`Are you sure you want to delete section "${sec.title || 'Section'}" and all cards inside it?`);
        if (!confirmed) return;

        current.sections = current.sections.filter(s => s.id !== secId);
        try {
          await api.dashboards.updateCanvas(current.id, {
            badges: current.badges || [],
            sections: current.sections || []
          });
          this.renderActiveDashboard();
        } catch (err) {
          console.error('Failed to delete section:', err);
          helpers.showToast('Failed to delete section', 'error');
        }
      });
    });

    // 3. In-place Section Title Renaming
    container.querySelectorAll('.section-title-input').forEach(input => {
      const secId = input.dataset.sectionId;
      const current = this.getActiveDashboard();
      if (!current || !current.sections) return;
      const sec = current.sections.find(s => s.id === secId);
      if (!sec) return;

      input.addEventListener('change', async () => {
        const newTitle = input.value.trim() || 'Section';
        sec.title = newTitle;
        input.value = newTitle;
        try {
          await api.dashboards.updateCanvas(current.id, {
            badges: current.badges || [],
            sections: current.sections || []
          });
        } catch (err) {
          console.error('Failed to save section title:', err);
          helpers.showToast('Failed to save section title', 'error');
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          input.blur();
        }
      });

      input.addEventListener('click', (e) => e.stopPropagation());
    });

    // 4. Add Section Banner
    const btnAddSec = document.getElementById('btn-add-section-banner');
    if (btnAddSec) {
      btnAddSec.addEventListener('click', () => this.handleAddSectionDirect());
    }

    // 5. Attach Card Listeners
    const current = this.getActiveDashboard();
    if (current && current.sections) {
      current.sections.forEach(sec => {
        (sec.cards || []).forEach(card => {
          const cardEl = container.querySelector(`.ha-card[data-card-id="${card.id}"]`);
          if (cardEl) {
            this.attachCardInteractiveListeners(cardEl, card, sec.id);
          }
        });
      });
    }

    // 6. Initialize Drag and Drop Sortables
    this.initSortableDragAndDrop(container);
  },

  async handleAddSectionDirect() {
    const current = this.getActiveDashboard();
    if (!current) return;
    if (!current.sections) current.sections = [];

    const newSec = {
      id: `section_${Date.now()}`,
      title: 'New Section',
      cards: []
    };
    current.sections.push(newSec);

    try {
      await api.dashboards.updateCanvas(current.id, {
        badges: current.badges || [],
        sections: current.sections || []
      });
      this.renderActiveDashboard();
      setTimeout(() => {
        const newInput = document.querySelector(`.ha-section[data-section-id="${newSec.id}"] .section-title-input`);
        if (newInput) {
          newInput.focus();
          newInput.select();
        }
      }, 50);
    } catch (err) {
      console.error('Failed to add section:', err);
      helpers.showToast(err.message || 'Failed to add section', 'error');
    }
  },

  initSortableDragAndDrop(container) {
    if (typeof Sortable === 'undefined') return;

    // Sortables MUST ONLY be active in Edit Mode and if user has manage permissions
    const canManage = this.canManageDashboards();
    if (!this.isEditMode || !canManage) {
      this.destroySortables();
      return;
    }

    // 1. SECTION REORDERING
    const sectionsContainer = container.querySelector('.sections-container');
    if (sectionsContainer) {
      const secSortable = new Sortable(sectionsContainer, {
        handle: '.section-tab-handle',
        draggable: '.ha-section',
        animation: 200,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        ghostClass: 'ha-section-ghost',
        chosenClass: 'ha-section-chosen',
        dragClass: 'ha-section-drag',
        onEnd: async () => {
          const current = this.getActiveDashboard();
          if (!current || !current.sections) return;

          const domSectionIds = Array.from(sectionsContainer.querySelectorAll('.ha-section'))
            .map(el => el.dataset.sectionId)
            .filter(Boolean);

          const newSectionsList = [];
          domSectionIds.forEach(id => {
            const sec = current.sections.find(s => s.id === id);
            if (sec) newSectionsList.push(sec);
          });

          current.sections.forEach(s => {
            if (!newSectionsList.some(ns => ns.id === s.id)) newSectionsList.push(s);
          });

          current.sections = newSectionsList;

          try {
            await api.dashboards.updateCanvas(current.id, {
              badges: current.badges || [],
              sections: current.sections || []
            });
          } catch (err) {
            console.error('Failed to save section order:', err);
          }
        }
      });
      this.sortableInstances.push(secSortable);
    }

    // 2. CARD REORDERING
    const cardGrids = container.querySelectorAll('.cards-grid');
    cardGrids.forEach(grid => {
      const cardSortable = new Sortable(grid, {
        group: 'lovelace-dashboard-cards',
        draggable: '.ha-card',
        filter: '.add-card-slot, .card-edit-btn, .ha-toggle-switch, .tile-slider-track, .step-btn',
        preventOnFilter: false,
        animation: 200,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        ghostClass: 'ha-card-ghost',
        chosenClass: 'ha-card-chosen',
        dragClass: 'ha-card-drag',
        swapThreshold: 0.65,
        invertSwap: true,
        emptyInsertThreshold: 25,
        onStart: (evt) => {
          const cols = evt.item.dataset.cols || '6';
          const rows = evt.item.dataset.rows || '1';
          const ghost = document.querySelector('.ha-card-ghost');
          if (ghost) {
            ghost.style.setProperty('grid-column', `span ${cols}`, 'important');
            ghost.style.setProperty('grid-row', `span ${rows}`, 'important');
          }
        },
        onMove: (evt) => {
          if (evt.related && evt.related.classList.contains('add-card-slot')) {
            return false;
          }
        },
        onEnd: async (evt) => {
          const current = this.getActiveDashboard();
          if (!current || !current.sections) return;

          const cols = evt.item.dataset.cols || '6';
          const rows = evt.item.dataset.rows || '1';
          evt.item.style.setProperty('grid-column', `span ${cols}`, 'important');
          evt.item.style.setProperty('grid-row', `span ${rows}`, 'important');

          const cardMap = new Map();
          current.sections.forEach(sec => {
            (sec.cards || []).forEach(c => cardMap.set(c.id, c));
          });

          current.sections.forEach(sec => {
            const secGrid = container.querySelector(`#grid_${sec.id}`);
            if (secGrid) {
              const domCardIds = Array.from(secGrid.querySelectorAll('.ha-card'))
                .map(cEl => cEl.dataset.cardId)
                .filter(Boolean);

              sec.cards = domCardIds.map(id => cardMap.get(id)).filter(Boolean);
            }
          });

          try {
            await api.dashboards.updateCanvas(current.id, {
              badges: current.badges || [],
              sections: current.sections || []
            });
            helpers.showToast('Card moved', 'info');
          } catch (err) {
            console.error('Failed to save card position:', err);
          }
        }
      });
      this.sortableInstances.push(cardSortable);
    });

    // 3. BADGE REORDERING
    const badgesRow = document.getElementById('dashboard-badges-row');
    if (badgesRow) {
      const badgeSortable = new Sortable(badgesRow, {
        group: 'lovelace-dashboard-badges',
        draggable: '.ha-badge',
        filter: '.add-badge-btn, .badge-edit-overlay',
        preventOnFilter: false,
        animation: 200,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        ghostClass: 'ha-badge-ghost',
        chosenClass: 'ha-badge-chosen',
        dragClass: 'ha-badge-drag',
        swapThreshold: 0.65,
        invertSwap: true,
        onMove: (evt) => {
          if (evt.related && evt.related.classList.contains('add-badge-btn')) {
            return false;
          }
        },
        onEnd: async () => {
          const current = this.getActiveDashboard();
          if (!current || !current.badges) return;

          const badgeMap = new Map();
          (current.badges || []).forEach(b => badgeMap.set(b.id, b));

          const domBadgeIds = Array.from(badgesRow.querySelectorAll('.ha-badge'))
            .map(bEl => bEl.dataset.badgeId)
            .filter(Boolean);

          const newBadgesList = domBadgeIds.map(id => badgeMap.get(id)).filter(Boolean);

          current.badges.forEach(b => {
            if (!newBadgesList.some(nb => nb.id === b.id)) newBadgesList.push(b);
          });

          current.badges = newBadgesList;

          try {
            await api.dashboards.updateCanvas(current.id, {
              badges: current.badges || [],
              sections: current.sections || []
            });
            helpers.showToast('Badge reordered', 'info');
          } catch (err) {
            console.error('Failed to save badge order:', err);
          }
        }
      });
      this.sortableInstances.push(badgeSortable);
    }
  },

  attachCardInteractiveListeners(cardEl, card, sectionId) {
    if (!cardEl) return;
    const p = this.evaluateCardProperties(card);
    const canManage = this.canManageDashboards();

    // Edit Mode Overlays
    const btnEdit = cardEl.querySelector('.btn-edit-card');
    if (btnEdit) {
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.isEditMode || !canManage) return;
        this.openCardConfigModal(sectionId, card.id);
      });
    }

    const btnDup = cardEl.querySelector('.btn-duplicate-card');
    if (btnDup) {
      btnDup.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.isEditMode || !canManage) return;
        this.duplicateCard(sectionId, card.id);
      });
    }

    const btnDel = cardEl.querySelector('.btn-delete-card');
    if (btnDel) {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.isEditMode || !canManage) return;
        this.deleteCard(sectionId, card.id);
      });
    }

    // If disabled, skip interactive control handlers
    if (!p.enabled) return;

    // 1. Button / Tile Tap Action
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('.card-edit-overlay') || this.isEditMode || !p.enabled) return;
      // If clicking toggle switch, fader track, or stepper buttons, let their dedicated handlers process
      if (e.target.closest('.ha-toggle-switch') || e.target.closest('.tile-slider-track') || e.target.closest('.step-btn')) return;
      this.executeTrigger(card, 'onTap', { widget: p });
    });

    // 2. Toggle Switch Action
    if (p.type === 'toggle') {
      const toggleSwitch = cardEl.querySelector('.ha-toggle-switch');
      if (toggleSwitch) {
        toggleSwitch.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (this.isEditMode || !p.enabled) return;

          const isCurrentlyOn = card.state === true || String(card.state).toLowerCase() === 'on' || String(card.state).toLowerCase() === 'true';
          const willBeOn = !isCurrentlyOn;

          card.state = willBeOn ? 'on' : 'off';
          this.updateCardElementInDom(card);

          const triggerName = willBeOn ? 'onToggleOn' : 'onToggleOff';
          await this.executeTrigger(card, triggerName, { state: card.state });
        });
      }
    }

    // 3. Slider / Fader Action Track
    if (p.type === 'slider') {
      const track = cardEl.querySelector('.tile-slider-track');
      const fill = cardEl.querySelector('.tile-slider-fill');
      const thumb = cardEl.querySelector('.tile-slider-handle');

      if (track) {
        let isDragging = false;
        let lastCalcVal = Number(card.value !== undefined ? card.value : (p.value !== undefined ? p.value : 0));

        const getPointerClientX = (evt) => {
          if (evt.touches && evt.touches.length > 0) return evt.touches[0].clientX;
          if (evt.changedTouches && evt.changedTouches.length > 0) return evt.changedTouches[0].clientX;
          return evt.clientX;
        };

        const updateSliderFromEvent = (evt) => {
          const rect = track.getBoundingClientRect();
          if (rect.width <= 0) return { pos: 0, calcVal: lastCalcVal };

          const clientX = getPointerClientX(evt);
          if (clientX === undefined || isNaN(clientX)) return { pos: 0, calcVal: lastCalcVal };

          const rawPos = (clientX - rect.left) / rect.width;
          const pos = Math.max(0, Math.min(1, rawPos));
          const min = Number(p.min) || 0;
          const max = Number(p.max) || 100;
          const step = Number(p.step_value || card.step_value || card.step) || 1;

          let calcVal = min + pos * (max - min);
          calcVal = Math.round(calcVal / step) * step;
          calcVal = Math.max(min, Math.min(max, Math.round(calcVal * 100) / 100));
          lastCalcVal = calcVal;

          const pct = Math.max(0, Math.min(100, ((calcVal - min) / (max - min || 1)) * 100));
          if (fill) fill.style.width = `${pct}%`;
          if (thumb) thumb.style.left = `${pct}%`;

          return { pos, calcVal, pct };
        };

        const onEnd = (evt) => {
          if (!isDragging) return;
          isDragging = false;
          const res = updateSliderFromEvent(evt);
          card.value = res.calcVal;
          this.updateCardElementInDom(card);
          this.executeTrigger(card, 'onChange', { value: res.calcVal, val: res.calcVal });
        };

        const onStart = (e) => {
          if (this.isEditMode || !p.enabled) return;
          e.stopPropagation();
          isDragging = true;
          updateSliderFromEvent(e);

          const moveHandler = (moveEvt) => {
            if (isDragging) {
              if (moveEvt.cancelable) moveEvt.preventDefault();
              updateSliderFromEvent(moveEvt);
            }
          };

          const upHandler = (upEvt) => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', upHandler);
            document.removeEventListener('touchcancel', upHandler);
            onEnd(upEvt);
          };

          document.addEventListener('mousemove', moveHandler, { passive: false });
          document.addEventListener('mouseup', upHandler);
          document.addEventListener('touchmove', moveHandler, { passive: false });
          document.addEventListener('touchend', upHandler);
          document.addEventListener('touchcancel', upHandler);
        };

        track.addEventListener('mousedown', onStart);
        track.addEventListener('touchstart', onStart, { passive: true });
      }
    }

    // 4. Stepper Controls
    if (p.type === 'stepper') {
      const btnDown = cardEl.querySelector('.btn-step-down');
      const btnUp = cardEl.querySelector('.btn-step-up');
      const stateEl = cardEl.querySelector('.stepper-val');

      const handleStep = (delta) => {
        if (this.isEditMode || !p.enabled) return;
        const step = Number(p.step_value) || 1;
        const min = Number(p.min) || -99999;
        const max = Number(p.max) || 99999;
        const currentVal = Number(card.value !== undefined ? card.value : 0);
        const nextVal = Math.max(min, Math.min(max, Math.round((currentVal + (delta * step)) * 100) / 100));

        card.value = nextVal;
        this.updateCardElementInDom(card);
        this.executeTrigger(card, 'onChange', { value: nextVal });
      };

      if (btnDown) btnDown.addEventListener('click', (e) => { e.stopPropagation(); handleStep(-1); });
      if (btnUp) btnUp.addEventListener('click', (e) => { e.stopPropagation(); handleStep(1); });
    }
  },

  // ================= CARD & BADGE CONFIGURATION MODAL (4 TABS) =================
  openCardConfigModal(sectionId, cardId = null, isBadge = false) {
    this.activeIsBadge = Boolean(isBadge);
    this.activeCardSectionId = sectionId;
    const current = this.getActiveDashboard();
    if (!current) return;

    let card = null;
    if (this.activeIsBadge) {
      card = cardId ? (current.badges || []).find(b => b.id === cardId) : null;
      if (!card) {
        card = JSON.parse(JSON.stringify(this.cardSchemas.badge.defaults));
        card.id = `badge_${Date.now()}`;
      }
      card.type = 'badge';
    } else {
      const sec = (current.sections || []).find(s => s.id === sectionId);
      card = cardId && sec ? (sec.cards || []).find(c => c.id === cardId) : null;
      if (!card) {
        card = JSON.parse(JSON.stringify(this.cardSchemas.button.defaults));
        card.id = `card_${Date.now()}`;
      }
      if (card.type === 'badge') card.type = 'button';
    }

    // Clone draft and normalize
    this.activeCardConfig = JSON.parse(JSON.stringify(card));
    this.activeCardConfig.type = this.activeIsBadge ? 'badge' : this.normalizeCardType(this.activeCardConfig.type);
    this.activeCardConfig.automations = this.normalizeAutomations(this.activeCardConfig.automations || this.activeCardConfig.pipelines);

    this.isCodeEditorMode = false;
    this.activeModalTab = 'properties';

    // Populate Fields
    const modalPrefix = this.activeIsBadge ? 'Status Pill Badge' : 'Card';
    document.getElementById('card-config-modal-title').textContent = `Configure ${modalPrefix}: ${card.label || card.display || card.name || 'Untitled'}`;
    document.getElementById('card-cfg-id').value = card.id;
    document.getElementById('card-cfg-section-id').value = sectionId || '';

    // Show or hide Card Type selector group for badges vs. cards
    const groupType = document.getElementById('group-cfg-type');
    if (groupType) {
      groupType.style.display = this.activeIsBadge ? 'none' : 'block';
    }

    // Hide or show Layout tab for badges
    const tabLayoutBtn = document.querySelector('#card-config-tabs [data-tab="layout"]');
    if (tabLayoutBtn) {
      tabLayoutBtn.style.display = this.activeIsBadge ? 'none' : 'inline-flex';
    }

    // Configure delete button in modal footer
    const btnDeleteModal = document.getElementById('btn-delete-card-modal');
    if (btnDeleteModal) {
      if (cardId) {
        btnDeleteModal.style.display = 'inline-flex';
        btnDeleteModal.textContent = this.activeIsBadge ? 'Delete Status Pill' : 'Delete Card';
      } else {
        btnDeleteModal.style.display = 'none';
      }
    }

    this.syncDraftToForm();
    this.renderAutomationsList();
    this.update12x4MatrixGrid();
    this.updateYamlCodeEditor();
    this.updateModalLivePreview();
    this.switchCardConfigTab('properties');

    helpers.openModal('modal-configure-card');
  },

  switchCardConfigTab(tab) {
    this.activeModalTab = tab;
    document.querySelectorAll('#card-config-tabs .lovelace-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.lovelace-modal-body-split .lovelace-tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `tab-pane-${tab}`);
    });
  },

  normalizeAutomations(rawAutomations) {
    if (!rawAutomations) return [];
    if (Array.isArray(rawAutomations)) {
      return rawAutomations.map((a, idx) => ({
        id: a.id || `auto_${Date.now()}_${idx}`,
        name: a.name || `Automation #${idx + 1}`,
        enabled: a.enabled !== undefined ? Boolean(a.enabled) : true,
        isExpanded: a.isExpanded !== undefined ? Boolean(a.isExpanded) : true,
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
          isExpanded: true,
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
          isExpanded: true,
          trigger: { type: 'onPolling', url, interval },
          actions
        });
      } else if (Array.isArray(val)) {
        rules.push({
          id: `auto_migrated_${idx++}`,
          name: `On ${key}`,
          enabled: true,
          isExpanded: true,
          trigger: { type: key, infoKey: '', url: '', interval: 1.0 },
          actions: val
        });
      }
    }
    return rules;
  },

  bindCardConfigFormEvents() {
    const fields = [
      'card-cfg-type', 'card-cfg-label', 'card-cfg-subtitle', 'card-cfg-icon',
      'card-cfg-color', 'card-cfg-color-picker', 'card-cfg-enabled', 'card-cfg-alert-on', 'card-cfg-state',
      'card-cfg-value', 'card-cfg-min', 'card-cfg-max', 'card-cfg-step-value',
      'card-cfg-display', 'card-cfg-new-data', 'card-cfg-graph-length', 'card-cfg-data'
    ];

    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.syncFormToDraft());
        el.addEventListener('change', () => this.syncFormToDraft());
      }
    });

    // Card Type Selector Change
    const typeSel = document.getElementById('card-cfg-type');
    if (typeSel) {
      typeSel.addEventListener('change', () => {
        if (this.activeIsBadge) return;
        const newType = this.normalizeCardType(typeSel.value);
        if (this.activeCardConfig && this.activeCardConfig.type !== newType) {
          this.activeCardConfig.type = newType;
          if (newType === 'alert') {
            this.activeCardConfig.alert_on = true;
            if (!this.activeCardConfig.automations || this.activeCardConfig.automations.length === 0 || (this.activeCardConfig.automations.length === 1 && this.activeCardConfig.automations[0].id === 'auto_tap_1')) {
              this.activeCardConfig.automations = JSON.parse(JSON.stringify(this.cardSchemas.alert.defaults.automations));
            }
          }
          this.togglePropertySections(newType);
          this.renderAutomationsList();
          this.updateModalLivePreview();
          this.updateYamlCodeEditor();
        }
      });
    }

    // Color picker synchronization
    const colorPicker = document.getElementById('card-cfg-color-picker');
    const colorInput = document.getElementById('card-cfg-color');
    if (colorPicker && colorInput) {
      colorPicker.addEventListener('input', () => {
        colorInput.value = colorPicker.value;
        this.syncFormToDraft();
      });
      colorInput.addEventListener('input', () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(colorInput.value)) {
          colorPicker.value = colorInput.value;
        }
        this.syncFormToDraft();
      });
    }

    // Column & Row Sliders
    const colSlider = document.getElementById('card-cfg-colspan');
    const rowSlider = document.getElementById('card-cfg-rowspan');
    if (colSlider) {
      colSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        document.getElementById('card-cfg-colspan-pill').textContent = `${val} cols`;
        if (this.activeCardConfig) {
          this.activeCardConfig.cols = val;
          this.activeCardConfig.colSpan = val;
        }
        this.update12x4MatrixGrid();
        this.updateModalLivePreview();
        this.updateYamlCodeEditor();
      });
    }

    if (rowSlider) {
      rowSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        document.getElementById('card-cfg-rowspan-pill').textContent = `${val} rows`;
        if (this.activeCardConfig) {
          this.activeCardConfig.rows = val;
          this.activeCardConfig.rowSpan = val;
        }
        this.update12x4MatrixGrid();
        this.updateModalLivePreview();
        this.updateYamlCodeEditor();
      });
    }

    // Add Macro Rule Buttons
    const btnAddMacroTop = document.getElementById('btn-add-macro-rule');
    if (btnAddMacroTop) {
      btnAddMacroTop.addEventListener('click', (e) => {
        e.preventDefault();
        this.addAutomationMacro();
      });
    }

    const btnAddMacroBottom = document.getElementById('btn-add-macro-rule-bottom');
    if (btnAddMacroBottom) {
      btnAddMacroBottom.addEventListener('click', (e) => {
        e.preventDefault();
        this.addAutomationMacro();
      });
    }

    // YAML / Code Format Button
    const btnFormat = document.getElementById('btn-format-card-code');
    if (btnFormat) {
      btnFormat.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          const editor = document.getElementById('card-cfg-yaml-editor');
          const parsed = JSON.parse(editor.value);
          editor.value = JSON.stringify(parsed, null, 2);
        } catch (err) {
          helpers.showToast('Invalid JSON schema', 'warning');
        }
      });
    }

    // YAML Code Editor Direct Typing Sync
    const yamlEditor = document.getElementById('card-cfg-yaml-editor');
    if (yamlEditor) {
      yamlEditor.addEventListener('input', () => {
        try {
          const parsed = JSON.parse(yamlEditor.value);
          this.activeCardConfig = parsed;
          this.activeCardConfig.automations = this.normalizeAutomations(this.activeCardConfig.automations);
          this.syncDraftToForm();
          this.renderAutomationsList();
          this.updateModalLivePreview();
        } catch (e) { }
      });
    }

    // Delete Widget / Badge Button in Modal
    const btnDeleteModal = document.getElementById('btn-delete-card-modal');
    if (btnDeleteModal) {
      btnDeleteModal.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.activeCardConfig) return;
        if (this.activeIsBadge) {
          this.handleDeleteBadge(this.activeCardConfig.id);
        } else {
          this.deleteCard(this.activeCardSectionId, this.activeCardConfig.id);
        }
      });
    }

    // Save Card Config Button
    const btnSaveCard = document.getElementById('btn-save-card-config');
    if (btnSaveCard) {
      btnSaveCard.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSaveCardConfig();
      });
    }
  },

  syncFormToDraft() {
    if (!this.activeCardConfig) return;

    const type = this.activeIsBadge ? 'badge' : this.normalizeCardType(document.getElementById('card-cfg-type').value);
    const oldType = this.activeCardConfig.type;
    this.activeCardConfig.type = type;

    if (type !== oldType) {
      if (type === 'alert') {
        this.activeCardConfig.alert_on = true;
        if (!this.activeCardConfig.automations || this.activeCardConfig.automations.length === 0 || (this.activeCardConfig.automations.length === 1 && (this.activeCardConfig.automations[0].id === 'auto_tap_1' || this.activeCardConfig.automations[0].name === 'On Tap Feedback'))) {
          this.activeCardConfig.automations = JSON.parse(JSON.stringify(this.cardSchemas.alert.defaults.automations));
        }
      }
      this.renderAutomationsList();
    }

    this.activeCardConfig.label = document.getElementById('card-cfg-label').value;
    this.activeCardConfig.name = this.activeCardConfig.label;
    this.activeCardConfig.title = this.activeCardConfig.label;
    this.activeCardConfig.subtitle = document.getElementById('card-cfg-subtitle').value;
    this.activeCardConfig.icon = document.getElementById('card-cfg-icon').value;
    this.activeCardConfig.color = document.getElementById('card-cfg-color').value;
    this.activeCardConfig.enabled = document.getElementById('card-cfg-enabled').checked;

    const alertOnEl = document.getElementById('card-cfg-alert-on');
    if (alertOnEl) {
      this.activeCardConfig.alert_on = alertOnEl.checked;
    }

    const valEl = document.getElementById('card-cfg-value');
    if (valEl && valEl.value !== '') {
      this.activeCardConfig.value = Number(valEl.value) || 0;
    }
    const minEl = document.getElementById('card-cfg-min');
    if (minEl && minEl.value !== '') {
      this.activeCardConfig.min = Number(minEl.value) || 0;
    }
    const maxEl = document.getElementById('card-cfg-max');
    if (maxEl && maxEl.value !== '') {
      this.activeCardConfig.max = Number(maxEl.value) || 100;
    }
    const stepEl = document.getElementById('card-cfg-step-value');
    if (stepEl && stepEl.value !== '') {
      this.activeCardConfig.step_value = Number(stepEl.value) || 1;
    }
    const stateEl = document.getElementById('card-cfg-state');
    if (stateEl) {
      this.activeCardConfig.state = stateEl.value;
    }
    const displayEl = document.getElementById('card-cfg-display');
    if (displayEl) {
      this.activeCardConfig.display = displayEl.value;
    }

    if (type === 'graph') {
      const rawNew = document.getElementById('card-cfg-new-data').value;
      if (rawNew !== '') this.activeCardConfig.new_data = Number(rawNew);
      this.activeCardConfig.graph_length = Number(document.getElementById('card-cfg-graph-length').value) || 20;
      const rawData = document.getElementById('card-cfg-data').value.trim();
      if (rawData) {
        try {
          this.activeCardConfig.data = JSON.parse(rawData);
        } catch (e) {
          this.activeCardConfig.data = rawData.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
        }
      }
    }

    this.togglePropertySections(type);
    this.updateModalLivePreview();
    this.updateYamlCodeEditor();
  },

  syncDraftToForm() {
    if (!this.activeCardConfig) return;
    const card = this.activeCardConfig;
    const type = this.activeIsBadge ? 'badge' : this.normalizeCardType(card.type);

    if (!this.activeIsBadge) {
      document.getElementById('card-cfg-type').value = type;
    }
    document.getElementById('card-cfg-label').value = card.label !== undefined ? card.label : (card.name || card.title || '');
    document.getElementById('card-cfg-subtitle').value = card.subtitle || '';
    document.getElementById('card-cfg-icon').value = card.icon || '💡';

    const color = card.color || card.accentColor || '#38bdf8';
    document.getElementById('card-cfg-color').value = color;
    const colorPicker = document.getElementById('card-cfg-color-picker');
    if (colorPicker && /^#[0-9A-Fa-f]{6}$/.test(color)) colorPicker.value = color;

    document.getElementById('card-cfg-enabled').checked = card.enabled !== undefined ? Boolean(card.enabled) : true;

    // Alert
    const alertOnEl = document.getElementById('card-cfg-alert-on');
    if (alertOnEl) {
      alertOnEl.checked = card.alert_on !== undefined ? Boolean(card.alert_on) : true;
    }

    // Toggle
    document.getElementById('card-cfg-state').value = (card.state === true || card.state === 'on') ? 'on' : 'off';

    // Numeric
    document.getElementById('card-cfg-value').value = card.value !== undefined ? card.value : (card.val !== undefined ? card.val : 50);
    document.getElementById('card-cfg-min').value = card.min !== undefined ? card.min : 0;
    document.getElementById('card-cfg-max').value = card.max !== undefined ? card.max : 100;
    document.getElementById('card-cfg-step-value').value = card.step_value !== undefined ? card.step_value : (card.step || 1);

    // Display / Graph
    document.getElementById('card-cfg-display').value = card.display || card.state || '';
    document.getElementById('card-cfg-new-data').value = card.new_data !== undefined ? card.new_data : '';
    document.getElementById('card-cfg-graph-length').value = card.graph_length || 20;
    document.getElementById('card-cfg-data').value = Array.isArray(card.data) ? JSON.stringify(card.data) : (card.data || '');

    // Layout
    const cols = Number(card.cols || card.colSpan || 6);
    const rows = Number(card.rows || card.rowSpan || 1);
    document.getElementById('card-cfg-colspan').value = cols;
    document.getElementById('card-cfg-colspan-pill').textContent = `${cols} cols`;
    document.getElementById('card-cfg-rowspan').value = rows;
    document.getElementById('card-cfg-rowspan-pill').textContent = `${rows} rows`;

    this.togglePropertySections(type);
  },

  togglePropertySections(type) {
    const isBadge = type === 'badge';
    const secToggle = document.getElementById('prop-section-toggle');
    const secNumeric = document.getElementById('prop-section-numeric');
    const secStepper = document.getElementById('prop-section-stepper');
    const secGraph = document.getElementById('prop-section-graph');
    const secDisplay = document.getElementById('prop-section-display');
    const secAlert = document.getElementById('prop-section-alert');
    const groupSubtitle = document.getElementById('group-cfg-subtitle');
    const groupEnabled = document.getElementById('group-cfg-enabled');

    if (groupSubtitle) groupSubtitle.style.display = isBadge ? 'none' : 'block';
    if (groupEnabled) groupEnabled.style.display = isBadge ? 'none' : 'block';

    if (secDisplay) secDisplay.style.display = (isBadge || type === 'graph') ? 'block' : 'none';
    if (secAlert) secAlert.style.display = type === 'alert' ? 'block' : 'none';
    if (secToggle) secToggle.style.display = type === 'toggle' ? 'block' : 'none';
    if (secNumeric) secNumeric.style.display = ['slider', 'stepper', 'progress', 'gauge'].includes(type) ? 'block' : 'none';
    if (secStepper) secStepper.style.display = type === 'stepper' ? 'block' : 'none';
    if (secGraph) secGraph.style.display = type === 'graph' ? 'block' : 'none';
  },

  renderAutomationsList() {
    const container = document.getElementById('card-automations-list');
    if (!container || !this.activeCardConfig) return;

    this.activeCardConfig.automations = this.normalizeAutomations(this.activeCardConfig.automations);
    const automations = this.activeCardConfig.automations;

    if (automations.length === 0) {
      container.innerHTML = `
        <div class="macro-empty-placeholder">
          <div style="font-size: 1.5rem; margin-bottom: 6px;">⚡</div>
          <div>No automations configured for this widget yet.</div>
          <div style="font-size: 0.75rem; color: var(--ha-text-muted); margin-top: 4px;">Click <strong>+ Add Automation</strong> to create a rule.</div>
        </div>
      `;
      return;
    }

    const cardType = this.activeIsBadge ? 'badge' : this.normalizeCardType(this.activeCardConfig.type);
    const schema = this.cardSchemas[cardType] || this.cardSchemas.button;
    const availableTriggers = schema.triggers || ['onTap', 'onInfo', 'onPolling'];
    const availableProperties = schema.properties || ['label', 'icon', 'display', 'color'];

    const triggerLabels = {
      onTap: 'onTap (Triggered on click/press)',
      onToggleOn: 'onToggleOn (Triggered when turned ON)',
      onToggleOff: 'onToggleOff (Triggered when turned OFF)',
      onChange: 'onChange (Triggered on value change)',
      onInfo: 'onInfo (/info subscription POST)',
      onPolling: 'onPolling (HTTP Polling GET)'
    };

    container.innerHTML = automations.map((macro, macroIdx) => {
      const isExpanded = macro.isExpanded !== false;
      const isEnabled = macro.enabled !== false;
      const trigger = macro.trigger || { type: 'onTap' };
      const triggerType = trigger.type || 'onTap';
      const actions = Array.isArray(macro.actions) ? macro.actions : [];

      let triggerExtraHtml = '';
      if (triggerType === 'onInfo') {
        triggerExtraHtml = `
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.75rem;">Subscribed <code>/info/:key</code> Channel</label>
            <input type="text" class="form-control macro-infokey-input" data-macro-idx="${macroIdx}" placeholder="e.g. tablets/stage_left or audio/dsp_main" value="${helpers.escapeHtml(trigger.infoKey || '')}" style="font-family: var(--font-mono); font-size: 0.825rem;">
            <small class="form-text-muted" style="font-size: 0.7rem;">Triggered automatically when <code>POST /info/${helpers.escapeHtml(trigger.infoKey || '<key>')}</code> is received.</small>
          </div>
        `;
      } else if (triggerType === 'onPolling') {
        triggerExtraHtml = `
          <div class="form-row" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0;">
            <div class="form-group" style="flex: 1; min-width: 180px; margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.75rem;">HTTP Polling URL</label>
              <input type="text" class="form-control macro-polling-url" data-macro-idx="${macroIdx}" placeholder="https://api.example.com/status" value="${helpers.escapeHtml(trigger.url || '')}" style="font-family: var(--font-mono); font-size: 0.825rem;">
            </div>
            <div class="form-group" style="width: 130px; margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.75rem;">Interval (Sec)</label>
              <input type="number" class="form-control macro-polling-interval" data-macro-idx="${macroIdx}" min="0.1" max="3600" step="0.1" value="${trigger.interval !== undefined ? trigger.interval : 1.0}" style="font-family: var(--font-mono); font-size: 0.825rem;">
            </div>
          </div>
        `;
      }

      // Render Steps List HTML
      let stepsListHtml = '';
      if (actions.length === 0) {
        stepsListHtml = `<div class="macro-steps-empty">No action steps in this automation. Use buttons below to add steps.</div>`;
      } else {
        stepsListHtml = actions.map((step, stepIdx) => {
          const type = step.type || step.action || 'set_property';
          let stepFieldsHtml = '';

          if (type === 'delay') {
            stepFieldsHtml = `
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.75rem;">Wait Seconds (Decimals allowed, e.g. 0.5)</label>
                <input type="number" class="form-control macro-step-delay-sec" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}" value="${step.seconds !== undefined ? step.seconds : 0.5}" step="0.1" min="0.1" style="width: 130px; font-size: 0.825rem;">
              </div>
            `;
          } else if (type === 'set_property') {
            const currentProp = step.property || step.key || availableProperties[0] || 'label';
            const isColorProp = currentProp === 'color';
            let rawVal = step.value !== undefined ? String(step.value) : '';
            let hexColor = '#38bdf8';
            if (rawVal.includes('#')) {
              const match = rawVal.match(/#[0-9A-Fa-f]{6}/);
              if (match) hexColor = match[0];
            }

            const propOptions = availableProperties.map(p => `<option value="${p}" ${currentProp === p ? 'selected' : ''}>${p}</option>`).join('');
            stepFieldsHtml = `
              <div class="step-prop-row">
                <div class="step-prop-col">
                  <label class="form-label" style="font-size: 0.75rem;">Target Property</label>
                  <select class="form-control form-select macro-step-prop-select" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}" style="font-size: 0.825rem;">
                    ${propOptions}
                  </select>
                </div>
                <div class="step-value-col">
                  <label class="form-label" style="font-size: 0.75rem;">New Value Expression (Supports JS string formatting)</label>
                  <div style="display: flex; gap: 0.4rem; align-items: center;">
                    ${isColorProp ? `<input type="color" class="macro-step-color-picker" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}" value="${hexColor}" title="Choose color" style="width: 34px; height: 32px; padding: 1px; border: 1px solid var(--ha-border); border-radius: 4px; background: transparent; cursor: pointer;">` : ''}
                    <input type="text" class="form-control macro-step-prop-value" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}" placeholder='e.g. ${isColorProp ? '"#00ff00"' : `\${widget.value} + "%"`}' value="${helpers.escapeHtml(rawVal)}" style="flex: 1; font-size: 0.825rem; font-family: var(--font-mono);">
                  </div>
                </div>
              </div>
            `;
          } else if (type === 'webhook') {
            stepFieldsHtml = `
              <div class="form-row" style="display: flex; gap: 0.5rem; margin-bottom: 0.4rem;">
                <select class="form-control form-select macro-step-webhook-method" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}" style="width: 90px; font-size: 0.825rem;">
                  <option value="GET" ${(step.method || 'GET') === 'GET' ? 'selected' : ''}>GET</option>
                  <option value="POST" ${step.method === 'POST' ? 'selected' : ''}>POST</option>
                  <option value="PUT" ${step.method === 'PUT' ? 'selected' : ''}>PUT</option>
                  <option value="DELETE" ${step.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                </select>
                <input type="text" class="form-control macro-step-webhook-url" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}" placeholder="https://api.example.com/status" value="${helpers.escapeHtml(step.url || '')}" style="flex: 1; font-size: 0.825rem; font-family: var(--font-mono);">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <input type="text" class="form-control macro-step-webhook-body" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}" placeholder='Optional Body JSON (e.g. {"level": "\${widget.value}"})' value="${helpers.escapeHtml(step.body || step.payload || '')}" style="font-size: 0.825rem; font-family: var(--font-mono);">
              </div>
            `;
          } else if (type === 'condition') {
            stepFieldsHtml = `
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.75rem;">If Condition Expression <span style="color: #c084fc;">(Halts this automation if FALSE)</span></label>
                <input type="text" class="form-control macro-step-condition-expr" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}" placeholder="e.g. data.battery < 20 || widget.value >= 100" value="${helpers.escapeHtml(step.expression || step.expr || '')}" style="font-size: 0.825rem; font-family: var(--font-mono); color: #c084fc;">
              </div>
            `;
          }

          return `
            <div class="pipeline-step-item" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}">
              <div class="pipeline-step-header">
                <div class="pipeline-step-left">
                  <span class="pipeline-drag-handle" title="Drag to reorder">⋮⋮</span>
                  <span class="pipeline-step-type-badge badge-${type}">${type.replace('_', ' ')}</span>
                </div>
                <div class="pipeline-step-actions">
                  <button type="button" class="pipeline-step-btn btn-remove-macro-step" data-macro-idx="${macroIdx}" data-step-idx="${stepIdx}" title="Remove Step">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
              ${stepFieldsHtml}
            </div>
          `;
        }).join('');
      }

      return `
        <div class="macro-rule-card ${isExpanded ? 'is-expanded' : ''} ${isEnabled ? '' : 'is-disabled'}" data-macro-idx="${macroIdx}">
          <div class="macro-rule-header" data-macro-idx="${macroIdx}">
            <div class="macro-rule-header-left">
              <span class="macro-expand-btn" title="${isExpanded ? 'Collapse Rule' : 'Expand Rule'}">
                <svg class="macro-expand-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
              <div class="macro-rule-title-group">
                <div class="macro-rule-title-row">
                  <input type="text" class="macro-name-input" data-macro-idx="${macroIdx}" value="${helpers.escapeHtml(macro.name || `Automation #${macroIdx + 1}`)}" size="${Math.max(1, (macro.name || `Automation #${macroIdx + 1}`).length)}" placeholder="Automation Name" title="Click to rename automation">
                </div>
                <div class="macro-rule-badges-row">
                  <span class="macro-trigger-badge badge-${triggerType}">${triggerType}</span>
                  <span class="macro-actions-count">${actions.length} step${actions.length === 1 ? '' : 's'}</span>
                </div>
              </div>
            </div>
            <div class="macro-rule-header-right">
              <label class="custom-checkbox-wrapper macro-toggle-wrapper" title="Enable / Disable Rule">
                <input type="checkbox" class="macro-toggle-enabled" data-macro-idx="${macroIdx}" ${isEnabled ? 'checked' : ''}>
                <div class="custom-check-box">
                  <svg class="custom-check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </label>
              <button type="button" class="macro-icon-btn btn-clone-macro" data-macro-idx="${macroIdx}" title="Duplicate Rule">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button type="button" class="macro-icon-btn btn-delete-macro" data-macro-idx="${macroIdx}" title="Delete Rule">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </div>

          <div class="macro-rule-body" style="display: ${isExpanded ? 'flex' : 'none'};">
            <!-- TRIGGER SECTION -->
            <div class="macro-block-section">
              <div class="macro-block-title">⚡ Trigger Event</div>
              <div class="macro-trigger-box">
                <div class="form-group" style="margin-bottom: ${triggerExtraHtml ? '8px' : '0'};">
                  <label class="form-label" style="font-size: 0.75rem;">Trigger When</label>
                  <select class="form-control form-select macro-trigger-select" data-macro-idx="${macroIdx}">
                    ${availableTriggers.map(t => `<option value="${t}" ${t === triggerType ? 'selected' : ''}>${triggerLabels[t] || t}</option>`).join('')}
                  </select>
                </div>
                ${triggerExtraHtml}
              </div>
            </div>

            <!-- ACTIONS SECTION -->
            <div class="macro-block-section">
              <div class="macro-block-title">⚙️ Actions (Executed Sequentially)</div>
              <div class="pipeline-steps-list macro-steps-list" data-macro-idx="${macroIdx}">
                ${stepsListHtml}
              </div>

              <!-- ADD STEP TOOLBAR -->
              <div class="macro-actions-toolbar">
                <span class="macro-actions-toolbar-label">Add Step:</span>
                <div class="macro-actions-buttons-grid">
                  <button type="button" class="macro-add-step-btn btn-add-step" data-macro-idx="${macroIdx}" data-step-type="set_property">
                    <span class="step-btn-emoji">🏷️</span> Set Property
                  </button>
                  <button type="button" class="macro-add-step-btn btn-add-step" data-macro-idx="${macroIdx}" data-step-type="webhook">
                    <span class="step-btn-emoji">🌐</span> Webhook
                  </button>
                  <button type="button" class="macro-add-step-btn btn-add-step" data-macro-idx="${macroIdx}" data-step-type="delay">
                    <span class="step-btn-emoji">⏱️</span> Delay
                  </button>
                  <button type="button" class="macro-add-step-btn btn-add-step" data-macro-idx="${macroIdx}" data-step-type="condition">
                    <span class="step-btn-emoji">🔀</span> Condition
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach Event Listeners
    this.bindAutomationsListEvents(container);
  },

  bindAutomationsListEvents(container) {
    if (!container || !this.activeCardConfig) return;
    const automations = this.activeCardConfig.automations;

    // Header Expand / Collapse toggle (except when clicking input, checkbox or buttons)
    container.querySelectorAll('.macro-rule-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.macro-name-input') || e.target.closest('.custom-checkbox-wrapper') || e.target.closest('.macro-toggle-wrapper') || e.target.closest('.macro-icon-btn')) {
          return;
        }
        const idx = Number(header.dataset.macroIdx);
        if (automations[idx]) {
          automations[idx].isExpanded = !(automations[idx].isExpanded !== false);
          this.renderAutomationsList();
        }
      });
    });

    // Rename Macro
    container.querySelectorAll('.macro-name-input').forEach(input => {
      input.addEventListener('input', (e) => {
        input.size = Math.max(1, (e.target.value || '').length || 1);
        const idx = Number(input.dataset.macroIdx);
        if (automations[idx]) {
          automations[idx].name = e.target.value;
          this.updateYamlCodeEditor();
        }
      });
      input.addEventListener('click', (e) => e.stopPropagation());
    });

    // Enable / Disable Macro toggle
    container.querySelectorAll('.macro-toggle-enabled').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        e.stopPropagation();
        const idx = Number(toggle.dataset.macroIdx);
        if (automations[idx]) {
          automations[idx].enabled = toggle.checked;
          const cardEl = container.querySelector(`.macro-rule-card[data-macro-idx="${idx}"]`);
          if (cardEl) cardEl.classList.toggle('is-disabled', !toggle.checked);
          this.updateYamlCodeEditor();
        }
      });
    });

    // Clone Macro
    container.querySelectorAll('.btn-clone-macro').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.macroIdx);
        this.duplicateAutomationMacro(idx);
      });
    });

    // Delete Macro
    container.querySelectorAll('.btn-delete-macro').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.macroIdx);
        this.deleteAutomationMacro(idx);
      });
    });

    // Trigger Type change
    container.querySelectorAll('.macro-trigger-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = Number(sel.dataset.macroIdx);
        if (automations[idx]) {
          if (!automations[idx].trigger) automations[idx].trigger = {};
          automations[idx].trigger.type = e.target.value;
          this.renderAutomationsList();
          this.updateYamlCodeEditor();
        }
      });
    });

    // InfoKey input
    container.querySelectorAll('.macro-infokey-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(input.dataset.macroIdx);
        if (automations[idx] && automations[idx].trigger) {
          automations[idx].trigger.infoKey = e.target.value.trim();
          this.updateYamlCodeEditor();
        }
      });
    });

    // Polling URL & Interval inputs
    container.querySelectorAll('.macro-polling-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(input.dataset.macroIdx);
        if (automations[idx] && automations[idx].trigger) {
          automations[idx].trigger.url = e.target.value.trim();
          this.updateYamlCodeEditor();
        }
      });
    });

    container.querySelectorAll('.macro-polling-interval').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(input.dataset.macroIdx);
        if (automations[idx] && automations[idx].trigger) {
          automations[idx].trigger.interval = parseFloat(e.target.value) || 1.0;
          this.updateYamlCodeEditor();
        }
      });
    });

    // Add Step toolbar buttons
    container.querySelectorAll('.btn-add-step').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const macroIdx = Number(btn.dataset.macroIdx);
        const stepType = btn.dataset.stepType;
        this.addActionStepToMacro(macroIdx, stepType);
      });
    });

    // Remove Step button
    container.querySelectorAll('.btn-remove-macro-step').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const macroIdx = Number(btn.dataset.macroIdx);
        const stepIdx = Number(btn.dataset.stepIdx);
        if (automations[macroIdx] && Array.isArray(automations[macroIdx].actions)) {
          automations[macroIdx].actions.splice(stepIdx, 1);
          this.renderAutomationsList();
          this.updateYamlCodeEditor();
        }
      });
    });

    // Step input change handlers
    container.querySelectorAll('.macro-step-delay-sec').forEach(input => {
      input.addEventListener('input', (e) => {
        const macroIdx = Number(input.dataset.macroIdx);
        const stepIdx = Number(input.dataset.stepIdx);
        if (automations[macroIdx]?.actions?.[stepIdx]) {
          automations[macroIdx].actions[stepIdx].seconds = parseFloat(e.target.value) || 0.5;
          this.updateYamlCodeEditor();
        }
      });
    });

    container.querySelectorAll('.macro-step-prop-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const macroIdx = Number(sel.dataset.macroIdx);
        const stepIdx = Number(sel.dataset.stepIdx);
        if (automations[macroIdx]?.actions?.[stepIdx]) {
          automations[macroIdx].actions[stepIdx].property = e.target.value;
          if (e.target.value === 'color' && (!automations[macroIdx].actions[stepIdx].value || automations[macroIdx].actions[stepIdx].value === '""')) {
            automations[macroIdx].actions[stepIdx].value = '"#38bdf8"';
          }
          this.renderAutomationsList();
          this.updateYamlCodeEditor();
        }
      });
    });

    container.querySelectorAll('.macro-step-color-picker').forEach(picker => {
      picker.addEventListener('input', (e) => {
        const macroIdx = Number(picker.dataset.macroIdx);
        const stepIdx = Number(picker.dataset.stepIdx);
        const hexVal = e.target.value;
        const formattedVal = `"${hexVal}"`;
        if (automations[macroIdx]?.actions?.[stepIdx]) {
          automations[macroIdx].actions[stepIdx].value = formattedVal;
          const valInput = container.querySelector(`.macro-step-prop-value[data-macro-idx="${macroIdx}"][data-step-idx="${stepIdx}"]`);
          if (valInput) valInput.value = formattedVal;
          this.updateYamlCodeEditor();
        }
      });
    });

    container.querySelectorAll('.macro-step-prop-value').forEach(input => {
      input.addEventListener('input', (e) => {
        const macroIdx = Number(input.dataset.macroIdx);
        const stepIdx = Number(input.dataset.stepIdx);
        if (automations[macroIdx]?.actions?.[stepIdx]) {
          automations[macroIdx].actions[stepIdx].value = e.target.value;
          this.updateYamlCodeEditor();
        }
      });
    });

    container.querySelectorAll('.macro-step-webhook-method').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const macroIdx = Number(sel.dataset.macroIdx);
        const stepIdx = Number(sel.dataset.stepIdx);
        if (automations[macroIdx]?.actions?.[stepIdx]) {
          automations[macroIdx].actions[stepIdx].method = e.target.value;
          this.updateYamlCodeEditor();
        }
      });
    });

    container.querySelectorAll('.macro-step-webhook-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const macroIdx = Number(input.dataset.macroIdx);
        const stepIdx = Number(input.dataset.stepIdx);
        if (automations[macroIdx]?.actions?.[stepIdx]) {
          automations[macroIdx].actions[stepIdx].url = e.target.value;
          this.updateYamlCodeEditor();
        }
      });
    });

    container.querySelectorAll('.macro-step-webhook-body').forEach(input => {
      input.addEventListener('input', (e) => {
        const macroIdx = Number(input.dataset.macroIdx);
        const stepIdx = Number(input.dataset.stepIdx);
        if (automations[macroIdx]?.actions?.[stepIdx]) {
          automations[macroIdx].actions[stepIdx].body = e.target.value;
          this.updateYamlCodeEditor();
        }
      });
    });

    container.querySelectorAll('.macro-step-condition-expr').forEach(input => {
      input.addEventListener('input', (e) => {
        const macroIdx = Number(input.dataset.macroIdx);
        const stepIdx = Number(input.dataset.stepIdx);
        if (automations[macroIdx]?.actions?.[stepIdx]) {
          automations[macroIdx].actions[stepIdx].expression = e.target.value;
          this.updateYamlCodeEditor();
        }
      });
    });

    // Initialize Sortable for each macro's steps
    this.initMacroStepsSortables(container);
  },

  initMacroStepsSortables(container) {
    if (!container || typeof Sortable === 'undefined') return;

    if (!this.macroSortableInstances) this.macroSortableInstances = [];
    this.macroSortableInstances.forEach(inst => {
      try { inst.destroy(); } catch (e) {}
    });
    this.macroSortableInstances = [];

    container.querySelectorAll('.macro-steps-list').forEach(listEl => {
      const macroIdx = Number(listEl.dataset.macroIdx);
      const inst = new Sortable(listEl, {
        handle: '.pipeline-drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: (evt) => {
          if (evt.oldIndex === evt.newIndex) return;
          const acts = this.activeCardConfig?.automations?.[macroIdx]?.actions;
          if (acts && acts.length > 0) {
            const movedItem = acts.splice(evt.oldIndex, 1)[0];
            acts.splice(evt.newIndex, 0, movedItem);
            this.renderAutomationsList();
            this.updateYamlCodeEditor();
          }
        }
      });
      this.macroSortableInstances.push(inst);
    });
  },

  addAutomationMacro() {
    if (!this.activeCardConfig) return;
    if (!Array.isArray(this.activeCardConfig.automations)) {
      this.activeCardConfig.automations = [];
    }

    const cardType = this.activeIsBadge ? 'badge' : this.normalizeCardType(this.activeCardConfig.type);
    const schema = this.cardSchemas[cardType] || this.cardSchemas.button;
    const defaultTrigger = (schema.triggers && schema.triggers[0]) || 'onTap';

    const newMacro = {
      id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: `Automation #${this.activeCardConfig.automations.length + 1}`,
      enabled: true,
      isExpanded: true,
      trigger: {
        type: defaultTrigger,
        infoKey: '',
        url: '',
        interval: 1.0
      },
      actions: []
    };

    this.activeCardConfig.automations.push(newMacro);
    this.renderAutomationsList();
    this.updateYamlCodeEditor();
  },

  duplicateAutomationMacro(idx) {
    if (!this.activeCardConfig || !Array.isArray(this.activeCardConfig.automations)) return;
    const target = this.activeCardConfig.automations[idx];
    if (!target) return;

    const clone = JSON.parse(JSON.stringify(target));
    clone.id = `auto_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    clone.name = `${target.name || 'Automation'} (Copy)`;
    clone.isExpanded = true;

    this.activeCardConfig.automations.splice(idx + 1, 0, clone);
    this.renderAutomationsList();
    this.updateYamlCodeEditor();
  },

  deleteAutomationMacro(idx) {
    if (!this.activeCardConfig || !Array.isArray(this.activeCardConfig.automations)) return;
    this.activeCardConfig.automations.splice(idx, 1);
    this.renderAutomationsList();
    this.updateYamlCodeEditor();
  },

  addActionStepToMacro(macroIdx, actionType = 'set_property') {
    if (!this.activeCardConfig || !Array.isArray(this.activeCardConfig.automations)) return;
    const macro = this.activeCardConfig.automations[macroIdx];
    if (!macro) return;
    if (!Array.isArray(macro.actions)) macro.actions = [];

    const cardType = this.activeIsBadge ? 'badge' : this.normalizeCardType(this.activeCardConfig.type);
    const schema = this.cardSchemas[cardType] || this.cardSchemas.button;
    const defaultProp = (schema.properties && schema.properties[0]) || 'label';

    let newStep = null;
    if (actionType === 'set_property') {
      newStep = { type: 'set_property', property: defaultProp, value: '""' };
    } else if (actionType === 'delay') {
      newStep = { type: 'delay', seconds: 0.5 };
    } else if (actionType === 'webhook') {
      newStep = { type: 'webhook', method: 'GET', url: 'https://api.example.com/status', body: '' };
    } else if (actionType === 'condition') {
      newStep = { type: 'condition', expression: 'data.battery !== undefined' };
    }

    if (newStep) {
      macro.actions.push(newStep);
      this.renderAutomationsList();
      this.updateYamlCodeEditor();
    }
  },

  update12x4MatrixGrid() {
    const grid = document.getElementById('card-layout-matrix-grid');
    if (!grid || !this.activeCardConfig) return;

    const cols = Number(this.activeCardConfig.cols || this.activeCardConfig.colSpan || 6);
    const rows = Number(this.activeCardConfig.rows || this.activeCardConfig.rowSpan || 1);

    let cellsHtml = '';
    for (let r = 1; r <= 4; r++) {
      for (let c = 1; c <= 12; c++) {
        const isSelected = c <= cols && r <= rows;
        cellsHtml += `<div class="matrix-cell ${isSelected ? 'selected' : ''}" data-c="${c}" data-r="${r}" title="${c} cols x ${r} rows"></div>`;
      }
    }
    grid.innerHTML = cellsHtml;

    grid.querySelectorAll('.matrix-cell').forEach(cell => {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', (e) => {
        e.preventDefault();
        const c = Number(cell.dataset.c);
        const r = Number(cell.dataset.r);

        const colSlider = document.getElementById('card-cfg-colspan');
        const rowSlider = document.getElementById('card-cfg-rowspan');
        if (colSlider) colSlider.value = c;
        if (rowSlider) rowSlider.value = r;

        document.getElementById('card-cfg-colspan-pill').textContent = `${c} cols`;
        document.getElementById('card-cfg-rowspan-pill').textContent = `${r} rows`;

        this.activeCardConfig.cols = c;
        this.activeCardConfig.colSpan = c;
        this.activeCardConfig.rows = r;
        this.activeCardConfig.rowSpan = r;

        this.update12x4MatrixGrid();
        this.updateModalLivePreview();
        this.updateYamlCodeEditor();
      });
    });
  },

  updateModalLivePreview() {
    const mount = document.getElementById('card-preview-live-mount');
    if (!mount || !this.activeCardConfig) return;
    mount.innerHTML = this.renderCardHtml(this.activeCardConfig, 'preview_section', true);
  },

  updateYamlCodeEditor() {
    const editor = document.getElementById('card-cfg-yaml-editor');
    if (editor && this.activeCardConfig) {
      editor.value = JSON.stringify(this.activeCardConfig, null, 2);
    }
  },

  // ================= SAVE CARD & BADGE CONFIGURATION =================
  async handleSaveCardConfig() {
    const current = this.getActiveDashboard();
    if (!current || !this.activeCardConfig) return;

    if (this.activeIsBadge) {
      if (!current.badges) current.badges = [];
      const badgeIdx = current.badges.findIndex(b => b.id === this.activeCardConfig.id);
      if (badgeIdx !== -1) {
        current.badges[badgeIdx] = this.activeCardConfig;
      } else {
        current.badges.push(this.activeCardConfig);
      }

      try {
        await api.dashboards.updateCanvas(current.id, {
          badges: current.badges || [],
          sections: current.sections || []
        });

        helpers.closeModal('modal-configure-card');
        this.renderActiveDashboard();
      } catch (err) {
        console.error('Failed to save badge canvas:', err);
        helpers.showToast(err.message || 'Failed to save badge.', 'error');
      }
      return;
    }

    if (!this.activeCardSectionId) return;

    const sec = (current.sections || []).find(s => s.id === this.activeCardSectionId);
    if (!sec) {
      helpers.showToast('Target section not found', 'error');
      return;
    }

    // Ensure cols and rows are synced
    const cols = Number(document.getElementById('card-cfg-colspan').value) || (this.activeCardConfig.cols || 6);
    const rows = Number(document.getElementById('card-cfg-rowspan').value) || (this.activeCardConfig.rows || 1);
    this.activeCardConfig.cols = cols;
    this.activeCardConfig.colSpan = cols;
    this.activeCardConfig.rows = rows;
    this.activeCardConfig.rowSpan = rows;

    if (!sec.cards) sec.cards = [];
    const cardIdx = sec.cards.findIndex(c => c.id === this.activeCardConfig.id);
    if (cardIdx !== -1) {
      sec.cards[cardIdx] = this.activeCardConfig;
    } else {
      sec.cards.push(this.activeCardConfig);
    }

    try {
      await api.dashboards.updateCanvas(current.id, {
        badges: current.badges || [],
        sections: current.sections || []
      });

      helpers.closeModal('modal-configure-card');
      this.renderActiveDashboard();
    } catch (err) {
      console.error('Failed to save card canvas:', err);
      helpers.showToast(err.message || 'Failed to save card.', 'error');
    }
  },

  async duplicateCard(sectionId, cardId) {
    const current = this.getActiveDashboard();
    if (!current) return;

    const sec = (current.sections || []).find(s => s.id === sectionId);
    if (!sec) return;

    const card = (sec.cards || []).find(c => c.id === cardId);
    if (!card) return;

    const clone = JSON.parse(JSON.stringify(card));
    clone.id = `card_${Date.now()}`;
    clone.label = `${card.label || card.name || 'Card'} (Copy)`;
    clone.name = clone.label;
    clone.title = clone.label;
    sec.cards.push(clone);

    try {
      await api.dashboards.updateCanvas(current.id, {
        badges: current.badges || [],
        sections: current.sections || []
      });
      this.renderActiveDashboard();
    } catch (err) {
      helpers.showToast('Failed to duplicate card', 'error');
    }
  },

  async deleteCard(sectionId, cardId) {
    const current = this.getActiveDashboard();
    if (!current) return;

    if (this.activeIsBadge || !sectionId) {
      return this.handleDeleteBadge(cardId);
    }

    const sec = (current.sections || []).find(s => s.id === sectionId);
    if (!sec) return;

    const confirmed = confirm('Are you sure you want to delete this card?');
    if (!confirmed) return;

    sec.cards = (sec.cards || []).filter(c => c.id !== cardId);

    try {
      await api.dashboards.updateCanvas(current.id, {
        badges: current.badges || [],
        sections: current.sections || []
      });
      helpers.closeModal('modal-configure-card');
      this.renderActiveDashboard();
    } catch (err) {
      helpers.showToast('Failed to delete card', 'error');
    }
  },

  // ================= BADGE MODAL & ACTIONS =================
  openBadgeModal(badgeId = null) {
    this.openCardConfigModal(null, badgeId, true);
  },

  async handleDeleteBadge(badgeId = null) {
    const current = this.getActiveDashboard();
    if (!current) return;

    const id = badgeId || document.getElementById('card-cfg-id')?.value;
    if (!id) return;

    const confirmed = confirm('Are you sure you want to delete this status pill badge?');
    if (!confirmed) return;

    current.badges = (current.badges || []).filter(b => b.id !== id);

    try {
      await api.dashboards.updateCanvas(current.id, {
        badges: current.badges || [],
        sections: current.sections || []
      });
      helpers.closeModal('modal-configure-card');
      this.renderActiveDashboard();
    } catch (err) {
      helpers.showToast('Failed to delete status pill badge', 'error');
    }
  },

  // ================= EXPORT & IMPORT DASHBOARD =================
  exportDashboard() {
    if (!this.canManageDashboards()) {
      helpers.showToast('You do not have permission to export dashboards.', 'warning');
      return;
    }

    const current = this.getActiveDashboard();
    if (!current) {
      helpers.showToast('No active dashboard to export', 'warning');
      return;
    }

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      dashboard: {
        name: current.name || 'Dashboard',
        description: current.description || '',
        color_code: current.color_code || '#58a6ff',
        allowed_roles: current.allowed_roles || ['*'],
        badges: current.badges || [],
        sections: current.sections || []
      }
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (current.name || 'dashboard').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}_dashboard.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async handleImportFile(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parsed.dashboard || parsed;

      if (!data || (!Array.isArray(data.sections) && !Array.isArray(data.badges) && !data.name)) {
        helpers.showToast('Invalid dashboard JSON format', 'error');
        return;
      }

      const createRes = await api.dashboards.create({
        name: data.name ? `${data.name} (Imported)` : `Imported Dashboard (${file.name.replace('.json', '')})`,
        description: data.description || '',
        color_code: data.color_code || '#58a6ff',
        allowed_roles: Array.isArray(data.allowed_roles) ? data.allowed_roles : ['*']
      });

      const targetDashboardId = createRes.dashboard.id;
      await api.dashboards.updateCanvas(targetDashboardId, {
        badges: Array.isArray(data.badges) ? data.badges : [],
        sections: Array.isArray(data.sections) ? data.sections : []
      });

      await this.loadDashboards(targetDashboardId);
    } catch (err) {
      console.error('Failed to import dashboard:', err);
      helpers.showToast('Failed to parse or import dashboard file: ' + err.message, 'error');
    } finally {
      const fileInput = document.getElementById('input-import-dashboard-file');
      if (fileInput) fileInput.value = '';
    }
  },

  // ================= SWITCHER & DASHBOARD MANAGEMENT =================
  toggleDropdown() {
    if (this.dashboards.length === 0) return;
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  },

  openDropdown() {
    if (this.dashboards.length === 0) return;
    this.isDropdownOpen = true;
    const btn = document.getElementById('btn-dashboard-switcher');
    const menu = document.getElementById('dashboard-dropdown-menu');
    const searchInput = document.getElementById('input-search-dashboards');

    if (btn) btn.classList.add('active');
    if (menu) menu.classList.add('open');

    this.renderDropdownList();

    if (searchInput) {
      setTimeout(() => searchInput.focus(), 50);
    }
  },

  closeDropdown() {
    this.isDropdownOpen = false;
    const btn = document.getElementById('btn-dashboard-switcher');
    const menu = document.getElementById('dashboard-dropdown-menu');
    if (btn) btn.classList.remove('active');
    if (menu) menu.classList.remove('open');
  },

  renderDropdownList() {
    const listContainer = document.getElementById('dashboard-dropdown-list');
    if (!listContainer) return;

    const filtered = this.dashboards.filter(d => {
      if (!this.searchTerm) return true;
      const matchName = (d.name || '').toLowerCase().includes(this.searchTerm);
      const matchDesc = (d.description || '').toLowerCase().includes(this.searchTerm);
      return matchName || matchDesc;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="dashboard-empty-search">
          No dashboards match "<strong>${helpers.escapeHtml(this.searchTerm)}</strong>"
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(d => {
      const isActive = d.id === this.activeDashboardId;
      const color = d.color_code || '#58a6ff';
      const desc = (d.description || '').trim();
      const descHtml = desc ? `<span class="dashboard-item-desc" title="${helpers.escapeHtml(desc)}">${helpers.escapeHtml(desc)}</span>` : '';

      return `
        <div class="dashboard-dropdown-item ${isActive ? 'active' : ''}" data-dash-id="${d.id}" style="border-left: 3px solid ${color};">
          <div class="dashboard-item-left">
            <span class="dashboard-item-dot" style="background-color: ${color}; box-shadow: 0 0 6px ${color};"></span>
            <div class="dashboard-item-info">
              <span class="dashboard-item-title">${helpers.escapeHtml(d.name || 'Untitled')}</span>
              ${descHtml}
            </div>
          </div>
          <svg class="dashboard-item-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.dashboard-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const dashId = item.dataset.dashId;
        this.selectDashboard(dashId);
      });
    });
  },

  selectDashboard(dashId) {
    this.activeDashboardId = dashId;
    this.renderActiveDashboard();
    this.renderDropdownList();
    this.closeDropdown();
  },

  // ================= CREATE DASHBOARD MODAL =================
  async openCreateModal() {
    await this.loadRoles();

    const inputName = document.getElementById('create-dash-name');
    const inputDesc = document.getElementById('create-dash-description');
    const inputHex = document.getElementById('create-dash-color-hex');
    const previewBox = document.getElementById('create-dash-color-preview');
    const allRolesCheck = document.getElementById('create-dash-all-roles-check');
    const rolesContainer = document.getElementById('create-dash-roles-container');

    if (inputName) inputName.value = '';
    if (inputDesc) inputDesc.value = '';
    const defaultColor = '#4986e7';
    if (inputHex) inputHex.value = defaultColor;
    if (previewBox) previewBox.style.backgroundColor = defaultColor;
    if (allRolesCheck) allRolesCheck.checked = true;
    if (rolesContainer) rolesContainer.style.display = 'none';

    this.renderColorSwatches('create', defaultColor);
    this.renderRoleCheckboxes('create', []);

    helpers.openModal('modal-create-dashboard');
    if (inputName) setTimeout(() => inputName.focus(), 100);
  },

  async handleCreateSubmit() {
    const inputName = document.getElementById('create-dash-name');
    const inputDesc = document.getElementById('create-dash-description');
    const inputHex = document.getElementById('create-dash-color-hex');
    const allRolesCheck = document.getElementById('create-dash-all-roles-check');
    const rolesContainer = document.getElementById('create-dash-roles-container');

    const name = inputName ? inputName.value.trim() : '';
    if (!name) {
      helpers.showToast('Please enter a dashboard title.', 'warning');
      if (inputName) inputName.focus();
      return;
    }

    const description = inputDesc ? inputDesc.value.trim() : '';
    const color_code = inputHex ? inputHex.value.trim() : '#4986e7';
    let allowed_roles = ['*'];

    if (allRolesCheck && !allRolesCheck.checked && rolesContainer) {
      allowed_roles = Array.from(rolesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
      if (allowed_roles.length === 0) {
        helpers.showToast('Please select at least one authorized role or allow all roles.', 'warning');
        return;
      }
    }

    try {
      const res = await api.dashboards.create({ name, description, color_code, allowed_roles });
      helpers.closeModal('modal-create-dashboard');
      await this.loadDashboards(res.dashboard.id);
    } catch (err) {
      helpers.showToast(err.message || 'Failed to create dashboard.', 'error');
    }
  },

  // ================= SETTINGS DASHBOARD MODAL =================
  async openSettingsModal() {
    const current = this.getActiveDashboard();
    if (!current) {
      helpers.showToast('No active dashboard to configure.', 'warning');
      return;
    }

    await this.loadRoles();

    const inputId = document.getElementById('settings-dash-id');
    const inputName = document.getElementById('settings-dash-name');
    const inputDesc = document.getElementById('settings-dash-description');
    const inputHex = document.getElementById('settings-dash-color-hex');
    const previewBox = document.getElementById('settings-dash-color-preview');
    const allRolesCheck = document.getElementById('settings-dash-all-roles-check');
    const rolesContainer = document.getElementById('settings-dash-roles-container');

    if (inputId) inputId.value = current.id;
    if (inputName) inputName.value = current.name || '';
    if (inputDesc) inputDesc.value = current.description || '';

    const color = current.color_code || '#4986e7';
    if (inputHex) inputHex.value = color;
    if (previewBox) previewBox.style.backgroundColor = color;

    const isAllRoles = !current.allowed_roles || current.allowed_roles.includes('*');
    if (allRolesCheck) allRolesCheck.checked = isAllRoles;
    if (rolesContainer) rolesContainer.style.display = isAllRoles ? 'none' : 'flex';

    this.renderColorSwatches('settings', color);
    this.renderRoleCheckboxes('settings', current.allowed_roles || []);

    helpers.openModal('modal-dashboard-settings');
  },

  async handleSettingsSubmit() {
    const inputId = document.getElementById('settings-dash-id');
    const inputName = document.getElementById('settings-dash-name');
    const inputDesc = document.getElementById('settings-dash-description');
    const inputHex = document.getElementById('settings-dash-color-hex');
    const allRolesCheck = document.getElementById('settings-dash-all-roles-check');
    const rolesContainer = document.getElementById('settings-dash-roles-container');

    const id = inputId ? inputId.value : null;
    if (!id) return;

    const name = inputName ? inputName.value.trim() : '';
    if (!name) {
      helpers.showToast('Dashboard title cannot be empty.', 'warning');
      if (inputName) inputName.focus();
      return;
    }

    const description = inputDesc ? inputDesc.value.trim() : '';
    const color_code = inputHex ? inputHex.value.trim() : '#4986e7';
    let allowed_roles = ['*'];

    if (allRolesCheck && !allRolesCheck.checked && rolesContainer) {
      allowed_roles = Array.from(rolesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
      if (allowed_roles.length === 0) {
        helpers.showToast('Please select at least one authorized role or allow all roles.', 'warning');
        return;
      }
    }

    try {
      await api.dashboards.update(id, { name, description, color_code, allowed_roles });
      helpers.closeModal('modal-dashboard-settings');
      await this.loadDashboards(id);
    } catch (err) {
      helpers.showToast(err.message || 'Failed to update dashboard.', 'error');
    }
  },

  async handleDeleteDashboard() {
    const current = this.getActiveDashboard();
    if (!current) return;

    if (this.dashboards.length <= 1) {
      helpers.showToast('Cannot delete the only remaining dashboard.', 'warning');
      return;
    }

    const confirmed = confirm(`Are you sure you want to delete the dashboard "${current.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await api.dashboards.delete(current.id);
      helpers.closeModal('modal-dashboard-settings');
      await this.loadDashboards();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to delete dashboard.', 'error');
    }
  },

  renderColorSwatches(prefix, activeColor) {
    const grid = document.getElementById(`${prefix}-dash-color-swatches`);
    const inputHex = document.getElementById(`${prefix}-dash-color-hex`);
    const previewBox = document.getElementById(`${prefix}-dash-color-preview`);

    if (!grid) return;

    grid.innerHTML = this.presetColors.map(color => {
      const isSelected = color.toLowerCase() === (activeColor || '').toLowerCase();
      return `
        <button type="button" class="color-swatch-btn ${isSelected ? 'selected' : ''}" data-color="${color}" style="background-color: ${color}; color: ${color};" title="${color}">
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const selectedColor = btn.dataset.color;
        grid.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (inputHex) inputHex.value = selectedColor;
        if (previewBox) previewBox.style.backgroundColor = selectedColor;
      });
    });

    if (inputHex) {
      inputHex.oninput = () => {
        const hex = inputHex.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          if (previewBox) previewBox.style.backgroundColor = hex;
          grid.querySelectorAll('.color-swatch-btn').forEach(b => {
            b.classList.toggle('selected', b.dataset.color.toLowerCase() === hex.toLowerCase());
          });
        }
      };
    }
  },

  renderRoleCheckboxes(prefix, selectedRoleIds) {
    const container = document.getElementById(`${prefix}-dash-roles-container`);
    if (!container) return;

    if (this.roles.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 0.5rem;">No roles configured.</div>';
      return;
    }

    const selectedSet = new Set(selectedRoleIds);

    container.innerHTML = this.roles.map(role => {
      const isChecked = selectedSet.has(role.id) || selectedSet.has('*');
      const badgeStyle = `background: ${role.color_hex}22; color: ${role.color_hex}; border: 1px solid ${role.color_hex}55;`;

      return `
        <div class="role-checkbox-item">
          <label class="role-checkbox-label">
            <div class="custom-checkbox-wrapper">
              <input type="checkbox" value="${role.id}" ${isChecked ? 'checked' : ''}>
              <span class="custom-check-box">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
            </div>
            <span class="badge user-role-badge" style="${badgeStyle}">${helpers.escapeHtml(role.name)}</span>
          </label>
        </div>
      `;
    }).join('');
  }
};

window.dashboardView = dashboardView;
