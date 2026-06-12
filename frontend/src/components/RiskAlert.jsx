import { AlertTriangle, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react'

const CFG = {
  Critical: {
    wrap: 'border-l-4 border-red-600 bg-red-50 rounded-r-xl p-4',
    icon: XCircle,
    iconCls: 'text-red-600',
    badge: 'bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full',
    title: 'Critical Risk — Immediate Action Required',
    titleCls: 'text-red-800',
  },
  High: {
    wrap: 'border-l-4 border-orange-500 bg-orange-50 rounded-r-xl p-4',
    icon: AlertTriangle,
    iconCls: 'text-orange-600',
    badge: 'bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full',
    title: 'High Risk — Monitor Closely',
    titleCls: 'text-orange-800',
  },
  Medium: {
    wrap: 'border-l-4 border-amber-400 bg-amber-50 rounded-r-xl p-4',
    icon: AlertCircle,
    iconCls: 'text-amber-600',
    badge: 'bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full',
    title: 'Medium Risk — Consult Doctor',
    titleCls: 'text-amber-800',
  },
  Low: {
    wrap: 'border-l-4 border-emerald-500 bg-emerald-50 rounded-r-xl p-4',
    icon: CheckCircle,
    iconCls: 'text-emerald-600',
    badge: 'bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full',
    title: 'Low Risk',
    titleCls: 'text-emerald-800',
  },
}

export default function RiskAlert({ level = 'Low', message, interactions = [] }) {
  const cfg = CFG[level] || CFG.Low
  const Icon = cfg.icon

  return (
    <div className={cfg.wrap}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={`${cfg.iconCls} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-bold text-sm ${cfg.titleCls}`}>{cfg.title}</span>
            <span className={cfg.badge}>{level}</span>
          </div>
          {message && (
            <p className="text-sm text-slate-700 leading-relaxed">{message}</p>
          )}
          {interactions.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {interactions.map((i, idx) => (
                <div key={idx} className="bg-white/70 rounded-lg px-3 py-2.5 border border-white text-xs text-slate-700">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-bold text-red-700">{i.drug_a}</span>
                    <span className="text-slate-400">+</span>
                    <span className="font-bold text-red-700">{i.drug_b}</span>
                    {i.level && (
                      <span className={`ml-auto font-semibold text-[10px] ${
                        i.level === 'High' || i.level === 'Critical' ? 'text-red-600' :
                        i.level === 'Medium' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>{i.level}</span>
                    )}
                  </div>
                  <p className="text-slate-600">{i.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
