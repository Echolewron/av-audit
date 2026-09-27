const express = require('express');
const router = express.Router();
const remotePlayerService = require('../services/remotePlayerService');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(authMiddleware);

// GET /api/remote-players - List all registered players with status & telemetry
router.get('/', requirePermission('remote_player', 'access_nav'), (req, res) => {
  try {
    const players = remotePlayerService.getPlayers();
    res.json({ success: true, players });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_PLAYERS_FAILED', message: err.message });
  }
});

// POST /api/remote-players/pair-code - Generate a 4-digit pairing code
router.post('/pair-code', requirePermission('remote_player', 'manage_players'), (req, res) => {
  try {
    const codeData = remotePlayerService.generatePairCode(req.user.id);
    res.json({ success: true, ...codeData });
  } catch (err) {
    res.status(500).json({ error: 'GENERATE_CODE_FAILED', message: err.message });
  }
});

// GET /api/remote-players/:id - Get specific player
router.get('/:id', requirePermission('remote_player', 'access_nav'), (req, res) => {
  try {
    const player = remotePlayerService.getPlayerById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'PLAYER_NOT_FOUND', message: 'Remote player not found.' });
    }
    res.json({ success: true, player });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_PLAYER_FAILED', message: err.message });
  }
});

// PATCH /api/remote-players/:id - Update player friendly name
router.patch('/:id', requirePermission('remote_player', 'manage_players'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const updated = remotePlayerService.updatePlayer(req.params.id, req.body, req.user, ipAddress);
    res.json({ success: true, player: updated });
  } catch (err) {
    res.status(400).json({ error: 'UPDATE_PLAYER_FAILED', message: err.message });
  }
});

// DELETE /api/remote-players/:id - Unpair / remove player
router.delete('/:id', requirePermission('remote_player', 'manage_players'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    remotePlayerService.deletePlayer(req.params.id, req.user, ipAddress);
    res.json({ success: true, message: 'Player unlinked successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'DELETE_PLAYER_FAILED', message: err.message });
  }
});

// POST /api/remote-players/:id/command - Send playback command (HTTP fallback for socket)
router.post('/:id/command', requirePermission('remote_player', 'control_playback'), (req, res) => {
  try {
    const { command, params } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'COMMAND_REQUIRED', message: 'Playback command required.' });
    }
    const result = remotePlayerService.sendCommand(req.params.id, command, params);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

module.exports = router;
