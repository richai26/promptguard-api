// routes/events.js — receive events from extension, return recent log
const express = require('express');
const router = express.Router();
const pool = require('../db');

// ── Middleware: validate API key ───────────────────────────────────────────
async function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key required' });

  try {
    const result = await pool.query(
      'SELECT id, name FROM organisations WHERE api_key = $1',
      [key]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.org = result.rows[0]; // attach org to request
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/events — log a single event from the extension ──────────────
router.post('/', requireApiKey, async (req, res) => {
  const { user_id, tool, tool_id, risk_level, risk_category, action, url, timestamp } = req.body;

  // Basic validation
  if (!tool || !risk_level || !action) {
    return res.status(400).json({ error: 'Missing required fields: tool, risk_level, action' });
  }

  const validLevels   = ['LOW', 'MEDIUM', 'HIGH'];
  const validActions  = ['allow', 'warn', 'block', 'proceeded_after_warn'];

  if (!validLevels.includes(risk_level)) {
    return res.status(400).json({ error: 'Invalid risk_level' });
  }
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (org_id, user_id, tool, tool_id, risk_level, risk_category, action, url, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        req.org.id,
        user_id || 'unknown',
        tool,
        tool_id || null,
        risk_level,
        risk_category || null,
        action,
        url || null,
        timestamp ? new Date(timestamp) : new Date(),
      ]
    );

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Event insert error:', err.message);
    res.status(500).json({ error: 'Failed to save event' });
  }
});

// ── GET /api/events — return recent events for dashboard ──────────────────
router.get('/', requireApiKey, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
  const offset = Math.max(parseInt(req.query.offset) || 0,  0);
  const level  = req.query.level;   // optional filter: LOW / MEDIUM / HIGH
  const action = req.query.action;  // optional filter: allow / warn / block

  try {
    let query = `
      SELECT id, user_id, tool, risk_level, risk_category, action, url, timestamp
      FROM events
      WHERE org_id = $1
    `;
    const params = [req.org.id];
    let idx = 2;

    if (level) {
      query += ` AND risk_level = $${idx++}`;
      params.push(level.toUpperCase());
    }
    if (action) {
      query += ` AND action = $${idx++}`;
      params.push(action.toLowerCase());
    }

    query += ` ORDER BY timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ events: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Events fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

module.exports = router;
