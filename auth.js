// auth.js — which company a request belongs to.
//
// Each company (row in organisations) has two keys:
//   api_key    the company code entered in the browser agent; it can only SEND events
//   admin_key  the dashboard access code; it can READ that company's data and change its policy
// Both arrive in the x-api-key header.
const pool = require('./db');

// Browser agent → backend (POST /api/events)
async function requireIngestKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Company code required' });
  try {
    const r = await pool.query('SELECT id, name FROM organisations WHERE api_key = $1', [key]);
    if (!r.rows.length) return res.status(401).json({ error: 'Company code not recognised' });
    req.org = r.rows[0];
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

// Dashboard → backend (reading events, stats, policy)
// A company created before dashboard access codes existed (admin_key empty) can still be read
// with its api_key, so the original demo keeps working.
async function requireAdminKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Access code required' });
  try {
    const q = pool.hasAdminKey
      ? 'SELECT id, name FROM organisations WHERE admin_key = $1 OR (admin_key IS NULL AND api_key = $1) LIMIT 1'
      : 'SELECT id, name FROM organisations WHERE api_key = $1';
    const r = await pool.query(q, [key]);
    if (!r.rows.length) return res.status(401).json({ error: 'Access code not recognised' });
    req.org = r.rows[0];
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { requireIngestKey, requireAdminKey };
