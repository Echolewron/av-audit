// Auth & Pending Approval View Controller
// Field-specific validation, inline error messaging, and Session Manager integration

const authView = {
  currentUser: null,

  init() {
    this.bindEvents();
    this.bindInputClearHandlers();
    this.loadVersion();
  },

  async loadVersion() {
    try {
      const config = await api.auth.getConfig();
      if (config && config.version) {
        const authVerEl = document.getElementById('auth-version-label');
        if (authVerEl) authVerEl.textContent = config.version;
        const sidebarVerEl = document.getElementById('app-version-label');
        if (sidebarVerEl) sidebarVerEl.textContent = config.version;
      }
    } catch (e) {
      // ignore
    }
  },

  bindInputClearHandlers() {
    const inputs = document.querySelectorAll('#form-login input, #form-register input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        input.classList.remove('is-invalid');
        const errorContainer = input.parentElement.querySelector('.form-error-msg');
        if (errorContainer) {
          errorContainer.textContent = '';
          errorContainer.classList.remove('visible');
        }
      });
    });
  },

  showFieldError(fieldId, errorMsgId, message) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(errorMsgId);

    if (input) {
      input.classList.add('is-invalid');
      input.focus();
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  },

  clearFieldErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.querySelectorAll('.form-control').forEach(input => input.classList.remove('is-invalid'));
    form.querySelectorAll('.form-error-msg').forEach(msg => {
      msg.textContent = '';
      msg.classList.remove('visible');
    });
  },

  bindEvents() {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const btnLogout = document.getElementById('btn-logout');
    const btnPendingLogout = document.getElementById('btn-pending-logout');
    const btnCheckPendingStatus = document.getElementById('btn-check-pending-status');

    if (tabLogin) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        if (tabRegister) tabRegister.classList.remove('active');
        if (formLogin) formLogin.style.display = 'block';
        if (formRegister) formRegister.style.display = 'none';
        this.clearFieldErrors('form-login');
        this.clearFieldErrors('form-register');
      });
    }

    if (tabRegister) {
      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        if (tabLogin) tabLogin.classList.remove('active');
        if (formLogin) formLogin.style.display = 'none';
        if (formRegister) formRegister.style.display = 'block';
        this.clearFieldErrors('form-login');
        this.clearFieldErrors('form-register');
      });
    }

    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        this.clearFieldErrors('form-login');

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username) {
          this.showFieldError('login-username', 'error-login-username', "Please enter your username.");
          return;
        }
        if (!password) {
          this.showFieldError('login-password', 'error-login-password', "Please enter your password.");
          return;
        }

        try {
          const res = await api.auth.login(username, password);
          sessionStorage.removeItem('av_pending_username');
          sessionStorage.removeItem('av_pending_user');
          formLogin.reset();
          this.hideAuthPage();
          await window.app.loadCurrentUser();

          // Initialize inactivity timer on sign-in
          if (window.sessionManager) {
            window.sessionManager.start();
          }
        } catch (err) {
          if (err.code === 'USER_NOT_FOUND' || err.field === 'username') {
            this.showFieldError('login-username', 'error-login-username', err.message || "User doesn't exist");
          } else if (err.code === 'INVALID_PASSWORD' || err.field === 'password') {
            this.showFieldError('login-password', 'error-login-password', err.message || "Incorrect password");
          } else if (err.code === 'ACCOUNT_PENDING') {
            sessionStorage.setItem('av_pending_username', username);
            sessionStorage.setItem('av_pending_user', JSON.stringify({ username, status: 'PENDING' }));
            this.hideAuthPage();
            window.app.showPendingView({ username, status: 'PENDING' });
          } else if (err.code === 'ACCOUNT_SUSPENDED') {
            helpers.showToast('Your account is suspended. Contact an administrator.', 'error');
          } else {
            helpers.showToast(err.message || 'Login failed', 'error');
          }
        }
      });
    }

    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        this.clearFieldErrors('form-register');

        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm-password').value;

        if (!username || username.length < 4) {
          this.showFieldError('reg-username', 'error-reg-username', 'Username must be at least 4 characters long.');
          return;
        }

        if (!password || password.length < 4) {
          this.showFieldError('reg-password', 'error-reg-password', 'Password must be at least 4 characters long.');
          return;
        }

        if (password !== confirm) {
          this.showFieldError('reg-confirm-password', 'error-reg-confirm-password', 'Passwords do not match.');
          return;
        }

        try {
          const res = await api.auth.register(username, password);
          sessionStorage.setItem('av_pending_username', username);
          sessionStorage.setItem('av_pending_user', JSON.stringify({ username, status: 'PENDING' }));
          formRegister.reset();
          this.hideAuthPage();
          window.app.showPendingView({ username, status: 'PENDING' });
        } catch (err) {
          if (err.code === 'USERNAME_TAKEN' || err.field === 'username') {
            this.showFieldError('reg-username', 'error-reg-username', err.message || "Username already exists");
          } else {
            helpers.showToast(err.message || 'Registration failed', 'error');
          }
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        if (window.sessionManager) {
          window.sessionManager.stop();
        }
        try {
          await api.auth.logout();
          sessionStorage.removeItem('av_pending_username');
          sessionStorage.removeItem('av_pending_user');
          this.currentUser = null;
          this.showAuthPage();
        } catch (err) {
          this.showAuthPage();
        }
      });
    }

    if (btnPendingLogout) {
      btnPendingLogout.addEventListener('click', async () => {
        if (window.sessionManager) {
          window.sessionManager.stop();
        }
        sessionStorage.removeItem('av_pending_username');
        sessionStorage.removeItem('av_pending_user');
        try {
          await api.auth.logout();
        } catch (_) { }
        this.showAuthPage();
      });
    }

    if (btnCheckPendingStatus) {
      btnCheckPendingStatus.addEventListener('click', async () => {
        const pendingUsername = sessionStorage.getItem('av_pending_username') || this.currentUser?.username;
        if (!pendingUsername) {
          helpers.showToast('Unable to determine username. Please try signing in.', 'warning');
          this.showAuthPage();
          return;
        }

        helpers.showToast('Checking account status...', 'info');
        try {
          const res = await api.auth.checkStatus(pendingUsername);
          if (res.status === 'PENDING') {
            helpers.showToast('Your account is still pending approval by an administrator.', 'info');
          } else if (res.status === 'ACTIVE') {
            sessionStorage.removeItem('av_pending_username');
            sessionStorage.removeItem('av_pending_user');
            helpers.showToast('Your account has been approved! Please sign in.', 'success');
            this.showAuthPage();
            const loginInput = document.getElementById('login-username');
            if (loginInput) loginInput.value = pendingUsername;
            const passInput = document.getElementById('login-password');
            if (passInput) passInput.focus();
          } else if (res.status === 'SUSPENDED') {
            helpers.showToast('Your account has been suspended. Please contact an administrator.', 'error');
          } else if (res.status === 'NOT_FOUND') {
            sessionStorage.removeItem('av_pending_username');
            sessionStorage.removeItem('av_pending_user');
            helpers.showToast('Account registration request was not found or was rejected.', 'error');
            this.showAuthPage();
          }
        } catch (err) {
          helpers.showToast('Error checking account status. Please try again.', 'error');
        }
      });
    }

    const btnUserSettings = document.getElementById('btn-user-settings');
    const formChangePassword = document.getElementById('form-change-password');

    if (btnUserSettings) {
      btnUserSettings.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');

        const user = this.currentUser || (window.app && window.app.user);
        if (user) {
          const avatarEl = document.getElementById('modal-settings-avatar');
          const nameEl = document.getElementById('modal-settings-username');
          if (avatarEl) avatarEl.textContent = (user.username || 'U').charAt(0).toUpperCase();
          if (nameEl) nameEl.textContent = user.username;
        }
        if (formChangePassword) formChangePassword.reset();
        this.clearFieldErrors('form-change-password');
        this.syncThemeUI(this.getCurrentTheme());
        this.syncAccentUI();
        helpers.openModal('modal-user-settings');
      });
    }

    if (formChangePassword) {
      formChangePassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        this.clearFieldErrors('form-change-password');

        const currentPass = document.getElementById('settings-current-password').value;
        const newPass = document.getElementById('settings-new-password').value;
        const confirmPass = document.getElementById('settings-confirm-password').value;

        if (!currentPass) {
          this.showFieldError('settings-current-password', 'error-settings-current-password', 'Please enter your current password.');
          return;
        }

        if (!newPass || newPass.length < 4) {
          this.showFieldError('settings-new-password', 'error-settings-new-password', 'New password must be at least 4 characters long.');
          return;
        }

        if (newPass !== confirmPass) {
          this.showFieldError('settings-confirm-password', 'error-settings-confirm-password', 'Passwords do not match.');
          return;
        }

        const btnSave = document.getElementById('btn-save-password-change');
        if (btnSave) {
          btnSave.disabled = true;
          btnSave.textContent = 'Updating...';
        }

        try {
          const res = await api.auth.changePassword(currentPass, newPass);
          helpers.showToast(res.message || 'Password updated successfully!', 'success');
          formChangePassword.reset();
          helpers.closeModal('modal-user-settings');
        } catch (err) {
          if (err.field === 'currentPassword' || err.code === 'INVALID_CURRENT_PASSWORD') {
            this.showFieldError('settings-current-password', 'error-settings-current-password', err.message || 'Incorrect current password.');
          } else if (err.field === 'newPassword' || err.code === 'INVALID_PASSWORD_LENGTH') {
            this.showFieldError('settings-new-password', 'error-settings-new-password', err.message || 'Invalid new password.');
          } else {
            helpers.showToast(err.message || 'Failed to update password', 'error');
          }
        } finally {
          if (btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'Update Password';
          }
        }
      });
    }

    const btnPublicLogin = document.getElementById('btn-public-login');
    const btnBackToPublic = document.getElementById('btn-back-to-public-checklist');

    if (btnPublicLogin) {
      btnPublicLogin.addEventListener('click', () => {
        this.showAuthPage(true);
      });
    }

    if (btnBackToPublic) {
      btnBackToPublic.addEventListener('click', () => {
        this.hideAuthPage();
        if (window.app.publicChecklistId) {
          window.app.enterPublicReadOnlyMode(window.app.publicChecklistId);
        }
      });
    }

    // Theme Option Cards in Account Settings Modal
    const themeCards = document.querySelectorAll('.theme-option-card');
    themeCards.forEach(card => {
      const handleThemeSelect = () => {
        const targetTheme = card.dataset.themeVal;
        if (window.app && typeof window.app.applyTheme === 'function') {
          window.app.applyTheme(targetTheme, true);
        } else {
          document.documentElement.setAttribute('data-theme', targetTheme);
          try { localStorage.setItem('av_audit_theme', targetTheme); } catch (_) {}
        }
        this.syncThemeUI(targetTheme);
        helpers.showToast(`Theme switched to ${targetTheme === 'white' ? 'White' : 'Dark'}!`, 'success');
      };

      card.addEventListener('click', handleThemeSelect);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleThemeSelect();
        }
      });
    });

    // Dark Theme Accent Customizer Controls
    const darkPicker = document.getElementById('theme-dark-accent-picker');
    const darkHex = document.getElementById('theme-dark-accent-hex');
    const btnResetDark = document.getElementById('btn-reset-dark-accent');

    if (darkPicker) {
      darkPicker.addEventListener('input', (e) => {
        const val = e.target.value;
        if (darkHex) darkHex.value = val.toUpperCase();
        if (window.app && typeof window.app.applyAccents === 'function') {
          window.app.applyAccents({ darkAccent: val }, true);
        }
      });
    }

    if (darkHex) {
      darkHex.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          if (darkPicker) darkPicker.value = val;
          if (window.app && typeof window.app.applyAccents === 'function') {
            window.app.applyAccents({ darkAccent: val }, true);
          }
        }
      });
    }

    if (btnResetDark) {
      btnResetDark.addEventListener('click', (e) => {
        e.preventDefault();
        const defaultDark = '#18edb3';
        if (darkPicker) darkPicker.value = defaultDark;
        if (darkHex) darkHex.value = defaultDark.toUpperCase();
        if (window.app && typeof window.app.applyAccents === 'function') {
          window.app.applyAccents({ darkAccent: defaultDark }, true);
        }
        helpers.showToast('Dark theme accent reset to default.', 'info');
      });
    }

    // White Theme Accent Customizer Controls
    const whitePicker = document.getElementById('theme-white-accent-picker');
    const whiteHex = document.getElementById('theme-white-accent-hex');
    const btnResetWhite = document.getElementById('btn-reset-white-accent');

    if (whitePicker) {
      whitePicker.addEventListener('input', (e) => {
        const val = e.target.value;
        if (whiteHex) whiteHex.value = val.toUpperCase();
        if (window.app && typeof window.app.applyAccents === 'function') {
          window.app.applyAccents({ whiteAccent: val }, true);
        }
      });
    }

    if (whiteHex) {
      whiteHex.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          if (whitePicker) whitePicker.value = val;
          if (window.app && typeof window.app.applyAccents === 'function') {
            window.app.applyAccents({ whiteAccent: val }, true);
          }
        }
      });
    }

    if (btnResetWhite) {
      btnResetWhite.addEventListener('click', (e) => {
        e.preventDefault();
        const defaultWhite = '#28AFF3';
        if (whitePicker) whitePicker.value = defaultWhite;
        if (whiteHex) whiteHex.value = defaultWhite.toUpperCase();
        if (window.app && typeof window.app.applyAccents === 'function') {
          window.app.applyAccents({ whiteAccent: defaultWhite }, true);
        }
        helpers.showToast('White theme accent reset to default.', 'info');
      });
    }

    // Swatches for both themes
    const swatchButtons = document.querySelectorAll('.theme-swatch-btn');
    swatchButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.dataset.target;
        const color = btn.dataset.color;
        if (!color) return;

        if (target === 'dark') {
          if (darkPicker) darkPicker.value = color;
          if (darkHex) darkHex.value = color.toUpperCase();
          if (window.app && typeof window.app.applyAccents === 'function') {
            window.app.applyAccents({ darkAccent: color }, true);
          }
        } else if (target === 'white') {
          if (whitePicker) whitePicker.value = color;
          if (whiteHex) whiteHex.value = color.toUpperCase();
          if (window.app && typeof window.app.applyAccents === 'function') {
            window.app.applyAccents({ whiteAccent: color }, true);
          }
        }
      });
    });
  },

  getCurrentTheme() {
    if (window.app && window.app.user && window.app.user.theme) {
      return window.app.user.theme;
    }
    return document.documentElement.getAttribute('data-theme') || (localStorage.getItem('av_audit_theme') || 'dark');
  },

  syncThemeUI(theme) {
    const validTheme = theme === 'white' ? 'white' : 'dark';
    const darkCard = document.getElementById('theme-opt-dark');
    const whiteCard = document.getElementById('theme-opt-white');
    const indicator = document.getElementById('theme-active-indicator');
    if (darkCard) darkCard.classList.toggle('active', validTheme === 'dark');
    if (whiteCard) whiteCard.classList.toggle('active', validTheme === 'white');
    if (indicator) {
      indicator.textContent = validTheme === 'white' ? 'White Theme Active' : 'Dark Theme Active';
    }
  },

  syncAccentUI(darkAccent, whiteAccent) {
    const dColor = darkAccent || (window.app && window.app.darkAccent) || localStorage.getItem('av_audit_dark_accent') || '#18edb3';
    const wColor = whiteAccent || (window.app && window.app.whiteAccent) || localStorage.getItem('av_audit_white_accent') || '#28AFF3';

    const darkPicker = document.getElementById('theme-dark-accent-picker');
    const darkHex = document.getElementById('theme-dark-accent-hex');
    const darkDot = document.getElementById('theme-dot-dark');
    const darkDesc = document.getElementById('theme-desc-dark');

    if (darkPicker) darkPicker.value = dColor;
    if (darkHex) darkHex.value = dColor.toUpperCase();
    if (darkDot) {
      darkDot.style.background = dColor;
      darkDot.style.boxShadow = 'none';
    }
    if (darkDesc) {
      darkDesc.textContent = dColor.toLowerCase() === '#18edb3' ? 'Neon Green Accent' : `${dColor.toUpperCase()} Accent`;
    }

    const whitePicker = document.getElementById('theme-white-accent-picker');
    const whiteHex = document.getElementById('theme-white-accent-hex');
    const whiteDot = document.getElementById('theme-dot-white');
    const whiteDesc = document.getElementById('theme-desc-white');

    if (whitePicker) whitePicker.value = wColor;
    if (whiteHex) whiteHex.value = wColor.toUpperCase();
    if (whiteDot) {
      whiteDot.style.background = wColor;
      whiteDot.style.boxShadow = 'none';
    }
    if (whiteDesc) {
      whiteDesc.textContent = wColor.toLowerCase() === '#28aff3' ? 'Cyan #28AFF3 Accent' : `${wColor.toUpperCase()} Accent`;
    }

    // Highlight active swatch buttons
    document.querySelectorAll('.theme-swatch-btn').forEach(btn => {
      const target = btn.dataset.target;
      const color = btn.dataset.color;
      if (target === 'dark') {
        btn.classList.toggle('active', color.toLowerCase() === dColor.toLowerCase());
      } else if (target === 'white') {
        btn.classList.toggle('active', color.toLowerCase() === wColor.toLowerCase());
      }
    });
  },

  showAuthPage(fromPublicChecklist = false) {
    if (window.sessionManager) {
      window.sessionManager.stop();
    }
    if (window.helpers && typeof window.helpers.closeAllModals === 'function') {
      window.helpers.closeAllModals();
    } else {
      document.querySelectorAll('.modal-backdrop.active, .modal.active').forEach(m => m.classList.remove('active'));
    }

    const authPage = document.getElementById('auth-page');
    const appContainer = document.getElementById('app-container');
    const returnBar = document.getElementById('auth-public-return-bar');

    if (authPage) authPage.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    if (returnBar) returnBar.style.display = fromPublicChecklist ? 'block' : 'none';

    // Reset tabs to Login
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (tabLogin) tabLogin.classList.add('active');
    if (tabRegister) tabRegister.classList.remove('active');
    if (formLogin) formLogin.style.display = 'block';
    if (formRegister) formRegister.style.display = 'none';

    this.clearFieldErrors('form-login');
    this.clearFieldErrors('form-register');
  },

  hideAuthPage() {
    const authPage = document.getElementById('auth-page');
    const appContainer = document.getElementById('app-container');
    const returnBar = document.getElementById('auth-public-return-bar');
    if (authPage) authPage.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
    if (returnBar) returnBar.style.display = 'none';
  },

  updateProfileWidget(user) {
    this.currentUser = user;
    if (!user) return;

    const initialEl = document.getElementById('user-avatar-initial');
    const nameEl = document.getElementById('profile-username');
    const roleBadgeEl = document.getElementById('profile-role-badge');

    const topRole = (user.roles && user.roles.length > 0) ? user.roles[0] : null;

    if (initialEl) {
      initialEl.textContent = (user.username || 'U').charAt(0).toUpperCase();
      if (topRole && topRole.color_hex) {
        initialEl.style.borderColor = topRole.color_hex;
      } else {
        initialEl.style.borderColor = '';
      }
    }
    if (nameEl) nameEl.textContent = user.username;

    if (roleBadgeEl) {
      if (user.status === 'PENDING') {
        roleBadgeEl.style.display = 'none';
      } else if (topRole) {
        roleBadgeEl.style.display = 'inline-block';
        roleBadgeEl.textContent = topRole.name;
        roleBadgeEl.title = topRole.name;
        roleBadgeEl.className = 'badge user-role-badge';
        const color = topRole.color_hex || '#58a6ff';
        roleBadgeEl.style.backgroundColor = `${color}22`;
        roleBadgeEl.style.color = color;
        roleBadgeEl.style.borderColor = `${color}55`;
      } else if (user.isAdmin) {
        roleBadgeEl.style.display = 'inline-block';
        roleBadgeEl.textContent = 'Administrator';
        roleBadgeEl.title = 'Administrator';
        roleBadgeEl.className = 'badge user-role-badge';
        roleBadgeEl.style.backgroundColor = 'rgba(88, 166, 255, 0.12)';
        roleBadgeEl.style.color = '#58a6ff';
        roleBadgeEl.style.borderColor = 'rgba(88, 166, 255, 0.35)';
      } else {
        roleBadgeEl.style.display = 'none';
      }
    }
  }
};

window.authView = authView;
