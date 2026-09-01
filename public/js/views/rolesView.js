// Roles & Permissions Discord-Style View Controller
const rolesView = {
  roles: [],
  registry: null,
  metadata: null,
  selectedRoleId: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const btnAddRole = document.getElementById('btn-add-role');
    if (btnAddRole) {
      btnAddRole.addEventListener('click', () => this.handleCreateRole());
    }
  },

  async loadRoles() {
    try {
      if (!this.registry) {
        const regRes = await api.roles.getRegistry();
        this.registry = regRes.registry;
        this.metadata = regRes.metadata;
      }

      const res = await api.roles.getAll();
      this.roles = res.roles || [];

      if (!this.selectedRoleId && this.roles.length > 0) {
        this.selectedRoleId = this.roles[0].id;
      } else if (this.roles.length > 0 && !this.roles.some(r => r.id === this.selectedRoleId)) {
        this.selectedRoleId = this.roles[0].id;
      }

      this.renderHierarchyList();
      this.renderRoleEditor();
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  },

  sortableInstance: null,

  destroySortable() {
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }
  },

  renderHierarchyList() {
    this.destroySortable();
    const listContainer = document.getElementById('roles-hierarchy-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const currentUser = window.authView.currentUser;
    const canManageRoles = window.app.hasPermission('roles', 'manage_roles');

    this.roles.forEach(role => {
      const li = document.createElement('li');
      li.className = `role-list-item ${role.id === this.selectedRoleId ? 'active' : ''}`;
      li.dataset.id = role.id;

      li.innerHTML = `
        <span class="role-drag-handle" title="Drag to reorder hierarchy">⋮⋮</span>
        <span class="role-color-dot" style="background-color: ${role.color_hex || '#8b949e'};"></span>
        <span class="role-item-name">${helpers.escapeHtml(role.name)}</span>
        ${role.is_default ? '<span class="badge badge-success" style="font-size:0.65rem;">Default</span>' : ''}
        ${role.is_admin ? '<span class="badge badge-purple" style="font-size:0.65rem;">Admin</span>' : ''}
      `;

      li.addEventListener('click', () => {
        if (this.selectedRoleId === role.id) return;
        this.selectedRoleId = role.id;
        this.renderHierarchyList();
        this.renderRoleEditor();
      });

      listContainer.appendChild(li);
    });

    // Make draggable with SortableJS if user has manage_roles permission
    if (canManageRoles && typeof Sortable !== 'undefined') {
      this.sortableInstance = new Sortable(listContainer, {
        handle: '.role-drag-handle',
        animation: 150,
        ghostClass: 'role-sortable-ghost',
        chosenClass: 'role-sortable-chosen',
        dragClass: 'role-sortable-drag',
        onEnd: async (evt) => {
          if (evt.oldIndex === evt.newIndex) return;
          const newOrderedIds = Array.from(listContainer.children)
            .map(child => child.dataset.id)
            .filter(Boolean);

          try {
            const res = await api.roles.reorder(newOrderedIds);
            this.roles = res.roles;
            helpers.showToast('Role hierarchy updated!', 'success');
            this.renderHierarchyList();
            this.renderRoleEditor();
          } catch (err) {
            helpers.showToast(err.message || 'Failed to reorder roles', 'error');
            this.loadRoles();
          }
        }
      });
    }
  },

  renderRoleEditor() {
    const pane = document.getElementById('role-editor-pane');
    if (!pane) return;

    const role = this.roles.find(r => r.id === this.selectedRoleId);
    if (!role) {
      pane.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem;">Select a role from the left hierarchy list to configure permissions.</div>';
      return;
    }

    const currentUser = window.authView.currentUser;
    const isAdmin = currentUser && currentUser.isAdmin;
    const canManageRoles = window.app.hasPermission('roles', 'manage_roles');

    // Discord-style hierarchy check: User can only edit roles strictly below their highest position
    const isHigherOrEqual = !isAdmin && (currentUser.highestPosition >= role.position);
    const isEditable = canManageRoles && !isHigherOrEqual;

    let authorityWarning = '';
    if (isHigherOrEqual) {
      authorityWarning = `
        <div class="authority-restriction-banner">
          <span>🔒</span>
          <span>This role is equal to or higher than your position in the hierarchy. You cannot modify its settings or permissions.</span>
        </div>
      `;
    }

    let permissionMatrixHtml = '';
    if (this.registry && this.metadata) {
      for (const [moduleKey, actions] of Object.entries(this.registry)) {
        const meta = this.metadata[moduleKey] || { label: moduleKey, description: '' };
        
        let itemsHtml = '';
        actions.forEach(action => {
          const permKey = `${moduleKey}.${action}`;
          const isChecked = role.permissions && (role.permissions.includes(permKey) || role.permissions.includes('*') || role.is_admin);
          const actMeta = meta.permissions && meta.permissions[action] ? meta.permissions[action] : { label: action, description: '' };

          // Grant limitation check: user cannot grant permissions they themselves do not have (unless Admin)
          const userHasThisPerm = isAdmin || (currentUser.permissions && currentUser.permissions.includes(permKey));
          const permDisabled = !isEditable || (!userHasThisPerm && !isChecked);

          itemsHtml += `
            <label class="permission-item ${isChecked ? 'is-selected' : ''}" style="${permDisabled ? 'opacity:0.6; cursor:not-allowed;' : ''}">
              <div class="custom-checkbox-wrapper">
                <input type="checkbox" class="role-perm-checkbox" data-perm="${permKey}" ${isChecked ? 'checked' : ''} ${permDisabled ? 'disabled' : ''}>
                <div class="custom-check-box">
                  <svg class="custom-check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </div>
              <div style="flex:1; min-width:0;">
                <span class="permission-item-label">${helpers.escapeHtml(actMeta.label || action)}</span>
                <span class="permission-item-desc">${helpers.escapeHtml(actMeta.description || permKey)}</span>
              </div>
            </label>
          `;
        });

        permissionMatrixHtml += `
          <div class="permission-module-section">
            <div class="permission-module-title">
              <span>${helpers.escapeHtml(meta.label || moduleKey)}</span>
            </div>
            <div class="permission-module-desc">${helpers.escapeHtml(meta.description || '')}</div>
            <div class="permission-grid">
              ${itemsHtml}
            </div>
          </div>
        `;
      }
    }

    pane.innerHTML = `
      ${authorityWarning}
      <div class="role-editor-header">
        <div>
          <h2 style="margin-bottom:0.25rem;">${helpers.escapeHtml(role.name)}</h2>
        </div>
        <div style="display:flex; gap:0.5rem;">
          ${isEditable ? `
            <button class="btn btn-primary" id="btn-save-role-details">Save Role Changes</button>
            <button class="btn btn-outline-danger" id="btn-delete-role">Delete Role</button>
          ` : ''}
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.25rem; margin-bottom:1.5rem;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Role Name</label>
          <input type="text" id="role-edit-name" class="form-control" value="${helpers.escapeHtml(role.name)}" ${!isEditable ? 'disabled' : ''} required>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Badge Color</label>
          <div class="role-color-picker-group">
            <input type="color" id="role-edit-color" class="color-swatch-input" value="${role.color_hex || '#8b949e'}" ${!isEditable ? 'disabled' : ''}>
            <input type="text" id="role-edit-color-hex" class="form-control" value="${role.color_hex || '#8b949e'}" style="width: 120px; font-family:var(--font-mono);" ${!isEditable ? 'disabled' : ''}>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:2rem; padding: 1.25rem; background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-subtle); margin-bottom:1.5rem; flex-wrap:wrap;">
        <label class="permission-item" style="flex:1; min-width:220px; background:var(--bg-surface-elevated); margin-bottom:0;">
          <div class="custom-checkbox-wrapper">
            <input type="checkbox" id="role-edit-is-default" ${role.is_default ? 'checked' : ''} ${!isEditable ? 'disabled' : ''}>
            <div class="custom-check-box">
              <svg class="custom-check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </div>
          <div>
            <div style="font-weight:600; font-size:0.875rem;">Default Role</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Auto-assigned to newly approved accounts</div>
          </div>
        </label>

        <label class="permission-item" style="flex:1; min-width:220px; background:var(--bg-surface-elevated); margin-bottom:0;">
          <div class="custom-checkbox-wrapper">
            <input type="checkbox" id="role-edit-is-admin" ${role.is_admin ? 'checked' : ''} ${!isAdmin ? 'disabled' : ''}>
            <div class="custom-check-box">
              <svg class="custom-check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </div>
          <div>
            <div style="font-weight:600; font-size:0.875rem; color:var(--accent-purple);">Make Administrator</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Grants absolute override authority across all modules</div>
          </div>
        </label>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem;">Permission Matrix</h3>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">Select specific capabilities assigned to members with this role.</p>
        <div class="permission-matrix">
          ${permissionMatrixHtml}
        </div>
      </div>
    `;

    // Dynamic selection highlighting for checkboxes
    pane.querySelectorAll('.role-perm-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const item = cb.closest('.permission-item');
        if (item) {
          if (cb.checked) {
            item.classList.add('is-selected');
          } else {
            item.classList.remove('is-selected');
          }
        }
      });
    });

    // Sync color swatch & text hex
    const colorPicker = document.getElementById('role-edit-color');
    const colorHex = document.getElementById('role-edit-color-hex');
    if (colorPicker && colorHex) {
      colorPicker.addEventListener('input', (e) => { colorHex.value = e.target.value; });
      colorHex.addEventListener('input', (e) => { colorPicker.value = e.target.value; });
    }

    // Save Button
    const btnSave = document.getElementById('btn-save-role-details');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.handleSaveRole(role.id));
    }

    // Delete Button
    const btnDelete = document.getElementById('btn-delete-role');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => this.handleDeleteRole(role.id));
    }
  },

  async handleCreateRole() {
    const roleName = prompt('Enter name for the new role:');
    if (!roleName || !roleName.trim()) return;

    try {
      const res = await api.roles.create({
        name: roleName.trim(),
        color_hex: '#58a6ff',
        permissions: ['checklists.access_nav', 'checklists.view_active']
      });
      helpers.showToast('Role created!', 'success');
      this.selectedRoleId = res.role.id;
      this.loadRoles();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to create role', 'error');
    }
  },

  async handleSaveRole(roleId) {
    const name = document.getElementById('role-edit-name').value.trim();
    const color_hex = document.getElementById('role-edit-color-hex').value.trim();
    const is_default = document.getElementById('role-edit-is-default').checked;
    const is_admin = document.getElementById('role-edit-is-admin').checked;

    if (!name) {
      helpers.showToast('Role name is required.', 'error');
      return;
    }

    const selectedPerms = [];
    document.querySelectorAll('.role-perm-checkbox:checked').forEach(cb => {
      selectedPerms.push(cb.dataset.perm);
    });

    try {
      await api.roles.update(roleId, {
        name,
        color_hex,
        is_default,
        is_admin,
        permissions: selectedPerms
      });
      helpers.showToast('Role updated successfully!', 'success');
      this.loadRoles();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to update role', 'error');
    }
  },

  async handleDeleteRole(roleId) {
    if (!confirm('Are you sure you want to delete this role? It will be removed from all users.')) {
      return;
    }

    try {
      await api.roles.delete(roleId);
      helpers.showToast('Role deleted.', 'info');
      this.selectedRoleId = null;
      this.loadRoles();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to delete role', 'error');
    }
  }
};

window.rolesView = rolesView;
