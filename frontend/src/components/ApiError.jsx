import { AlertTriangle, RefreshCw, WifiOff, ServerCrash } from 'lucide-react'

/** Full-block API error with retry button */
export function ApiError({ error, onRetry, className = '' }) {
  const isNetwork = error?.includes('Cannot reach') || error?.includes('Network')
  const Icon = isNetwork ? WifiOff : ServerCrash

  return (
    <div className={`flex flex-col items-center justify-center py-14 gap-4 ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
        <Icon size={22} className="text-red-500" />
      </div>
      <div className="text-center max-w-sm">
        <p className="text-sm font-semibold text-slate-800 mb-1">
          {isNetwork ? 'Connection Failed' : 'Request Failed'}
        </p>
        <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary btn-sm flex items-center gap-1.5">
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  )
}

/** Inline small error banner */
export function InlineError({ error }) {
  if (!error) return null
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
      <p className="text-xs text-red-700">{error}</p>
    </div>
  )
}

/** Empty state placeholder */
export function ApiEmpty({ message = 'No data found.', icon: Icon = AlertTriangle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
      <Icon size={36} className="opacity-25" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
