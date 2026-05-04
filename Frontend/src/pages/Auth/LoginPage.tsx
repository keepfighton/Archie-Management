import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { login } from '@/store/slices/authSlice'
import { RootState, AppDispatch } from '@/store'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

import frameKananUrl from '../../../logo/FrameKanan.png'
import nexoraPartUrl from '../../../logo/Logo_Nexora_Part.png'

export default function LoginPage() {
  const dispatch  = useDispatch<AppDispatch>()
  const navigate  = useNavigate()
  const { token, loading, error } = useSelector((s: RootState) => s.auth)

  const [email,    setEmail]    = useState(() => localStorage.getItem('remembered_email') || '')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(() => !!localStorage.getItem('remembered_email'))

  useEffect(() => { if (token) navigate('/dashboard') }, [token])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (remember) localStorage.setItem('remembered_email', email)
    else          localStorage.removeItem('remembered_email')
    dispatch(login({ email: email.trim(), password, remember }))
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 lg:flex-row">

      {/* ══════════════════════════════════════════════
          MOBILE LAYOUT  (hidden on lg+)
      ══════════════════════════════════════════════ */}
      <div className="flex flex-col min-h-screen lg:hidden relative overflow-hidden"
           style={{ background: 'linear-gradient(145deg, #0b1c38 0%, #112b54 40%, #0e3f7a 70%, #0a2a5e 100%)' }}>

        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', filter: 'blur(40px)' }} />
        <div className="absolute top-1/3 -left-20 w-56 h-56 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle, #6366f1, transparent)', filter: 'blur(36px)' }} />
        <div className="absolute bottom-32 right-0 w-48 h-48 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle, #38bdf8, transparent)', filter: 'blur(32px)' }} />

        {/* Dot grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* ── Hero top section ── */}
        <div className="relative z-10 flex flex-col items-center pt-14 pb-8 px-6">
          <img src={nexoraPartUrl} alt="Nexora" className="h-16 w-auto object-contain drop-shadow-lg" />
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Business. Simplified.</h1>
            <p className="mt-1.5 text-sm text-blue-200/70">Your integrated workspace platform</p>
          </div>

          {/* Feature pills */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {['Finance', 'CRM', 'Operations', 'Team'].map(f => (
              <span key={f} className="px-3 py-1 rounded-full text-[11px] font-medium text-blue-100/80"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* ── Form card ── */}
        <div className="relative z-10 flex-1 flex flex-col justify-end px-4 pb-8">
          <div className="rounded-2xl p-6 shadow-2xl"
               style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}>

            <h2 className="text-[1.6rem] font-bold text-gray-900 leading-tight mb-0.5">Welcome back</h2>
            <p className="text-[13px] text-gray-400 mb-5">Sign in to access your workspace</p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Email address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Mail size={14} className="text-gray-400" />
                  </span>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email" required autoComplete="off"
                    className="w-full pl-9 pr-4 py-3 text-[14px] rounded-xl border border-gray-200 bg-gray-50
                               placeholder-gray-300 text-gray-900
                               focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white
                               transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Lock size={14} className="text-gray-400" />
                  </span>
                  <input
                    type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password" required autoComplete="off"
                    className="w-full pl-9 pr-11 py-3 text-[14px] rounded-xl border border-gray-200 bg-gray-50
                               placeholder-gray-300 text-gray-900
                               focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white
                               transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                          className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                         className="w-4 h-4 rounded border-gray-300 accent-[#1e3a5f] cursor-pointer" />
                  <span className="text-[13px] text-gray-600">Remember me</span>
                </label>
                <button type="button" onClick={() => navigate('/forgot-password')}
                        className="text-[13px] font-semibold text-[#1a5cb0] hover:text-[#1e3a5f] transition-colors">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white
                           flex items-center justify-center gap-2 transition-all
                           disabled:opacity-70 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #1a3a6b 100%)',
                         boxShadow: '0 8px 24px rgba(13,31,60,0.35)' }}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Sign in'}
              </button>
            </form>

            <p className="mt-5 text-center text-[11px] text-gray-300">© 2026 NEXORA. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP LAYOUT  (hidden below lg)
      ══════════════════════════════════════════════ */}
      <div className="hidden lg:flex min-h-screen w-full flex-row">

        {/* Left panel */}
        <div className="relative flex min-h-screen w-[30%] flex-col bg-white">
          <div className="z-20 flex items-center justify-center lg:absolute lg:left-1/2 lg:top-0 lg:-translate-x-1/2">
            <img src={nexoraPartUrl} alt="Nexora" className="h-[288px] w-auto object-contain" />
          </div>

          <div className="flex flex-1 flex-col justify-center px-16 py-12">
            <div className="w-full max-w-[420px]">
              <div className="mb-7">
                <h2 className="text-[1.9rem] font-bold text-gray-900 leading-tight mb-1.5">Welcome back</h2>
                <p className="text-[14px] text-gray-400">Sign in to access your workspace</p>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    Email address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                      <Mail size={15} className="text-gray-400" />
                    </span>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Enter your email" required autoComplete="off"
                      className="w-full pl-10 pr-4 py-3 text-[14px] rounded-lg border border-gray-200 bg-gray-50
                                 placeholder-gray-300 text-gray-900
                                 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white
                                 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                      <Lock size={15} className="text-gray-400" />
                    </span>
                    <input
                      type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password" required autoComplete="off"
                      className="w-full pl-10 pr-11 py-3 text-[14px] rounded-lg border border-gray-200 bg-gray-50
                                 placeholder-gray-300 text-gray-900
                                 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white
                                 transition-all"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                            className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                           className="w-4 h-4 rounded border-gray-300 accent-[#1e3a5f] cursor-pointer" />
                    <span className="text-[13px] text-gray-600">Remember me</span>
                  </label>
                  <button type="button" onClick={() => navigate('/forgot-password')}
                          className="text-[13px] font-semibold text-[#1a5cb0] hover:text-[#1e3a5f] transition-colors">
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-lg text-[15px] font-semibold text-white
                             bg-[#0d1f3c] hover:bg-[#172d50] active:bg-[#0a1628]
                             flex items-center justify-center gap-2 transition-colors
                             disabled:opacity-70 shadow-md shadow-[#0d1f3c]/25"
                >
                  {loading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : 'Sign in'}
                </button>
              </form>
            </div>
          </div>

          <div className="px-16 pb-8">
            <p className="text-[11px] text-gray-300">© 2026 NEXORA. All rights reserved.</p>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-1 relative overflow-hidden items-center justify-center">
          <img src={frameKananUrl} alt=""
               className="absolute inset-0 w-full h-full object-cover object-left-top scale-110"
               style={{ filter: 'blur(18px)', opacity: 0.85 }} />
          <div className="absolute inset-0" style={{ background: 'rgba(8,18,40,0.45)' }} />
          <div className="relative z-10 w-[99%] h-[99%] rounded-2xl overflow-hidden"
               style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <img src={frameKananUrl} alt="" className="w-full h-full object-cover object-left-top" />
          </div>
        </div>

      </div>
    </div>
  )
}
