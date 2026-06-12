import { useState } from 'react'
import { ScanFace, ShieldCheck, ShieldOff, AlertTriangle, CheckCircle, Trash2, Upload } from 'lucide-react'
import WebcamCapture from '../components/WebcamCapture'
import { PageLoader } from '../components/Loader'
import { useApi, extractError } from '../hooks/useApi'
import { enrollFace, getFaceConsent, revokeFaceConsent } from '../services/api'
import toast from 'react-hot-toast'

export default function FaceEnrollPage() {
  const { data: consent, loading, refresh } = useApi(getFaceConsent)
  const [consented,  setConsented]  = useState(false)
  const [enrolling,  setEnrolling]  = useState(false)
  const [revoking,   setRevoking]   = useState(false)
  const [useWebcam,  setUseWebcam]  = useState(true)
  const [fileBlob,   setFileBlob]   = useState(null)
  const [fileName,   setFileName]   = useState('')

  const handleEnroll = async (blob) => {
    if (!consented) {
      toast.error('Please give consent before enrolling your face.')
      return
    }
    setEnrolling(true)
    try {
      const fd = new FormData()
      fd.append('file', blob, 'face.jpg')
      await enrollFace(fd)
      toast.success('Face enrolled successfully!')
      refresh()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setEnrolling(false)
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFileBlob(f)
    setFileName(f.name)
  }

  const handleFileEnroll = async () => {
    if (!fileBlob) { toast.error('Please select a photo first.'); return }
    await handleEnroll(fileBlob)
  }

  const handleRevoke = async () => {
    if (!window.confirm('Remove your face data? You will no longer be identifiable by face scan.')) return
    setRevoking(true)
    try {
      await revokeFaceConsent()
      toast.success('Face data removed.')
      refresh()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setRevoking(false)
    }
  }

  if (loading) return <PageLoader text="Checking enrollment status…" />

  return (
    <div className="space-y-5 max-w-2xl pb-8">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <ScanFace size={24} className="text-blue-600" /> Face Emergency ID
        </h1>
        <p className="page-subtitle mt-1">
          Backup identification method — used only when QR code is unavailable
        </p>
      </div>

      {/* Prototype banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
        <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">
          <strong>Prototype / Demo feature.</strong> Emergency QR code is the primary and most reliable identification method.
          Face scan is a backup — accuracy depends on lighting and camera quality.
        </p>
      </div>

      {/* Current status */}
      {consent?.enrolled ? (
        <div className="card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-emerald-800 text-sm">Face Enrolled</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Enrolled on {consent.enrolled_at ? new Date(consent.enrolled_at).toLocaleString('en-IN') : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Emergency responders can identify you by face scan if your QR code is unavailable.
            </p>
          </div>
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="btn-secondary btn-sm flex items-center gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 size={13} /> {revoking ? 'Removing…' : 'Revoke'}
          </button>
        </div>
      ) : (
        <div className="card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <ShieldOff size={20} className="text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">Not Enrolled</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Your face is not registered. Enroll below to enable face-based emergency identification.
            </p>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="card p-5 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <ShieldCheck size={12} /> How it works
        </p>
        <ul className="space-y-2">
          {[
            'Your photo is processed on the server using insightface (ArcFace ONNX) — a 512-number embedding is stored in MongoDB, never the raw photo.',
            'In an emergency, a hospital scanner sends a webcam frame; the server compares it against stored embeddings using cosine similarity.',
            'Only minimum emergency details are shown on match — no full medical history.',
            'Every scan is logged in the audit trail with timestamp and IP address.',
            'You can revoke consent and delete your face data at any time.',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Consent checkbox */}
      <label className="flex items-start gap-3 cursor-pointer card p-4 hover:bg-slate-50 transition-colors">
        <input
          type="checkbox"
          checked={consented}
          onChange={e => setConsented(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-blue-600"
        />
        <span className="text-sm text-slate-700 leading-relaxed">
          <strong>I give consent for emergency face identification.</strong> I understand this feature is only to be used in accident or emergency situations by authorised hospital staff, and that every scan is logged in the audit trail.
        </span>
      </label>

      {/* Enroll section */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">
            {consent?.enrolled ? 'Re-enroll Face' : 'Enroll Your Face'}
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setUseWebcam(true)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${useWebcam ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Webcam
            </button>
            <button
              onClick={() => setUseWebcam(false)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${!useWebcam ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Upload Photo
            </button>
          </div>
        </div>

        {useWebcam ? (
          <>
            <p className="text-xs text-slate-500">Position your face in the centre and click Capture.</p>
            <WebcamCapture
              captureLabel={enrolling ? 'Enrolling…' : 'Capture & Enroll'}
              onCapture={handleEnroll}
            />
            {!consented && (
              <p className="text-xs text-red-500">Please check the consent box above before capturing.</p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Upload a clear front-facing photo (JPG/PNG, max 5 MB).</p>
            <label className="flex items-center gap-3 border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 transition-colors">
              <Upload size={18} className="text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">{fileName || 'Choose photo…'}</p>
                <p className="text-xs text-slate-400">JPG or PNG, front-facing, single face only</p>
              </div>
              <input type="file" accept="image/jpeg,image/png" onChange={handleFileChange} className="hidden" />
            </label>
            <button
              onClick={handleFileEnroll}
              disabled={!fileBlob || enrolling || !consented}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <ScanFace size={14} className={enrolling ? 'animate-pulse' : ''} />
              {enrolling ? 'Enrolling…' : 'Enroll Face'}
            </button>
            {!consented && (
              <p className="text-xs text-red-500">Please check the consent box above before enrolling.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
