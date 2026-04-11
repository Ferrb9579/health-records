import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { Patient, PatientDetails } from '../types'

export function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientDetails | null>(null)
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')

  async function loadPatients(filter = search) {
    setLoading(true)
    setError('')

    try {
      const result = await api.getPatients(filter)
      setPatients(result.data)
    } catch {
      setError('Unable to load patient list.')
    } finally {
      setLoading(false)
    }
  }

  async function loadPatientDetails(patientId: number) {
    setError('')

    try {
      const result = await api.getPatientDetails(patientId)
      setSelectedPatient(result.data)
      setSelectedPatientId(patientId)
    } catch {
      setError('Unable to load selected patient details.')
    }
  }

  useEffect(() => {
    void loadPatients('')
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPatients(search)
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    if (!success) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSuccess('')
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [success])

  const visiblePatients = useMemo(() => patients, [patients])

  async function onCreatePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (editingPatientId) {
        await api.updatePatient(editingPatientId, {
          fullName: fullName.trim(),
          email,
          phone,
          dob,
        })
      } else {
        await api.createPatient({
          fullName: fullName.trim(),
          email,
          phone,
          dob,
        })
      }

      setFullName('')
      setEmail('')
      setPhone('')
      setDob('')
      setEditingPatientId(null)
      await loadPatients(search)
      setSuccess(editingPatientId ? 'Patient updated successfully.' : 'Patient created successfully.')
      if (selectedPatientId) {
        await loadPatientDetails(selectedPatientId)
      }
    } catch {
      setError(editingPatientId ? 'Failed to update patient.' : 'Failed to create patient.')
    } finally {
      setSaving(false)
    }
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadPatients(search)
  }

  async function onClearFilters() {
    setSearch('')
    await loadPatients('')
  }

  function onEditPatient(patient: Patient) {
    setEditingPatientId(patient.id)
    setFullName(patient.full_name)
    setEmail(patient.email || '')
    setPhone(patient.phone || '')
    setDob(patient.dob || '')
    setError('')
    setSuccess('')
  }

  function onCancelEditing() {
    setEditingPatientId(null)
    setFullName('')
    setEmail('')
    setPhone('')
    setDob('')
  }

  async function onDeletePatient(patient: Patient) {
    if (!window.confirm(`Delete patient \"${patient.full_name}\"?`)) {
      return
    }

    setError('')
    setSuccess('')

    try {
      await api.deletePatient(patient.id)
      if (selectedPatientId === patient.id) {
        setSelectedPatient(null)
        setSelectedPatientId(null)
      }
      if (editingPatientId === patient.id) {
        onCancelEditing()
      }
      await loadPatients(search)
      setSuccess('Patient deleted successfully.')
    } catch {
      setError('Failed to delete patient.')
    }
  }

  return (
    <div className="page-grid split-grid">
      <section className="panel">
        <h2>Patient Directory</h2>

        <form className="inline-form" onSubmit={onSearch}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, phone"
          />
          <button type="submit">Search</button>
          <button type="button" className="ghost-button inline-ghost" onClick={() => void onClearFilters()}>
            Clear
          </button>
        </form>

        {search.trim() ? <p className="filter-chip">Active filter: {search.trim()}</p> : null}

        {loading ? <p>Loading patients...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Visits</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePatients.map((patient) => (
                <tr
                  key={patient.id}
                  onClick={() => void loadPatientDetails(patient.id)}
                  className={`click-row ${selectedPatientId === patient.id ? 'selected-row' : ''}`}
                >
                  <td>{patient.full_name}</td>
                  <td>{patient.email || '-'}</td>
                  <td>{patient.phone || '-'}</td>
                  <td>{patient.visits_count ?? 0}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="ghost-button inline-ghost"
                        onClick={(event) => {
                          event.stopPropagation()
                          onEditPatient(patient)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost-button inline-ghost danger-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void onDeletePatient(patient)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visiblePatients.length === 0 ? (
                <tr>
                  <td colSpan={5}>No patients found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack-panel">
        <h2>{editingPatientId ? 'Edit Patient' : 'Create Patient'}</h2>
        <form className="record-form" onSubmit={onCreatePatient}>
          <label>
            Full Name
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label>
            Date of Birth
            <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
          </label>
          <div className="row-actions">
            <button type="submit" disabled={saving}>{saving ? 'Saving...' : editingPatientId ? 'Update Patient' : 'Create Patient'}</button>
            {editingPatientId ? (
              <button type="button" className="ghost-button inline-ghost" onClick={onCancelEditing}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <h2>Selected Patient</h2>
        {selectedPatient ? (
          <div>
            <p><strong>{selectedPatient.patient.full_name}</strong></p>
            <p>{selectedPatient.patient.email || 'No email'}</p>
            <p>{selectedPatient.patient.phone || 'No phone'}</p>
            <p>DOB: {selectedPatient.patient.dob || '-'}</p>
            <p>Total visits: {selectedPatient.records.length}</p>

            <h3 className="subsection-title">Visit Timeline</h3>
            {selectedPatient.records.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPatient.records.map((record) => (
                      <tr key={record.id}>
                        <td>{record.last_visit}</td>
                        <td>{record.diagnosis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No visits recorded for this patient.</p>
            )}
          </div>
        ) : (
          <p>Select a patient row to see details.</p>
        )}
      </section>
    </div>
  )
}
