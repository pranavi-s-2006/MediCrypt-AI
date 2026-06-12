import { useState, useEffect } from 'react'
import {
  Shield, RefreshCw, Droplets, AlertTriangle, Pill,
  Heart, Phone, Info, Camera, Plus, Save, Edit2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import QRCode from 'react-qr-code'
import {
  getEmergencyProfile, generateEmergencyQR,
  createEmergencyProfile, updateEmergencyProfile
} from '../services/api'
import { extractError } from '../hooks/useApi'
import { PageLoader, InlineLoader } from '../components/Loader'
import { InlineError } from '../components/ApiError'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  patient_name: '', blood_group: '', allergies: [],
  chronic_diseases: [], current_medicines: [],
  emergency_contact_name: '', emergency_contact_number: '',
}

export default function EmergencyQRPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [profile,    setProfile]    = useState(null)
  const [pageLoad,   setPageLoad]   = useState(true)
  const [editing,    setEditing]    = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState('')

  // Load profile on mount
  useEffect(() => {
    getEmergencyProfile()
      .then(r => {
        setProfile(r.data)
        if (!r.data || !r.data.blood_group) setEditing(true)
        if (r.data) setForm({ ...EMPTY_FORM, ...r.data })
      })
      .catch(err => {
        if (err.response?.status === 404) {
          // No profile yet — open create form
          setEditing(true)
          setForm({ ...EMPTY_FORM, patient_name: user.name || '' })
        }
      })
      .finally(() => setPageLoad(false))
  }, [])

  const setArr = (key) => (e) =>
    setForm(p => ({ ...p, [key]: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let res
      if (profile) {
        res = await updateEmergencyProfile(form)
      } else {
        res = await createEmergencyProfile(form)
      }
      setProfile(res.data)
      setEditing(false)
      toast.success('Emergency profile saved')
      // Auto-generate QR after save
      handleGenerateQR(res.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateQR = async (currentProfile = profile) => {
    if (!currentProfile?.blood_group) {
      toast.error('Complete your emergency profile first')
      setEditing(true)
      return
    }
    setGenerating(true)
    try {
      const res = await generateEmergencyQR()
      setProfile(res.data)
      toast.success('Emergency QR regenerated')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setGenerating(false)
    }
  }

  // QR encodes the public scan URL
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const qrValue = profile ? `${apiBase}/emergency/scan/${profile.patient_id}` : ''

  const downloadQR = () => {
    const svg = document.getElementById('eq-qr')
    if (!svg) return
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `medicrypt-emergency-qr.svg`
    a.click()
  }

  if (pageLoad) return <PageLoader text="Loading emergency profile…" />

  return (
    <div className="space-y-5 pb-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield size={22} className="text-red-600" /> Emergency Profile & QR
          </h1>
          <p className="page-subtitle">Critical data for first responders — scan QR or use Face ID</p>
        </div>
        {profile?.blood_group && !editing && (
          <button onClick={() => { setForm({ ...EMPTY_FORM, ...profile }); setEditing(true) }}
            className="btn-secondary btn-sm flex items-center gap-1.5">
            <Edit2 size={13} /> Edit Profile
          </button>
        )}
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">
          The QR code and Face ID contain <strong>only critical, life-saving data</strong>. Full medical history requires authorised clinician access.
        </p>
      </div>

      {/* ── Edit / Create form ── */}
      {editing && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <p className="section-title">{profile ? 'Update Emergency Profile' : 'Create Emergency Profile'}</p>
          </div>
          <form onSubmit={handleSave} className="card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Patient Name</label>
                <input className="input" value={form.patient_name}
                  onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Blood Group</label>
                <select className="input" value={form.blood_group}
                  onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))} required>
                  <option value="">Select…</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Emergency Contact Name</label>
                <input className="input" value={form.emergency_contact_name}
                  onChange={e => setForm(p => ({ ...p, emergency_contact_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Emergency Contact Number</label>
                <input className="input" type="tel" value={form.emergency_contact_number}
                  onChange={e => setForm(p => ({ ...p, emergency_contact_number: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Allergies (comma separated)</label>
                <input className="input" placeholder="e.g. Penicillin, Sulfa drugs"
                  value={form.allergies.join(', ')} onChange={setArr('allergies')} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Chronic Diseases (comma separated)</label>
                <input className="input" placeholder="e.g. Type 2 Diabetes, Hypertension"
                  value={form.chronic_diseases.join(', ')} onChange={setArr('chronic_diseases')} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Current Medicines (comma separated)</label>
                <input className="input" placeholder="e.g. Metformin 500mg, Amlodipine 5mg"
                  value={form.current_medicines.join(', ')} onChange={setArr('current_medicines')} />
              </div>
            </div>

            <InlineError error={error} />

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
                {saving ? <InlineLoader /> : <Save size={14} />}
                {saving ? 'Saving…' : 'Save & Generate QR'}
              </button>
              {profile && (
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── Profile display + QR ── */}
      {profile?.blood_group && !editing && (
        <>
          {/* Critical data summary */}
          <div className="card overflow-hidden">
            <div className="bg-red-600 px-5 py-3 flex items-center justify-between">
              <p className="text-white text-xs font-bold uppercase tracking-wider">Critical Medical Data</p>
              <span className="text-red-200 text-xs">
                Updated: {profile.last_updated ? new Date(profile.last_updated).toLocaleDateString('en-IN') : '—'}
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { icon: Droplets,      label: 'Blood Group',       value: profile.blood_group,                                   color: 'text-red-600 font-black text-xl' },
                { icon: AlertTriangle, label: 'Allergies',         value: profile.allergies?.join(', ')        || 'None',        color: 'text-orange-700 font-semibold text-xs' },
                { icon: Pill,          label: 'Medicines',         value: `${profile.current_medicines?.length || 0} listed`,    color: 'text-blue-600 font-semibold' },
                { icon: Heart,         label: 'Chronic Conditions',value: profile.chronic_diseases?.join(', ') || 'None',        color: 'text-purple-600 text-xs' },
                { icon: Phone,         label: 'Emergency Contact', value: profile.emergency_contact_name        || '—',          color: 'text-teal-600 font-semibold text-xs' },
                { icon: Phone,         label: 'Contact Number',    value: profile.emergency_contact_number      || '—',          color: 'text-teal-700 font-semibold' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <item.icon size={14} className={`${item.color.includes('text-') ? item.color.split(' ')[0] : 'text-slate-400'} mt-0.5 shrink-0`} />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</p>
                    <p className={`mt-0.5 ${item.color}`}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* QR Code */}
          {qrValue && (
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-3 flex items-center gap-2">
                <Shield size={16} className="text-white" />
                <p className="text-white font-bold text-sm">EMERGENCY QR CODE</p>
                <span className="ml-auto text-red-200 text-xs">Scan with any camera</span>
              </div>
              <div className="p-6 flex flex-col sm:flex-row gap-6 items-start">
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="p-3 bg-white border-2 border-red-200 rounded-xl shadow-sm">
                    <QRCode id="eq-qr" value={qrValue} size={160} level="H" />
                  </div>
                  <div className="flex gap-2 w-full">
                    <button onClick={downloadQR} className="flex-1 btn-secondary btn-sm text-xs">
                      ⬇ Download
                    </button>
                    <button onClick={() => window.print()} className="flex-1 btn-secondary btn-sm text-xs">
                      🖨 Print
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center max-w-[170px] leading-relaxed">
                    Scanning opens emergency data with no login required
                  </p>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">QR encodes this URL:</p>
                  <code className="block text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-500 break-all">{qrValue}</code>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">
                    When scanned, shows blood group, allergies, medicines, and emergency contact — <strong>no login needed</strong>.
                  </p>
                  <button onClick={() => handleGenerateQR()} disabled={generating}
                    className="btn-secondary btn-sm flex items-center gap-1.5 mt-3">
                    <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
                    {generating ? 'Regenerating…' : 'Regenerate QR'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Face ID link */}
          <div className="card p-5 flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Camera size={20} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">Emergency Face ID</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Register your face so responders can identify you without scanning a QR code — even if you are unconscious.
              </p>
            </div>
            <Link to="/patient/face-id" className="btn-primary btn-sm shrink-0 flex items-center gap-1.5">
              <Camera size={13} /> Set Up
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
