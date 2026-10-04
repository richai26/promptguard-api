// db.js — Postgres connection via Supabase
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Database connected');
    release();
  }
});

// Add the prompt_text column if this database predates it. Until that has
// succeeded, pool.hasPromptText stays false and the routes leave the column out,
// so logging keeps working either way.
pool.hasPromptText = false;
pool.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS prompt_text TEXT')
  .then(() => { pool.hasPromptText = true; console.log('prompt_text column ready'); })
  .catch((err) => console.error('Could not add prompt_text column:', err.message));

module.exports = pool;
