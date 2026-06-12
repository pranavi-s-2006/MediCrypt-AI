import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Lock, Mail, CheckCircle } from 'lucide-react'
import { authLogin } from '../services/api'
import { InlineLoader } from '../components/Loader'
import { InlineError } from '../components/ApiError'
import toast from 'react-hot-toast'

const ROLE_ROUTES = {
  patient:        '/patient',
  doctor:         '/doctor',
  hospital_admin: '/admin',
  caregiver:      '/caregiver',
}

export default function Login() {
  const [form,    setForm]    = useState({ email: '', password: '' })
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
      const res = await authLogin(form)
      const { access_token, user } = res.data
      localStorage.setItem('token', access_token)
      localStorage.setItem('user',  JSON.stringify(user))
      toast.success(`Welcome back, ${user.name}`)
      navigate(ROLE_ROUTES[user.role] || '/patient', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid credentials. Please try again.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex">

      {/* Left hero panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-14 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shadow-lg">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-base leading-tight">MediCrypt Guardian AI</p>
            <p className="text-blue-300 text-xs tracking-wide">Secure Health Memory Platform</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-5xl font-bold leading-tight mb-4">
              Your lifelong<br />medical identity,<br />
              <span className="bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                secured by AI.
              </span>
            </h1>
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              Consent-based access, end-to-end encrypted records, AI drug interaction alerts, and Tamil voice support.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { label: 'End-to-End Encryption',  desc: 'AES-256 encrypted health records' },
              { label: 'Consent-Gated Access',    desc: 'Doctors need explicit patient approval' },
              { label: 'AI Drug Safety',          desc: 'DDInter + Gemini interaction checks' },
              { label: 'Emergency Face ID',       desc: 'Hospital staff identify patients instantly' },
              { label: 'Tamil Voice Support',     desc: 'IndicBERT + Whisper ASR' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                  <CheckCircle size={11} className="text-blue-400" />
                </div>
                <span className="text-sm font-medium text-white">{f.label}</span>
                <span className="text-slate-400 text-sm">— {f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600">© 2024 MediCrypt Guardian AI · HIPAA Compliant · ISO 27001</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield size={15} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm">MediCrypt Guardian AI</span>
          </div>

          <div className="bg-white rounded-2xl shadow-modal p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
              <p className="text-slate-500 text-sm mt-1">Access your secure health portal</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email" className="input pl-9" placeholder="you@example.com"
                    value={form.email} onChange={set('email')} required autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={show ? 'text' : 'password'} className="input pl-9 pr-10"
                    placeholder="••••••••" value={form.password} onChange={set('password')}
                    required autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <InlineError error={error} />

              <button type="submit" className="btn-primary w-full py-3 text-sm" disabled={loading}>
                {loading ? <InlineLoader /> : <Lock size={15} />}
                Sign In Securely
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                New to MediCrypt?{' '}
                <Link to="/register" className="text-blue-600 font-semibold hover:underline">Create account</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
