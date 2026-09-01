// Overhauled Audit Log & Retention View Controller
// Minimalist, User-Friendly 5-Column Grid with Heroicons & Settings Modal

const HEROICONS = {
  folder: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  lock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  user: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  shield: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  checkCircle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  document: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  bolt: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  dashboard: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  mic: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  cog: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
};

const CATEGORY_DEFINITIONS = [
  { code: 'ALL', label: 'All Categories', iconSvg: HEROICONS.folder },
  { code: 'AUTH', label: 'Authentication', iconSvg: HEROICONS.lock },
  { code: 'ACCOUNT', label: 'Account Management', iconSvg: HEROICONS.user },
  { code: 'ROLE', label: 'Roles & Hierarchy', iconSvg: HEROICONS.shield },
  { code: 'CHECKLIST', label: 'Checklists', iconSvg: HEROICONS.checkCircle },
  { code: 'TEMPLATE', label: 'Templates', iconSvg: HEROICONS.document },
  { code: 'AUTOMATION', label: 'Automation', iconSvg: HEROICONS.bolt },
  { code: 'DASHBOARD', label: 'Dashboards', iconSvg: HEROICONS.dashboard },
  { code: 'SERMON_SENDER', label: 'Sermon Sender', iconSvg: HEROICONS.mic },
  { code: 'AUDIT', label: 'Audit System', iconSvg: HEROICONS.cog }
];

const auditView = {
  dayGroups: [],
  usersList: [],
  retentionDays: 30,
  
  // Filter States
  search: '',
  category: 'ALL',
  user: 'ALL',
  startDate: '',
  endDate: '',
  
  flatpickrInstance: null,
  searchDebounceTimer: null,

  init() {
    this.initFlatpickr();
    this.renderCategoryDropdownMenu();
    this.bindEvents();
  },

  initFlatpickr() {
    const dateInput = document.getElementById('audit-flatpickr-date');
    if (!dateInput || typeof flatpickr === 'undefined') return;

    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
    }

    this.flatpickrInstance = flatpickr(dateInput, {
      mode: 'range',
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'M j, Y',
      conjunction: '  ➔  ',
      disableMobile: true,
      onChange: (selectedDates) => {
        if (selectedDates.length === 1) {
          const singleDate = helpers.formatDateISO(selectedDates[0]);
          this.startDate = singleDate;
          this.endDate = singleDate;
          this.loadAuditLogs();
        } else if (selectedDates.length === 2) {
          this.startDate = helpers.formatDateISO(selectedDates[0]);
          this.endDate = helpers.formatDateISO(selectedDates[1]);
          this.loadAuditLogs();
        } else if (selectedDates.length === 0) {
          this.startDate = '';
          this.endDate = '';
          this.loadAuditLogs();
        }
      }
    });
  },

  bindEvents() {
    // 1. Global Search with Debounce
    const searchInput = document.getElementById('audit-global-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          this.search = e.target.value.trim();
          this.loadAuditLogs();
        }, 250);
      });
    }

    // 2. Dropdown Trigger Toggles
    const catBtn = document.getElementById('audit-category-btn');
    const userBtn = document.getElementById('audit-user-btn');
    const catMenu = document.getElementById('audit-category-menu');
    const userMenu = document.getElementById('audit-user-menu');

    if (catBtn && catMenu) {
      catBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = catMenu.classList.contains('show');
        this.closeAllDropdowns();
        if (!isOpen) {
          catMenu.classList.add('show');
          catBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (userBtn && userMenu) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = userMenu.classList.contains('show');
        this.closeAllDropdowns();
        if (!isOpen) {
          userMenu.classList.add('show');
          userBtn.setAttribute('aria-expanded', 'true');
          const uSearch = document.getElementById('audit-user-search-input');
          if (uSearch) {
            setTimeout(() => uSearch.focus(), 50);
          }
        }
      });
    }

    // User Search inside User Dropdown
    const userSearchInput = document.getElementById('audit-user-search-input');
    if (userSearchInput) {
      userSearchInput.addEventListener('input', (e) => {
        this.filterUserDropdownItems(e.target.value);
      });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.audit-custom-dropdown')) {
        this.closeAllDropdowns();
      }
    });

    // 3. Clear Filters Button
    const btnClear = document.getElementById('btn-clear-audit-filters');
    if (btnClear) {
      btnClear.addEventListener('click', () => this.handleClearFilters());
    }

    // 4. Settings Modal Trigger & Actions
    const btnSettings = document.getElementById('btn-audit-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        const retentionInput = document.getElementById('retention-days-input');
        if (retentionInput) retentionInput.value = this.retentionDays;
        helpers.openModal('modal-audit-settings');
      });
    }

    const btnSaveRetention = document.getElementById('btn-save-retention');
    const btnPurgeAll = document.getElementById('btn-purge-all');

    if (btnSaveRetention) {
      btnSaveRetention.addEventListener('click', () => this.handleSaveRetention());
    }
    if (btnPurgeAll) {
      btnPurgeAll.addEventListener('click', () => this.handlePurgeAll());
    }
  },

  closeAllDropdowns() {
    document.querySelectorAll('.audit-dropdown-menu').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.audit-dropdown-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  },

  renderCategoryDropdownMenu() {
    const listContainer = document.getElementById('audit-category-items-list');
    if (!listContainer) return;

    listContainer.innerHTML = CATEGORY_DEFINITIONS.map(cat => {
      const isActive = this.category === cat.code;
      return `
        <div class="audit-dropdown-item ${isActive ? 'active' : ''}" data-category="${cat.code}">
          <span class="cat-pill cat-${cat.code}">
            ${cat.iconSvg}
            <span>${cat.label}</span>
          </span>
          ${isActive ? `<span style="color:var(--accent-primary);">${HEROICONS.check}</span>` : ''}
        </div>
      `;
    }).join('');

    // Bind item click
    listContainer.querySelectorAll('.audit-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const catCode = item.getAttribute('data-category');
        this.selectCategory(catCode);
      });
    });
  },

  selectCategory(catCode) {
    this.category = catCode;
    const catDef = CATEGORY_DEFINITIONS.find(c => c.code === catCode) || CATEGORY_DEFINITIONS[0];
    
    const selectedContainer = document.getElementById('audit-category-selected');
    if (selectedContainer) {
      selectedContainer.innerHTML = `
        <span class="cat-pill cat-${catDef.code}">
          ${catDef.iconSvg}
          <span>${catDef.label}</span>
        </span>
      `;
    }

    this.renderCategoryDropdownMenu();
    this.closeAllDropdowns();
    this.loadAuditLogs();
  },

  renderUserDropdownMenu(users = []) {
    this.usersList = users;
    const listContainer = document.getElementById('audit-user-items-list');
    if (!listContainer) return;

    const allItem = `
      <div class="audit-dropdown-item ${this.user === 'ALL' ? 'active' : ''}" data-user="ALL">
        <span class="user-pill user-ALL">
          ${HEROICONS.user}
          <span>All Users</span>
        </span>
        ${this.user === 'ALL' ? `<span style="color:var(--accent-primary);">${HEROICONS.check}</span>` : ''}
      </div>
    `;

    const usersHtml = users.map(u => {
      const isActive = this.user.toLowerCase() === u.username.toLowerCase();
      const color = u.roleColor || '#8b949e';
      return `
        <div class="audit-dropdown-item ${isActive ? 'active' : ''}" data-user="${helpers.escapeHtml(u.username)}" data-name="${helpers.escapeHtml(u.username.toLowerCase())}">
          <span class="user-pill" style="color:${color}; font-weight:600;">
            ${helpers.escapeHtml(u.username)}
          </span>
          <span class="user-role-subtext">${helpers.escapeHtml(u.roleName || 'User')}</span>
          ${isActive ? `<span style="color:var(--accent-primary); margin-left:0.35rem;">${HEROICONS.check}</span>` : ''}
        </div>
      `;
    }).join('');

    listContainer.innerHTML = allItem + usersHtml;

    // Bind item click
    listContainer.querySelectorAll('.audit-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const username = item.getAttribute('data-user');
        this.selectUser(username);
      });
    });
  },

  filterUserDropdownItems(searchQuery) {
    const q = (searchQuery || '').trim().toLowerCase();
    const items = document.querySelectorAll('#audit-user-items-list .audit-dropdown-item');
    items.forEach(item => {
      const u = item.getAttribute('data-user');
      if (u === 'ALL') {
        item.style.display = q ? 'none' : 'flex';
        return;
      }
      const name = item.getAttribute('data-name') || '';
      item.style.display = name.includes(q) ? 'flex' : 'none';
    });
  },

  selectUser(username) {
    this.user = username;
    const selectedContainer = document.getElementById('audit-user-selected');
    
    if (selectedContainer) {
      if (username === 'ALL') {
        selectedContainer.innerHTML = `<span class="user-pill user-ALL">${HEROICONS.user} All Users</span>`;
      } else {
        const uInfo = this.usersList.find(u => u.username.toLowerCase() === username.toLowerCase());
        const color = uInfo ? uInfo.roleColor : '#58a6ff';
        selectedContainer.innerHTML = `
          <span class="user-pill" style="color:${color}; font-weight:600;">
            ${helpers.escapeHtml(username)}
          </span>
        `;
      }
    }

    this.renderUserDropdownMenu(this.usersList);
    this.closeAllDropdowns();
    this.loadAuditLogs();
  },

  handleClearFilters() {
    this.search = '';
    this.category = 'ALL';
    this.user = 'ALL';
    this.startDate = '';
    this.endDate = '';

    const searchInput = document.getElementById('audit-global-search');
    if (searchInput) searchInput.value = '';

    const userSearchInput = document.getElementById('audit-user-search-input');
    if (userSearchInput) userSearchInput.value = '';

    if (this.flatpickrInstance) {
      this.flatpickrInstance.clear();
    }

    const catDef = CATEGORY_DEFINITIONS[0];
    const catSelected = document.getElementById('audit-category-selected');
    if (catSelected) {
      catSelected.innerHTML = `
        <span class="cat-pill cat-${catDef.code}">
          ${catDef.iconSvg}
          <span>${catDef.label}</span>
        </span>
      `;
    }

    const userSelected = document.getElementById('audit-user-selected');
    if (userSelected) {
      userSelected.innerHTML = `<span class="user-pill user-ALL">${HEROICONS.user} All Users</span>`;
    }

    this.renderCategoryDropdownMenu();
    this.renderUserDropdownMenu(this.usersList);
    this.closeAllDropdowns();
    this.loadAuditLogs();
  },

  async loadAuditLogs() {
    try {
      const params = {
        actionType: this.category,
        user: this.user === 'ALL' ? '' : this.user,
        startDate: this.startDate,
        endDate: this.endDate,
        search: this.search
      };

      const res = await api.audit.getLogs(params);

      this.dayGroups = res.dayGroups || [];
      this.retentionDays = res.retentionDays || 30;

      if (res.users && res.users.length > 0) {
        this.renderUserDropdownMenu(res.users);
      }

      const retentionInput = document.getElementById('retention-days-input');
      if (retentionInput) retentionInput.value = this.retentionDays;

      this.renderTimeline();
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  },

  renderTimeline() {
    const container = document.getElementById('audit-timeline-container');
    if (!container) return;

    if (this.dayGroups.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted); background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-lg);">
          <div style="margin-bottom:0.75rem; color:var(--text-muted);">${HEROICONS.document}</div>
          <div style="font-size:1.05rem; font-weight:600; color:var(--text-primary); margin-bottom:0.25rem;">No audit logs found</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">Try adjusting your search criteria or resetting filters.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.dayGroups.map(group => {
      const logsHtml = group.logs.map(log => {
        const catDef = CATEGORY_DEFINITIONS.find(c => c.code === log.category) || {
          code: log.category || 'GENERAL',
          label: log.category || 'General',
          iconSvg: HEROICONS.folder
        };

        const timeString = log.formatted_time_la || (log.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) : '--:--:--');

        const actorRoleColor = log.actor_role_color || '#8b949e';
        const actorRoleName = log.actor_role_name || 'User';
        const actionTitle = log.human_action || (log.action_name ? log.action_name.replace(/_/g, ' ') : 'Action');
        const actionSummary = log.human_summary || 'Event recorded.';

        return `
          <div class="audit-grid-card">
            <!-- Column 1: Time (LA) -->
            <div class="audit-cell audit-cell-time" title="Pacific Time (America/Los_Angeles)">
              <span>${helpers.escapeHtml(timeString)}</span>
            </div>

            <!-- Column 2: Category -->
            <div class="audit-cell audit-cell-category">
              <span class="cat-pill cat-${catDef.code}">
                ${catDef.iconSvg}
                <span>${helpers.escapeHtml(catDef.label)}</span>
              </span>
            </div>

            <!-- Column 3: Who (Just Username in Role Color) -->
            <div class="audit-cell audit-cell-who" title="Role: ${helpers.escapeHtml(actorRoleName)}">
              <span class="audit-who-name" style="color:${actorRoleColor}; font-weight:600;">
                ${helpers.escapeHtml(log.username || 'System')}
              </span>
            </div>

            <!-- Column 4: Action -->
            <div class="audit-cell audit-cell-action">
              <span>${helpers.escapeHtml(actionTitle)}</span>
            </div>

            <!-- Column 5: Action Summary -->
            <div class="audit-cell audit-cell-summary">
              <span>${helpers.escapeHtml(actionSummary)}</span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="audit-day-group">
          <div class="audit-day-header">
            <div class="audit-day-label">
              ${HEROICONS.calendar}
              <span>${helpers.escapeHtml(group.dayLabel || group.dayKey)}</span>
            </div>
            <span class="audit-day-count">${group.logs.length} ${group.logs.length === 1 ? 'event' : 'events'}</span>
          </div>
          <div class="audit-log-list">
            ${logsHtml}
          </div>
        </div>
      `;
    }).join('');
  },

  async handleSaveRetention() {
    const val = document.getElementById('retention-days-input').value;
    const days = parseInt(val, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      helpers.showToast('Please enter a valid number of days (1-365).', 'error');
      return;
    }

    try {
      await api.audit.updateRetention(days);
      this.retentionDays = days;
      helpers.showToast(`Retention threshold set to ${days} days!`, 'success');
      helpers.closeModal(document.getElementById('modal-audit-settings'));
      this.loadAuditLogs();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to update retention', 'error');
    }
  },

  async handlePurgeAll() {
    if (!confirm('WARNING: This will permanently delete ALL historical audit logs. Are you absolutely sure?')) {
      return;
    }

    try {
      const res = await api.audit.purgeAll();
      helpers.showToast(`All ${res.deletedCount} audit logs have been purged.`, 'info');
      helpers.closeModal(document.getElementById('modal-audit-settings'));
      this.loadAuditLogs();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to purge logs', 'error');
    }
  }
};

window.auditView = auditView;
