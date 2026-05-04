import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { login } from '@/store/slices/authSlice'
import { RootState, AppDispatch } from '@/store'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

import frameKananUrl from '../../../logo/FrameKanan.png'
import pusintekLogoUrl from "../../../logo/Logo_Pusintek.jpeg"

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

        {/* ── Mobile hero header (hidden on lg) ─────── */}
        <div className="lg:hidden relative overflow-hidden bg-gradient-to-br from-[#0d2d5a] via-[#0e4272] to-[#0a7a8f] px-8 pt-14 pb-20 flex flex-col items-center">
          {/* decorative blobs */}
          <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full bg-white/5" />
          <div className="absolute top-6 -left-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute bottom-6 right-10 w-20 h-20 rounded-full bg-teal-400/20" />
          <div className="absolute bottom-0 left-0 w-full h-12 bg-white rounded-t-[2rem]" />
          <img src={pusintekLogoUrl} alt="PUSTEKINFO"
            className="relative z-10 h-28 w-auto object-contain rounded-2xl"
            style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.35))' }} />
          <p className="relative z-10 mt-4 text-white/75 text-sm text-center font-medium tracking-wide">
            Sistem Manajemen Terintegrasi
          </p>
          <p className="relative z-10 mt-1 text-white/50 text-xs text-center">
            Sekretariat Jenderal DPR RI
          </p>
        </div>

        {/* ── Desktop logo (hidden on mobile) ──────── */}
        <div className="hidden lg:flex z-20 items-center justify-center px-10 pt-8">
          <img src={pusintekLogoUrl} alt="PUSTEKINFO" className="h-32 w-auto object-contain" />
        </div>

        {/* Form — rounded top on mobile, normal on desktop */}
        <div className="flex flex-1 flex-col justify-center px-6 pb-10 pt-8 sm:px-10 lg:px-16 lg:py-12 bg-white relative z-10 -mt-6 rounded-t-3xl lg:mt-0 lg:rounded-none">
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
          <p className="text-[11px] text-gray-300">© 2026 PUSTEKINFO. All rights reserved.</p>
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
