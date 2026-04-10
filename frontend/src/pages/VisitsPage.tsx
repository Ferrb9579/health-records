import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { HealthRecord, Patient } from '../types'

export function VisitsPage() {
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [diagnosisFilter, setDiagnosisFilter] = useState('')
  const [patientFilter, setPatientFilter] = useState('')

  const [patientId, setPatientId] = useState('')
  const [patientName, setPatientName] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [lastVisit, setLastVisit] = useState('')

  async function loadPatients() {
    const result = await api.getPatients()
    setPatients(result.data)
  }

  async function loadRecords() {
    setLoading(true)
    setError('')

    try {
      const result = await api.getRecords({
        search,
        diagnosis: diagnosisFilter,
        patientId: patientFilter ? Number(patientFilter) : undefined,
      })
      setRecords(result.data)
    } catch {
      setError('Unable to load visits.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPatients()
    void loadRecords()
  }, [])

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadRecords()
  }

  async function onCreateVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!diagnosis.trim() || !lastVisit.trim()) {
      setError('Diagnosis and last visit date are required.')
      return
    }

    if (!patientId && !patientName.trim()) {
      setError('Choose existing patient or provide patient name.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await api.createRecord({
        patientId: patientId ? Number(patientId) : undefined,
        patientName: patientName.trim() || undefined,
        diagnosis: diagnosis.trim(),
        lastVisit,
      })

      setPatientName('')
      setDiagnosis('')
      setLastVisit('')
      await loadRecords()
      await loadPatients()
    } catch {
      setError('Failed to create visit record.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-grid split-grid">
      <section className="panel">
        <h2>Visit Records</h2>

        <form className="inline-form multiline" onSubmit={onFilter}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search diagnosis or patient"
          />
          <input
            value={diagnosisFilter}
            onChange={(event) => setDiagnosisFilter(event.target.value)}
            placeholder="Filter diagnosis"
          />
          <select value={patientFilter} onChange={(event) => setPatientFilter(event.target.value)}>
            <option value="">All patients</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.full_name}</option>
            ))}
          </select>
          <button type="submit">Apply Filters</button>
        </form>

        {loading ? <p>Loading visits...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Visit Date</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>{record.patient_name}</td>
                  <td>{record.diagnosis}</td>
                  <td>{record.last_visit}</td>
                </tr>
              ))}
              {!loading && records.length === 0 ? (
                <tr>
                  <td colSpan={4}>No visits found for current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Log New Visit</h2>
        <form className="record-form" onSubmit={onCreateVisit}>
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
            <input
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
              placeholder="Use only if patient is not listed"
            />
          </label>

          <label>
            Diagnosis
            <input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
          </label>

          <label>
            Last Visit Date
            <input type="date" value={lastVisit} onChange={(event) => setLastVisit(event.target.value)} />
          </label>

          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Visit'}</button>
        </form>
      </section>
    </div>
  )
}
