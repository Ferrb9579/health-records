import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './components/Layout'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { DashboardPage } from './pages/DashboardPage'
import { PatientsPage } from './pages/PatientsPage'
import { PreventiveCarePage } from './pages/PreventiveCarePage'
import { RiskPanelPage } from './pages/RiskPanelPage'
import { SystemPage } from './pages/SystemPage'
import { VisitsPage } from './pages/VisitsPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/visits" element={<VisitsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/preventive-care" element={<PreventiveCarePage />} />
        <Route path="/risk-panel" element={<RiskPanelPage />} />
        <Route path="/system" element={<SystemPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
