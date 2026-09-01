// REST API Client Wrapper for AV Audit
const api = {
  async request(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const config = {
      method: options.method || 'GET',
      headers: Object.assign({}, defaultHeaders, options.headers || {}),
      credentials: 'include' // Send session cookies
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    } else if (options.body) {
      config.body = options.body;
    }

    try {
      const res = await fetch(endpoint, config);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const error = new Error(data.message || `Request failed with status ${res.status}`);
        error.status = res.status;
        error.code = data.error;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        // Trigger login modal or event
        window.dispatchEvent(new CustomEvent('auth_unauthorized'));
      }
      throw err;
    }
  },

  // Auth
  auth: {
    me: () => api.request('/api/auth/me'),
    getConfig: () => api.request('/api/auth/client-config'),
    login: (username, password) => api.request('/api/auth/login', { method: 'POST', body: { username, password } }),
    register: (username, password) => api.request('/api/auth/register', { method: 'POST', body: { username, password } }),
    checkStatus: (username) => api.request(`/api/auth/check-status?username=${encodeURIComponent(username)}`),
    extendSession: () => api.request('/api/auth/extend-session', { method: 'POST' }),
    changePassword: (currentPassword, newPassword) => api.request('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
    logout: () => api.request('/api/auth/logout', { method: 'POST' })
  },

  // Accounts
  accounts: {
    getPending: () => api.request('/api/accounts/pending'),
    approvePending: (id) => api.request(`/api/accounts/pending/${id}/approve`, { method: 'POST' }),
    rejectPending: (id) => api.request(`/api/accounts/pending/${id}/reject`, { method: 'POST' }),
    getDirectory: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return api.request(`/api/accounts/directory${query ? '?' + query : ''}`);
    },
    overwritePassword: (id, newPassword) => api.request(`/api/accounts/${id}/password`, { method: 'POST', body: { newPassword } }),
    toggleSuspension: (id) => api.request(`/api/accounts/${id}/toggle-suspension`, { method: 'POST' }),
    updateRoles: (id, role_ids) => api.request(`/api/accounts/${id}/roles`, { method: 'POST', body: { role_ids } }),
    delete: (id) => api.request(`/api/accounts/${id}`, { method: 'DELETE' })
  },

  // Roles
  roles: {
    getRegistry: () => api.request('/api/roles/registry'),
    getAll: () => api.request('/api/roles'),
    create: (roleData) => api.request('/api/roles', { method: 'POST', body: roleData }),
    update: (id, updates) => api.request(`/api/roles/${id}`, { method: 'PUT', body: updates }),
    delete: (id) => api.request(`/api/roles/${id}`, { method: 'DELETE' }),
    reorder: (orderedRoleIds) => api.request('/api/roles/reorder', { method: 'POST', body: { orderedRoleIds } })
  },

  // Templates
  templates: {
    getAll: () => api.request('/api/templates'),
    getById: (id) => api.request(`/api/templates/${id}`),
    create: (tmplData) => api.request('/api/templates', { method: 'POST', body: tmplData }),
    update: (id, updates) => api.request(`/api/templates/${id}`, { method: 'PUT', body: updates }),
    duplicate: (id) => api.request(`/api/templates/${id}/duplicate`, { method: 'POST' }),
    delete: (id) => api.request(`/api/templates/${id}`, { method: 'DELETE' }),
    deleteAll: () => api.request('/api/templates', { method: 'DELETE' })
  },

  // Checklists
  checklists: {
    getAll: () => api.request('/api/checklists'),
    getById: (id) => api.request(`/api/checklists/${id}`),
    getPublic: (id) => api.request(`/api/checklists/${id}/public`),
    create: (template_id, custom_title) => api.request('/api/checklists', { method: 'POST', body: { template_id, custom_title } }),
    toggleItem: (id, itemId, checked) => api.request(`/api/checklists/${id}/toggle`, { method: 'POST', body: { itemId, checked } }),
    updateNotes: (id, itemId, has_issue, issue_note) => api.request(`/api/checklists/${id}/notes`, { method: 'POST', body: { itemId, has_issue, issue_note } }),
    updateStructure: (id, items) => api.request(`/api/checklists/${id}/structure`, { method: 'PUT', body: { items } }),
    submit: (id) => api.request(`/api/checklists/${id}/submit`, { method: 'POST' }),
    unsubmit: (id) => api.request(`/api/checklists/${id}/unsubmit`, { method: 'POST' }),
    delete: (id) => api.request(`/api/checklists/${id}`, { method: 'DELETE' }),
    deleteAll: () => api.request('/api/checklists', { method: 'DELETE' })
  },

  // Automation
  automation: {
    execute: (payload) => api.request('/api/automation/execute', { method: 'POST', body: payload })
  },

  // Audit
  audit: {
    getLogs: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return api.request(`/api/audit/logs${query ? '?' + query : ''}`);
    },
    getRetention: () => api.request('/api/audit/retention'),
    updateRetention: (retention_days) => api.request('/api/audit/retention', { method: 'PUT', body: { retention_days } }),
    purgeToday: () => api.request('/api/audit/purge-today', { method: 'POST' }),
    purgeAll: () => api.request('/api/audit/purge-all', { method: 'POST' })
  },

  // Dashboards
  dashboards: {
    list: () => api.request('/api/dashboards'),
    getAll: () => api.request('/api/dashboards'),
    get: (id) => api.request(`/api/dashboards/${id}`),
    create: (data) => api.request('/api/dashboards', { method: 'POST', body: data }),
    update: (id, data) => api.request(`/api/dashboards/${id}`, { method: 'PUT', body: data }),
    updateCanvas: (id, data) => api.request(`/api/dashboards/${id}/canvas`, { method: 'PUT', body: data }),
    executeAction: (step, widgetState) => api.request('/api/dashboards/execute-action', { method: 'POST', body: { step, widgetState } }),
    triggerWidget: (dashboardId, widgetId, triggerName, payloadData = {}) => api.request(`/api/dashboards/${dashboardId}/widgets/${widgetId}/trigger`, { method: 'POST', body: { triggerName, payloadData } }),
    delete: (id) => api.request(`/api/dashboards/${id}`, { method: 'DELETE' })
  },

  // Info State Ingestion
  info: {
    getAll: () => api.request('/api/info'),
    get: (key) => api.request(`/api/info/${encodeURIComponent(key)}`),
    set: (key, data) => api.request(`/api/info/${encodeURIComponent(key)}`, { method: 'POST', body: data })
  },

  // Sermon Sender
  sermons: {
    getSettings: () => api.request('/api/sermons/settings'),
    updateSettings: (data) => api.request('/api/sermons/settings', { method: 'PUT', body: data }),
    getSubmissions: () => api.request('/api/sermons/submissions'),
    resend: (id) => api.request(`/api/sermons/${encodeURIComponent(id)}/resend`, { method: 'POST' }),
    delete: (id) => api.request(`/api/sermons/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  // System & OTA Updates
  system: {
    checkUpdate: () => api.request('/api/system/update/check'),
    applyUpdate: () => api.request('/api/system/update/apply', { method: 'POST' })
  }
};

window.api = api;
