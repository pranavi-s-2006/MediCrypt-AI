import { useState, useCallback, useRef } from 'react'
import {
  ScanFace, QrCode, ShieldAlert, Droplets, AlertTriangle,
  Pill, Heart, Phone, CheckCircle, RefreshCw, Clock, Info, Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import WebcamCapture from '../components/WebcamCapture'
import { identifyFace } from '../services/api'
import { extractError } from '../hooks/useApi'

function EmergencyResult({ result, onReset }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-emerald-600 px-5 py-4 flex items-center gap-3">
        <CheckCircle size={22} className="text-white shrink-0" />
        <div>
          <p className="text-white font-bold text-sm">Patient Identified</p>
          <p className="text-emerald-200 text-xs">
            Confidence: {result.confidence}% · Emergency data only — full history requires consent
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-3 flex items-center gap-2">
          <ShieldAlert size={16} className="text-white" />
          <p className="text-white font-bold text-sm tracking-wide">EMERGENCY HEALTH CARD</p>
        </div>

        <div className="p-5 space-y-3">
          <Row label="Patient Name"     value={result.patient_name}    valueClass="text-slate-800 font-bold text-lg" />
          <Row label="Blood Group"      value={result.blood_group}     icon={Droplets}       iconClass="text-red-500"    valueClass="text-red-600 font-black text-2xl" />
          <Row label="Known Allergies"  value={result.allergies?.join(', ') || 'None known'} icon={AlertTriangle} iconClass="text-orange-500" valueClass="text-orange-700 font-semibold" />
          <Row label="Current Medicines" value={result.current_medicines?.join(', ') || 'None'} icon={Pill}       iconClass="text-blue-500" />
          <Row label="Chronic Diseases" value={result.chronic_diseases?.join(', ') || 'None'} icon={Heart}       iconClass="text-purple-500" />
          <Row
            label="Emergency Contact"
            value={[result.emergency_contact_name, result.emergency_contact_number].filter(Boolean).join('  ·  ') || '—'}
            icon={Phone} iconClass="text-teal-500" valueClass="text-teal-700 font-semibold"
          />
        </div>

        <div className="border-t border-slate-100 px-5 py-2.5 bg-slate-50 flex items-center gap-2">
          <Clock size={11} className="text-slate-400" />
          <p className="text-[10px] text-slate-400">
            Last updated: {result.last_updated ? new Date(result.last_updated).toLocaleString('en-IN') : '—'} ·
            Full history hidden · Scan logged in audit trail
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onReset} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={13} /> Scan Another Patient
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, icon: Icon, iconClass = 'text-slate-400', valueClass = 'text-slate-700 text-sm' }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
      {Icon && <Icon size={14} className={`${iconClass} mt-0.5 shrink-0`} />}
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className={`mt-0.5 break-words ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}

export default function EmergencyIdentifyPage() {
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState(null)
  const [processing, setProcessing] = useState(false)
  const inFlightRef  = useRef(false)

  // Called by WebcamCapture with a JPEG blob (manual capture only — no auto-scan)
  const handleCapture = useCallback(async (blob) => {
    if (inFlightRef.current || result) return
    inFlightRef.current = true
    setProcessing(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', blob, 'frame.jpg')
      const res = await identifyFace(fd)
      setResult(res.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setProcessing(false)
      inFlightRef.current = false
    }
  }, [result])

  const reset = () => {
    setResult(null)
    setError(null)
    setProcessing(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-6">
      <div className="w-full max-w-lg space-y-5 pt-6">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center mx-auto mb-3">
            <ScanFace size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Emergency Face Identification</h1>
          <p className="text-slate-500 text-sm mt-1">Backup method — use QR code when available</p>
        </div>

        {/* Primary method notice */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            <strong>Primary method:</strong> Scan the patient's <strong>Emergency QR card</strong>.
            Use face scan only when the QR code is unavailable.
          </p>
        </div>

        {result ? (
          <EmergencyResult result={result} onReset={reset} />
        ) : (
          <div className="space-y-4">

            {/* Instructions */}
            <div className="card p-4 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Instructions</p>
              <ol className="space-y-1.5">
                {[
                  'Click "Start Camera" and allow webcam access.',
                  "Position the patient's face clearly and well-lit in the frame.",
                  'Click "Scan Face" to capture and send to the server.',
                  'ArcFace ONNX model will match against registered patients — first scan takes ~5 seconds while model loads.',
                  'Emergency details appear instantly on a successful match.',
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>

            {/* Webcam */}
            <div className="card p-4 space-y-3">
              <WebcamCapture
                captureLabel="Scan Face"
                onCapture={handleCapture}
                autoCapture={false}
              />

              {/* Processing overlay */}
              {processing && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <Loader2 size={16} className="text-blue-600 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Analysing face…</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      ArcFace is comparing against registered patients. First scan may take 5–10 seconds while the ONNX model loads.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && !processing && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-red-700 font-semibold">Identification failed</p>
                  <p className="text-xs text-red-500 mt-0.5">{error}</p>
                  <p className="text-xs text-red-500 mt-2">
                    Tips: ensure good lighting, face is clearly visible, and the patient has registered their face photo.
                    If unavailable, use the <strong>Emergency QR code</strong> instead.
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          MediCrypt Guardian AI · OpenCV + insightface ArcFace · Every scan is audit-logged · Prototype
        </p>
      </div>
    </div>
  )
}
