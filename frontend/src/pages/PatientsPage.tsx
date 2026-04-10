import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { Patient, PatientDetails } from '../types'

export function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientDetails | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
    } catch {
      setError('Unable to load selected patient details.')
    }
  }

  useEffect(() => {
    void loadPatients('')
  }, [])

  const visiblePatients = useMemo(() => patients, [patients])

  async function onCreatePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await api.createPatient({
        fullName: fullName.trim(),
        email,
        phone,
        dob,
      })

      setFullName('')
      setEmail('')
      setPhone('')
      setDob('')
      await loadPatients(search)
    } catch {
      setError('Failed to create patient.')
    } finally {
      setSaving(false)
    }
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadPatients(search)
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
        </form>

        {loading ? <p>Loading patients...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Visits</th>
              </tr>
            </thead>
            <tbody>
              {visiblePatients.map((patient) => (
                <tr key={patient.id} onClick={() => void loadPatientDetails(patient.id)} className="click-row">
                  <td>{patient.full_name}</td>
                  <td>{patient.email || '-'}</td>
                  <td>{patient.phone || '-'}</td>
                  <td>{patient.visits_count ?? 0}</td>
                </tr>
              ))}
              {!loading && visiblePatients.length === 0 ? (
                <tr>
                  <td colSpan={4}>No patients found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack-panel">
        <h2>Create Patient</h2>
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
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Patient'}</button>
        </form>

        <h2>Selected Patient</h2>
        {selectedPatient ? (
          <div>
            <p><strong>{selectedPatient.patient.full_name}</strong></p>
            <p>{selectedPatient.patient.email || 'No email'}</p>
            <p>{selectedPatient.patient.phone || 'No phone'}</p>
            <p>DOB: {selectedPatient.patient.dob || '-'}</p>
            <p>Total visits: {selectedPatient.records.length}</p>
          </div>
        ) : (
          <p>Select a patient row to see details.</p>
        )}
      </section>
    </div>
  )
}
