import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Appointment, Patient } from '../types'

type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show'

function statusClass(status: AppointmentStatus) {
  if (status === 'completed') {
    return 'status-ok'
  }

  if (status === 'scheduled') {
    return 'status-stale'
  }

  return 'status-danger'
}

export function AppointmentsPage() {
  const navigate = useNavigate()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [patientFilter, setPatientFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [patientId, setPatientId] = useState('')
  const [patientName, setPatientName] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<AppointmentStatus>('scheduled')
  const [notes, setNotes] = useState('')

  async function loadPatients() {
    const result = await api.getPatients()
    setPatients(result.data)
  }

  async function loadAppointments() {
    setLoading(true)
    setError('')

    try {
      const result = await api.getAppointments({
        search,
        status: statusFilter || undefined,
        patientId: patientFilter ? Number(patientFilter) : undefined,
        fromDate,
        toDate,
      })
      setAppointments(result.data)
    } catch {
      setError('Unable to load appointments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPatients()
    void loadAppointments()
  }, [])

  useEffect(() => {
    if (!success) {
      return
    }

    const timeoutId = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timeoutId)
  }, [success])

  async function onApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadAppointments()
  }

  async function onClearFilters() {
    setSearch('')
    setStatusFilter('')
    setPatientFilter('')
    setFromDate('')
    setToDate('')

    setLoading(true)
    setError('')

    try {
      const result = await api.getAppointments()
      setAppointments(result.data)
    } catch {
      setError('Unable to load appointments.')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setEditingId(null)
    setPatientId('')
    setPatientName('')
    setAppointmentDate('')
    setReason('')
    setStatus('scheduled')
    setNotes('')
  }

  function onEdit(appointment: Appointment) {
    setEditingId(appointment.id)
    setPatientId(appointment.patient_id ? String(appointment.patient_id) : '')
    setPatientName(appointment.patient_id ? '' : appointment.patient_name)
    setAppointmentDate(appointment.appointment_date)
    setReason(appointment.reason)
    setStatus(appointment.status)
    setNotes(appointment.notes || '')
    setError('')
    setSuccess('')
  }

  async function onDelete(appointment: Appointment) {
    if (!window.confirm(`Delete appointment #${appointment.id}?`)) {
      return
    }

    setError('')
    setSuccess('')

    try {
      await api.deleteAppointment(appointment.id)
      if (editingId === appointment.id) {
        resetForm()
      }
      await loadAppointments()
      setSuccess('Appointment deleted.')
    } catch {
      setError('Failed to delete appointment.')
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!appointmentDate || !reason.trim()) {
      setError('Appointment date and reason are required.')
      return
    }

    if (!patientId && !patientName.trim()) {
      setError('Choose a patient or provide patient name.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    const payload = {
      patientId: patientId ? Number(patientId) : undefined,
      patientName: patientName.trim() || undefined,
      appointmentDate,
      reason: reason.trim(),
      status,
      notes: notes.trim() || undefined,
    }

    try {
      if (editingId) {
        await api.updateAppointment(editingId, payload)
      } else {
        await api.createAppointment(payload)
      }

      resetForm()
      await loadAppointments()
      await loadPatients()
      setSuccess(editingId ? 'Appointment updated.' : 'Appointment created.')
    } catch {
      setError(editingId ? 'Failed to update appointment.' : 'Failed to create appointment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-grid split-grid">
      <section className="panel">
        <h2>Appointments</h2>

        <form className="inline-form multiline" onSubmit={onApplyFilters}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reason, notes, patient" />

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No-show</option>
          </select>

          <select value={patientFilter} onChange={(event) => setPatientFilter(event.target.value)}>
            <option value="">All patients</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.full_name}</option>
            ))}
          </select>

          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />

          <button type="submit">Apply</button>
          <button type="button" className="ghost-button inline-ghost" onClick={() => void onClearFilters()}>
            Clear
          </button>
        </form>

        {loading ? <p>Loading appointments...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr
                  key={appointment.id}
                  className={appointment.patient_id ? 'click-row' : ''}
                  onClick={() => {
                    if (appointment.patient_id) {
                      navigate(`/patients/${appointment.patient_id}`)
                    }
                  }}
                >
                  <td>{appointment.appointment_date}</td>
                  <td>{appointment.patient_name}</td>
                  <td>{appointment.reason}</td>
                  <td>
                    <span className={`status-pill ${statusClass(appointment.status)}`}>{appointment.status}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="ghost-button inline-ghost"
                        onClick={(event) => {
                          event.stopPropagation()
                          onEdit(appointment)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost-button inline-ghost danger-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void onDelete(appointment)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && appointments.length === 0 ? (
                <tr>
                  <td colSpan={5}>No appointments found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>{editingId ? 'Edit Appointment' : 'Schedule Appointment'}</h2>

        <form className="record-form" onSubmit={onSave}>
          <label>
            Existing Patient
            <select value={patientId} onChange={(event) => setPatientId(event.target.value)}>
              <option value="">Select patient (optional)</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>{patient.full_name}</option>
              ))}
            </select>
          </label>

          <label>
            New Patient Name
            <input value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="Use if patient is not listed" />
          </label>

          <label>
            Appointment Date
            <input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} />
          </label>

          <label>
            Reason
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>

          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus)}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no-show">No-show</option>
            </select>
          </label>

          <label>
            Notes
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          <div className="row-actions">
            <button type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Appointment' : 'Create Appointment'}</button>
            {editingId ? (
              <button type="button" className="ghost-button inline-ghost" onClick={resetForm}>Cancel</button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  )
}
