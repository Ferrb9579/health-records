const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'health_user',
  password: process.env.DB_PASSWORD || 'health_password',
  database: process.env.DB_NAME || 'health_records',
  max: 20,
  idleTimeoutMillis: 30000,
})

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS health_records (
      id SERIAL PRIMARY KEY,
      patient_name TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      last_visit DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

module.exports = {
  pool,
  initializeDatabase,
}
