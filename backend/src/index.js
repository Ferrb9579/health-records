const express = require('express')
const cors = require('cors')
const { pool, initializeDatabase } = require('./db')

const app = express()
const port = Number(process.env.PORT || 3000)

app.use(cors())
app.use(express.json())

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

app.get('/api/records', async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, patient_name, diagnosis, to_char(last_visit, 'YYYY-MM-DD') AS last_visit
      FROM health_records
      ORDER BY id DESC
      LIMIT 100
    `,
  )

  res.json(result.rows)
})

app.post('/api/records', async (req, res) => {
  const { patientName, diagnosis, lastVisit } = req.body

  if (!patientName || !diagnosis || !lastVisit) {
    res.status(400).json({ message: 'patientName, diagnosis, and lastVisit are required' })
    return
  }

  const result = await pool.query(
    `
      INSERT INTO health_records (patient_name, diagnosis, last_visit)
      VALUES ($1, $2, $3)
      RETURNING id, patient_name, diagnosis, to_char(last_visit, 'YYYY-MM-DD') AS last_visit
    `,
    [patientName.trim(), diagnosis.trim(), lastVisit],
  )

  res.status(201).json(result.rows[0])
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
