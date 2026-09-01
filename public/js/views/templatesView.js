// Templates Builder & Management View (Todoist-Style Minimalist Editor)
const templatesView = {
  templates: [],
  editingTemplate: null,
  activeSheetTargetNode: null,

  historyStack: [],
  historyIndex: -1,
  isUndoingRedoing: false,
  historyDebounceTimer: null,

  googleDriveColors: [
    { name: 'Chocolate', hex: '#ac725e' },
    { name: 'Brick red', hex: '#d06b64' },
    { name: 'Mars red', hex: '#f83a22' },
    { name: 'Dark orange', hex: '#fa573c' },
    { name: 'Autumn', hex: '#ff7537' },
    { name: 'Yellow', hex: '#ffad46' },
    { name: 'Spearmint', hex: '#42d692' },
    { name: 'Fern green', hex: '#16a765' },
    { name: 'Mountain view', hex: '#7bd148' },
    { name: 'Earth green', hex: '#b3dc6c' },
    { name: 'Sunny yellow', hex: '#fbe983' },
    { name: 'Mustard', hex: '#fad165' },
    { name: 'Seafoam', hex: '#92e1c0' },
    { name: 'Robin egg blue', hex: '#9fe1e7' },
    { name: 'Sky blue', hex: '#9fc6e7' },
    { name: 'Denim blue', hex: '#4986e7' },
    { name: 'Cornflower', hex: '#9a9cff' },
    { name: 'Lavender', hex: '#b99aff' },
    { name: 'Mouse gray', hex: '#c2c2c2' },
    { name: 'Sand', hex: '#cabdbf' },
    { name: 'Coral mauve', hex: '#cca6ac' },
    { name: 'Bubblegum', hex: '#f691b2' },
    { name: 'Purple', hex: '#cd74e6' },
    { name: 'Velvet violet', hex: '#a47ae2' }
  ],

  init() {
    this.bindEvents();
    this.bindActionSheetEvents();
    this.loadTemplates();
  },

  initHistory() {
    this.historyStack = [];
    this.historyIndex = -1;
    this.isUndoingRedoing = false;
    this.pushHistoryState(true);
  },

  pushHistoryState(force = false) {
    if (this.isUndoingRedoing) return;

    const titleInput = document.getElementById('tmpl-edit-title');
    const descInput = document.getElementById('tmpl-edit-desc');
    const title = titleInput ? this.decodeEntities(titleInput.value.trim()) : '';
    const description = descInput ? this.decodeEntities(descInput.value.trim()) : '';
    const items = this.serializeCanvas();

    const snapshot = {
      title,
      description,
      items: JSON.parse(JSON.stringify(items))
    };

    const snapshotJson = JSON.stringify(snapshot);

    if (!force && this.historyIndex >= 0 && this.historyStack[this.historyIndex]) {
      const prevJson = JSON.stringify(this.historyStack[this.historyIndex]);
      if (snapshotJson === prevJson) return;
    }

    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    }

    this.historyStack.push(snapshot);
    if (this.historyStack.length > 50) {
      this.historyStack.shift();
    }
    this.historyIndex = this.historyStack.length - 1;
    this.updateHistoryButtons();
  },

  debouncedPushHistory() {
    if (this.isUndoingRedoing) return;
    clearTimeout(this.historyDebounceTimer);
    this.historyDebounceTimer = setTimeout(() => {
      this.pushHistoryState();
    }, 300);
  },

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    const snapshot = this.historyStack[this.historyIndex];
    this.restoreSnapshot(snapshot);
    this.updateHistoryButtons();
  },

  redo() {
    if (this.historyIndex >= this.historyStack.length - 1) return;
    this.historyIndex++;
    const snapshot = this.historyStack[this.historyIndex];
    this.restoreSnapshot(snapshot);
    this.updateHistoryButtons();
  },

  updateHistoryButtons() {
    const btnUndo = document.getElementById('btn-tmpl-undo');
    const btnRedo = document.getElementById('btn-tmpl-redo');
    if (btnUndo) btnUndo.disabled = (this.historyIndex <= 0);
    if (btnRedo) btnRedo.disabled = (this.historyIndex >= this.historyStack.length - 1);
  },

  restoreSnapshot(snapshot) {
    if (!snapshot) return;
    this.isUndoingRedoing = true;

    const titleInput = document.getElementById('tmpl-edit-title');
    const descInput = document.getElementById('tmpl-edit-desc');
    const treeContainer = document.getElementById('tmpl-items-builder-tree');

    if (titleInput) titleInput.value = snapshot.title || '';
    if (descInput) {
      descInput.value = snapshot.description || '';
      descInput.style.height = 'auto';
      if (descInput.value) descInput.style.height = `${descInput.scrollHeight}px`;
    }

    if (treeContainer) {
      treeContainer.innerHTML = '';
      if (Array.isArray(snapshot.items)) {
        snapshot.items.forEach(item => {
          if (item.type === 'section') {
            treeContainer.appendChild(this.addSectionNode(item, false));
          } else {
            treeContainer.appendChild(this.createItemNodeElement(item));
          }
        });
      }
      this.setupDragAndDrop(treeContainer);
    }

    this.isUndoingRedoing = false;
  },

  decodeEntities(str) {
    if (!str) return '';
    let current = String(str);
    for (let i = 0; i < 5; i++) {
      const txt = document.createElement('textarea');
      txt.innerHTML = current;
      const decoded = txt.value;
      if (decoded === current) break;
      current = decoded;
    }
    return current;
  },

  bindEvents() {
    const btnUndo = document.getElementById('btn-tmpl-undo');
    const btnRedo = document.getElementById('btn-tmpl-redo');
    if (btnUndo) {
      btnUndo.addEventListener('click', () => this.undo());
    }
    if (btnRedo) {
      btnRedo.addEventListener('click', () => this.redo());
    }

    const titleInput = document.getElementById('tmpl-edit-title');
    if (titleInput) {
      titleInput.addEventListener('input', () => this.debouncedPushHistory());
    }

    if (!window._hasTmplHistoryKeyBound) {
      window._hasTmplHistoryKeyBound = true;
      window.addEventListener('keydown', (e) => {
        const modal = document.getElementById('modal-template-editor');
        if (!modal || modal.style.display === 'none') return;

        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        if (isCtrlOrCmd && !e.altKey) {
          if (e.key === 'z' || e.key === 'Z') {
            if (e.shiftKey) {
              e.preventDefault();
              this.redo();
            } else {
              e.preventDefault();
              this.undo();
            }
          } else if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            this.redo();
          }
        }
      });
    }

    const btnCreate = document.getElementById('btn-create-template');
    const btnDeleteAll = document.getElementById('btn-delete-all-templates');
    const btnSave = document.getElementById('btn-save-template');
    const btnAddRoot = document.getElementById('btn-add-root-task');
    const btnToggleSubHook = document.getElementById('btn-toggle-tmpl-submission-hook');
    const btnCloseSubHook = document.getElementById('btn-close-tmpl-webhook-drawer');

    if (btnCreate) {
      btnCreate.addEventListener('click', () => this.openTemplateEditor(null));
    }

    if (btnDeleteAll) {
      btnDeleteAll.addEventListener('click', () => this.handleDeleteAllTemplates());
    }

    const btnAddSection = document.getElementById('btn-add-section');
    if (btnAddSection) {
      btnAddSection.addEventListener('click', () => this.addSectionNode());
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => this.handleSaveTemplate());
    }

    if (btnAddRoot) {
      btnAddRoot.addEventListener('click', () => this.addRootTaskNode());
    }

    if (btnToggleSubHook) {
      btnToggleSubHook.addEventListener('click', () => {
        const drawer = document.getElementById('tmpl-submission-hook-drawer');
        if (drawer) {
          const isVisible = drawer.style.display !== 'none';
          drawer.style.display = isVisible ? 'none' : 'block';
        }
      });
    }

    if (btnCloseSubHook) {
      btnCloseSubHook.addEventListener('click', () => {
        const drawer = document.getElementById('tmpl-submission-hook-drawer');
        if (drawer) drawer.style.display = 'none';
      });
    }

    const btnRemoveSubHook = document.getElementById('btn-remove-tmpl-submission-hook');
    if (btnRemoveSubHook) {
      btnRemoveSubHook.addEventListener('click', () => {
        const subUrl = document.getElementById('tmpl-sub-auto-url');
        const subHeaders = document.getElementById('tmpl-sub-auto-headers');
        const subBody = document.getElementById('tmpl-sub-auto-body');
        const subMethod = document.getElementById('tmpl-sub-auto-method');
        const hookLabel = document.getElementById('label-tmpl-webhook-btn');
        const drawer = document.getElementById('tmpl-submission-hook-drawer');

        if (subUrl) subUrl.value = '';
        if (subHeaders) subHeaders.value = '';
        if (subBody) subBody.value = '';
        if (subMethod) subMethod.value = 'POST';
        if (hookLabel) hookLabel.textContent = 'On-Submit Webhook';
        if (drawer) drawer.style.display = 'none';
      });
    }

    const btnToggleRelevance = document.getElementById('btn-toggle-relevance-settings');
    const btnCloseRelevance = document.getElementById('btn-close-relevance-drawer');
    const btnClearRelevance = document.getElementById('btn-clear-relevance-rules');
    const btnAddRelevance = document.getElementById('btn-add-relevance-rule');

    if (btnToggleRelevance) {
      btnToggleRelevance.addEventListener('click', () => {
        const drawer = document.getElementById('tmpl-relevance-settings-drawer');
        if (drawer) {
          const isVisible = drawer.style.display !== 'none';
          drawer.style.display = isVisible ? 'none' : 'block';
        }
      });
    }

    if (btnCloseRelevance) {
      btnCloseRelevance.addEventListener('click', () => {
        const drawer = document.getElementById('tmpl-relevance-settings-drawer');
        if (drawer) drawer.style.display = 'none';
      });
    }

    if (btnClearRelevance) {
      btnClearRelevance.addEventListener('click', () => {
        const container = document.getElementById('relevance-rules-container');
        if (container) container.innerHTML = '';
        this.updateRelevanceButtonBadge();
      });
    }

    if (btnAddRelevance) {
      btnAddRelevance.addEventListener('click', () => {
        const container = document.getElementById('relevance-rules-container');
        if (container) {
          container.appendChild(this.createRelevanceRuleElement({ days: [1, 2, 3, 4, 5], time: '20:00' }));
          this.updateRelevanceButtonBadge();
        }
      });
    }

    // Import template triggers
    const btnImport = document.getElementById('btn-import-template');
    const inputImport = document.getElementById('input-import-template');
    if (btnImport && inputImport) {
      btnImport.addEventListener('click', () => {
        inputImport.click();
      });
      inputImport.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleImportFile(e.target.files[0]);
        }
      });
    }

    // Auto-expand description textarea
    const descInput = document.getElementById('tmpl-edit-desc');
    if (descInput) {
      descInput.addEventListener('input', () => {
        descInput.style.height = 'auto';
        descInput.style.height = Math.max(32, descInput.scrollHeight) + 'px';
        if (!this.isUndoingRedoing) this.debouncedPushHistory();
      });
    }

    // Close color popovers & template dropdown menus on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.section-color-picker-wrap')) {
        document.querySelectorAll('.section-color-popover').forEach(p => p.style.display = 'none');
      }
      if (!e.target.closest('.template-menu-container')) {
        document.querySelectorAll('.template-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.template-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
      }
    });
  },

  bindActionSheetEvents() {
    const sheetBackdrop = document.getElementById('todoist-task-action-sheet');
    const btnClose = document.getElementById('btn-close-action-sheet');
    const btnAddSubtask = document.getElementById('sheet-btn-add-subtask');
    const btnToggleOptional = document.getElementById('sheet-btn-toggle-optional');
    const btnToggleHook = document.getElementById('sheet-btn-toggle-hook');
    const btnDelete = document.getElementById('sheet-btn-delete-task');

    if (btnClose) {
      btnClose.addEventListener('click', () => this.closeActionSheet());
    }

    if (sheetBackdrop) {
      sheetBackdrop.addEventListener('click', (e) => {
        if (e.target === sheetBackdrop) this.closeActionSheet();
      });
    }

    if (btnAddSubtask) {
      btnAddSubtask.addEventListener('click', () => {
        if (this.activeSheetTargetNode) {
          const childrenContainer = this.activeSheetTargetNode.querySelector('.tmpl-children-container');
          const childItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            title: '',
            description: '',
            is_optional: false,
            has_automation: false,
            automation: null,
            children: []
          };
          const childNode = this.createItemNodeElement(childItem);
          childrenContainer.appendChild(childNode);
          this.updateNodeShape(childNode);
          this.closeActionSheet();
          childNode.querySelector('.tmpl-item-title')?.focus();
        }
      });
    }

    if (btnToggleOptional) {
      btnToggleOptional.addEventListener('click', () => {
        if (this.activeSheetTargetNode) {
          const isCurrentlyOptional = this.activeSheetTargetNode.dataset.optional === 'true';
          this.activeSheetTargetNode.dataset.optional = (!isCurrentlyOptional).toString();
          this.updateNodeShape(this.activeSheetTargetNode);
          this.closeActionSheet();
        }
      });
    }

    const btnToggleDays = document.getElementById('sheet-btn-toggle-days');
    if (btnToggleDays) {
      btnToggleDays.addEventListener('click', () => {
        if (this.activeSheetTargetNode) {
          const drawer = this.activeSheetTargetNode.querySelector('.tmpl-days-drawer');
          if (drawer) {
            drawer.style.display = 'block';
            this.closeActionSheet();
          }
        }
      });
    }

    if (btnToggleHook) {
      btnToggleHook.addEventListener('click', () => {
        if (this.activeSheetTargetNode) {
          const drawer = this.activeSheetTargetNode.querySelector('.tmpl-automation-drawer');
          if (drawer) {
            drawer.style.display = 'block';
            this.closeActionSheet();
            drawer.querySelector('.tmpl-auto-url')?.focus();
          }
        }
      });
    }

    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (this.activeSheetTargetNode) {
          this.activeSheetTargetNode.remove();
          this.closeActionSheet();
        }
      });
    }
  },

  openActionSheet(node) {
    this.activeSheetTargetNode = node;
    const title = node.querySelector('.tmpl-item-title')?.value.trim();
    const titleEl = document.getElementById('action-sheet-task-title');
    if (titleEl) {
      titleEl.textContent = title ? `Task: ${title}` : 'Task Options';
    }

    const isOpt = node.dataset.optional === 'true';
    const optLabel = document.getElementById('sheet-label-optional');
    if (optLabel) {
      optLabel.textContent = isOpt ? 'Mark as Required' : 'Mark as Optional';
    }

    let days = [];
    try {
      if (node.dataset.days) days = JSON.parse(node.dataset.days);
    } catch (_) { }
    const daysLabelEl = document.getElementById('sheet-label-days');
    if (daysLabelEl) {
      daysLabelEl.textContent = (Array.isArray(days) && days.length > 0)
        ? `Days: ${days.join(', ')}`
        : 'Set Day Visibility (Every Day)';
    }

    const autoUrl = node.querySelector('.tmpl-auto-url')?.value.trim();
    const hookLabel = document.getElementById('sheet-label-hook');
    if (hookLabel) {
      hookLabel.textContent = autoUrl ? 'Edit Webhook' : 'Configure Webhook';
    }

    const sheetBackdrop = document.getElementById('todoist-task-action-sheet');
    if (sheetBackdrop) sheetBackdrop.style.display = 'flex';
  },

  closeActionSheet() {
    const sheetBackdrop = document.getElementById('todoist-task-action-sheet');
    if (sheetBackdrop) sheetBackdrop.style.display = 'none';
    this.activeSheetTargetNode = null;
  },

  async loadTemplates() {
    try {
      const res = await api.templates.getAll();
      this.templates = res.templates || [];
      this.renderGrid();
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  },

  async handleDeleteAllTemplates() {
    if (!this.templates || this.templates.length === 0) {
      helpers.showToast('No templates to delete.', 'info');
      return;
    }

    // 1st Confirmation
    const firstConfirm = confirm(`Are you sure you want to delete ALL ${this.templates.length} checklist templates? This action cannot be undone.`);
    if (!firstConfirm) return;

    // 2nd Confirmation (Asks twice as required by user)
    const secondConfirm = confirm('⚠️ FINAL WARNING: This will permanently delete EVERY template from the platform. Do you really want to proceed?');
    if (!secondConfirm) return;

    try {
      const res = await api.templates.deleteAll();
      helpers.showToast(res.message || 'All templates deleted.', 'success');
      this.loadTemplates();
      if (window.checklistsView) {
        window.checklistsView.loadChecklists();
      }
    } catch (err) {
      helpers.showToast(err.message || 'Failed to delete all templates', 'error');
    }
  },

  renderGrid() {
    const container = document.getElementById('templates-grid-container');
    if (!container) return;

    const canEdit = window.app.hasPermission('checklists', 'edit_templates');
    const btnCreate = document.getElementById('btn-create-template');
    const btnImport = document.getElementById('btn-import-template');
    const btnDeleteAll = document.getElementById('btn-delete-all-templates');

    if (btnCreate) btnCreate.style.display = canEdit ? 'inline-flex' : 'none';
    if (btnImport) btnImport.style.display = canEdit ? 'inline-flex' : 'none';
    if (btnDeleteAll) btnDeleteAll.style.display = (canEdit && this.templates.length > 0) ? 'inline-flex' : 'none';

    let html = '';
    this.templates.forEach(t => {
      const count = this.countItemsRecursive(t.items);
      const hasSubHook = Boolean(t.submission_automation && t.submission_automation.url);

      html += `
        <div class="checklist-card in-progress" data-id="${t.id}">
          <div class="card-top">
            <div class="card-title-group">
              <div class="card-title">${helpers.escapeHtml(this.decodeEntities(t.title))}</div>
              <div class="card-template-name">${helpers.escapeHtml(this.decodeEntities(t.description || 'No description provided'))}</div>
            </div>
          </div>
          <div class="card-bottom">
            <div class="card-tags">
              <span class="badge badge-purple">${count} ${count === 1 ? 'Task' : 'Tasks & Subtasks'}</span>
              ${hasSubHook ? '<span class="badge badge-info" title="Triggers HTTP webhook upon submission">⚡ Submit Hook</span>' : ''}
            </div>
            <div style="display:flex; gap:0.4rem; align-items:center; position:relative;">
              ${canEdit ? `
                <button class="btn btn-secondary btn-icon btn-sm" data-action="edit-template" data-id="${t.id}" title="Edit Template" aria-label="Edit Template">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <div class="template-menu-container">
                  <button class="btn btn-secondary btn-icon btn-sm btn-template-menu" data-action="toggle-template-menu" data-id="${t.id}" title="More Options" aria-label="More Options">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="1.5"></circle>
                      <circle cx="12" cy="5" r="1.5"></circle>
                      <circle cx="12" cy="19" r="1.5"></circle>
                    </svg>
                  </button>
                  <div class="template-dropdown-menu" id="tmpl-dropdown-${t.id}">
                    <button type="button" class="template-dropdown-item" data-action="duplicate-template" data-id="${t.id}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      <span>Duplicate</span>
                    </button>
                    <button type="button" class="template-dropdown-item" data-action="export-template" data-id="${t.id}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>Export</span>
                    </button>
                    <button type="button" class="template-dropdown-item dropdown-item-danger" data-action="delete-template" data-id="${t.id}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    });

    if (this.templates.length === 0) {
      html = '<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">No templates created yet. Click "Create Template" or "Import Template" to build your operational checklists.</div>';
    }

    container.innerHTML = html;

    // Attach card action event listeners
    container.querySelectorAll('[data-action="edit-template"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const tmpl = this.templates.find(t => t.id === id);
        if (tmpl) this.openTemplateEditor(tmpl);
      });
    });

    container.querySelectorAll('[data-action="toggle-template-menu"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menuWrap = btn.closest('.template-menu-container');
        const menu = menuWrap ? menuWrap.querySelector('.template-dropdown-menu') : null;
        if (!menu) return;
        const isOpen = menu.classList.contains('is-open');
        document.querySelectorAll('.template-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
        if (!isOpen) {
          menu.classList.add('is-open');
        }
      });
    });

    container.querySelectorAll('[data-action="duplicate-template"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        document.querySelectorAll('.template-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
        const id = btn.dataset.id;
        try {
          const res = await api.templates.duplicate(id);
          helpers.showToast(`Template "${helpers.escapeHtml(res.template.title)}" duplicated!`, 'success');
          this.loadTemplates();
        } catch (err) {
          helpers.showToast(err.message || 'Failed to duplicate template', 'error');
        }
      });
    });

    container.querySelectorAll('[data-action="export-template"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.template-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
        const id = btn.dataset.id;
        this.exportTemplate(id);
      });
    });

    container.querySelectorAll('[data-action="delete-template"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        document.querySelectorAll('.template-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
        const id = btn.dataset.id;
        if (confirm('Are you sure you want to delete this checklist template?')) {
          try {
            await api.templates.delete(id);
            helpers.showToast('Template deleted', 'info');
            this.loadTemplates();
          } catch (err) {
            helpers.showToast(err.message || 'Failed to delete template', 'error');
          }
        }
      });
    });
  },

  exportTemplate(id) {
    const tmpl = this.templates.find(t => t.id === id);
    if (!tmpl) {
      helpers.showToast('Template not found for export.', 'error');
      return;
    }

    const exportData = {
      app: 'AV Audit Platform',
      version: '1.0',
      exported_at: new Date().toISOString(),
      template: {
        title: tmpl.title,
        description: tmpl.description || '',
        items: tmpl.items || [],
        submission_automation: tmpl.submission_automation || null,
        schedules: tmpl.schedules || []
      }
    };

    try {
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeFilename = (tmpl.title || 'template')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      a.download = `${safeFilename || 'template'}-template.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      helpers.showToast(`Exported "${helpers.escapeHtml(tmpl.title)}" successfully!`, 'success');
    } catch (err) {
      console.error('Export template error:', err);
      helpers.showToast('Failed to export template.', 'error');
    }
  },

  async handleImportFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('Selected file is not a valid JSON document.');
      }

      // Support either exported bundle { template: { ... } } or direct template object
      const tmplPayload = (data && typeof data === 'object' && data.template) ? data.template : data;
      if (!tmplPayload || typeof tmplPayload !== 'object') {
        throw new Error('Invalid template file structure.');
      }

      if (!tmplPayload.title || typeof tmplPayload.title !== 'string' || !tmplPayload.title.trim()) {
        throw new Error('Template file is missing a valid title.');
      }

      const title = tmplPayload.title.trim();
      const description = typeof tmplPayload.description === 'string' ? tmplPayload.description.trim() : '';
      const items = Array.isArray(tmplPayload.items) ? tmplPayload.items : [];
      const submission_automation = tmplPayload.submission_automation || null;
      const schedules = Array.isArray(tmplPayload.schedules) ? tmplPayload.schedules : [];

      const res = await api.templates.create({
        title,
        description,
        items,
        submission_automation,
        schedules
      });

      helpers.showToast(`Template "${helpers.escapeHtml(res.template.title)}" imported successfully!`, 'success');
      this.loadTemplates();
    } catch (err) {
      console.error('Import template error:', err);
      helpers.showToast(err.message || 'Failed to import template.', 'error');
    } finally {
      const fileInput = document.getElementById('input-import-template');
      if (fileInput) fileInput.value = '';
    }
  },

  countItemsRecursive(items) {
    if (!Array.isArray(items)) return 0;
    let count = items.length;
    for (const item of items) {
      if (item.children) count += this.countItemsRecursive(item.children);
    }
    return count;
  },

  createRelevanceRuleElement(rule = { days: [1, 2, 3, 4, 5], time: '20:00' }) {
    const card = document.createElement('div');
    card.className = 'relevance-rule-card';

    const days = Array.isArray(rule.days) ? rule.days.map(Number) : [1, 2, 3, 4, 5];
    const timeVal = rule.time || '20:00';

    card.innerHTML = `
      <div class="alarm-days-group">
        <span class="alarm-day-pill ${days.includes(0) ? 'active' : ''}" data-day="0" title="Sunday">S</span>
        <span class="alarm-day-pill ${days.includes(1) ? 'active' : ''}" data-day="1" title="Monday">M</span>
        <span class="alarm-day-pill ${days.includes(2) ? 'active' : ''}" data-day="2" title="Tuesday">T</span>
        <span class="alarm-day-pill ${days.includes(3) ? 'active' : ''}" data-day="3" title="Wednesday">W</span>
        <span class="alarm-day-pill ${days.includes(4) ? 'active' : ''}" data-day="4" title="Thursday">T</span>
        <span class="alarm-day-pill ${days.includes(5) ? 'active' : ''}" data-day="5" title="Friday">F</span>
        <span class="alarm-day-pill ${days.includes(6) ? 'active' : ''}" data-day="6" title="Saturday">S</span>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <input type="time" class="form-control alarm-time-input" value="${helpers.escapeHtml(timeVal)}">
        <button type="button" class="btn-text-close btn-remove-alarm-rule" title="Remove this rule" style="font-size:1.2rem; line-height:1;">&times;</button>
      </div>
    `;

    // Toggle day pills
    card.querySelectorAll('.alarm-day-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        pill.classList.toggle('active');
        this.updateRelevanceButtonBadge();
      });
    });

    // Remove rule card
    card.querySelector('.btn-remove-alarm-rule').addEventListener('click', () => {
      card.remove();
      this.updateRelevanceButtonBadge();
    });

    card.querySelector('.alarm-time-input').addEventListener('input', () => {
      this.updateRelevanceButtonBadge();
    });

    return card;
  },

  serializeRelevanceRules() {
    const container = document.getElementById('relevance-rules-container');
    if (!container) return [];
    const rules = [];

    container.querySelectorAll('.relevance-rule-card').forEach(card => {
      const activeDays = [];
      card.querySelectorAll('.alarm-day-pill.active').forEach(pill => {
        const day = parseInt(pill.dataset.day, 10);
        if (!isNaN(day)) activeDays.push(day);
      });

      const timeInput = card.querySelector('.alarm-time-input');
      const time = timeInput ? timeInput.value.trim() : '';

      if (activeDays.length > 0 && time) {
        rules.push({ days: activeDays.sort((a, b) => a - b), time });
      }
    });

    return rules;
  },

  updateRelevanceButtonBadge() {
    const label = document.getElementById('label-relevance-settings-btn');
    const btn = document.getElementById('btn-toggle-relevance-settings');
    if (!label) return;
    const rules = this.serializeRelevanceRules();
    if (rules.length > 0) {
      label.textContent = `Relevance Rules (${rules.length}) ⏰`;
      if (btn) {
        btn.classList.add('has-rules');
        btn.setAttribute('data-badge', String(rules.length));
        btn.title = `Relevance Rules Configured (${rules.length})`;
      }
    } else {
      label.textContent = 'Relevance Score Settings';
      if (btn) {
        btn.classList.remove('has-rules');
        btn.removeAttribute('data-badge');
        btn.title = 'Configure smart pivot time relevance scoring';
      }
    }
  },

  updateNodeShape(node) {
    if (!node || !node.classList.contains('todoist-task-node')) return;

    const isInsideOptionalSection = Boolean(node.closest('.todoist-section-block[data-optional="true"]'));
    const isSelfOptional = node.dataset.optional === 'true';
    const isAncestorOptional = Boolean(node.parentElement?.closest('.todoist-task-node[data-optional="true"]'));
    const isOptional = isInsideOptionalSection || isSelfOptional || isAncestorOptional;

    const autoUrlInput = node.querySelector('.tmpl-auto-url');
    const hasAuto = Boolean(autoUrlInput && autoUrlInput.value.trim());

    const circleIndicator = node.querySelector(':scope > .todoist-task-row .todoist-circle');
    const btnOpt = node.querySelector(':scope > .todoist-task-row .tmpl-btn-toggle-optional');

    if (circleIndicator) {
      circleIndicator.classList.remove('is-rhombus', 'is-optional', 'is-hexagon');

      if (!isOptional && !hasAuto) {
        // 1. Required Task, No Hook (Hollow Circle ○)
        circleIndicator.title = 'Required Task (Hollow Circle)';
      } else if (!isOptional && hasAuto) {
        // 2. Required Task + Hook (Hollow Cyan Rhombus ◇)
        circleIndicator.classList.add('is-rhombus');
        circleIndicator.title = '⚡ Required Task with cURL Webhook (Hollow Cyan Rhombus)';
      } else if (isOptional && !hasAuto) {
        // 3. Optional Task, No Hook (Dashed Yellow Circle ◌)
        circleIndicator.classList.add('is-optional');
        circleIndicator.title = '◌ Optional Task (Dashed Circle) - Excluded from Progress';
      } else if (isOptional && hasAuto) {
        // 4. Optional Task + Hook (Dashed Cyan Rhombus ⬪)
        circleIndicator.classList.add('is-optional', 'is-rhombus');
        circleIndicator.title = '⬪ Optional Task with cURL Webhook (Dashed Cyan Rhombus)';
      }
    }

    if (btnOpt) {
      btnOpt.classList.toggle('is-optional', isOptional);
      btnOpt.innerHTML = isOptional
        ? '<span class="btn-icon">⬠</span><span class="btn-text">Optional</span>'
        : '<span class="btn-icon">⬠</span><span class="btn-text">Req</span>';
      btnOpt.title = isOptional ? 'Marked as Optional (Click to make Required)' : 'Marked as Required (Click to make Optional)';
    }

    // Recursively update all descendant subtasks
    const childrenContainer = node.querySelector('.tmpl-children-container');
    if (childrenContainer) {
      Array.from(childrenContainer.children).forEach(child => {
        if (child.classList.contains('todoist-task-node')) {
          this.updateNodeShape(child);
        }
      });
    }
  },

  updateAllSectionTaskShapes(sectionBlock) {
    if (!sectionBlock) return;
    const tasks = sectionBlock.querySelectorAll('.todoist-task-node');
    tasks.forEach(t => this.updateNodeShape(t));
  },

  openTemplateEditor(template) {
    this.editingTemplate = template;
    const titleEl = document.getElementById('template-editor-modal-title');
    const idInput = document.getElementById('tmpl-edit-id');
    const titleInput = document.getElementById('tmpl-edit-title');
    const descInput = document.getElementById('tmpl-edit-desc');
    const treeContainer = document.getElementById('tmpl-items-builder-tree');

    // Relevance Score Drawer & Container
    const relevanceDrawer = document.getElementById('tmpl-relevance-settings-drawer');
    const relevanceContainer = document.getElementById('relevance-rules-container');
    if (relevanceContainer) relevanceContainer.innerHTML = '';

    // Submission webhook inputs
    const subDrawer = document.getElementById('tmpl-submission-hook-drawer');
    const subMethod = document.getElementById('tmpl-sub-auto-method');
    const subUrl = document.getElementById('tmpl-sub-auto-url');
    const subHeaders = document.getElementById('tmpl-sub-auto-headers');
    const subBody = document.getElementById('tmpl-sub-auto-body');
    const hookLabel = document.getElementById('label-tmpl-webhook-btn');

    treeContainer.innerHTML = '';

    if (template) {
      titleEl.textContent = '🛠️ Edit Template';
      idInput.value = template.id;
      titleInput.value = this.decodeEntities(template.title || '');
      descInput.value = this.decodeEntities(template.description || '');
      descInput.style.height = 'auto';

      if (template.items && template.items.length > 0) {
        template.items.forEach(item => {
          if (item.type === 'section') {
            treeContainer.appendChild(this.addSectionNode(item, false));
          } else {
            treeContainer.appendChild(this.createItemNodeElement(item));
          }
        });
      } else {
        this.addRootTaskNode();
      }

      // Populate relevance schedule rules
      if (Array.isArray(template.schedules) && template.schedules.length > 0) {
        template.schedules.forEach(rule => {
          if (relevanceContainer) relevanceContainer.appendChild(this.createRelevanceRuleElement(rule));
        });
      }
      this.updateRelevanceButtonBadge();

      // Populate submission automation if configured
      const btnToggleHook = document.getElementById('btn-toggle-tmpl-submission-hook');
      if (template.submission_automation && template.submission_automation.url) {
        if (hookLabel) hookLabel.textContent = 'Webhook Configured ⚡';
        if (btnToggleHook) {
          btnToggleHook.classList.add('has-hook');
          btnToggleHook.title = 'On-Submit Webhook Configured ⚡';
        }
        if (subMethod) subMethod.value = template.submission_automation.method || 'POST';
        if (subUrl) subUrl.value = template.submission_automation.url || '';
        if (subHeaders) subHeaders.value = template.submission_automation.headers || '';
        if (subBody) subBody.value = template.submission_automation.body || '';
      } else {
        if (hookLabel) hookLabel.textContent = 'On-Submit Webhook';
        if (btnToggleHook) {
          btnToggleHook.classList.remove('has-hook');
          btnToggleHook.title = 'Configure automated on-submission webhook';
        }
        if (subMethod) subMethod.value = 'POST';
        if (subUrl) subUrl.value = '';
        if (subHeaders) subHeaders.value = '';
        if (subBody) subBody.value = '';
      }
    } else {
      titleEl.textContent = '🛠️ New Template';
      idInput.value = '';
      titleInput.value = '';
      descInput.value = '';
      descInput.style.height = 'auto';
      this.updateRelevanceButtonBadge();
      const btnToggleHook = document.getElementById('btn-toggle-tmpl-submission-hook');
      if (hookLabel) hookLabel.textContent = 'On-Submit Webhook';
      if (btnToggleHook) {
        btnToggleHook.classList.remove('has-hook');
        btnToggleHook.title = 'Configure automated on-submission webhook';
      }
      if (subMethod) subMethod.value = 'POST';
      if (subUrl) subUrl.value = '';
      if (subHeaders) subHeaders.value = '';
      if (subBody) subBody.value = '';
      this.addRootTaskNode();
    }

    this.setupDragAndDrop(treeContainer, '.todoist-task-node, .todoist-section-block');

    if (subDrawer) subDrawer.style.display = 'none';
    if (relevanceDrawer) relevanceDrawer.style.display = 'none';
    this.initHistory();
    helpers.openModal('modal-template-editor');

    // Auto-focus title or first task
    setTimeout(() => {
      if (!template && titleInput) {
        titleInput.focus();
      }
    }, 150);
  },

  addRootTaskNode() {
    const treeContainer = document.getElementById('tmpl-items-builder-tree');
    const item = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title: '',
      description: '',
      is_optional: false,
      has_automation: false,
      automation: null,
      children: []
    };
    const node = this.createItemNodeElement(item);
    treeContainer.appendChild(node);
    this.updateNodeShape(node);
    const titleInput = node.querySelector('.todoist-item-title-input');
    if (titleInput) titleInput.focus();
    if (!this.isUndoingRedoing) this.pushHistoryState();
    return node;
  },

  addSectionNode(sectionData = null, focusInput = true) {
    const treeContainer = document.getElementById('tmpl-items-builder-tree');
    const section = document.createElement('div');
    section.className = 'todoist-section-block';

    const defaultColor = this.googleDriveColors[15].hex; // Google Blue / Denim #4986e7
    const currentColor = (sectionData && sectionData.color) || defaultColor;
    const isOptional = Boolean(sectionData && (sectionData.is_optional || sectionData.optional));
    const title = sectionData ? this.decodeEntities(sectionData.title || '') : '';
    const days = Array.isArray(sectionData && sectionData.days) ? sectionData.days : [];
    const hasDays = days.length > 0;
    const daysLabel = hasDays ? days.join(', ') : 'Days';

    section.dataset.type = 'section';
    section.dataset.id = (sectionData && sectionData.id) || `sec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    section.dataset.color = currentColor;
    section.dataset.optional = isOptional ? 'true' : 'false';
    section.dataset.days = JSON.stringify(days);
    section.style.setProperty('--section-color', currentColor);

    section.innerHTML = `
      <div class="todoist-section-header">
        <span class="todoist-drag-handle" title="Drag section to reorder">⠿</span>
        <div class="section-color-picker-wrap">
          <button type="button" class="section-color-trigger-btn" style="background-color: ${currentColor};" title="Choose section color" aria-label="Choose section color"></button>
          <div class="section-color-popover" style="display:none;">
            <div class="section-color-grid">
              ${this.googleDriveColors.map(c => `
                <button type="button" class="section-color-dot ${c.hex.toLowerCase() === currentColor.toLowerCase() ? 'active' : ''}" data-color="${c.hex}" style="background-color: ${c.hex};" title="${c.name}"></button>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="tmpl-task-title-wrap" style="flex:1;">
          <span class="tmpl-section-day-badges">
            ${hasDays ? `<span class="tmpl-day-inline-badge section-badge">${days.join(', ')}</span>` : ''}
          </span>
          <input type="text" class="todoist-section-title-input tmpl-section-title" placeholder="Section Name (e.g. Rigging & Power)..." value="${helpers.escapeHtml(title)}">
        </div>
        <button type="button" class="btn-toggle-optional tmpl-btn-section-days ${hasDays ? 'has-days' : ''}" title="Configure Section Day Visibility">
          <span>📅</span>
          <span class="btn-section-days-label">${daysLabel}</span>
        </button>
        <button type="button" class="btn-toggle-optional tmpl-btn-section-optional ${isOptional ? 'is-optional' : ''}" title="Toggle section optionality">
          <span>⬠</span>
          <span class="btn-section-opt-label">${isOptional ? 'Optional' : 'Required'}</span>
        </button>
        <button type="button" class="btn-text-close tmpl-btn-delete-section" title="Delete section">&times;</button>
      </div>

      <!-- Compact Inline Section Day Dependency Drawer -->
      <div class="todoist-section-days-drawer tmpl-section-days-drawer" style="display:none;">
        <div style="font-size:0.75rem; font-weight:600; color:#c084fc; margin-bottom:0.45rem; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:0.35rem;">
            <span>📅</span>
            <span>SECTION DAY VISIBILITY DEPENDENCY</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.45rem;">
            <button type="button" class="btn btn-outline-secondary btn-xs tmpl-btn-clear-section-days" style="padding:0.15rem 0.45rem; font-size:0.7rem;" title="Visible every day">Every Day</button>
            <button type="button" class="btn-text-close tmpl-btn-close-section-days">&times;</button>
          </div>
        </div>
        <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.45rem;">
          When checklist is created, this entire section (and all its enclosed tasks) will only be added if created on selected days.
        </p>
        <div class="todoist-days-pill-group">
          ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `
            <button type="button" class="day-pill-btn ${days.includes(d) ? 'is-selected' : ''}" data-day="${d}">${d}</button>
          `).join('')}
        </div>
      </div>

      <div class="todoist-section-tasks-list tmpl-section-tasks"></div>
      <div style="margin-top:0.45rem;">
        <button type="button" class="todoist-add-task-btn tmpl-btn-add-section-task" style="font-size:0.8rem; padding:0.25rem 0.5rem;">
          <span class="todoist-add-plus">+</span>
          <span>Add task to section</span>
        </button>
      </div>
    `;

    const tasksContainer = section.querySelector('.tmpl-section-tasks');
    const titleInput = section.querySelector('.tmpl-section-title');
    const btnSectionOpt = section.querySelector('.tmpl-btn-section-optional');
    const btnDeleteSec = section.querySelector('.tmpl-btn-delete-section');
    const btnAddSecTask = section.querySelector('.tmpl-btn-add-section-task');
    const colorTrigger = section.querySelector('.section-color-trigger-btn');
    const colorPopover = section.querySelector('.section-color-popover');
    const btnSectionDays = section.querySelector('.tmpl-btn-section-days');
    const sectionDaysDrawer = section.querySelector('.tmpl-section-days-drawer');
    const btnCloseSecDays = section.querySelector('.tmpl-btn-close-section-days');
    const btnClearSecDays = section.querySelector('.tmpl-btn-clear-section-days');
    const secDaysBadgeWrap = section.querySelector('.tmpl-section-day-badges');
    const secDaysLabel = section.querySelector('.btn-section-days-label');

    const updateSectionDaysUi = () => {
      let currentDays = [];
      try {
        if (section.dataset.days) currentDays = JSON.parse(section.dataset.days);
      } catch (_) { }
      if (!Array.isArray(currentDays)) currentDays = [];

      const hasAny = currentDays.length > 0;
      if (btnSectionDays) {
        if (hasAny) {
          btnSectionDays.classList.add('has-days');
        } else {
          btnSectionDays.classList.remove('has-days');
        }
      }
      if (secDaysLabel) {
        secDaysLabel.textContent = hasAny ? currentDays.join(', ') : 'Days';
      }
      if (secDaysBadgeWrap) {
        secDaysBadgeWrap.innerHTML = hasAny ? `<span class="tmpl-day-inline-badge section-badge">${currentDays.join(', ')}</span>` : '';
      }

      section.querySelectorAll('.tmpl-section-days-drawer .day-pill-btn').forEach(pill => {
        const d = pill.dataset.day;
        if (currentDays.includes(d)) {
          pill.classList.add('is-selected');
        } else {
          pill.classList.remove('is-selected');
        }
      });
    };

    if (btnSectionDays) {
      btnSectionDays.addEventListener('click', () => {
        const isVisible = sectionDaysDrawer.style.display !== 'none';
        sectionDaysDrawer.style.display = isVisible ? 'none' : 'block';
      });
    }

    if (btnCloseSecDays) {
      btnCloseSecDays.addEventListener('click', () => {
        sectionDaysDrawer.style.display = 'none';
      });
    }

    if (titleInput) {
      titleInput.addEventListener('input', () => {
        if (!this.isUndoingRedoing) this.debouncedPushHistory();
      });
    }

    if (btnClearSecDays) {
      btnClearSecDays.addEventListener('click', () => {
        section.dataset.days = JSON.stringify([]);
        updateSectionDaysUi();
        if (!this.isUndoingRedoing) this.pushHistoryState();
      });
    }

    section.querySelectorAll('.tmpl-section-days-drawer .day-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const d = pill.dataset.day;
        let currentDays = [];
        try {
          if (section.dataset.days) currentDays = JSON.parse(section.dataset.days);
        } catch (_) { }
        if (!Array.isArray(currentDays)) currentDays = [];

        if (currentDays.includes(d)) {
          currentDays = currentDays.filter(day => day !== d);
        } else {
          currentDays.push(d);
          const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          currentDays.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
        }

        section.dataset.days = JSON.stringify(currentDays);
        updateSectionDaysUi();
        if (!this.isUndoingRedoing) this.pushHistoryState();
      });
    });

    // Color picker popover toggle
    colorTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = colorPopover.style.display === 'none';
      document.querySelectorAll('.section-color-popover').forEach(p => p.style.display = 'none');
      colorPopover.style.display = isHidden ? 'block' : 'none';
    });

    // Select color from Google Drive color palette
    section.querySelectorAll('.section-color-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const col = dot.dataset.color;
        section.dataset.color = col;
        section.style.setProperty('--section-color', col);
        colorTrigger.style.backgroundColor = col;
        section.querySelectorAll('.section-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        colorPopover.style.display = 'none';
        if (!this.isUndoingRedoing) this.pushHistoryState();
      });
    });

    // Toggle Section Optionality
    btnSectionOpt.addEventListener('click', () => {
      const currentOpt = section.dataset.optional === 'true';
      const newOpt = !currentOpt;
      section.dataset.optional = newOpt ? 'true' : 'false';
      btnSectionOpt.classList.toggle('is-optional', newOpt);
      section.querySelector('.btn-section-opt-label').textContent = newOpt ? 'Optional' : 'Required';
      this.updateAllSectionTaskShapes(section);
      if (!this.isUndoingRedoing) this.pushHistoryState();
    });

    // Delete Section
    btnDeleteSec.addEventListener('click', () => {
      section.remove();
      if (!this.isUndoingRedoing) this.pushHistoryState();
    });

    // Add task inside section
    btnAddSecTask.addEventListener('click', () => {
      const item = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: '',
        description: '',
        is_optional: false,
        has_automation: false,
        automation: null,
        children: []
      };
      const node = this.createItemNodeElement(item);
      tasksContainer.appendChild(node);
      this.updateNodeShape(node);
      node.querySelector('.tmpl-item-title')?.focus();
      if (!this.isUndoingRedoing) this.pushHistoryState();
    });

    // Populate existing tasks inside section
    if (sectionData && Array.isArray(sectionData.items)) {
      sectionData.items.forEach(it => {
        tasksContainer.appendChild(this.createItemNodeElement(it));
      });
    }

    if (focusInput) {
      // Place in the middle of checklist if currently focused on a task / section, else append
      const activeEl = document.activeElement;
      const activeTopNode = activeEl && activeEl.closest('#tmpl-items-builder-tree > *');
      if (activeTopNode && activeTopNode.parentNode === treeContainer) {
        activeTopNode.after(section);
      } else {
        treeContainer.appendChild(section);
      }
      setTimeout(() => titleInput?.focus(), 50);
      if (!this.isUndoingRedoing) this.pushHistoryState();
    }

    return section;
  },

  createItemNodeElement(item) {
    const node = document.createElement('div');
    node.className = 'todoist-task-node';
    node.dataset.id = item.id || `item_${Date.now()}`;
    node.dataset.optional = Boolean(item.is_optional || item.optional) ? 'true' : 'false';

    const days = Array.isArray(item.days) ? item.days : [];
    node.dataset.days = JSON.stringify(days);
    const hasDays = days.length > 0;
    const daysLabel = hasDays ? days.join(', ') : 'Days';

    const hasAuto = Boolean(item.has_automation && item.automation && item.automation.url);
    const autoMethod = (hasAuto && item.automation.method) ? item.automation.method : 'GET';
    const autoUrl = (hasAuto && item.automation.url) ? item.automation.url : '';
    const autoHeaders = (hasAuto && item.automation.headers) ? item.automation.headers : '';
    const autoBody = (hasAuto && item.automation.body) ? item.automation.body : '';

    const cleanTitle = this.decodeEntities(item.title || '');
    const cleanDesc = this.decodeEntities(item.description || '');

    node.innerHTML = `
      <div class="todoist-task-row">
        <span class="todoist-drag-handle" title="Drag to reorder">⠿</span>
        <div class="todoist-circle" title="Task"></div>
        <div class="todoist-inputs-group">
          <div class="tmpl-task-title-wrap">
            <span class="tmpl-task-day-badges">
              ${hasDays ? `<span class="tmpl-day-inline-badge">${days.join(', ')}</span>` : ''}
            </span>
            <textarea class="todoist-item-title-input tmpl-item-title" rows="1" placeholder="Task name..." autocomplete="off" required></textarea>
          </div>
          <textarea class="todoist-item-desc-input tmpl-item-desc" rows="1" placeholder="Add note or instruction (optional)..." autocomplete="off"></textarea>
        </div>
        
        <!-- Desktop Hover Actions -->
        <div class="todoist-actions-bar">
          <button type="button" class="todoist-btn-action tmpl-btn-toggle-optional" title="Toggle task optionality">
            <span class="btn-icon">⬠</span>
            <span class="btn-text">Req</span>
          </button>
          <button type="button" class="todoist-btn-action tmpl-btn-add-subtask" title="Add nested subtask">
            <span class="btn-icon">↳</span>
            <span class="btn-text">Subtask</span>
          </button>
          <button type="button" class="todoist-btn-action tmpl-btn-toggle-auto ${hasAuto ? 'has-hook' : ''}" title="Configure HTTP Webhook">
            <span class="btn-icon">⚡</span>
            <span class="btn-text">${hasAuto ? 'Hooked' : 'Hook'}</span>
          </button>
          <button type="button" class="todoist-btn-action tmpl-btn-toggle-days ${hasDays ? 'has-days' : ''}" title="Configure Day Visibility Dependency">
            <span class="btn-icon">📅</span>
            <span class="btn-text tmpl-days-btn-text">${daysLabel}</span>
          </button>
          <button type="button" class="todoist-btn-delete tmpl-btn-delete-node" title="Delete task">&times;</button>
        </div>

        <!-- Mobile 3-Dots Action Button -->
        <button type="button" class="todoist-btn-more-menu tmpl-btn-mobile-more" title="Task options">•••</button>
      </div>

      <!-- Compact Inline Webhook Drawer -->
      <div class="todoist-task-webhook-drawer tmpl-automation-drawer" style="display:none;">
        <div style="font-size:0.75rem; font-weight:600; color:var(--accent-secondary); margin-bottom:0.45rem; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:0.35rem;">
            <span>⚡</span>
            <span>TASK-LEVEL cURL WEBHOOK</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.45rem;">
            <button type="button" class="btn btn-outline-danger btn-xs tmpl-btn-remove-hook" style="padding:0.15rem 0.45rem; font-size:0.7rem; display:inline-flex; align-items:center; gap:0.25rem;" title="Remove this webhook">
              <span>🗑️</span>
              <span>Remove Hook</span>
            </button>
            <button type="button" class="btn-text-close tmpl-btn-close-auto-drawer">&times;</button>
          </div>
        </div>
        <div style="display:flex; gap:0.4rem; margin-bottom:0.35rem;">
          <select class="form-select tmpl-auto-method" style="width: 95px; font-size:0.775rem;">
            <option value="GET" ${autoMethod === 'GET' ? 'selected' : ''}>GET</option>
            <option value="POST" ${autoMethod === 'POST' ? 'selected' : ''}>POST</option>
            <option value="PUT" ${autoMethod === 'PUT' ? 'selected' : ''}>PUT</option>
            <option value="PATCH" ${autoMethod === 'PATCH' ? 'selected' : ''}>PATCH</option>
            <option value="DELETE" ${autoMethod === 'DELETE' ? 'selected' : ''}>DELETE</option>
          </select>
          <input type="url" class="form-control tmpl-auto-url" placeholder="https://api.example.com/v1/stage/unmute" value="${helpers.escapeHtml(autoUrl)}" style="font-size:0.775rem;">
        </div>
        <input type="text" class="form-control tmpl-auto-headers" placeholder='Headers JSON e.g. {"Authorization": "Bearer key"}' value="${helpers.escapeHtml(autoHeaders)}" style="font-size:0.725rem; font-family:var(--font-mono); margin-bottom:0.35rem;">
        <textarea class="form-textarea tmpl-auto-body" placeholder="Optional Body Payload" style="font-size:0.725rem; font-family:var(--font-mono); min-height:45px;">${helpers.escapeHtml(autoBody)}</textarea>
      </div>

      <!-- Compact Inline Day Dependency Drawer -->
      <div class="todoist-task-days-drawer tmpl-days-drawer" style="display:none;">
        <div style="font-size:0.75rem; font-weight:600; color:#c084fc; margin-bottom:0.45rem; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:0.35rem;">
            <span>📅</span>
            <span>DAY VISIBILITY DEPENDENCY</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.45rem;">
            <button type="button" class="btn btn-outline-secondary btn-xs tmpl-btn-clear-days" style="padding:0.15rem 0.45rem; font-size:0.7rem;" title="Visible every day">Every Day</button>
            <button type="button" class="btn-text-close tmpl-btn-close-days-drawer">&times;</button>
          </div>
        </div>
        <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.45rem;">
          When checklist is created, this task is only added if created on selected days. If no days selected, it is added every day.
        </p>
        <div class="todoist-days-pill-group">
          ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `
            <button type="button" class="day-pill-btn ${days.includes(d) ? 'is-selected' : ''}" data-day="${d}">${d}</button>
          `).join('')}
        </div>
      </div>

      <!-- Nested Subtasks Container -->
      <div class="todoist-children-container tmpl-children-container"></div>
    `;

    const childrenContainer = node.querySelector('.tmpl-children-container');
    const titleInput = node.querySelector('.tmpl-item-title');
    const descInput = node.querySelector('.tmpl-item-desc');
    const autoDrawer = node.querySelector('.tmpl-automation-drawer');
    const btnToggleAuto = node.querySelector('.tmpl-btn-toggle-auto');
    const btnCloseAuto = node.querySelector('.tmpl-btn-close-auto-drawer');
    const btnAddSubtask = node.querySelector('.tmpl-btn-add-subtask');
    const btnToggleOpt = node.querySelector('.tmpl-btn-toggle-optional');
    const btnDelete = node.querySelector('.tmpl-btn-delete-node');
    const autoUrlInput = node.querySelector('.tmpl-auto-url');
    const btnMobileMore = node.querySelector('.tmpl-btn-mobile-more');

    // Auto-resizing textarea helper
    const resizeTextarea = (el) => {
      if (!el) return;
      el.style.height = 'auto';
      const minH = el.classList.contains('tmpl-item-title') ? 22 : 18;
      el.style.height = Math.max(minH, el.scrollHeight) + 'px';
    };

    // Assign decoded values and trigger sizing
    titleInput.value = cleanTitle;
    descInput.value = cleanDesc;
    setTimeout(() => {
      resizeTextarea(titleInput);
      if (cleanDesc) resizeTextarea(descInput);
    }, 0);

    titleInput.addEventListener('input', () => {
      resizeTextarea(titleInput);
      if (!this.isUndoingRedoing) this.debouncedPushHistory();
    });
    descInput.addEventListener('input', () => {
      resizeTextarea(descInput);
      if (!this.isUndoingRedoing) this.debouncedPushHistory();
    });

    // Populate existing children
    if (item.children && item.children.length > 0) {
      item.children.forEach(child => {
        childrenContainer.appendChild(this.createItemNodeElement(child));
      });
    }

    // Keyboard Flow: Enter key creates a new sibling task below
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const siblingItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          title: '',
          description: '',
          is_optional: false,
          has_automation: false,
          automation: null,
          children: []
        };
        const siblingNode = this.createItemNodeElement(siblingItem);
        node.after(siblingNode);
        this.updateNodeShape(siblingNode);
        const nextTitleInput = siblingNode.querySelector('.tmpl-item-title');
        if (nextTitleInput) nextTitleInput.focus();
        if (!this.isUndoingRedoing) this.pushHistoryState();
      } else if (e.key === 'Backspace' && titleInput.value === '' && descInput.value === '' && childrenContainer.children.length === 0) {
        e.preventDefault();
        const prevNode = node.previousElementSibling;
        const parentNode = node.parentElement?.closest('.todoist-task-node');
        node.remove();
        if (prevNode) {
          prevNode.querySelector('.tmpl-item-title')?.focus();
        } else if (parentNode) {
          parentNode.querySelector('.tmpl-item-title')?.focus();
        }
        if (!this.isUndoingRedoing) this.pushHistoryState();
      }
    });

    // Subtask button
    btnAddSubtask.addEventListener('click', () => {
      const childItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: '',
        description: '',
        is_optional: false,
        has_automation: false,
        automation: null,
        children: []
      };
      const childNode = this.createItemNodeElement(childItem);
      childrenContainer.appendChild(childNode);
      this.updateNodeShape(childNode);
      const childTitleInput = childNode.querySelector('.tmpl-item-title');
      if (childTitleInput) childTitleInput.focus();
      if (!this.isUndoingRedoing) this.pushHistoryState();
    });

    // Toggle Optionality button (Desktop)
    if (btnToggleOpt) {
      btnToggleOpt.addEventListener('click', () => {
        const isCurrentOpt = node.dataset.optional === 'true';
        node.dataset.optional = (!isCurrentOpt).toString();
        this.updateNodeShape(node);
        if (!this.isUndoingRedoing) this.pushHistoryState();
      });
    }

    // Webhook toggle
    btnToggleAuto.addEventListener('click', () => {
      const isVisible = autoDrawer.style.display !== 'none';
      autoDrawer.style.display = isVisible ? 'none' : 'block';
    });

    if (btnCloseAuto) {
      btnCloseAuto.addEventListener('click', () => {
        autoDrawer.style.display = 'none';
      });
    }

    const btnRemoveAuto = node.querySelector('.tmpl-btn-remove-hook');
    const autoHeadersInput = node.querySelector('.tmpl-auto-headers');
    const autoBodyInput = node.querySelector('.tmpl-auto-body');
    const autoMethodSelect = node.querySelector('.tmpl-auto-method');

    if (btnRemoveAuto) {
      btnRemoveAuto.addEventListener('click', () => {
        if (autoUrlInput) autoUrlInput.value = '';
        if (autoHeadersInput) autoHeadersInput.value = '';
        if (autoBodyInput) autoBodyInput.value = '';
        if (autoMethodSelect) autoMethodSelect.value = 'GET';
        btnToggleAuto.classList.remove('has-hook');
        btnToggleAuto.innerHTML = '⚡ Hook';
        this.updateNodeShape(node);
        autoDrawer.style.display = 'none';
        if (!this.isUndoingRedoing) this.pushHistoryState();
      });
    }

    if (autoUrlInput) {
      autoUrlInput.addEventListener('input', () => {
        const val = autoUrlInput.value.trim();
        if (val) {
          btnToggleAuto.classList.add('has-hook');
          btnToggleAuto.innerHTML = '⚡ Hooked';
        } else {
          btnToggleAuto.classList.remove('has-hook');
          btnToggleAuto.innerHTML = '⚡ Hook';
        }
        this.updateNodeShape(node);
      });
    }

    // Days Visibility Dependency Controls
    const daysDrawer = node.querySelector('.tmpl-days-drawer');
    const btnToggleDays = node.querySelector('.tmpl-btn-toggle-days');
    const btnCloseDays = node.querySelector('.tmpl-btn-close-days-drawer');
    const btnClearDays = node.querySelector('.tmpl-btn-clear-days');
    const daysBtnText = node.querySelector('.tmpl-days-btn-text');
    const taskDayBadges = node.querySelector('.tmpl-task-day-badges');

    const updateDaysUi = () => {
      let currentDays = [];
      try {
        if (node.dataset.days) currentDays = JSON.parse(node.dataset.days);
      } catch (_) { }
      if (!Array.isArray(currentDays)) currentDays = [];

      const hasAny = currentDays.length > 0;
      if (btnToggleDays) {
        if (hasAny) {
          btnToggleDays.classList.add('has-days');
        } else {
          btnToggleDays.classList.remove('has-days');
        }
      }
      if (daysBtnText) {
        daysBtnText.textContent = hasAny ? currentDays.join(', ') : 'Days';
      }
      if (taskDayBadges) {
        taskDayBadges.innerHTML = hasAny ? `<span class="tmpl-day-inline-badge">${currentDays.join(', ')}</span>` : '';
      }

      node.querySelectorAll('.day-pill-btn').forEach(pill => {
        const d = pill.dataset.day;
        if (currentDays.includes(d)) {
          pill.classList.add('is-selected');
        } else {
          pill.classList.remove('is-selected');
        }
      });
    };

    if (btnToggleDays) {
      btnToggleDays.addEventListener('click', () => {
        const isVisible = daysDrawer.style.display !== 'none';
        daysDrawer.style.display = isVisible ? 'none' : 'block';
      });
    }

    if (btnCloseDays) {
      btnCloseDays.addEventListener('click', () => {
        daysDrawer.style.display = 'none';
      });
    }

    if (btnClearDays) {
      btnClearDays.addEventListener('click', () => {
        node.dataset.days = JSON.stringify([]);
        updateDaysUi();
        if (!this.isUndoingRedoing) this.pushHistoryState();
      });
    }

    node.querySelectorAll('.day-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const d = pill.dataset.day;
        let currentDays = [];
        try {
          if (node.dataset.days) currentDays = JSON.parse(node.dataset.days);
        } catch (_) { }
        if (!Array.isArray(currentDays)) currentDays = [];

        if (currentDays.includes(d)) {
          currentDays = currentDays.filter(day => day !== d);
        } else {
          currentDays.push(d);
          const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          currentDays.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
        }

        node.dataset.days = JSON.stringify(currentDays);
        updateDaysUi();
        if (!this.isUndoingRedoing) this.pushHistoryState();
      });
    });

    // Mobile More button
    if (btnMobileMore) {
      btnMobileMore.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openActionSheet(node);
      });
    }

    // Delete task
    btnDelete.addEventListener('click', () => {
      node.remove();
      if (!this.isUndoingRedoing) this.pushHistoryState();
    });

    // Initial shape update
    this.updateNodeShape(node);

    return node;
  },

  setupDragAndDrop(treeContainer) {
    if (!treeContainer || treeContainer._hasPointerDndBound) return;
    treeContainer._hasPointerDndBound = true;

    let draggedItem = null;
    let isSection = false;
    let dragGhost = null;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let activePointerId = null;
    let autoScrollRaf = null;
    let currentDropTarget = null;
    let currentDropPos = null; // 'above', 'below', 'inside', 'append'

    const getScrollContainer = () => {
      return document.querySelector('#modal-template-editor .todoist-editor-body') || treeContainer.closest('.todoist-editor-body');
    };

    const cleanupIndicators = () => {
      document.querySelectorAll('.drag-target-above, .drag-target-below, .drag-target-inside').forEach(el => {
        el.classList.remove('drag-target-above', 'drag-target-below', 'drag-target-inside');
      });
    };

    const stopAutoScroll = () => {
      if (autoScrollRaf) {
        cancelAnimationFrame(autoScrollRaf);
        autoScrollRaf = null;
      }
    };

    const findDropTarget = (x, y) => {
      if (!draggedItem) return null;

      cleanupIndicators();

      if (isSection) {
        // Reordering Sections anywhere within treeContainer (relative to any root item: section or root task)
        const topLevelItems = Array.from(treeContainer.children).filter(el => {
          return el !== draggedItem && (el.classList.contains('todoist-section-block') || el.classList.contains('todoist-task-node'));
        });

        if (topLevelItems.length === 0) {
          return { target: treeContainer, position: 'append' };
        }

        for (const item of topLevelItems) {
          const rect = item.getBoundingClientRect();
          if (y >= rect.top - 15 && y <= rect.bottom + 15) {
            const isBelow = (y - rect.top) / rect.height > 0.5;
            item.classList.add(isBelow ? 'drag-target-below' : 'drag-target-above');
            return { target: item, position: isBelow ? 'below' : 'above' };
          }
        }

        const first = topLevelItems[0];
        const last = topLevelItems[topLevelItems.length - 1];
        if (first && y < first.getBoundingClientRect().top) {
          first.classList.add('drag-target-above');
          return { target: first, position: 'above' };
        }
        if (last && y > last.getBoundingClientRect().bottom) {
          last.classList.add('drag-target-below');
          return { target: last, position: 'below' };
        }

        let closest = null;
        let minDist = Infinity;
        let pos = 'below';
        for (const item of topLevelItems) {
          const rect = item.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const dist = Math.abs(y - centerY);
          if (dist < minDist) {
            minDist = dist;
            closest = item;
            pos = y > centerY ? 'below' : 'above';
          }
        }
        if (closest) {
          closest.classList.add(pos === 'below' ? 'drag-target-below' : 'drag-target-above');
          return { target: closest, position: pos };
        }
        return null;
      }

      // Reordering Tasks
      // 1. Check sections for placing tasks before/after section or into section tasks list
      const allSectionBlocks = Array.from(treeContainer.querySelectorAll('.todoist-section-block'));
      for (const sBlock of allSectionBlocks) {
        const sRect = sBlock.getBoundingClientRect();
        const sHeader = sBlock.querySelector('.todoist-section-header');
        const hRect = sHeader ? sHeader.getBoundingClientRect() : sRect;
        const sTasksList = sBlock.querySelector('.tmpl-section-tasks');

        // Above section header -> drop before section at root level
        if (y >= sRect.top - 14 && y <= hRect.top + hRect.height * 0.4) {
          sBlock.classList.add('drag-target-above');
          return { target: sBlock, position: 'above' };
        }

        // Inside section with empty task list -> drop inside section
        if (sTasksList && sTasksList.children.length === 0 && y > hRect.top && y <= sRect.bottom - 10) {
          sTasksList.classList.add('drag-target-inside');
          return { target: sTasksList, position: 'inside' };
        }

        // Below section -> drop after section at root level
        if (y >= sRect.bottom - 12 && y <= sRect.bottom + 14) {
          sBlock.classList.add('drag-target-below');
          return { target: sBlock, position: 'below' };
        }
      }

      // 2. Find all candidate task nodes in tree (excluding self and any of its descendants)
      const allTasks = Array.from(treeContainer.querySelectorAll('.todoist-task-node')).filter(node => {
        return node !== draggedItem && !draggedItem.contains(node);
      });

      if (allTasks.length === 0 && allSectionBlocks.length === 0) {
        return { target: treeContainer, position: 'append' };
      }

      let closestTarget = null;
      let minDistance = Infinity;
      let closestPos = 'below';

      for (const task of allTasks) {
        const row = task.querySelector(':scope > .todoist-task-row') || task;
        const rect = row.getBoundingClientRect();

        if (y >= rect.top - 6 && y <= rect.bottom + 6) {
          // Nesting as subtask: if cursor is shifted to the right or in the vertical center band
          const isNestZone = (x > rect.left + 35) && (y >= rect.top + rect.height * 0.2 && y <= rect.bottom - rect.height * 0.2);
          if (isNestZone) {
            task.classList.add('drag-target-inside');
            const childrenContainer = task.querySelector(':scope > .tmpl-children-container');
            return { target: childrenContainer || task, position: 'inside' };
          }

          const isBelow = (y - rect.top) / rect.height > 0.5;
          task.classList.add(isBelow ? 'drag-target-below' : 'drag-target-above');
          return { target: task, position: isBelow ? 'below' : 'above' };
        }

        const centerY = rect.top + rect.height / 2;
        const dist = Math.abs(y - centerY);
        if (dist < minDistance) {
          minDistance = dist;
          closestTarget = task;
          closestPos = y > centerY ? 'below' : 'above';
        }
      }

      // 3. If dragging below the last element in treeContainer
      const treeRect = treeContainer.getBoundingClientRect();
      if (y > treeRect.bottom - 25) {
        return { target: treeContainer, position: 'append' };
      }

      if (closestTarget) {
        closestTarget.classList.add(closestPos === 'below' ? 'drag-target-below' : 'drag-target-above');
        return { target: closestTarget, position: closestPos };
      }

      return { target: treeContainer, position: 'append' };
    };

    const runAutoScroll = () => {
      if (!isDragging || !draggedItem) {
        stopAutoScroll();
        return;
      }

      const scrollContainer = getScrollContainer();

      if (scrollContainer) {
        const sRect = scrollContainer.getBoundingClientRect();
        const edgeZone = Math.min(85, sRect.height * 0.28);
        let delta = 0;

        if (currentY < sRect.top + edgeZone && currentY >= sRect.top - 60) {
          const proximity = Math.max(0, 1 - (currentY - sRect.top) / edgeZone);
          delta = -Math.round(2 + Math.min(22, proximity * 20));
        } else if (currentY > sRect.bottom - edgeZone && currentY <= sRect.bottom + 60) {
          const proximity = Math.max(0, 1 - (sRect.bottom - currentY) / edgeZone);
          delta = Math.round(2 + Math.min(22, proximity * 20));
        }

        if (delta !== 0) {
          scrollContainer.scrollTop += delta;
        }
      }

      // Also scroll viewport if near window edge (mobile / small screens)
      if (window.innerHeight) {
        if (currentY < 50) {
          window.scrollBy(0, -6);
        } else if (currentY > window.innerHeight - 50) {
          window.scrollBy(0, 6);
        }
      }

      // Continuously refresh drop target calculation during scroll
      const res = findDropTarget(currentX, currentY);
      if (res) {
        currentDropTarget = res.target;
        currentDropPos = res.position;
      }

      autoScrollRaf = requestAnimationFrame(runAutoScroll);
    };

    const handlePointerMove = (e) => {
      if (activePointerId === null || e.pointerId !== activePointerId) return;

      currentX = e.clientX;
      currentY = e.clientY;

      if (!isDragging) {
        const dist = Math.hypot(currentX - startX, currentY - startY);
        if (dist < 4) return;

        isDragging = true;
        draggedItem.classList.add('is-dragging');

        const itemRect = draggedItem.getBoundingClientRect();
        offsetX = Math.min(Math.max(currentX - itemRect.left, 20), itemRect.width - 20);
        offsetY = Math.min(Math.max(currentY - itemRect.top, 15), 35);

        dragGhost = document.createElement('div');
        dragGhost.className = 'todoist-drag-ghost';
        const titleText = isSection
          ? (draggedItem.querySelector('.tmpl-section-title')?.value || 'Untitled Section')
          : (draggedItem.querySelector('.tmpl-item-title')?.value || 'Untitled Task');

        dragGhost.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.6rem; padding:0.55rem 0.85rem;">
            <span style="color:var(--accent-primary); font-size:1.15rem; line-height:1;">⠿</span>
            <span style="font-size:0.875rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;">${helpers.escapeHtml(titleText)}</span>
            ${isSection ? '<span class="badge badge-purple" style="font-size:0.65rem; margin-left:auto;">Section</span>' : ''}
          </div>
        `;
        dragGhost.style.left = `${currentX - offsetX}px`;
        dragGhost.style.top = `${currentY - offsetY}px`;
        dragGhost.style.width = `${Math.min(Math.max(itemRect.width, 240), 400)}px`;
        document.body.appendChild(dragGhost);

        if (navigator.vibrate) navigator.vibrate(20);
        runAutoScroll();
      }

      if (dragGhost) {
        dragGhost.style.left = `${currentX - offsetX}px`;
        dragGhost.style.top = `${currentY - offsetY}px`;
      }
    };

    const endDrag = (commit = true) => {
      stopAutoScroll();

      if (dragGhost) {
        dragGhost.remove();
        dragGhost = null;
      }

      if (draggedItem) {
        draggedItem.classList.remove('is-dragging');
        const handle = draggedItem.querySelector('.todoist-drag-handle');
        if (handle) handle.classList.remove('is-active-drag');
      }

      cleanupIndicators();

      if (commit && isDragging && draggedItem && currentDropTarget) {
        try {
          if (currentDropPos === 'above') {
            currentDropTarget.parentNode.insertBefore(draggedItem, currentDropTarget);
          } else if (currentDropPos === 'below') {
            currentDropTarget.parentNode.insertBefore(draggedItem, currentDropTarget.nextSibling);
          } else if (currentDropPos === 'inside') {
            currentDropTarget.appendChild(draggedItem);
          } else if (currentDropPos === 'append') {
            treeContainer.appendChild(draggedItem);
          }

          if (!isSection) {
            templatesView.updateNodeShape(draggedItem);
            const parentTask = draggedItem.parentElement?.closest('.todoist-task-node');
            if (parentTask) templatesView.updateNodeShape(parentTask);
            const sec = draggedItem.closest('.todoist-section-block');
            if (sec) templatesView.updateAllSectionTaskShapes(sec);
          }

          templatesView.pushHistoryState();

          if (navigator.vibrate) navigator.vibrate(15);
        } catch (err) {
          console.warn('Drag drop placement error:', err);
        }
      }

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleKeyDown);

      draggedItem = null;
      isDragging = false;
      activePointerId = null;
      currentDropTarget = null;
      currentDropPos = null;
    };

    const handlePointerUp = (e) => {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        endDrag(true);
      }
    };

    const handlePointerCancel = (e) => {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        endDrag(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDragging) {
        endDrag(false);
      }
    };

    // Pointerdown listener attached via delegation to treeContainer
    treeContainer.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.todoist-drag-handle');
      if (!handle) return;

      if (e.button !== undefined && e.button !== 0) return;

      const item = handle.closest('.todoist-task-node, .todoist-section-block');
      if (!item) return;

      e.preventDefault();

      draggedItem = item;
      isSection = item.classList.contains('todoist-section-block');
      startX = e.clientX;
      startY = e.clientY;
      currentX = startX;
      currentY = startY;
      activePointerId = e.pointerId;
      isDragging = false;
      handle.classList.add('is-active-drag');

      window.addEventListener('pointermove', handlePointerMove, { passive: false });
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerCancel);
      window.addEventListener('keydown', handleKeyDown);
    });
  },

  serializeItemNode(node) {
    const titleInput = node.querySelector(':scope > .todoist-task-row .tmpl-item-title');
    if (!titleInput) return null;
    const title = this.decodeEntities(titleInput.value.trim());
    if (!title) return null;

    const descInput = node.querySelector(':scope > .todoist-task-row .tmpl-item-desc');
    const description = descInput ? this.decodeEntities(descInput.value.trim()) : '';

    const autoUrlInput = node.querySelector(':scope > .tmpl-automation-drawer .tmpl-auto-url');
    const autoUrl = autoUrlInput ? autoUrlInput.value.trim() : '';

    let automation = null;
    let hasAuto = false;

    if (autoUrl) {
      hasAuto = true;
      automation = {
        method: node.querySelector(':scope > .tmpl-automation-drawer .tmpl-auto-method')?.value || 'GET',
        url: autoUrl,
        headers: node.querySelector(':scope > .tmpl-automation-drawer .tmpl-auto-headers')?.value.trim() || '',
        body: node.querySelector(':scope > .tmpl-automation-drawer .tmpl-auto-body')?.value.trim() || ''
      };
    }

    const isOptional = node.dataset.optional === 'true';

    const children = [];
    const childrenContainer = node.querySelector(':scope > .tmpl-children-container');
    if (childrenContainer) {
      Array.from(childrenContainer.children).forEach(childNode => {
        if (childNode.classList.contains('todoist-task-node')) {
          const serializedChild = this.serializeItemNode(childNode);
          if (serializedChild) children.push(serializedChild);
        }
      });
    }

    let days = [];
    try {
      if (node.dataset.days) days = JSON.parse(node.dataset.days);
    } catch (_) { }
    if (!Array.isArray(days)) days = [];

    return {
      id: node.dataset.id || `item_${Date.now()}`,
      type: 'task',
      title,
      description,
      is_optional: isOptional,
      days,
      has_automation: hasAuto,
      automation,
      children
    };
  },

  serializeCanvas() {
    const treeContainer = document.getElementById('tmpl-items-builder-tree');
    if (!treeContainer) return [];
    const items = [];

    Array.from(treeContainer.children).forEach(node => {
      if (node.classList.contains('todoist-section-block')) {
        const titleInput = node.querySelector('.tmpl-section-title');
        const title = this.decodeEntities(titleInput ? titleInput.value.trim() : 'Untitled Section');
        const color = node.dataset.color || '#58a6ff';
        const isOptional = node.dataset.optional === 'true';
        let secDays = [];
        try {
          if (node.dataset.days) secDays = JSON.parse(node.dataset.days);
        } catch (_) { }
        if (!Array.isArray(secDays)) secDays = [];

        const secTasks = [];
        const tasksContainer = node.querySelector('.tmpl-section-tasks');
        if (tasksContainer) {
          Array.from(tasksContainer.children).forEach(taskNode => {
            if (taskNode.classList.contains('todoist-task-node')) {
              const serializedTask = this.serializeItemNode(taskNode);
              if (serializedTask) secTasks.push(serializedTask);
            }
          });
        }

        items.push({
          id: node.dataset.id || `sec_${Date.now()}`,
          type: 'section',
          title: title || 'Untitled Section',
          color,
          is_optional: isOptional,
          days: secDays,
          items: secTasks
        });
      } else if (node.classList.contains('todoist-task-node')) {
        const serialized = this.serializeItemNode(node);
        if (serialized) items.push(serialized);
      }
    });

    return items;
  },

  async handleSaveTemplate() {
    const id = document.getElementById('tmpl-edit-id').value;
    const title = this.decodeEntities(document.getElementById('tmpl-edit-title').value.trim());
    const description = this.decodeEntities(document.getElementById('tmpl-edit-desc').value.trim());

    if (!title) {
      helpers.showToast('Please specify a template title.', 'error');
      document.getElementById('tmpl-edit-title')?.focus();
      return;
    }

    const items = this.serializeCanvas();

    if (items.length === 0) {
      helpers.showToast('Please add at least one task or section to the template.', 'error');
      return;
    }

    // Extract Submission Automation Webhook if configured
    const subUrl = document.getElementById('tmpl-sub-auto-url')?.value.trim();
    let submission_automation = null;

    if (subUrl) {
      submission_automation = {
        enabled: true,
        method: document.getElementById('tmpl-sub-auto-method').value || 'POST',
        url: subUrl,
        headers: document.getElementById('tmpl-sub-auto-headers')?.value.trim() || '',
        body: document.getElementById('tmpl-sub-auto-body')?.value.trim() || ''
      };
    }

    // Extract smart relevance schedule rules
    const schedules = this.serializeRelevanceRules();

    try {
      if (id) {
        await api.templates.update(id, { title, description, items, submission_automation, schedules });
        helpers.showToast('Template updated successfully!', 'success');
      } else {
        await api.templates.create({ title, description, items, submission_automation, schedules });
        helpers.showToast('Template created successfully!', 'success');
      }
      helpers.closeModal('modal-template-editor');
      this.loadTemplates();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to save template', 'error');
    }
  }
};

window.templatesView = templatesView;

