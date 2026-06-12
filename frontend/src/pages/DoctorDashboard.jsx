import { useState, useEffect, useRef } from 'react'
import {
  Stethoscope, Users, AlertTriangle, FileText, Clock,
  Award, Building2, CheckCircle, XCircle, RefreshCw,
  Wifi, WifiOff, Shield, Info, X, Pill, Plus, Trash2,
  ChevronRight, Activity, UserCheck, Pencil, Save
} from 'lucide-react'
import StatCard          from '../components/StatCard'
import MedicalRecordCard from '../components/MedicalRecordCard'
import { PageLoader }    from '../components/Loader'
import { ApiError, ApiEmpty } from '../components/ApiError'
import { useApi, extractError } from '../hooks/useApi'
import {
  getDoctorProfile, getDoctorDrugAlerts,
  getDoctorQueue, getConsultationRecords, savePrescription,
  saveDoctorProfile,
} from '../services/api'
import toast from 'react-hot-toast'

// ── helpers ───────────────────────────────────────────────
const STATUS_STYLE = {
  waiting:        'bg-amber-100 text-amber-700',
  in_consultation:'bg-blue-100 text-blue-700',
  completed:      'bg-emerald-100 text-emerald-700',
}
const STATUS_LABEL = {
  waiting:        '⏳ Waiting',
  in_consultation:'🩺 In Consultation',
  completed:      '✓ Completed',
}

function ApiPill({ loading, error }) {
  if (loading) return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Fetching…
    </span>
  )
  if (error) return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
      <WifiOff size={10} /> Error
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
      <Wifi size={10} /> Live
    </span>
  )
}

// ── Consultation Panel ────────────────────────────────────
function ConsultationPanel({ queueEntry, onClose }) {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [medicines,  setMedicines]  = useState([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  const [rxNotes,    setRxNotes]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [rxSaved,    setRxSaved]    = useState(false)
  const [activeTab,  setActiveTab]  = useState('records')

  useEffect(() => {
    getConsultationRecords(queueEntry._id)
      .then(r => setData(r.data))
      .catch(err => setError(extractError(err)))
      .finally(() => setLoading(false))
  }, [queueEntry._id])

  const addMed    = () => setMedicines(m => [...m, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  const removeMed = (i) => setMedicines(m => m.filter((_, idx) => idx !== i))
  const updateMed = (i, field, val) => setMedicines(m => m.map((med, idx) => idx === i ? { ...med, [field]: val } : med))

  const handleSave = async () => {
    const valid = medicines.filter(m => m.name.trim())
    if (!valid.length) { toast.error('Add at least one medicine'); return }
    setSaving(true)
    try {
      await savePrescription({ queue_id: queueEntry._id, medicines: valid, notes: rxNotes })
      toast.success('Prescription saved to patient record!')
      setRxSaved(true)
    } catch (err) { toast.error(extractError(err)) }
    finally { setSaving(false) }
  }

  const patient = data?.patient || {}
  const records = data?.records || []
  const prescriptions = data?.prescriptions || []

  const TABS = [
    { id: 'records',      label: 'Medical Records',  count: records.length },
    { id: 'prescriptions',label: 'Past Prescriptions', count: prescriptions.length },
    { id: 'prescription', label: '+ Write Prescription', count: null },
  ]

  return (
    <div className="card overflow-hidden border-2 border-blue-200">
      {/* Panel header */}
      <div className="bg-gradient-to-r from-blue-600 to-teal-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {(patient.name || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold">{patient.name || queueEntry.patient_id}</p>
              <p className="text-blue-200 text-xs">
                Token #{queueEntry.queue_no} · {patient.age || '—'} yrs · Blood: {patient.blood_group || '—'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Patient vitals strip */}
      {(patient.allergies?.length > 0 || patient.chronic_diseases?.length > 0) && (
        <div className="flex items-center gap-4 px-5 py-2.5 bg-red-50 border-b border-red-100 flex-wrap">
          {patient.allergies?.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
              <AlertTriangle size={11} /> Allergies: {patient.allergies.join(', ')}
            </span>
          )}
          {patient.chronic_diseases?.length > 0 && (
            <span className="text-xs text-orange-700 font-medium">
              Conditions: {patient.chronic_diseases.join(', ')}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading patient records…</div>
      ) : error ? (
        <div className="p-6 text-center text-red-500 text-sm">{error}</div>
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-slate-100 px-1 pt-1 flex overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.id ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {t.label}
                {t.count !== null && <span className="badge-gray ml-1">{t.count}</span>}
                {t.id === 'prescription' && rxSaved && <span className="badge-green ml-1">Saved ✓</span>}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* Medical Records */}
            {activeTab === 'records' && (
              records.length === 0
                ? <div className="py-8 text-center text-slate-400 text-sm">No medical records uploaded yet.</div>
                : <div className="space-y-2">{records.map(r => <MedicalRecordCard key={r._id} record={r} />)}</div>
            )}

            {/* Past Prescriptions */}
            {activeTab === 'prescriptions' && (
              prescriptions.length === 0
                ? <div className="py-8 text-center text-slate-400 text-sm">No past prescriptions.</div>
                : <div className="space-y-3">
                    {prescriptions.map((rx, i) => (
                      <div key={rx._id} className="border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                            Prescription {i + 1}
                          </span>
                          <span className="text-xs text-slate-400">
                            {rx.created_at ? new Date(rx.created_at).toLocaleDateString('en-IN') : '—'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(rx.medicines || rx.new_medicines || []).map((m, j) => (
                            <span key={j} className="badge-blue text-xs">{m.name} {m.dosage || ''}</span>
                          ))}
                        </div>
                        {rx.notes && <p className="text-xs text-slate-500 mt-2 italic">{rx.notes}</p>}
                      </div>
                    ))}
                  </div>
            )}

            {/* Write Prescription */}
            {activeTab === 'prescription' && (
              <div className="space-y-4">
                {rxSaved && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-800 font-medium">Prescription saved successfully to patient record.</p>
                  </div>
                )}

                <div className="space-y-2">
                  {medicines.map((med, i) => (
                    <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <input className="input text-xs col-span-2 sm:col-span-1" placeholder="Medicine name *"
                        value={med.name} onChange={e => updateMed(i, 'name', e.target.value)} />
                      <input className="input text-xs" placeholder="Dosage (e.g. 500mg)"
                        value={med.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)} />
                      <input className="input text-xs" placeholder="Frequency (e.g. 1-0-1)"
                        value={med.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} />
                      <input className="input text-xs" placeholder="Duration (e.g. 5 days)"
                        value={med.duration} onChange={e => updateMed(i, 'duration', e.target.value)} />
                      <div className="flex gap-1">
                        <input className="input text-xs flex-1" placeholder="Instructions"
                          value={med.instructions} onChange={e => updateMed(i, 'instructions', e.target.value)} />
                        {medicines.length > 1 && (
                          <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600 px-1">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={addMed} className="btn-secondary btn-sm flex items-center gap-1.5">
                  <Plus size={13} /> Add Medicine
                </button>

                <div>
                  <label className="label">Doctor Notes</label>
                  <textarea className="input resize-none" rows={2}
                    placeholder="Additional notes, follow-up instructions…"
                    value={rxNotes} onChange={e => setRxNotes(e.target.value)} />
                </div>

                <button onClick={handleSave} disabled={saving || rxSaved}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {saving ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                  ) : (
                    <><Pill size={15} /> {rxSaved ? 'Prescription Saved ✓' : 'Save Prescription to Patient Record'}</>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────
export default function DoctorDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const { data: profile,    loading: profileLoading, error: profileError } = useApi(getDoctorProfile)
  const { data: alertsData, loading: alertsLoading                        } = useApi(getDoctorDrugAlerts)
  const { data: queueData,  loading: queueLoading,   refresh: refreshQueue } = useApi(getDoctorQueue)

  const drugAlerts    = alertsData?.alerts  || []
  const queue         = queueData?.queue    || []
  const waiting       = queueData?.waiting  || []
  const current       = queueData?.current  || null
  const nextPatient   = queueData?.next     || null
  const completedCount= queueData?.completed_count || 0

  const [openConsult, setOpenConsult] = useState(null)
  const [activeTab,   setActiveTab]   = useState('queue')

  // Profile setup
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({})
  const [savingProf,  setSavingProf]  = useState(false)

  const startEditProfile = () => {
    setProfileForm({
      name:           profile?.name           || user.name || '',
      specialization: profile?.specialization || '',
      qualification:  profile?.qualification  || '',
      license_number: profile?.license_number || '',
      hospital_id:    profile?.hospital_id    || '',
      hospital:       profile?.hospital       || '',
      department:     profile?.department     || '',
      experience:     profile?.experience     || '',
    })
    setEditProfile(true)
  }

  const handleSaveProfile = async () => {
    setSavingProf(true)
    try {
      await saveDoctorProfile(profileForm)
      toast.success('Profile saved! Hospital admin can now see and verify you.')
      setEditProfile(false)
      window.location.reload()
    } catch (err) { toast.error(extractError(err)) }
    finally { setSavingProf(false) }
  }

  // Auto-refresh queue every 10s
  const pollRef = useRef(null)
  useEffect(() => {
    pollRef.current = setInterval(refreshQueue, 10000)
    return () => clearInterval(pollRef.current)
  }, [])

  if (profileLoading) return <PageLoader text="Loading doctor profile…" />
  if (profileError)   return <ApiError error={profileError} />

  const TABS = [
    { id: 'queue',  label: 'Patient Queue',                 icon: Users },
    { id: 'alerts', label: `Drug Alerts (${drugAlerts.length})`, icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Doctor Dashboard</h1>
          <p className="page-subtitle">Dr. {user.name} · {profile?.specialization || '—'} · {profile?.department || '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          <ApiPill loading={queueLoading || alertsLoading} error={null} />
          <button onClick={refreshQueue} className="btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Doctor profile card */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-blue-600 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-xl font-bold">
              {user.name?.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('') || 'DR'}
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-lg">Dr. {user.name}</p>
              <p className="text-teal-200 text-sm">{profile?.qualification || '—'} · {profile?.specialization || '—'}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-white/80"><Building2 size={11} /> {profile?.hospital || '—'}</span>
                {profile?.license_number && <span className="flex items-center gap-1 text-xs text-white/80"><Award size={11} /> {profile.license_number}</span>}
              </div>
            </div>
            <div className="hidden sm:block">
              {profile?.is_verified
                ? <span className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full"><CheckCircle size={12} /> Verified</span>
                : <span className="flex items-center gap-1.5 bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full"><Clock size={12} /> Pending Verification</span>}
              <button onClick={startEditProfile} className="mt-2 flex items-center gap-1 text-white/70 hover:text-white text-xs">
                <Pencil size={11} /> Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile setup banner — shown when hospital_id not set */}
      {!profile?.hospital_id && !editProfile && (
        <div className="flex items-start justify-between gap-4 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Complete your profile to appear in the hospital system</p>
              <p className="text-xs text-amber-700 mt-0.5">
                You need to enter your Hospital ID so the hospital admin can find and verify you.
                Without this, you won't appear in any hospital's doctor list.
              </p>
            </div>
          </div>
          <button onClick={startEditProfile} className="btn-primary btn-sm shrink-0 flex items-center gap-1.5">
            <Pencil size={12} /> Setup Profile
          </button>
        </div>
      )}

      {/* Profile edit form */}
      {editProfile && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <p className="section-title flex items-center gap-2"><Pencil size={15} className="text-blue-600" /> Doctor Profile Setup</p>
            <button onClick={() => setEditProfile(false)} className="btn-secondary btn-sm"><X size={13} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs text-blue-700">
                <strong>Important:</strong> Enter the Hospital ID given by your hospital admin.
                Once saved, the admin can find you under the Doctors tab and verify your account.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'name',           label: 'Full Name',          placeholder: 'Dr. John Smith' },
                { key: 'hospital_id',    label: 'Hospital ID ★',      placeholder: 'Get this from your hospital admin' },
                { key: 'hospital',       label: 'Hospital Name',      placeholder: 'e.g. Apollo Hospital' },
                { key: 'specialization', label: 'Specialization',     placeholder: 'e.g. Cardiology' },
                { key: 'qualification',  label: 'Qualification',      placeholder: 'e.g. MBBS, MD' },
                { key: 'department',     label: 'Department',         placeholder: 'e.g. Cardiology' },
                { key: 'license_number', label: 'Medical Licence No.', placeholder: 'e.g. MCI-12345' },
                { key: 'experience',     label: 'Experience',         placeholder: 'e.g. 10 years' },
              ].map(f => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <input className="input" placeholder={f.placeholder}
                    value={profileForm[f.key] || ''}
                    onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleSaveProfile} disabled={savingProf} className="btn-primary flex items-center gap-2">
                {savingProf ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
                {savingProf ? 'Saving…' : 'Save Profile'}
              </button>
              <button onClick={() => setEditProfile(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Waiting"         value={waiting.length}  icon={Clock}      color="orange" sub="In queue" />
        <StatCard label="In Consultation" value={current ? 1 : 0} icon={Stethoscope} color="blue"  sub={current?.patient_name || 'None'} />
        <StatCard label="Next Patient"    value={nextPatient ? `#${nextPatient.queue_no}` : '—'} icon={UserCheck} color="teal" sub={nextPatient?.patient_name || 'None'} />
        <StatCard label="Completed Today" value={completedCount}  icon={CheckCircle} color="green" sub="Today" />
      </div>

      {/* Current patient highlight */}
      {current && (
        <div className="card overflow-hidden border-2 border-blue-300">
          <div className="bg-blue-600 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope size={16} className="text-white" />
              <p className="text-white font-bold text-sm">Current Patient — Token #{current.queue_no}</p>
            </div>
            <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full font-semibold">🩺 In Consultation</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-bold text-slate-800">{current.patient_name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Reason: {current.reason} · {current.department || '—'}
                {current.age && ` · ${current.age} yrs`}
                {current.blood_group && ` · ${current.blood_group}`}
              </p>
            </div>
            {(current.file_sent || current.status === 'in_consultation') ? (
              <button onClick={() => setOpenConsult(current)}
                className="btn-primary flex items-center gap-2">
                <FileText size={15} /> Open Patient Record
              </button>
            ) : (
              <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                ⏳ Waiting for hospital to send file
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-1 pt-1">
          <div className="flex overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === id ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {/* Queue Tab */}
          {activeTab === 'queue' && (
            queueLoading ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading queue…</div>
            ) : queue.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Users size={36} className="text-slate-200 mx-auto" />
                <p className="text-slate-400 text-sm">No patients in queue today.</p>
                <p className="text-xs text-slate-400">The hospital will add patients once they check in and get approved.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Token', 'Patient', 'Reason', 'Department', 'Status', 'Action'].map(h => (
                        <th key={h} className="text-left text-xs font-bold text-slate-500 uppercase tracking-wide px-3 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {queue.map(entry => (
                      <tr key={entry._id} className={`hover:bg-slate-50 transition-colors ${entry.status === 'in_consultation' ? 'bg-blue-50/40' : ''}`}>
                        <td className="px-3 py-3">
                          <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-700">
                            {entry.queue_no}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-800">
                            {entry.patient_name && entry.patient_name !== entry.patient_id
                              ? entry.patient_name
                              : <span className="text-slate-400 text-xs font-mono">{entry.patient_id?.slice(-8)}</span>}
                          </p>
                          <p className="text-xs text-slate-400 font-mono">{entry.patient_id?.slice(-8)}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-600 text-xs max-w-[140px] truncate">{entry.reason}</td>
                        <td className="px-3 py-3 text-slate-500 text-xs">{entry.department || '—'}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[entry.status] || 'bg-slate-100 text-slate-600'}`}>
                            {STATUS_LABEL[entry.status] || entry.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {(entry.file_sent || entry.status === 'in_consultation') ? (
                            <button onClick={() => setOpenConsult(entry)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
                              <FileText size={12} /> View Record
                            </button>
                          ) : entry.status === 'completed' ? (
                            <span className="text-xs text-slate-400">Completed</span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium">Waiting for hospital</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            alertsLoading ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading alerts…</div>
            ) : drugAlerts.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle size={32} className="text-emerald-300 mx-auto" />
                <p className="text-slate-400 text-sm">No high-risk drug alerts.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {drugAlerts.map(r => <MedicalRecordCard key={r._id} record={r} />)}
              </div>
            )
          )}
        </div>
      </div>

      {/* Consultation Panel — shown below queue when a patient is opened */}
      {openConsult && (
        <ConsultationPanel
          key={openConsult._id}
          queueEntry={openConsult}
          onClose={() => setOpenConsult(null)}
        />
      )}
    </div>
  )
}
