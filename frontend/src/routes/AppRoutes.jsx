import { Routes, Route, Navigate } from 'react-router-dom'
import Login                  from '../pages/Login'
import Register               from '../pages/Register'
import PatientDashboard       from '../pages/PatientDashboard'
import DoctorDashboard        from '../pages/DoctorDashboard'
import HospitalAdminDashboard from '../pages/HospitalAdminDashboard'
import AppointmentFlow        from '../pages/AppointmentFlow'
import CaregiverDashboard     from '../pages/CaregiverDashboard'
import CaregiverAuditLogs    from '../pages/CaregiverAuditLogs'
import EmergencyQRPage        from '../pages/EmergencyQRPage'
import UploadPrescription     from '../pages/UploadPrescription'
import MedicalTimeline        from '../pages/MedicalTimeline'
import AccessRequests         from '../pages/AccessRequests'
import DrugAlertPage          from '../pages/DrugAlertPage'
import AuditLogs              from '../pages/AuditLogs'
import FaceRegister           from '../pages/FaceRegister'
import FaceScanEmergency      from '../pages/FaceScanEmergency'
import Navbar                 from '../components/Navbar'
import Sidebar                from '../components/Sidebar'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 min-w-0 max-w-full overflow-x-hidden">
          <div className="max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

function Guard({ children, roles }) {
  const token = localStorage.getItem('token')
  const user  = JSON.parse(localStorage.getItem('user') || '{}')
  if (!token) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) {
    // Redirect to correct home for the logged-in role instead of login
    const home = {
      patient:        '/patient',
      doctor:         '/doctor',
      hospital_admin: '/admin',
      caregiver:      '/caregiver',
    }
    return <Navigate to={home[user.role] || '/login'} replace />
  }
  return <Layout>{children}</Layout>
}

function RoleRedirect() {
  const token = localStorage.getItem('token')
  const user  = JSON.parse(localStorage.getItem('user') || '{}')
  if (!token) return <Navigate to="/login" replace />
  const home = {
    patient:        '/patient',
    doctor:         '/doctor',
    hospital_admin: '/admin',
    caregiver:      '/caregiver',
  }
  return <Navigate to={home[user.role] || '/login'} replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* ── Public (login/register only — no public face scan) ── */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ── Patient ─────────────────────────────────────────────
          NO prescription upload — only doctors/hospitals can upload
          Face scanner is ONLY for hospital/doctor side
      ── */}
      <Route path="/patient"                 element={<Guard roles={['patient']}><PatientDashboard /></Guard>} />
      <Route path="/patient/history"         element={<Guard roles={['patient']}><MedicalTimeline /></Guard>} />
      <Route path="/patient/drug-alerts"     element={<Guard roles={['patient']}><DrugAlertPage /></Guard>} />
      <Route path="/patient/access-requests" element={<Guard roles={['patient']}><AccessRequests /></Guard>} />
      <Route path="/patient/emergency-qr"    element={<Guard roles={['patient']}><EmergencyQRPage /></Guard>} />
      <Route path="/patient/face-id"         element={<Guard roles={['patient']}><FaceRegister /></Guard>} />

      {/* ── Doctor ──────────────────────────────────────────────
          Doctor CAN upload prescriptions
          Doctor CAN use Emergency Face Scan
      ── */}
      <Route path="/doctor"           element={<Guard roles={['doctor']}><DoctorDashboard /></Guard>} />
      <Route path="/doctor/upload"    element={<Guard roles={['doctor']}><UploadPrescription /></Guard>} />
      <Route path="/doctor/alerts"    element={<Guard roles={['doctor']}><DrugAlertPage /></Guard>} />
      <Route path="/doctor/face-scan" element={<Guard roles={['doctor']}><FaceScanEmergency /></Guard>} />

      {/* ── Hospital Admin ───────────────────────────────────────
          Admin CAN use Emergency Face Scan
      ── */}
      <Route path="/admin"                     element={<Guard roles={['hospital_admin']}><HospitalAdminDashboard /></Guard>} />
      <Route path="/admin/appointments"         element={<Guard roles={['hospital_admin']}><AppointmentFlow /></Guard>} />
      <Route path="/admin/audit"               element={<Guard roles={['hospital_admin']}><AuditLogs /></Guard>} />
      <Route path="/admin/security"            element={<Guard roles={['hospital_admin']}><HospitalAdminDashboard tab="security" /></Guard>} />
      <Route path="/admin/doctors"             element={<Guard roles={['hospital_admin']}><HospitalAdminDashboard tab="doctors" /></Guard>} />
      <Route path="/admin/emergency-identify"  element={<Guard roles={['hospital_admin']}><FaceScanEmergency /></Guard>} />

      {/* ── Caregiver ────────────────────────────────────────── */}
      <Route path="/caregiver"               element={<Guard roles={['caregiver']}><CaregiverDashboard /></Guard>} />
      <Route path="/caregiver/patients"      element={<Guard roles={['caregiver']}><CaregiverDashboard section="patients" /></Guard>} />
      <Route path="/caregiver/drug-alerts"   element={<Guard roles={['caregiver']}><DrugAlertPage /></Guard>} />
      <Route path="/caregiver/appointments"  element={<Guard roles={['caregiver']}><AppointmentFlow /></Guard>} />
      <Route path="/caregiver/emergency-qr"  element={<Guard roles={['caregiver']}><EmergencyQRPage /></Guard>} />
      <Route path="/caregiver/audit"         element={<Guard roles={['caregiver']}><CaregiverAuditLogs /></Guard>} />
      <Route path="/caregiver/requests"      element={<Guard roles={['caregiver']}><AccessRequests /></Guard>} />

      <Route path="/" element={<RoleRedirect />} />
      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  )
}
