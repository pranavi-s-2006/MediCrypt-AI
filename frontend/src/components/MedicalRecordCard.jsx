import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, Pill, AlertTriangle, Calendar, Stethoscope, Building2, Download } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TYPE_BADGE = {
  prescription: 'badge-blue',
  lab_report: 'badge-teal',
  discharge_summary: 'badge-purple',
  scan_report: 'badge-orange',
  other: 'badge-gray',
}
const TYPE_LABEL = {
  prescription: 'Prescription',
  lab_report: 'Lab Report',
  discharge_summary: 'Discharge Summary',
  scan_report: 'Scan Report',
  other: 'Other',
}
const RISK_BADGE = { Critical: 'risk-critical', High: 'risk-high', Medium: 'risk-medium', Low: 'risk-low' }

export default function MedicalRecordCard({ record }) {
  const [open, setOpen] = useState(false)

  const handleView = (e) => {
    e.stopPropagation()
    const token = localStorage.getItem('token')
    const url = `${API_URL}/patient/file/${record._id}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('File not available')
        return r.blob()
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob)
        window.open(objectUrl, '_blank')
      })
      .catch(() => alert('File not available'))
  }

  return (
    <div className="card overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
          <FileText size={15} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{record.original_filename}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={TYPE_BADGE[record.document_type] || 'badge-gray'}>
              {TYPE_LABEL[record.document_type] || 'Other'}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar size={10} />
              {new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {record.doctor && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
                <Stethoscope size={10} /> {record.doctor}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {record.risk_alert && record.risk_alert !== 'Pending' && (
            <span className={RISK_BADGE[record.risk_alert] || 'risk-low'}>{record.risk_alert}</span>
          )}
          {record.file_path && (
            <button onClick={handleView}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
              <Download size={11} /> View
            </button>
          )}
          {open
            ? <ChevronUp size={15} className="text-slate-400" />
            : <ChevronDown size={15} className="text-slate-400" />
          }
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 divide-y divide-slate-100">
          {/* Meta */}
          {(record.doctor || record.hospital) && (
            <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
              {record.doctor && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Stethoscope size={11} /> {record.doctor}
                </span>
              )}
              {record.hospital && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Building2 size={11} /> {record.hospital}
                </span>
              )}
            </div>
          )}

          {/* AI Summary */}
          {record.ai_summary && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">AI Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{record.ai_summary}</p>
            </div>
          )}

          {/* Medicines */}
          {record.extracted_medicines?.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Pill size={10} /> Extracted Medicines
              </p>
              <div className="flex flex-wrap gap-1.5">
                {record.extracted_medicines.map((m, i) => (
                  <span key={i} className="badge-blue">{m.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Drug Interactions */}
          {record.drug_interactions?.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <AlertTriangle size={10} /> Drug Interactions
              </p>
              <div className="space-y-1.5">
                {record.drug_interactions.map((d, i) => (
                  <div key={i} className="text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-slate-700">
                    <span className="font-bold text-red-700">{d.drug_a}</span>
                    <span className="mx-1.5 text-slate-400">+</span>
                    <span className="font-bold text-red-700">{d.drug_b}</span>
                    <span className="mx-1.5 text-slate-400">—</span>
                    {d.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OCR Text */}
          {record.ocr_text && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">OCR Text</p>
              <p className="text-xs font-mono text-slate-600 bg-white rounded-lg p-3 border border-slate-200 leading-relaxed whitespace-pre-wrap">
                {record.ocr_text}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
