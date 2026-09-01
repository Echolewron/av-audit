// Session Inactivity & Auto-Logout Manager
// Floating "Are you still there?" warning banner, 10-min M:SS countdown, right-to-left progress bar, and 2-hour cookie renewal

const sessionManager = {
  // Inactivity threshold: 2 hours (minus 10 minutes warning period)
  INACTIVITY_LIMIT_MS: (2 * 60 * 60 * 1000) - (10 * 60 * 1000), // 1h 50m of silence triggers 10m countdown
  COUNTDOWN_DURATION_SEC: 10 * 60, // 10 minutes = 600 seconds

  inactivityTimer: null,
  countdownInterval: null,
  remainingSeconds: 600,
  isActive: false,
  isWarningActive: false,

  async init() {
    this.bindEvents();
    await this.loadConfig();
  },

  async loadConfig() {
    try {
      if (window.api && window.api.auth && typeof window.api.auth.getConfig === 'function') {
        const cfg = await api.auth.getConfig();
        if (cfg) {
          const warnMs = cfg.inactivityWarningMs || (10 * 60 * 1000);
          const totalMs = cfg.sessionDurationMs || (2 * 60 * 60 * 1000);
          this.INACTIVITY_LIMIT_MS = Math.max(1000, totalMs - warnMs);
          this.COUNTDOWN_DURATION_SEC = Math.round(warnMs / 1000);
        }
      }
    } catch (_) {}
  },

  bindEvents() {
    // Activity listeners to reset idle clock
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(eventType => {
      window.addEventListener(eventType, () => this.handleUserActivity(), { passive: true });
    });

    // "I'm Still Here" Extend Session Button
    const btnExtend = document.getElementById('btn-extend-session');
    if (btnExtend) {
      btnExtend.addEventListener('click', () => this.extendSession());
    }
  },

  start() {
    this.stop();
    this.isActive = true;
    this.isWarningActive = false;
    this.hideWarningBanner(false);
    this.resetInactivityTimer();
  },

  stop() {
    this.isActive = false;
    this.isWarningActive = false;
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.inactivityTimer = null;
    this.countdownInterval = null;
    this.hideWarningBanner(false);
  },

  handleUserActivity() {
    if (!this.isActive) return;
    // If the warning card is currently visible, user activity alone does not dismiss it — they must explicitly click "I'm Still Here"
    if (!this.isWarningActive) {
      this.resetInactivityTimer();
    }
  },

  resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (!this.isActive) return;

    this.inactivityTimer = setTimeout(() => {
      this.showWarningBanner();
    }, this.INACTIVITY_LIMIT_MS);
  },

  showWarningBanner(durationSec = this.COUNTDOWN_DURATION_SEC) {
    if (!this.isActive) return;
    this.isWarningActive = true;
    this.remainingSeconds = durationSec;

    const banner = document.getElementById('inactivity-warning-banner');
    if (banner) {
      banner.style.display = 'block';
      // Trigger reflow for smooth entrance animation
      void banner.offsetWidth;
      banner.classList.add('visible');
    }

    this.updateCountdownDisplay();

    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      this.remainingSeconds -= 1;
      this.updateCountdownDisplay();

      if (this.remainingSeconds <= 0) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        this.handleTimeoutExpiry();
      }
    }, 1000);
  },

  hideWarningBanner(animate = true) {
    this.isWarningActive = false;
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    const banner = document.getElementById('inactivity-warning-banner');
    if (!banner) return;

    if (animate) {
      banner.classList.remove('visible');
      setTimeout(() => {
        if (!this.isWarningActive) {
          banner.style.display = 'none';
        }
      }, 350);
    } else {
      banner.classList.remove('visible');
      banner.style.display = 'none';
    }
  },

  updateCountdownDisplay() {
    const totalSec = Math.max(0, this.remainingSeconds);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

    const displayEl = document.getElementById('inactivity-countdown-display');
    if (displayEl) {
      displayEl.textContent = formatted;
    }

    // Decreasing progress bar right-to-left: 100% at start -> 0% at expiry
    const progressBar = document.getElementById('inactivity-btn-progress-bar');
    if (progressBar) {
      const percentage = Math.max(0, Math.min(100, (totalSec / this.COUNTDOWN_DURATION_SEC) * 100));
      progressBar.style.width = `${percentage}%`;
    }
  },

  async extendSession() {
    try {
      await api.auth.extendSession();
      helpers.showToast('Your session has been extended for 2 more hours.', 'success');
      this.hideWarningBanner(true);
      this.resetInactivityTimer();
    } catch (err) {
      console.error('Failed to extend session:', err);
      // If extension fails due to session expiry, log out gracefully
      this.handleTimeoutExpiry();
    }
  },

  async handleTimeoutExpiry() {
    this.stop();
    helpers.showToast('Your session expired due to inactivity. Please sign in again.', 'warning');
    try {
      await api.auth.logout();
    } catch (_) {}
    if (window.authView) {
      window.authView.currentUser = null;
      window.authView.showAuthPage();
    }
  },

  // Manual Trigger helper for Playwright & testing
  triggerWarningNowForTesting(countdownSeconds = 600) {
    this.isActive = true;
    this.showWarningBanner(countdownSeconds);
  }
};

window.sessionManager = sessionManager;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => sessionManager.init());
} else {
  sessionManager.init();
}
