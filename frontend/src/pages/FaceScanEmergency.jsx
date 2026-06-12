import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Camera, Shield, Droplets, AlertTriangle, Pill, Heart,
  Phone, CheckCircle, RefreshCw, Scan, Clock, ShieldAlert,
  Info, Building2, User, Stethoscope, Bell
} from 'lucide-react'
import { faceScanEmergency } from '../services/api'
import { extractError } from '../hooks/useApi'
import toast from 'react-hot-toast'

/* ─────────────────────────────────────────────────────────
   EMERGENCY FACE SCAN — Doctor / Hospital Admin only
   Accessed via /doctor/face-scan or /admin/emergency-identify
   User must be logged in. Their identity is shown and logged.
───────────────────────────────────────────────────────── */
export default function FaceScanEmergency() {
  const user      = JSON.parse(localStorage.getItem('user') || '{}')
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef  = useRef(null)

  const [phase,     setPhase]     = useState('idle')
  const [result,    setResult]    = useState(null)
  const [errMsg,    setErrMsg]    = useState('')
  const [countdown, setCountdown] = useState(null)

  // Attach stream to video element after phase='camera' renders the <video> tag
  useEffect(() => {
    if (phase === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [phase])

  const stopCamera = useCallback(() => {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const captureAndScan = useCallback(async () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)

    stopCamera()
    setPhase('scanning')

    canvas.toBlob(async (blob) => {
      if (!blob) { setErrMsg('Could not capture frame. Try again.'); setPhase('error'); return }
      const fd = new FormData()
      fd.append('file', blob, 'scan.jpg')
      try {
        const res = await faceScanEmergency(fd)
        setResult(res.data)
        setPhase('result')
        // Notify user (toast for the scanning doctor — backend also sends notification to patient)
        toast.success(`Patient identified: ${res.data.patient_name}`)
      } catch (err) {
        setErrMsg(extractError(err))
        setPhase('error')
      }
    }, 'image/jpeg', 0.92)
  }, [stopCamera])

  const startCamera = async () => {
    setErrMsg(''); setResult(null)
    clearInterval(timerRef.current)

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrMsg('Camera not supported. Use Chrome or Firefox over HTTPS or localhost.')
      setPhase('error')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      setPhase('camera')  // render <video> first, useEffect attaches srcObject after

      setTimeout(() => {
        let c = 3
        setCountdown(c)
        timerRef.current = setInterval(() => {
          c -= 1
          setCountdown(c)
          if (c <= 0) {
            clearInterval(timerRef.current)
            setCountdown(null)
            captureAndScan()
          }
        }, 1000)
      }, 300)
    } catch (err) {
      const msg = err.name === 'NotAllowedError'  ? 'Camera permission denied. Click Allow when the browser asks.'
                : err.name === 'NotFoundError'    ? 'No camera found on this device.'
                : err.name === 'NotReadableError' ? 'Camera is in use by another application.'
                : `Camera error: ${err.message}`
      setErrMsg(msg)
      setPhase('error')
    }
  }

  const reset = () => {
    stopCamera()
    setPhase('idle')
    setResult(null)
    setErrMsg('')
    setCountdown(null)
  }

  return (
    <div className="space-y-5 pb-8 max-w-2xl">

      {/* Page header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <ScanFaceIcon /> Emergency Face Scan
        </h1>
        <p className="page-subtitle">
          Identify an unconscious or unresponsive patient by face — shows critical medical data instantly.
        </p>
      </div>

      {/* ── Logged-in identity card ── */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-blue-600 px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'DR'}
            </div>
            <div>
              <p className="text-white font-bold text-sm">{user.name}</p>
              <p className="text-teal-200 text-xs capitalize">{user.role?.replace('_', ' ')} · Authenticated</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/30 border border-emerald-400/40 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white">Session Active</span>
          </div>
        </div>
        <div className="px-5 py-3 flex items-start gap-2">
          <Info size={13} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-600 leading-relaxed">
            You are scanning as <strong>{user.name}</strong>. Your identity, timestamp, and IP address are
            permanently recorded in the patient's audit log. The patient will be notified of this access.
          </p>
        </div>
      </div>

      {/* ── Patient notification notice ── */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Bell size={14} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Patient is notified:</strong> When a patient is identified, they receive a notification
          showing your name, hospital, and that their emergency data was accessed. All scans are immutably logged.
        </p>
      </div>

      {/* ── Main scanner card ── */}
      <div className="card overflow-hidden">
        <div className="bg-red-600 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-white" />
            <p className="text-white font-bold text-sm uppercase tracking-wide">Emergency Face ID</p>
          </div>
          <span className="text-red-200 text-xs">Hospital / Doctor Use Only</span>
        </div>

        <div className="p-6 space-y-5">

          {/* IDLE */}
          {phase === 'idle' && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto">
                  <Scan size={36} className="text-red-500" />
                </div>
                <p className="font-semibold text-slate-800">Point camera at the patient's face</p>
                <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                  AI identifies the patient and shows blood group, allergies, medicines, and emergency contact.
                </p>
              </div>

              <div className="space-y-2">
                {[
                  'Works if patient is unconscious or unable to speak',
                  'Shows only critical data — full records require login + consent',
                  'Your identity is logged — patient receives access notification',
                  'Every attempt is permanently recorded in the audit trail',
                ].map(t => (
                  <div key={t} className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle size={11} className="text-teal-500 shrink-0" /> {t}
                  </div>
                ))}
              </div>

              <button onClick={startCamera}
                className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base flex items-center justify-center gap-3 transition-colors shadow-sm">
                <Camera size={20} /> Open Camera & Scan Patient
              </button>
            </div>
          )}

          {/* CAMERA */}
          {phase === 'camera' && (
            <div className="space-y-3">
              <p className="text-center text-slate-600 text-sm font-medium">
                Auto-capture in{' '}
                <span className="text-red-600 font-black text-3xl">{countdown}</span>
                {' '}seconds
              </p>
              <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay playsInline muted
                  className="w-full h-full object-cover"
                  onCanPlay={e => e.target.play().catch(() => {})}
                />
                {/* Oval face guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-44 h-60 border-2 border-red-400 rounded-full"
                    style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
                </div>
                {/* Countdown overlay */}
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-white font-black text-8xl opacity-70 drop-shadow-2xl">{countdown}</span>
                  </div>
                )}
                {/* Live badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/80 rounded-full px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-semibold text-white">SCANNING</span>
                </div>
                {/* Doctor identity watermark */}
                <div className="absolute bottom-3 right-3 bg-black/60 rounded-lg px-2.5 py-1.5">
                  <p className="text-[10px] text-white/80">Scanning as: <strong className="text-white">{user.name}</strong></p>
                </div>
              </div>
              <button onClick={() => { stopCamera(); setPhase('idle') }}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          )}

          {/* SCANNING */}
          {phase === 'scanning' && (
            <div className="flex flex-col items-center gap-5 py-10">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-red-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-red-600 animate-spin" />
                <Scan size={26} className="absolute inset-0 m-auto text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-800">Identifying patient…</p>
                <p className="text-xs text-slate-500 mt-1">ArcFace AI comparing facial embeddings</p>
              </div>
            </div>
          )}

          {/* RESULT */}
          {phase === 'result' && result && (
            <div className="space-y-4">
              {/* Match confirmation */}
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
                <CheckCircle size={22} className="text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-emerald-800">Patient Identified</p>
                  <p className="text-emerald-600 text-xs mt-0.5">
                    {result.patient_name} · Match confidence: <strong>{result.confidence}%</strong>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-emerald-500 uppercase font-bold">Scanned by</p>
                  <p className="text-xs font-semibold text-emerald-700">{user.name}</p>
                </div>
              </div>

              {/* Notification sent banner */}
              <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                <Bell size={14} className="text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700">
                  Patient <strong>{result.patient_name}</strong> has been notified of this access by <strong>{user.name}</strong>.
                </p>
              </div>

              {/* Critical medical data */}
              <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <div className="bg-red-600 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={15} className="text-white" />
                    <p className="text-white font-bold text-xs uppercase tracking-wider">Critical Medical Information</p>
                  </div>
                  <span className="text-red-200 text-[10px]">
                    {result.last_updated ? `Updated ${new Date(result.last_updated).toLocaleDateString('en-IN')}` : ''}
                  </span>
                </div>

                <div className="p-5 space-y-3">
                  {/* Blood group — most critical */}
                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                    <Droplets size={22} className="text-red-600 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Blood Group</p>
                      <p className="text-4xl font-black text-red-600">{result.blood_group || 'Unknown'}</p>
                    </div>
                  </div>

                  <DataRow
                    icon={AlertTriangle} iconCls="text-orange-500"
                    label="⚠ Allergies — DO NOT administer"
                    value={result.allergies?.length ? result.allergies.join(', ') : 'None known'}
                    highlight={result.allergies?.length > 0}
                    valueCls={result.allergies?.length ? 'text-orange-700 font-bold text-sm' : 'text-slate-500 text-sm'}
                  />
                  <DataRow
                    icon={Pill} iconCls="text-blue-500"
                    label="Current Medicines"
                    value={result.current_medicines?.length ? result.current_medicines.join(', ') : 'None on record'}
                  />
                  <DataRow
                    icon={Heart} iconCls="text-purple-500"
                    label="Chronic Conditions"
                    value={result.chronic_diseases?.length ? result.chronic_diseases.join(', ') : 'None on record'}
                  />
                  <DataRow
                    icon={Phone} iconCls="text-teal-500"
                    label="Emergency Contact"
                    value={result.emergency_contact_name
                      ? `${result.emergency_contact_name}  ·  ${result.emergency_contact_number}`
                      : 'Not provided'}
                    valueCls="text-teal-700 font-semibold text-sm"
                  />
                </div>

                <div className="bg-slate-50 border-t border-slate-100 px-5 py-2.5 flex items-center gap-2">
                  <Clock size={11} className="text-slate-400" />
                  <p className="text-[10px] text-slate-500">
                    Emergency data only · Full medical history requires patient consent ·
                    Accessed by {user.name} at {new Date().toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {result.emergency_contact_number && (
                  <a href={`tel:${result.emergency_contact_number}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors">
                    <Phone size={16} /> Call Emergency Contact
                  </a>
                )}
                <button onClick={reset}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors">
                  <RefreshCw size={15} /> Scan Another Patient
                </button>
              </div>
            </div>
          )}

          {/* ERROR */}
          {phase === 'error' && (
            <div className="text-center space-y-4 py-6">
              <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-1">Identification Failed</p>
                <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">{errMsg}</p>
              </div>
              <div className="flex gap-3 max-w-xs mx-auto">
                <button onClick={startCamera}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                  <RefreshCw size={14} /> Try Again
                </button>
                <button onClick={reset}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Face scan failed? Use the patient's <strong>Emergency QR code</strong> as backup.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Audit note */}
      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <Shield size={14} className="text-slate-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500 leading-relaxed">
          Every face scan attempt — successful or failed — is permanently logged with your name, role, timestamp, and IP address. Patients are notified of all access. This tool is restricted to verified hospital staff only.
        </p>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

function ScanFaceIcon() {
  return (
    <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
      <Scan size={16} className="text-red-600" />
    </div>
  )
}

function DataRow({ icon: Icon, iconCls, label, value, valueCls = 'text-slate-700 text-sm', highlight }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl ${highlight ? 'bg-orange-50 border border-orange-100' : 'bg-slate-50 border border-slate-100'}`}>
      <Icon size={15} className={`${iconCls} mt-0.5 shrink-0`} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className={`break-words ${valueCls}`}>{value}</p>
      </div>
    </div>
  )
}
