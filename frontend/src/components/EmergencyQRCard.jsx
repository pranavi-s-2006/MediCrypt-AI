import QRCode from 'react-qr-code'
import { Shield, Phone, Droplets, AlertTriangle, Pill, Heart, Download, Clock, Printer } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function EmergencyQRCard({ data }) {
  if (!data) return null

  // QR encodes ONLY the public scan URL — no raw patient data in the QR itself
  const scanUrl = `${API_BASE}/emergency/scan/${data.patient_id}`

  const downloadQR = () => {
    const svg = document.getElementById('eq-qr')
    if (!svg) return
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `medicrypt-emergency-qr-${data.patient_id || 'patient'}.svg`
    a.click()
  }

  return (
    <div className="card overflow-hidden print:shadow-none">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm tracking-wide">EMERGENCY HEALTH CARD</p>
              <p className="text-red-200 text-xs">MediCrypt Guardian AI · Scan for critical info</p>
            </div>
          </div>
          {data.patient_name && (
            <p className="text-white/80 text-sm font-medium hidden sm:block">{data.patient_name}</p>
          )}
        </div>
      </div>

      <div className="p-6 flex flex-col sm:flex-row gap-6">
        {/* QR code — encodes only the scan URL */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className="p-3 bg-white border-2 border-red-200 rounded-xl shadow-sm">
            <QRCode
              id="eq-qr"
              value={scanUrl}
              size={160}
              level="H"
              style={{ display: 'block' }}
            />
          </div>
          <div className="flex gap-2 w-full">
            <button
              onClick={downloadQR}
              className="flex-1 btn-secondary btn-sm flex items-center justify-center gap-1"
            >
              <Download size={12} /> Download
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 btn-secondary btn-sm flex items-center justify-center gap-1"
            >
              <Printer size={12} /> Print
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center leading-relaxed max-w-[170px]">
            Scan with any QR reader — opens emergency data instantly, no login required
          </p>
        </div>

        {/* Critical data */}
        <div className="flex-1 grid grid-cols-1 gap-3">
          <DataRow
            icon={Droplets}
            label="Blood Group"
            value={data.blood_group || '—'}
            iconClass="text-red-500"
            valueClass="text-red-600 font-black text-2xl"
            highlight
          />
          <DataRow
            icon={AlertTriangle}
            label="Allergies"
            value={data.allergies?.join(' · ') || 'None known'}
            iconClass="text-orange-500"
            valueClass="text-orange-700 font-semibold"
            highlight
          />
          <DataRow
            icon={Pill}
            label="Current Medicines"
            value={data.current_medicines?.join(', ') || 'None'}
            iconClass="text-blue-500"
          />
          <DataRow
            icon={Heart}
            label="Chronic Diseases"
            value={data.chronic_diseases?.join(', ') || 'None'}
            iconClass="text-purple-500"
          />
          <DataRow
            icon={Phone}
            label="Emergency Contact"
            value={[data.emergency_contact_name, data.emergency_contact_number].filter(Boolean).join('  ·  ') || '—'}
            iconClass="text-teal-500"
            valueClass="text-teal-700 font-semibold"
            highlight
          />
        </div>
      </div>

      {data.summary && (
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">AI Emergency Summary</p>
          <p className="text-sm text-slate-700 italic leading-relaxed">{data.summary}</p>
        </div>
      )}

      <div className="border-t border-red-100 px-6 py-2.5 bg-red-50 flex items-center gap-2">
        <Clock size={11} className="text-red-400" />
        <p className="text-[10px] text-red-500 font-medium">
          Full medical history NOT included · Consent required for complete access · MediCrypt Guardian AI
        </p>
      </div>
    </div>
  )
}

function DataRow({ icon: Icon, label, value, iconClass = 'text-slate-400', valueClass = 'text-slate-700', highlight }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${highlight ? 'bg-slate-50 border border-slate-100' : ''}`}>
      <Icon size={14} className={`${iconClass} mt-0.5 shrink-0`} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className={`text-sm mt-0.5 break-words ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}
