// Utility helpers for AV Audit
const helpers = {
  // Format Los Angeles Time (h:mm:ss A) e.g., "2:30:15 PM"
  formatTimeLA(date) {
    if (!date) return '--:--';
    const d = new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d);
  },

  // Format Submission Time "MMM D, h:mm A" e.g., "Aug 18, 2:30 PM"
  formatSubmissionTimeLA(date) {
    if (!date) return '';
    const d = new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  },

  // Format Date in Los Angeles timezone e.g., "Aug 18, 2026"
  formatDateLA(date) {
    if (!date) return '--';
    const d = new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(d);
  },

  // Format ISO Date YYYY-MM-DD
  formatDateISO(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Toast Notifications
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';
    if (type === 'warning') icon = '🔔';

    toast.innerHTML = `
      <span style="font-size: 1.1rem;">${icon}</span>
      <div style="flex:1; font-size:0.875rem;">${helpers.escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // Modals
  openModal(modalId) {
    const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal(modalId) {
    const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    if (modal) {
      modal.classList.remove('active');
    }
  },

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop.active, .modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  },

  initModalCloseHandlers() {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-backdrop');
        if (modal) {
          modal.classList.remove('active');
        }
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          if (backdrop.dataset.staticBackdrop === 'true' || backdrop.id === 'modal-configure-card') {
            return; // Do not close on outside backdrop click
          }
          backdrop.classList.remove('active');
        }
      });
    });
  },

  // Render SVG Circular Progress Ring
  renderCircularProgress(percent, isBlocked = false, size = 52) {
    const strokeWidth = 4;
    const radius = (size / 2) - strokeWidth - 1;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - ((percent / 100) * circumference);
    const strokeClass = isBlocked ? 'blocked' : (percent === 100 ? 'complete' : '');

    return `
      <svg class="progress-ring-svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" style="overflow: visible;">
        <circle class="progress-ring-circle-bg" cx="${size/2}" cy="${size/2}" r="${radius}" stroke-width="${strokeWidth}" />
        <circle class="progress-ring-circle ${strokeClass}" cx="${size/2}" cy="${size/2}" r="${radius}" 
                stroke-width="${strokeWidth}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
      </svg>
      <span class="progress-ring-text">${percent}%</span>
    `;
  },

  // Escape HTML strings
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // Decode nested entities
  decodeEntities(str) {
    if (str === null || str === undefined) return '';
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

  // Safely decode entities first, then escape once for safe HTML interpolation
  safeText(str) {
    return this.escapeHtml(this.decodeEntities(str));
  },

  // Calculate time-based relevance score with 1-hour halftime (exponential decay)
  calculateTemplateRelevanceScore(template, referenceDate = new Date()) {
    if (!template) return 0;
    const schedules = Array.isArray(template.schedules) ? template.schedules : [];
    if (schedules.length === 0) return 0;

    const currentDay = referenceDate.getDay(); // 0 = Sun .. 6 = Sat
    const currentHours = referenceDate.getHours();
    const currentMinutes = referenceDate.getMinutes();
    const currentSeconds = referenceDate.getSeconds();
    
    // Current time in hours from start of week (Sunday 00:00)
    const currentWeekHours = (currentDay * 24) + currentHours + (currentMinutes / 60) + (currentSeconds / 3600);
    const totalWeekHours = 7 * 24; // 168 hours

    let minDeltaHours = Infinity;

    schedules.forEach(schedule => {
      if (!schedule || !schedule.days || !Array.isArray(schedule.days) || schedule.days.length === 0 || !schedule.time) {
        return;
      }

      const timeParts = String(schedule.time).split(':');
      const targetHours = parseInt(timeParts[0], 10) || 0;
      const targetMinutes = parseInt(timeParts[1], 10) || 0;
      const targetDayTimeOffset = targetHours + (targetMinutes / 60);

      schedule.days.forEach(day => {
        const targetDay = parseInt(day, 10);
        if (isNaN(targetDay) || targetDay < 0 || targetDay > 6) return;

        const targetWeekHours = (targetDay * 24) + targetDayTimeOffset;

        // Distance with weekly cyclic wrap-around
        let diff = Math.abs(currentWeekHours - targetWeekHours);
        if (diff > (totalWeekHours / 2)) {
          diff = totalWeekHours - diff;
        }

        if (diff < minDeltaHours) {
          minDeltaHours = diff;
        }
      });
    });

    if (minDeltaHours === Infinity) {
      return 0;
    }

    // 1-hour halftime exponential decay: Score = 1000 * 2^(-delta)
    return 1000 * Math.pow(0.5, minDeltaHours);
  }
};

window.helpers = helpers;
