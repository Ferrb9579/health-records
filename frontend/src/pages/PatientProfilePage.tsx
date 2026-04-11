import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { PatientDetails } from '../types'

export function PatientProfilePage() {
  const params = useParams<{ id: string }>()
  const patientId = Number(params.id)

  const [details, setDetails] = useState<PatientDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!Number.isInteger(patientId) || patientId <= 0) {
        setError('Invalid patient id.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const result = await api.getPatientDetails(patientId)
        setDetails(result.data)
      } catch {
        setError('Unable to load patient profile.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [patientId])

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="inline-form">
          <Link className="nav-link" to="/patients">Back to Patients</Link>
        </div>

        {loading ? <p>Loading patient profile...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {details ? (
          <>
            <h2>{details.patient.full_name}</h2>
            <div className="stats-row compact">
              <article>
                <h3>Email</h3>
                <p className="stat-value">{details.patient.email || '-'}</p>
              </article>
              <article>
                <h3>Phone</h3>
                <p className="stat-value">{details.patient.phone || '-'}</p>
              </article>
              <article>
                <h3>DOB</h3>
                <p className="stat-value">{details.patient.dob || '-'}</p>
              </article>
              <article>
                <h3>Gender</h3>
                <p className="stat-value">{details.patient.gender || '-'}</p>
              </article>
              <article>
                <h3>Blood Type</h3>
                <p className="stat-value">{details.patient.blood_type || '-'}</p>
              </article>
              <article>
                <h3>Total Visits</h3>
                <p className="stat-value">{details.records.length}</p>
              </article>
            </div>

            <div className="panel" style={{ marginTop: '0.9rem' }}>
              <h2>Clinical Profile</h2>
              <p><strong>Address:</strong> {details.patient.address || '-'}</p>
              <p><strong>Emergency Contact:</strong> {details.patient.emergency_contact_name || '-'} / {details.patient.emergency_contact_phone || '-'}</p>
              <p><strong>Insurance:</strong> {details.patient.insurance_provider || '-'}</p>
              <p><strong>Allergies:</strong> {details.patient.allergies || '-'}</p>
              <p><strong>Notes:</strong> {details.patient.notes || '-'}</p>
            </div>

            <h2>Visit Timeline</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Diagnosis</th>
                  </tr>
                </thead>
                <tbody>
                  {details.records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.last_visit}</td>
                      <td>{record.diagnosis}</td>
                    </tr>
                  ))}
                  {!details.records.length ? (
                    <tr>
                      <td colSpan={2}>No visits recorded yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}
