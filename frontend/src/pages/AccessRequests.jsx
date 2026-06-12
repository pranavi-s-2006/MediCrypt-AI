import { useState } from 'react'
import { UserCheck, Clock, CheckCircle, XCircle, Filter, ShieldCheck, RefreshCw, Building2, Timer, FileText, Wifi, WifiOff } from 'lucide-react'
import StatCard from '../components/StatCard'
import { PageLoader } from '../components/Loader'
import { ApiError, ApiEmpty } from '../components/ApiError'
import { useApi, extractError } from '../hooks/useApi'
import { getCaregiverRequests, respondToRequest } from '../services/api'
import toast from 'react-hot-toast'

const FILTERS = ['All', 'pending', 'approved', 'rejected']

function ApiStatusPill({ loading, error }) {
  if (loading) return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Fetching…
    </span>
  )
  if (error) return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
      <WifiOff size={10} /> API Error
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
      <Wifi size={10} /> Live
    </span>
  )
}

function RequestCard({ request, onUpdate, readOnly }) {
  const [loading, setLoading] = useState(false)
  const isPending = request.status === 'pending'

  const respond = async (status) => {
    setLoading(true)
    try {
      await respondToRequest({ request_id: request._id, status })
      toast.success(status === 'approved' ? 'Access approved ✓' : 'Access rejected')
      onUpdate?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally { setLoading(false) }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
              <UserCheck size={16} className="text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{request.doctor_id || request.doctor_name || '—'}</p>
              {request.doctor_specialty && <p className="text-xs text-slate-500">{request.doctor_specialty}</p>}
            </div>
          </div>
          <span className={
            request.status === 'approved' ? 'badge-green' :
            request.status === 'rejected' ? 'badge-red'   : 'badge-yellow'
          }>
            {request.status}
          </span>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          {request.hospital && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Building2 size={11} className="text-slate-400 shrink-0" />
              <span className="truncate">{request.hospital}</span>
            </div>
          )}
          {request.department && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <UserCheck size={11} className="text-slate-400 shrink-0" />
              <span className="truncate">{request.department}</span>
            </div>
          )}
          {request.patient_id && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <FileText size={11} className="text-slate-400 shrink-0" />
              <span className="font-mono truncate">{request.patient_id}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-slate-500">
            <Timer size={11} className="text-slate-400 shrink-0" />
            <span>{request.access_duration_hours || 24}h access</span>
          </div>
        </div>

        {/* Reason */}
        {request.reason && (
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Reason</p>
            <p className="text-xs text-slate-700 italic">"{request.reason}"</p>
          </div>
        )}

        {/* Requested records */}
        {request.requested_records && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
            <p className="text-[10px] font-bold text-blue-500 uppercase mb-0.5">Requested Records</p>
            <p className="text-xs text-blue-700">{request.requested_records}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex items-center gap-4 text-[10px] text-slate-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock size={9} /> Requested: {new Date(request.requested_at).toLocaleString('en-IN')}
          </span>
          {isPending && request.expires_at && (
            <span className="flex items-center gap-1 text-orange-500">
              <Timer size={9} /> Expires: {new Date(request.expires_at).toLocaleDateString('en-IN')}
            </span>
          )}
        </div>
      </div>

      {isPending && !readOnly && (
        <div className="flex border-t border-slate-100">
          <button onClick={() => respond('approved')} disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors border-r border-slate-100 disabled:opacity-50">
            <CheckCircle size={14} /> Approve
          </button>
          <button onClick={() => respond('rejected')} disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
            <XCircle size={14} /> Reject
          </button>
        </div>
      )}
    </div>
  )
}

export default function AccessRequests() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [filter, setFilter] = useState('All')

  const { data, loading, error, refresh } = useApi(getCaregiverRequests)
  const requests = data?.requests || []
  const filtered = filter === 'All' ? requests : requests.filter(r => r.status === filter)

  const pending  = requests.filter(r => r.status === 'pending').length
  const approved = requests.filter(r => r.status === 'approved').length
  const rejected = requests.filter(r => r.status === 'rejected').length

  if (loading) return <PageLoader text="Loading access requests…" />
  if (error)   return <ApiError error={error} onRetry={refresh} />

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Access Requests</h1>
          <p className="page-subtitle">
            {user.role === 'caregiver'
              ? 'Review and respond to doctor access requests for your linked patients'
              : 'Manage who can access your medical records'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ApiStatusPill loading={loading} error={error} />
          <button onClick={refresh} className="btn-secondary btn-sm"><RefreshCw size={13} /></button>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <ShieldCheck size={15} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          <strong>Consent-gated access:</strong> Doctors can only view your records after explicit approval.
          Access expires after the granted duration and all activity is logged in the audit trail.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending"  value={pending}  icon={Clock}       color="orange" />
        <StatCard label="Approved" value={approved} icon={CheckCircle} color="green" />
        <StatCard label="Rejected" value={rejected} icon={XCircle}     color="red" />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-slate-400" />
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all capitalize ${
              filter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            {f === 'All' ? 'All Requests' : f}
            {f !== 'All' && (
              <span className="ml-1.5 opacity-70">({requests.filter(r => r.status === f).length})</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <ApiEmpty message={`No ${filter === 'All' ? '' : filter} requests found.`} icon={UserCheck} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(req => (
            <RequestCard
              key={req._id}
              request={req}
              onUpdate={refresh}
              readOnly={user.role !== 'patient' && user.role !== 'caregiver'}
            />
          ))}
        </div>
      )}

      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Access Policy</p>
        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
          <li>Approved access expires after 7 days by default</li>
          <li>Doctors can only view records — not modify them</li>
          <li>Every access event is logged in the immutable audit trail</li>
          <li>You can reject any request at any time</li>
        </ul>
      </div>
    </div>
  )
}
