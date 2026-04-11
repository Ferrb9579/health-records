import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { CareTimelineEvent, Patient } from '../types'

type EventFilter = '' | 'visit' | 'appointment'

function eventClass(event: CareTimelineEvent) {
  if (event.event_type === 'visit') {
    return 'status-ok'
  }

  if (event.status === 'scheduled') {
    return 'status-stale'
  }

  if (event.status === 'completed') {
    return 'status-ok'
  }

  return 'status-danger'
}

export function CareTimelinePage() {
  const navigate = useNavigate()

  const [events, setEvents] = useState<CareTimelineEvent[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [patientFilter, setPatientFilter] = useState('')
  const [eventFilter, setEventFilter] = useState<EventFilter>('')

  async function loadPatients() {
    const result = await api.getPatients()
    setPatients(result.data)
  }

  async function loadTimeline() {
    setLoading(true)
    setError('')

    try {
      const result = await api.getCareTimeline({
        patientId: patientFilter ? Number(patientFilter) : undefined,
        eventType: eventFilter || undefined,
      })
      setEvents(result.data)
    } catch {
      setError('Unable to load care timeline.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPatients()
    void loadTimeline()
  }, [])

  const groupedByType = useMemo(() => {
    const visits = events.filter((event) => event.event_type === 'visit').length
    const appointments = events.filter((event) => event.event_type === 'appointment').length
    return { visits, appointments }
  }, [events])

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Care Timeline</h2>

        <div className="stats-row compact">
          <article>
            <h3>Visit Events</h3>
            <p className="stat-value">{groupedByType.visits}</p>
          </article>
          <article>
            <h3>Appointment Events</h3>
            <p className="stat-value">{groupedByType.appointments}</p>
          </article>
        </div>

        <form
          className="inline-form multiline"
          onSubmit={(event) => {
            event.preventDefault()
            void loadTimeline()
          }}
        >
          <select value={patientFilter} onChange={(event) => setPatientFilter(event.target.value)}>
            <option value="">All patients</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.full_name}</option>
            ))}
          </select>

          <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value as EventFilter)}>
            <option value="">All event types</option>
            <option value="visit">Visits only</option>
            <option value="appointment">Appointments only</option>
          </select>

          <button type="submit">Apply</button>
          <button
            type="button"
            className="ghost-button inline-ghost"
            onClick={() => {
              setPatientFilter('')
              setEventFilter('')
              void loadTimeline()
            }}
          >
            Clear
          </button>
        </form>

        {loading ? <p>Loading timeline...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Patient</th>
                <th>Summary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={`${event.event_type}-${event.id}`}
                  className={event.patient_id ? 'click-row' : ''}
                  onClick={() => {
                    if (event.patient_id) {
                      navigate(`/patients/${event.patient_id}`)
                    }
                  }}
                >
                  <td>{event.event_date}</td>
                  <td>{event.event_type}</td>
                  <td>{event.patient_name}</td>
                  <td>
                    <strong>{event.title}</strong>
                    <div>{event.notes || '-'}</div>
                  </td>
                  <td>
                    <span className={`status-pill ${eventClass(event)}`}>
                      {event.status || 'completed'}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && events.length === 0 ? (
                <tr>
                  <td colSpan={5}>No timeline events found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
