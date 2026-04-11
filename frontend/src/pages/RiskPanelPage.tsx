import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { RiskPatientEntry } from '../types'

type RiskLevelFilter = 'all' | 'high' | 'medium' | 'low'

function riskLevelValue(level: RiskPatientEntry['risk_level']) {
  if (level === 'high') {
    return 3
  }

  if (level === 'medium') {
    return 2
  }

  return 1
}

function riskClass(level: RiskPatientEntry['risk_level']) {
  if (level === 'high') {
    return 'status-danger'
  }

  if (level === 'medium') {
    return 'status-stale'
  }

  return 'status-ok'
}

export function RiskPanelPage() {
  const [entries, setEntries] = useState<RiskPatientEntry[]>([])
  const [riskFilter, setRiskFilter] = useState<RiskLevelFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadRiskPanel() {
    setLoading(true)
    setError('')

    try {
      const result = await api.getRiskPanel()
      setEntries(result.data)
    } catch {
      setError('Unable to load risk panel.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRiskPanel()
  }, [])

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      const searchMatch =
        !search.trim()
        || entry.full_name.toLowerCase().includes(search.trim().toLowerCase())
        || (entry.latest_diagnosis || '').toLowerCase().includes(search.trim().toLowerCase())

      if (!searchMatch) {
        return false
      }

      if (riskFilter === 'all') {
        return true
      }

      return entry.risk_level === riskFilter
    })
  }, [entries, riskFilter, search])

  const summary = useMemo(() => {
    const high = entries.filter((entry) => entry.risk_level === 'high').length
    const medium = entries.filter((entry) => entry.risk_level === 'medium').length
    const low = entries.filter((entry) => entry.risk_level === 'low').length

    return { high, medium, low }
  }, [entries])

  const sortedEntries = useMemo(() => {
    return [...visibleEntries].sort((a, b) => {
      if (a.risk_score !== b.risk_score) {
        return b.risk_score - a.risk_score
      }

      if (a.risk_level !== b.risk_level) {
        return riskLevelValue(b.risk_level) - riskLevelValue(a.risk_level)
      }

      return b.days_since_last_visit - a.days_since_last_visit
    })
  }, [visibleEntries])

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Population Risk Panel</h2>

        <div className="stats-row">
          <article>
            <h3>High Risk</h3>
            <p className="stat-value">{summary.high}</p>
          </article>
          <article>
            <h3>Medium Risk</h3>
            <p className="stat-value">{summary.medium}</p>
          </article>
          <article>
            <h3>Low Risk</h3>
            <p className="stat-value">{summary.low}</p>
          </article>
        </div>

        <div className="inline-form multiline">
          <label>
            Risk level
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskLevelFilter)}>
              <option value="all">All levels</option>
              <option value="high">High only</option>
              <option value="medium">Medium only</option>
              <option value="low">Low only</option>
            </select>
          </label>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patient or latest diagnosis"
          />

          <button type="button" className="ghost-button inline-ghost" onClick={() => void loadRiskPanel()}>
            Refresh panel
          </button>
        </div>

        {loading ? <p>Loading risk panel...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Risk</th>
                <th>Score</th>
                <th>Latest Diagnosis</th>
                <th>Last Visit</th>
                <th>Days Since</th>
                <th>Visits</th>
                <th>Dx Count</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.full_name}</td>
                    <td>
                      <span className={`status-pill ${riskClass(entry.risk_level)}`}>
                        {entry.risk_level}
                      </span>
                    </td>
                    <td>{entry.risk_score}</td>
                    <td>{entry.latest_diagnosis || '-'}</td>
                    <td>{entry.last_visit || 'Never'}</td>
                    <td>{entry.days_since_last_visit}</td>
                    <td>{entry.total_visits}</td>
                    <td>{entry.diagnosis_count}</td>
                  </tr>
                ))}
              {!loading && visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan={8}>No patients match your current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
