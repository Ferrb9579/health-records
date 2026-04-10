export type HealthRecord = {
  id: number
  patient_id: number | null
  patient_name: string
  diagnosis: string
  last_visit: string
}

export type Patient = {
  id: number
  full_name: string
  email: string | null
  phone: string | null
  dob: string | null
  visits_count?: number
}

export type PatientDetails = {
  patient: Patient
  records: HealthRecord[]
}

export type Summary = {
  totalPatients: number
  totalVisits: number
  diagnosisCount: number
  recentRecords: HealthRecord[]
}

export type DiagnosisStat = {
  diagnosis: string
  visits: number
}

export type DailyVisits = {
  day: string
  visits: number
}

export type SystemStatus = {
  apiInstance: string
  apiUptimeSeconds: number
  dbUptimeSeconds: number
  totalPatients: number
  totalVisits: number
}

export type HealthStatus = {
  status: string
  instance: string
  db: string
}
