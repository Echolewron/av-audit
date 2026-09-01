// Accounts & Users Management View Controller
// Modular, Role-Aware, Action Popup Dropdowns & Compact Pending Square Buttons

const ACCOUNT_ICONS = {
  dots: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>`,
  shield: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  key: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-1.5 1.5L14 9l-3-3-9 9v4h4l9-9 3 3 3.5-3.5"/></svg>`,
  slash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
};

const accountsView = {
  pendingUsers: [],
  users: [],
  roles: [],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const searchInput = document.getElementById('user-search-input');
    const statusFilter = document.getElementById('user-status-filter');
    const btnConfirmPassword = document.getElementById('btn-confirm-password-overwrite');
    const btnConfirmRoles = document.getElementById('btn-confirm-role-assignment');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.loadDirectory());
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.loadDirectory());
    }

    if (btnConfirmPassword) {
      btnConfirmPassword.addEventListener('click', () => this.handlePasswordOverwrite());
    }

    if (btnConfirmRoles) {
      btnConfirmRoles.addEventListener('click', () => this.handleSaveUserRoles());
    }

    // Global outside-click dismiss for action popups
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.account-actions-dropdown')) {
        this.closeAllActionMenus();
      }
    });
  },

  closeAllActionMenus() {
    document.querySelectorAll('.account-actions-menu').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.account-actions-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  },

  async loadAccounts() {
    await Promise.all([
      this.loadPending(),
      this.loadDirectory()
    ]);
  },

  async loadPending() {
    const canAdmit = window.app.hasPermission('accounts', 'admit_pending');
    const section = document.getElementById('pending-queue-section');
    if (!canAdmit) {
      if (section) section.style.display = 'none';
      return;
    }

    if (section) section.style.display = 'block';

    try {
      const res = await api.accounts.getPending();
      this.pendingUsers = res.pendingUsers || [];
      this.renderPendingQueue();

      const countEl = document.getElementById('pending-count');
      if (countEl) countEl.textContent = this.pendingUsers.length;

      const navBadge = document.getElementById('badge-pending-accounts');
      if (navBadge) {
        navBadge.textContent = this.pendingUsers.length;
        navBadge.style.display = this.pendingUsers.length > 0 ? 'inline-block' : 'none';
      }
    } catch (err) {
      console.error('Failed to load pending users:', err);
    }
  },

  renderPendingQueue() {
    const grid = document.getElementById('pending-users-grid');
    if (!grid) return;

    if (this.pendingUsers.length === 0) {
      grid.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No new user registration requests pending approval.</div>';
      return;
    }

    grid.innerHTML = this.pendingUsers.map(u => `
      <div class="pending-card">
        <div class="pending-user-info">
          <div class="pending-avatar">${helpers.escapeHtml((u.username || 'U').charAt(0).toUpperCase())}</div>
          <div>
            <div class="pending-username">${helpers.escapeHtml(u.username)}</div>
            <div class="pending-date">Registered: ${helpers.formatDateLA(u.created_at)}</div>
          </div>
        </div>
        <div class="pending-actions">
          <button type="button" class="btn btn-primary btn-square-sm" data-action="approve-user" data-id="${u.id}" title="Approve Registration">
            ${ACCOUNT_ICONS.check}
          </button>
          <button type="button" class="btn btn-outline-danger btn-square-sm" data-action="reject-user" data-id="${u.id}" data-username="${helpers.escapeHtml(u.username)}" title="Reject Registration">
            ${ACCOUNT_ICONS.x}
          </button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-action="approve-user"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          await api.accounts.approvePending(id);
          helpers.showToast('Account approved and assigned default role!', 'success');
          this.loadAccounts();
        } catch (err) {
          helpers.showToast(err.message || 'Approval failed', 'error');
        }
      });
    });

    grid.querySelectorAll('[data-action="reject-user"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const username = btn.dataset.username || 'this user';
        if (confirm(`Are you sure you want to reject registration for @${username}?`)) {
          try {
            await api.accounts.rejectPending(id);
            this.loadAccounts();
          } catch (err) {
            helpers.showToast(err.message || 'Rejection failed', 'error');
          }
        }
      });
    });
  },

  async loadDirectory() {
    const canView = window.app.hasPermission('accounts', 'view_users');
    if (!canView) return;

    const search = document.getElementById('user-search-input')?.value || '';
    const status = document.getElementById('user-status-filter')?.value || '';

    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.accounts.getDirectory({ search, status }),
        api.roles.getAll()
      ]);

      this.users = usersRes.users || [];
      this.roles = rolesRes.roles || [];
      this.renderDirectoryTable();
    } catch (err) {
      console.error('Failed to load user directory:', err);
    }
  },

  renderDirectoryTable() {
    const tbody = document.getElementById('user-directory-tbody');
    if (!tbody) return;

    const canModifyPwd = window.app.hasPermission('accounts', 'modify_passwords');
    const canToggleSusp = window.app.hasPermission('accounts', 'toggle_suspension');
    const canManageRoles = window.app.hasPermission('roles', 'manage_roles');
    const currentUserId = window.authView.currentUser?.id;

    if (this.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">No accounts found matching filter.</td></tr>';
      return;
    }

    tbody.innerHTML = this.users.map(u => {
      const isSelf = (u.id === currentUserId);
      const isSuspended = u.status === 'SUSPENDED';

      let statusBadge = '<span class="badge badge-success">ACTIVE</span>';
      if (isSuspended) {
        statusBadge = '<span class="badge badge-danger">SUSPENDED</span>';
      } else if (u.status === 'PENDING') {
        statusBadge = '<span class="badge badge-warning">PENDING</span>';
      }

      const rolesBadges = (u.roles || []).map(r => `
        <span class="badge" style="background-color:${r.color_hex}22; color:${r.color_hex}; border:1px solid ${r.color_hex}55;">
          ${helpers.escapeHtml(r.name)}
        </span>
      `).join('');

      return `
        <tr class="user-row-item">
          <td class="user-cell-main">
            <div class="user-table-cell">
              <div class="user-avatar">${helpers.escapeHtml((u.username || 'U').charAt(0).toUpperCase())}</div>
              <div class="user-identity">
                <strong class="user-name-text">${helpers.escapeHtml(u.username)}</strong>
                ${isSelf ? '<span class="badge badge-info user-self-badge">You</span>' : ''}
              </div>
            </div>
          </td>
          <td class="user-cell-roles">
            <div class="user-roles-list">
              ${rolesBadges || '<span style="color:var(--text-muted); font-size:0.75rem;">None</span>'}
            </div>
          </td>
          <td class="user-cell-status">
            <div class="user-status-wrapper">${statusBadge}</div>
          </td>
          <td class="user-cell-date">
            <span class="user-date-text">${helpers.formatDateLA(u.created_at)}</span>
          </td>
          <td class="user-cell-actions" style="text-align:right;">
            <div class="account-actions-dropdown">
              <button type="button" class="account-actions-btn" data-action="toggle-menu" data-menu="menu-user-${u.id}" title="Actions" aria-expanded="false">
                ${ACCOUNT_ICONS.dots}
              </button>
              <div class="account-actions-menu" id="menu-user-${u.id}">
                ${canManageRoles ? `
                  <button type="button" class="account-action-item" data-action="assign-roles" data-id="${u.id}">
                    ${ACCOUNT_ICONS.shield}
                    <span>Assign Roles</span>
                  </button>
                ` : ''}
                ${canModifyPwd ? `
                  <button type="button" class="account-action-item" data-action="reset-pwd" data-id="${u.id}" data-username="${helpers.escapeHtml(u.username)}">
                    ${ACCOUNT_ICONS.key}
                    <span>Reset Password</span>
                  </button>
                ` : ''}
                ${(canToggleSusp && !isSelf && u.status !== 'PENDING') ? `
                  <button type="button" class="account-action-item ${isSuspended ? '' : 'danger-action'}" data-action="toggle-susp" data-id="${u.id}" data-username="${helpers.escapeHtml(u.username)}" data-suspended="${isSuspended}">
                    ${isSuspended ? ACCOUNT_ICONS.check : ACCOUNT_ICONS.slash}
                    <span>${isSuspended ? 'Activate Account' : 'Suspend Account'}</span>
                  </button>
                ` : ''}
                ${!isSelf ? `
                  <button type="button" class="account-action-item danger-action" data-action="delete-user" data-id="${u.id}" data-username="${helpers.escapeHtml(u.username)}">
                    ${ACCOUNT_ICONS.trash}
                    <span>Remove Account</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.bindActionMenuTriggers(tbody);

    // Attach Action handlers
    tbody.querySelectorAll('[data-action="assign-roles"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.closeAllActionMenus();
        const user = this.users.find(u => u.id === id);
        if (user) this.openRoleAssignmentModal(user);
      });
    });

    tbody.querySelectorAll('[data-action="reset-pwd"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const username = btn.dataset.username;
        this.closeAllActionMenus();
        this.openPasswordOverwriteModal(id, username);
      });
    });

    tbody.querySelectorAll('[data-action="toggle-susp"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const username = btn.dataset.username;
        const isSuspended = btn.dataset.suspended === 'true';
        this.closeAllActionMenus();

        const actionPrompt = isSuspended ? `Are you sure you want to reactivate @${username}?` : `Are you sure you want to suspend @${username}?`;
        if (!confirm(actionPrompt)) return;

        try {
          const res = await api.accounts.toggleSuspension(id);
          helpers.showToast(`User status updated to ${res.status}`, 'success');
          this.loadDirectory();
        } catch (err) {
          helpers.showToast(err.message || 'Failed to update suspension', 'error');
        }
      });
    });

    tbody.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const username = btn.dataset.username;
        this.closeAllActionMenus();

        if (!confirm(`WARNING: Are you sure you want to permanently remove @${username}? This action cannot be undone.`)) {
          return;
        }

        try {
          await api.accounts.delete(id);
          helpers.showToast(`Account @${username} has been permanently deleted.`, 'info');
          this.loadAccounts();
        } catch (err) {
          helpers.showToast(err.message || 'Failed to delete account', 'error');
        }
      });
    });
  },

  bindActionMenuTriggers(container) {
    container.querySelectorAll('[data-action="toggle-menu"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menuId = btn.dataset.menu;
        const menu = document.getElementById(menuId);
        if (!menu) return;

        const isCurrentlyOpen = menu.classList.contains('show');
        this.closeAllActionMenus();

        if (!isCurrentlyOpen) {
          menu.classList.add('show');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  },

  openPasswordOverwriteModal(userId, username) {
    document.getElementById('pwd-overwrite-user-id').value = userId;
    document.getElementById('pwd-overwrite-user-prompt').innerHTML = `Enter a new password for <strong>${helpers.escapeHtml(username)}</strong>:`;
    document.getElementById('input-new-password').value = '';
    helpers.openModal('modal-password-overwrite');
  },

  async handlePasswordOverwrite() {
    const userId = document.getElementById('pwd-overwrite-user-id').value;
    const newPassword = document.getElementById('input-new-password').value;

    if (!newPassword || newPassword.length < 4) {
      helpers.showToast('Password must be at least 4 characters long.', 'error');
      return;
    }

    try {
      await api.accounts.overwritePassword(userId, newPassword);
      helpers.showToast('Password updated successfully!', 'success');
      helpers.closeModal(document.getElementById('modal-password-overwrite'));
    } catch (err) {
      helpers.showToast(err.message || 'Failed to overwrite password', 'error');
    }
  },

  openRoleAssignmentModal(user) {
    document.getElementById('role-assign-user-id').value = user.id;
    document.getElementById('role-assign-user-prompt').innerHTML = `Assign roles for <strong>${helpers.escapeHtml(user.username)}</strong>:`;

    const list = document.getElementById('role-checkboxes-container') || document.getElementById('role-checkboxes-list');
    if (!list) return;

    list.innerHTML = this.roles.map(r => {
      const isChecked = (user.role_ids || []).includes(r.id);
      return `
        <label class="role-checkbox-item" style="display:flex; align-items:center; gap:0.6rem; padding:0.5rem; border-radius:var(--radius-sm); cursor:pointer; user-select:none;">
          <input type="checkbox" name="assigned_role" value="${r.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer;">
          <span class="badge" style="background-color:${r.color_hex}22; color:${r.color_hex}; border:1px solid ${r.color_hex}55;">
            ${helpers.escapeHtml(r.name)}
          </span>
          <span style="font-size:0.75rem; color:var(--text-muted); margin-left:auto;">Pos: ${r.position}</span>
        </label>
      `;
    }).join('');

    helpers.openModal('modal-role-assignment');
  },

  async handleSaveUserRoles() {
    const userId = document.getElementById('role-assign-user-id').value;
    const checkboxes = document.querySelectorAll('#role-checkboxes-container input[name="assigned_role"]:checked, #role-checkboxes-list input[name="assigned_role"]:checked');
    const roleIds = Array.from(checkboxes).map(cb => cb.value);

    try {
      await api.accounts.updateRoles(userId, roleIds);
      helpers.showToast('User roles updated successfully!', 'success');
      helpers.closeModal(document.getElementById('modal-role-assignment'));
      this.loadDirectory();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to update roles', 'error');
    }
  }
};

window.accountsView = accountsView;
