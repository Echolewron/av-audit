// Active Checklists & Execution View Controller (with Integrated Templates Tab)
const checklistsView = {
  checklists: [],
  currentChecklist: null,
  activeViewers: [],
  activeSubTab: 'active', // 'active' or 'templates'

  init() {
    this.bindEvents();
    this.bindSocketEvents();
  },

  bindEvents() {
    const btnConfirmInstantiate = document.getElementById('btn-confirm-instantiate');
    const btnBackToGrid = document.getElementById('btn-back-to-grid');
    const btnSubmitChecklist = document.getElementById('btn-submit-checklist');
    const btnUnsubmitChecklist = document.getElementById('btn-unsubmit-checklist');
    const btnDeleteChecklist = document.getElementById('btn-delete-checklist');
    const btnDeleteAllChecklists = document.getElementById('btn-delete-all-checklists');
    const btnShareChecklist = document.getElementById('btn-share-checklist');

    // Sub-tab buttons
    const tabActive = document.getElementById('tab-btn-active-checklists');
    const tabTemplates = document.getElementById('tab-btn-checklist-templates');

    if (tabActive) {
      tabActive.addEventListener('click', () => {
        this.switchSubTab('active');
      });
    }

    if (tabTemplates) {
      tabTemplates.addEventListener('click', () => {
        this.switchSubTab('templates');
      });
    }

    if (btnBackToGrid) {
      btnBackToGrid.addEventListener('click', () => this.closeExecutionView());
    }

    if (btnShareChecklist) {
      btnShareChecklist.addEventListener('click', () => this.handleShareChecklist());
    }

    if (btnUnsubmitChecklist) {
      btnUnsubmitChecklist.addEventListener('click', () => this.handleUnsubmitChecklist());
    }

    if (btnDeleteChecklist) {
      btnDeleteChecklist.addEventListener('click', () => this.handleDeleteChecklist());
    }

    if (btnDeleteAllChecklists) {
      btnDeleteAllChecklists.addEventListener('click', () => this.handleDeleteAllChecklists());
    }

    // Dismiss checker popover when clicking outside or pressing Escape
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.task-checked-badge-wrap')) {
        document.querySelectorAll('.checker-popover-menu.is-open').forEach(p => p.classList.remove('is-open'));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.checker-popover-menu.is-open').forEach(p => p.classList.remove('is-open'));
      }
    });
  },

  switchSubTab(tab) {
    this.activeSubTab = tab;
    const tabActive = document.getElementById('tab-btn-active-checklists');
    const tabTemplates = document.getElementById('tab-btn-checklist-templates');
    const paneActive = document.getElementById('pane-active-checklists');
    const paneTemplates = document.getElementById('pane-templates-management');

    if (tab === 'active') {
      if (tabActive) tabActive.classList.add('active');
      if (tabTemplates) tabTemplates.classList.remove('active');
      if (paneActive) paneActive.style.display = 'block';
      if (paneTemplates) paneTemplates.style.display = 'none';
      this.loadChecklists();
    } else {
      if (tabActive) tabActive.classList.remove('active');
      if (tabTemplates) tabTemplates.classList.add('active');
      if (paneActive) paneActive.style.display = 'none';
      if (paneTemplates) paneTemplates.style.display = 'block';
      window.templatesView.loadTemplates();
    }
  },

  bindSocketEvents() {
    window.addEventListener('socket_checklist_created', (e) => {
      this.loadChecklists();
    });

    window.addEventListener('socket_checklist_card_updated', (e) => {
      const { id, progress, status, has_blocked } = e.detail;
      const card = document.querySelector(`.checklist-card[data-id="${id}"]`);
      if (card) {
        const ringEl = card.querySelector('.progress-ring-container');
        if (ringEl) ringEl.innerHTML = helpers.renderCircularProgress(progress, has_blocked, 52);

        const tagEl = card.querySelector('.card-tag-status');
        if (tagEl) {
          if (status === 'SUBMITTED') {
            tagEl.className = 'badge badge-info card-tag-status';
            tagEl.textContent = 'Submitted';
          } else if (has_blocked) {
            tagEl.className = 'badge badge-danger card-tag-status';
            tagEl.textContent = 'Blocked Items';
          } else {
            tagEl.className = 'badge badge-success card-tag-status';
            tagEl.textContent = 'In-Progress';
          }
        }
      }
    });

    window.addEventListener('socket_checklist_updated', (e) => {
      if (this.currentChecklist && this.currentChecklist.id === e.detail.id) {
        if (this.hasChecklistDifferences(this.currentChecklist, e.detail)) {
          this.patchExecutionView(e.detail);
        }
      } else {
        const execSection = document.getElementById('view-execution');
        if (!execSection || execSection.style.display === 'none') {
          this.loadChecklists();
        }
      }
    });

    window.addEventListener('socket_checklist_submitted', (e) => {
      if (this.currentChecklist && this.currentChecklist.id === e.detail.id) {
        if (this.hasChecklistDifferences(this.currentChecklist, e.detail)) {
          this.patchExecutionView(e.detail);
        }
      } else {
        const execSection = document.getElementById('view-execution');
        if (!execSection || execSection.style.display === 'none') {
          this.loadChecklists();
        }
      }
    });

    window.addEventListener('socket_checklist_unsubmitted', (e) => {
      if (this.currentChecklist && this.currentChecklist.id === e.detail.id) {
        if (this.hasChecklistDifferences(this.currentChecklist, e.detail)) {
          this.patchExecutionView(e.detail);
        }
      } else {
        const execSection = document.getElementById('view-execution');
        if (!execSection || execSection.style.display === 'none') {
          this.loadChecklists();
        }
      }
    });

    window.addEventListener('socket_checklist_deleted', (e) => {
      if (this.currentChecklist && this.currentChecklist.id === e.detail.id) {
        helpers.showToast('This checklist was deleted.', 'warning');
        this.closeExecutionView();
      }
      this.loadChecklists();
    });

    window.addEventListener('socket_checklist_viewers', (e) => {
      const { viewers } = e.detail;
      this.activeViewers = viewers || [];
      this.updateViewersBar();
    });
  },

  updateTemplateSubTabVisibility() {
    const tabTemplates = document.getElementById('tab-btn-checklist-templates');
    const canEditTemplates = window.app && window.app.hasPermission('checklists', 'edit_templates');

    if (tabTemplates) {
      if (canEditTemplates) {
        tabTemplates.style.display = 'inline-flex';
      } else {
        tabTemplates.style.display = 'none';
        if (this.activeSubTab === 'templates') {
          this.switchSubTab('active');
        }
      }
    }
  },

  async loadChecklists() {
    this.updateTemplateSubTabVisibility();
    try {
      const res = await api.checklists.getAll();
      this.checklists = res.checklists || [];
      this.renderGrid();

      const btnDeleteAll = document.getElementById('btn-delete-all-checklists');
      const canDelete = window.app && window.app.hasPermission('checklists', 'delete_active');
      if (btnDeleteAll) {
        btnDeleteAll.style.display = (canDelete && this.checklists.length > 0) ? 'inline-flex' : 'none';
      }

      const activeCount = this.checklists.filter(c => c.status === 'IN_PROGRESS').length;
      const badge = document.getElementById('badge-active-checklists');
      if (badge) {
        badge.textContent = activeCount;
        badge.style.display = activeCount > 0 ? 'inline-block' : 'none';
      }
    } catch (err) {
      console.error('Failed to load checklists:', err);
    }
  },

  async handleDeleteAllChecklists() {
    if (!this.checklists || this.checklists.length === 0) {
      helpers.showToast('No active checklists to delete.', 'info');
      return;
    }

    if (!confirm(`Are you sure you want to delete ALL ${this.checklists.length} active checklists? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await api.checklists.deleteAll();
      helpers.showToast(res.message || 'All active checklists deleted.', 'success');
      this.loadChecklists();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to delete all checklists', 'error');
    }
  },

  renderGrid() {
    const container = document.getElementById('checklists-grid-container');
    if (!container) return;

    let html = '';

    // 1. "Start Checklist" card at first position
    const canCreate = window.app.hasPermission('checklists', 'create_active');
    if (canCreate) {
      html += `
        <div class="checklist-card card-add" id="card-btn-add-checklist">
          <div class="card-add-icon">+</div>
          <div style="font-weight:600; font-size:1rem; color:var(--text-primary);">Start Checklist</div>
          <div style="font-size:0.775rem; color:var(--text-muted); margin-top:0.25rem;">Instantiate from template</div>
        </div>
      `;
    }

    const canDelete = window.app.hasPermission('checklists', 'delete_active');

    // 2. Active & Submitted Checklists Cards
    this.checklists.forEach(chk => {
      const isSubmitted = chk.status === 'SUBMITTED';
      const progress = isSubmitted ? 100 : (chk.progress || 0);
      const isBlocked = chk.has_blocked && !isSubmitted;

      let statusBadge = '<span class="badge badge-success card-tag-status">In-Progress</span>';
      if (isSubmitted) {
        statusBadge = '<span class="badge badge-info card-tag-status">Submitted</span>';
      } else if (isBlocked) {
        statusBadge = '<span class="badge badge-danger card-tag-status">Blocked Items</span>';
      }

      const cardClass = isSubmitted ? 'checklist-card submitted' : 'checklist-card in-progress';
      const metaText = isSubmitted
        ? `Completed: ${chk.submitted_at_la || helpers.formatSubmissionTimeLA(chk.submitted_at)}`
        : `Created by ${helpers.escapeHtml(chk.created_by)}`;

      const cleanTmplTitle = window.templatesView ? window.templatesView.decodeEntities(chk.template_title || '') : (chk.template_title || '');
      const cleanChkTitle = window.templatesView ? window.templatesView.decodeEntities(chk.title || '') : (chk.title || '');

      html += `
        <div class="${cardClass}" data-id="${chk.id}">
          <div class="card-top">
            <div class="card-title-group">
              <div class="card-title">${helpers.escapeHtml(cleanChkTitle)}</div>
              <div class="card-template-name">
                <span>🗂️</span>
                <span>${helpers.escapeHtml(cleanTmplTitle || 'Custom Template')}</span>
              </div>
            </div>
            <div class="progress-ring-container">
              ${helpers.renderCircularProgress(progress, isBlocked, 52)}
            </div>
          </div>
          <div class="card-bottom">
            <div class="card-tags">
              ${statusBadge}
              ${isSubmitted ? `
                <span class="badge-disappearing" title="Auto-deletes 6 hours from submission">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span>6h</span>
                </span>
              ` : ''}
              <div class="card-meta" style="margin-left: 0.25rem;">${metaText}</div>
            </div>
            <div class="card-actions" style="display:flex; align-items:center; gap:0.4rem;">
              ${canDelete ? `
                <button class="btn btn-outline-danger btn-icon btn-sm" data-action="delete-active-checklist" data-id="${chk.id}" title="Delete Checklist" aria-label="Delete Checklist" style="flex-shrink:0;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    });

    if (this.checklists.length === 0 && !canCreate) {
      html += `
        <div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
          No active operational checklists at this time.
        </div>
      `;
    }

    container.innerHTML = html;

    // Attach click listeners to cards
    const addCard = document.getElementById('card-btn-add-checklist');
    if (addCard) {
      addCard.addEventListener('click', () => this.openInstantiateModal());
    }

    container.querySelectorAll('[data-action="delete-active-checklist"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('Are you sure you want to delete this operational checklist? This action cannot be undone.')) {
          try {
            await api.checklists.delete(id);
            helpers.showToast('Checklist deleted successfully.', 'info');
            this.loadChecklists();
          } catch (err) {
            helpers.showToast(err.message || 'Failed to delete checklist', 'error');
          }
        }
      });
    });

    container.querySelectorAll('.checklist-card[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.openExecutionView(id);
      });
    });
  },

  async openInstantiateModal() {
    const listContainer = document.getElementById('template-picker-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">Loading templates...</div>';
    helpers.openModal('modal-new-checklist');

    try {
      const res = await api.templates.getAll();
      let templates = res.templates || [];

      if (templates.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            No templates available. Please create a template first in the Templates tab.
          </div>
        `;
        return;
      }

      // Invisible smart ranking: sort templates descending by time-based relevance score
      templates.sort((a, b) => {
        const scoreA = helpers.calculateTemplateRelevanceScore(a);
        const scoreB = helpers.calculateTemplateRelevanceScore(b);
        if (Math.abs(scoreB - scoreA) > 0.0001) {
          return scoreB - scoreA;
        }
        return (a.title || '').localeCompare(b.title || '');
      });

      listContainer.innerHTML = templates.map(t => {
        const stepCount = Array.isArray(t.items) ? t.items.length : 0;
        const hasHook = t.submission_automation && t.submission_automation.url;

        return `
          <div class="template-picker-item" data-template-id="${t.id}">
            <div style="flex:1; min-width:0;">
              <div class="template-picker-title">${helpers.safeText(t.title)}</div>
              ${t.description ? `<div class="template-picker-desc">${helpers.safeText(t.description)}</div>` : ''}
            </div>
            <div class="template-picker-meta">
              <span class="template-picker-badge">${stepCount} ${stepCount === 1 ? 'task' : 'tasks'}</span>
              ${hasHook ? `<span class="template-picker-badge" style="color:var(--accent-secondary);" title="Automation Webhook Configured">⚡ Webhook</span>` : ''}
              <span class="template-picker-action-icon">→</span>
            </div>
          </div>
        `;
      }).join('');

      // Bind instant click-to-instantiate handlers
      listContainer.querySelectorAll('.template-picker-item[data-template-id]').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
          const templateId = itemEl.dataset.templateId;
          this.instantiateTemplate(templateId);
        });
      });

    } catch (err) {
      listContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--status-danger);">Failed to load templates.</div>`;
      helpers.showToast('Failed to load templates', 'error');
    }
  },

  async instantiateTemplate(templateId) {
    if (!templateId) return;

    try {
      const res = await api.checklists.create(templateId);
      helpers.showToast('Checklist instantiated successfully!', 'success');
      helpers.closeModal('modal-new-checklist');
      this.loadChecklists();
      this.openExecutionView(res.checklist.id);
    } catch (err) {
      helpers.showToast(err.message || 'Failed to create checklist', 'error');
    }
  },

  async openExecutionView(checklistId) {
    try {
      const res = await api.checklists.getById(checklistId);
      this.currentChecklist = res.checklist;

      // Join socket room
      window.socketClient.joinChecklist(checklistId);

      // Switch view
      window.app.switchView('execution');
      this.renderExecutionView(res.checklist, false);
    } catch (err) {
      helpers.showToast('Failed to load checklist details', 'error');
    }
  },

  async loadPublicExecutionView(checklistId) {
    try {
      const res = await api.checklists.getPublic(checklistId);
      this.currentChecklist = res.checklist;

      // Join socket room for live sync in public mode
      window.socketClient.joinChecklist(checklistId);

      this.renderExecutionView(res.checklist, true);
    } catch (err) {
      console.error('Failed to load public checklist:', err);
      helpers.showToast('Checklist unavailable or expired', 'error');
    }
  },

  handleShareChecklist() {
    if (!this.currentChecklist) return;

    const checklistId = this.currentChecklist.id;
    const title = this.currentChecklist.title || 'AV Audit Checklist';
    const shareUrl = `${window.location.origin}/checklist/${checklistId}`;
    const shareText = `${title}\n\n${shareUrl}`;

    if (navigator.share && typeof navigator.share === 'function') {
      navigator.share({
        title: title,
        text: shareText,
        url: shareUrl
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          this.copyShareLinkToClipboard(shareText);
        }
      });
    } else {
      this.copyShareLinkToClipboard(shareText);
    }
  },

  async copyShareLinkToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      helpers.showToast('Checklist link copied to clipboard!', 'success');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      helpers.showToast('Failed to copy link to clipboard.', 'error');
    }
  },

  closeExecutionView() {
    if (this.currentChecklist) {
      window.socketClient.leaveChecklist(this.currentChecklist.id);
      this.currentChecklist = null;
    }
    window.app.switchView('checklists');
  },

  updateViewersBar() {
    const listEl = document.getElementById('exec-viewers-list');
    if (!listEl) return;
    if (this.activeViewers.length === 0) {
      listEl.textContent = 'You';
    } else {
      listEl.textContent = this.activeViewers.join(', ');
    }
  },

  renderExecutionView(chk, isReadOnly = this.isReadOnly) {
    const isPublicReadOnly = Boolean(isReadOnly || this.isReadOnly || chk.is_public_read_only || (window.app && window.app.isPublicReadOnly));
    this.isReadOnly = isPublicReadOnly;

    document.getElementById('exec-checklist-title').textContent = helpers.decodeEntities(chk.title);
    document.getElementById('exec-checklist-template').textContent = `Associated Template: ${helpers.decodeEntities(chk.template_title || 'Custom')}`;

    const isSubmitted = chk.status === 'SUBMITTED';
    const progress = isSubmitted ? 100 : (chk.progress || 0);

    const progressRing = document.getElementById('exec-progress-ring');
    if (progressRing) progressRing.innerHTML = helpers.renderCircularProgress(progress, chk.has_blocked, 52);

    const progressLabel = document.getElementById('exec-progress-label');
    if (progressLabel) progressLabel.textContent = `${progress}% Completed`;

    const barFill = document.getElementById('exec-progress-bar-fill');
    if (barFill) {
      barFill.style.width = `${progress}%`;
      barFill.classList.toggle('blocked', Boolean(chk.has_blocked));
    }

    const statusTag = document.getElementById('exec-status-tag');
    if (statusTag) {
      if (isSubmitted) {
        statusTag.textContent = `Status: Submitted at ${chk.submitted_at_la || helpers.formatSubmissionTimeLA(chk.submitted_at)}`;
        statusTag.style.color = 'var(--accent-secondary)';
      } else if (chk.has_blocked) {
        statusTag.textContent = 'Status: Blocked Items Reported';
        statusTag.style.color = 'var(--status-danger)';
      } else {
        statusTag.textContent = 'Status: In-Progress';
        statusTag.style.color = 'var(--accent-primary)';
      }
    }

    const btnBack = document.getElementById('btn-back-to-grid');
    const btnUnsubmit = document.getElementById('btn-unsubmit-checklist');
    const btnDelete = document.getElementById('btn-delete-checklist');
    const btnShare = document.getElementById('btn-share-checklist');

    if (btnBack) {
      btnBack.style.display = isPublicReadOnly ? 'none' : 'inline-flex';
    }

    if (btnDelete) {
      btnDelete.style.display = isPublicReadOnly ? 'none' : 'inline-flex';
    }

    if (btnUnsubmit) {
      btnUnsubmit.style.display = (isPublicReadOnly || !isSubmitted) ? 'none' : 'inline-flex';
    }

    if (btnShare) {
      btnShare.style.display = 'inline-flex';
    }

    // Render Task Tree
    const treeContainer = document.getElementById('exec-task-tree');
    if (treeContainer) {
      treeContainer.innerHTML = this.renderTaskNodes(chk.items, isSubmitted, false, isPublicReadOnly, 0);
      this.bindTaskNodeListeners(treeContainer, isPublicReadOnly);
    }
  },

  renderTaskNodes(items, isSubmitted, parentOptional = false, isReadOnly = false, depth = 0) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div style="color:var(--text-muted); text-align:center; padding:1.5rem;">No tasks defined.</div>';
    }

    return items.map(item => {
      // 1. SECTION RENDERING
      if (item.type === 'section') {
        const secTasks = item.items || item.children || [];
        const isSectionOptional = Boolean(item.is_optional || item.optional);
        const secColor = item.color || '#58a6ff';
        const secTitle = helpers.safeText(item.title || 'Untitled Section');

        return `
          <div class="exec-section-card" data-section-id="${item.id}" style="--section-color: ${secColor};">
            <div class="exec-section-header" data-action="toggle-collapse-section">
              <div class="exec-section-title-wrap">
                <span class="exec-section-chevron">▼</span>
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${secColor}; flex-shrink:0;"></span>
                <strong style="color:var(--text-primary); font-size:0.95rem;">${secTitle}</strong>
                ${isSectionOptional ? '<span class="badge" style="background:rgba(210,153,34,0.15); color:#e3b341; border:1px solid #d29922; font-size:0.7rem; padding:0.1rem 0.45rem;">⬠ Optional</span>' : ''}
              </div>
              <div style="font-size:0.775rem; color:var(--text-muted);">
                ${secTasks.length} ${secTasks.length === 1 ? 'task' : 'tasks'}
              </div>
            </div>
            <div class="exec-section-body">
              ${this.renderTaskNodes(secTasks, isSubmitted, isSectionOptional, isReadOnly, 0)}
            </div>
          </div>
        `;
      }

      // 2. STANDARD TASK RENDERING
      const isChecked = Boolean(item.checked);
      const hasIssue = Boolean(item.has_issue);
      const isOptional = Boolean(parentOptional || item.is_optional || item.optional);
      const hasAuto = Boolean(item.has_automation && item.automation && (item.automation.url || item.automation.method));
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;

      let nodeClass = 'task-node';
      if (isChecked) nodeClass += ' is-checked';
      if (hasIssue) nodeClass += ' has-issue';
      if (isOptional) nodeClass += ' is-task-optional';

      // 4-state indicator shape class on check button
      let btnShapeClass = '';
      let btnShapeTitle = isReadOnly ? 'Task Status' : 'Toggle Complete';
      if (!isOptional && hasAuto) {
        btnShapeClass = 'is-rhombus';
        btnShapeTitle = 'Required Task + Webhook ⚡ (Hollow Rhombus)';
      } else if (isOptional && !hasAuto) {
        btnShapeClass = 'is-optional';
        btnShapeTitle = 'Optional Task (Dashed Circle - Excluded from Progress)';
      } else if (isOptional && hasAuto) {
        btnShapeClass = 'is-optional is-rhombus';
        btnShapeTitle = 'Optional Task + Webhook ⚡ (Dashed Rhombus)';
      }

      let issueDrawerHtml = '';
      if (hasIssue) {
        issueDrawerHtml = `
          <div class="issue-note-box">
            <span>⚠️</span>
            <div><strong>BLOCKED:</strong> ${helpers.safeText(item.issue_note || 'Issue reported on this step.')}</div>
          </div>
        `;
      } else if (item.issue_note) {
        issueDrawerHtml = `
          <div style="margin-top:0.35rem; font-size:0.775rem; color:var(--text-muted); display:flex; align-items:center; gap:0.35rem;">
            <span>📝</span>
            <span>${helpers.safeText(item.issue_note)}</span>
          </div>
        `;
      }

      let autoBtnHtml = '';
      if (hasAuto && !isReadOnly) {
        autoBtnHtml = `
          <button class="btn-task-icon btn-auto-icon" data-action="run-automation" data-item-id="${item.id}" title="Trigger ${item.automation.method || 'GET'} Webhook">
            <span class="btn-icon-symbol">⚡</span>
            <span class="btn-icon-text">Automate</span>
          </button>
        `;
      }

      let checkedBadgeHtml = '';
      if (isChecked && item.checked_by) {
        const username = item.checked_by;
        const initial = (username || 'U').charAt(0).toUpperCase();
        const roleName = item.checked_by_role || 'User';
        const roleColor = item.checked_by_color || '#58a6ff';
        const timeStr = item.checked_at ? helpers.formatTimeLA(item.checked_at) : (item.checked_at_la || helpers.formatTimeLA(new Date()));

        checkedBadgeHtml = `
          <div class="task-checked-badge-wrap">
            <button type="button" class="task-checked-avatar" data-action="toggle-checker-popover" title="Checked by ${helpers.escapeHtml(username)}" style="--user-color: ${roleColor};">
              <span>${helpers.escapeHtml(initial)}</span>
            </button>
            <div class="checker-popover-menu" style="--user-color: ${roleColor};">
              <div class="checker-popover-header">
                <div class="checker-popover-avatar">${helpers.escapeHtml(initial)}</div>
                <div class="checker-popover-info">
                  <div class="checker-popover-name" style="color: #ffffff;">${helpers.escapeHtml(username)}</div>
                  <div class="checker-popover-role" style="background-color: ${roleColor}22; color: ${roleColor}; border-color: ${roleColor}55;">${helpers.escapeHtml(roleName)}</div>
                </div>
              </div>
              <div class="checker-popover-time">
                <span>🕒</span>
                <span>${helpers.escapeHtml(timeStr)}</span>
              </div>
            </div>
          </div>
        `;
      }

      let rightActionsHtml = '';
      if (isReadOnly) {
        rightActionsHtml = `
          <div class="task-right-actions">
            ${checkedBadgeHtml}
          </div>
        `;
      } else {
        rightActionsHtml = `
          <div class="task-right-actions">
            ${checkedBadgeHtml}
            ${autoBtnHtml}
            <button class="btn-task-icon ${hasIssue ? 'active-issue' : ''}" data-action="toggle-issue" data-item-id="${item.id}" ${isSubmitted ? 'disabled' : ''} title="${hasIssue ? 'Clear Issue' : 'Flag Issue / Blocked'}">
              <span class="btn-icon-symbol">⚠️</span>
              <span class="btn-icon-text">${hasIssue ? 'Clear Issue' : 'Flag Issue'}</span>
            </button>
            <button class="btn-task-icon ${item.issue_note && !hasIssue ? 'active-note' : ''}" data-action="edit-note" data-item-id="${item.id}" ${isSubmitted ? 'disabled' : ''} title="Add / Edit Note">
              <span class="btn-icon-symbol">📝</span>
              <span class="btn-icon-text">${item.issue_note && !hasIssue ? 'Edit Note' : 'Add Note'}</span>
            </button>
          </div>
        `;
      }

      let childrenHtml = '';
      if (hasChildren) {
        childrenHtml = `
          <div class="task-children">
            ${this.renderTaskNodes(item.children, isSubmitted, isOptional, isReadOnly, depth + 1)}
          </div>
        `;
      }

      const checkDisabledAttr = (isSubmitted || isReadOnly) ? 'disabled style="pointer-events:none; cursor:default;"' : '';

      return `
        <div class="${nodeClass}" data-item-id="${item.id}" style="--depth: ${depth};">
          <div class="task-row">
            <button class="task-check-btn ${btnShapeClass}" data-action="toggle-check" data-item-id="${item.id}" ${checkDisabledAttr} title="${btnShapeTitle}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <div class="task-body">
              <div class="task-title">
                ${helpers.safeText(item.title)}
                ${isOptional ? '<span class="badge" style="background:rgba(210,153,34,0.12); color:#e3b341; font-size:0.675rem; border:1px solid rgba(210,153,34,0.4); margin-left:0.4rem; padding:0.05rem 0.35rem;">Optional</span>' : ''}
              </div>
              ${item.description ? `<div class="task-desc">${helpers.safeText(item.description)}</div>` : ''}
              ${issueDrawerHtml}
            </div>
            ${rightActionsHtml}
          </div>
          ${childrenHtml}
        </div>
      `;
    }).join('');
  },

  bindTaskNodeListeners(container, isReadOnly = false) {
    // Collapsible Section Toggle
    container.querySelectorAll('[data-action="toggle-collapse-section"]').forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.exec-section-card');
        if (card) {
          card.classList.toggle('is-collapsed');
        }
      });
    });

    // Checker popover toggle (always available even in read-only mode)
    container.querySelectorAll('[data-action="toggle-checker-popover"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const badgeWrap = btn.closest('.task-checked-badge-wrap');
        const popover = badgeWrap ? badgeWrap.querySelector('.checker-popover-menu') : null;
        if (!popover) return;
        const isOpen = popover.classList.contains('is-open');
        document.querySelectorAll('.checker-popover-menu.is-open').forEach(p => p.classList.remove('is-open'));
        if (!isOpen) {
          popover.classList.add('is-open');
        }
      });
    });

    if (isReadOnly) return;

    // Check toggle with snappy optimistic UI update
    container.querySelectorAll('[data-action="toggle-check"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.itemId;
        this.optimisticToggleCheck(itemId);
      });
    });

    // Issue Flag Toggle with snappy optimistic UI update
    container.querySelectorAll('[data-action="toggle-issue"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.itemId;
        const node = btn.closest('.task-node');
        const currentlyHasIssue = node.classList.contains('has-issue');

        if (!currentlyHasIssue) {
          const note = prompt('Describe the issue / blocker reason:');
          if (note === null) return;
          this.optimisticUpdateIssue(itemId, true, note || 'Blocker reported');
        } else {
          this.optimisticUpdateIssue(itemId, false, '');
        }
      });
    });

    // Note button with snappy optimistic UI update
    container.querySelectorAll('[data-action="edit-note"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.itemId;
        const note = prompt('Add/Update task execution note:');
        if (note !== null) {
          this.optimisticUpdateNote(itemId, note);
        }
      });
    });

    // Automation Trigger (Compact icon button)
    container.querySelectorAll('[data-action="run-automation"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.itemId;
        const item = this.findItemRecursive(this.currentChecklist.items, itemId);
        if (!item || !item.automation) return;

        if (btn._successResetTimer) {
          clearTimeout(btn._successResetTimer);
          btn._successResetTimer = null;
        }

        btn.disabled = true;
        btn.classList.remove('btn-auto-success');
        btn.innerHTML = '<span class="btn-icon-symbol">⏳</span><span class="btn-icon-text">Automating...</span>';

        try {
          const result = await api.automation.execute({
            method: item.automation.method,
            url: item.automation.url,
            headers: item.automation.headers,
            body: item.automation.body,
            checklistId: this.currentChecklist.id,
            itemId: item.id,
            itemTitle: item.title
          });

          if (result && result.success) {
            btn.disabled = false;
            btn.classList.add('btn-auto-success');
            btn.innerHTML = '<span class="btn-icon-symbol">✅</span><span class="btn-icon-text">Success</span>';

            btn._successResetTimer = setTimeout(() => {
              btn.classList.remove('btn-auto-success');
              btn.innerHTML = '<span class="btn-icon-symbol">⚡</span><span class="btn-icon-text">Automate</span>';
              btn._successResetTimer = null;
            }, 10000);
          } else {
            btn.disabled = false;
            btn.classList.remove('btn-auto-success');
            btn.innerHTML = '<span class="btn-icon-symbol">⚡</span><span class="btn-icon-text">Automate</span>';
            this.showAutomationResultModal(item, result || { success: false, status: 0, durationMs: 0, error: 'Automation execution failed.' });
          }
        } catch (err) {
          btn.disabled = false;
          btn.classList.remove('btn-auto-success');
          btn.innerHTML = '<span class="btn-icon-symbol">⚡</span><span class="btn-icon-text">Automate</span>';
          this.showAutomationResultModal(item, {
            success: false,
            status: 0,
            durationMs: 0,
            error: err.message || 'Automation execution failed'
          });
        }
      });
    });
  },

  findItemRecursive(nodes, itemId) {
    if (!Array.isArray(nodes)) return null;
    for (const node of nodes) {
      if (node.id === itemId) return node;
      if (node.children) {
        const found = this.findItemRecursive(node.children, itemId);
        if (found) return found;
      }
    }
    return null;
  },

  showAutomationResultModal(item, result) {
    const modalBody = document.getElementById('automation-result-body');
    const isSuccess = result.success;
    const statusClass = isSuccess ? 'var(--status-success)' : 'var(--status-danger)';

    modalBody.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary);">${helpers.escapeHtml(item.title)}</div>
        <div style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
          ${item.automation.method} ${helpers.escapeHtml(item.automation.url)}
        </div>
      </div>

      <div style="display:flex; gap:1rem; margin-bottom: 1.25rem;">
        <div style="background:var(--bg-surface); padding:0.75rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle); flex:1;">
          <div style="font-size:0.75rem; color:var(--text-muted);">STATUS CODE</div>
          <div style="font-size:1.25rem; font-weight:700; color:${statusClass}; font-family:var(--font-mono);">${result.status || 'ERR'}</div>
        </div>
        <div style="background:var(--bg-surface); padding:0.75rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle); flex:1;">
          <div style="font-size:0.75rem; color:var(--text-muted);">DURATION</div>
          <div style="font-size:1.25rem; font-weight:700; color:var(--text-primary); font-family:var(--font-mono);">${result.durationMs}ms</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Response Payload Preview</label>
        <pre style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem; max-height:220px; overflow:auto; color:var(--text-secondary);">${helpers.escapeHtml(result.bodyPreview || result.error || '(Empty Response)')}</pre>
      </div>
    `;

    helpers.openModal('modal-automation-result');
  },

  async handleSubmitChecklist() {
    if (!this.currentChecklist) return;
    if (!confirm('Are you sure you want to finalize and submit this checklist? It will be marked complete (100%) and kept in the grid for 24 hours.')) {
      return;
    }

    try {
      const res = await api.checklists.submit(this.currentChecklist.id);
      helpers.showToast('Checklist successfully submitted! (24-hour audit retention started)', 'success');
      this.currentChecklist = res.checklist;
      this.renderExecutionView(res.checklist);
      this.loadChecklists();
    } catch (err) {
      helpers.showToast(err.message || 'Submission failed', 'error');
    }
  },

  async handleUnsubmitChecklist() {
    if (!this.currentChecklist) return;
    if (!confirm('Are you sure you want to reopen / unsubmit this checklist? It will return to in-progress status.')) {
      return;
    }

    try {
      const res = await api.checklists.unsubmit(this.currentChecklist.id);
      helpers.showToast('Checklist reopened into In-Progress status!', 'success');
      this.currentChecklist = res.checklist;
      this.renderExecutionView(res.checklist);
      this.loadChecklists();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to reopen checklist', 'error');
    }
  },

  async handleDeleteChecklist() {
    if (!this.currentChecklist) return;
    if (!confirm('Are you sure you want to permanently delete this active checklist instance?')) {
      return;
    }

    try {
      const checklistId = this.currentChecklist.id;
      this.currentChecklist = null; // Clear local reference so socket broadcast won't double-toast
      await api.checklists.delete(checklistId);
      helpers.showToast('Checklist deleted.', 'info');
      this.closeExecutionView();
    } catch (err) {
      helpers.showToast(err.message || 'Failed to delete checklist', 'error');
    }
  },

  optimisticToggleCheck(itemId) {
    if (!this.currentChecklist || !Array.isArray(this.currentChecklist.items)) return;

    // Snapshot current state for rollback if network fails
    const previousSnapshot = JSON.parse(JSON.stringify(this.currentChecklist));

    const currentUser = window.app.user || { username: 'You', roles: [] };
    const userRole = (currentUser.roles && currentUser.roles[0]) ? currentUser.roles[0] : { name: 'User', color_hex: '#58a6ff' };
    const nowTimeStr = helpers.formatTimeLA(new Date());

    let targetChecked = null;
    const affectedNodeIds = [];

    // Recursive helper to find node and determine new check state
    const updateNode = (nodes) => {
      for (const node of nodes) {
        if (node.id === itemId) {
          targetChecked = !node.checked;
          this.applyCheckRecursive(node, targetChecked, currentUser.username, userRole.name, userRole.color_hex, nowTimeStr, affectedNodeIds);
          return true;
        }
        const children = node.items || node.children || [];
        if (children.length > 0 && updateNode(children)) {
          // Update parent checked state if all children are checked
          if (node.type !== 'section') {
            const allChecked = children.every(c => c.checked);
            if (node.checked !== allChecked) {
              node.checked = allChecked;
              affectedNodeIds.push({ id: node.id, checked: allChecked, username: currentUser.username, roleName: userRole.name, roleColor: userRole.color_hex, timeStr: nowTimeStr });
            }
          }
          return true;
        }
      }
      return false;
    };

    updateNode(this.currentChecklist.items);

    if (targetChecked === null) return;

    // Recalculate stats immediately
    const stats = this.calculateLocalStats(this.currentChecklist.items);
    this.currentChecklist.progress = stats.progress;
    this.currentChecklist.has_blocked = stats.hasBlocked;

    // Targeted in-place DOM updates (ZERO treeContainer destruction, ZERO screen flashing)
    for (const aff of affectedNodeIds) {
      this.updateTaskDomCheckedState(aff.id, aff.checked, aff.username, aff.roleName, aff.roleColor, aff.timeStr);
    }
    this.updateHeaderProgressMetrics();

    // Send async API request in background
    api.checklists.toggleItem(this.currentChecklist.id, itemId, targetChecked)
      .then(res => {
        if (this.hasChecklistDifferences(this.currentChecklist, res.checklist)) {
          this.patchExecutionView(res.checklist);
        } else {
          this.currentChecklist = res.checklist;
        }
      })
      .catch(err => {
        console.error('Optimistic toggle failed, reverting:', err);
        this.currentChecklist = previousSnapshot;
        this.patchExecutionView(this.currentChecklist);
        helpers.showToast(err.message || 'Failed to update task. Reverted.', 'error');
      });
  },

  patchExecutionView(chk) {
    if (!chk) return;
    if (!this.currentChecklist || this.currentChecklist.id !== chk.id) {
      this.renderExecutionView(chk, this.isReadOnly);
      return;
    }

    this.currentChecklist = chk;
    this.updateHeaderProgressMetrics();

    // In-place node patching (preserves DOM identity, zero full-tree rebuilds, zero flashing)
    const patchNodes = (nodes) => {
      if (!Array.isArray(nodes)) return;
      for (const item of nodes) {
        if (item.type === 'section') {
          const secChildren = item.items || item.children || [];
          patchNodes(secChildren);
        } else {
          const nodeEl = document.querySelector(`.task-node[data-item-id="${item.id}"]`);
          if (nodeEl) {
            const isChecked = Boolean(item.checked);
            const hasIssue = Boolean(item.has_issue);
            const domChecked = nodeEl.classList.contains('is-checked');
            const domIssue = nodeEl.classList.contains('has-issue');

            if (domChecked !== isChecked) {
              const itemTimeStr = item.checked_at ? helpers.formatTimeLA(item.checked_at) : (item.checked_at_la || helpers.formatTimeLA(new Date()));
              this.updateTaskDomCheckedState(item.id, isChecked, item.checked_by, item.checked_by_role, item.checked_by_color, itemTimeStr);
            }

            if (domIssue !== hasIssue) {
              this.updateTaskDomIssueState(item.id, hasIssue, item.issue_note);
            }
          }
          const children = item.items || item.children || [];
          if (children.length > 0) {
            patchNodes(children);
          }
        }
      }
    };

    patchNodes(chk.items);
  },

  updateTaskDomIssueState(itemId, hasIssue, issueNote) {
    const node = document.querySelector(`.task-node[data-item-id="${itemId}"]`);
    if (!node) return;

    const currentHasIssue = node.classList.contains('has-issue');
    const existingDrawer = node.querySelector('.issue-note-box, .task-note-text');
    const currentNoteText = existingDrawer ? (existingDrawer.dataset.noteText || '') : '';

    if (currentHasIssue === hasIssue && currentNoteText === (issueNote || '')) {
      return; // EXACT SAME STATE -> NO-OP
    }

    node.classList.toggle('has-issue', hasIssue);

    const taskBody = node.querySelector('.task-body');
    if (taskBody) {
      if (existingDrawer) existingDrawer.remove();

      if (hasIssue) {
        taskBody.insertAdjacentHTML('beforeend', `
          <div class="issue-note-box" data-note-text="${helpers.escapeHtml(issueNote || '')}">
            <span>⚠️</span>
            <div><strong>BLOCKED:</strong> ${helpers.safeText(issueNote || 'Issue reported on this step.')}</div>
          </div>
        `);
      } else if (issueNote) {
        taskBody.insertAdjacentHTML('beforeend', `
          <div class="task-note-text" data-note-text="${helpers.escapeHtml(issueNote)}" style="margin-top:0.35rem; font-size:0.775rem; color:var(--text-muted); display:flex; align-items:center; gap:0.35rem;">
            <span>📝</span>
            <span>${helpers.safeText(issueNote)}</span>
          </div>
        `);
      }
    }

    const issueBtn = node.querySelector('[data-action="toggle-issue"]');
    if (issueBtn) {
      issueBtn.classList.toggle('active-issue', hasIssue);
      const textSpan = issueBtn.querySelector('.btn-icon-text');
      if (textSpan) textSpan.textContent = hasIssue ? 'Clear Issue' : 'Flag Issue';
      issueBtn.title = hasIssue ? 'Clear Issue' : 'Flag Issue / Blocked';
    }
  },

  updateTaskDomCheckedState(itemId, isChecked, username, roleName, roleColor, timeStr) {
    const node = document.querySelector(`.task-node[data-item-id="${itemId}"]`);
    if (!node) return;

    const safeRoleColor = roleColor || '#58a6ff';
    const currentChecked = node.classList.contains('is-checked');
    const existingBadge = node.querySelector('.task-checked-badge-wrap');
    const currentChecker = existingBadge ? existingBadge.dataset.checker : '';

    if (currentChecked === isChecked && (!isChecked || currentChecker === (username || ''))) {
      return; // EXACT SAME STATE -> NO-OP
    }

    node.classList.toggle('is-checked', isChecked);

    const rightActions = node.querySelector('.task-right-actions');
    if (rightActions) {
      if (isChecked) {
        const initial = (username || 'U').charAt(0).toUpperCase();
        const badgeHtml = `
          <div class="task-checked-badge-wrap" data-checker="${helpers.escapeHtml(username || '')}">
            <button type="button" class="task-checked-avatar" data-action="toggle-checker-popover" title="Checked by ${helpers.escapeHtml(username)}" style="--user-color: ${safeRoleColor};">
              <span>${helpers.escapeHtml(initial)}</span>
            </button>
            <div class="checker-popover-menu" style="--user-color: ${safeRoleColor};">
              <div class="checker-popover-header">
                <div class="checker-popover-avatar">${helpers.escapeHtml(initial)}</div>
                <div class="checker-popover-info">
                  <div class="checker-popover-name" style="color: #ffffff;">${helpers.escapeHtml(username)}</div>
                  <div class="checker-popover-role" style="background-color: ${safeRoleColor}22; color: ${safeRoleColor}; border-color: ${safeRoleColor}55;">${helpers.escapeHtml(roleName || 'User')}</div>
                </div>
              </div>
              <div class="checker-popover-time">
                <span>🕒</span>
                <span>${helpers.escapeHtml(timeStr)}</span>
              </div>
            </div>
          </div>
        `;
        if (existingBadge) {
          existingBadge.outerHTML = badgeHtml;
        } else {
          rightActions.insertAdjacentHTML('afterbegin', badgeHtml);
        }
      } else {
        if (existingBadge) {
          existingBadge.remove();
        }
      }

      // Re-bind popover click listener
      const newBtn = rightActions.querySelector('[data-action="toggle-checker-popover"]');
      if (newBtn && !newBtn._popoverBound) {
        newBtn._popoverBound = true;
        newBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const badgeWrap = newBtn.closest('.task-checked-badge-wrap');
          const popover = badgeWrap ? badgeWrap.querySelector('.checker-popover-menu') : null;
          if (!popover) return;
          const isOpen = popover.classList.contains('is-open');
          document.querySelectorAll('.checker-popover-menu.is-open').forEach(p => p.classList.remove('is-open'));
          if (!isOpen) popover.classList.add('is-open');
        });
      }
    }
  },

  updateHeaderProgressMetrics() {
    if (!this.currentChecklist) return;
    const isSubmitted = this.currentChecklist.status === 'SUBMITTED';
    const progress = isSubmitted ? 100 : (this.currentChecklist.progress || 0);
    const hasBlocked = Boolean(this.currentChecklist.has_blocked);
    const submittedAt = this.currentChecklist.submitted_at_la || helpers.formatSubmissionTimeLA(this.currentChecklist.submitted_at);

    // Guard: Only touch progress ring if state actually changed
    const progressRing = document.getElementById('exec-progress-ring');
    if (progressRing) {
      const ringKey = `${progress}_${hasBlocked}`;
      if (progressRing.dataset.lastState !== ringKey) {
        progressRing.dataset.lastState = ringKey;
        progressRing.innerHTML = helpers.renderCircularProgress(progress, hasBlocked, 52);
      }
    }

    const progressLabel = document.getElementById('exec-progress-label');
    if (progressLabel) {
      const labelText = `${progress}% Completed`;
      if (progressLabel.textContent !== labelText) {
        progressLabel.textContent = labelText;
      }
    }

    const barFill = document.getElementById('exec-progress-bar-fill');
    if (barFill) {
      const widthVal = `${progress}%`;
      if (barFill.style.width !== widthVal) barFill.style.width = widthVal;
      barFill.classList.toggle('blocked', hasBlocked);
    }

    const statusTag = document.getElementById('exec-status-tag');
    if (statusTag) {
      let expectedText = 'Status: In-Progress';
      let expectedColor = 'var(--accent-primary)';
      if (isSubmitted) {
        expectedText = `Status: Submitted at ${submittedAt}`;
        expectedColor = 'var(--accent-secondary)';
      } else if (hasBlocked) {
        expectedText = 'Status: Blocked Items Reported';
        expectedColor = 'var(--status-danger)';
      }
      if (statusTag.textContent !== expectedText) statusTag.textContent = expectedText;
      if (statusTag.style.color !== expectedColor) statusTag.style.color = expectedColor;
    }
  },

  optimisticUpdateIssue(itemId, hasIssue, issueNote) {
    if (!this.currentChecklist || !Array.isArray(this.currentChecklist.items)) return;
    const previousSnapshot = JSON.parse(JSON.stringify(this.currentChecklist));

    const updateNode = (nodes) => {
      for (const node of nodes) {
        if (node.id === itemId) {
          node.has_issue = hasIssue;
          node.issue_note = issueNote;
          return true;
        }
        const children = node.items || node.children || [];
        if (children.length > 0 && updateNode(children)) return true;
      }
      return false;
    };

    updateNode(this.currentChecklist.items);
    const stats = this.calculateLocalStats(this.currentChecklist.items);
    this.currentChecklist.has_blocked = stats.hasBlocked;

    this.updateTaskDomIssueState(itemId, hasIssue, issueNote);
    this.updateHeaderProgressMetrics();
    helpers.showToast(hasIssue ? 'Task marked as Blocked/Issue' : 'Issue cleared.', hasIssue ? 'warning' : 'success');

    api.checklists.updateNotes(this.currentChecklist.id, itemId, hasIssue, issueNote)
      .then(res => {
        if (this.hasChecklistDifferences(this.currentChecklist, res.checklist)) {
          this.patchExecutionView(res.checklist);
        } else {
          this.currentChecklist = res.checklist;
        }
      })
      .catch(err => {
        console.error('Optimistic issue update failed, reverting:', err);
        this.currentChecklist = previousSnapshot;
        this.patchExecutionView(this.currentChecklist);
        helpers.showToast(err.message || 'Failed to update issue. Reverted.', 'error');
      });
  },

  optimisticUpdateNote(itemId, note) {
    if (!this.currentChecklist || !Array.isArray(this.currentChecklist.items)) return;
    const previousSnapshot = JSON.parse(JSON.stringify(this.currentChecklist));

    let hasIssue = false;
    const updateNode = (nodes) => {
      for (const node of nodes) {
        if (node.id === itemId) {
          hasIssue = Boolean(node.has_issue);
          node.issue_note = note;
          return true;
        }
        const children = node.items || node.children || [];
        if (children.length > 0 && updateNode(children)) return true;
      }
      return false;
    };

    updateNode(this.currentChecklist.items);
    this.updateTaskDomIssueState(itemId, hasIssue, note);
    helpers.showToast('Note saved', 'info');

    api.checklists.updateNotes(this.currentChecklist.id, itemId, undefined, note)
      .then(res => {
        if (this.hasChecklistDifferences(this.currentChecklist, res.checklist)) {
          this.patchExecutionView(res.checklist);
        } else {
          this.currentChecklist = res.checklist;
        }
      })
      .catch(err => {
        console.error('Optimistic note update failed, reverting:', err);
        this.currentChecklist = previousSnapshot;
        this.patchExecutionView(this.currentChecklist);
        helpers.showToast(err.message || 'Failed to save note. Reverted.', 'error');
      });
  },

  hasChecklistDifferences(a, b) {
    if (!a || !b) return true;
    if (a.id !== b.id || a.status !== b.status || a.progress !== b.progress || Boolean(a.has_blocked) !== Boolean(b.has_blocked)) {
      return true;
    }
    const extractState = (items) => {
      if (!Array.isArray(items)) return [];
      return items.map(it => ({
        id: it.id,
        checked: Boolean(it.checked),
        checked_by: it.checked_by || null,
        has_issue: Boolean(it.has_issue),
        issue_note: it.issue_note || '',
        children: extractState(it.items || it.children || [])
      }));
    };
    return JSON.stringify(extractState(a.items)) !== JSON.stringify(extractState(b.items));
  },

  applyCheckRecursive(node, checked, username, roleName, roleColor, timeStr, affectedList = []) {
    node.checked = checked;
    if (checked) {
      node.checked_by = username;
      node.checked_by_role = roleName;
      node.checked_by_color = roleColor;
      node.checked_at_la = timeStr;
    } else {
      node.checked_by = null;
      node.checked_by_role = null;
      node.checked_by_color = null;
      node.checked_at_la = null;
    }
    if (node.type !== 'section') {
      affectedList.push({ id: node.id, checked, username, roleName, roleColor, timeStr });
    }
    const children = node.items || node.children || [];
    for (const child of children) {
      this.applyCheckRecursive(child, checked, username, roleName, roleColor, timeStr, affectedList);
    }
  },

  calculateLocalStats(items) {
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

    return { progress, hasBlocked };
  }
};

window.checklistsView = checklistsView;
