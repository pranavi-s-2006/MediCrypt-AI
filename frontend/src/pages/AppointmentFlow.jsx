import { useState, useRef, useEffect } from 'react'
import {
  Search, FileText, Upload, ShieldOff, CheckCircle, Clock,
  Send, X, RefreshCw, Building2, Shield, ArrowRight,
  Bell, Info, Users, IndianRupee, FlaskConical, Pill,
  UserCheck, AlertTriangle
} from 'lucide-react'
import MedicalRecordCard from '../components/MedicalRecordCard'
import { InlineLoader }  from '../components/Loader'
import { InlineError }   from '../components/ApiError'
import { extractError }  from '../hooks/useApi'
import {
  lookupPatientById, hospitalRequestAccess,
  getHospitalAccessStatus, getHospitalPatientRecords,
  getHospitalDoctors, revokeHospitalAccess,
  addToQueue, sendFileToDoctorQueue,
  uploadQueueReport, completeConsultation,
  getHospitalQueue,
} from '../services/api'
import toast from 'react-hot-toast'

const STEPS = [
  { n: 1, label: 'Find Patient',    icon: Search },
  { n: 2, label: 'Request Access',  icon: Shield },
  { n: 3, label: 'Add to Queue',    icon: Users },
  { n: 4, label: 'Manage Visit',    icon: FileText },
  { n: 5, label: 'End Session',     icon: ShieldOff },
]

function StepBar({ current }) {
  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = current > s.n, active = current === s.n
        const Icon = s.icon
        return (
          <div key={s.n} className="flex items-center shrink-0">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              active ? 'bg-blue-600 text-white' :
              done   ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                       'bg-slate-50 text-slate-400 border border-slate-200'
            }`}>
              {done ? <CheckCircle size={13} /> : <Icon size={13} />}
              <span className="whitespace-nowrap">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight size={14} className={`mx-1 shrink-0 ${done ? 'text-emerald-400' : 'text-slate-300'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PatientStrip({ patient }) {
  return (
    <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
      <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        {(patient.name || 'P').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm">{patient.name || '—'}</p>
        <p className="text-xs text-slate-500">
          {patient.user_id} · {patient.age || '—'} yrs · Blood: <strong className="text-red-600">{patient.blood_group || '—'}</strong>
          {patient.allergies?.length > 0 && <span className="ml-2 text-orange-600">⚠ {patient.allergies.join(', ')}</span>}
        </p>
      </div>
    </div>
  )
}

export default function AppointmentFlow() {
  const [step,          setStep]          = useState(1)
  const [patientId,     setPatientId]     = useState('')
  const [patient,       setPatient]       = useState(null)
  const [accessStatus,  setAccessStatus]  = useState('none')
  const [doctors,       setDoctors]       = useState([])
  const [selectedDoc,   setSelectedDoc]   = useState('')
  const [visitReason,   setVisitReason]   = useState('')
  const [department,    setDepartment]    = useState('')
  const [queueEntry,    setQueueEntry]    = useState(null)
  const [records,       setRecords]       = useState([])
  const [accessReason,  setAccessReason]  = useState('')

  // upload panel state
  const fileRef         = useRef(null)
  const [uploadType,    setUploadType]    = useState('report')
  const [uploadFile,    setUploadFile]    = useState(null)
  const [uploadNotes,   setUploadNotes]   = useState('')
  const [payAmount,     setPayAmount]     = useState('')

  // loading states
  const [searching,     setSearching]     = useState(false)
  const [requesting,    setRequesting]    = useState(false)
  const [addingQueue,   setAddingQueue]   = useState(false)
  const [sendingFile,   setSendingFile]   = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [completing,    setCompleting]    = useState(false)

  const [searchErr,     setSearchErr]     = useState('')
  const [accessErr,     setAccessErr]     = useState('')
  const [queueErr,      setQueueErr]      = useState('')

  const pollRef = useRef(null)

  const resetFlow = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setStep(1); setPatient(null); setPatientId(''); setAccessStatus('none')
    setDoctors([]); setSelectedDoc(''); setVisitReason(''); setDepartment('')
    setQueueEntry(null); setRecords([]); setAccessReason('')
    setUploadFile(null); setUploadNotes(''); setPayAmount('')
    setSearchErr(''); setAccessErr(''); setQueueErr('')
  }

  // STEP 1 — find patient
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!patientId.trim()) return
    setSearching(true); setSearchErr('')
    try {
      const res = await lookupPatientById(patientId.trim())
      setPatient(res.data)
      toast.success(`Patient found: ${res.data.name || patientId}`)
      setStep(2)
    } catch (err) { setSearchErr(extractError(err)) }
    finally { setSearching(false) }
  }

  // STEP 2 — request access + poll
  const handleRequestAccess = async () => {
    if (!accessReason.trim()) { setAccessErr('Please enter a reason for access.'); return }
    setRequesting(true); setAccessErr('')
    try {
      const resolvedPatientId = patient?.user_id || patientId.trim()
      await hospitalRequestAccess(resolvedPatientId, accessReason)
      setAccessStatus('pending')
      toast.success('Access request sent — waiting for patient approval.')
      setStep(3)
      getHospitalDoctors().then(r => setDoctors(r.data?.doctors || [])).catch(() => {})
      pollRef.current = setInterval(async () => {
        try {
          const res = await getHospitalAccessStatus(resolvedPatientId)
          setAccessStatus(res.data?.status)
          if (res.data?.status === 'approved') {
            clearInterval(pollRef.current)
            toast.success('Patient approved! You can now add them to the queue.')
            const recRes = await getHospitalPatientRecords(resolvedPatientId)
            setRecords(recRes.data?.records || [])
          } else if (res.data?.status === 'rejected') {
            clearInterval(pollRef.current)
            toast.error('Patient rejected the access request.')
          }
        } catch {}
      }, 5000)
    } catch (err) { setAccessErr(extractError(err)) }
    finally { setRequesting(false) }
  }

  const handleCheckNow = async () => {
    try {
      const res = await getHospitalAccessStatus(patientId.trim())
      setAccessStatus(res.data?.status)
      if (res.data?.status === 'approved') {
        clearInterval(pollRef.current)
        toast.success('Patient approved!')
        const recRes = await getHospitalPatientRecords(patientId.trim())
        setRecords(recRes.data?.records || [])
      }
    } catch (err) { toast.error(extractError(err)) }
  }

  // STEP 3 — add to doctor queue
  const handleAddToQueue = async () => {
    if (!selectedDoc) { setQueueErr('Please select a doctor.'); return }
    if (!visitReason.trim()) { setQueueErr('Please enter visit reason.'); return }
    setAddingQueue(true); setQueueErr('')
    try {
      // Use the resolved user_id from the patient object, not the raw input
      const resolvedPatientId = patient?.user_id || patientId.trim()
      const res = await addToQueue({
        patient_id: resolvedPatientId,
        doctor_id:  selectedDoc,
        reason:     visitReason,
        department: department,
      })
      setQueueEntry(res.data)
      toast.success(`Patient added to queue — Token #${res.data.queue_no}`)
      setStep(4)
    } catch (err) { setQueueErr(extractError(err)) }
    finally { setAddingQueue(false) }
  }

  // STEP 4a — send file to doctor (start consultation)
  const handleSendFile = async () => {
    setSendingFile(true)
    try {
      await sendFileToDoctorQueue({ queue_id: queueEntry._id })
      setQueueEntry(prev => ({ ...prev, status: 'in_consultation', file_sent: true }))
      toast.success('Patient file sent to doctor. Consultation started!')
    } catch (err) { toast.error(extractError(err)) }
    finally { setSendingFile(false) }
  }

  // STEP 4b — upload report / prescription / payment
  const handleUpload = async (e) => {
    e.preventDefault()
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('queue_id', queueEntry._id)
      fd.append('doc_type', uploadType)
      fd.append('notes',    uploadNotes)
      fd.append('amount',   payAmount)
      if (uploadFile) fd.append('file', uploadFile)
      await uploadQueueReport(fd)
      toast.success(`${uploadType.charAt(0).toUpperCase() + uploadType.slice(1)} uploaded successfully`)
      setUploadFile(null); setUploadNotes(''); setPayAmount('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) { toast.error(extractError(err)) }
    finally { setUploading(false) }
  }

  // STEP 5 — complete consultation
  const handleComplete = async () => {
    setCompleting(true)
    try {
      await completeConsultation({ queue_id: queueEntry._id })
      toast.success('Consultation completed. Access revoked.')
      setStep(5)
    } catch (err) { toast.error(extractError(err)) }
    finally { setCompleting(false) }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 size={22} className="text-purple-600" /> Appointment Flow
          </h1>
          <p className="page-subtitle">Patient check-in → consent → queue → consultation → upload → complete</p>
        </div>
        {step > 1 && (
          <button onClick={resetFlow} className="btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw size={13} /> New Appointment
          </button>
        )}
      </div>

      <div className="card p-4"><StepBar current={step} /></div>
      {patient && <PatientStrip patient={patient} />}

      {/* ═══ STEP 1: FIND PATIENT ═══ */}
      {step === 1 && (
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-teal-600 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">1</div>
              <div>
                <p className="text-white font-bold">Find Patient by ID</p>
                <p className="text-blue-200 text-xs">Patient provides their MediCrypt ID at reception</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <div>
                <label className="label">Patient MediCrypt ID</label>
                <div className="flex gap-3">
                  <input className="input flex-1" placeholder="e.g. 6a28e4cbf9aa84df520ba9b0"
                    value={patientId} onChange={e => setPatientId(e.target.value)} required />
                  <button type="submit" className="btn-primary px-5" disabled={searching}>
                    {searching ? <InlineLoader /> : <Search size={15} />}
                    {searching ? 'Searching…' : 'Find'}
                  </button>
                </div>
              </div>
              <InlineError error={searchErr} />
            </form>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: REQUEST ACCESS ═══ */}
      {step === 2 && patient && (
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">2</div>
              <div>
                <p className="text-white font-bold">Request Record Access</p>
                <p className="text-amber-100 text-xs">Patient must approve on their dashboard</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <Bell size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Consent required:</strong> The patient will receive a notification on their dashboard and must approve before records are accessible.
              </p>
            </div>
            <div>
              <label className="label">Reason for Visit / Access</label>
              <textarea className="input resize-none" rows={3}
                placeholder="e.g. General consultation, Cardiology follow-up, Lab test review…"
                value={accessReason} onChange={e => setAccessReason(e.target.value)} />
            </div>
            <InlineError error={accessErr} />
            <div className="flex gap-3">
              <button onClick={handleRequestAccess} disabled={requesting} className="btn-primary flex items-center gap-2">
                {requesting ? <InlineLoader /> : <Shield size={15} />}
                {requesting ? 'Sending…' : 'Send Access Request to Patient'}
              </button>
              <button onClick={() => setStep(1)} className="btn-secondary">Back</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: SELECT DOCTOR & ADD TO QUEUE ═══ */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Approval status */}
          {accessStatus !== 'approved' ? (
            <div className="card p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                <Clock size={22} className="text-amber-500 animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {accessStatus === 'rejected' ? 'Patient rejected the request.' : 'Waiting for patient approval…'}
              </p>
              {accessStatus !== 'rejected' && (
                <>
                  <p className="text-xs text-slate-400">This page updates automatically every 5 seconds.</p>
                  <button onClick={handleCheckNow} className="btn-secondary btn-sm flex items-center gap-1.5 mx-auto">
                    <RefreshCw size={12} /> Check Now
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 to-blue-600 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">3</div>
                  <div>
                    <p className="text-white font-bold">Select Doctor & Add to Queue</p>
                    <p className="text-teal-200 text-xs">Patient approved — assign to a doctor's queue</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                {/* Patient records preview */}
                {records.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Patient Medical History ({records.length} records)</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {records.map(r => <MedicalRecordCard key={r._id} record={r} />)}
                    </div>
                  </div>
                )}

                {/* Doctor selection */}
                <div>
                  <label className="label">Assign to Doctor</label>
                  {doctors.filter(d => d.is_verified).length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                      No verified doctors found. Verify doctors under "Doctors" tab first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {doctors.filter(d => d.is_verified).map(d => (
                        <button key={d._id} type="button" onClick={() => { setSelectedDoc(d.user_id); setDepartment(d.department || '') }}
                          className={`text-left p-3 rounded-xl border-2 transition-all ${
                            selectedDoc === d.user_id ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:border-teal-300'
                          }`}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {d.name?.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('') || 'DR'}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold truncate ${selectedDoc === d.user_id ? 'text-teal-700' : 'text-slate-800'}`}>
                                Dr. {d.name}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{d.specialization} · {d.department}</p>
                            </div>
                            {selectedDoc === d.user_id && <CheckCircle size={16} className="text-teal-600 ml-auto shrink-0" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Reason for Visit</label>
                    <input className="input" placeholder="e.g. Fever, chest pain, follow-up…"
                      value={visitReason} onChange={e => setVisitReason(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Department</label>
                    <input className="input" placeholder="e.g. Cardiology, General"
                      value={department} onChange={e => setDepartment(e.target.value)} />
                  </div>
                </div>

                <InlineError error={queueErr} />

                <div className="flex gap-3">
                  <button onClick={handleAddToQueue} disabled={addingQueue || !selectedDoc || accessStatus !== 'approved'}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50">
                    {addingQueue ? <InlineLoader /> : <Users size={15} />}
                    {addingQueue ? 'Adding…' : 'Add Patient to Queue'}
                  </button>
                  <button onClick={() => setStep(2)} className="btn-secondary">Back</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 4: MANAGE VISIT ═══ */}
      {step === 4 && queueEntry && (
        <div className="space-y-4">
          {/* Queue token card */}
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">4</div>
                  <div>
                    <p className="text-white font-bold">Manage Visit</p>
                    <p className="text-purple-200 text-xs">Send file to doctor · Upload reports · Add payment</p>
                  </div>
                </div>
                <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                  <p className="text-white text-xs font-medium">Token</p>
                  <p className="text-white text-2xl font-black">#{queueEntry.queue_no}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-slate-700">Status:</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  queueEntry.status === 'in_consultation' ? 'bg-blue-100 text-blue-700' :
                  queueEntry.status === 'completed'       ? 'bg-emerald-100 text-emerald-700' :
                                                            'bg-amber-100 text-amber-700'
                }`}>
                  {queueEntry.status === 'in_consultation' ? '🩺 In Consultation' :
                   queueEntry.status === 'completed'       ? '✓ Completed' : '⏳ Waiting'}
                </span>
              </div>

              {/* Send file button — only when waiting */}
              {queueEntry.status === 'waiting' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Send size={16} className="text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">Send Patient File to Doctor</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        This is the digital equivalent of the nurse sending the patient's physical file to the doctor.
                        The doctor will only be able to view the records after you click this.
                      </p>
                    </div>
                  </div>
                  <button onClick={handleSendFile} disabled={sendingFile} className="btn-primary flex items-center gap-2">
                    {sendingFile ? <InlineLoader /> : <Send size={15} />}
                    {sendingFile ? 'Sending…' : 'Send File to Doctor (Start Consultation)'}
                  </button>
                </div>
              )}

              {queueEntry.status === 'in_consultation' && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <CheckCircle size={15} className="text-blue-600 shrink-0" />
                  <p className="text-sm text-blue-800 font-medium">File sent — Doctor can now view patient records and prescribe.</p>
                </div>
              )}
            </div>
          </div>

          {/* Upload panel */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <p className="section-title flex items-center gap-2">
                <Upload size={15} className="text-purple-600" /> Upload Documents & Payment
              </p>
              {/* Patient confirmation */}
              <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {(queueEntry.patient_name || 'P').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-teal-800">{queueEntry.patient_name}</p>
                  <p className="text-[10px] text-teal-600 font-mono">Token #{queueEntry.queue_no}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {/* Type tabs */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'report',       label: 'Lab Report',    icon: FlaskConical },
                  { id: 'prescription', label: 'Prescription',  icon: Pill },
                  { id: 'payment',      label: 'Payment',       icon: IndianRupee },
                ].map(t => (
                  <button key={t.id} onClick={() => setUploadType(t.id)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
                      uploadType === t.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                    }`}>
                    <t.icon size={12} /> {t.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleUpload} className="space-y-3">
                {uploadType !== 'payment' && (
                  <div>
                    <label className="label">
                      {uploadType === 'prescription' ? 'Prescription File (JPG/PNG/PDF)' : 'Lab Report File (JPG/PNG/PDF)'}
                    </label>
                    <div onClick={() => fileRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                        uploadFile ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-purple-400 hover:bg-slate-50'
                      }`}>
                      <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                        onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                      {uploadFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileText size={18} className="text-teal-600 shrink-0" />
                          <div className="text-left">
                            <p className="text-sm font-semibold text-slate-800">{uploadFile.name}</p>
                            <p className="text-xs text-slate-400">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button type="button" onClick={e => { e.stopPropagation(); setUploadFile(null) }}
                            className="ml-2 text-slate-400 hover:text-red-500"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload size={20} className="text-slate-400 mx-auto" />
                          <p className="text-xs text-slate-500">Click to select file</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {uploadType === 'payment' && (
                  <div>
                    <label className="label">Amount Paid (₹)</label>
                    <div className="relative">
                      <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input pl-8" placeholder="e.g. 500" type="number"
                        value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input className="input" placeholder={
                    uploadType === 'payment' ? 'e.g. Cash, UPI, Insurance' :
                    uploadType === 'prescription' ? 'e.g. Post-consultation prescription' :
                    'e.g. Blood test report, X-ray results'
                  }
                    value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} />
                </div>

                <button type="submit" disabled={uploading || (uploadType !== 'payment' && !uploadFile)}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {uploading ? <InlineLoader /> : <Upload size={14} />}
                  {uploading ? 'Uploading…' : `Upload ${uploadType.charAt(0).toUpperCase() + uploadType.slice(1)}`}
                </button>
              </form>
            </div>
          </div>

          {/* Complete consultation */}
          <div className="card p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">End Consultation</p>
            <p className="text-xs text-slate-500 mb-4">
              Once all uploads are done and the doctor has given the prescription, mark the consultation as complete.
              This will revoke the hospital's access to patient records.
            </p>
            <button onClick={handleComplete} disabled={completing}
              className="btn-danger flex items-center gap-2">
              {completing ? <InlineLoader /> : <ShieldOff size={15} />}
              {completing ? 'Completing…' : 'Mark Consultation Complete & Revoke Access'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 5: DONE ═══ */}
      {step === 5 && (
        <div className="card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-slate-800">Appointment Complete</p>
          <p className="text-sm text-slate-500">
            Patient <strong>{patient?.name}</strong> — Token #{queueEntry?.queue_no}<br />
            Records, prescriptions and payment saved. Access revoked.
          </p>
          <button onClick={resetFlow} className="btn-primary flex items-center gap-2 mx-auto">
            <RefreshCw size={14} /> Start New Appointment
          </button>
        </div>
      )}
    </div>
  )
}
