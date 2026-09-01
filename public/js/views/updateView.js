// AV Audit - Over-The-Air (OTA) System Updates View
const updateView = {
  isChecking: false,
  isUpdating: false,
  pollInterval: null,

  init() {
    this.bindEvents();
    this.bindSocketEvents();
  },

  canManageUpdates() {
    return window.app && typeof window.app.hasPermission === 'function'
      ? window.app.hasPermission('system', 'manage_updates')
      : false;
  },

  updatePermissionsUI() {
    const versionBadge = document.getElementById('sidebar-version-badge');
    if (!versionBadge) return;

    const allowed = this.canManageUpdates();
    if (allowed) {
      versionBadge.classList.add('is-clickable');
      versionBadge.setAttribute('title', 'Check for system updates');
      versionBadge.setAttribute('tabindex', '0');
      versionBadge.setAttribute('role', 'button');
    } else {
      versionBadge.classList.remove('is-clickable');
      versionBadge.removeAttribute('title');
      versionBadge.removeAttribute('tabindex');
      versionBadge.removeAttribute('role');
    }
  },

  bindEvents() {
    // 1. Click on sidebar version badge opens update modal
    const versionBadge = document.getElementById('sidebar-version-badge');
    if (versionBadge) {
      versionBadge.addEventListener('click', (e) => {
        if (!this.canManageUpdates()) return;
        e.stopPropagation();
        this.openModal();
      });
      versionBadge.addEventListener('keydown', (e) => {
        if (!this.canManageUpdates()) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.openModal();
        }
      });
    }

    // 2. Recheck button
    const btnRecheck = document.getElementById('btn-recheck-update');
    if (btnRecheck) {
      btnRecheck.addEventListener('click', () => {
        this.checkForUpdates();
      });
    }

    // 3. Install Update button
    const btnInstall = document.getElementById('btn-install-update');
    if (btnInstall) {
      btnInstall.addEventListener('click', () => {
        this.confirmAndApplyUpdate();
      });
    }
  },

  bindSocketEvents() {
    // Global listener for system update in progress broadcast
    window.addEventListener('socket_system_updating', (e) => {
      this.showUpdatingOverlay(e.detail?.message);
    });

    if (window.socketClient && window.socketClient.socket) {
      window.socketClient.socket.on('system:updating', (data) => {
        this.showUpdatingOverlay(data?.message);
      });
    }
  },

  openModal() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';

    helpers.openModal('modal-system-update');
    this.checkForUpdates();
  },

  async checkForUpdates() {
    if (this.isChecking) return;
    this.isChecking = true;

    const spinner = document.getElementById('update-check-spinner');
    const title = document.getElementById('update-status-title');
    const subtitle = document.getElementById('update-status-subtitle');
    const curVerEl = document.getElementById('update-current-version');
    const latVerEl = document.getElementById('update-latest-version');
    const btnInstall = document.getElementById('btn-install-update');
    const changelogWrap = document.getElementById('update-changelog-wrap');
    const changelogBox = document.getElementById('update-changelog-box');
    const warningAlert = document.getElementById('update-admin-warning');

    if (spinner) spinner.style.display = 'block';
    if (title) title.textContent = 'Checking for updates...';
    if (subtitle) subtitle.textContent = 'Querying GitHub repository...';
    if (btnInstall) btnInstall.style.display = 'none';
    if (changelogWrap) changelogWrap.style.display = 'none';
    if (warningAlert) warningAlert.style.display = 'none';

    try {
      const data = await api.system.checkUpdate();
      if (curVerEl) curVerEl.textContent = data.currentVersion || '-';
      if (latVerEl) {
        latVerEl.textContent = data.latestVersion || '-';
        latVerEl.className = 'update-version-val ' + (data.updateAvailable ? 'update-ready' : 'is-latest');
      }

      if (spinner) spinner.style.display = 'none';

      if (data.updateAvailable) {
        if (title) title.textContent = '🚀 New update available!';
        if (subtitle) subtitle.textContent = `Release ${data.latestVersion} is ready to install from GitHub.`;

        if (data.changelog) {
          if (changelogBox) changelogBox.textContent = data.changelog;
          if (changelogWrap) changelogWrap.style.display = 'block';
        }

        const isAdmin = window.app?.user?.isAdmin;
        if (btnInstall && isAdmin) {
          btnInstall.style.display = 'inline-flex';
          if (warningAlert) warningAlert.style.display = 'block';
        }
      } else {
        if (title) title.textContent = '✨ You are up to date';
        if (subtitle) subtitle.textContent = `AV Audit is running the latest release (${data.currentVersion}).`;
      }
    } catch (err) {
      if (spinner) spinner.style.display = 'none';
      if (title) title.textContent = 'Unable to check updates';
      if (subtitle) subtitle.textContent = err.message || 'Check network connection or GitHub repository settings.';
    } finally {
      this.isChecking = false;
    }
  },

  async confirmAndApplyUpdate() {
    if (!this.canManageUpdates()) {
      helpers.showToast('You do not have permission to trigger system updates.', 'error');
      return;
    }

    const confirmed = confirm(
      'Are you sure you want to install this update now?\n\n' +
      'The server will pull latest code from GitHub and restart via PM2. All connected users will briefly pause and reload.'
    );

    if (!confirmed) return;

    // Close modal and show global updating screen
    helpers.closeModal('modal-system-update');
    this.showUpdatingOverlay('Starting update process...');

    try {
      await api.system.applyUpdate();
      // Server will restart via PM2 in ~1.5s
    } catch (err) {
      const statusText = document.getElementById('updating-status-text');
      if (statusText) statusText.textContent = `Update error: ${err.message}`;
      helpers.showToast(`Update error: ${err.message}`, 'error');
      setTimeout(() => {
        this.hideUpdatingOverlay();
      }, 4000);
    }
  },

  showUpdatingOverlay(message) {
    if (this.isUpdating) return;
    this.isUpdating = true;

    const overlay = document.getElementById('system-updating-overlay');
    const statusText = document.getElementById('updating-status-text');
    if (overlay) overlay.style.display = 'flex';
    if (statusText) statusText.textContent = message || 'Restarting server process...';

    // Start polling to detect when the server comes back online
    this.startRebootPolling();
  },

  hideUpdatingOverlay() {
    this.isUpdating = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    const overlay = document.getElementById('system-updating-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  startRebootPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    let attempts = 0;
    let consecutiveSuccesses = 0;
    const requiredConsecutive = 2;

    // Wait 2.5 seconds to allow process exit and PM2 restart to initialize
    setTimeout(() => {
      this.pollInterval = setInterval(async () => {
        attempts++;
        const statusText = document.getElementById('updating-status-text');

        try {
          // Use AbortController timeout to prevent hanging connections during tunnel reconnection
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);

          const res = await fetch('/api/auth/client-config', {
            cache: 'no-store',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          // Verify HTTP 200 AND valid JSON body from actual backend (not Cloudflare HTML error page)
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data && typeof data === 'object' && ('allowRegistration' in data || 'timezone' in data)) {
              consecutiveSuccesses++;
              if (statusText) {
                statusText.textContent = `Server back online! Verifying connection (${consecutiveSuccesses}/${requiredConsecutive})...`;
              }

              if (consecutiveSuccesses >= requiredConsecutive) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
                if (statusText) {
                  statusText.textContent = 'Update complete! Reloading application...';
                }
                setTimeout(() => {
                  window.location.reload(true);
                }, 600);
                return;
              }
            } else {
              consecutiveSuccesses = 0;
            }
          } else {
            consecutiveSuccesses = 0;
          }
        } catch (e) {
          // Still rebooting or tunnel establishing connection
          consecutiveSuccesses = 0;
        }

        if (consecutiveSuccesses === 0 && statusText) {
          statusText.textContent = `Waiting for server and tunnel to come back online... (${attempts}s)`;
        }
      }, 1000);
    }, 2500);
  }
};

window.updateView = updateView;
