import { useState, useRef } from 'react'
import {
  Upload, FileText, FileImage, X, CheckCircle, AlertTriangle,
  Eye, Cpu, Database, Shield, ChevronRight, BookOpen,
  Pill, Save, RefreshCw, Clock, Info, FileCode
} from 'lucide-react'
import RiskAlert from '../components/RiskAlert'
import { uploadPrescription, retryOCR } from '../services/api'
import { extractError } from '../hooks/useApi'
import toast from 'react-hot-toast'

// ── Constants ────────────────────────────────────────────
const MAX_SIZE  = 5 * 1024 * 1024

// 7-step pipeline — pdf_convert only shown/active for PDFs
const ALL_STEPS = ['upload', 'pdf_convert', 'ocr', 'gemini', 'ddinter', 'risk']
const IMG_STEPS = ['upload', 'ocr', 'gemini', 'ddinter', 'risk']

const STEP_META = {
  upload:      { label: 'File Uploaded',    desc: 'Saved to server + DB',  icon: Upload   },
  pdf_convert: { label: 'PDF → PNG',        desc: 'PyMuPDF conversion',    icon: FileCode },
  ocr:         { label: 'OCR (TrOCR)',      desc: 'Text extraction',       icon: Eye      },
  gemini:      { label: 'Gemini AI',        desc: 'Medicine extraction',   icon: Cpu      },
  ddinter:     { label: 'DDInter',          desc: 'Interaction check',     icon: Database },
  risk:        { label: 'Risk Engine',      desc: 'Severity scoring',      icon: Shield   },
}

const RISK_BORDER = {
  Critical: 'border-red-300 bg-red-50',   High:    'border-orange-300 bg-orange-50',
  Medium:   'border-amber-300 bg-amber-50', Low:   'border-emerald-300 bg-emerald-50',
  Pending:  'border-slate-200 bg-slate-50',
}
const RISK_TEXT = {
  Critical: 'text-red-700', High: 'text-orange-700',
  Medium: 'text-amber-700', Low: 'text-emerald-700', Pending: 'text-slate-500',
}

// ── Step pill ─────────────────────────────────────────────
function StepPill({ stepKey, steps, activeStep }) {
  const meta   = STEP_META[stepKey]
  const Icon   = meta.icon
  const s      = steps[stepKey]
  const status = activeStep === stepKey ? 'active'
               : s?.status === 'done'    ? 'done'
               : s?.status === 'error'   ? 'error'
               : s?.status === 'skipped' ? 'skipped'
               : 'idle'
  const cls = {
    idle:    'bg-slate-50 border-slate-200 text-slate-400',
    active:  'bg-blue-600 border-blue-600 text-white',
    done:    'bg-emerald-50 border-emerald-200 text-emerald-700',
    error:   'bg-red-50 border-red-200 text-red-600',
    skipped: 'bg-slate-50 border-slate-200 text-slate-400 opacity-50',
  }[status]

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300 shrink-0 ${cls}`}>
      {status === 'active'  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
       : status === 'done'  ? <CheckCircle size={13} />
       : status === 'error' ? <AlertTriangle size={13} />
       : <Icon size={13} />}
      <div>
        <p className="text-xs font-bold leading-tight">{meta.label}</p>
        <p className="text-[10px] opacity-70">{meta.desc}</p>
      </div>
    </div>
  )
}

// ── File preview ──────────────────────────────────────────
function FilePreview({ file, onClear, disabled }) {
  const isPDF = file.type === 'application/pdf'
  const url   = isPDF ? null : URL.createObjectURL(file)
  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
      {isPDF ? (
        <div className="flex items-center justify-center py-10 gap-4">
          <FileText size={40} className="text-red-400 shrink-0" />
          <div>
            <p className="font-semibold text-slate-700 text-sm">{file.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB · PDF</p>
            <p className="text-xs text-blue-600 mt-1 font-medium">First 2 pages will be converted to PNG → OCR</p>
          </div>
        </div>
      ) : (
        <img src={url} alt="Prescription preview"
          className="w-full max-h-72 object-contain bg-white"
          onLoad={() => URL.revokeObjectURL(url)} />
      )}
      {!disabled && (
        <button onClick={onClear}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600 shadow-sm">
          <X size={13} />
        </button>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-4 py-2">
        <p className="text-white text-xs font-medium truncate">{file.name}</p>
        <p className="text-white/70 text-[10px]">{(file.size / 1024).toFixed(1)} KB · {isPDF ? 'PDF' : 'Image'}</p>
      </div>
    </div>
  )
}

// ── Drop zone ─────────────────────────────────────────────
function DropZone({ onFile }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const pick = (f) => { if (f) onFile(f, f.size > MAX_SIZE) }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]) }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all select-none ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
      }`}
    >
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
        onChange={e => pick(e.target.files?.[0])} />
      <div className="flex flex-col items-center gap-3">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${dragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
          <Upload size={24} className={dragging ? 'text-blue-600' : 'text-slate-400'} />
        </div>
        <div>
          <p className="font-semibold text-slate-700 text-sm">Drop prescription image or PDF here</p>
          <p className="text-xs text-slate-400 mt-1">JPG · PNG · PDF — max 5 MB — handwriting supported</p>
        </div>
        <span className="btn-secondary btn-sm pointer-events-none">Browse Files</span>
      </div>
    </div>
  )
}

// ── Step summary list ─────────────────────────────────────
function StepSummary({ steps, visibleSteps }) {
  return (
    <div className="mt-3 space-y-1">
      {visibleSteps.map(key => {
        const s = steps[key]
        if (!s || s.status === 'pending') return null
        const isErr     = s.status === 'error'
        const isSkipped = s.status === 'skipped'
        return (
          <div key={key} className={`flex items-center gap-2 text-xs ${
            isErr ? 'text-red-600' : isSkipped ? 'text-slate-400' : 'text-emerald-700'
          }`}>
            {isErr     ? <AlertTriangle size={11} className="shrink-0" />
             : isSkipped ? <Clock size={11} className="shrink-0" />
             : <CheckCircle size={11} className="shrink-0" />}
            <span className="font-semibold">{STEP_META[key].label}:</span>
            <span className="text-slate-500">{s.message}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────
export default function UploadPrescription() {
  const [file,       setFile]       = useState(null)
  const [sizeError,  setSizeError]  = useState(false)
  const [processing, setProcessing] = useState(false)
  const [retrying,   setRetrying]   = useState(false)
  const [activeStep, setActiveStep] = useState(null)
  const [result,     setResult]     = useState(null)
  const [fatalError, setFatalError] = useState(null)
  const [saved,      setSaved]      = useState(false)

  const isPDF       = file?.type === 'application/pdf'
  const visibleSteps = (result?.source_type === 'pdf' || isPDF) ? ALL_STEPS : IMG_STEPS
  const steps        = result?.steps || {}
  const riskLevel    = result?.risk?.risk
  const hasPending   = riskLevel === 'Pending'
  const canRetry     = !!result?.record_id && (
    steps.ocr?.status === 'error' ||
    steps.ocr?.status === 'skipped' ||
    result?.steps?.upload?.status === 'done'
  )

  const reset = () => {
    setFile(null); setSizeError(false); setResult(null)
    setFatalError(null); setActiveStep(null); setSaved(false)
  }

  const handleFile = (f, tooBig) => {
    setSizeError(tooBig); setFile(f); setResult(null); setFatalError(null); setSaved(false)
  }

  // ── Upload + pipeline ─────────────────────────────────
  const handleUpload = async () => {
    if (!file || sizeError || processing) return
    setProcessing(true); setResult(null); setFatalError(null); setSaved(false)

    const filePDF = file.type === 'application/pdf'
    const stepKeys = filePDF ? ALL_STEPS : IMG_STEPS
    const delays   = filePDF
      ? { upload: 400, pdf_convert: 1200, ocr: 1500, gemini: 800, ddinter: 700, risk: 600 }
      : { upload: 400, ocr: 800, gemini: 800, ddinter: 700, risk: 600 }

    const animate = async () => {
      for (const key of stepKeys) {
        setActiveStep(key)
        await new Promise(r => setTimeout(r, delays[key]))
      }
      setActiveStep(null)
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('file_type', 'prescription')

    const [, apiRes] = await Promise.allSettled([animate(), uploadPrescription(fd)])

    if (apiRes.status === 'fulfilled') {
      const data = apiRes.value.data
      setResult(data)
      if (data.steps?.upload?.status === 'done') toast.success('File uploaded and saved')
      if (data.error) toast.error('Some AI steps failed — see details below')
    } else {
      setFatalError(extractError(apiRes.reason))
      toast.error('Upload failed')
    }

    setProcessing(false); setActiveStep(null)
  }

  // ── Retry OCR ─────────────────────────────────────────
  const handleRetryOCR = async () => {
    if (!result?.record_id || retrying) return
    setRetrying(true)

    const stepKeys = result.source_type === 'pdf' ? ALL_STEPS : IMG_STEPS
    const delays   = result.source_type === 'pdf'
      ? { upload: 0, pdf_convert: 1200, ocr: 1500, gemini: 800, ddinter: 700, risk: 600 }
      : { upload: 0, ocr: 800, gemini: 800, ddinter: 700, risk: 600 }

    const animate = async () => {
      for (const key of stepKeys) {
        if (key === 'upload') continue
        setActiveStep(key)
        await new Promise(r => setTimeout(r, delays[key]))
      }
      setActiveStep(null)
    }

    const [, apiRes] = await Promise.allSettled([animate(), retryOCR(result.record_id)])

    if (apiRes.status === 'fulfilled') {
      const data = apiRes.value.data
      // Merge upload step from original result
      setResult({ ...data, steps: { ...data.steps, upload: result.steps?.upload } })
      if (data.steps?.ocr?.status === 'done') toast.success('OCR retry successful')
      else toast.error('OCR retry failed — see details')
    } else {
      toast.error(extractError(apiRes.reason))
    }

    setRetrying(false); setActiveStep(null)
  }

  const activeLabel = {
    upload:      'Saving file to server and MongoDB…',
    pdf_convert: 'Converting PDF pages to PNG with PyMuPDF…',
    ocr:         isPDF ? 'Running TrOCR on converted PNG pages…' : 'Extracting text with TrOCR…',
    gemini:      'Identifying medicines with Gemini AI…',
    ddinter:     'Checking DDInter drug interaction database…',
    risk:        'Calculating risk score with rule engine…',
  }

  return (
    <div className="space-y-6 pb-8 max-w-3xl">
      <div>
        <h1 className="page-title">Upload Prescription / Report</h1>
        <p className="page-subtitle">
          File saved first — OCR → Gemini → DDInter → Risk run step-by-step with fallback on failure
        </p>
      </div>

      {/* ── Pipeline tracker ──────────────────────────── */}
      <div className="card p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Processing Pipeline</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {visibleSteps.map((key, i) => (
            <div key={key} className="flex items-center gap-1 shrink-0">
              <StepPill stepKey={key} steps={steps} activeStep={processing || retrying ? activeStep : null} />
              {i < visibleSteps.length - 1 && <ChevronRight size={13} className="text-slate-300 shrink-0" />}
            </div>
          ))}
        </div>
        {result && <StepSummary steps={steps} visibleSteps={visibleSteps} />}
        {(processing || retrying) && activeStep && (
          <p className="text-xs text-blue-600 font-medium mt-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            {activeLabel[activeStep]}
          </p>
        )}
      </div>

      {/* ── Upload card ───────────────────────────────── */}
      <div className="card p-6 space-y-4">
        {!file ? (
          <DropZone onFile={handleFile} />
        ) : (
          <FilePreview file={file} onClear={reset} disabled={processing} />
        )}

        {sizeError && file && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              <strong>{(file.size / 1024 / 1024).toFixed(1)} MB</strong> exceeds the 5 MB limit.
              {file.type === 'application/pdf'
                ? ' Extract only the first page of the PDF.'
                : ' Please compress or crop the image.'}
            </p>
          </div>
        )}

        {file && !sizeError && !processing && !result && (
          <button onClick={handleUpload} className="btn-primary w-full py-3">
            <Upload size={16} /> Upload &amp; Process with AI
          </button>
        )}

        {processing && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-700">
              {isPDF
                ? 'Processing PDF — converting pages then running OCR. 30–120 seconds…'
                : 'Processing image — usually 15–60 seconds…'}
            </p>
          </div>
        )}
      </div>

      {/* Fatal error */}
      {fatalError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-4">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Upload failed</p>
            <p className="text-xs text-red-600 mt-1">{fatalError}</p>
          </div>
          <button onClick={reset} className="btn-secondary btn-sm shrink-0"><RefreshCw size={12} /> Retry</button>
        </div>
      )}

      {/* ── Results ───────────────────────────────────── */}
      {result && (
        <div className="space-y-4">

          {/* Upload confirmed banner */}
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800">File uploaded and saved to medical history</p>
              <p className="text-xs text-emerald-600 mt-0.5 font-mono">{result.record_id}</p>
            </div>
            {result.source_type === 'pdf' && <span className="badge-orange text-[10px] shrink-0">PDF→PNG→OCR</span>}
            {!saved
              ? <button onClick={() => { setSaved(true); toast.success('Confirmed in Medical History') }}
                  className="btn-success btn-sm shrink-0 flex items-center gap-1">
                  <Save size={12} /> Confirm Save
                </button>
              : <span className="badge-green shrink-0">Saved ✓</span>}
          </div>

          {/* Partial failure warning + Retry OCR button */}
          {(result.error || steps.ocr?.status === 'error') && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">AI analysis partially failed</p>
                <p className="text-xs text-amber-700 mt-0.5">{result.error || steps.ocr?.message}</p>
                <p className="text-xs text-amber-600 mt-1">Your file is saved. You can retry OCR below.</p>
              </div>
              {canRetry && (
                <button onClick={handleRetryOCR} disabled={retrying}
                  className="btn-secondary btn-sm shrink-0 flex items-center gap-1.5">
                  <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
                  {retrying ? 'Retrying…' : 'Retry OCR'}
                </button>
              )}
            </div>
          )}

          {/* Step 1 — OCR text */}
          {result.ocr_text ? (
            <div className="card overflow-hidden">
              <div className="card-header">
                <p className="section-title flex items-center gap-2">
                  <Eye size={15} className="text-blue-600" /> OCR Extracted Text
                </p>
                <div className="flex items-center gap-2">
                  {result.source_type === 'pdf' && <span className="badge-orange text-[10px]">PDF→PNG→OCR</span>}
                  <span className="badge-blue">TrOCR</span>
                </div>
              </div>
              <div className="p-5">
                <pre className="text-sm font-mono text-slate-700 bg-slate-50 rounded-lg p-4 border border-slate-200 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {result.ocr_text}
                </pre>
              </div>
            </div>
          ) : steps.ocr?.status === 'error' ? (
            <StepErrorCard label="OCR Failed" icon={Eye} message={steps.ocr.message} recordId={result.record_id} onRetry={handleRetryOCR} retrying={retrying} />
          ) : null}

          {/* Step 2 — Gemini medicines */}
          {result.medicines?.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="card-header">
                <p className="section-title flex items-center gap-2">
                  <Cpu size={15} className="text-purple-600" /> Gemini AI — Extracted Medicines
                </p>
                <span className="badge-purple">{result.medicines.length} found</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>{['Medicine', 'Dosage', 'Frequency', 'Duration'].map(h => <th key={h} className="th">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.medicines.map((m, i) => (
                      <tr key={i} className="tr">
                        <td className="td font-semibold text-slate-800">{m.name}</td>
                        <td className="td text-slate-600">{m.dosage    || '—'}</td>
                        <td className="td text-slate-500">{m.frequency || '—'}</td>
                        <td className="td text-slate-500">{m.duration  || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : steps.gemini?.status === 'error' ? (
            <StepErrorCard label="Gemini Extraction Failed" icon={Cpu} message={steps.gemini.message} />
          ) : result.ocr_text ? (
            <div className="card p-4 flex items-center gap-3 text-slate-500 text-sm">
              <Pill size={15} className="text-slate-400 shrink-0" />
              No medicines extracted. The prescription text may be unclear.
            </div>
          ) : null}

          {/* Step 3 — DDInter */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <p className="section-title flex items-center gap-2">
                <Database size={15} className="text-orange-600" /> DDInter — Drug Interactions
              </p>
              {steps.ddinter?.status === 'error'
                ? <span className="badge-red">Error</span>
                : <span className={result.interactions?.length > 0 ? 'badge-orange' : 'badge-green'}>
                    {result.interactions?.length > 0 ? `${result.interactions.length} found` : 'None found'}
                  </span>}
            </div>
            <div className="p-5">
              {steps.ddinter?.status === 'error' ? (
                <p className="text-sm text-red-600">{steps.ddinter.message}</p>
              ) : !result.interactions?.length ? (
                <div className="flex items-center gap-2 text-emerald-700 text-sm">
                  <CheckCircle size={15} className="text-emerald-500" />
                  No drug interactions detected in DDInter database.
                </div>
              ) : (
                <div className="space-y-2">
                  {result.interactions.map((ix, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${RISK_BORDER[ix.level] || RISK_BORDER.Low}`}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={14} className={`${RISK_TEXT[ix.level] || RISK_TEXT.Low} mt-0.5 shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-slate-800 text-sm">{ix.drug_a}</span>
                            <span className="text-slate-400">+</span>
                            <span className="font-bold text-slate-800 text-sm">{ix.drug_b}</span>
                            <span className={`badge text-xs ${
                              ix.level === 'Critical' ? 'risk-critical' : ix.level === 'High' ? 'risk-high' :
                              ix.level === 'Medium' ? 'risk-medium' : 'risk-low'
                            }`}>{ix.level}</span>
                          </div>
                          <p className="text-sm text-slate-700">{ix.description}</p>
                          {ix.recommendation && (
                            <div className="mt-2 flex items-start gap-1.5">
                              <BookOpen size={11} className="text-slate-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-slate-500"><strong>Recommendation:</strong> {ix.recommendation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 4 — Risk Engine */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <p className="section-title flex items-center gap-2">
                <Shield size={15} className="text-red-600" /> Risk Engine — Final Assessment
              </p>
              {hasPending
                ? <span className="flex items-center gap-1 badge-gray text-xs"><Clock size={10} /> Pending</span>
                : <span className={`badge ${
                    riskLevel === 'Critical' ? 'risk-critical' : riskLevel === 'High' ? 'risk-high' :
                    riskLevel === 'Medium' ? 'risk-medium' : 'risk-low'
                  }`}>{riskLevel}</span>}
            </div>
            <div className="p-5 space-y-3">
              {hasPending ? (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <Info size={15} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Risk analysis could not be completed</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {result.risk?.message || 'Record uploaded successfully. Retry OCR to re-run analysis.'}
                    </p>
                    {canRetry && (
                      <button onClick={handleRetryOCR} disabled={retrying}
                        className="btn-secondary btn-sm mt-2 flex items-center gap-1.5">
                        <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
                        {retrying ? 'Retrying…' : 'Retry OCR & Analysis'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <RiskAlert level={riskLevel} message={result.explanation} interactions={result.interactions || []} />
              )}
              <div className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-emerald-700">
                <CheckCircle size={11} className="shrink-0" />
                Record saved to MongoDB — visible in Medical History
              </div>
            </div>
          </div>

          <button onClick={reset} className="btn-secondary w-full flex items-center justify-center gap-2">
            <RefreshCw size={14} /> Upload Another Prescription
          </button>
        </div>
      )}
    </div>
  )
}

function StepErrorCard({ label, icon: Icon, message, recordId, onRetry, retrying }) {
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <p className="section-title flex items-center gap-2 text-red-700"><Icon size={15} /> {label}</p>
        <span className="badge-red">Failed</span>
      </div>
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{message}</p>
        </div>
        {onRetry && recordId && (
          <button onClick={onRetry} disabled={retrying}
            className="btn-secondary btn-sm shrink-0 flex items-center gap-1.5">
            <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Retrying…' : 'Retry OCR'}
          </button>
        )}
      </div>
    </div>
  )
}
