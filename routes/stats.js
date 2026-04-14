// routes/stats.js — aggregated stats for the admin dashboard
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

// GET /api/stats — returns all summary numbers for the dashboard
router.get('/', requireApiKey, async (req, res) => {
  const days = parseInt(req.query.days) || 30;

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Total interactions, warnings, blocks
    const totals = await pool.query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE action = 'warn')          AS warned,
        COUNT(*) FILTER (WHERE action = 'block')         AS blocked,
        COUNT(*) FILTER (WHERE action = 'allow')         AS allowed,
        COUNT(*) FILTER (WHERE action = 'proceeded_after_warn') AS proceeded,
        COUNT(DISTINCT user_id)                          AS active_users
      FROM events
      WHERE org_id = $1 AND timestamp >= $2
    `, [req.org.id, since]);

    // Daily breakdown for chart (last 7 days)
    const daily = await pool.query(`
      SELECT
        DATE(timestamp)                                        AS date,
        COUNT(*)                                               AS total,
        COUNT(*) FILTER (WHERE action = 'allow')              AS allowed,
        COUNT(*) FILTER (WHERE action = 'warn')               AS warned,
        COUNT(*) FILTER (WHERE action = 'block')              AS blocked
      FROM events
      WHERE org_id = $1 AND timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `, [req.org.id]);

    // Risk categories breakdown
    const categories = await pool.query(`
      SELECT
        risk_category,
        COUNT(*) AS count
      FROM events
      WHERE org_id = $1
        AND timestamp >= $2
        AND risk_category IS NOT NULL
        AND action IN ('warn','block')
      GROUP BY risk_category
      ORDER BY count DESC
    `, [req.org.id, since]);

    // Top tools by usage
    const tools = await pool.query(`
      SELECT
        tool,
        COUNT(*)                                         AS total,
        COUNT(*) FILTER (WHERE action = 'warn')         AS warned,
        COUNT(*) FILTER (WHERE action = 'block')        AS blocked
      FROM events
      WHERE org_id = $1 AND timestamp >= $2
      GROUP BY tool
      ORDER BY total DESC
    `, [req.org.id, since]);

    // Most active users (top 5 by event count)
    const users = await pool.query(`
      SELECT
        user_id,
        COUNT(*)                                         AS total,
        COUNT(*) FILTER (WHERE action IN ('warn','block')) AS flagged
      FROM events
      WHERE org_id = $1 AND timestamp >= $2
      GROUP BY user_id
      ORDER BY total DESC
      LIMIT 5
    `, [req.org.id, since]);

    res.json({
      period_days: days,
      totals: totals.rows[0],
      daily: daily.rows,
      categories: categories.rows,
      tools: tools.rows,
      top_users: users.rows,
    });

  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
