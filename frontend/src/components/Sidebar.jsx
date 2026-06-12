import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, QrCode, AlertTriangle,
  Clock, ShieldCheck, Activity, UserCheck, Heart,
  ChevronRight, ScanFace, CalendarCheck
} from 'lucide-react'

const NAV = {
  // Patient: NO prescription upload (hospital/doctor only), NO face scanner
  patient: [
    { to: '/patient',                  label: 'Dashboard',         icon: LayoutDashboard, exact: true },
    { to: '/patient/history',          label: 'Medical History',   icon: Clock },
    { to: '/patient/drug-alerts',      label: 'Drug Alerts',       icon: AlertTriangle },
    { to: '/patient/access-requests',  label: 'Access Requests',   icon: UserCheck },
    { to: '/patient/emergency-qr',     label: 'Emergency QR',      icon: QrCode },
    { to: '/patient/face-id',          label: 'Emergency Face ID', icon: ScanFace },
  ],
  // Doctor: can upload prescriptions, has face scanner for emergencies
  doctor: [
    { to: '/doctor',          label: 'Dashboard',           icon: LayoutDashboard, exact: true },
    { to: '/doctor/alerts',   label: 'Drug Alerts',         icon: AlertTriangle },
    { to: '/doctor/face-scan',label: 'Emergency Face Scan', icon: ScanFace, highlight: true },
  ],
  // Hospital Admin: manage doctors, audit, security, face scanner
  hospital_admin: [
    { to: '/admin',                    label: 'Dashboard',           icon: LayoutDashboard, exact: true },
    { to: '/admin/appointments',       label: 'Appointments',        icon: CalendarCheck,   highlight: false },
    { to: '/admin/doctors',            label: 'Manage Doctors',      icon: UserCheck },
    { to: '/admin/audit',              label: 'Audit Logs',          icon: Activity },
    { to: '/admin/security',           label: 'Security Monitor',    icon: ShieldCheck },
    { to: '/admin/emergency-identify', label: 'Emergency Face Scan', icon: ScanFace, highlight: true },
  ],
  caregiver: [
    { to: '/caregiver',              label: 'Access Requests', icon: UserCheck,     exact: true, highlight: true },
    { to: '/caregiver/patients',     label: 'My Patients',     icon: Heart },
    { to: '/caregiver/drug-alerts',  label: 'Drug Alerts',     icon: AlertTriangle },
    { to: '/caregiver/appointments', label: 'Appointments',    icon: CalendarCheck },
    { to: '/caregiver/emergency-qr', label: 'Emergency QR',    icon: QrCode },
    { to: '/caregiver/audit',        label: 'Audit Logs',      icon: Activity },
  ],
}

const ROLE_SECTION = {
  patient:        'Patient Portal',
  doctor:         'Doctor Portal',
  hospital_admin: 'Hospital Admin',
  caregiver:      'Caregiver Portal',
}

const ROLE_COLOR = {
  patient:        'text-blue-600',
  doctor:         'text-teal-600',
  hospital_admin: 'text-purple-600',
  caregiver:      'text-emerald-600',
}

export default function Sidebar() {
  const user     = JSON.parse(localStorage.getItem('user') || '{}')
  const links    = NAV[user.role] || []
  const section  = ROLE_SECTION[user.role] || 'Portal'
  const roleColor= ROLE_COLOR[user.role]   || 'text-blue-600'

  return (
    <aside className="w-56 shrink-0 border-r border-slate-100 min-h-[calc(100vh-4rem)] bg-white hidden md:flex flex-col">
      <div className="flex-1 p-3 pt-5">
        <div className="px-3 mb-4">
          <p className={`text-[11px] font-bold uppercase tracking-widest ${roleColor}`}>{section}</p>
        </div>

        <nav className="space-y-0.5">
          {links.map(({ to, label, icon: Icon, exact, highlight }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : highlight
                    ? 'text-red-600 hover:bg-red-50 border border-red-100 bg-red-50/50'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={15}
                    className={`shrink-0 ${
                      isActive    ? 'text-blue-600'
                      : highlight ? 'text-red-500'
                      : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="truncate flex-1">{label}</span>
                  {highlight && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  )}
                  {isActive && <ChevronRight size={13} className="text-blue-400 shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Privacy notice */}
      <div className="p-3 border-t border-slate-100">
        <div className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-xl border border-blue-100 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldCheck size={12} className="text-blue-600" />
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Data Privacy</p>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            All records are end-to-end encrypted. Access requires explicit patient/caregiver consent.
          </p>
        </div>
      </div>
    </aside>
  )
}
