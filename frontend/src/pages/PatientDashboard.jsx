import { useState, useEffect } from 'react'
import {
  FileText, AlertTriangle, Activity, Pill, Droplets, Phone,
  User, Pencil, Save, X, Plus, Users, QrCode, ShieldCheck,
  Heart, MapPin, CreditCard, RefreshCw, CheckCircle, Wifi, WifiOff,
  Clock, Eye, Building2, XCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import StatCard          from '../components/StatCard'
import MedicalRecordCard from '../components/MedicalRecordCard'
import RiskAlert         from '../components/RiskAlert'
import { PageLoader }    from '../components/Loader'
import { ApiError, ApiEmpty } from '../components/ApiError'

import { useApi, extractError } from '../hooks/useApi'
import {
  getPatientProfile, updatePatientProfile,
  getPatientHistory, addCaregiver as apiAddCaregiver, getAuditLogs,
  getPatientAccessRequests, respondPatientAccessRequest
} from '../services/api'

/* ── Profile completion ─────────────────────────────────── */
const PROFILE_FIELDS = [
  { key: 'blood_group',            label: 'Blood Group' },
  { key: 'age',                    label: 'Age' },
  { key: 'allergies',              label: 'Allergies', check: v => Array.isArray(v) && v.length > 0 },
  { key: 'emergency_contact',      label: 'Emergency Contact' },
  { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
  { key: 'address',                label: 'Address' },
]

function profileCompletion(profile) {
  if (!profile) return { pct: 0, missing: PROFILE_FIELDS.map(f => f.label) }
  const missing = PROFILE_FIELDS
    .filter(f => f.check ? !f.check(profile[f.key]) : !profile[f.key])
    .map(f => f.label)
  const pct = Math.round(((PROFILE_FIELDS.length - missing.length) / PROFILE_FIELDS.length) * 100)
  return { pct, missing }
}

/* ── API status pill ────────────────────────────────────── */
function ApiStatusPill({ loading, error }) {
  if (loading) return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Fetching…
    </span>
  )
  if (error) return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
      <WifiOff size={10} /> API Error
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
      <Wifi size={10} /> Live
    </span>
  )
}

export default function PatientDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const { data: profile,     loading: profileLoading, error: profileError, refresh: refreshProfile } = useApi(getPatientProfile)
  const { data: historyData, loading: historyLoading, error: historyError, refresh: refreshHistory } = useApi(getPatientHistory)
  const { data: auditData,   loading: auditLoading,   refresh: refreshAudit }                        = useApi(getAuditLogs)
  const { data: accessData,  loading: accessLoading,  refresh: refreshAccess }                       = useApi(getPatientAccessRequests)

  const [editing,        setEditing]        = useState(false)
  const [editForm,       setEditForm]        = useState({})
  const [saving,         setSaving]          = useState(false)
  const [caregiverInput, setCaregiverInput]  = useState('')
  const [addingCare,     setAddingCare]      = useState(false)
  const [respondingId,   setRespondingId]    = useState(null)

  const records    = historyData?.records       || []
  const medicines  = profile?.medicines         || []
  const highRisk   = (profile?.drug_interactions || []).filter(i => i.level === 'High' || i.level === 'Critical')
  const auditLogs  = (auditData?.logs            || []).slice(0, 5)
  const accessRequests = accessData?.requests   || []
  const pendingAccess  = accessRequests.filter(r => r.status === 'pending')
  const { pct: completionPct, missing: missingFields } = profileCompletion(profile)

  const startEdit = () => { setEditForm({ ...profile }); setEditing(true) }

  const handleRespondAccess = async (requestId, status) => {
    setRespondingId(requestId)
    try {
      await respondPatientAccessRequest(requestId, status)
      toast.success(status === 'approved' ? 'Access approved ✓' : 'Access rejected')
      refreshAccess()
    } catch (err) {
      toast.error(extractError(err))
    } finally { setRespondingId(null) }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await updatePatientProfile(editForm)
      toast.success('Profile updated')
      setEditing(false)
      refreshProfile()
    } catch (err) {
      toast.error(extractError(err))
    } finally { setSaving(false) }
  }

  const handleAddCaregiver = async () => {
    if (!caregiverInput.trim()) return
    setAddingCare(true)
    try {
      await apiAddCaregiver(caregiverInput.trim())
      toast.success('Caregiver added')
      setCaregiverInput('')
      refreshProfile()
    } catch (err) {
      toast.error(extractError(err))
    } finally { setAddingCare(false) }
  }

  if (profileLoading) return <PageLoader text="Loading your health profile…" />
  if (profileError)   return <ApiError error={profileError} onRetry={refreshProfile} />

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Patient Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user.name} · ID: {profile?.user_id || '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          <ApiStatusPill loading={profileLoading} error={profileError} />
          <button onClick={() => { refreshProfile(); refreshHistory(); refreshAudit() }} className="btn-secondary btn-sm">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Profile Completion Warning */}
      {completionPct < 100 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <User size={16} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  Profile {completionPct}% complete
                  <span className="text-amber-600 ml-1.5">— please fill in missing details</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Missing: {missingFields.join(', ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-32 bg-slate-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${completionPct}%`,
                    background: completionPct < 50 ? '#ef4444' : completionPct < 80 ? '#f59e0b' : '#10b981'
                  }}
                />
              </div>
              <span className="text-sm font-bold text-slate-700">{completionPct}%</span>
              <button onClick={startEdit} className="btn-primary btn-sm"><Pencil size={12} /> Complete</button>
            </div>
          </div>
        </div>
      )}

      {/* Active high-risk alert */}
      {highRisk.length > 0 && (
        <RiskAlert
          level="High"
          message="Active drug interaction detected in your current prescription."
          interactions={highRisk}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Medical Records"  value={records.length}                                       icon={FileText}    color="blue"   sub="All encrypted" />
        <StatCard label="Active Medicines" value={medicines.filter(m => m.status === 'active').length}  icon={Pill}        color="teal"   sub="Currently prescribed" />
        <StatCard label="Drug Alerts"      value={highRisk.length}                                      icon={AlertTriangle} color="orange" sub="Interactions found" />
        <StatCard label="Profile"          value={`${completionPct}%`}                                  icon={CheckCircle} color={completionPct === 100 ? 'green' : 'red'} sub="Completion" />
      </div>

      {/* Medical ID Card */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-teal-600 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-xl font-bold">
                {user.name?.split(' ').map(w => w[0]).join('') || 'P'}
              </div>
              <div>
                <p className="text-white font-bold text-lg">{user.name}</p>
                <p className="text-blue-200 text-sm">{profile?.user_id} · {profile?.gender || '—'}, {profile?.age || '—'} yrs</p>
                {profile?.insurance && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <CreditCard size={11} className="text-blue-300" />
                    <p className="text-blue-300 text-xs">{profile.insurance}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/patient/emergency-qr"
                className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                <QrCode size={12} /> QR
              </Link>
              <button onClick={startEdit}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                <Pencil size={12} /> Edit
              </button>
            </div>
          </div>
        </div>

        {editing ? (
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'blood_group',            label: 'Blood Group' },
                { key: 'age',                    label: 'Age', type: 'number' },
                { key: 'emergency_contact',      label: 'Emergency Contact' },
                { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
                { key: 'insurance',              label: 'Insurance' },
              ].map(({ key, label, type = 'text' }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input type={type} className="input" value={editForm[key] || ''}
                    onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <input className="input" value={editForm.address || ''}
                  onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Allergies (comma separated)</label>
                <input className="input" value={(editForm.allergies || []).join(', ')}
                  onChange={e => setEditForm(p => ({ ...p, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Chronic Conditions (comma separated)</label>
                <input className="input" value={(editForm.chronic_diseases || []).join(', ')}
                  onChange={e => setEditForm(p => ({ ...p, chronic_diseases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveProfile} className="btn-primary" disabled={saving}>
                {saving ? <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> : <Save size={14} />} Save
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary"><X size={14} /> Cancel</button>
            </div>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            <InfoCell icon={Droplets}      label="Blood Group"       value={profile?.blood_group || '—'}                          valueClass="text-red-600 font-bold text-xl" />
            <InfoCell icon={User}          label="Age / Gender"      value={`${profile?.age || '—'} yrs · ${profile?.gender || '—'}`} />
            <InfoCell icon={AlertTriangle} label="Allergies"         value={(profile?.allergies || []).join(', ') || 'None'}       valueClass="text-orange-700 text-xs" />
            <InfoCell icon={Heart}         label="Conditions"        value={(profile?.chronic_diseases || []).join(', ') || 'None'} valueClass="text-xs" />
            <InfoCell icon={Phone}         label="Emergency Contact" value={profile?.emergency_contact_name || '—'} />
            <InfoCell icon={MapPin}        label="Address"           value={profile?.address || '—'}                               valueClass="text-xs" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Medicines */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="card-header">
            <p className="section-title flex items-center gap-2"><Pill size={16} className="text-teal-600" /> Current Medicines</p>
            <span className="badge-teal">{medicines.filter(m => m.status === 'active').length} active</span>
          </div>
          {medicines.length === 0 ? (
            <ApiEmpty message="No medicines on record." icon={Pill} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>{['Medicine', 'Dosage', 'Frequency', 'Duration', 'Status'].map(h => <th key={h} className="th">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {medicines.map((m, i) => (
                    <tr key={i} className="tr">
                      <td className="td font-semibold text-slate-800">{m.name}</td>
                      <td className="td text-slate-600">{m.dosage || '—'}</td>
                      <td className="td text-slate-500">{m.frequency || '—'}</td>
                      <td className="td text-slate-500">{m.duration || '—'}</td>
                      <td className="td"><span className={m.status === 'active' ? 'badge-green' : 'badge-gray'}>{m.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Caregiver Management */}
        <div className="card">
          <div className="card-header">
            <p className="section-title flex items-center gap-2"><Users size={15} className="text-blue-600" /> Caregivers</p>
          </div>
          <div className="card-body space-y-3">
            {(profile?.caregivers || []).length === 0 ? (
              <p className="text-xs text-slate-400">No caregivers linked yet.</p>
            ) : (
              profile.caregivers.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User size={12} className="text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 flex-1 truncate font-mono text-xs">{c}</span>
                </div>
              ))
            )}
            <div className="pt-2 border-t border-slate-100">
              <label className="label flex items-center gap-1 mb-1.5">
                <Plus size={11} /> Add Caregiver by ID
              </label>
              <div className="flex gap-2">
                <input
                  className="input flex-1 py-2 text-xs font-mono"
                  placeholder="Paste caregiver's ID here"
                  value={caregiverInput}
                  onChange={e => setCaregiverInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCaregiver()}
                />
                <button onClick={handleAddCaregiver} disabled={addingCare} className="btn-primary btn-sm px-3">
                  <Plus size={13} />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Ask your caregiver to share their Caregiver ID from their dashboard.
              </p>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-100">
              <ShieldCheck size={11} /> Caregivers can approve doctor access requests on your behalf
            </p>
          </div>
        </div>
      </div>

      {/* Recent Records */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title flex items-center gap-2"><FileText size={16} className="text-blue-600" /> Recent Medical Records</h2>
          <Link to="/patient/history" className="text-xs text-blue-600 font-semibold hover:underline">View all →</Link>
        </div>
        {historyLoading ? (
          <div className="py-6 text-center text-slate-400 text-sm">Loading records…</div>
        ) : historyError ? (
          <ApiError error={historyError} onRetry={refreshHistory} />
        ) : records.length === 0 ? (
          <ApiEmpty message="No medical records uploaded yet." icon={FileText} />
        ) : (
          <div className="space-y-2">
            {records.slice(0, 3).map(r => <MedicalRecordCard key={r._id} record={r} />)}
          </div>
        )}
      </div>

      {/* Hospital Access Requests */}
      {(pendingAccess.length > 0 || accessRequests.length > 0) && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <p className="section-title flex items-center gap-2">
              <Building2 size={16} className="text-purple-600" /> Hospital Access Requests
              {pendingAccess.length > 0 && (
                <span className="badge-orange ml-1">{pendingAccess.length} pending</span>
              )}
            </p>
            <button onClick={refreshAccess} className="btn-secondary btn-sm"><RefreshCw size={12} /></button>
          </div>
          {accessLoading ? (
            <div className="py-6 text-center text-slate-400 text-sm">Loading…</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {accessRequests.map(req => (
                <div key={req._id} className="px-5 py-4 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Building2 size={15} className="text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      Hospital requested access to your records
                    </p>
                    {req.reason && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">"{req.reason}"</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Clock size={10} /> {req.created_at ? new Date(req.created_at).toLocaleString('en-IN') : '—'}
                    </p>
                  </div>
                  {req.status === 'pending' ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleRespondAccess(req._id, 'approved')}
                        disabled={respondingId === req._id}
                        className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button
                        onClick={() => handleRespondAccess(req._id, 'rejected')}
                        disabled={respondingId === req._id}
                        className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className={req.status === 'approved' ? 'badge-green shrink-0' : req.status === 'rejected' ? 'badge-red shrink-0' : 'badge-gray shrink-0'}>
                      {req.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Audit Logs — who accessed your records */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <p className="section-title flex items-center gap-2">
            <Activity size={16} className="text-slate-600" /> Recent Record Access Activity
          </p>
          <div className="flex items-center gap-2">
            <ApiStatusPill loading={auditLoading} error={null} />
            <button onClick={refreshAudit} className="btn-secondary btn-sm"><RefreshCw size={12} /></button>
          </div>
        </div>
        {auditLoading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading access activity…</div>
        ) : auditLogs.length === 0 ? (
          <ApiEmpty message="No access activity recorded yet." icon={Eye} />
        ) : (
          <div className="divide-y divide-slate-50">
            {auditLogs.map((log, i) => (
              <div key={log._id || i} className="px-5 py-3 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white ${
                  log.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                }`}>
                  {(log.user_name || log.user_id || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {log.user_name || log.user_id}
                    <span className="text-slate-400 font-normal ml-1.5">
                      {log.action?.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock size={10} /> {new Date(log.timestamp).toLocaleString('en-IN')}
                    {log.ip_address && <span className="ml-2 font-mono">{log.ip_address}</span>}
                  </p>
                </div>
                <span className={log.status === 'failed' ? 'badge-red' : 'badge-green'}>
                  {log.status || 'success'}
                </span>
              </div>
            ))}
          </div>
        )}
        {auditLogs.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
            <Link to="/patient/access-requests" className="text-xs text-blue-600 font-semibold hover:underline">
              Manage access requests →
            </Link>
          </div>
        )}
      </div>

    </div>
  )
}

function InfoCell({ icon: Icon, label, value, valueClass = 'text-slate-800 text-sm' }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
        <Icon size={10} /> {label}
      </p>
      <p className={valueClass}>{value}</p>
    </div>
  )
}
