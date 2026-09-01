// Socket.io Real-Time Client for AV Audit
const socketClient = {
  socket: null,
  currentChecklistId: null,

  init() {
    if (typeof io === 'undefined') {
      console.warn('Socket.io library not loaded');
      return;
    }

    this.socket = io({
      withCredentials: true,
      autoConnect: true
    });

    const dot = document.getElementById('socket-dot');
    const label = document.getElementById('socket-label');

    this.socket.on('connect', () => {
      if (dot) dot.classList.remove('disconnected');
      if (label) label.textContent = 'Live Sync';

      // Re-join active room if any
      if (this.currentChecklistId) {
        this.joinChecklist(this.currentChecklistId);
      }
    });

    this.socket.on('disconnect', () => {
      if (dot) dot.classList.add('disconnected');
      if (label) label.textContent = 'Offline';
    });

    this.socket.on('connect_error', (err) => {
      console.log('Socket connect error:', err.message);
      if (dot) dot.classList.add('disconnected');
      if (label) label.textContent = 'Offline';
    });

    // Real-time Event Listeners
    this.socket.on('checklist_created', (checklist) => {
      window.dispatchEvent(new CustomEvent('socket_checklist_created', { detail: checklist }));
    });

    this.socket.on('checklist_card_updated', (cardData) => {
      window.dispatchEvent(new CustomEvent('socket_checklist_card_updated', { detail: cardData }));
    });

    this.socket.on('checklist_updated', (checklist) => {
      window.dispatchEvent(new CustomEvent('socket_checklist_updated', { detail: checklist }));
    });

    this.socket.on('checklist_submitted', (checklist) => {
      window.dispatchEvent(new CustomEvent('socket_checklist_submitted', { detail: checklist }));
    });

    this.socket.on('checklist_unsubmitted', (checklist) => {
      window.dispatchEvent(new CustomEvent('socket_checklist_unsubmitted', { detail: checklist }));
    });

    this.socket.on('checklist_deleted', (data) => {
      window.dispatchEvent(new CustomEvent('socket_checklist_deleted', { detail: data }));
    });

    this.socket.on('checklist_viewers', (data) => {
      window.dispatchEvent(new CustomEvent('socket_checklist_viewers', { detail: data }));
    });

    this.socket.on('permissions_updated', (data) => {
      window.dispatchEvent(new CustomEvent('socket_permissions_updated', { detail: data }));
    });

    this.socket.on('dashboards_updated', (data) => {
      window.dispatchEvent(new CustomEvent('socket_dashboards_updated', { detail: data }));
    });

    this.socket.on('dashboard_canvas_updated', (data) => {
      window.dispatchEvent(new CustomEvent('socket_dashboard_canvas_updated', { detail: data }));
    });

    this.socket.on('widget_updated', (data) => {
      window.dispatchEvent(new CustomEvent('socket_widget_updated', { detail: data }));
    });

    this.socket.on('state:updated', (data) => {
      window.dispatchEvent(new CustomEvent('socket_state_updated', { detail: data }));
    });

    this.socket.on('info_updated', (data) => {
      window.dispatchEvent(new CustomEvent('socket_info_updated', { detail: data }));
    });

    this.socket.on('accounts:pending_updated', (data) => {
      window.dispatchEvent(new CustomEvent('socket_accounts_pending_updated', { detail: data }));
      if (window.accountsView && typeof window.accountsView.loadPending === 'function') {
        window.accountsView.loadPending();
      }
    });

    this.socket.on('accounts_updated', (data) => {
      window.dispatchEvent(new CustomEvent('socket_accounts_updated', { detail: data }));
      if (window.accountsView && typeof window.accountsView.loadAccounts === 'function') {
        window.accountsView.loadAccounts();
      }
    });

    this.socket.on('system:updating', (data) => {
      window.dispatchEvent(new CustomEvent('socket_system_updating', { detail: data }));
    });
  },

  joinChecklist(checklistId) {
    if (!this.socket) return;
    this.currentChecklistId = checklistId;
    this.socket.emit('join_checklist', { checklistId });
  },

  leaveChecklist(checklistId) {
    if (!this.socket) return;
    this.socket.emit('leave_checklist', { checklistId });
    if (this.currentChecklistId === checklistId) {
      this.currentChecklistId = null;
    }
  }
};

window.socketClient = socketClient;
window.ws = socketClient;