import { useState, useCallback } from 'react'
import { Clock, FileText, Filter, Search, ShieldCheck, RefreshCw } from 'lucide-react'
import MedicalRecordCard from '../components/MedicalRecordCard'
import { PageLoader } from '../components/Loader'
import { ApiError, ApiEmpty } from '../components/ApiError'
import { useApi } from '../hooks/useApi'
import { getPatientHistory } from '../services/api'

const DOC_TYPES = ['All', 'prescription', 'lab_report', 'discharge_summary', 'scan_report']
const TYPE_LABEL = {
  prescription: 'Prescription', lab_report: 'Lab Report',
  discharge_summary: 'Discharge Summary', scan_report: 'Scan Report'
}

export default function MedicalTimeline() {
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  const { data, loading, error, refresh } = useApi(getPatientHistory)
  const allRecords = data?.records || []

  const filtered = allRecords.filter(r =>
    (filter === 'All' || r.document_type === filter) &&
    (search === '' ||
      (r.original_filename || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.ai_summary || '').toLowerCase().includes(search.toLowerCase()))
  )

  const grouped = filtered.reduce((acc, r) => {
    const month = new Date(r.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    if (!acc[month]) acc[month] = []
    acc[month].push(r)
    return acc
  }, {})

  if (loading) return <PageLoader text="Loading medical history…" />
  if (error)   return <ApiError error={error} onRetry={refresh} />

  return (
    <div className="space-y-5 pb-8 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Medical History</h1>
          <p className="page-subtitle">Your complete medical record timeline — encrypted and consent-protected</p>
        </div>
        <button onClick={refresh} className="btn-secondary btn-sm"><RefreshCw size={13} /></button>
      </div>

      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <ShieldCheck size={14} className="text-blue-600 shrink-0" />
        <p className="text-xs text-blue-700">All records are end-to-end encrypted. Only you and approved doctors can view these records.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 py-2 text-sm"
            placeholder="Search records…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter size={14} className="text-slate-400 shrink-0" />
          {DOC_TYPES.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${
                filter === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
              }`}
            >
              {t === 'All' ? 'All Records' : TYPE_LABEL[t] || t}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',        value: allRecords.length,                                       color: 'text-blue-600' },
          { label: 'Prescriptions',value: allRecords.filter(r => r.document_type === 'prescription').length, color: 'text-teal-600' },
          { label: 'Lab Reports',  value: allRecords.filter(r => r.document_type === 'lab_report').length,   color: 'text-purple-600' },
          { label: 'High Risk',    value: allRecords.filter(r => r.risk_alert === 'High' || r.risk_alert === 'Critical').length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <ApiEmpty message="No records match your filter." icon={FileText} />
      ) : (
        Object.entries(grouped).map(([month, records]) => (
          <div key={month}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
              <p className="text-sm font-bold text-slate-700">{month}</p>
              <div className="flex-1 border-t border-slate-200" />
              <span className="badge-gray text-[10px]">{records.length} record{records.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2 pl-5 border-l-2 border-blue-100 ml-[5px]">
              {records.map(r => <MedicalRecordCard key={r._id} record={r} />)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
