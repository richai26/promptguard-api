require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
app.use(helmet());
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
}));
app.use('/api/events', require('./routes/events'));
app.use('/api/policy', require('./routes/policy'));
app.use('/api/stats', require('./routes/stats'));
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.listen(PORT, () => {
  console.log(`PromptGuard API running on port ${PORT}`);
});