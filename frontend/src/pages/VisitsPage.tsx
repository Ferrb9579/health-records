import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { HealthRecord, Patient } from '../types'

export function VisitsPage() {
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  useEffect(() => {
    if (!success) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSuccess('')
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [success])

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadRecords()
  }

  async function onClearFilters() {
    setSearch('')
    setDiagnosisFilter('')
    setPatientFilter('')
    setError('')

    setLoading(true)
    try {
      const result = await api.getRecords()
      setRecords(result.data)
    } catch {
      setError('Unable to load visits.')
    } finally {
      setLoading(false)
    }
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
    setSuccess('')

    try {
      if (editingRecordId) {
        await api.updateRecord(editingRecordId, {
          patientId: patientId ? Number(patientId) : undefined,
          patientName: patientName.trim() || undefined,
          diagnosis: diagnosis.trim(),
          lastVisit,
        })
      } else {
        await api.createRecord({
          patientId: patientId ? Number(patientId) : undefined,
          patientName: patientName.trim() || undefined,
          diagnosis: diagnosis.trim(),
          lastVisit,
        })
      }

      setPatientId('')
      setPatientName('')
      setDiagnosis('')
      setLastVisit('')
      setEditingRecordId(null)
      await loadRecords()
      await loadPatients()
      setSuccess(editingRecordId ? 'Visit record updated successfully.' : 'Visit record created successfully.')
    } catch {
      setError(editingRecordId ? 'Failed to update visit record.' : 'Failed to create visit record.')
    } finally {
      setSaving(false)
    }
  }

  function onEditRecord(record: HealthRecord) {
    setEditingRecordId(record.id)
    setPatientId(record.patient_id ? String(record.patient_id) : '')
    setPatientName(record.patient_id ? '' : record.patient_name)
    setDiagnosis(record.diagnosis)
    setLastVisit(record.last_visit)
    setError('')
    setSuccess('')
  }

  function onCancelEditing() {
    setEditingRecordId(null)
    setPatientId('')
    setPatientName('')
    setDiagnosis('')
    setLastVisit('')
  }

  async function onDeleteRecord(record: HealthRecord) {
    if (!window.confirm(`Delete visit record #${record.id}?`)) {
      return
    }

    setError('')
    setSuccess('')

    try {
      await api.deleteRecord(record.id)
      if (editingRecordId === record.id) {
        onCancelEditing()
      }
      await loadRecords()
      await loadPatients()
      setSuccess('Visit record deleted successfully.')
    } catch {
      setError('Failed to delete visit record.')
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
          <button type="button" className="ghost-button inline-ghost" onClick={() => void onClearFilters()}>
            Clear
          </button>
        </form>

        {search || diagnosisFilter || patientFilter ? (
          <p className="filter-chip">
            Active filters:{' '}
            {[search ? `text: ${search}` : '', diagnosisFilter ? `diagnosis: ${diagnosisFilter}` : '', patientFilter ? `patient id: ${patientFilter}` : '']
              .filter(Boolean)
              .join(' | ')}
          </p>
        ) : null}

        {loading ? <p>Loading visits...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Visit Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>{record.patient_name}</td>
                  <td>{record.diagnosis}</td>
                  <td>{record.last_visit}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="ghost-button inline-ghost"
                        onClick={() => onEditRecord(record)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost-button inline-ghost danger-button"
                        onClick={() => void onDeleteRecord(record)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && records.length === 0 ? (
                <tr>
                  <td colSpan={5}>No visits found for current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>{editingRecordId ? 'Edit Visit' : 'Log New Visit'}</h2>
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
          <p className="hint-text">Tip: pick an existing patient first for cleaner records.</p>

          <label>
            Diagnosis
            <input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
          </label>

          <label>
            Last Visit Date
            <input type="date" value={lastVisit} onChange={(event) => setLastVisit(event.target.value)} />
          </label>

          <div className="row-actions">
            <button type="submit" disabled={saving}>{saving ? 'Saving...' : editingRecordId ? 'Update Visit' : 'Create Visit'}</button>
            {editingRecordId ? (
              <button type="button" className="ghost-button inline-ghost" onClick={onCancelEditing}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  )
}
