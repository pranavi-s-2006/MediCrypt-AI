import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, FileImage, X, CheckCircle, AlertTriangle } from 'lucide-react'

const MAX_SIZE_BYTES = 5 * 1024 * 1024   // 5 MB
const MAX_SIZE_LABEL = '5 MB'

export default function UploadBox({ onUpload, accept, label = 'Upload File', hint = 'Supports JPG, PNG, PDF — max 5 MB' }) {
  const [file,      setFile]      = useState(null)
  const [done,      setDone]      = useState(false)
  const [sizeError, setSizeError] = useState(false)

  const onDrop = useCallback((accepted) => {
    if (!accepted[0]) return
    if (accepted[0].size > MAX_SIZE_BYTES) {
      setSizeError(true)
      setFile(accepted[0])
      setDone(false)
      return
    }
    setSizeError(false)
    setFile(accepted[0])
    setDone(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: accept || {
      'image/*':        ['.jpg', '.jpeg', '.png'],
      'application/pdf': ['.pdf'],
    },
  })

  const handleSubmit = () => {
    if (file && !sizeError && onUpload) {
      onUpload(file)
      setDone(true)
    }
  }

  const clear = () => { setFile(null); setDone(false); setSizeError(false) }

  const isPDF     = file?.type === 'application/pdf'
  const fileSizeKB = file ? (file.size / 1024).toFixed(1) : 0

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 select-none
          ${isDragActive
            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
            : sizeError
            ? 'border-red-300 bg-red-50'
            : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
          }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
            isDragActive ? 'bg-blue-100' : sizeError ? 'bg-red-100' : 'bg-slate-100'
          }`}>
            <Upload size={24} className={isDragActive ? 'text-blue-600' : sizeError ? 'text-red-500' : 'text-slate-400'} />
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">{label}</p>
            <p className="text-xs text-slate-400 mt-1">
              {isDragActive ? '📂 Drop the file here' : hint}
            </p>
          </div>
          <button type="button" className="btn-secondary btn-sm pointer-events-none">
            Browse Files
          </button>
          <p className="text-[11px] text-slate-300">or drag and drop · max {MAX_SIZE_LABEL}</p>
        </div>
      </div>

      {/* Size error */}
      {sizeError && file && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">File too large — {(file.size / 1024 / 1024).toFixed(1)} MB</p>
            <p className="text-xs text-red-600 mt-0.5">
              Maximum allowed size is {MAX_SIZE_LABEL}. Please compress the file or crop to a single page before uploading.
              {file.type === 'application/pdf' && ' For PDFs, try extracting only the first page.'}
            </p>
          </div>
          <button onClick={clear} className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-600">
            <X size={13} />
          </button>
        </div>
      )}

      {/* File ready to upload */}
      {file && !sizeError && (
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-all ${
          done ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            {done
              ? <CheckCircle size={18} className="text-emerald-600 shrink-0" />
              : isPDF
              ? <FileText size={18} className="text-blue-600 shrink-0" />
              : <FileImage size={18} className="text-blue-600 shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate max-w-[200px] sm:max-w-xs">
                {file.name}
              </p>
              <p className="text-xs text-slate-500">
                {fileSizeKB} KB · {isPDF ? 'PDF — first 2 pages will be processed' : file.type || 'image'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!done && (
              <button onClick={handleSubmit} className="btn-primary btn-sm">
                Process with AI
              </button>
            )}
            {done && (
              <span className="text-xs font-semibold text-emerald-700">Submitted ✓</span>
            )}
            <button onClick={clear}
              className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
