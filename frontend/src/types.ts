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
  gender: string | null
  blood_type: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  insurance_provider: string | null
  allergies: string | null
  notes: string | null
  visits_count?: number
}

export type PatientDetails = {
  patient: Patient
  records: HealthRecord[]
}

export type Summary = {
  totalPatients: number
  totalVisits: number
  totalAppointments: number
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
  totalAppointments: number
}

export type HealthStatus = {
  status: string
  instance: string
  db: string
}

export type PreventiveCareEntry = {
  id: number
  full_name: string
  email: string | null
  phone: string | null
  last_visit: string | null
  days_since_last_visit: number | null
  total_visits: number
  status: 'ok' | 'soon' | 'due' | 'no-history'
}

export type RiskPatientEntry = {
  id: number
  full_name: string
  latest_diagnosis: string | null
  last_visit: string | null
  days_since_last_visit: number | null
  total_visits: number
  diagnosis_count: number
  risk_score: number
  risk_level: 'low' | 'medium' | 'high'
}

export type Appointment = {
  id: number
  patient_id: number | null
  patient_name: string
  appointment_date: string
  reason: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show'
  notes: string | null
}

export type CareTimelineEvent = {
  event_type: 'visit' | 'appointment'
  id: number
  patient_id: number | null
  patient_name: string
  event_date: string
  title: string
  status: string | null
  notes: string | null
}
