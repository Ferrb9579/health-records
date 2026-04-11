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
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshSeconds, setRefreshSeconds] = useState(15)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
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
      setLastUpdatedAt(new Date())
    } catch {
      setError('Unable to fetch system status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  useEffect(() => {
    if (!autoRefresh) {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadStatus()
    }, refreshSeconds * 1000)

    return () => window.clearInterval(intervalId)
  }, [autoRefresh, refreshSeconds])

  const isFresh = lastUpdatedAt ? (Date.now() - lastUpdatedAt.getTime()) / 1000 < refreshSeconds * 2 : false

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>System Status</h2>
        <div className="inline-form system-controls">
          <button type="button" onClick={() => void loadStatus()} className="ghost-button">Refresh status</button>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            Auto-refresh
          </label>
          <label className="refresh-label">
            Interval
            <select
              value={refreshSeconds}
              onChange={(event) => setRefreshSeconds(Number(event.target.value))}
              disabled={!autoRefresh}
            >
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
            </select>
          </label>
        </div>

        {loading ? <p>Loading status...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {lastUpdatedAt ? (
          <p className={`status-pill ${isFresh ? 'status-ok' : 'status-stale'}`}>
            Last updated: {lastUpdatedAt.toLocaleTimeString()} ({isFresh ? 'fresh' : 'stale'})
          </p>
        ) : null}

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
            <article>
              <h3>Total Appointments</h3>
              <p className="stat-value">{systemStatus.totalAppointments}</p>
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
