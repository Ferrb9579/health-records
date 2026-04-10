import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { DailyVisits, DiagnosisStat } from '../types'

export function AnalyticsPage() {
  const [diagnosisStats, setDiagnosisStats] = useState<DiagnosisStat[]>([])
  const [dailyVisits, setDailyVisits] = useState<DailyVisits[]>([])
  const [days, setDays] = useState(14)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadAnalytics() {
    setLoading(true)
    setError('')

    try {
      const [diagnosesResult, visitsResult] = await Promise.all([
        api.getDiagnosisStats(),
        api.getVisitsByDay(days),
      ])

      setDiagnosisStats(diagnosesResult.data)
      setDailyVisits(visitsResult.data)
    } catch {
      setError('Unable to load analytics data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAnalytics()
  }, [days])

  const maxDiagnosis = useMemo(() => {
    return Math.max(...diagnosisStats.map((item) => item.visits), 1)
  }, [diagnosisStats])

  const maxDaily = useMemo(() => {
    return Math.max(...dailyVisits.map((item) => item.visits), 1)
  }, [dailyVisits])

  return (
    <div className="page-grid split-grid">
      <section className="panel">
        <h2>Diagnosis Distribution</h2>
        {loading ? <p>Loading analytics...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="bar-list">
          {diagnosisStats.map((item) => (
            <article key={item.diagnosis}>
              <div className="bar-head">
                <span>{item.diagnosis}</span>
                <strong>{item.visits}</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(item.visits / maxDiagnosis) * 100}%` }} />
              </div>
            </article>
          ))}
          {!loading && diagnosisStats.length === 0 ? <p>No diagnosis data yet.</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Visits Trend</h2>
        <div className="inline-form">
          <label>
            Days window
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </label>
        </div>

        <div className="bar-list">
          {dailyVisits.map((item) => (
            <article key={item.day}>
              <div className="bar-head">
                <span>{item.day}</span>
                <strong>{item.visits}</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill alt" style={{ width: `${(item.visits / maxDaily) * 100}%` }} />
              </div>
            </article>
          ))}
          {!loading && dailyVisits.length === 0 ? <p>No visit trend data in selected window.</p> : null}
        </div>
      </section>
    </div>
  )
}
