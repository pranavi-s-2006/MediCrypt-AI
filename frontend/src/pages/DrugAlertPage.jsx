import { useState, useRef } from 'react'
import {
  AlertTriangle, Pill, Shield, Upload, FileText,
  ChevronDown, ChevronUp, BookOpen, Database,
  CheckCircle, XCircle, Zap, User, Heart, Loader2, RefreshCw
} from 'lucide-react'
import { comparePrescriptions, checkDrugInteraction } from '../services/api'
import { extractError } from '../hooks/useApi'
import toast from 'react-hot-toast'

// ── Config ────────────────────────────────────────────────
const LEVEL_CFG = {
  Critical: { bg: 'bg-red-50 border-red-300',     badge: 'bg-red-100 text-red-700 border border-red-300',     text: 'text-red-700',    bar: 'bg-red-500',    recBg: 'bg-red-100 border-red-200' },
  High:     { bg: 'bg-orange-50 border-orange-300', badge: 'bg-orange-100 text-orange-700 border border-orange-300', text: 'text-orange-700', bar: 'bg-orange-500', recBg: 'bg-orange-100 border-orange-200' },
  Medium:   { bg: 'bg-amber-50 border-amber-300',  badge: 'bg-amber-100 text-amber-700 border border-amber-300',  text: 'text-amber-700',  bar: 'bg-amber-400',  recBg: 'bg-amber-100 border-amber-200' },
  Low:      { bg: 'bg-emerald-50 border-emerald-300', badge: 'bg-emerald-100 text-emerald-700 border border-emerald-300', text: 'text-emerald-700', bar: 'bg-emerald-500', recBg: 'bg-emerald-100 border-emerald-200' },
}

const RECS = {
  Critical: 'Discontinue one of the conflicting drugs immediately. Consult prescribing physician before administering. Consider alternative therapy.',
  High:     'Review prescription with the treating physician. Monitor closely for adverse effects. Dose adjustment may be required.',
  Medium:   'Inform the treating physician. Monitor patient for symptoms. No immediate action unless symptoms appear.',
  Low:      'No immediate action required. Document in patient record and monitor during follow-up visits.',
}

// ── Sub-components ────────────────────────────────────────
function RiskMeter({ pct, level }) {
  const cfg = LEVEL_CFG[level] || LEVEL_CFG.Low
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">Risk Score</span>
        <span className={`text-2xl font-black ${cfg.text}`}>{pct}%</span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-700 ${cfg.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>Low (0–30)</span><span>Medium (31–60)</span><span>High (61–85)</span><span>Critical (86–100)</span>
      </div>
    </div>
  )
}

function MedTable({ title, medicines, color = 'blue' }) {
  if (!medicines?.length) return (
    <div className="card p-4">
      <p className="text-xs font-bold text-slate-500 uppercase mb-2">{title}</p>
      <p className="text-sm text-slate-400">No medicines extracted.</p>
    </div>
  )
  return (
    <div className="card overflow-hidden">
      <div className={`px-4 py-2.5 bg-${color}-600`}>
        <p className="text-white text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
          <Pill size={12} /> {title} — {medicines.length} medicine{medicines.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="table w-full text-xs">
          <thead>
            <tr>
              {['Medicine', 'Dosage', 'Timing', 'Duration', 'Food'].map(h => (
                <th key={h} className="th text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {medicines.map((m, i) => (
              <tr key={i} className="tr">
                <td className="td font-semibold text-slate-800">{m.name || '—'}</td>
                <td className="td text-slate-600">{m.dosage || '—'}</td>
                <td className="td text-slate-500">
                  {[m.morning && 'AM', m.afternoon && 'Noon', m.night && 'PM'].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="td text-slate-500">{m.duration || '—'}</td>
                <td className="td text-slate-500">
                  {m.before_food ? 'Before' : m.after_food ? 'After' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InteractionRow({ ix }) {
  const [open, setOpen] = useState(false)
  const cfg = LEVEL_CFG[ix.level] || LEVEL_CFG.Low
  const sourceLabel = ix.source === 'old_vs_new' ? '⚡ Old vs New' : ix.source === 'new_vs_new' ? 'New vs New' : 'Old vs Old'
  return (
    <div className={`rounded-xl border ${cfg.bg} overflow-hidden`}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(o => !o)}>
        <AlertTriangle size={14} className={cfg.text} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 text-sm">{ix.drug_a}</span>
            <span className="text-slate-400 text-xs">+</span>
            <span className="font-bold text-slate-800 text-sm">{ix.drug_b}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{ix.level}</span>
            <span className="text-[10px] text-slate-400">{sourceLabel}</span>
          </div>
          {!open && <p className="text-xs text-slate-500 mt-0.5 truncate">{ix.description}</p>}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-current/10 px-4 py-3 space-y-2">
          <p className="text-sm text-slate-700">{ix.description}</p>
          <div className={`rounded-lg border px-3 py-2 ${cfg.recBg} flex items-start gap-2`}>
            <BookOpen size={12} className={`${cfg.text} mt-0.5 shrink-0`} />
            <p className={`text-xs font-medium ${cfg.text}`}>
              <strong>Recommendation: </strong>{RECS[ix.level] || RECS.Low}
            </p>
          </div>
          <p className="text-[10px] text-slate-400 flex items-center gap-1"><Database size={9} /> DDInter Database</p>
        </div>
      )}
    </div>
  )
}

function FileDropZone({ label, file, onChange, color = 'blue' }) {
  const ref = useRef()
  return (
    <div>
      <p className="text-xs font-bold text-slate-600 mb-1.5">{label}</p>
      <label
        className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors
          ${file ? `border-${color}-400 bg-${color}-50` : 'border-slate-200 hover:border-slate-300 bg-slate-50'}`}
      >
        <input ref={ref} type="file" accept="image/*,.pdf" onChange={e => onChange(e.target.files?.[0] || null)} className="hidden" />
        {file ? (
          <>
            <CheckCircle size={18} className={`text-${color}-600 shrink-0`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button type="button" onClick={e => { e.preventDefault(); onChange(null); ref.current.value = '' }}
              className="ml-auto shrink-0 text-slate-400 hover:text-red-500">
              <XCircle size={16} />
            </button>
          </>
        ) : (
          <>
            <Upload size={18} className="text-slate-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-600">Click to upload prescription</p>
              <p className="text-xs text-slate-400">JPG, PNG or PDF — max 5 MB</p>
            </div>
          </>
        )}
      </label>
    </div>
  )
}

// ── Result panel ──────────────────────────────────────────
function CompareResult({ result, onReset }) {
  const { risk, old_medicines, new_medicines, interactions, allergy_conflicts,
          duplicates, patient_allergies, chronic_diseases, ai_report } = result
  const cfg    = LEVEL_CFG[risk?.risk] || LEVEL_CFG.Low
  const pct    = risk?.risk_percentage ?? 0
  const critical = interactions.filter(i => i.level === 'Critical')
  const high     = interactions.filter(i => i.level === 'High')
  const [showOcr, setShowOcr] = useState(false)

  return (
    <div className="space-y-5">
      {/* Risk summary banner */}
      <div className={`rounded-2xl border-2 p-5 ${cfg.bg}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <p className={`text-xl font-black ${cfg.text}`}>{risk?.risk} Risk</p>
            <p className="text-sm text-slate-600 mt-0.5">
              {interactions.length} drug interaction{interactions.length !== 1 ? 's' : ''} found
              {allergy_conflicts.length > 0 && ` · ${allergy_conflicts.length} allergy conflict${allergy_conflicts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onReset} className="btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw size={13} /> New Comparison
          </button>
        </div>
        <RiskMeter pct={pct} level={risk?.risk} />
      </div>

      {/* Medicine tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MedTable title="Old Prescription Medicines" medicines={old_medicines} color="slate" />
        <MedTable title="New Prescription Medicines" medicines={new_medicines} color="blue" />
      </div>

      {/* Patient context */}
      {(patient_allergies?.length > 0 || chronic_diseases?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {patient_allergies?.length > 0 && (
            <div className="card p-4 flex items-start gap-3">
              <AlertTriangle size={15} className="text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Patient Allergies</p>
                <div className="flex flex-wrap gap-1.5">
                  {patient_allergies.map((a, i) => (
                    <span key={i} className="bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {chronic_diseases?.length > 0 && (
            <div className="card p-4 flex items-start gap-3">
              <Heart size={15} className="text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Chronic Diseases</p>
                <div className="flex flex-wrap gap-1.5">
                  {chronic_diseases.map((d, i) => (
                    <span key={i} className="bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Allergy conflicts */}
      {allergy_conflicts?.length > 0 && (
        <div className="card overflow-hidden border-red-300">
          <div className="bg-red-600 px-4 py-2.5">
            <p className="text-white text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle size={12} /> Allergy Conflicts Detected
            </p>
          </div>
          <div className="p-4 space-y-2">
            {allergy_conflicts.map((ac, i) => (
              <div key={i} className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <XCircle size={14} className="text-red-500 shrink-0" />
                <p className="text-sm text-slate-800">
                  <strong>{ac.medicine}</strong>
                  <span className="text-red-600 mx-1.5">conflicts with allergy:</span>
                  <strong className="text-red-700">{ac.allergen}</strong>
                  <span className="text-xs text-slate-400 ml-2">({ac.source} prescription)</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicates */}
      {duplicates?.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
            <Pill size={12} /> Duplicate Medicines in Both Prescriptions
          </p>
          <div className="flex flex-wrap gap-2">
            {duplicates.map((d, i) => (
              <span key={i} className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">{d}</span>
            ))}
          </div>
        </div>
      )}

      {/* Drug interactions */}
      <div>
        <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <Zap size={14} className="text-orange-500" />
          Drug-Drug Interactions
          <span className="text-xs font-normal text-slate-400 ml-1">{interactions.length} found</span>
        </p>
        {interactions.length === 0 ? (
          <div className="card p-4 flex items-center gap-3">
            <CheckCircle size={16} className="text-emerald-500" />
            <p className="text-sm text-slate-600">No drug-drug interactions detected in DDInter database.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {interactions.map((ix, i) => <InteractionRow key={i} ix={ix} />)}
          </div>
        )}
      </div>

      {/* AI Doctor Report */}
      {ai_report && (
        <div className="card p-5 bg-slate-50">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <BookOpen size={12} /> AI Doctor Safety Report
          </p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{ai_report}</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Critical', value: critical.length, color: 'red' },
          { label: 'High',     value: high.length,     color: 'orange' },
          { label: 'Allergies', value: allergy_conflicts.length, color: 'amber' },
          { label: 'Duplicates', value: duplicates.length, color: 'slate' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className={`text-2xl font-black text-${s.color}-600`}>{s.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 flex items-center gap-1">
        <Database size={9} /> Data source: DDInter database + Gemini AI · Clinical guidelines only — always consult a licensed physician
      </p>
    </div>
  )
}

// ── Manual checker (optional, collapsed) ─────────────────
function ManualChecker() {
  const [open,    setOpen]    = useState(false)
  const [drugA,   setDrugA]   = useState('')
  const [drugB,   setDrugB]   = useState('')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)

  const check = async () => {
    if (!drugA.trim() || !drugB.trim()) { toast.error('Enter both drug names.'); return }
    setLoading(true)
    try {
      const res = await checkDrugInteraction([drugA.trim(), drugB.trim()])
      setResult(res.data)
    } catch (err) {
      toast.error(extractError(err))
    } finally { setLoading(false) }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
          <Shield size={14} className="text-slate-400" />
          Optional: Manual Drug Checker
          <span className="text-xs font-normal text-slate-400">(for quick single-pair test)</span>
        </p>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 p-5 space-y-4">
          <p className="text-xs text-slate-500">Type two drug names to check a single interaction against DDInter.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="label text-xs">Drug A</label>
              <input className="input text-sm" placeholder="e.g. Aspirin" value={drugA} onChange={e => setDrugA(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label text-xs">Drug B</label>
              <input className="input text-sm" placeholder="e.g. Warfarin" value={drugB} onChange={e => setDrugB(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && check()} />
            </div>
            <div className="flex items-end">
              <button onClick={check} disabled={loading} className="btn-secondary w-full sm:w-auto flex items-center gap-2">
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
                {loading ? 'Checking…' : 'Check'}
              </button>
            </div>
          </div>
          {result && (
            <div className={`rounded-xl border p-4 space-y-2 ${LEVEL_CFG[result.risk?.risk]?.bg || 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800">{drugA}</span>
                <span className="text-slate-400">+</span>
                <span className="font-bold text-slate-800">{drugB}</span>
                {result.interactions?.[0]?.level && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${LEVEL_CFG[result.interactions[0].level]?.badge}`}>
                    {result.interactions[0].level}
                  </span>
                )}
              </div>
              {result.interactions?.length > 0 ? (
                result.interactions.map((ix, i) => (
                  <p key={i} className="text-sm text-slate-700">{ix.description}</p>
                ))
              ) : (
                <p className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle size={14} /> No interaction found in DDInter database.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function DrugAlertPage() {
  const [oldFile,   setOldFile]   = useState(null)
  const [newFile,   setNewFile]   = useState(null)
  const [patientId, setPatientId] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState(null)

  const handleCompare = async () => {
    if (!oldFile) { toast.error('Please upload the old prescription.'); return }
    if (!newFile) { toast.error('Please upload the new prescription.'); return }
    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('old_prescription', oldFile)
      fd.append('new_prescription', newFile)
      if (patientId.trim()) fd.append('patient_id', patientId.trim())
      const res = await comparePrescriptions(fd)
      setResult(res.data)
    } catch (err) {
      toast.error(extractError(err))
    } finally { setLoading(false) }
  }

  const reset = () => { setResult(null); setOldFile(null); setNewFile(null); setPatientId('') }

  return (
    <div className="space-y-6 pb-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Zap size={22} className="text-orange-500" /> Drug Interaction Commander
        </h1>
        <p className="page-subtitle mt-1">
          Upload old + new prescriptions — AI automatically extracts medicines, checks interactions, and generates a doctor safety report
        </p>
      </div>

      {result ? (
        <CompareResult result={result} onReset={reset} />
      ) : (
        <div className="space-y-5">
          {/* Upload section */}
          <div className="card p-5 space-y-4">
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <FileText size={15} className="text-blue-600" /> Upload Both Prescriptions
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FileDropZone
                label="Old Prescription (patient's existing medicines)"
                file={oldFile}
                onChange={setOldFile}
                color="slate"
              />
              <FileDropZone
                label="New Prescription (doctor's new medicines)"
                file={newFile}
                onChange={setNewFile}
                color="blue"
              />
            </div>

            {/* Optional patient ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <User size={11} /> Patient ID <span className="text-slate-400 font-normal">(optional — auto-fetches allergies &amp; conditions)</span>
              </label>
              <input
                className="input text-sm max-w-xs"
                placeholder="Patient MongoDB ID"
                value={patientId}
                onChange={e => setPatientId(e.target.value)}
              />
            </div>

            <button
              onClick={handleCompare}
              disabled={loading || !oldFile || !newFile}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Running AI Pipeline…</>
                : <><Zap size={16} /> Compare &amp; Analyse</>
              }
            </button>

            {loading && (
              <div className="space-y-1.5">
                {['OCR extracting text from both prescriptions…',
                  'Gemini extracting medicine details…',
                  'Fetching patient allergies from database…',
                  'DDInter checking all drug combinations…',
                  'Risk Engine calculating risk percentage…',
                  'Generating doctor safety report…',
                ].map((step, i) => (
                  <p key={i} className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {step}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="card p-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">How it works</p>
            <ol className="space-y-1.5">
              {[
                'Upload the patient\'s old prescription and the new prescription.',
                'OCR extracts text from both files automatically.',
                'Gemini AI extracts: medicine name, dosage, timing, duration, before/after food.',
                'Patient allergies and chronic diseases are fetched from their profile.',
                'DDInter database checks all drug-drug combinations for interactions.',
                'Risk Engine calculates a risk percentage (0–100%) across four bands.',
                'Gemini generates a complete doctor safety report with recommendations.',
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Optional manual checker — collapsed by default */}
      <ManualChecker />
    </div>
  )
}
