import { CheckCircle, XCircle, Award, Calendar, Users, Stethoscope } from 'lucide-react'

export default function DoctorCard({ doctor, onVerify }) {
  const initials = doctor.name
    ?.split(' ')
    .filter(Boolean)
    .slice(1, 3)
    .map(w => w[0])
    .join('') || 'DR'

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">{doctor.name}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Stethoscope size={10} /> {doctor.specialization}
                {doctor.department && doctor.department !== doctor.specialization && ` · ${doctor.department}`}
              </p>
            </div>
            <span className={`shrink-0 ${doctor.is_verified ? 'badge-green' : 'badge-yellow'}`}>
              {doctor.is_verified ? 'Verified' : 'Pending'}
            </span>
          </div>

          <div className="mt-2.5 space-y-1">
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Award size={10} className="text-slate-300" />
              <span className="font-mono">{doctor.license_number}</span>
            </p>
            {doctor.joined && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Calendar size={10} className="text-slate-300" />
                Joined {new Date(doctor.joined).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </p>
            )}
            {typeof doctor.patients === 'number' && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Users size={10} className="text-slate-300" />
                {doctor.patients} approved patient{doctor.patients !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {onVerify && (
            <div className="flex gap-2 mt-3">
              {!doctor.is_verified && (
                <button
                  onClick={() => onVerify(doctor.user_id, true)}
                  className="btn-success btn-sm flex items-center gap-1"
                >
                  <CheckCircle size={12} /> Verify Doctor
                </button>
              )}
              {doctor.is_verified && (
                <button
                  onClick={() => onVerify(doctor.user_id, false)}
                  className="btn-danger btn-sm flex items-center gap-1"
                >
                  <XCircle size={12} /> Revoke
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
