// AV Audit - Main Application Bootstrap & Router
const app = {
  currentView: 'checklists',
  user: null,

  async init() {
    console.log('Initializing AV Audit Application...');
    
    // Initialize helpers & modals
    helpers.initModalCloseHandlers();

    // Initialize cached theme & accents
    try {
      const initialTheme = localStorage.getItem('av_audit_theme') || 'dark';
      this.applyTheme(initialTheme);
      this.applyAccents({
        darkAccent: localStorage.getItem('av_audit_dark_accent') || '#18edb3',
        whiteAccent: localStorage.getItem('av_audit_white_accent') || '#28AFF3'
      });
    } catch (_) {}
    
    // Initialize views
    authView.init();
    if (window.dashboardView) dashboardView.init();
    checklistsView.init();
    templatesView.init();
    rolesView.init();
    accountsView.init();
    auditView.init();
    if (window.sermonSenderView) sermonSenderView.init();
    if (window.updateView) updateView.init();

    // Initialize sockets
    socketClient.init();

    // Bind navigation and UI events
    this.bindNavigation();

    // Global unauthorized event
    window.addEventListener('auth_unauthorized', () => {
      // Never pop up sign-in page if in public read-only mode or navigating to a public checklist
      if (this.isPublicReadOnly || this.getChecklistIdFromPath()) {
        return;
      }
      this.user = null;
      authView.showAuthPage();
    });

    // Real-time permission changes event
    window.addEventListener('socket_permissions_updated', async (e) => {
      console.log('Permissions updated via socket event:', e.detail);
      await this.handlePermissionsUpdated();
    });

    // Check existing session
    await this.loadCurrentUser();
  },

  async handlePermissionsUpdated() {
    if (!this.user) return;
    try {
      const res = await api.auth.me();
      this.user = res.user;
      this.appVersion = res.appVersion;
      if (res.appVersion) {
        const verEl = document.getElementById('app-version-label');
        if (verEl) verEl.textContent = res.appVersion;
      }
      authView.updateProfileWidget(this.user);
      this.updateNavigationVisibility();
      checklistsView.updateTemplateSubTabVisibility();

      // Check if current view is still permitted
      const currentAllowed = this.isViewAllowed(this.currentView);
      if (!currentAllowed) {
        helpers.showToast('Your permissions have been updated by an administrator.', 'warning');
        this.switchView('checklists');
      } else {
        // Refresh active view data if relevant
        if (window.dashboardView) dashboardView.updatePermissionsUI();
        if (this.currentView === 'dashboard') dashboardView.render();
        if (this.currentView === 'sermon-sender' && window.sermonSenderView) sermonSenderView.render();
        if (this.currentView === 'roles') rolesView.loadRoles();
        if (this.currentView === 'accounts') accountsView.loadAccounts();
        if (this.currentView === 'audit') auditView.loadAuditLogs();
        if (this.currentView === 'checklists') checklistsView.loadChecklists();
      }
    } catch (err) {
      console.error('Failed to refresh user permissions:', err);
    }
  },

  bindNavigation() {
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    const mobileCloseBtn = document.getElementById('btn-close-mobile-nav');

    const openMobileNav = () => {
      if (sidebar) {
        sidebar.classList.add('mobile-open');
        document.body.style.overflow = 'hidden';
      }
    };

    const closeMobileNav = () => {
      if (sidebar) {
        sidebar.classList.remove('mobile-open');
        document.body.style.overflow = '';
      }
    };

    // Nav links (auto-close full-screen mobile nav on selection)
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        this.switchView(view);
        closeMobileNav();
      });
    });

    // Sidebar desktop collapse toggle
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }

    // Mobile menu open trigger
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMobileNav();
      });
    }

    // Mobile menu close trigger
    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMobileNav();
      });
    }

    // Dismiss on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar && sidebar.classList.contains('mobile-open')) {
        closeMobileNav();
      }
    });
  },

  getChecklistIdFromPath() {
    if (window.__INITIAL_CHECKLIST_ID__) return window.__INITIAL_CHECKLIST_ID__;
    const match = window.location.pathname.match(/\/c\/([^\/]+)/);
    return match ? match[1] : null;
  },

  applyTheme(theme, save = false) {
    const validTheme = theme === 'white' ? 'white' : 'dark';
    document.documentElement.setAttribute('data-theme', validTheme);
    try {
      localStorage.setItem('av_audit_theme', validTheme);
    } catch (_) {}
    if (this.user) {
      this.user.theme = validTheme;
    }
    if (window.authView && typeof authView.syncThemeUI === 'function') {
      authView.syncThemeUI(validTheme);
    }
    if (window.dashboardBlocklyService && typeof dashboardBlocklyService.setTheme === 'function') {
      dashboardBlocklyService.setTheme(validTheme);
    }
    if (save && this.user) {
      api.auth.updateTheme({ theme: validTheme }).catch(err => {
        console.error('Failed to save theme to user account:', err);
      });
    }
  },

  hexToRgb(hex) {
    let clean = (hex || '#18edb3').replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16);
    return [ (num >> 16) & 255, (num >> 8) & 255, num & 255 ].join(', ');
  },

  adjustBrightness(hex, percent) {
    let clean = (hex || '#18edb3').replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + Math.round(255 * (percent / 100))));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + Math.round(255 * (percent / 100))));
    const b = Math.max(0, Math.min(255, (num & 255) + Math.round(255 * (percent / 100))));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  getContrastText(hex) {
    let clean = (hex || '#18edb3').replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 150 ? '#051410' : '#ffffff';
  },

  applyAccents({ darkAccent, whiteAccent } = {}, save = false) {
    if (darkAccent) this.darkAccent = darkAccent;
    if (whiteAccent) this.whiteAccent = whiteAccent;

    if (!this.darkAccent) {
      this.darkAccent = (this.user && this.user.dark_accent) || localStorage.getItem('av_audit_dark_accent') || '#18edb3';
    }
    if (!this.whiteAccent) {
      this.whiteAccent = (this.user && this.user.white_accent) || localStorage.getItem('av_audit_white_accent') || '#28AFF3';
    }

    try {
      localStorage.setItem('av_audit_dark_accent', this.darkAccent);
      localStorage.setItem('av_audit_white_accent', this.whiteAccent);
    } catch (_) {}

    if (this.user) {
      this.user.dark_accent = this.darkAccent;
      this.user.white_accent = this.whiteAccent;
    }

    let styleEl = document.getElementById('custom-theme-accents');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-theme-accents';
      document.head.appendChild(styleEl);
    }

    const darkHover = this.adjustBrightness(this.darkAccent, -12);
    const darkRgb = this.hexToRgb(this.darkAccent);
    const darkText = this.getContrastText(this.darkAccent);

    const whiteHover = this.adjustBrightness(this.whiteAccent, -12);
    const whiteRgb = this.hexToRgb(this.whiteAccent);
    const whiteText = this.getContrastText(this.whiteAccent);

    styleEl.textContent = `
:root {
  --accent-primary: ${this.darkAccent} !important;
  --accent-primary-hover: ${darkHover} !important;
  --accent-primary-rgb: ${darkRgb} !important;
  --accent-primary-glow: rgba(${darkRgb}, 0.25) !important;
  --accent-glow: rgba(${darkRgb}, 0.15) !important;
  --accent-glow-subtle: rgba(${darkRgb}, 0.08) !important;
  --accent-border-glow: rgba(${darkRgb}, 0.35) !important;
  --accent-primary-text: ${darkText} !important;
}
[data-theme="white"] {
  --accent-primary: ${this.whiteAccent} !important;
  --accent-primary-hover: ${whiteHover} !important;
  --accent-primary-rgb: ${whiteRgb} !important;
  --accent-primary-glow: rgba(${whiteRgb}, 0.35) !important;
  --accent-glow: rgba(${whiteRgb}, 0.15) !important;
  --accent-glow-subtle: rgba(${whiteRgb}, 0.08) !important;
  --accent-border-glow: rgba(${whiteRgb}, 0.35) !important;
  --accent-primary-text: ${whiteText} !important;
}
`;

    if (window.authView && typeof authView.syncAccentUI === 'function') {
      authView.syncAccentUI(this.darkAccent, this.whiteAccent);
    }

    if (save && this.user) {
      this.debouncedSaveAccents();
    }
  },

  debouncedSaveAccents() {
    if (this._saveAccentTimeout) clearTimeout(this._saveAccentTimeout);
    this._saveAccentTimeout = setTimeout(() => {
      if (this.user) {
        api.auth.updateTheme({
          dark_accent: this.darkAccent,
          white_accent: this.whiteAccent
        }).catch(err => {
          console.error('Failed to save accent colors to user account:', err);
        });
      }
    }, 350);
  },

  async loadCurrentUser() {
    const targetChecklistId = this.publicChecklistId || this.getChecklistIdFromPath();

    try {
      const res = await api.auth.me();
      this.user = res.user;
      if (this.user) {
        if (this.user.theme) {
          this.applyTheme(this.user.theme);
        }
        if (this.user.dark_accent || this.user.white_accent) {
          this.applyAccents({
            darkAccent: this.user.dark_accent,
            whiteAccent: this.user.white_accent
          });
        }
      }
      this.appVersion = res.appVersion;
      if (res.appVersion) {
        const verEl = document.getElementById('app-version-label');
        if (verEl) verEl.textContent = res.appVersion;
      }

      if (this.user.status === 'PENDING') {
        authView.hideAuthPage();
        this.showPendingView();
        return;
      }

      // Exit public read-only mode if we were in it
      this.isPublicReadOnly = false;
      this.publicChecklistId = null;

      // Restore UI elements in case they were hidden for public mode
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.style.display = '';
      const mobileBtn = document.getElementById('btn-mobile-menu');
      if (mobileBtn) mobileBtn.style.display = '';
      const btnPublicLogin = document.getElementById('btn-public-login');
      if (btnPublicLogin) btnPublicLogin.style.display = 'none';

      authView.hideAuthPage();
      authView.updateProfileWidget(this.user);
      this.updateNavigationVisibility();
      
      // If a specific checklist was targeted via URL/share link, jump right into execution mode!
      if (targetChecklistId) {
        this.switchView('execution');
        window.checklistsView.openExecutionView(targetChecklistId);
      } else {
        this.switchView(this.currentView || 'checklists');
      }

      // Start inactivity monitoring for authenticated session
      if (window.sessionManager) {
        window.sessionManager.start();
      }
    } catch (err) {
      this.user = null;
      if (window.sessionManager) {
        window.sessionManager.stop();
      }
      if (targetChecklistId) {
        this.enterPublicReadOnlyMode(targetChecklistId);
      } else {
        authView.showAuthPage();
      }
    }
  },

  enterPublicReadOnlyMode(checklistId) {
    this.isPublicReadOnly = true;
    this.publicChecklistId = checklistId;

    authView.hideAuthPage();

    // Adjust UI for public guest view
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'none';
    const mobileBtn = document.getElementById('btn-mobile-menu');
    if (mobileBtn) mobileBtn.style.display = 'none';
    const btnPublicLogin = document.getElementById('btn-public-login');
    if (btnPublicLogin) btnPublicLogin.style.display = 'inline-flex';

    const breadcrumb = document.getElementById('breadcrumb-title');
    if (breadcrumb) breadcrumb.textContent = 'Checklist (Read-Only)';

    // Switch view DOM to execution view
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const execSec = document.getElementById('view-execution');
    if (execSec) execSec.classList.add('active');

    window.checklistsView.loadPublicExecutionView(checklistId);
  },

  hasPermission(module, action) {
    if (!this.user) return false;
    if (this.user.isAdmin) return true;
    if (!this.user.permissions || !Array.isArray(this.user.permissions)) return false;
    const permKey = `${module}.${action}`;
    return this.user.permissions.includes(permKey) || this.user.permissions.includes('*');
  },

  isViewAllowed(viewName) {
    if (!this.user) return false;
    if (this.user.isAdmin) return true;
    switch (viewName) {
      case 'dashboard':
        return this.hasPermission('dashboards', 'access_nav') || this.hasPermission('dashboards', 'manage_dashboards');
      case 'sermon-sender':
        return this.hasPermission('sermon_sender', 'access_nav');
      case 'checklists':
      case 'execution':
        return this.hasPermission('checklists', 'access_nav') || this.hasPermission('checklists', 'view_active');
      case 'roles':
        return this.hasPermission('roles', 'access_nav') || this.hasPermission('roles', 'manage_roles');
      case 'accounts':
        return this.hasPermission('accounts', 'access_nav') || this.hasPermission('accounts', 'view_users') || this.hasPermission('accounts', 'admit_pending');
      case 'audit':
        return this.hasPermission('audit', 'access_nav');
      default:
        return true;
    }
  },

  updateNavigationVisibility() {
    if (!this.user) return;

    const navItems = {
      dashboard: this.hasPermission('dashboards', 'access_nav') || this.hasPermission('dashboards', 'manage_dashboards'),
      'sermon-sender': this.hasPermission('sermon_sender', 'access_nav'),
      checklists: this.hasPermission('checklists', 'access_nav') || this.hasPermission('checklists', 'view_active'),
      roles: this.hasPermission('roles', 'access_nav') || this.hasPermission('roles', 'manage_roles'),
      accounts: this.hasPermission('accounts', 'access_nav') || this.hasPermission('accounts', 'view_users') || this.hasPermission('accounts', 'admit_pending'),
      audit: this.hasPermission('audit', 'access_nav')
    };

    for (const [navKey, isAllowed] of Object.entries(navItems)) {
      const itemEl = document.querySelector(`.nav-item[data-nav="${navKey}"]`);
      if (itemEl) {
        itemEl.style.display = isAllowed ? 'block' : 'none';
      }
    }

    if (window.checklistsView && typeof window.checklistsView.updateTemplateSubTabVisibility === 'function') {
      window.checklistsView.updateTemplateSubTabVisibility();
    }

    if (window.updateView && typeof window.updateView.updatePermissionsUI === 'function') {
      window.updateView.updatePermissionsUI();
    }
  },

  showPendingView(user) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const pendingSec = document.getElementById('view-pending-approval');
    if (pendingSec) pendingSec.classList.add('active');

    const breadcrumb = document.getElementById('breadcrumb-title');
    if (breadcrumb) breadcrumb.textContent = 'Account Pending Approval';

    // Hide sidebar nav during pending
    document.querySelectorAll('.nav-item').forEach(item => item.style.display = 'none');

    // Update profile widget with pending username and no role
    const pendingInfo = user || (sessionStorage.getItem('av_pending_user') ? JSON.parse(sessionStorage.getItem('av_pending_user')) : null) || { username: 'New User', status: 'PENDING' };
    authView.updateProfileWidget(pendingInfo);
  },

  switchView(viewName) {
    if (!this.isViewAllowed(viewName)) {
      helpers.showToast('You do not have permission to access this page.', 'error');
      return;
    }

    this.currentView = viewName;

    // Update Nav Link Active States
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update View Sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const targetSec = document.getElementById(`view-${viewName}`);
    if (targetSec) targetSec.classList.add('active');

    const breadcrumb = document.getElementById('breadcrumb-title');
    
    // View-specific loader hooks
    switch (viewName) {
      case 'dashboard':
        if (breadcrumb) breadcrumb.textContent = 'Dashboard';
        if (window.dashboardView && typeof window.dashboardView.render === 'function') {
          dashboardView.render();
        }
        break;
      case 'sermon-sender':
        if (breadcrumb) breadcrumb.textContent = 'Recordings Sender';
        if (window.sermonSenderView && typeof window.sermonSenderView.render === 'function') {
          sermonSenderView.render();
        }
        break;
      case 'checklists':
        if (breadcrumb) breadcrumb.textContent = 'Active Checklists';
        checklistsView.loadChecklists();
        break;
      case 'execution':
        if (breadcrumb) breadcrumb.textContent = 'Checklist Execution';
        break;
      case 'roles':
        if (breadcrumb) breadcrumb.textContent = 'Roles & Hierarchy';
        rolesView.loadRoles();
        break;
      case 'accounts':
        if (breadcrumb) breadcrumb.textContent = 'Account Management';
        accountsView.loadAccounts();
        break;
      case 'audit':
        if (breadcrumb) breadcrumb.textContent = 'Audit Log';
        auditView.loadAuditLogs();
        break;
    }
  }
};

window.app = app;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
