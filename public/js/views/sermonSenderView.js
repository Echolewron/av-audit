/**
 * AV Audit - Sermon Sender View
 * Handles audio upload, title casing, timed context relevancy, live stepper progress, settings, deletion, and submission history.
 */

const sermonSenderView = {
  selectedFile: null,
  selectedContext: null,
  isCustomContext: false,
  settings: {},
  submissions: [],
  isLoadingSubmissions: false,
  isSending: false,
  socketInitialized: false,

  CONTEXT_PRESETS: [
    {
      id: 'sabbath_morning',
      name: 'Sabbath Morning',
      tagClass: 'tag-sabbath',
      tagText: 'Sabbath',
      targetDay: 6, // Saturday
      peakHour: 10,
      targetHourStart: 8,
      targetHourEnd: 12
    },
    {
      id: 'sabbath_afternoon',
      name: 'Sabbath Afternoon',
      tagClass: 'tag-sabbath',
      tagText: 'Sabbath',
      targetDay: 6, // Saturday
      peakHour: 14.5,
      targetHourStart: 12,
      targetHourEnd: 17
    },
    {
      id: 'sabbath_evening',
      name: 'Sabbath Evening',
      tagClass: 'tag-sabbath',
      tagText: 'Sabbath',
      targetDay: 6, // Saturday
      peakHour: 20,
      targetHourStart: 17,
      targetHourEnd: 23
    },
    {
      id: 'third_day',
      name: 'Third Day',
      tagClass: 'tag-thirdday',
      tagText: 'Third Day',
      targetDay: 2, // Tuesday (entire Tuesday, centered at 8 PM)
      peakHour: 20,
      targetHourStart: 0,
      targetHourEnd: 24
    }
  ],

  init() {
    this.bindEvents();
    this.setupSocketListeners();
    this.loadSettings();
    this.loadSubmissions();
    this.renderContextDropdown();
    this.updatePermissionsUI();
  },

  render() {
    this.updatePermissionsUI();
    this.loadSubmissions();
    this.loadSettings();
    this.renderContextDropdown();
  },

  setupSocketListeners() {
    if (this.socketInitialized) return;

    window.addEventListener('socket_sermon_progress', (e) => {
      if (this.isSending && e.detail && e.detail.message) {
        this.setStepState('compress', 'active', e.detail.message);
      }
    });

    const attachSocket = () => {
      const socket = (window.socketClient && window.socketClient.socket) || (window.socket) || (window.io && window.io.connect && window.io());
      if (socket && typeof socket.on === 'function') {
        socket.on('sermon:submissions_updated', (data) => {
          if (window.app && window.app.currentView === 'sermon-sender') {
            this.loadSubmissions();
          }
        });
        socket.on('sermon:progress', (data) => {
          if (this.isSending && data && data.message) {
            this.setStepState('compress', 'active', data.message);
          }
        });
        this.socketInitialized = true;
      }
    };

    attachSocket();
    if (!this.socketInitialized) {
      setTimeout(attachSocket, 1000);
    }
  },

  updatePermissionsUI() {
    const canManageSettings = window.app && typeof window.app.hasPermission === 'function'
      ? (window.app.user?.isAdmin || window.app.hasPermission('sermon_sender', 'manage_settings'))
      : false;

    const canViewHistory = window.app && typeof window.app.hasPermission === 'function'
      ? (window.app.user?.isAdmin || window.app.hasPermission('sermon_sender', 'view_history'))
      : true;

    const btnSettings = document.getElementById('btn-open-sermon-settings');
    if (btnSettings) {
      btnSettings.style.display = canManageSettings ? 'inline-flex' : 'none';
    }

    const historySidebar = document.getElementById('sermon-history-sidebar');
    const container = document.querySelector('.sermon-sender-container');

    if (historySidebar) {
      historySidebar.style.display = canViewHistory ? 'flex' : 'none';
    }

    if (container) {
      if (canViewHistory) {
        container.classList.remove('no-history');
      } else {
        container.classList.add('no-history');
      }
    }
  },

  // Title Case Formatter: trims whitespace and capitalizes each word
  formatTitleCase(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    if (!trimmed) return '';
    return trimmed
      .split(/\s+/)
      .map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  },

  // Format file size in human-readable string
  formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return mb.toFixed(2) + ' MB';
    const kb = bytes / 1024;
    return kb.toFixed(1) + ' KB';
  },

  // Calculate timed relevancy score for context presets (shortest weekly distance)
  calculateContextRelevancyScore(preset, now = new Date()) {
    const nowDay = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const nowHours = (nowDay * 24) + now.getHours() + (now.getMinutes() / 60);
    const targetHours = (preset.targetDay * 24) + (preset.peakHour || ((preset.targetHourStart + preset.targetHourEnd) / 2));

    let diff = Math.abs(nowHours - targetHours);
    if (diff > 84) {
      diff = 168 - diff; // Wrap around week
    }

    // Closer distance gets higher score
    const score = Math.max(0, Math.round(100 - (diff * 1.5)));
    return score;
  },

  // Render context dropdown with timed relevancy ordering
  renderContextDropdown() {
    const listEl = document.getElementById('sermon-context-options-list');
    if (!listEl) return;

    const now = new Date();
    const scoredPresets = this.CONTEXT_PRESETS.map(p => ({
      ...p,
      score: this.calculateContextRelevancyScore(p, now)
    })).sort((a, b) => b.score - a.score);

    // Automatically select whichever context time relevancy is closest if not already manually chosen custom
    if (!this.isCustomContext && scoredPresets.length > 0) {
      const topPreset = scoredPresets[0];
      this.selectContext(topPreset.name, false, topPreset.tagClass, topPreset.tagText);
    }

    listEl.innerHTML = scoredPresets.map((preset, index) => {
      const isSelected = !this.isCustomContext && this.selectedContext === preset.name;
      const isTopSuggested = index === 0;

      return `
        <div class="sermon-context-option-item ${isSelected ? 'selected' : ''}" 
             data-name="${helpers.escapeHtml(preset.name)}" 
             data-tag-class="${preset.tagClass}"
             data-tag-text="${preset.tagText}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="sermon-ctx-pill-tag ${preset.tagClass}">${preset.tagText}</span>
            <span class="sermon-opt-title">${helpers.escapeHtml(preset.name)}</span>
          </div>
          ${isTopSuggested ? '<span class="sermon-opt-relevancy-badge">Current Suggested</span>' : ''}
        </div>
      `;
    }).join('');

    // Attach click listeners to option items
    listEl.querySelectorAll('.sermon-context-option-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = item.dataset.name;
        const tagClass = item.dataset.tagClass;
        const tagText = item.dataset.tagText;
        this.selectContext(name, false, tagClass, tagText);
        this.closeContextDropdown();
      });
    });
  },

  selectContext(name, isCustom = false, tagClass = 'tag-sabbath', tagText = 'Context') {
    this.selectedContext = name;
    this.isCustomContext = isCustom;

    const textEl = document.getElementById('sermon-ctx-selected-text');
    const tagEl = document.getElementById('sermon-ctx-current-tag');

    if (textEl) {
      textEl.textContent = name || 'Select context...';
    }
    if (tagEl) {
      tagEl.className = `sermon-ctx-pill-tag ${tagClass}`;
      tagEl.textContent = tagText;
      tagEl.style.display = name ? 'inline-flex' : 'none';
    }
  },

  toggleContextDropdown() {
    const menu = document.getElementById('sermon-context-dropdown-menu');
    const trigger = document.getElementById('sermon-context-selected-trigger');
    if (!menu) return;

    const isOpen = menu.classList.contains('open');
    if (isOpen) {
      this.closeContextDropdown();
    } else {
      menu.classList.add('open');
      if (trigger) trigger.classList.add('active');
    }
  },

  closeContextDropdown() {
    const menu = document.getElementById('sermon-context-dropdown-menu');
    const trigger = document.getElementById('sermon-context-selected-trigger');
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.classList.remove('active');
  },

  bindEvents() {
    // 1. File Upload Dropzone
    const dropzone = document.getElementById('sermon-upload-dropzone');
    const fileInput = document.getElementById('sermon-file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          this.handleFileSelected(files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          this.handleFileSelected(files[0]);
        }
      });
    }

    // Change file button in form stage
    const btnChangeFile = document.getElementById('btn-sermon-change-file');
    if (btnChangeFile && fileInput) {
      btnChangeFile.addEventListener('click', () => fileInput.click());
    }

    // Cancel form button
    const btnCancelForm = document.getElementById('btn-cancel-sermon-form');
    if (btnCancelForm) {
      btnCancelForm.addEventListener('click', () => this.resetFormStage());
    }

    // 2. Title Auto Title-Casing on blur & input
    const inputTitle = document.getElementById('input-sermon-title');
    if (inputTitle) {
      inputTitle.addEventListener('blur', (e) => {
        e.target.value = this.formatTitleCase(e.target.value);
      });
    }

    // 3. Context Dropdown Trigger
    const triggerBox = document.getElementById('sermon-context-selected-trigger');
    if (triggerBox) {
      triggerBox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleContextDropdown();
      });
    }

    // Custom Context Input at bottom of dropdown
    const customInput = document.getElementById('input-sermon-custom-context');
    if (customInput) {
      customInput.addEventListener('click', (e) => e.stopPropagation());
      customInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const customVal = customInput.value.trim();
          if (customVal) {
            this.selectContext(this.formatTitleCase(customVal), true, 'tag-custom', 'Custom');
            this.closeContextDropdown();
          }
        }
      });
      customInput.addEventListener('blur', () => {
        const customVal = customInput.value.trim();
        if (customVal) {
          this.selectContext(this.formatTitleCase(customVal), true, 'tag-custom', 'Custom');
        }
      });
    }

    // Dismiss dropdown on outside click
    document.addEventListener('click', (e) => {
      const selectWrapper = document.getElementById('sermon-context-select-wrapper');
      if (selectWrapper && !selectWrapper.contains(e.target)) {
        this.closeContextDropdown();
      }
    });

    // 4. Send Sermon Button
    const btnSend = document.getElementById('btn-send-sermon');
    if (btnSend) {
      btnSend.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSendSermon();
      });
    }

    // Send Another Sermon Button
    const btnSendAnother = document.getElementById('btn-send-another-sermon');
    if (btnSendAnother) {
      btnSendAnother.addEventListener('click', () => {
        this.resetFormStage();
      });
    }

    // 5. Settings Modal
    const btnOpenSettings = document.getElementById('btn-open-sermon-settings');
    if (btnOpenSettings) {
      btnOpenSettings.addEventListener('click', () => this.openSettingsModal());
    }

    const btnSaveSettings = document.getElementById('btn-save-sermon-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSaveSettings();
      });
    }

    // Toggle app password visibility with Heroicon SVG
    const btnToggleAppPass = document.getElementById('btn-toggle-sermon-app-pass');
    const inputAppPass = document.getElementById('sermon-cfg-sender-password');
    if (btnToggleAppPass && inputAppPass) {
      btnToggleAppPass.addEventListener('click', () => {
        const isPass = inputAppPass.type === 'password';
        inputAppPass.type = isPass ? 'text' : 'password';
        const iconShow = btnToggleAppPass.querySelector('.icon-eye-show');
        const iconHide = btnToggleAppPass.querySelector('.icon-eye-hide');
        if (iconShow) iconShow.style.display = isPass ? 'none' : 'block';
        if (iconHide) iconHide.style.display = isPass ? 'block' : 'none';
      });
    }

    // 6. Refresh History Button
    const btnRefreshHistory = document.getElementById('btn-refresh-sermon-history');
    if (btnRefreshHistory) {
      btnRefreshHistory.addEventListener('click', () => this.loadSubmissions());
    }
  },

  handleFileSelected(file) {
    if (!file) return;

    const allowedExts = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.wma'];
    const nameLower = file.name.toLowerCase();
    const isAudio = allowedExts.some(ext => nameLower.endsWith(ext)) || file.type.startsWith('audio/');

    if (!isAudio) {
      helpers.showToast('Please select a valid audio file (.mp3, .wav, .m4a)', 'warning');
      return;
    }

    this.selectedFile = file;

    // Update File Preview Meta
    const fileNameEl = document.getElementById('sermon-selected-filename');
    const fileSizeEl = document.getElementById('sermon-selected-filesize');
    const inputTitle = document.getElementById('input-sermon-title');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = this.formatFileSize(file.size);

    // Auto-infer title if empty
    if (inputTitle && !inputTitle.value.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[_\-+]/g, ' ');
      inputTitle.value = this.formatTitleCase(nameWithoutExt);
    }

    // Switch View from Upload Stage to Form Stage
    const uploadStage = document.getElementById('sermon-upload-stage');
    const formStage = document.getElementById('sermon-form-stage');
    const progressWidget = document.getElementById('sermon-progress-widget');
    const formCard = document.querySelector('.sermon-form-card');

    if (uploadStage) uploadStage.style.display = 'none';
    if (formStage) formStage.style.display = 'flex';
    if (formCard) formCard.style.display = 'flex';
    if (progressWidget) progressWidget.style.display = 'none';

    // Refresh context dropdown suggestions
    this.renderContextDropdown();
  },

  resetFormStage() {
    this.selectedFile = null;
    const fileInput = document.getElementById('sermon-file-input');
    if (fileInput) fileInput.value = '';

    const inputTitle = document.getElementById('input-sermon-title');
    if (inputTitle) inputTitle.value = '';

    const customInput = document.getElementById('input-sermon-custom-context');
    if (customInput) customInput.value = '';

    const uploadStage = document.getElementById('sermon-upload-stage');
    const formStage = document.getElementById('sermon-form-stage');
    const progressWidget = document.getElementById('sermon-progress-widget');
    const completionCard = document.getElementById('sermon-completion-card');
    const formCard = document.querySelector('.sermon-form-card');

    if (uploadStage) uploadStage.style.display = 'flex';
    if (formStage) formStage.style.display = 'none';
    if (formCard) formCard.style.display = 'flex';
    if (progressWidget) progressWidget.style.display = 'none';
    if (completionCard) completionCard.style.display = 'none';

    this.isSending = false;
  },

  // Set step state: 'pending', 'active', 'done', 'failed'
  setStepState(stepId, state, descText = null) {
    const stepEl = document.getElementById(`sermon-step-${stepId}`);
    if (!stepEl) return;

    stepEl.classList.remove('pending', 'active', 'done', 'failed');
    stepEl.classList.add(state);

    if (descText) {
      const descEl = document.getElementById(`sermon-step-${stepId}-desc`);
      if (descEl) descEl.textContent = descText;
    }
  },

  async handleSendSermon() {
    if (this.isSending) return;

    if (!this.selectedFile) {
      helpers.showToast('Please select an audio file first', 'warning');
      return;
    }

    const inputTitle = document.getElementById('input-sermon-title');
    const rawTitle = inputTitle ? inputTitle.value.trim() : '';
    if (!rawTitle) {
      helpers.showToast('Please enter a sermon title', 'warning');
      if (inputTitle) inputTitle.focus();
      return;
    }

    const title = this.formatTitleCase(rawTitle);
    if (inputTitle) inputTitle.value = title;

    const context = this.selectedContext || 'General';

    // Check if settings are configured
    if (!this.settings.sender_email || !this.settings.sender_app_password || !this.settings.receiver_email) {
      helpers.showToast('Please configure Gmail credentials in Settings before sending', 'warning');
      this.openSettingsModal();
      return;
    }

    this.isSending = true;

    // Show Progress Stepper Widget & Hide Form inputs
    const formCard = document.querySelector('.sermon-form-card');
    const progressWidget = document.getElementById('sermon-progress-widget');
    const completionCard = document.getElementById('sermon-completion-card');
    const overallBadge = document.getElementById('sermon-progress-overall-badge');

    if (formCard) formCard.style.display = 'none';
    if (progressWidget) progressWidget.style.display = 'flex';
    if (completionCard) completionCard.style.display = 'none';
    if (overallBadge) {
      overallBadge.textContent = 'In Progress';
      overallBadge.style.color = '#58a6ff';
    }

    // Step 1: Upload
    this.setStepState('upload', 'active', 'Uploading audio recording to server...');
    this.setStepState('compress', 'pending', 'Waiting for upload to complete...');
    this.setStepState('email', 'pending', 'Waiting for compression...');

    const formData = new FormData();
    formData.append('audio_file', this.selectedFile);
    formData.append('title', title);
    formData.append('context', context);
    formData.append('is_custom_context', this.isCustomContext ? 'true' : 'false');

    const socketId = (window.socketClient && window.socketClient.socket && window.socketClient.socket.id) || '';
    if (socketId) {
      formData.append('socket_id', socketId);
    }

    try {
      this.setStepState('upload', 'done', `Uploaded ${this.selectedFile.name} (${this.formatFileSize(this.selectedFile.size)})`);
      this.setStepState('compress', 'active', 'Compressing audio with FFmpeg (~15MB target)...');

      const res = await fetch('/api/sermons/send', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to process and send sermon recording.');
      }

      // Step 2 & Step 3 Done
      this.setStepState('compress', 'done', `Compressed output: ${(data.submission.compressed_size_bytes / (1024 * 1024)).toFixed(2)} MB`);
      this.setStepState('email', 'done', `Delivered to ${data.submission.recipient_email}`);

      if (overallBadge) {
        overallBadge.textContent = 'Completed';
        overallBadge.style.color = '#10b981';
      }

      // Show Completion Card
      if (completionCard) {
        const msgEl = document.getElementById('sermon-completion-msg');
        if (msgEl) {
          msgEl.textContent = `"${title}" was successfully compressed and emailed to ${data.submission.recipient_email}.`;
        }
        completionCard.style.display = 'flex';
      }

      // Refresh submissions history
      await this.loadSubmissions();
    } catch (err) {
      console.error('Sermon sending failed:', err);
      this.setStepState('compress', 'failed', 'Error occurred during processing.');
      this.setStepState('email', 'failed', err.message);

      if (overallBadge) {
        overallBadge.textContent = 'Failed';
        overallBadge.style.color = '#ef4444';
      }

      helpers.showToast(err.message || 'Failed to send sermon', 'error');
    } finally {
      this.isSending = false;
    }
  },

  // ================= SETTINGS MANAGEMENT =================
  async loadSettings() {
    try {
      const res = await api.sermons.getSettings();
      this.settings = res.settings || {};
    } catch (err) {
      console.warn('Failed to load sermon settings:', err);
    }
  },

  openSettingsModal() {
    const inputSender = document.getElementById('sermon-cfg-sender-email');
    const inputPass = document.getElementById('sermon-cfg-sender-password');
    const inputReceiver = document.getElementById('sermon-cfg-receiver-email');
    const inputSubj = document.getElementById('sermon-cfg-subject-template');
    const inputBody = document.getElementById('sermon-cfg-body-template');
    const inputRetention = document.getElementById('sermon-cfg-retention-days');
    const inputTargetSize = document.getElementById('sermon-cfg-target-size');

    if (inputSender) inputSender.value = this.settings.sender_email || '';
    if (inputPass) {
      inputPass.value = this.settings.sender_app_password || '';
      inputPass.type = 'password';
      const btnToggle = document.getElementById('btn-toggle-sermon-app-pass');
      if (btnToggle) {
        const iconShow = btnToggle.querySelector('.icon-eye-show');
        const iconHide = btnToggle.querySelector('.icon-eye-hide');
        if (iconShow) iconShow.style.display = 'block';
        if (iconHide) iconHide.style.display = 'none';
      }
    }
    if (inputReceiver) inputReceiver.value = this.settings.receiver_email || '';
    if (inputSubj) inputSubj.value = this.settings.subject_template || '{context} Sermon {date}';
    if (inputBody) inputBody.value = this.settings.body_template || 'God bless you. This is the recording for the sermon delivered on {date}, "{title}."\n\n[This email was automatically generated by AV Audit Recordings Sender]';
    if (inputRetention) inputRetention.value = this.settings.retention_days || 14;
    if (inputTargetSize) inputTargetSize.value = this.settings.target_file_size_mb || 15;

    helpers.openModal('modal-sermon-settings');
  },

  async handleSaveSettings() {
    const inputSender = document.getElementById('sermon-cfg-sender-email');
    const inputPass = document.getElementById('sermon-cfg-sender-password');
    const inputReceiver = document.getElementById('sermon-cfg-receiver-email');
    const inputSubj = document.getElementById('sermon-cfg-subject-template');
    const inputBody = document.getElementById('sermon-cfg-body-template');
    const inputRetention = document.getElementById('sermon-cfg-retention-days');
    const inputTargetSize = document.getElementById('sermon-cfg-target-size');

    const payload = {
      sender_email: inputSender ? inputSender.value.trim() : '',
      sender_app_password: inputPass ? inputPass.value.trim() : '',
      receiver_email: inputReceiver ? inputReceiver.value.trim() : '',
      subject_template: inputSubj ? inputSubj.value : '{context} Sermon {date}',
      body_template: inputBody ? inputBody.value : '',
      retention_days: inputRetention ? parseInt(inputRetention.value, 10) || 14 : 14,
      target_file_size_mb: inputTargetSize ? parseInt(inputTargetSize.value, 10) || 15 : 15
    };

    try {
      const res = await api.sermons.updateSettings(payload);
      if (res.success) {
        this.settings = res.settings;
        helpers.closeModal('modal-sermon-settings');
      }
    } catch (err) {
      console.error('Failed to save sermon settings:', err);
      helpers.showToast('Failed to save settings: ' + err.message, 'error');
    }
  },

  // ================= SUBMISSIONS HISTORY & ACTIONS =================
  async loadSubmissions() {
    if (this.isLoadingSubmissions) return;
    this.isLoadingSubmissions = true;

    try {
      const res = await api.sermons.getSubmissions();
      this.submissions = res.submissions || [];
      this.renderSubmissionsList();
    } catch (err) {
      console.warn('Could not load sermon submissions:', err);
    } finally {
      this.isLoadingSubmissions = false;
    }
  },

  renderSubmissionsList() {
    const container = document.getElementById('sermon-history-list');
    if (!container) return;

    if (this.submissions.length === 0) {
      container.innerHTML = '<div class="sermon-history-empty">No previous submissions found.</div>';
      return;
    }

    container.innerHTML = this.submissions.map(sub => {
      const dateObj = new Date(sub.created_at);
      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

      let tagClass = 'tag-sabbath';
      if (sub.is_custom_context) {
        tagClass = 'tag-custom';
      } else if (sub.context && sub.context.toLowerCase().includes('third day')) {
        tagClass = 'tag-thirdday';
      }

      return `
        <div class="sermon-history-card" data-id="${sub.id}">
          <div class="sermon-history-card-top">
            <span class="sermon-ctx-pill-tag ${tagClass}">${helpers.escapeHtml(sub.context || 'General')}</span>
            <span class="sermon-history-date">${dateStr} ${timeStr}</span>
          </div>
          <div class="sermon-history-card-title" title="${helpers.escapeHtml(sub.title)}">
            ${helpers.escapeHtml(sub.title)}
          </div>
          <div class="sermon-history-card-bottom">
            <div class="sermon-history-actions">
              <!-- Resend Button (Heroicon Refresh / Arrow Path) -->
              <button type="button" class="btn-sermon-action btn-resend-sermon" data-resend-id="${sub.id}" title="Resend sermon email">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
              </button>
              <!-- Delete Button (Heroicon Trash) -->
              <button type="button" class="btn-sermon-action btn-delete-sermon" data-delete-id="${sub.id}" title="Delete sermon recording">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach resend click listeners
    container.querySelectorAll('.btn-resend-sermon').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.resendId;
        this.handleResend(id, btn);
      });
    });

    // Attach delete click listeners
    container.querySelectorAll('.btn-delete-sermon').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.deleteId;
        this.handleDelete(id, btn);
      });
    });
  },

  async handleResend(submissionId, btnElement) {
    if (!submissionId) return;

    if (!confirm('Are you sure you want to resend this recording?')) {
      return;
    }

    if (btnElement) {
      btnElement.disabled = true;
      btnElement.style.opacity = '0.5';
    }

    try {
      const res = await api.sermons.resend(submissionId);
      if (res.success) {
        await this.loadSubmissions();
      }
    } catch (err) {
      console.error('Failed to resend sermon:', err);
      helpers.showToast('Failed to resend sermon: ' + err.message, 'error');
    } finally {
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.style.opacity = '';
      }
    }
  },

  async handleDelete(submissionId, btnElement) {
    if (!submissionId) return;

    if (!confirm('Are you sure you want to delete this sermon recording?')) {
      return;
    }

    if (btnElement) {
      btnElement.disabled = true;
      btnElement.style.opacity = '0.5';
    }

    try {
      const res = await api.sermons.delete(submissionId);
      if (res.success) {
        await this.loadSubmissions();
      }
    } catch (err) {
      console.error('Failed to delete sermon:', err);
      helpers.showToast('Failed to delete sermon: ' + err.message, 'error');
    } finally {
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.style.opacity = '';
      }
    }
  }
};

window.sermonSenderView = sermonSenderView;
