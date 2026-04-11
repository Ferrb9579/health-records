import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Patient } from '../types'

export function PatientsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
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
  const [gender, setGender] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [address, setAddress] = useState('')
  const [emergencyContactName, setEmergencyContactName] = useState('')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('')
  const [insuranceProvider, setInsuranceProvider] = useState('')
  const [allergies, setAllergies] = useState('')
  const [notes, setNotes] = useState('')

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
          gender,
          bloodType,
          address,
          emergencyContactName,
          emergencyContactPhone,
          insuranceProvider,
          allergies,
          notes,
        })
      } else {
        await api.createPatient({
          fullName: fullName.trim(),
          email,
          phone,
          dob,
          gender,
          bloodType,
          address,
          emergencyContactName,
          emergencyContactPhone,
          insuranceProvider,
          allergies,
          notes,
        })
      }

      setFullName('')
      setEmail('')
      setPhone('')
      setDob('')
      setGender('')
      setBloodType('')
      setAddress('')
      setEmergencyContactName('')
      setEmergencyContactPhone('')
      setInsuranceProvider('')
      setAllergies('')
      setNotes('')
      setEditingPatientId(null)
      await loadPatients(search)
      setSuccess(editingPatientId ? 'Patient updated successfully.' : 'Patient created successfully.')
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
    setGender(patient.gender || '')
    setBloodType(patient.blood_type || '')
    setAddress(patient.address || '')
    setEmergencyContactName(patient.emergency_contact_name || '')
    setEmergencyContactPhone(patient.emergency_contact_phone || '')
    setInsuranceProvider(patient.insurance_provider || '')
    setAllergies(patient.allergies || '')
    setNotes(patient.notes || '')
    setError('')
    setSuccess('')
  }

  function onCancelEditing() {
    setEditingPatientId(null)
    setFullName('')
    setEmail('')
    setPhone('')
    setDob('')
    setGender('')
    setBloodType('')
    setAddress('')
    setEmergencyContactName('')
    setEmergencyContactPhone('')
    setInsuranceProvider('')
    setAllergies('')
    setNotes('')
  }

  function onOpenProfile(patientId: number) {
    navigate(`/patients/${patientId}`)
  }

  async function onDeletePatient(patient: Patient) {
    if (!window.confirm(`Delete patient \"${patient.full_name}\"?`)) {
      return
    }

    setError('')
    setSuccess('')

    try {
      await api.deletePatient(patient.id)
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
            placeholder="Search by name, email, phone, address"
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
                  onClick={() => onOpenProfile(patient.id)}
                  className="click-row"
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
          <label>
            Gender
            <select value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="">Not specified</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Blood Type
            <select value={bloodType} onChange={(event) => setBloodType(event.target.value)}>
              <option value="">Unknown</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </label>
          <label>
            Address
            <input value={address} onChange={(event) => setAddress(event.target.value)} />
          </label>
          <label>
            Emergency Contact Name
            <input value={emergencyContactName} onChange={(event) => setEmergencyContactName(event.target.value)} />
          </label>
          <label>
            Emergency Contact Phone
            <input value={emergencyContactPhone} onChange={(event) => setEmergencyContactPhone(event.target.value)} />
          </label>
          <label>
            Insurance Provider
            <input value={insuranceProvider} onChange={(event) => setInsuranceProvider(event.target.value)} />
          </label>
          <label>
            Allergies
            <textarea value={allergies} onChange={(event) => setAllergies(event.target.value)} rows={2} />
          </label>
          <label>
            Clinical Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
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
        <p className="hint-text">Click any patient row to open the full profile page.</p>
      </section>
    </div>
  )
}
