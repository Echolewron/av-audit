const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const dashboardAutomationService = require('../services/dashboardAutomationService');

// Universal Info State Ingestion & Retrieval

// GET /info (or /api/info) - Get all cached info states
router.get('/', (req, res) => {
  try {
    const allState = db.infoState.getAll();
    res.json({ success: true, state: allState });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_INFO_FAILED', message: err.message });
  }
});

// GET /info/{*key} - Retrieve state for a specific key
router.get('/{*key}', (req, res) => {
  try {
    const rawKey = req.params.key;
    const key = (Array.isArray(rawKey) ? rawKey.join('/') : String(rawKey || req.path.replace(/^\//, ''))).trim();
    if (!key) {
      return res.json({ success: true, state: db.infoState.getAll() });
    }
    const data = db.infoState.get(key);
    res.json({ success: true, key, data });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_KEY_FAILED', message: err.message });
  }
});

function extractPayload(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = { value: body };
    }
  } else if (body && typeof body === 'object') {
    const keys = Object.keys(body);
    if (keys.length === 1 && body[keys[0]] === '' && (keys[0].trim().startsWith('{') || keys[0].trim().startsWith('['))) {
      try {
        body = JSON.parse(keys[0].trim());
      } catch (e) {}
    }
  }
  return (body !== undefined && body !== null && typeof body === 'object') ? body : (body !== undefined ? { value: body } : {});
}

// POST /info/{*key} - Ingest arbitrary JSON state payload
router.post('/{*key}', (req, res) => {
  try {
    const rawKey = req.params.key;
    const key = (Array.isArray(rawKey) ? rawKey.join('/') : String(rawKey || req.path.replace(/^\//, ''))).trim();
    if (!key) {
      return res.status(400).json({ error: 'KEY_REQUIRED', message: 'Info key parameter is required in path.' });
    }

    const payload = extractPayload(req);
    const updated = db.infoState.set(key, payload);
    const timestamp = new Date().toISOString();

    // Broadcast real-time state ingestion via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('state:updated', { key, data: updated, timestamp });
      io.emit('info_updated', { key, data: updated, timestamp });
    }

    // Trigger server-side dashboard onInfo automations asynchronously
    dashboardAutomationService.handleInfoIngestion(key, updated).catch(err => {
      console.error(`[Info Ingestion] Automation execution error for ${key}:`, err);
    });

    res.json({
      success: true,
      key,
      data: updated,
      timestamp
    });
  } catch (err) {
    res.status(500).json({ error: 'INGESTION_FAILED', message: err.message });
  }
});

module.exports = router;
