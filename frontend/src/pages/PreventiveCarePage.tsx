import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { PreventiveCareEntry } from '../types'

function statusClass(status: PreventiveCareEntry['status']) {
  if (status === 'ok') {
    return 'status-ok'
  }

  if (status === 'soon') {
    return 'status-stale'
  }

  return 'status-danger'
}

export function PreventiveCarePage() {
  const [entries, setEntries] = useState<PreventiveCareEntry[]>([])
  const [daysThreshold, setDaysThreshold] = useState(180)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadPreventiveCare(filter = search) {
    setLoading(true)
    setError('')

    try {
      const result = await api.getPreventiveCare({
        days: daysThreshold,
        search: filter,
      })
      setEntries(result.data)
    } catch {
      setError('Unable to load preventive care queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPreventiveCare('')
  }, [daysThreshold])

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadPreventiveCare(search)
  }

  async function onClear() {
    setSearch('')
    await loadPreventiveCare('')
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Preventive Care Follow-up</h2>

        <form className="inline-form multiline" onSubmit={onSearch}>
          <label>
            Overdue threshold
            <select value={daysThreshold} onChange={(event) => setDaysThreshold(Number(event.target.value))}>
              <option value={90}>90 days</option>
              <option value={120}>120 days</option>
              <option value={180}>180 days</option>
              <option value={365}>365 days</option>
            </select>
          </label>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patient by name, email, or phone"
          />

          <button type="submit">Apply</button>
          <button type="button" className="ghost-button inline-ghost" onClick={() => void onClear()}>
            Clear
          </button>
        </form>

        {loading ? <p>Loading preventive care queue...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Last Visit</th>
                <th>Days Since</th>
                <th>Total Visits</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.full_name}</strong>
                    <div>{entry.email || entry.phone || 'No contact details'}</div>
                  </td>
                  <td>{entry.last_visit || 'Never'}</td>
                  <td>{entry.days_since_last_visit}</td>
                  <td>{entry.total_visits}</td>
                  <td>
                    <span className={`status-pill ${statusClass(entry.status)}`}>
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={5}>No patients found for current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
