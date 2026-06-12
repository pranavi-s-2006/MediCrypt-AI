import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, User, Mail, Phone, Lock, Stethoscope, Building2, Heart, UserCircle } from 'lucide-react'
import { authRegister } from '../services/api'
import { InlineLoader } from '../components/Loader'
import { InlineError } from '../components/ApiError'
import toast from 'react-hot-toast'

const ROLE_ROUTES = {
  patient:        '/patient',
  doctor:         '/doctor',
  hospital_admin: '/admin',
  caregiver:      '/caregiver',
}

const ROLES = [
  { value: 'patient',        label: 'Patient',        desc: 'Manage my health records',         icon: UserCircle, color: 'blue'    },
  { value: 'doctor',         label: 'Doctor',          desc: 'Access records with consent',      icon: Stethoscope, color: 'teal'  },
  { value: 'hospital_admin', label: 'Hospital Admin',  desc: 'Manage doctors & departments',    icon: Building2,  color: 'purple' },
  { value: 'caregiver',      label: 'Caregiver',       desc: 'Support a family member',         icon: Heart,      color: 'emerald'},
]

const ACTIVE_STYLE = {
  blue:    'border-blue-600 bg-blue-50',
  teal:    'border-teal-600 bg-teal-50',
  purple:  'border-purple-600 bg-purple-50',
  emerald: 'border-emerald-600 bg-emerald-50',
}
const ACTIVE_TEXT = {
  blue: 'text-blue-700', teal: 'text-teal-700', purple: 'text-purple-700', emerald: 'text-emerald-700',
}

export default function Register() {
  const [form,    setForm]    = useState({ name: '', email: '', password: '', role: 'patient', phone: '' })
  const [show,    setShow]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await authRegister(form)
      const { access_token, user } = res.data
      localStorage.setItem('token', access_token)
      localStorage.setItem('user',  JSON.stringify(user))
      toast.success('Account created successfully!')
      navigate(ROLE_ROUTES[user.role] || '/patient', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Registration failed. Please try again.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center gap-2 justify-center mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <span className="font-bold text-white text-base">MediCrypt Guardian AI</span>
        </div>

        <div className="bg-white rounded-2xl shadow-modal p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
            <p className="text-slate-500 text-sm mt-1">Secure · Encrypted · Consent-based</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selector */}
            <div>
              <label className="label">I am a</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => {
                  const active = form.role === r.value
                  return (
                    <button key={r.value} type="button"
                      onClick={() => setForm(p => ({ ...p, role: r.value }))}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${active ? ACTIVE_STYLE[r.color] : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <r.icon size={13} className={active ? ACTIVE_TEXT[r.color] : 'text-slate-400'} />
                        <p className={`text-sm font-semibold ${active ? ACTIVE_TEXT[r.color] : 'text-slate-700'}`}>{r.label}</p>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight">{r.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-9" placeholder="Your full name" value={form.name}
                    onChange={set('name')} required />
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" className="input pl-9" placeholder="you@example.com" value={form.email}
                    onChange={set('email')} required autoComplete="email" />
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-9" placeholder="+91 98765 43210" value={form.phone}
                    onChange={set('phone')} />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={show ? 'text' : 'password'} className="input pl-9 pr-9"
                    placeholder="Min. 8 characters" value={form.password}
                    onChange={set('password')} required minLength={8} autoComplete="new-password" />
                  <button type="button" onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <InlineError error={error} />

            <button type="submit" className="btn-primary w-full py-3 text-sm" disabled={loading}>
              {loading ? <InlineLoader /> : <Shield size={15} />}
              Create Secure Account
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5 pt-5 border-t border-slate-100">
            Already registered?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
