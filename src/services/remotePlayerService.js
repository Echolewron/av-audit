const { db } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class RemotePlayerService {
  constructor() {
    this.activePairCodes = new Map(); // code -> { code, expiresAt, createdBy, createdAt }
    this.connectedSockets = new Map(); // playerId -> socket
    this.latestTelemetry = new Map(); // playerId -> telemetry payload
    this.io = null;

    // Auto-clean expired pair codes every 30 seconds
    setInterval(() => {
      const now = Date.now();
      for (const [code, entry] of this.activePairCodes.entries()) {
        if (entry.expiresAt < now) {
          this.activePairCodes.delete(code);
        }
      }
    }, 30000);
  }

  setIo(io) {
    this.io = io;
  }

  generatePairCode(userId = null) {
    // Generate clean 4-digit numeric code
    let code = '';
    for (let attempts = 0; attempts < 20; attempts++) {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      if (!this.activePairCodes.has(code)) break;
    }

    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
    const entry = {
      code,
      expiresAt,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };
    this.activePairCodes.set(code, entry);

    return {
      code,
      expiresAt,
      expiresInSeconds: 300
    };
  }

  verifyAndConsumePairCode(code) {
    if (!code) return false;
    const clean = String(code).trim();
    const entry = this.activePairCodes.get(clean);
    if (!entry) return false;

    if (entry.expiresAt < Date.now()) {
      this.activePairCodes.delete(clean);
      return false;
    }

    this.activePairCodes.delete(clean);
    return true;
  }

  getPlayers() {
    const list = db.remotePlayers.findAll();
    return list.map(player => {
      const isOnline = this.connectedSockets.has(player.id);
      const telemetry = this.latestTelemetry.get(player.id) || null;
      return {
        id: player.id,
        name: player.name,
        device_name: player.device_name,
        created_at: player.created_at,
        updated_at: player.updated_at,
        last_seen_at: player.last_seen_at,
        is_online: isOnline,
        telemetry
      };
    });
  }

  getPlayerById(id) {
    const player = db.remotePlayers.findById(id);
    if (!player) return null;
    const isOnline = this.connectedSockets.has(player.id);
    const telemetry = this.latestTelemetry.get(player.id) || null;
    return {
      ...player,
      is_online: isOnline,
      telemetry
    };
  }

  updatePlayer(id, updates = {}, actingUser = null, ipAddress = '') {
    const existing = db.remotePlayers.findById(id);
    if (!existing) throw new Error('Remote player not found');

    const updated = db.remotePlayers.update(id, {
      name: updates.name ? updates.name.trim() : existing.name
    });

    if (actingUser) {
      db.audit.log({
        userId: actingUser.id,
        username: actingUser.username,
        actionType: 'SETTINGS',
        actionName: 'REMOTE_PLAYER_UPDATED',
        details: { playerId: id, changes: updates },
        ipAddress
      });
    }

    if (this.io) {
      this.io.emit('remote_player:list_updated', { players: this.getPlayers() });
    }

    return updated;
  }

  deletePlayer(id, actingUser = null, ipAddress = '') {
    const existing = db.remotePlayers.findById(id);
    if (!existing) throw new Error('Remote player not found');

    const socket = this.connectedSockets.get(id);
    if (socket) {
      socket.emit('player:unpaired', { message: 'Player was unlinked by administrator.' });
      socket.disconnect(true);
      this.connectedSockets.delete(id);
      this.latestTelemetry.delete(id);
    }

    db.remotePlayers.delete(id);

    if (actingUser) {
      db.audit.log({
        userId: actingUser.id,
        username: actingUser.username,
        actionType: 'SETTINGS',
        actionName: 'REMOTE_PLAYER_DELETED',
        details: { playerId: id, name: existing.name },
        ipAddress
      });
    }

    if (this.io) {
      this.io.emit('remote_player:list_updated', { players: this.getPlayers() });
    }

    return { success: true };
  }

  handlePlayerRegister(socket, payload = {}) {
    const { playerId, deviceName, name, pairingCode, token } = payload;
    if (!playerId) {
      return { success: false, error: 'PLAYER_ID_REQUIRED' };
    }

    let player = db.remotePlayers.findById(playerId);

    if (pairingCode) {
      // Pairing flow with 4-digit code
      const valid = this.verifyAndConsumePairCode(pairingCode);
      if (!valid) {
        return { success: false, error: 'INVALID_OR_EXPIRED_CODE' };
      }

      const newToken = uuidv4();
      player = db.remotePlayers.create({
        id: playerId,
        name: name || deviceName || 'NS Player',
        device_name: deviceName || 'Windows PC',
        token: newToken
      });

      socket.playerId = playerId;
      this.connectedSockets.set(playerId, socket);

      db.remotePlayers.update(playerId, { last_seen_at: new Date().toISOString() });

      if (this.io) {
        this.io.emit('remote_player:paired', { player: this.getPlayerById(playerId) });
        this.io.emit('remote_player:status_changed', { playerId, isOnline: true, player: this.getPlayerById(playerId) });
        this.io.emit('remote_player:list_updated', { players: this.getPlayers() });
      }

      return {
        success: true,
        paired: true,
        token: newToken,
        playerId,
        name: player.name
      };
    }

    // Existing player connection with token
    if (token) {
      if (!player || player.token !== token) {
        return { success: false, error: 'INVALID_CREDENTIALS' };
      }

      socket.playerId = playerId;
      this.connectedSockets.set(playerId, socket);

      db.remotePlayers.update(playerId, { last_seen_at: new Date().toISOString() });

      if (this.io) {
        this.io.emit('remote_player:status_changed', { playerId, isOnline: true, player: this.getPlayerById(playerId) });
        this.io.emit('remote_player:list_updated', { players: this.getPlayers() });
      }

      return {
        success: true,
        paired: false,
        playerId,
        name: player.name
      };
    }

    return { success: false, error: 'AUTH_REQUIRED' };
  }

  handlePlayerTelemetry(playerId, telemetry) {
    if (!playerId) return;
    this.latestTelemetry.set(playerId, telemetry);

    if (this.io) {
      this.io.emit('remote_player:telemetry', {
        playerId,
        telemetry,
        timestamp: Date.now()
      });
    }
  }

  handlePlayerDisconnect(socket) {
    const playerId = socket.playerId;
    if (playerId && this.connectedSockets.get(playerId) === socket) {
      this.connectedSockets.delete(playerId);
      db.remotePlayers.update(playerId, { last_seen_at: new Date().toISOString() });

      if (this.io) {
        this.io.emit('remote_player:status_changed', {
          playerId,
          isOnline: false,
          last_seen_at: new Date().toISOString()
        });
        this.io.emit('remote_player:list_updated', { players: this.getPlayers() });
      }
    }
  }

  sendCommand(playerId, command, params = {}) {
    const socket = this.connectedSockets.get(playerId);
    if (!socket) {
      throw new Error('Player is offline or not connected');
    }

    socket.emit('player:execute', { command, params });
    return { success: true, command, params };
  }
}

module.exports = new RemotePlayerService();
