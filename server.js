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
app.use(cors({
  origin: [
    'chrome-extension://*',
    'https://your-dashboard.vercel.app',
    'http://localhost:3001',
  ],
  methods: ['GET', 'POST'],
}));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
}));
app.use('/api/events',  require('./routes/events'));
app.use('/api/policy',  require('./routes/policy'));
app.use('/api/stats',   require('./routes/stats'));
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.listen(PORT, () => {
  console.log(`PromptGuard API running on port ${PORT}`);
});