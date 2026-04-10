const express = require('express')
const cors = require('cors')
const { pool, initializeDatabase } = require('./db')

const app = express()
const port = Number(process.env.PORT || 3000)

app.use(cors())
app.use(express.json())

function normalizeLimit(value, fallback = 100, max = 500) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, max)
}

function normalizeDays(value, fallback = 14) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, 90)
}

app.get('/api/summary', async (req, res) => {
  const [patientResult, recordResult, diagnosisResult, recentResult] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total FROM patients'),
    pool.query('SELECT COUNT(*)::int AS total FROM health_records'),
    pool.query('SELECT COUNT(DISTINCT diagnosis)::int AS total FROM health_records'),
    pool.query(
      `
        SELECT
          hr.id,
          hr.patient_id,
          COALESCE(p.full_name, hr.patient_name) AS patient_name,
          hr.diagnosis,
          to_char(hr.last_visit, 'YYYY-MM-DD') AS last_visit
        FROM health_records hr
        LEFT JOIN patients p ON p.id = hr.patient_id
        ORDER BY hr.last_visit DESC, hr.id DESC
        LIMIT 5
      `,
    ),
  ])

  res.json({
    totalPatients: patientResult.rows[0].total,
    totalVisits: recordResult.rows[0].total,
    diagnosisCount: diagnosisResult.rows[0].total,
    recentRecords: recentResult.rows,
  })
})

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({
      status: 'ok',
      instance: process.env.HOSTNAME || 'local-backend',
      db: 'connected',
    })
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      instance: process.env.HOSTNAME || 'local-backend',
      db: 'disconnected',
    })
  }
})

app.get('/api/system/status', async (req, res) => {
  const [patients, records, dbUptime] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total FROM patients'),
    pool.query('SELECT COUNT(*)::int AS total FROM health_records'),
    pool.query(
      `
        SELECT EXTRACT(EPOCH FROM NOW() - pg_postmaster_start_time())::int AS db_uptime_seconds
      `,
    ),
  ])

  res.json({
    apiInstance: process.env.HOSTNAME || 'local-backend',
    apiUptimeSeconds: Math.floor(process.uptime()),
    dbUptimeSeconds: dbUptime.rows[0].db_uptime_seconds,
    totalPatients: patients.rows[0].total,
    totalVisits: records.rows[0].total,
  })
})

app.get('/api/patients', async (req, res) => {
  const search = (req.query.search || '').toString().trim()
  const limit = normalizeLimit(req.query.limit, 200, 300)

  const params = []
  const where = []

  if (search) {
    params.push(`%${search}%`)
    where.push(`
      (
        p.full_name ILIKE $${params.length}
        OR COALESCE(p.email, '') ILIKE $${params.length}
        OR COALESCE(p.phone, '') ILIKE $${params.length}
      )
    `)
  }

  params.push(limit)

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.full_name,
        p.email,
        p.phone,
        to_char(p.dob, 'YYYY-MM-DD') AS dob,
        COUNT(hr.id)::int AS visits_count
      FROM patients p
      LEFT JOIN health_records hr ON hr.patient_id = p.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY p.id
      ORDER BY p.full_name ASC
      LIMIT $${params.length}
    `,
    params,
  )

  res.json(result.rows)
})

app.get('/api/patients/:id', async (req, res) => {
  const patientId = Number(req.params.id)

  if (!Number.isInteger(patientId) || patientId <= 0) {
    res.status(400).json({ message: 'Invalid patient id' })
    return
  }

  const patientResult = await pool.query(
    `
      SELECT
        id,
        full_name,
        email,
        phone,
        to_char(dob, 'YYYY-MM-DD') AS dob
      FROM patients
      WHERE id = $1
    `,
    [patientId],
  )

  if (patientResult.rows.length === 0) {
    res.status(404).json({ message: 'Patient not found' })
    return
  }

  const recordResult = await pool.query(
    `
      SELECT
        id,
        patient_id,
        patient_name,
        diagnosis,
        to_char(last_visit, 'YYYY-MM-DD') AS last_visit
      FROM health_records
      WHERE patient_id = $1
      ORDER BY last_visit DESC, id DESC
    `,
    [patientId],
  )

  res.json({
    patient: patientResult.rows[0],
    records: recordResult.rows,
  })
})

app.post('/api/patients', async (req, res) => {
  const fullName = (req.body.fullName || '').toString().trim()
  const email = (req.body.email || '').toString().trim() || null
  const phone = (req.body.phone || '').toString().trim() || null
  const dob = (req.body.dob || '').toString().trim() || null

  if (!fullName) {
    res.status(400).json({ message: 'fullName is required' })
    return
  }

  const result = await pool.query(
    `
      INSERT INTO patients (full_name, email, phone, dob)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (full_name)
      DO UPDATE SET
        email = COALESCE(EXCLUDED.email, patients.email),
        phone = COALESCE(EXCLUDED.phone, patients.phone),
        dob = COALESCE(EXCLUDED.dob, patients.dob)
      RETURNING
        id,
        full_name,
        email,
        phone,
        to_char(dob, 'YYYY-MM-DD') AS dob
    `,
    [fullName, email, phone, dob],
  )

  res.status(201).json(result.rows[0])
})

app.get('/api/records', async (req, res) => {
  const search = (req.query.search || '').toString().trim()
  const diagnosis = (req.query.diagnosis || '').toString().trim()
  const limit = normalizeLimit(req.query.limit)
  const patientId = Number(req.query.patientId)

  const params = []
  const where = []

  if (Number.isInteger(patientId) && patientId > 0) {
    params.push(patientId)
    where.push(`hr.patient_id = $${params.length}`)
  }

  if (diagnosis) {
    params.push(`%${diagnosis}%`)
    where.push(`hr.diagnosis ILIKE $${params.length}`)
  }

  if (search) {
    params.push(`%${search}%`)
    where.push(`(
      hr.diagnosis ILIKE $${params.length}
      OR COALESCE(p.full_name, hr.patient_name) ILIKE $${params.length}
    )`)
  }

  params.push(limit)

  const result = await pool.query(
    `
      SELECT
        hr.id,
        hr.patient_id,
        COALESCE(p.full_name, hr.patient_name) AS patient_name,
        hr.diagnosis,
        to_char(hr.last_visit, 'YYYY-MM-DD') AS last_visit
      FROM health_records hr
      LEFT JOIN patients p ON p.id = hr.patient_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY hr.last_visit DESC, hr.id DESC
      LIMIT $${params.length}
    `,
    params,
  )

  res.json(result.rows)
})

app.post('/api/records', async (req, res) => {
  const diagnosis = (req.body.diagnosis || '').toString().trim()
  const lastVisit = (req.body.lastVisit || '').toString().trim()
  const patientNameInput = (req.body.patientName || '').toString().trim()
  const patientIdInput = Number(req.body.patientId)

  if (!diagnosis || !lastVisit) {
    res.status(400).json({ message: 'diagnosis and lastVisit are required' })
    return
  }

  let patientId = null
  let patientName = patientNameInput

  if (Number.isInteger(patientIdInput) && patientIdInput > 0) {
    const patientResult = await pool.query(
      'SELECT id, full_name FROM patients WHERE id = $1',
      [patientIdInput],
    )

    if (patientResult.rows.length === 0) {
      res.status(404).json({ message: 'Patient not found for given patientId' })
      return
    }

    patientId = patientResult.rows[0].id
    patientName = patientResult.rows[0].full_name
  }

  if (!patientName) {
    res.status(400).json({ message: 'patientName or patientId is required' })
    return
  }

  if (!patientId) {
    const patientResult = await pool.query(
      `
        INSERT INTO patients (full_name)
        VALUES ($1)
        ON CONFLICT (full_name)
        DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id, full_name
      `,
      [patientName],
    )

    patientId = patientResult.rows[0].id
    patientName = patientResult.rows[0].full_name
  }

  const result = await pool.query(
    `
      INSERT INTO health_records (patient_id, patient_name, diagnosis, last_visit)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        patient_id,
        patient_name,
        diagnosis,
        to_char(last_visit, 'YYYY-MM-DD') AS last_visit
    `,
    [patientId, patientName, diagnosis, lastVisit],
  )

  res.status(201).json(result.rows[0])
})

app.get('/api/analytics/diagnoses', async (req, res) => {
  const result = await pool.query(
    `
      SELECT diagnosis, COUNT(*)::int AS visits
      FROM health_records
      GROUP BY diagnosis
      ORDER BY visits DESC, diagnosis ASC
      LIMIT 20
    `,
  )

  res.json(result.rows)
})

app.get('/api/analytics/visits-by-day', async (req, res) => {
  const days = normalizeDays(req.query.days)

  const result = await pool.query(
    `
      SELECT
        to_char(last_visit, 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS visits
      FROM health_records
      WHERE last_visit >= CURRENT_DATE - $1::int
      GROUP BY day
      ORDER BY day ASC
    `,
    [days],
  )

  res.json(result.rows)
})

app.use((error, req, res, next) => {
  console.error('Request failed', error)
  res.status(500).json({ message: 'Internal server error' })
})

async function start() {
  await initializeDatabase()
  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend listening on port ${port}`)
  })
}

start().catch((error) => {
  console.error('Failed to start backend', error)
  process.exit(1)
})
