import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { Summary } from '../types'

export function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      try {
        const result = await api.getSummary()
        setSummary(result.data)
      } catch {
        setError('Unable to load dashboard summary.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Overview</h2>
        {loading ? <p>Loading summary...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {summary ? (
          <div className="stats-row">
            <article>
              <h3>Total Patients</h3>
              <p className="stat-value">{summary.totalPatients}</p>
            </article>
            <article>
              <h3>Total Visits</h3>
              <p className="stat-value">{summary.totalVisits}</p>
            </article>
            <article>
              <h3>Total Appointments</h3>
              <p className="stat-value">{summary.totalAppointments}</p>
            </article>
            <article>
              <h3>Diagnosis Types</h3>
              <p className="stat-value">{summary.diagnosisCount}</p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Recent Visits</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {summary?.recentRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>{record.patient_name}</td>
                  <td>{record.diagnosis}</td>
                  <td>{record.last_visit}</td>
                </tr>
              ))}
              {!loading && !summary?.recentRecords.length ? (
                <tr>
                  <td colSpan={4}>No records available yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel quick-links">
        <h2>Quick Actions</h2>
        <div className="quick-links-grid">
          <Link to="/patients">Manage patients</Link>
          <Link to="/visits">Log a visit</Link>
          <Link to="/appointments">Schedule appointment</Link>
          <Link to="/care-timeline">Browse care timeline</Link>
          <Link to="/analytics">View analytics</Link>
          <Link to="/preventive-care">Preventive care queue</Link>
          <Link to="/risk-panel">Population risk panel</Link>
          <Link to="/system">Check replica health</Link>
        </div>
      </section>
    </div>
  )
}
