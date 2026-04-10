import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type HealthRecord = {
  id: number
  patient_name: string
  diagnosis: string
  last_visit: string
}

function App() {
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [backendInstance, setBackendInstance] = useState('unknown')
  const [backendUpstream, setBackendUpstream] = useState('unknown')
  const [patientName, setPatientName] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [lastVisit, setLastVisit] = useState('')

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/records')

      if (!response.ok) {
        throw new Error('Unable to load records right now.')
      }

      const data = (await response.json()) as HealthRecord[]
      setRecords(data)
      setBackendUpstream(response.headers.get('x-backend-upstream') ?? 'unknown')
    } catch {
      setError('Could not reach the API. Check backend replicas and load balancer status.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health')

      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as { instance?: string }
      if (payload.instance) {
        setBackendInstance(payload.instance)
      }
      setBackendUpstream(response.headers.get('x-backend-upstream') ?? 'unknown')
    } catch {
      // Keep UI functional even if health check temporarily fails.
    }
  }, [])

  useEffect(() => {
    void loadRecords()
    void loadHealth()
  }, [loadHealth, loadRecords])

  const submitRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!patientName.trim() || !diagnosis.trim() || !lastVisit.trim()) {
      setError('All fields are required before saving a health record.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientName: patientName.trim(),
          diagnosis: diagnosis.trim(),
          lastVisit,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create record')
      }

      setPatientName('')
      setDiagnosis('')
      setLastVisit('')
      await loadRecords()
      await loadHealth()
    } catch {
      setError('Save failed. The system remains available if at least one backend replica is up.')
    } finally {
      setSaving(false)
    }
  }

  const statusLabel = loading ? 'Loading records...' : `${records.length} records loaded`

  return (
    <main className="page">
      <header className="hero">
        <h1>Distributed Health Records</h1>
        <p>
          Vite + React frontend replicas, Express API replicas, and PostgreSQL behind
          a containerized load balancer.
        </p>
      </header>

      <section className="status-grid">
        <article>
          <h2>API Replica</h2>
          <p className="metric">{backendInstance}</p>
        </article>
        <article>
          <h2>Load Balancer Upstream</h2>
          <p className="metric">{backendUpstream}</p>
        </article>
        <article>
          <h2>Record Status</h2>
          <p className="metric">{statusLabel}</p>
        </article>
      </section>

      <section className="panel">
        <h2>Add Health Record</h2>
        <form className="record-form" onSubmit={submitRecord}>
          <label>
            Patient Name
            <input
              type="text"
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
              placeholder="e.g. Maya Patel"
            />
          </label>

          <label>
            Diagnosis
            <input
              type="text"
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
              placeholder="e.g. Stage-1 Hypertension"
            />
          </label>

          <label>
            Last Visit
            <input
              type="date"
              value={lastVisit}
              onChange={(event) => setLastVisit(event.target.value)}
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Record'}
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel">
        <h2>Recent Records</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>{record.patient_name}</td>
                  <td>{record.diagnosis}</td>
                  <td>{record.last_visit}</td>
                </tr>
              ))}
              {!loading && records.length === 0 ? (
                <tr>
                  <td colSpan={4}>No records yet. Add your first patient record above.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default App
