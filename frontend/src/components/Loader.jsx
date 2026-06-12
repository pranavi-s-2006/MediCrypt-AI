import { Loader2 } from 'lucide-react'

export default function Loader({ text = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={22} />
      </div>
      <p className="text-sm text-slate-500 font-medium">{text}</p>
    </div>
  )
}

export function InlineLoader() {
  return <Loader2 className="animate-spin" size={16} />
}

export function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-2.5 bg-slate-100 rounded w-1/3" />
        </div>
      </div>
      <div className="h-2.5 bg-slate-100 rounded w-full" />
      <div className="h-2.5 bg-slate-100 rounded w-4/5" />
    </div>
  )
}

export function PageLoader({ text = 'Loading secure data…' }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
      </div>
      <p className="text-sm text-slate-500 font-medium">{text}</p>
    </div>
  )
}
