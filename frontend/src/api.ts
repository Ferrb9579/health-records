import type {
  DailyVisits,
  DiagnosisStat,
  HealthRecord,
  HealthStatus,
  Patient,
  PatientDetails,
  Summary,
  SystemStatus,
} from './types'

async function request<T>(path: string, options?: RequestInit): Promise<{ data: T; headers: Headers }> {
  const response = await fetch(path, options)

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Request failed')
  }

  return {
    data: (await response.json()) as T,
    headers: response.headers,
  }
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return
    }

    search.set(key, String(value))
  })

  const query = search.toString()
  return query ? `?${query}` : ''
}

export const api = {
  async getSummary() {
    return request<Summary>('/api/summary')
  },

  async getHealth() {
    return request<HealthStatus>('/api/health')
  },

  async getSystemStatus() {
    return request<SystemStatus>('/api/system/status')
  },

  async getPatients(search?: string) {
    return request<Patient[]>(`/api/patients${buildQuery({ search })}`)
  },

  async getPatientDetails(id: number) {
    return request<PatientDetails>(`/api/patients/${id}`)
  },

  async createPatient(payload: {
    fullName: string
    email?: string
    phone?: string
    dob?: string
  }) {
    return request<Patient>('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },

  async getRecords(filters?: {
    search?: string
    diagnosis?: string
    patientId?: number
    limit?: number
  }) {
    return request<HealthRecord[]>(`/api/records${buildQuery(filters ?? {})}`)
  },

  async createRecord(payload: {
    patientName?: string
    patientId?: number
    diagnosis: string
    lastVisit: string
  }) {
    return request<HealthRecord>('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },

  async getDiagnosisStats() {
    return request<DiagnosisStat[]>('/api/analytics/diagnoses')
  },

  async getVisitsByDay(days = 14) {
    return request<DailyVisits[]>(`/api/analytics/visits-by-day${buildQuery({ days })}`)
  },
}
