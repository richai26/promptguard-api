// setup-db.js — run once to create tables in Supabase
// Run with: node setup-db.js
require('dotenv').config();
const pool = require('./db');

async function setup() {
  const client = await pool.connect();
  try {
    console.log('Creating tables...');

    // Organisations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS organisations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Events table — one row per prompt interception
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organisations(id),
        user_id TEXT,
        tool TEXT,
        tool_id TEXT,
        risk_level TEXT CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
        risk_category TEXT,
        action TEXT CHECK (action IN ('allow','warn','block','proceeded_after_warn')),
        url TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Policy table — one row per org, stores their tool policy as JSON
    await client.query(`
      CREATE TABLE IF NOT EXISTS policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID UNIQUE REFERENCES organisations(id),
        policy JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create indexes for fast dashboard queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(org_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_risk_level ON events(risk_level);`);

    // Insert a demo organisation so we can test immediately
    await client.query(`
      INSERT INTO organisations (name, api_key)
      VALUES ('Demo Organisation', 'pg_demo_key_123456')
      ON CONFLICT (api_key) DO NOTHING;
    `);

    console.log('Tables created successfully');
    console.log('Demo org API key: pg_demo_key_123456');
    console.log('Use this key in your extension and dashboard');

  } catch (err) {
    console.error('Setup error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

setup();
