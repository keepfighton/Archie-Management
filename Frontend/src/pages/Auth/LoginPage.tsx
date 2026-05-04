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

      {/* ── Left panel ─────────────────────────────── */}
      <div className="relative flex min-h-screen w-full flex-col bg-white lg:w-[30%]">

        {/* Logo Nexora Part — center top, overlapping */}
        <div className="z-20 flex items-center justify-center px-6 pt-8 lg:absolute lg:left-1/2 lg:top-0 lg:-translate-x-1/2 lg:px-0 lg:pt-0">
          <img src={nexoraPartUrl} alt="Nexora" className="h-28 w-auto object-contain sm:h-36 lg:h-[288px]" />
        </div>

        {/* Form — vertically centered */}
        <div className="flex flex-1 flex-col justify-center px-6 pb-10 pt-6 sm:px-10 lg:px-16 lg:py-12">
          <div className="w-full max-w-[420px]">

            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-[1.9rem] font-bold text-gray-900 leading-tight mb-1.5">
                Welcome back
              </h2>
              <p className="text-[14px] text-gray-400">
                Sign in to access your workspace
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">

              {/* Email */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Email address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Mail size={15} className="text-gray-400" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-3 text-[14px] rounded-lg border border-gray-200 bg-gray-50
                               placeholder-gray-300 text-gray-900
                               focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white
                               transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Lock size={15} className="text-gray-400" />
                  </span>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="off"
                    className="w-full pl-10 pr-11 py-3 text-[14px] rounded-lg border border-gray-200 bg-gray-50
                               placeholder-gray-300 text-gray-900
                               focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white
                               transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 accent-[#1e3a5f] cursor-pointer"
                  />
                  <span className="text-[13px] text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-[13px] font-semibold text-[#1a5cb0] hover:text-[#1e3a5f] transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
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

        {/* Copyright — bottom fixed */}
        <div className="px-6 pb-8 sm:px-10 lg:px-16">
          <p className="text-[11px] text-gray-300">© 2026 NEXORA. All rights reserved.</p>
        </div>

      </div>

      {/* ── Right panel ────────────────────────────── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center">
        {/* Blurred background — fills the empty frame area */}
        <img
          src={frameKananUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-left-top scale-110"
          style={{ filter: 'blur(18px)', opacity: 0.85 }}
        />
        {/* Dark overlay to deepen the blur */}
        <div className="absolute inset-0" style={{ background: 'rgba(8,18,40,0.45)' }} />
        {/* Main image 99% */}
        <div className="relative z-10 w-[99%] h-[99%] rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
          <img src={frameKananUrl} alt="" className="w-full h-full object-cover object-left-top" />
        </div>

      </div>

    </div>
  )
}
