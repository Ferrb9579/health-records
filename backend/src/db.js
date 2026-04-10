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
    CREATE TABLE IF NOT EXISTS patients (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      dob DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS health_records (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER,
      patient_name TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      last_visit DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await pool.query(`
    ALTER TABLE health_records
    ADD COLUMN IF NOT EXISTS patient_id INTEGER;
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_health_records_last_visit
    ON health_records(last_visit DESC);
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_health_records_patient_id
    ON health_records(patient_id);
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_health_records_diagnosis
    ON health_records(diagnosis);
  `)

  await pool.query(`
    INSERT INTO patients (full_name)
    SELECT DISTINCT patient_name
    FROM health_records
    WHERE COALESCE(patient_name, '') <> ''
    ON CONFLICT (full_name) DO NOTHING;
  `)

  await pool.query(`
    UPDATE health_records hr
    SET patient_id = p.id
    FROM patients p
    WHERE hr.patient_id IS NULL
      AND hr.patient_name = p.full_name;
  `)
}

module.exports = {
  pool,
  initializeDatabase,
}
