// routes/org.js — tells the dashboard which company an access code belongs to
const express = require('express');
const router = express.Router();
const { requireAdminKey } = require('../auth');

// GET /api/org — used by the dashboard sign-in screen
router.get('/', requireAdminKey, (req, res) => {
  res.json({ id: req.org.id, name: req.org.name });
});

module.exports = router;
