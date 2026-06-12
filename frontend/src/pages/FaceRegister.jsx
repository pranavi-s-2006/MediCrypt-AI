import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Camera, CheckCircle, Trash2, ShieldCheck, RefreshCw,
  User, Info, Droplets, AlertTriangle, Pill, Heart,
  Phone, Save, Edit2, Shield, Scan
} from 'lucide-react'
import {
  registerFace, getFaceStatus, revokeFace,
  getEmergencyProfile, createEmergencyProfile, updateEmergencyProfile,
  generateEmergencyQR,
} from '../services/api'
import { extractError } from '../hooks/useApi'
import { InlineError } from '../components/ApiError'
import { PageLoader, InlineLoader } from '../components/Loader'
import toast from 'react-hot-toast'

const EMPTY_PROFILE = {
  patient_name: '', blood_group: '',
  allergies: [], chronic_diseases: [], current_medicines: [],
  emergency_contact_name: '', emergency_contact_number: '',
}

/* ─────────────────────────────────────────────
   STEP 1 — Emergency Profile Form
───────────────────────────────────────────── */
function EmergencyProfileForm({ initial, onSaved }) {
  const [form,    setForm]    = useState({ ...EMPTY_PROFILE, ...initial })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  // Pre-fill name from logged-in user
  useEffect(() => {
    if (!form.patient_name && user.name) setForm(p => ({ ...p, patient_name: user.name }))
  }, [])

  const setArr = (key) => (e) =>
    setForm(p => ({ ...p, [key]: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.blood_group) { setError('Blood group is required.'); return }
    setSaving(true); setError('')
    try {
      let res
      if (initial?._id) {
        res = await updateEmergencyProfile(form)
      } else {
        res = await createEmergencyProfile(form)
      }
      // Also generate QR
      try { await generateEmergencyQR() } catch { /* non-fatal */ }
      toast.success('Emergency profile saved')
      onSaved(res.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Your Full Name</label>
          <input className="input" value={form.patient_name}
            onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Blood Group <span className="text-red-500">*</span></label>
          <select className="input" value={form.blood_group}
            onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))} required>
            <option value="">Select blood group…</option>
            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Emergency Contact Name</label>
          <input className="input" placeholder="e.g. Kavitha Kumar (Wife)"
            value={form.emergency_contact_name}
            onChange={e => setForm(p => ({ ...p, emergency_contact_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Emergency Contact Number</label>
          <input className="input" type="tel" placeholder="+91 98765 00001"
            value={form.emergency_contact_number}
            onChange={e => setForm(p => ({ ...p, emergency_contact_number: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Allergies <span className="text-slate-400 font-normal normal-case">(comma separated)</span></label>
          <input className="input" placeholder="e.g. Penicillin, Sulfa drugs, Aspirin"
            value={form.allergies.join(', ')} onChange={setArr('allergies')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Chronic Diseases <span className="text-slate-400 font-normal normal-case">(comma separated)</span></label>
          <input className="input" placeholder="e.g. Type 2 Diabetes, Hypertension"
            value={form.chronic_diseases.join(', ')} onChange={setArr('chronic_diseases')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Current Medicines <span className="text-slate-400 font-normal normal-case">(comma separated)</span></label>
          <input className="input" placeholder="e.g. Metformin 500mg, Amlodipine 5mg"
            value={form.current_medicines.join(', ')} onChange={setArr('current_medicines')} />
        </div>
      </div>

      <InlineError error={error} />

      <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2" disabled={saving}>
        {saving ? <InlineLoader /> : <Save size={15} />}
        {saving ? 'Saving…' : 'Save Emergency Profile'}
      </button>
    </form>
  )
}

/* ─────────────────────────────────────────────
   STEP 2 — Face Registration Camera
───────────────────────────────────────────── */
function FaceCamera({ onRegistered }) {
  const videoRef     = useRef(null)
  const canvasRef    = useRef(null)
  const streamRef    = useRef(null)

  const [camActive,    setCamActive]    = useState(false)
  const [captured,     setCaptured]     = useState(null)
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [consented,    setConsented]    = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [error,        setError]        = useState('')

  // Attach stream to video element AFTER camActive=true causes <video> to render
  useEffect(() => {
    if (camActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [camActive])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamActive(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const startCamera = async () => {
    setError('')
    setCaptured(null)
    setCapturedBlob(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser. Use Chrome or Firefox over HTTPS.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      // Set camActive FIRST to render the <video> element,
      // then useEffect above will attach srcObject after the DOM update.
      setCamActive(true)
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Click Allow when the browser asks.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : err.name === 'NotReadableError'
        ? 'Camera is in use by another app. Close it and try again.'
        : `Camera error: ${err.message}`
      setError(msg)
    }
  }

  const captureFrame = () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    setCaptured(canvas.toDataURL('image/jpeg', 0.92))
    canvas.toBlob(blob => setCapturedBlob(blob), 'image/jpeg', 0.92)
    stopCamera()
  }

  const handleRegister = async () => {
    if (!capturedBlob || !consented) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', capturedBlob, 'face.jpg')
      const res = await registerFace(fd)
      toast.success(res.data.message || 'Face registered!')
      onRegistered()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Tips */}
      <div className="grid grid-cols-2 gap-2">
        {[
          'Look directly at the camera',
          'Good even lighting on your face',
          'Remove glasses or hats if possible',
          'Keep your full face in the frame',
        ].map(t => (
          <div key={t} className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle size={11} className="text-teal-500 shrink-0" /> {t}
          </div>
        ))}
      </div>

      {/* Camera viewport */}
      <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
        {!camActive && !captured && (
          <div className="text-center space-y-3 p-6">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <Camera size={28} className="text-white/50" />
            </div>
            <p className="text-white/60 text-sm">Camera is off</p>
            <button onClick={startCamera} className="btn-primary btn-sm">
              <Camera size={13} /> Open Camera
            </button>
          </div>
        )}

        {camActive && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onCanPlay={e => e.target.play().catch(() => {})}
            />
            {/* Oval face guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-44 h-60 border-2 border-blue-400 rounded-full"
                style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} />
            </div>
            {/* Align text */}
            <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
              <span className="bg-blue-600/70 text-white text-[11px] font-semibold px-3 py-1 rounded-full">
                Align face inside the oval
              </span>
            </div>
            {/* Capture button */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
              <button onClick={captureFrame}
                className="w-16 h-16 rounded-full bg-white border-4 border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center shadow-xl">
                <Camera size={22} className="text-blue-600" />
              </button>
              <button onClick={stopCamera}
                className="px-4 py-2 rounded-full bg-black/50 text-white text-xs font-medium hover:bg-black/70">
                Cancel
              </button>
            </div>
          </>
        )}

        {captured && (
          <img src={captured} alt="Captured face" className="w-full h-full object-cover" />
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Post-capture actions */}
      {captured && (
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0" />
            <span className="text-xs text-slate-600 leading-relaxed">
              I consent to storing my face embedding for emergency identification.
              Emergency responders can use this to identify me and view my critical medical data.
              I can delete this data at any time.
            </span>
          </label>

          <InlineError error={error} />

          <div className="flex gap-3">
            <button onClick={handleRegister} disabled={uploading || !consented}
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-50">
              {uploading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registering…</>
                : <><CheckCircle size={15} /> Register My Face</>
              }
            </button>
            <button onClick={() => { setCaptured(null); setCapturedBlob(null); startCamera() }}
              disabled={uploading} className="btn-secondary flex items-center gap-1.5">
              <RefreshCw size={13} /> Retake
            </button>
          </div>
        </div>
      )}

      {!captured && !camActive && <InlineError error={error} />}
    </div>
  )
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function FaceRegister() {
  const [pageLoading,  setPageLoading]  = useState(true)
  const [faceStatus,   setFaceStatus]   = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [editProfile,  setEditProfile]  = useState(false)
  const [revoking,     setRevoking]     = useState(false)

  const loadAll = async () => {
    setPageLoading(true)
    const [faceRes, profRes] = await Promise.allSettled([getFaceStatus(), getEmergencyProfile()])
    if (faceRes.status === 'fulfilled') setFaceStatus(faceRes.value.data)
    else setFaceStatus({ registered: false })
    if (profRes.status === 'fulfilled') setProfile(profRes.value.data)
    else setProfile(null)
    setPageLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const handleRevoke = async () => {
    if (!window.confirm('This will permanently delete your face data. Emergency responders will no longer be able to identify you by face scan. Continue?')) return
    setRevoking(true)
    try {
      await revokeFace()
      toast.success('Face data deleted')
      setFaceStatus({ registered: false })
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setRevoking(false)
    }
  }

  if (pageLoading) return <PageLoader text="Loading your emergency profile…" />

  const profileComplete = !!profile?.blood_group

  return (
    <div className="space-y-6 pb-10 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Scan size={22} className="text-red-600" /> Emergency Face ID
        </h1>
        <p className="page-subtitle">
          Register your face and emergency details so first responders can identify you and access critical medical data — without any login.
        </p>
      </div>

      {/* How it works */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3">
          <p className="text-white text-xs font-bold uppercase tracking-wider">How It Works</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { n: '1', icon: Save,        title: 'Fill emergency info', desc: 'Blood group, allergies, medicines, emergency contact.' },
            { n: '2', icon: Camera,      title: 'Register your face',  desc: 'AI stores a mathematical embedding — no photo saved.' },
            { n: '3', icon: ShieldCheck, title: 'Responder scans',     desc: 'First responder opens camera on Login page → instant data.' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white text-sm font-bold flex items-center justify-center shrink-0">{s.n}</div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{s.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Privacy:</strong> Only a 512-number mathematical embedding is stored — never a photo. Used only for emergency identification. You can delete it any time from this page.
        </p>
      </div>

      {/* ── STEP 1: Emergency Profile ── */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            {profileComplete
              ? <CheckCircle size={16} className="text-emerald-600" />
              : <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs font-bold text-slate-400">1</div>
            }
            <p className="section-title">Emergency Medical Profile</p>
            {profileComplete && <span className="badge-green text-xs">Saved</span>}
          </div>
          {profileComplete && !editProfile && (
            <button onClick={() => setEditProfile(true)} className="btn-secondary btn-sm flex items-center gap-1.5">
              <Edit2 size={12} /> Edit
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Saved profile summary */}
          {profileComplete && !editProfile ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { icon: Droplets,      label: 'Blood Group',    value: profile.blood_group,                                         cls: 'text-red-600 font-black text-xl' },
                { icon: AlertTriangle, label: 'Allergies',      value: profile.allergies?.join(', ')         || 'None',             cls: 'text-orange-700 text-xs' },
                { icon: Pill,          label: 'Medicines',      value: `${profile.current_medicines?.length || 0} listed`,          cls: 'text-blue-600' },
                { icon: Heart,         label: 'Conditions',     value: profile.chronic_diseases?.join(', ')  || 'None',             cls: 'text-purple-600 text-xs' },
                { icon: Phone,         label: 'Contact',        value: profile.emergency_contact_name        || '—',               cls: 'text-teal-600 text-xs' },
                { icon: Phone,         label: 'Number',         value: profile.emergency_contact_number      || '—',               cls: 'text-teal-700 font-semibold' },
              ].map(r => (
                <div key={r.label} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <r.icon size={13} className={`mt-0.5 shrink-0 ${r.cls.split(' ')[0]}`} />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{r.label}</p>
                    <p className={`text-sm mt-0.5 ${r.cls}`}>{r.value}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmergencyProfileForm
              initial={profile}
              onSaved={(saved) => { setProfile(saved); setEditProfile(false) }}
            />
          )}
        </div>
      </div>

      {/* ── STEP 2: Face Registration ── */}
      <div className={`card overflow-hidden ${!profileComplete ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="card-header">
          <div className="flex items-center gap-2">
            {faceStatus?.registered
              ? <CheckCircle size={16} className="text-emerald-600" />
              : <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs font-bold text-slate-400">2</div>
            }
            <p className="section-title">Face Registration</p>
            {faceStatus?.registered && <span className="badge-green text-xs">Active</span>}
            {!profileComplete && <span className="badge-yellow text-xs">Complete Step 1 first</span>}
          </div>
          {faceStatus?.registered && (
            <button onClick={handleRevoke} disabled={revoking}
              className="btn-danger btn-sm flex items-center gap-1.5">
              <Trash2 size={12} /> {revoking ? 'Deleting…' : 'Revoke'}
            </button>
          )}
        </div>

        <div className="p-6">
          {faceStatus?.registered ? (
            <div className="space-y-4">
              {/* Active status */}
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800 text-sm">Face ID is active</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Registered: {faceStatus.registered_at
                      ? new Date(faceStatus.registered_at).toLocaleString('en-IN')
                      : 'Date unknown'}
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    ✓ Any first responder can scan your face on the Login page to view your emergency data
                  </p>
                </div>
              </div>

              {/* Re-register option */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Want to update your photo?</p>
                <FaceCamera onRegistered={loadAll} />
              </div>
            </div>
          ) : (
            <FaceCamera onRegistered={loadAll} />
          )}
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Shield size={14} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Emergency face scan is available on the <strong>Login page</strong> — no login needed for first responders. ArcFace ONNX with cosine similarity matching. Every scan attempt is permanently logged in the audit trail.
        </p>
      </div>
    </div>
  )
}
