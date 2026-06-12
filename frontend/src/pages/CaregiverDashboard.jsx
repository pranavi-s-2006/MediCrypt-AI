import { useState } from 'react'
import {
  Bell, ShieldCheck, CheckCircle, XCircle, Clock,
  Heart, RefreshCw, ChevronRight, Copy, Check
} from 'lucide-react'
import AccessRequestCard from '../components/AccessRequestCard'
import StatCard from '../components/StatCard'
import { PageLoader } from '../components/Loader'
import { ApiError, ApiEmpty } from '../components/ApiError'
import { useApi } from '../hooks/useApi'
import { getCaregiverRequests, getCaregiverPatients } from '../services/api'
import toast from 'react-hot-toast'

const SECTIONS = [
  { id: 'pending',   label: 'Pending',     icon: Clock,        color: 'text-amber-600' },
  { id: 'approved',  label: 'Approved',    icon: CheckCircle,  color: 'text-emerald-600' },
  { id: 'rejected',  label: 'Rejected',    icon: XCircle,      color: 'text-red-500' },
  { id: 'patients',  label: 'My Patients', icon: Heart,        color: 'text-pink-500' },
]

function CaregiverIdCard({ userId }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(userId)
    setCopied(true)
    toast.success('Caregiver ID copied!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Your Caregiver ID</p>
        <p className="text-sm font-mono text-slate-700 truncate">{userId}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Share this ID with the patient so they can link you as their guardian</p>
      </div>
      <button
        onClick={copy}
        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

export default function CaregiverDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const caregiverId = user.id || user._id || ''
  const [section, setSection] = useState('pending')

  const { data: reqData, loading: reqLoading, error: reqError, refresh: refreshReqs } = useApi(getCaregiverRequests)
  const { data: patData, loading: patLoading, error: patError, refresh: refreshPats } = useApi(getCaregiverPatients)

  const requests = reqData?.requests || []
  const patients = patData?.patients || []

  const pending  = requests.filter(r => r.status === 'pending')
  const approved = requests.filter(r => r.status === 'approved')
  const rejected = requests.filter(r => r.status === 'rejected')

  if (reqLoading || patLoading) return <PageLoader text="Loading caregiver dashboard…" />

  const counts = { pending: pending.length, approved: approved.length, rejected: rejected.length, patients: patients.length }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Caregiver Dashboard</h1>
          <p className="page-subtitle">{user.name || user.email} · Guardian Access Control</p>
        </div>
        <button onClick={() => { refreshReqs(); refreshPats() }} className="btn-secondary btn-sm flex items-center gap-1.5">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Caregiver ID — always visible */}
      {caregiverId && <CaregiverIdCard userId={caregiverId} />}

      {/* Pending alert banner */}
      {pending.length > 0 && (
        <div
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => setSection('pending')}
        >
          <Bell size={16} className="text-amber-600 shrink-0 animate-pulse" />
          <p className="text-sm text-amber-800 flex-1">
            <strong>{pending.length} pending access request{pending.length > 1 ? 's' : ''}</strong> — your approval is required.
          </p>
          <ChevronRight size={15} className="text-amber-500 shrink-0" />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending"         value={pending.length}  icon={Clock}        color="orange" sub="Need action" />
        <StatCard label="Approved"        value={approved.length} icon={CheckCircle}  color="green" />
        <StatCard label="Rejected"        value={rejected.length} icon={XCircle}      color="red" />
        <StatCard label="Linked Patients" value={patients.length} icon={Heart}        color="teal" />
      </div>

      {/* Section nav */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100">
          <div className="flex overflow-x-auto">
            {SECTIONS.map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  section === id
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={14} className={section === id ? 'text-blue-600' : color} />
                {label}
                {counts[id] > 0 && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    id === 'pending'  ? 'bg-amber-100 text-amber-700'   :
                    id === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    id === 'rejected' ? 'bg-red-100 text-red-600'       :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {counts[id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {section === 'pending' && (
            reqError ? <ApiError error={reqError} onRetry={refreshReqs} /> :
            pending.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle size={44} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No pending requests</p>
                <p className="text-sm text-slate-400 mt-1">All access requests have been reviewed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <ShieldCheck size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    As a guardian, your approval grants temporary record access to doctors. All decisions are logged.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pending.map(req => (
                    <AccessRequestCard key={req._id} request={req} onUpdate={refreshReqs} />
                  ))}
                </div>
              </div>
            )
          )}

          {section === 'approved' && (
            reqError ? <ApiError error={reqError} onRetry={refreshReqs} /> :
            approved.length === 0 ? <ApiEmpty message="No approved requests yet." icon={CheckCircle} /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {approved.map(req => <AccessRequestCard key={req._id} request={req} onUpdate={refreshReqs} readOnly />)}
              </div>
            )
          )}

          {section === 'rejected' && (
            reqError ? <ApiError error={reqError} onRetry={refreshReqs} /> :
            rejected.length === 0 ? <ApiEmpty message="No rejected requests." icon={XCircle} /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rejected.map(req => <AccessRequestCard key={req._id} request={req} onUpdate={refreshReqs} readOnly />)}
              </div>
            )
          )}

          {section === 'patients' && (
            patError ? <ApiError error={patError} onRetry={refreshPats} /> :
            patients.length === 0 ? (
              <div className="space-y-3">
                <ApiEmpty message="No linked patients yet. Share your Caregiver ID with a patient so they can link you." icon={Heart} />
                {caregiverId && <CaregiverIdCard userId={caregiverId} />}
              </div>
            ) : (
              <div className="space-y-3">
                {patients.map(p => (
                  <div key={p._id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-11 h-11 rounded-full bg-teal-100 flex items-center justify-center font-bold text-teal-700 shrink-0 text-sm">
                      {(p.name || p.patient_user_id || 'P').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{p.name || p.patient_user_id}</p>
                      <p className="text-xs text-slate-500">{p.patient_user_id}{p.relationship ? ` · ${p.relationship}` : ''}</p>
                    </div>
                    {p.blood_group && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">{p.blood_group}</span>
                    )}
                    {p.risk && (
                      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                        p.risk === 'High' ? 'bg-red-100 text-red-700' :
                        p.risk === 'Medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>{p.risk}</span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
