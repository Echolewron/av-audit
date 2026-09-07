// Session Inactivity & Auto-Logout Manager
// Floating "Are you still there?" warning banner, M:SS countdown, progress bar, multi-tab sync, and session renewal

const sessionManager = {
  // Defaults: 60 min (1 hour) total inactivity before logout, 5 min warning countdown
  SESSION_DURATION_MS: 60 * 60 * 1000,
  INACTIVITY_WARNING_MS: 5 * 60 * 1000,
  INACTIVITY_LIMIT_MS: (60 * 60 * 1000) - (5 * 60 * 1000), // 55m silence -> 5m countdown
  COUNTDOWN_DURATION_SEC: 5 * 60, // 300 seconds
  sessionDurationMinutes: 60,
  inactivityWarningMinutes: 5,

  inactivityTimer: null,
  countdownInterval: null,
  heartbeatInterval: null,
  remainingSeconds: 300,
  isActive: false,
  isWarningActive: false,
  lastActivityTimestamp: Date.now(),
  lastActivityThrottled: 0,
  configPromise: null,
  eventsBound: false,

  async init() {
    this.bindEvents();
    await this.loadConfig();
  },

  async loadConfig() {
    if (!this.configPromise) {
      this.configPromise = (async () => {
        try {
          if (window.api && window.api.auth && typeof window.api.auth.getConfig === 'function') {
            const cfg = await api.auth.getConfig();
            if (cfg) {
              const totalMs = cfg.sessionDurationMs || (60 * 60 * 1000);
              const warnMs = cfg.inactivityWarningMs !== undefined ? cfg.inactivityWarningMs : (5 * 60 * 1000);

              this.SESSION_DURATION_MS = totalMs;
              this.INACTIVITY_WARNING_MS = warnMs;
              this.sessionDurationMinutes = cfg.sessionDurationMinutes || Math.round(totalMs / 60000);
              this.inactivityWarningMinutes = cfg.inactivityWarningMinutes !== undefined ? cfg.inactivityWarningMinutes : Math.round(warnMs / 60000);

              this.COUNTDOWN_DURATION_SEC = Math.max(1, Math.round(warnMs / 1000));
              this.INACTIVITY_LIMIT_MS = Math.max(1000, totalMs - warnMs);

              // Update extend button tooltip if present
              const btnExtend = document.getElementById('btn-extend-session');
              if (btnExtend) {
                const durationLabel = this.sessionDurationMinutes >= 60 
                  ? `${(this.sessionDurationMinutes / 60).toFixed(this.sessionDurationMinutes % 60 === 0 ? 0 : 1)} hour${this.sessionDurationMinutes === 60 ? '' : 's'}`
                  : `${this.sessionDurationMinutes} minute${this.sessionDurationMinutes === 1 ? '' : 's'}`;
                btnExtend.title = `Extend session by ${durationLabel}`;
              }

              // If currently active and not showing warning, re-arm inactivity timer with new configured limits
              if (this.isActive && !this.isWarningActive) {
                this.checkInactivityState();
              }
            }
          }
        } catch (err) {
          console.warn('[sessionManager] Failed to load client config:', err);
        }
      })();
    }
    return this.configPromise;
  },

  bindEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    // Activity listeners to reset idle clock (throttled to avoid CPU churn)
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'pointerdown'];
    activityEvents.forEach(eventType => {
      window.addEventListener(eventType, () => this.handleUserActivity(), { passive: true });
    });

    // Cross-tab synchronization via localStorage storage event
    window.addEventListener('storage', (e) => {
      if (e.key === 'av_audit_last_active' && e.newValue) {
        const remoteTime = Number(e.newValue);
        if (remoteTime > this.lastActivityTimestamp) {
          this.lastActivityTimestamp = remoteTime;
          if (this.isActive) {
            if (this.isWarningActive) {
              this.hideWarningBanner(true);
            }
            this.resetInactivityTimer();
          }
        }
      } else if (e.key === 'av_audit_session_logout') {
        if (this.isActive) {
          this.stop();
          if (window.authView) {
            window.authView.currentUser = null;
            window.authView.showAuthPage();
          }
        }
      }
    });

    // Handle tab switching / laptop sleep wake-up
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isActive) {
        this.checkInactivityState();
      }
    });

    window.addEventListener('focus', () => {
      if (this.isActive) {
        this.checkInactivityState();
      }
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
    this.lastActivityTimestamp = Date.now();
    try {
      localStorage.setItem('av_audit_last_active', String(this.lastActivityTimestamp));
    } catch (_) {}

    this.hideWarningBanner(false);
    this.resetInactivityTimer();

    // Periodic heartbeat check (every 15 seconds) to catch tab suspension / sleep wakeups
    this.heartbeatInterval = setInterval(() => {
      if (this.isActive) {
        this.checkInactivityState();
      }
    }, 15000);

    // Ensure latest config is loaded
    this.loadConfig();
  },

  stop() {
    this.isActive = false;
    this.isWarningActive = false;
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.inactivityTimer = null;
    this.countdownInterval = null;
    this.heartbeatInterval = null;
    this.hideWarningBanner(false);
  },

  handleUserActivity() {
    if (!this.isActive) return;

    const now = Date.now();
    // Throttle user activity handling to at most once per 500ms
    if (now - this.lastActivityThrottled < 500) return;
    this.lastActivityThrottled = now;

    // If warning banner is currently visible, user activity alone does not dismiss it — they must explicitly click "I'm Still Here"
    if (!this.isWarningActive) {
      this.lastActivityTimestamp = now;
      try {
        localStorage.setItem('av_audit_last_active', String(now));
      } catch (_) {}
      this.resetInactivityTimer();
    }
  },

  checkInactivityState() {
    if (!this.isActive) return;

    // Read latest timestamp from storage if present
    try {
      const stored = localStorage.getItem('av_audit_last_active');
      if (stored) {
        const storedNum = Number(stored);
        if (storedNum > this.lastActivityTimestamp) {
          this.lastActivityTimestamp = storedNum;
        }
      }
    } catch (_) {}

    const now = Date.now();
    const elapsed = now - this.lastActivityTimestamp;

    if (elapsed >= this.SESSION_DURATION_MS) {
      // Session has completely expired
      this.handleTimeoutExpiry();
    } else if (elapsed >= this.INACTIVITY_LIMIT_MS) {
      // In warning period
      const remainingSec = Math.max(1, Math.round((this.SESSION_DURATION_MS - elapsed) / 1000));
      if (!this.isWarningActive) {
        this.showWarningBanner(remainingSec);
      }
    } else {
      // Normal active state
      if (this.isWarningActive) {
        this.hideWarningBanner(true);
      }
      this.resetInactivityTimer();
    }
  },

  resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (!this.isActive || this.isWarningActive) return;

    const elapsed = Date.now() - this.lastActivityTimestamp;
    const timeUntilWarning = Math.max(1000, this.INACTIVITY_LIMIT_MS - elapsed);

    this.inactivityTimer = setTimeout(() => {
      this.checkInactivityState();
    }, timeUntilWarning);
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
      const maxSec = this.COUNTDOWN_DURATION_SEC > 0 ? this.COUNTDOWN_DURATION_SEC : 300;
      const percentage = Math.max(0, Math.min(100, (totalSec / maxSec) * 100));
      progressBar.style.width = `${percentage}%`;
    }
  },

  async extendSession() {
    try {
      await api.auth.extendSession();
      
      const durationLabel = this.sessionDurationMinutes >= 60 
        ? `${(this.sessionDurationMinutes / 60).toFixed(this.sessionDurationMinutes % 60 === 0 ? 0 : 1)} hour${this.sessionDurationMinutes === 60 ? '' : 's'}`
        : `${this.sessionDurationMinutes} minutes`;
      helpers.showToast(`Your session has been extended for ${durationLabel}.`, 'success');

      this.lastActivityTimestamp = Date.now();
      try {
        localStorage.setItem('av_audit_last_active', String(this.lastActivityTimestamp));
      } catch (_) {}

      this.hideWarningBanner(true);
      this.resetInactivityTimer();
    } catch (err) {
      console.error('[sessionManager] Failed to extend session:', err);
      // If extension fails due to session expiry, log out gracefully
      this.handleTimeoutExpiry();
    }
  },

  async handleTimeoutExpiry(broadcast = true) {
    this.stop();
    if (broadcast) {
      try {
        localStorage.setItem('av_audit_session_logout', String(Date.now()));
      } catch (_) {}
    }
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
  triggerWarningNowForTesting(countdownSeconds = this.COUNTDOWN_DURATION_SEC) {
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
