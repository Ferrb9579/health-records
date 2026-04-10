import { useEffect, useState } from 'react'
import { api } from '../api'
import type { HealthStatus, SystemStatus } from '../types'

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = seconds % 60
  return `${hours}h ${minutes}m ${remaining}s`
}

export function SystemPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [backendUpstream, setBackendUpstream] = useState('unknown')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadStatus() {
    setLoading(true)
    setError('')

    try {
      const [systemResult, healthResult] = await Promise.all([
        api.getSystemStatus(),
        api.getHealth(),
      ])

      setSystemStatus(systemResult.data)
      setHealthStatus(healthResult.data)
      setBackendUpstream(healthResult.headers.get('x-backend-upstream') ?? 'unknown')
    } catch {
      setError('Unable to fetch system status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>System Status</h2>
        <button type="button" onClick={() => void loadStatus()} className="ghost-button">Refresh status</button>

        {loading ? <p>Loading status...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {systemStatus ? (
          <div className="stats-row compact">
            <article>
              <h3>API Instance</h3>
              <p className="stat-value">{systemStatus.apiInstance}</p>
            </article>
            <article>
              <h3>Backend Upstream</h3>
              <p className="stat-value">{backendUpstream}</p>
            </article>
            <article>
              <h3>API Uptime</h3>
              <p className="stat-value">{formatDuration(systemStatus.apiUptimeSeconds)}</p>
            </article>
            <article>
              <h3>DB Uptime</h3>
              <p className="stat-value">{formatDuration(systemStatus.dbUptimeSeconds)}</p>
            </article>
            <article>
              <h3>Total Patients</h3>
              <p className="stat-value">{systemStatus.totalPatients}</p>
            </article>
            <article>
              <h3>Total Visits</h3>
              <p className="stat-value">{systemStatus.totalVisits}</p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Health Check</h2>
        {healthStatus ? (
          <ul className="status-list">
            <li><strong>Status:</strong> {healthStatus.status}</li>
            <li><strong>Instance:</strong> {healthStatus.instance}</li>
            <li><strong>Database:</strong> {healthStatus.db}</li>
          </ul>
        ) : (
          <p>Health check data not available.</p>
        )}
      </section>
    </div>
  )
}
