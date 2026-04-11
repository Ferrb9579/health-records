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

function normalizeThreshold(value, fallback = 180, max = 365) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, max)
}

function normalizeAppointmentStatus(value, fallback = 'scheduled') {
  const normalized = (value || '').toString().trim().toLowerCase()

  if (['scheduled', 'completed', 'cancelled', 'no-show'].includes(normalized)) {
    return normalized
  }

  return fallback
}

app.get('/api/summary', async (req, res) => {
  const [patientResult, recordResult, diagnosisResult, appointmentResult, recentResult] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total FROM patients'),
    pool.query('SELECT COUNT(*)::int AS total FROM health_records'),
    pool.query('SELECT COUNT(DISTINCT diagnosis)::int AS total FROM health_records'),
    pool.query('SELECT COUNT(*)::int AS total FROM appointments'),
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
    totalAppointments: appointmentResult.rows[0].total,
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
  const [patients, records, appointments, dbUptime] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total FROM patients'),
    pool.query('SELECT COUNT(*)::int AS total FROM health_records'),
    pool.query('SELECT COUNT(*)::int AS total FROM appointments'),
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
    totalAppointments: appointments.rows[0].total,
  })
})

app.get('/api/health/preventive-care', async (req, res) => {
  const search = (req.query.search || '').toString().trim()
  const days = normalizeThreshold(req.query.days)
  const limit = normalizeLimit(req.query.limit, 200, 300)
  const params = [days]
  const where = []

  if (search) {
    params.push(`%${search}%`)
    where.push(`(
      p.full_name ILIKE $${params.length}
      OR COALESCE(p.email, '') ILIKE $${params.length}
      OR COALESCE(p.phone, '') ILIKE $${params.length}
    )`)
  }

  params.push(limit)

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.full_name,
        p.email,
        p.phone,
        to_char(MAX(hr.last_visit), 'YYYY-MM-DD') AS last_visit,
        CASE
          WHEN MAX(hr.last_visit) IS NULL THEN NULL::int
          ELSE GREATEST((CURRENT_DATE - MAX(hr.last_visit)), 0)::int
        END AS days_since_last_visit,
        COUNT(hr.id)::int AS total_visits,
        CASE
          WHEN MAX(hr.last_visit) IS NULL THEN 'no-history'
          WHEN (CURRENT_DATE - MAX(hr.last_visit)) > $1::int THEN 'due'
          WHEN (CURRENT_DATE - MAX(hr.last_visit)) > GREATEST(($1::int / 2), 14) THEN 'soon'
          ELSE 'ok'
        END AS status
      FROM patients p
      LEFT JOIN health_records hr ON hr.patient_id = p.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY p.id
      ORDER BY
        CASE
          WHEN MAX(hr.last_visit) IS NULL THEN 1
          WHEN (CURRENT_DATE - MAX(hr.last_visit)) > $1::int THEN 2
          WHEN (CURRENT_DATE - MAX(hr.last_visit)) > GREATEST(($1::int / 2), 14) THEN 3
          ELSE 4
        END,
        days_since_last_visit DESC,
        p.full_name ASC
      LIMIT $${params.length}
    `,
    params,
  )

  res.json(result.rows)
})

app.get('/api/health/risk-panel', async (req, res) => {
  const limit = normalizeLimit(req.query.limit, 200, 300)

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.full_name,
        latest.latest_diagnosis,
        to_char(stats.last_visit, 'YYYY-MM-DD') AS last_visit,
        CASE
          WHEN stats.last_visit IS NULL THEN NULL::int
          ELSE GREATEST((CURRENT_DATE - stats.last_visit), 0)::int
        END AS days_since_last_visit,
        stats.total_visits,
        stats.diagnosis_count,
        (
          CASE
            WHEN stats.last_visit IS NULL THEN 3
            WHEN (CURRENT_DATE - stats.last_visit) > 90 THEN 3
            WHEN (CURRENT_DATE - stats.last_visit) > 45 THEN 2
            WHEN (CURRENT_DATE - stats.last_visit) > 20 THEN 1
            ELSE 0
          END
          + CASE
            WHEN stats.diagnosis_count >= 4 THEN 2
            WHEN stats.diagnosis_count >= 2 THEN 1
            ELSE 0
          END
          + CASE
            WHEN stats.chronic_flags > 0 THEN 2
            ELSE 0
          END
          + CASE
            WHEN stats.total_visits = 0 THEN 1
            ELSE 0
          END
        )::int AS risk_score,
        CASE
          WHEN (
            CASE
              WHEN stats.last_visit IS NULL THEN 3
              WHEN (CURRENT_DATE - stats.last_visit) > 90 THEN 3
              WHEN (CURRENT_DATE - stats.last_visit) > 45 THEN 2
              WHEN (CURRENT_DATE - stats.last_visit) > 20 THEN 1
              ELSE 0
            END
            + CASE
              WHEN stats.diagnosis_count >= 4 THEN 2
              WHEN stats.diagnosis_count >= 2 THEN 1
              ELSE 0
            END
            + CASE
              WHEN stats.chronic_flags > 0 THEN 2
              ELSE 0
            END
            + CASE
              WHEN stats.total_visits = 0 THEN 1
              ELSE 0
            END
          ) >= 6 THEN 'high'
          WHEN (
            CASE
              WHEN stats.last_visit IS NULL THEN 3
              WHEN (CURRENT_DATE - stats.last_visit) > 90 THEN 3
              WHEN (CURRENT_DATE - stats.last_visit) > 45 THEN 2
              WHEN (CURRENT_DATE - stats.last_visit) > 20 THEN 1
              ELSE 0
            END
            + CASE
              WHEN stats.diagnosis_count >= 4 THEN 2
              WHEN stats.diagnosis_count >= 2 THEN 1
              ELSE 0
            END
            + CASE
              WHEN stats.chronic_flags > 0 THEN 2
              ELSE 0
            END
            + CASE
              WHEN stats.total_visits = 0 THEN 1
              ELSE 0
            END
          ) >= 3 THEN 'medium'
          ELSE 'low'
        END AS risk_level
      FROM patients p
      LEFT JOIN (
        SELECT
          hr.patient_id,
          MAX(hr.last_visit) AS last_visit,
          COUNT(hr.id)::int AS total_visits,
          COUNT(DISTINCT hr.diagnosis)::int AS diagnosis_count,
          SUM(
            CASE
              WHEN hr.diagnosis ILIKE '%diab%'
                OR hr.diagnosis ILIKE '%hypert%'
                OR hr.diagnosis ILIKE '%asthma%'
                OR hr.diagnosis ILIKE '%cardio%'
                OR hr.diagnosis ILIKE '%heart%'
              THEN 1
              ELSE 0
            END
          )::int AS chronic_flags
        FROM health_records hr
        GROUP BY hr.patient_id
      ) stats ON stats.patient_id = p.id
      LEFT JOIN LATERAL (
        SELECT hr2.diagnosis AS latest_diagnosis
        FROM health_records hr2
        WHERE hr2.patient_id = p.id
        ORDER BY hr2.last_visit DESC, hr2.id DESC
        LIMIT 1
      ) latest ON TRUE
      ORDER BY risk_score DESC, days_since_last_visit DESC, p.full_name ASC
      LIMIT $1
    `,
    [limit],
  )

  res.json(result.rows)
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
        OR COALESCE(p.address, '') ILIKE $${params.length}
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
        p.gender,
        p.blood_type,
        p.address,
        p.emergency_contact_name,
        p.emergency_contact_phone,
        p.insurance_provider,
        p.allergies,
        p.notes,
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
        to_char(dob, 'YYYY-MM-DD') AS dob,
        gender,
        blood_type,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        insurance_provider,
        allergies,
        notes
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
  const gender = (req.body.gender || '').toString().trim() || null
  const bloodType = (req.body.bloodType || '').toString().trim() || null
  const address = (req.body.address || '').toString().trim() || null
  const emergencyContactName = (req.body.emergencyContactName || '').toString().trim() || null
  const emergencyContactPhone = (req.body.emergencyContactPhone || '').toString().trim() || null
  const insuranceProvider = (req.body.insuranceProvider || '').toString().trim() || null
  const allergies = (req.body.allergies || '').toString().trim() || null
  const notes = (req.body.notes || '').toString().trim() || null

  if (!fullName) {
    res.status(400).json({ message: 'fullName is required' })
    return
  }

  const result = await pool.query(
    `
      INSERT INTO patients (
        full_name,
        email,
        phone,
        dob,
        gender,
        blood_type,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        insurance_provider,
        allergies,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (full_name)
      DO UPDATE SET
        email = COALESCE(EXCLUDED.email, patients.email),
        phone = COALESCE(EXCLUDED.phone, patients.phone),
        dob = COALESCE(EXCLUDED.dob, patients.dob),
        gender = COALESCE(EXCLUDED.gender, patients.gender),
        blood_type = COALESCE(EXCLUDED.blood_type, patients.blood_type),
        address = COALESCE(EXCLUDED.address, patients.address),
        emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, patients.emergency_contact_name),
        emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, patients.emergency_contact_phone),
        insurance_provider = COALESCE(EXCLUDED.insurance_provider, patients.insurance_provider),
        allergies = COALESCE(EXCLUDED.allergies, patients.allergies),
        notes = COALESCE(EXCLUDED.notes, patients.notes)
      RETURNING
        id,
        full_name,
        email,
        phone,
        to_char(dob, 'YYYY-MM-DD') AS dob,
        gender,
        blood_type,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        insurance_provider,
        allergies,
        notes
    `,
    [
      fullName,
      email,
      phone,
      dob,
      gender,
      bloodType,
      address,
      emergencyContactName,
      emergencyContactPhone,
      insuranceProvider,
      allergies,
      notes,
    ],
  )

  res.status(201).json(result.rows[0])
})

app.put('/api/patients/:id', async (req, res) => {
  const patientId = Number(req.params.id)
  const fullName = (req.body.fullName || '').toString().trim()
  const email = (req.body.email || '').toString().trim() || null
  const phone = (req.body.phone || '').toString().trim() || null
  const dob = (req.body.dob || '').toString().trim() || null
  const gender = (req.body.gender || '').toString().trim() || null
  const bloodType = (req.body.bloodType || '').toString().trim() || null
  const address = (req.body.address || '').toString().trim() || null
  const emergencyContactName = (req.body.emergencyContactName || '').toString().trim() || null
  const emergencyContactPhone = (req.body.emergencyContactPhone || '').toString().trim() || null
  const insuranceProvider = (req.body.insuranceProvider || '').toString().trim() || null
  const allergies = (req.body.allergies || '').toString().trim() || null
  const notes = (req.body.notes || '').toString().trim() || null

  if (!Number.isInteger(patientId) || patientId <= 0) {
    res.status(400).json({ message: 'Invalid patient id' })
    return
  }

  if (!fullName) {
    res.status(400).json({ message: 'fullName is required' })
    return
  }

  const result = await pool.query(
    `
      UPDATE patients
      SET
        full_name = $2,
        email = $3,
        phone = $4,
        dob = $5,
        gender = $6,
        blood_type = $7,
        address = $8,
        emergency_contact_name = $9,
        emergency_contact_phone = $10,
        insurance_provider = $11,
        allergies = $12,
        notes = $13
      WHERE id = $1
      RETURNING
        id,
        full_name,
        email,
        phone,
        to_char(dob, 'YYYY-MM-DD') AS dob,
        gender,
        blood_type,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        insurance_provider,
        allergies,
        notes
    `,
    [
      patientId,
      fullName,
      email,
      phone,
      dob,
      gender,
      bloodType,
      address,
      emergencyContactName,
      emergencyContactPhone,
      insuranceProvider,
      allergies,
      notes,
    ],
  )

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Patient not found' })
    return
  }

  await pool.query(
    `
      UPDATE health_records
      SET patient_name = $2
      WHERE patient_id = $1
    `,
    [patientId, result.rows[0].full_name],
  )

  res.json(result.rows[0])
})

app.delete('/api/patients/:id', async (req, res) => {
  const patientId = Number(req.params.id)

  if (!Number.isInteger(patientId) || patientId <= 0) {
    res.status(400).json({ message: 'Invalid patient id' })
    return
  }

  const deleteResult = await pool.query('DELETE FROM patients WHERE id = $1 RETURNING id', [patientId])

  if (deleteResult.rows.length === 0) {
    res.status(404).json({ message: 'Patient not found' })
    return
  }

  await pool.query(
    `
      UPDATE health_records
      SET patient_id = NULL
      WHERE patient_id = $1
    `,
    [patientId],
  )

  res.json({ deleted: true })
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

app.put('/api/records/:id', async (req, res) => {
  const recordId = Number(req.params.id)
  const diagnosis = (req.body.diagnosis || '').toString().trim()
  const lastVisit = (req.body.lastVisit || '').toString().trim()
  const patientNameInput = (req.body.patientName || '').toString().trim()
  const patientIdInput = Number(req.body.patientId)

  if (!Number.isInteger(recordId) || recordId <= 0) {
    res.status(400).json({ message: 'Invalid record id' })
    return
  }

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
      UPDATE health_records
      SET
        patient_id = $2,
        patient_name = $3,
        diagnosis = $4,
        last_visit = $5
      WHERE id = $1
      RETURNING
        id,
        patient_id,
        patient_name,
        diagnosis,
        to_char(last_visit, 'YYYY-MM-DD') AS last_visit
    `,
    [recordId, patientId, patientName, diagnosis, lastVisit],
  )

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Record not found' })
    return
  }

  res.json(result.rows[0])
})

app.delete('/api/records/:id', async (req, res) => {
  const recordId = Number(req.params.id)

  if (!Number.isInteger(recordId) || recordId <= 0) {
    res.status(400).json({ message: 'Invalid record id' })
    return
  }

  const result = await pool.query('DELETE FROM health_records WHERE id = $1 RETURNING id', [recordId])

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Record not found' })
    return
  }

  res.json({ deleted: true })
})

app.get('/api/appointments', async (req, res) => {
  const search = (req.query.search || '').toString().trim()
  const statusRaw = (req.query.status || '').toString().trim().toLowerCase()
  const fromDate = (req.query.fromDate || '').toString().trim()
  const toDate = (req.query.toDate || '').toString().trim()
  const limit = normalizeLimit(req.query.limit, 200, 300)
  const patientId = Number(req.query.patientId)

  const params = []
  const where = []

  if (Number.isInteger(patientId) && patientId > 0) {
    params.push(patientId)
    where.push(`a.patient_id = $${params.length}`)
  }

  if (['scheduled', 'completed', 'cancelled', 'no-show'].includes(statusRaw)) {
    params.push(statusRaw)
    where.push(`a.status = $${params.length}`)
  }

  if (fromDate) {
    params.push(fromDate)
    where.push(`a.appointment_date >= $${params.length}`)
  }

  if (toDate) {
    params.push(toDate)
    where.push(`a.appointment_date <= $${params.length}`)
  }

  if (search) {
    params.push(`%${search}%`)
    where.push(`(
      a.reason ILIKE $${params.length}
      OR COALESCE(p.full_name, a.patient_name) ILIKE $${params.length}
      OR COALESCE(a.notes, '') ILIKE $${params.length}
    )`)
  }

  params.push(limit)

  const result = await pool.query(
    `
      SELECT
        a.id,
        a.patient_id,
        COALESCE(p.full_name, a.patient_name) AS patient_name,
        to_char(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
        a.reason,
        a.status,
        a.notes
      FROM appointments a
      LEFT JOIN patients p ON p.id = a.patient_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.appointment_date ASC, a.id DESC
      LIMIT $${params.length}
    `,
    params,
  )

  res.json(result.rows)
})

app.post('/api/appointments', async (req, res) => {
  const appointmentDate = (req.body.appointmentDate || '').toString().trim()
  const reason = (req.body.reason || '').toString().trim()
  const notes = (req.body.notes || '').toString().trim() || null
  const status = normalizeAppointmentStatus(req.body.status, 'scheduled')
  const patientNameInput = (req.body.patientName || '').toString().trim()
  const patientIdInput = Number(req.body.patientId)

  if (!appointmentDate || !reason) {
    res.status(400).json({ message: 'appointmentDate and reason are required' })
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
      INSERT INTO appointments (patient_id, patient_name, appointment_date, reason, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        patient_id,
        patient_name,
        to_char(appointment_date, 'YYYY-MM-DD') AS appointment_date,
        reason,
        status,
        notes
    `,
    [patientId, patientName, appointmentDate, reason, status, notes],
  )

  res.status(201).json(result.rows[0])
})

app.put('/api/appointments/:id', async (req, res) => {
  const appointmentId = Number(req.params.id)
  const appointmentDate = (req.body.appointmentDate || '').toString().trim()
  const reason = (req.body.reason || '').toString().trim()
  const notes = (req.body.notes || '').toString().trim() || null
  const status = normalizeAppointmentStatus(req.body.status, 'scheduled')
  const patientNameInput = (req.body.patientName || '').toString().trim()
  const patientIdInput = Number(req.body.patientId)

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    res.status(400).json({ message: 'Invalid appointment id' })
    return
  }

  if (!appointmentDate || !reason) {
    res.status(400).json({ message: 'appointmentDate and reason are required' })
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
      UPDATE appointments
      SET
        patient_id = $2,
        patient_name = $3,
        appointment_date = $4,
        reason = $5,
        status = $6,
        notes = $7
      WHERE id = $1
      RETURNING
        id,
        patient_id,
        patient_name,
        to_char(appointment_date, 'YYYY-MM-DD') AS appointment_date,
        reason,
        status,
        notes
    `,
    [appointmentId, patientId, patientName, appointmentDate, reason, status, notes],
  )

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Appointment not found' })
    return
  }

  res.json(result.rows[0])
})

app.delete('/api/appointments/:id', async (req, res) => {
  const appointmentId = Number(req.params.id)

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    res.status(400).json({ message: 'Invalid appointment id' })
    return
  }

  const result = await pool.query('DELETE FROM appointments WHERE id = $1 RETURNING id', [appointmentId])

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Appointment not found' })
    return
  }

  res.json({ deleted: true })
})

app.get('/api/care/timeline', async (req, res) => {
  const patientId = Number(req.query.patientId)
  const eventType = (req.query.eventType || '').toString().trim().toLowerCase()
  const limit = normalizeLimit(req.query.limit, 200, 400)

  const params = []
  const where = []

  if (Number.isInteger(patientId) && patientId > 0) {
    params.push(patientId)
    where.push(`patient_id = $${params.length}`)
  }

  if (eventType === 'visit' || eventType === 'appointment') {
    params.push(eventType)
    where.push(`event_type = $${params.length}`)
  }

  params.push(limit)

  const result = await pool.query(
    `
      WITH timeline AS (
        SELECT
          'visit'::text AS event_type,
          hr.id,
          hr.patient_id,
          COALESCE(p.full_name, hr.patient_name) AS patient_name,
          to_char(hr.last_visit, 'YYYY-MM-DD') AS event_date,
          hr.diagnosis AS title,
          NULL::text AS status,
          NULL::text AS notes
        FROM health_records hr
        LEFT JOIN patients p ON p.id = hr.patient_id

        UNION ALL

        SELECT
          'appointment'::text AS event_type,
          a.id,
          a.patient_id,
          COALESCE(p2.full_name, a.patient_name) AS patient_name,
          to_char(a.appointment_date, 'YYYY-MM-DD') AS event_date,
          a.reason AS title,
          a.status,
          a.notes
        FROM appointments a
        LEFT JOIN patients p2 ON p2.id = a.patient_id
      )
      SELECT
        event_type,
        id,
        patient_id,
        patient_name,
        event_date,
        title,
        status,
        notes
      FROM timeline
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY event_date DESC, id DESC
      LIMIT $${params.length}
    `,
    params,
  )

  res.json(result.rows)
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
