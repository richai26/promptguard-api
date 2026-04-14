// routes/policy.js — get and update tool policy for an org
const express = require('express');
const router = express.Router();
const pool = require('../db');

async function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key required' });
  try {
    const result = await pool.query('SELECT id, name FROM organisations WHERE api_key = $1', [key]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid API key' });
    req.org = result.rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

const DEFAULT_POLICY = {
  chatgpt_free:        { low: 'allow', medium: 'warn',  high: 'block' },
  chatgpt_enterprise:  { low: 'allow', medium: 'allow', high: 'block' },
  claude_consumer:     { low: 'allow', medium: 'warn',  high: 'block' },
  claude_enterprise:   { low: 'allow', medium: 'allow', high: 'block' },
  gemini_consumer:     { low: 'warn',  medium: 'block', high: 'block' },
  perplexity:          { low: 'warn',  medium: 'block', high: 'block' },
  copilot:             { low: 'allow', medium: 'allow', high: 'block' },
};

// GET /api/policy — return current policy for this org
router.get('/', requireApiKey, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT policy FROM policies WHERE org_id = $1',
      [req.org.id]
    );
    if (result.rows.length === 0) {
      // No custom policy — return defaults
      return res.json({ policy: DEFAULT_POLICY });
    }
    res.json({ policy: result.rows[0].policy });
  } catch (err) {
    console.error('Policy fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

// POST /api/policy — save updated policy
router.post('/', requireApiKey, async (req, res) => {
  const { policy } = req.body;
  if (!policy || typeof policy !== 'object') {
    return res.status(400).json({ error: 'Invalid policy object' });
  }

  // Validate structure — each tool must have low/medium/high with valid values
  const validActions = ['allow', 'warn', 'block'];
  for (const [toolId, toolPolicy] of Object.entries(policy)) {
    for (const level of ['low', 'medium', 'high']) {
      if (!validActions.includes(toolPolicy[level])) {
        return res.status(400).json({ error: `Invalid action for ${toolId}.${level}` });
      }
    }
  }

  try {
    await pool.query(`
      INSERT INTO policies (org_id, policy, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (org_id)
      DO UPDATE SET policy = $2, updated_at = NOW()
    `, [req.org.id, JSON.stringify(policy)]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Policy save error:', err.message);
    res.status(500).json({ error: 'Failed to save policy' });
  }
});

module.exports = router;
