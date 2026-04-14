// server.js — PromptGuard API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: [
    'chrome-extension://*',
'https://promptguard-api-production-ff1c.up.railway.app',    'http://localhost:3001',
  ],
  methods: ['GET', 'POST'],
}));

// Rate limit — max 60 requests per minute per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
}));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/events',  require('./routes/events'));
app.use('/api/policy',  require('./routes/policy'));
app.use('/api/stats',   require('./routes/stats'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PromptGuard API running on port ${PORT}`);
});
