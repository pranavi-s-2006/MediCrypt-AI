import { useState } from 'react'
import { Activity, Search, Filter, Download, Shield, Clock, User, RefreshCw } from 'lucide-react'
import AuditLogTable from '../components/AuditLogTable'
import StatCard from '../components/StatCard'
import { PageLoader } from '../components/Loader'
import { ApiError } from '../components/ApiError'
import { useApi } from '../hooks/useApi'
import { getAuditLogs } from '../services/api'

const ACTION_FILTERS = ['All', 'login', 'upload_file', 'view_patient_records', 'generate_qr', 'request_access', 'access_approved', 'access_rejected', 'verify_doctor']

export default function AuditLogs() {
  const [search,       setSearch]       = useState('')
  const [actionFilter, setActionFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const { data, loading, error, refresh } = useApi(getAuditLogs)
  const logs = data?.logs || []

  const filtered = logs.filter(log => {
    const matchSearch =
      search === '' ||
      (log.user_id    || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.action     || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.resource   || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.ip_address || '').includes(search)
    const matchAction = actionFilter === 'All' || log.action === actionFilter
    const matchStatus = statusFilter === 'All' || (log.status || 'success') === statusFilter
    return matchSearch && matchAction && matchStatus
  })

  const failed      = logs.filter(l => l.status === 'failed').length
  const uniqueUsers = new Set(logs.map(l => l.user_id)).size

  const exportCSV = () => {
    const headers = ['Timestamp', 'User ID', 'User Name', 'Action', 'Resource', 'Resource ID', 'IP Address', 'Status']
    const rows = filtered.map(l => [
      new Date(l.timestamp).toISOString(),
      l.user_id, l.user_name || '', l.action,
      l.resource, l.resource_id || '', l.ip_address || '', l.status || 'success'
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `audit_logs_${Date.now()}.csv`
    a.click()
  }

  if (loading) return <PageLoader text="Loading audit logs…" />
  if (error)   return <ApiError error={error} onRetry={refresh} />

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Complete immutable trail of all access and activity events</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-secondary btn-sm"><RefreshCw size={13} /></button>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Shield size={14} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Audit logs are <strong>immutable</strong> and stored with cryptographic integrity. All records comply with HIPAA audit trail requirements.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Events"     value={logs.length}    icon={Activity} color="blue" />
        <StatCard label="Filtered Events"  value={filtered.length} icon={Filter}  color="teal" />
        <StatCard label="Unique Users"     value={uniqueUsers}    icon={User}     color="purple" />
        <StatCard label="Failed Attempts"  value={failed}         icon={Shield}   color="red" sub="Security flag" />
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 py-2 text-sm"
              placeholder="Search by user, action, resource, IP…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input py-2 text-sm w-full sm:w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter size={13} className="text-slate-400 shrink-0" />
          {ACTION_FILTERS.map(a => (
            <button key={a} onClick={() => setActionFilter(a)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all whitespace-nowrap ${
                actionFilter === a
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
              }`}
            >
              {a === 'All' ? 'All Actions' : a.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <p className="section-title flex items-center gap-2">
            <Activity size={15} className="text-blue-600" /> Activity Log
          </p>
          <span className="badge-gray">{filtered.length} events</span>
        </div>
        <AuditLogTable logs={filtered} />
      </div>
    </div>
  )
}
