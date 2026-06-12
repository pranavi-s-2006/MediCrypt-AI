import { useState } from 'react'
import { CheckCircle, XCircle, Building2, Stethoscope, Clock, Timer, FileText, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { respondToRequest } from '../services/api'
import { extractError } from '../hooks/useApi'

const RECORD_ICONS = { Prescriptions: '💊', 'Lab Reports': '🧪', 'Medical History': '📋', Allergies: '⚠️', Vitals: '❤️' }

export default function AccessRequestCard({ request, onUpdate, readOnly = false }) {
  const [loading, setLoading] = useState(false)
  const isPending  = request.status === 'pending'
  const isApproved = request.status === 'approved'
  const isRejected = request.status === 'rejected'

  const respond = async (status) => {
    setLoading(true)
    try {
      await respondToRequest({ request_id: request._id, status })
      toast.success(status === 'approved' ? '✓ Access approved' : 'Access rejected')
      onUpdate?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const statusBar = isPending
    ? 'border-t-2 border-amber-400'
    : isApproved
    ? 'border-t-2 border-emerald-400'
    : 'border-t-2 border-red-400'

  return (
    <div className={`card overflow-hidden ${statusBar}`}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">
                {request.hospital || 'Hospital'}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Stethoscope size={10} />
                {request.doctor_name || request.doctor_id || '—'}
                {request.department && <span className="text-slate-400">· {request.department}</span>}
              </p>
            </div>
          </div>
          <span className={
            isApproved ? 'badge-green' :
            isRejected ? 'badge-red'   : 'badge-yellow'
          }>
            {request.status}
          </span>
        </div>
      </div>

      <div className="px-5 py-3 space-y-3">
        {/* Reason */}
        {request.reason && (
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
              <Tag size={9} /> Reason
            </p>
            <p className="text-xs text-slate-700">"{request.reason}"</p>
          </div>
        )}

        {/* Requested Records */}
        {request.requested_records?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
              <FileText size={9} /> Requested Records
            </p>
            <div className="flex flex-wrap gap-1.5">
              {request.requested_records.map(rec => (
                <span key={rec} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-0.5">
                  {RECORD_ICONS[rec] || '📄'} {rec}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Duration / expiry */}
        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Timer size={11} className="text-slate-400" />
            Access: {request.access_duration_hours || 24} hrs
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} className="text-slate-400" />
            {new Date(request.requested_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Post-approval expiry */}
        {isApproved && request.expires_at && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
            <p className="font-semibold mb-0.5">Access Active</p>
            <p>Expires: {new Date(request.expires_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        )}

        {isRejected && (
          <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600">
            Access request rejected
            {request.responded_at && ` · ${new Date(request.responded_at).toLocaleDateString('en-IN')}`}
          </div>
        )}
      </div>

      {isPending && !readOnly && (
        <div className="flex border-t border-slate-100">
          <button
            onClick={() => respond('approved')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors border-r border-slate-100 disabled:opacity-50"
          >
            <CheckCircle size={14} /> Approve
          </button>
          <button
            onClick={() => respond('rejected')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <XCircle size={14} /> Reject
          </button>
        </div>
      )}
    </div>
  )
}
