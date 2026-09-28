/**
 * Remote Player View Controller for AV Audit
 * Strictly Flat Minimal Design (No Glows, No Blurs)
 * Responsive: Desktop Split-View / Mobile Stacked-View
 */

function safeEscape(str) {
  if (typeof helpers !== 'undefined' && helpers && typeof helpers.escapeHtml === 'function') {
    return helpers.escapeHtml(str);
  }
  if (typeof window !== 'undefined' && window.helpers && typeof window.helpers.escapeHtml === 'function') {
    return window.helpers.escapeHtml(str);
  }
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class RemotePlayerView {
  constructor() {
    this.players = [];
    this.activePlayerId = null;
    this.activeTabId = null;
    this.searchQuery = '';
    this.isSeeking = false;
    this.isChangingVolume = false;
    this.pairModalTimer = null;
    this.audioPopoverOpen = false;
    this.initialized = false;
    this.optimisticOverrides = {};
  }

  setOptimisticOverride(prop, value, ttlMs = 1500) {
    this.optimisticOverrides[prop] = {
      value,
      expiresAt: Date.now() + ttlMs
    };
  }

  isOptimisticallyOverridden(prop, incomingValue) {
    const override = this.optimisticOverrides[prop];
    if (!override) return false;
    if (Date.now() > override.expiresAt) {
      delete this.optimisticOverrides[prop];
      return false;
    }
    // If incoming value caught up with our optimistic value, lock can be released
    if (incomingValue !== undefined && override.value !== undefined) {
      const v1 = typeof override.value === 'string' ? override.value.trim().toLowerCase() : override.value;
      const v2 = typeof incomingValue === 'string' ? incomingValue.trim().toLowerCase() : incomingValue;
      if (v1 === v2) {
        delete this.optimisticOverrides[prop];
        return false;
      }
    }
    return true;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.setupSocketListeners();
  }

  formatPlaybackMode(mode) {
    switch (mode) {
      case 'RepeatAll': return 'Repeat All';
      case 'RepeatOne': return 'Repeat 1';
      case 'NoRepeat': return 'Continuous';
      case 'StopOnFinish': return 'Stop on Finish';
      default: return mode || 'Repeat All';
    }
  }

  getPlaybackModeIcon(mode) {
    if (mode === 'RepeatOne') {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><text x="10" y="15" font-size="8" font-weight="700" fill="currentColor" stroke="none">1</text></svg>`;
    }
    if (mode === 'StopOnFinish') {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`;
    }
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
  }

  setupSocketListeners() {
    const socket = window.socket || (window.socketClient && window.socketClient.socket);
    if (!socket) {
      setTimeout(() => this.setupSocketListeners(), 250);
      return;
    }

    if (this._socketListenersAttached) return;
    this._socketListenersAttached = true;

    socket.on('remote_player:list_updated', ({ players }) => {
      this.players = players || [];
      if (!this.activePlayerId) {
        this.renderGrid();
      } else {
        this.updateConsoleHeader();
      }
    });

    socket.on('remote_player:status_changed', ({ playerId, isOnline, player }) => {
      const idx = this.players.findIndex(p => p.id === playerId);
      if (idx !== -1) {
        this.players[idx].is_online = isOnline;
        if (player) this.players[idx] = { ...this.players[idx], ...player };
      } else if (player) {
        this.players.push(player);
      }

      if (!this.activePlayerId) {
        this.renderGrid();
      } else if (this.activePlayerId === playerId) {
        this.updateConsoleHeader();
      }
    });

    socket.on('remote_player:telemetry', ({ playerId, telemetry }) => {
      const idx = this.players.findIndex(p => p.id === playerId);
      let wasOffline = false;
      if (idx !== -1) {
        wasOffline = !this.players[idx].is_online;
        const merged = { ...(this.players[idx].telemetry || {}), ...telemetry };
        this.players[idx].telemetry = merged;
        this.players[idx].is_online = true;
      }

      if (this.activePlayerId === playerId) {
        if (wasOffline) this.updateConsoleHeader();
        this.applyTelemetry(telemetry);
      } else if (!this.activePlayerId) {
        if (wasOffline) {
          this.renderGrid();
        } else {
          this.updateCardMiniTelemetry(playerId, telemetry);
        }
      }
    });

    socket.on('remote_player:paired', ({ player }) => {
      this.closePairingModal();
      if (window.helpers && window.helpers.showToast) {
        window.helpers.showToast(`Connected to ${player.name || 'NS Player'}!`, 'success');
      }
      this.loadPlayers().then(() => {
        if (!this.activePlayerId) this.renderGrid();
      });
    });
  }

  async render() {
    this.init();
    const container = document.getElementById('view-remote-player');
    if (!container) return;

    if (this.activePlayerId) {
      this.renderConsole();
    } else {
      await this.loadPlayers();
      this.renderGrid();
    }
  }

  async loadPlayers() {
    try {
      if (window.api && window.api.remotePlayers && typeof window.api.remotePlayers.getAll === 'function') {
        const res = await window.api.remotePlayers.getAll();
        this.players = res.players || [];
      } else {
        const res = await fetch('/api/remote-players', {
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('av_token') || ''}` }
        }).then(r => r.json());
        this.players = res.players || [];
      }
    } catch (err) {
      console.error('Failed to load remote players:', err);
      if (window.helpers && window.helpers.showToast) {
        window.helpers.showToast(err.message || 'Failed to load remote players', 'error');
      }
    }
  }

  /* ============================================================
     VIEW A: PLAYERS GRID
     ============================================================ */

  renderGrid() {
    const container = document.getElementById('view-remote-player');
    if (!container) return;

    const canManage = window.app && window.app.hasPermission('remote_player', 'manage_players');
    const onlineCount = this.players.filter(p => p.is_online).length;

    let cardsHtml = '';
    if (this.players.length === 0) {
      cardsHtml = `
        <div class="rp-empty-state">
          <div class="rp-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 9L19.5 6M19.5 12.5528V16.3028C19.5 17.3074 18.834 18.1903 17.8681 18.4663L16.5481 18.8434C15.3964 19.1724 14.25 18.3077 14.25 17.1099C14.25 16.305 14.7836 15.5975 15.5576 15.3764L17.8681 14.7163C18.834 14.4403 19.5 13.5574 19.5 12.5528ZM19.5 12.5528V2.25L9 5.25V15.5528M9 15.5528V19.3028C9 20.3074 8.33405 21.1903 7.36812 21.4663L6.04814 21.8434C4.89645 22.1724 3.75 21.3077 3.75 20.1099C3.75 19.305 4.2836 18.5975 5.05757 18.3764L7.36812 17.7163C8.33405 17.4403 9 16.5574 9 15.5528Z" />
            </svg>
          </div>
          <h3 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">No Remote Players Connected</h3>
          <p style="margin: 0 0 1.5rem 0; color: var(--text-muted); max-width: 420px;">
            Link your running NS Player audio instances to control playback, trigger songs, and monitor playlists in real time.
          </p>
          ${canManage ? `
            <button class="rp-btn-primary" id="btn-add-remote-player-empty">
              + Add Remote Player
            </button>
          ` : ''}
        </div>
      `;
    } else {
      cardsHtml = `
        <div class="rp-grid">
          ${this.players.map(p => this.renderPlayerCard(p, canManage)).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="remote-player-container">
        <div class="rp-header-bar">
          <div>
            <h1 class="rp-header-title">Remote Player</h1>
            <div class="rp-header-subtitle">
              ${this.players.length} registered player${this.players.length === 1 ? '' : 's'} · ${onlineCount} online
            </div>
          </div>
          <div class="rp-header-actions">
            ${canManage ? `
              <button class="rp-btn-primary" id="btn-add-remote-player">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add Remote Player
              </button>
            ` : ''}
          </div>
        </div>

        ${cardsHtml}
      </div>
    `;

    // Event listeners
    const btnAdd = container.querySelector('#btn-add-remote-player');
    const btnAddEmpty = container.querySelector('#btn-add-remote-player-empty');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openPairingModal());
    }
    if (btnAddEmpty) {
      btnAddEmpty.addEventListener('click', () => this.openPairingModal());
    }

    container.querySelectorAll('.rp-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.rp-btn-delete-card')) return;
        const playerId = card.dataset.id;
        const player = this.players.find(p => p.id === playerId);
        if (player && player.is_online) {
          this.openPlayerConsole(playerId);
        } else {
          if (window.helpers && window.helpers.showToast) {
            window.helpers.showToast('Player is currently offline. Start NS Player to reconnect.', 'warning');
          }
        }
      });
    });

    container.querySelectorAll('.rp-btn-delete-card').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const playerId = btn.dataset.id;
        const player = this.players.find(p => p.id === playerId);
        const confirmed = confirm(`Are you sure you want to unpair "${player ? player.name : 'this player'}"?`);
        if (!confirmed) return;

        try {
          await window.api.remotePlayers.delete(playerId);
          if (window.helpers && window.helpers.showToast) {
            window.helpers.showToast('Player unlinked successfully.', 'success');
          }
          await this.loadPlayers();
          this.renderGrid();
        } catch (err) {
          if (window.helpers && window.helpers.showToast) {
            window.helpers.showToast(err.message || 'Failed to unpair player', 'error');
          }
        }
      });
    });
  }

  renderPlayerCard(player, canManage) {
    const isOnline = Boolean(player.is_online);
    const telemetry = player.telemetry || {};
    const trackTitle = telemetry.currentTrack ? telemetry.currentTrack.title : (isOnline ? 'Stopped' : 'Unavailable');
    const state = telemetry.state || (isOnline ? 'IDLE' : 'OFFLINE');
    const volSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1.5px; margin-right: 2px;"><path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z"/></svg>`;

    // Only display device_name subtitle if distinct from the player display name
    const hasDistinctDevice = player.device_name && player.name &&
      player.device_name.trim().toLowerCase() !== player.name.trim().toLowerCase();

    return `
      <div class="rp-card ${isOnline ? 'online' : 'offline'}" data-id="${player.id}">
        <div>
          <div class="rp-card-header">
            <div>
              <h3 class="rp-card-name">${safeEscape(player.name || 'NS Player')}</h3>
              ${hasDistinctDevice ? `<div class="rp-card-device">${safeEscape(player.device_name)}</div>` : ''}
            </div>
            <div class="${isOnline ? 'rp-badge-online' : 'rp-badge-offline'}">
              <span class="rp-dot"></span>
              ${isOnline ? 'Online' : 'Offline'}
            </div>
          </div>

          <div class="rp-card-body">
            <div class="rp-card-track" id="card-track-${player.id}">${safeEscape(trackTitle)}</div>
            <div class="rp-card-state" id="card-state-${player.id}">
              <span style="font-weight: 600;">${safeEscape(state)}</span>
              ${telemetry.currentTime ? `<span>· ${safeEscape(telemetry.currentTime)}</span>` : ''}
              ${telemetry.volume !== undefined ? `<span>· ${volSvg}${telemetry.volume}%</span>` : ''}
            </div>
          </div>
        </div>

        <div class="rp-card-footer">
          <span>${isOnline ? 'Click to open remote controls' : `Last seen: ${player.last_seen_at ? new Date(player.last_seen_at).toLocaleTimeString() : 'Never'}`}</span>
          ${canManage ? `
            <button class="rp-btn-delete-card" data-id="${player.id}" title="Unpair player">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  updateCardMiniTelemetry(playerId, telemetry) {
    const trackEl = document.getElementById(`card-track-${playerId}`);
    const stateEl = document.getElementById(`card-state-${playerId}`);
    if (!trackEl || !stateEl) return;

    const trackTitle = telemetry.currentTrack ? telemetry.currentTrack.title : 'Stopped';
    trackEl.textContent = trackTitle;
    const volSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1.5px; margin-right: 2px;"><path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z"/></svg>`;
    stateEl.innerHTML = `
      <span style="font-weight: 600;">${safeEscape(telemetry.state || 'IDLE')}</span>
      ${telemetry.currentTime ? `<span>· ${safeEscape(telemetry.currentTime)}</span>` : ''}
      ${telemetry.volume !== undefined ? `<span>· ${volSvg}${telemetry.volume}%</span>` : ''}
    `;
  }

  /* ============================================================
     VIEW B: FULL-PAGE CONTROLLER CONSOLE (Responsive)
     ============================================================ */

  openPlayerConsole(playerId) {
    this.activePlayerId = playerId;
    this.searchQuery = '';
    this.renderConsole();
  }

  renderConsole() {
    const container = document.getElementById('view-remote-player');
    if (!container) return;

    const player = this.players.find(p => p.id === this.activePlayerId);
    if (!player) {
      this.activePlayerId = null;
      this.renderGrid();
      return;
    }

    const telemetry = player.telemetry || {};
    const tabs = telemetry.tabs || [];
    if (!this.activeTabId && tabs.length > 0) {
      this.activeTabId = telemetry.activeTabId || tabs[0].id;
    }

    container.innerHTML = `
      <div class="remote-player-container">
        <div class="rp-console">
          <!-- Top Bar -->
          <div class="rp-console-top-bar">
            <div class="rp-console-player-info">
              <button class="rp-btn-secondary" id="btn-back-to-players">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                All Players
              </button>
              <h2 class="rp-console-title" id="console-player-name">${safeEscape(player.name || 'NS Player')}</h2>
              <span class="${player.is_online ? 'rp-badge-online' : 'rp-badge-offline'}" id="console-status-pill">
                <span class="rp-dot"></span>
                ${player.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
            <div>
              <span style="font-size: 0.8rem; color: var(--text-muted);" id="console-output-device">
                ${telemetry.audioDevice ? `Audio: ${safeEscape(telemetry.audioDevice)}` : ''}
              </span>
            </div>
          </div>

          <!-- Console Body: Left Hero + Right Playlist -->
          <div class="rp-console-body">
            <!-- Left Hero Column -->
            <div class="rp-hero-panel">
              <div class="rp-now-playing-box">
                <div class="rp-track-art-placeholder">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 9L19.5 6M19.5 12.5528V16.3028C19.5 17.3074 18.834 18.1903 17.8681 18.4663L16.5481 18.8434C15.3964 19.1724 14.25 18.3077 14.25 17.1099C14.25 16.305 14.7836 15.5975 15.5576 15.3764L17.8681 14.7163C18.834 14.4403 19.5 13.5574 19.5 12.5528ZM19.5 12.5528V2.25L9 5.25V15.5528M9 15.5528V19.3028C9 20.3074 8.33405 21.1903 7.36812 21.4663L6.04814 21.8434C4.89645 22.1724 3.75 21.3077 3.75 20.1099C3.75 19.305 4.2836 18.5975 5.05757 18.3764L7.36812 17.7163C8.33405 17.4403 9 16.5574 9 15.5528Z" />
                  </svg>
                </div>
                <h3 class="rp-track-title" id="rp-hero-track-title">
                  ${safeEscape(telemetry.currentTrack ? telemetry.currentTrack.title : 'Ready / Stopped')}
                </h3>
                <span class="rp-track-state-pill ${(telemetry.state || '').toLowerCase()}" id="rp-hero-state-pill">
                  ${safeEscape(telemetry.state || 'STOPPED')}
                </span>
              </div>

              <!-- Scrubber Bar -->
              <div class="rp-scrubber-group">
                <input type="range" class="rp-scrubber-slider" id="rp-seek-slider" min="0" max="100" step="0.1" value="0">
                <div class="rp-time-row">
                  <span id="rp-time-current">${telemetry.currentTime || '00:00'}</span>
                  <span id="rp-time-total">${telemetry.totalTime || '00:00'}</span>
                </div>
              </div>

              <!-- Transport Controls -->
              <div class="rp-transport-row">
                <button class="rp-btn-transport" id="btn-transport-prev" title="Previous Track">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>
                <button class="rp-btn-transport rp-btn-playpause" id="btn-transport-playpause" title="Play / Pause">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" id="rp-playpause-icon">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
                <button class="rp-btn-transport" id="btn-transport-next" title="Next Track">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>
                <button class="rp-btn-transport" id="btn-transport-stop" title="Stop">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12"/>
                  </svg>
                </button>
              </div>

              <!-- Volume Control -->
              <div class="rp-volume-row">
                <button class="rp-btn-mute" id="btn-transport-mute" title="Toggle Mute">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" id="rp-mute-icon">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                  </svg>
                </button>
                <input type="range" class="rp-volume-slider" id="rp-volume-slider" min="0" max="100" value="${telemetry.volume !== undefined ? telemetry.volume : 80}">
                <span class="rp-volume-pct" id="rp-volume-pct">${telemetry.volume !== undefined ? telemetry.volume : 80}%</span>
              </div>

              <!-- Secondary Bar: Loop Mode, Shuffle, and Tucked-away Audio Options -->
              <div class="rp-secondary-controls">
                <button class="rp-btn-pill ${telemetry.playbackMode === 'StopOnFinish' ? 'mode-stop' : (telemetry.playbackMode && telemetry.playbackMode !== 'NoRepeat' ? 'active' : '')}" id="btn-mode-cycle" title="Playback Loop Mode">
                  <span id="rp-loop-mode-icon">${this.getPlaybackModeIcon(telemetry.playbackMode)}</span>
                  <span id="rp-loop-mode-text">${this.formatPlaybackMode(telemetry.playbackMode)}</span>
                </button>
                <button class="rp-btn-pill ${telemetry.isShuffle ? 'active' : ''}" id="btn-toggle-shuffle" title="Shuffle Playlist">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 3 21 3 21 8"></polyline>
                    <line x1="4" y1="20" x2="21" y2="3"></line>
                    <polyline points="21 16 21 21 16 21"></polyline>
                    <line x1="15" y1="15" x2="21" y2="21"></line>
                    <line x1="4" y1="4" x2="9" y2="9"></line>
                  </svg>
                  <span>Shuffle</span>
                </button>

                <!-- Tucked-away Audio Channel Settings Popover -->
                <div class="rp-audio-popover-wrapper">
                  <button class="rp-btn-pill" id="btn-audio-options-toggle" title="Audio Channel Routing">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="4" y1="21" x2="4" y2="14"></line>
                      <line x1="4" y1="10" x2="4" y2="3"></line>
                      <line x1="12" y1="21" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12" y2="3"></line>
                      <line x1="20" y1="21" x2="20" y2="16"></line>
                      <line x1="20" y1="12" x2="20" y2="3"></line>
                      <line x1="1" y1="14" x2="7" y2="14"></line>
                      <line x1="9" y1="8" x2="15" y2="8"></line>
                      <line x1="17" y1="16" x2="23" y2="16"></line>
                    </svg>
                    <span id="rp-channel-badge">${telemetry.channelMode || 'Stereo'}</span>
                  </button>
                  <div class="rp-audio-popover" id="rp-audio-popover">
                    <div class="rp-audio-popover-title">Audio Channel Mode</div>
                    <button class="rp-channel-option ${(!telemetry.channelMode || telemetry.channelMode === 'Stereo') ? 'selected' : ''}" data-mode="Stereo">
                      Stereo (Normal)
                    </button>
                    <button class="rp-channel-option ${telemetry.channelMode === 'Left' ? 'selected' : ''}" data-mode="Left">
                      Left Only (Guide Vocals)
                    </button>
                    <button class="rp-channel-option ${telemetry.channelMode === 'Right' ? 'selected' : ''}" data-mode="Right">
                      Right Only (Accompaniment)
                    </button>
                    <button class="rp-channel-option ${telemetry.channelMode === 'Mono' ? 'selected' : ''}" data-mode="Mono">
                      Mono Sum
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Playlists & Songs -->
            <div class="rp-playlist-panel">
              <!-- Tab Strip -->
              <div class="rp-tabs-header" id="rp-tabs-strip">
                ${this.renderTabsHtml(tabs)}
              </div>

              <!-- Search Bar -->
              <div class="rp-search-bar-row">
                <div class="rp-search-wrapper">
                  <svg class="rp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input type="text" class="rp-search-input" id="rp-song-search" placeholder="Search songs in playlist..." value="${safeEscape(this.searchQuery)}">
                  <button class="rp-search-clear" id="rp-song-search-clear" title="Clear search">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Song List -->
              <div class="rp-tracklist-container" id="rp-tracklist">
                ${this.renderTracklistHtml(tabs)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindConsoleEvents(container);
    this.applyTelemetry(telemetry);
  }

  renderTabsHtml(tabs) {
    if (!tabs || tabs.length === 0) {
      return '<div style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.85rem;">No playlists loaded</div>';
    }

    return tabs.map(tab => {
      const isActive = tab.id === this.activeTabId;
      return `
        <button class="rp-tab-btn ${isActive ? 'active' : ''}" data-tab-id="${tab.id}">
          ${safeEscape(tab.name || 'Playlist')}
        </button>
      `;
    }).join('');
  }

  renderTracklistHtml(tabs) {
    const activeTab = (tabs || []).find(t => t.id === this.activeTabId) || (tabs && tabs[0]);
    if (!activeTab || !activeTab.items || activeTab.items.length === 0) {
      return '<div style="padding: 3rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">This playlist has no songs.</div>';
    }

    const query = (this.searchQuery || '').trim().toLowerCase();
    const filtered = activeTab.items.filter(item => {
      if (!query) return true;
      return (item.title && item.title.toLowerCase().includes(query)) ||
             (item.filePath && item.filePath.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      return `<div style="padding: 3rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No songs match "${safeEscape(this.searchQuery)}".</div>`;
    }

    return filtered.map(item => {
      const isItemPlaying = Boolean(item.isPlaying);
      return `
        <div class="rp-track-row ${isItemPlaying ? 'playing' : ''}" data-tab-id="${activeTab.id}" data-idx="${item.index}">
          <div class="rp-track-idx">${isItemPlaying ? '▶' : item.index + 1}</div>
          <div class="rp-track-info">
            <div class="rp-track-name">${safeEscape(item.title || 'Untitled Track')}</div>
          </div>
          <div class="rp-track-len">${safeEscape(item.formattedDuration || '--:--')}</div>
        </div>
      `;
    }).join('');
  }

  bindConsoleEvents(container) {
    // Back to players list
    const btnBack = container.querySelector('#btn-back-to-players');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.activePlayerId = null;
        this.renderGrid();
      });
    }

    // Transport buttons
    const btnPlayPause = container.querySelector('#btn-transport-playpause');
    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', () => {
        const icon = container.querySelector('#rp-playpause-icon');
        const stateEl = container.querySelector('#rp-hero-state-pill');
        const player = this.players.find(p => p.id === this.activePlayerId);
        const isPlaying = (player && player.telemetry && player.telemetry.state === 'PLAYING') ||
                          (icon && icon.innerHTML.includes('M6 19h4V5H6v14zm8-14v14h4V5h-4z'));
        const nextState = isPlaying ? 'PAUSED' : 'PLAYING';

        this.setOptimisticOverride('state', nextState, 1500);

        if (nextState === 'PLAYING') {
          if (icon) icon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
          if (stateEl) { stateEl.textContent = 'PLAYING'; stateEl.className = 'rp-track-state-pill playing'; }
        } else {
          if (icon) icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
          if (stateEl) { stateEl.textContent = 'PAUSED'; stateEl.className = 'rp-track-state-pill paused'; }
        }
        if (player && player.telemetry) player.telemetry.state = nextState;
        this.sendPlaybackCommand('play_pause');
      });
    }

    const btnPrev = container.querySelector('#btn-transport-prev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => this.sendPlaybackCommand('prev'));
    }

    const btnNext = container.querySelector('#btn-transport-next');
    if (btnNext) {
      btnNext.addEventListener('click', () => this.sendPlaybackCommand('next'));
    }

    const btnStop = container.querySelector('#btn-transport-stop');
    if (btnStop) {
      btnStop.addEventListener('click', () => {
        const icon = container.querySelector('#rp-playpause-icon');
        const stateEl = container.querySelector('#rp-hero-state-pill');
        const timeCur = container.querySelector('#rp-time-current');
        const slider = container.querySelector('#rp-seek-slider');
        if (icon) icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        if (stateEl) { stateEl.textContent = 'STOPPED'; stateEl.className = 'rp-track-state-pill stopped'; }
        if (timeCur) timeCur.textContent = '00:00';
        if (slider) slider.value = '0';

        this.setOptimisticOverride('state', 'STOPPED', 1500);
        this.setOptimisticOverride('currentTime', '00:00', 1500);
        this.setOptimisticOverride('progress', 0, 1500);

        const player = this.players.find(p => p.id === this.activePlayerId);
        if (player && player.telemetry) {
          player.telemetry.state = 'STOPPED';
          player.telemetry.currentTime = '00:00';
          player.telemetry.progress = 0;
        }
        this.sendPlaybackCommand('stop');
      });
    }

    // Scrubber
    const seekSlider = container.querySelector('#rp-seek-slider');
    if (seekSlider) {
      seekSlider.addEventListener('mousedown', () => { this.isSeeking = true; });
      seekSlider.addEventListener('touchstart', () => { this.isSeeking = true; }, { passive: true });

      seekSlider.addEventListener('input', (e) => {
        const pct = parseFloat(e.target.value) / 100;
        const player = this.players.find(p => p.id === this.activePlayerId);
        if (player && player.telemetry && player.telemetry.totalSeconds) {
          const sec = pct * player.telemetry.totalSeconds;
          const timeCur = container.querySelector('#rp-time-current');
          if (timeCur) timeCur.textContent = this.formatSeconds(sec);
        }
      });

      const finishSeek = (e) => {
        if (!this.isSeeking) return;
        this.isSeeking = false;
        const pct = parseFloat(e.target.value) / 100;
        this.setOptimisticOverride('progress', pct, 1200);
        const player = this.players.find(p => p.id === this.activePlayerId);
        if (player && player.telemetry && player.telemetry.totalSeconds) {
          const sec = pct * player.telemetry.totalSeconds;
          this.sendPlaybackCommand('seek', { positionSeconds: sec });
        }
      };

      seekSlider.addEventListener('mouseup', finishSeek);
      seekSlider.addEventListener('touchend', finishSeek);
      seekSlider.addEventListener('change', finishSeek);
    }

    // Volume & Mute
    const volSlider = container.querySelector('#rp-volume-slider');
    if (volSlider) {
      volSlider.addEventListener('mousedown', () => { this.isChangingVolume = true; });
      volSlider.addEventListener('touchstart', () => { this.isChangingVolume = true; }, { passive: true });
      volSlider.addEventListener('input', (e) => {
        this.isChangingVolume = true;
        const val = parseInt(e.target.value, 10);
        const pctEl = container.querySelector('#rp-volume-pct');
        if (pctEl) pctEl.textContent = `${val}%`;
      });

      const finishVolume = (e) => {
        const val = parseInt(volSlider.value, 10);
        const player = this.players.find(p => p.id === this.activePlayerId);
        if (player && player.telemetry) player.telemetry.volume = val;
        this.setOptimisticOverride('volume', val, 1200);
        this.sendPlaybackCommand('set_volume', { volume: val });
        this.isChangingVolume = false;
        volSlider.blur();
      };

      volSlider.addEventListener('change', finishVolume);
      volSlider.addEventListener('mouseup', finishVolume);
      volSlider.addEventListener('touchend', finishVolume);
    }

    const btnMute = container.querySelector('#btn-transport-mute');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const player = this.players.find(p => p.id === this.activePlayerId);
        const curMuted = Boolean(player && player.telemetry && player.telemetry.isMuted);
        if (player && player.telemetry) player.telemetry.isMuted = !curMuted;
        this.setOptimisticOverride('isMuted', !curMuted, 1500);
        this.sendPlaybackCommand('toggle_mute');
      });
    }

    // Mode cycle & Shuffle
    const btnMode = container.querySelector('#btn-mode-cycle');
    if (btnMode) {
      btnMode.addEventListener('click', () => {
        const modes = ['RepeatAll', 'RepeatOne', 'NoRepeat', 'StopOnFinish'];
        const player = this.players.find(p => p.id === this.activePlayerId);
        const curMode = (player && player.telemetry && player.telemetry.playbackMode) || 'RepeatAll';
        const nextIdx = (modes.indexOf(curMode) + 1) % modes.length;
        const nextMode = modes[nextIdx];

        this.setOptimisticOverride('playbackMode', nextMode, 1500);
        if (player && player.telemetry) player.telemetry.playbackMode = nextMode;

        // Optimistic UI update
        const loopText = container.querySelector('#rp-loop-mode-text');
        const loopIcon = container.querySelector('#rp-loop-mode-icon');
        if (loopText) loopText.textContent = this.formatPlaybackMode(nextMode);
        if (loopIcon) loopIcon.innerHTML = this.getPlaybackModeIcon(nextMode);
        btnMode.classList.toggle('mode-stop', nextMode === 'StopOnFinish');
        btnMode.classList.toggle('active', nextMode !== 'NoRepeat' && nextMode !== 'StopOnFinish');

        this.sendPlaybackCommand('set_playback_mode', { mode: nextMode });
      });
    }

    const btnShuffle = container.querySelector('#btn-toggle-shuffle');
    if (btnShuffle) {
      btnShuffle.addEventListener('click', () => {
        const player = this.players.find(p => p.id === this.activePlayerId);
        const nextShuffle = player && player.telemetry ? !player.telemetry.isShuffle : !btnShuffle.classList.contains('active');
        this.setOptimisticOverride('isShuffle', nextShuffle, 1500);
        if (player && player.telemetry) player.telemetry.isShuffle = nextShuffle;
        btnShuffle.classList.toggle('active', nextShuffle);
        this.sendPlaybackCommand('toggle_shuffle');
      });
    }

    // Tucked-away Audio Options Popover
    const btnAudioOpt = container.querySelector('#btn-audio-options-toggle');
    const popover = container.querySelector('#rp-audio-popover');
    if (btnAudioOpt && popover) {
      btnAudioOpt.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audioPopoverOpen = !this.audioPopoverOpen;
        popover.classList.toggle('open', this.audioPopoverOpen);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.rp-audio-popover-wrapper') && this.audioPopoverOpen) {
          this.audioPopoverOpen = false;
          popover.classList.remove('open');
        }
      });

      popover.querySelectorAll('.rp-channel-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const mode = opt.dataset.mode;
          const chanBadge = container.querySelector('#rp-channel-badge');
          if (chanBadge) chanBadge.textContent = mode;
          popover.querySelectorAll('.rp-channel-option').forEach(o => o.classList.toggle('selected', o.dataset.mode === mode));
          const player = this.players.find(p => p.id === this.activePlayerId);
          if (player && player.telemetry) player.telemetry.channelMode = mode;
          this.sendPlaybackCommand('set_channel_mode', { mode });
          this.audioPopoverOpen = false;
          popover.classList.remove('open');
        });
      });
    }

    // Tab buttons
    container.querySelectorAll('.rp-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tabId;
        this.activeTabId = tabId;
        this.sendPlaybackCommand('select_tab', { tabId });

        container.querySelectorAll('.rp-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const player = this.players.find(p => p.id === this.activePlayerId);
        const tracklist = container.querySelector('#rp-tracklist');
        if (tracklist && player && player.telemetry) {
          tracklist.innerHTML = this.renderTracklistHtml(player.telemetry.tabs);
          this.bindTracklistEvents(container);
        }
      });
    });

    // Song Search Input
    const searchInput = container.querySelector('#rp-song-search');
    const searchClear = container.querySelector('#rp-song-search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        if (searchClear) searchClear.style.display = this.searchQuery ? 'block' : 'none';

        const player = this.players.find(p => p.id === this.activePlayerId);
        const tracklist = container.querySelector('#rp-tracklist');
        if (tracklist && player && player.telemetry) {
          tracklist.innerHTML = this.renderTracklistHtml(player.telemetry.tabs);
          this.bindTracklistEvents(container);
        }
      });

      if (searchClear) {
        searchClear.addEventListener('click', () => {
          searchInput.value = '';
          this.searchQuery = '';
          searchClear.style.display = 'none';
          searchInput.focus();

          const player = this.players.find(p => p.id === this.activePlayerId);
          const tracklist = container.querySelector('#rp-tracklist');
          if (tracklist && player && player.telemetry) {
            tracklist.innerHTML = this.renderTracklistHtml(player.telemetry.tabs);
            this.bindTracklistEvents(container);
          }
        });
      }
    }

    this.bindTracklistEvents(container);
  }

  bindTracklistEvents(container) {
    container.querySelectorAll('.rp-track-row').forEach(row => {
      row.addEventListener('click', () => {
        const tabId = row.dataset.tabId;
        const trackIndex = parseInt(row.dataset.idx, 10);
        const rowTitle = row.querySelector('.rp-track-name');
        const titleText = rowTitle ? rowTitle.textContent.trim() : '';

        // Optimistic overrides to prevent flicker from pending stale telemetry
        if (titleText) {
          this.setOptimisticOverride('trackTitle', titleText, 2000);
        }
        this.setOptimisticOverride('state', 'PLAYING', 2000);

        // Optimistic track row highlight
        container.querySelectorAll('.rp-track-row').forEach(r => {
          r.classList.remove('playing');
          const idxEl = r.querySelector('.rp-track-idx');
          const origIdx = parseInt(r.dataset.idx, 10);
          if (idxEl && !isNaN(origIdx)) idxEl.textContent = origIdx + 1;
        });
        row.classList.add('playing');
        const rowIdxEl = row.querySelector('.rp-track-idx');
        if (rowIdxEl) rowIdxEl.textContent = '▶';

        const heroTitle = container.querySelector('#rp-hero-track-title');
        if (heroTitle && titleText) heroTitle.textContent = titleText;

        const stateEl = container.querySelector('#rp-hero-state-pill');
        if (stateEl) {
          stateEl.textContent = 'PLAYING';
          stateEl.className = 'rp-track-state-pill playing';
        }

        const playPauseIcon = container.querySelector('#rp-playpause-icon');
        if (playPauseIcon) {
          playPauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        }

        const player = this.players.find(p => p.id === this.activePlayerId);
        if (player && player.telemetry) {
          player.telemetry.state = 'PLAYING';
          if (!player.telemetry.currentTrack) player.telemetry.currentTrack = {};
          player.telemetry.currentTrack.title = titleText;
        }

        this.sendPlaybackCommand('select_track', { tabId, trackIndex });
      });
    });
  }

  applyTelemetry(telemetry) {
    if (!telemetry || !this.activePlayerId) return;
    const container = document.getElementById('view-remote-player');
    if (!container) return;

    // Keep internal player telemetry up-to-date
    const player = this.players.find(p => p.id === this.activePlayerId);
    if (player) {
      player.telemetry = { ...(player.telemetry || {}), ...telemetry };
    }

    // Track Title (Optimistic lock check)
    const incomingTitle = telemetry.currentTrack ? telemetry.currentTrack.title : '';
    if (!this.isOptimisticallyOverridden('trackTitle', incomingTitle)) {
      const titleEl = container.querySelector('#rp-hero-track-title');
      if (titleEl && telemetry.currentTrack) {
        titleEl.textContent = telemetry.currentTrack.title || 'Ready / Stopped';
      } else if (titleEl && telemetry.state === 'STOPPED') {
        titleEl.textContent = 'Ready / Stopped';
      }
    }

    // State Pill & Play/Pause icon (Optimistic lock check)
    if (!this.isOptimisticallyOverridden('state', telemetry.state)) {
      const stateEl = container.querySelector('#rp-hero-state-pill');
      if (stateEl && telemetry.state) {
        const state = telemetry.state;
        stateEl.textContent = state;
        stateEl.className = `rp-track-state-pill ${state.toLowerCase()}`;
      }

      const playPauseIcon = container.querySelector('#rp-playpause-icon');
      if (playPauseIcon && telemetry.state) {
        if (telemetry.state === 'PLAYING') {
          playPauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        } else {
          playPauseIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        }
      }
    }

    // Times & Scrubber (Optimistic lock check)
    if (!this.isSeeking && !this.isOptimisticallyOverridden('progress', telemetry.progress)) {
      const timeCur = container.querySelector('#rp-time-current');
      const timeTot = container.querySelector('#rp-time-total');
      const slider = container.querySelector('#rp-seek-slider');

      if (timeCur && telemetry.currentTime) timeCur.textContent = telemetry.currentTime;
      if (timeTot && telemetry.totalTime) timeTot.textContent = telemetry.totalTime;

      if (slider && telemetry.progress !== undefined) {
        slider.value = (telemetry.progress * 100).toFixed(1);
      }
    }

    // Volume (No document.activeElement check; use !isChangingVolume and !isOptimisticallyOverridden)
    const volSlider = container.querySelector('#rp-volume-slider');
    const volPct = container.querySelector('#rp-volume-pct');
    if (volSlider && telemetry.volume !== undefined && !this.isChangingVolume && !this.isOptimisticallyOverridden('volume', telemetry.volume)) {
      volSlider.value = telemetry.volume;
      if (volPct) volPct.textContent = `${telemetry.volume}%`;
    }

    // Mute icon (Optimistic lock check)
    if (!this.isOptimisticallyOverridden('isMuted', Boolean(telemetry.isMuted))) {
      const muteIcon = container.querySelector('#rp-mute-icon');
      if (muteIcon && telemetry.isMuted !== undefined) {
        if (telemetry.isMuted) {
          muteIcon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
        } else {
          muteIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
        }
      }
    }

    // Loop mode & Shuffle (Optimistic lock check)
    if (!this.isOptimisticallyOverridden('playbackMode', telemetry.playbackMode)) {
      const loopText = container.querySelector('#rp-loop-mode-text');
      const loopIcon = container.querySelector('#rp-loop-mode-icon');
      const btnMode = container.querySelector('#btn-mode-cycle');
      if (telemetry.playbackMode) {
        if (loopText) loopText.textContent = this.formatPlaybackMode(telemetry.playbackMode);
        if (loopIcon) loopIcon.innerHTML = this.getPlaybackModeIcon(telemetry.playbackMode);
        if (btnMode) {
          btnMode.classList.toggle('mode-stop', telemetry.playbackMode === 'StopOnFinish');
          btnMode.classList.toggle('active', telemetry.playbackMode !== 'NoRepeat' && telemetry.playbackMode !== 'StopOnFinish');
        }
      }
    }

    if (!this.isOptimisticallyOverridden('isShuffle', Boolean(telemetry.isShuffle))) {
      const btnShuffle = container.querySelector('#btn-toggle-shuffle');
      if (btnShuffle && telemetry.isShuffle !== undefined) {
        btnShuffle.classList.toggle('active', Boolean(telemetry.isShuffle));
      }
    }

    // Audio channel mode (Optimistic lock check)
    if (!this.isOptimisticallyOverridden('channelMode', telemetry.channelMode)) {
      const chanBadge = container.querySelector('#rp-channel-badge');
      if (chanBadge && telemetry.channelMode) {
        chanBadge.textContent = telemetry.channelMode;
      }
    }

    // Synchronize track list playing row highlight
    const effectiveTitle = (this.optimisticOverrides['trackTitle'] && Date.now() <= this.optimisticOverrides['trackTitle'].expiresAt)
      ? this.optimisticOverrides['trackTitle'].value
      : (telemetry.currentTrack ? (telemetry.currentTrack.title || '') : '');

    const effectiveState = (this.optimisticOverrides['state'] && Date.now() <= this.optimisticOverrides['state'].expiresAt)
      ? this.optimisticOverrides['state'].value
      : telemetry.state;

    const tracklist = container.querySelector('#rp-tracklist');
    if (tracklist) {
      const playingTitle = effectiveTitle.trim().toLowerCase();
      tracklist.querySelectorAll('.rp-track-row').forEach(row => {
        const rowTitleEl = row.querySelector('.rp-track-name');
        const rowTitle = rowTitleEl ? rowTitleEl.textContent.trim().toLowerCase() : '';
        const idxEl = row.querySelector('.rp-track-idx');
        const origIdx = parseInt(row.dataset.idx, 10);

        if (playingTitle && rowTitle === playingTitle && effectiveState !== 'STOPPED') {
          row.classList.add('playing');
          if (idxEl) idxEl.textContent = '▶';
        } else {
          row.classList.remove('playing');
          if (idxEl && !isNaN(origIdx)) idxEl.textContent = origIdx + 1;
        }
      });
    }

    // Synchronize tabs if needed
    if (telemetry.tabs && telemetry.tabs.length > 0) {
      const tabsStrip = container.querySelector('#rp-tabs-strip');
      if (tabsStrip && (!tabsStrip.children.length || tabsStrip.children.length !== telemetry.tabs.length)) {
        tabsStrip.innerHTML = this.renderTabsHtml(telemetry.tabs);
        tabsStrip.querySelectorAll('.rp-tab-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const tabId = btn.dataset.tabId;
            this.activeTabId = tabId;
            this.sendPlaybackCommand('select_tab', { tabId });
            tabsStrip.querySelectorAll('.rp-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (tracklist && player && player.telemetry) {
              tracklist.innerHTML = this.renderTracklistHtml(player.telemetry.tabs);
              this.bindTracklistEvents(container);
            }
          });
        });
      }
    }
  }

  updateConsoleHeader() {
    const container = document.getElementById('view-remote-player');
    if (!container || !this.activePlayerId) return;

    const player = this.players.find(p => p.id === this.activePlayerId);
    if (!player) return;

    const nameEl = container.querySelector('#console-player-name');
    if (nameEl) nameEl.textContent = player.name || 'NS Player';

    const pill = container.querySelector('#console-status-pill');
    if (pill) {
      pill.className = player.is_online ? 'rp-badge-online' : 'rp-badge-offline';
      pill.innerHTML = `<span class="rp-dot"></span> ${player.is_online ? 'Online' : 'Offline'}`;
    }
  }

  sendPlaybackCommand(command, params = {}) {
    if (!this.activePlayerId) return;

    const socket = window.socket || (window.socketClient && window.socketClient.socket);
    // Use live Socket.IO connection if available
    if (socket && socket.connected) {
      socket.emit('remote_player:command', {
        playerId: this.activePlayerId,
        command,
        params
      }, (res) => {
        if (res && res.error) {
          if (window.helpers && window.helpers.showToast) {
            window.helpers.showToast(res.message || res.error, 'error');
          }
        }
      });
    } else {
      // Fallback to REST API
      if (window.api && window.api.remotePlayers && typeof window.api.remotePlayers.sendCommand === 'function') {
        window.api.remotePlayers.sendCommand(this.activePlayerId, command, params).catch(err => {
          if (window.helpers && window.helpers.showToast) {
            window.helpers.showToast(err.message || 'Command failed', 'error');
          }
        });
      } else {
        fetch(`/api/remote-players/${encodeURIComponent(this.activePlayerId)}/command`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('av_token') || ''}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ command, params })
        }).catch(err => console.error('Command failed:', err));
      }
    }
  }

  formatSeconds(totalSec) {
    if (isNaN(totalSec) || totalSec < 0) return '00:00';
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /* ============================================================
     PAIRING MODAL (4-Digit Code Flow)
     ============================================================ */

  async openPairingModal() {
    this.closePairingModal();

    let codeData;
    try {
      if (window.api && window.api.remotePlayers && typeof window.api.remotePlayers.generatePairCode === 'function') {
        codeData = await window.api.remotePlayers.generatePairCode();
      } else {
        codeData = await fetch('/api/remote-players/pair-code', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('av_token') || ''}`,
            'Content-Type': 'application/json'
          }
        }).then(r => r.json());
      }
    } catch (err) {
      if (window.helpers && window.helpers.showToast) {
        window.helpers.showToast(err.message || 'Failed to generate pairing code', 'error');
      }
      return;
    }

    const host = window.location.origin;
    const modalEl = document.createElement('div');
    modalEl.id = 'rp-pairing-modal-overlay';
    modalEl.className = 'rp-modal-overlay';

    modalEl.innerHTML = `
      <div class="rp-modal-card">
        <h2 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
          Pair New Remote Player
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">
          Open NS Player on your playback PC, click <strong>Remote Link</strong> in the title bar, and enter this code:
        </p>

        <div class="rp-code-display" id="rp-modal-code">${codeData.code}</div>

        <div class="rp-timer-pill" id="rp-modal-timer">Code expires in 5:00</div>

        <div style="font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-surface); padding: 0.75rem 1rem; border: 1px solid var(--border-muted); border-radius: 6px; width: 100%; box-sizing: border-box; text-align: left; margin-bottom: 1.5rem;">
          <div><strong>Server Address:</strong></div>
          <code style="color: var(--accent-primary); font-size: 0.85rem; user-select: all;">${host}</code>
        </div>

        <button class="rp-btn-secondary" id="btn-cancel-pairing" style="width: 100%;">
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(modalEl);

    modalEl.querySelector('#btn-cancel-pairing').addEventListener('click', () => {
      this.closePairingModal();
    });

    // Countdown timer
    let remaining = codeData.expiresInSeconds || 300;
    this.pairModalTimer = setInterval(() => {
      remaining--;
      const timerEl = document.getElementById('rp-modal-timer');
      if (!timerEl || remaining <= 0) {
        this.closePairingModal();
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      timerEl.textContent = `Code expires in ${m}:${String(s).padStart(2, '0')}`;
    }, 1000);
  }

  closePairingModal() {
    if (this.pairModalTimer) {
      clearInterval(this.pairModalTimer);
      this.pairModalTimer = null;
    }
    const modalEl = document.getElementById('rp-pairing-modal-overlay');
    if (modalEl) modalEl.remove();
  }
}

window.remotePlayerView = new RemotePlayerView();
