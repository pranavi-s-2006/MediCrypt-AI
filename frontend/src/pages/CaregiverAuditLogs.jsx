import { Activity, Building2, User, Clock, RefreshCw, CheckCircle, XCircle, ShieldCheck } from 'lucide-react'
import { PageLoader } from '../components/Loader'
import { ApiError, ApiEmpty } from '../components/ApiError'
import { useApi } from '../hooks/useApi'
import { getCaregiverAuditLogs } from '../services/api'

const ACTION_LABEL = {
  access_approved: { label: 'Access Approved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  access_rejected: { label: 'Access Rejected', color: 'bg-red-100 text-red-600',         icon: XCircle },
  request_access:  { label: 'Access Requested', color: 'bg-blue-100 text-blue-700',      icon: Activity },
}

export default function CaregiverAuditLogs() {
  const { data, loading, error, refresh } = useApi(getCaregiverAuditLogs)
  const logs = data?.logs || []

  if (loading) return <PageLoader text="Loading audit logs…" />
  if (error)   return <ApiError error={error} onRetry={refresh} />

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Your guardian activity — all access decisions recorded</p>
        </div>
        <button onClick={refresh} className="btn-secondary btn-sm flex items-center gap-1.5">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <ShieldCheck size={14} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          All guardian approval and rejection actions are <strong>immutably logged</strong> for accountability and HIPAA compliance.
        </p>
      </div>

      {logs.length === 0 ? (
        <ApiEmpty message="No audit activity yet. Your approval/rejection actions will appear here." icon={Activity} />
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const meta = ACTION_LABEL[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600', icon: Activity }
            const Icon = meta.icon
            return (
              <div key={log._id} className="card px-5 py-4 flex items-start gap-4">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>
                    {log.details?.patient_id && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <User size={10} /> Patient: {log.details.patient_id}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-500">
                    {log.details?.hospital && (
                      <span className="flex items-center gap-1">
                        <Building2 size={10} /> {log.details.hospital}
                      </span>
                    )}
                    {log.details?.doctor_name && (
                      <span className="flex items-center gap-1">
                        <User size={10} /> {log.details.doctor_name}
                      </span>
                    )}
                    {log.details?.department && (
                      <span className="text-slate-400">{log.details.department}</span>
                    )}
                  </div>
                  {log.details?.expires_at && log.action === 'access_approved' && (
                    <p className="text-[11px] text-emerald-600 mt-1">
                      Access expires: {new Date(log.details.expires_at).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1 whitespace-nowrap">
                  <Clock size={10} />
                  {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
