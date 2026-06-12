import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, LogOut, Bell, Lock, AlertTriangle, Eye, UserCheck, ScanFace } from 'lucide-react'
import { getAuditLogs } from '../services/api'

const ROLE_LABEL = {
  patient:        'Patient',
  doctor:         'Doctor',
  hospital_admin: 'Hospital Admin',
  caregiver:      'Caregiver',
}
const ROLE_BADGE = {
  patient:        'bg-blue-100 text-blue-700',
  doctor:         'bg-teal-100 text-teal-700',
  hospital_admin: 'bg-purple-100 text-purple-700',
  caregiver:      'bg-emerald-100 text-emerald-700',
}
const ROLE_AVATAR = {
  patient:        'bg-blue-600',
  doctor:         'bg-teal-600',
  hospital_admin: 'bg-purple-600',
  caregiver:      'bg-emerald-600',
}

// Map audit actions to a human-readable notification message
function notifText(log, currentUser) {
  const who = log.user_name || log.user_id || 'Someone'
  switch (log.action) {
    case 'view_patient_records': return { text: `${who} viewed your medical records`, icon: Eye,        color: 'text-orange-500', urgent: true  }
    case 'request_access':       return { text: `${who} requested access to your records`, icon: UserCheck, color: 'text-blue-500',   urgent: true  }
    case 'access_approved':      return { text: `Access approved for ${who}`,            icon: UserCheck, color: 'text-emerald-500', urgent: false }
    case 'access_rejected':      return { text: `Access rejected for ${who}`,            icon: AlertTriangle, color: 'text-red-500', urgent: false }
    case 'face_scan_success':    return { text: `${who} identified you via Face Scan`,   icon: ScanFace, color: 'text-red-500',    urgent: true  }
    case 'add_prescription':     return { text: `${who} uploaded a prescription for you`, icon: Eye,     color: 'text-teal-500',   urgent: false }
    default:                     return null
  }
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  return `${Math.floor(h / 24)} days ago`
}

export default function Navbar() {
  const navigate  = useNavigate()
  const user      = JSON.parse(localStorage.getItem('user') || '{}')
  const initials  = user.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'

  const [showNotif,  setShowNotif]  = useState(false)
  const [notifs,     setNotifs]     = useState([])
  const [unread,     setUnread]     = useState(0)
  const notifRef = useRef(null)

  // Fetch audit logs relevant to this user as notifications
  useEffect(() => {
    if (!user.role) return
    const load = () => {
      getAuditLogs(20)
        .then(res => {
          const logs  = res.data?.logs || []
          // For patients: show actions done TO them (not by them)
          // For doctors/admins: show their own recent actions
          const relevant = user.role === 'patient'
            ? logs.filter(l =>
                l.user_id !== user.id &&
                ['view_patient_records', 'request_access', 'face_scan_success', 'add_prescription'].includes(l.action)
              )
            : logs.filter(l => l.user_id === (user.id || user._id)).slice(0, 5)

          const mapped = relevant
            .map(l => ({ ...l, notif: notifText(l, user) }))
            .filter(l => l.notif)
            .slice(0, 8)

          setNotifs(mapped)
          setUnread(mapped.filter(n => n.notif?.urgent).length)
        })
        .catch(() => {})
    }
    load()
    // Poll every 30 seconds for new notifications
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [user.role])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleNotifOpen = () => {
    setShowNotif(s => !s)
    setUnread(0)   // mark as read when opened
  }

  const logout = () => { localStorage.clear(); navigate('/login') }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 h-16">
      <div className="px-4 sm:px-6 h-full flex items-center justify-between gap-4">

        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 select-none">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center shadow-sm">
            <Shield size={16} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="flex items-baseline gap-0.5">
              <span className="font-bold text-slate-800 text-sm tracking-tight">MediCrypt</span>
              <span className="text-blue-600 font-bold text-sm"> Guardian</span>
              <span className="text-teal-600 font-bold text-sm"> AI</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase -mt-0.5">
              Secure Health Platform
            </p>
          </div>
        </Link>

        {/* Encrypted session badge */}
        <div className="hidden lg:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <Lock size={11} className="text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">Encrypted Session</span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleNotifOpen}
              className="relative w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full border border-white flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white px-0.5">{unread > 9 ? '9+' : unread}</span>
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-modal border border-slate-200 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Notifications</p>
                  {unread > 0
                    ? <span className="badge-red text-xs">{unread} new</span>
                    : <span className="badge-gray text-xs">All read</span>
                  }
                </div>

                <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell size={24} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">No notifications yet</p>
                    </div>
                  ) : notifs.map((n, i) => {
                    const Icon = n.notif.icon
                    return (
                      <div key={n._id || i} className={`px-4 py-3 hover:bg-slate-50 cursor-pointer ${n.notif.urgent ? 'bg-orange-50/40' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${n.notif.urgent ? 'bg-orange-100' : 'bg-slate-100'}`}>
                            <Icon size={13} className={n.notif.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 leading-relaxed">{n.notif.text}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-slate-400">{timeAgo(n.timestamp)}</p>
                              {n.ip_address && (
                                <span className="text-[10px] text-slate-400 font-mono">· {n.ip_address}</span>
                              )}
                            </div>
                          </div>
                          {n.notif.urgent && (
                            <span className="w-2 h-2 rounded-full bg-orange-400 mt-1 shrink-0" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Footer — link to access requests for patients */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  {user.role === 'patient' ? (
                    <Link
                      to="/patient/access-requests"
                      onClick={() => setShowNotif(false)}
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      Manage access requests →
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">Your recent activity</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${ROLE_AVATAR[user.role] || 'bg-blue-600'}`}>
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{user.name || 'User'}</p>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[user.role] || 'bg-slate-100 text-slate-600'}`}>
                  {ROLE_LABEL[user.role] || user.role}
                </span>
                {user.role === 'caregiver' && (user.id || user._id) && (
                  <span
                    className="text-[10px] font-mono text-slate-400 cursor-pointer hover:text-blue-600 transition-colors"
                    title="Click to copy your Caregiver ID"
                    onClick={() => {
                      navigator.clipboard.writeText(user.id || user._id)
                      // toast not available here — use native
                      const el = document.createElement('span')
                      el.textContent = 'ID copied!'
                      el.className = 'fixed top-16 right-4 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg z-50 shadow'
                      document.body.appendChild(el)
                      setTimeout(() => el.remove(), 1500)
                    }}
                  >
                    ID: {(user.id || user._id).slice(-6)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={logout}
              className="ml-1 w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

      </div>
    </header>
  )
}
