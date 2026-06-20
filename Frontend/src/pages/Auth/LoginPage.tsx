import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { login } from '@/store/slices/authSlice'
import { RootState, AppDispatch } from '@/store'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

import backgroundUrl from '../../../assets/Background.png'
import archieLogoUrl from '../../../assets/archie-logo-transparent-clean.png'

const mobileStyles = `
  @keyframes orbPulse {
    0%, 100% { transform: scale(1); opacity: 0.18; }
    50%       { transform: scale(1.15); opacity: 0.28; }
  }
  @keyframes orbDrift {
    0%   { transform: translate(0px, 0px) scale(1); opacity: 0.15; }
    33%  { transform: translate(18px,-12px) scale(1.12); opacity: 0.25; }
    66%  { transform: translate(-10px, 8px) scale(0.93); opacity: 0.18; }
    100% { transform: translate(0px, 0px) scale(1); opacity: 0.15; }
  }
  @keyframes rotateSlowCW  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes rotateSlowCCW { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
  @keyframes lineDash {
    0%   { stroke-dashoffset: 120; }
    100% { stroke-dashoffset: 0; }
  }
  @keyframes dotPing {
    0%   { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes logoPulse {
    0%, 100% { filter: drop-shadow(0 0 12px rgba(59,130,246,0.35)); }
    50%       { filter: drop-shadow(0 0 22px rgba(99,102,241,0.55)); }
  }
  .anim-orbPulse  { animation: orbPulse 6s ease-in-out infinite; }
  .anim-orbDrift  { animation: orbDrift 9s ease-in-out infinite; }
  .anim-rotateCW  { animation: rotateSlowCW  18s linear infinite; }
  .anim-rotateCCW { animation: rotateSlowCCW 24s linear infinite; }
  .anim-fadeInUp  { animation: fadeInUp 0.6s ease-out both; }
  .anim-logoPulse { animation: logoPulse 4s ease-in-out infinite; }

  /* ── Desktop animations ── */
  @keyframes fadeInLeft {
    from { opacity: 0; transform: translateX(-28px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeInRight {
    from { opacity: 0; transform: translateX(28px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes bgDrift {
    0%, 100% { transform: scale(1.12) translate(0px, 0px); }
    33%       { transform: scale(1.14) translate(-5px, -4px); }
    66%       { transform: scale(1.11) translate(4px, 3px); }
  }
  @keyframes logoDesktopGlow {
    0%, 100% { filter: drop-shadow(0 0 14px rgba(59,130,246,0.3)); }
    50%       { filter: drop-shadow(0 0 26px rgba(99,102,241,0.5)); }
  }
  @keyframes cardEntrance {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .anim-fadeInLeft  { animation: fadeInLeft  0.75s cubic-bezier(0.22,1,0.36,1) both; }
  .anim-fadeInRight { animation: fadeInRight 0.85s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
  .anim-slideUp-1   { animation: slideUpFade 0.55s ease-out 0.25s both; }
  .anim-slideUp-2   { animation: slideUpFade 0.55s ease-out 0.38s both; }
  .anim-slideUp-3   { animation: slideUpFade 0.55s ease-out 0.51s both; }
  .anim-slideUp-4   { animation: slideUpFade 0.55s ease-out 0.64s both; }
  .anim-slideUp-5   { animation: slideUpFade 0.55s ease-out 0.77s both; }
  .anim-bgDrift     { animation: bgDrift 22s ease-in-out infinite; }
  .anim-logoDesktop { animation: logoDesktopGlow 4.5s ease-in-out infinite; }
  .anim-cardEntrance { animation: cardEntrance 0.9s cubic-bezier(0.22,1,0.36,1) 0.15s both; }

  /* Desktop input subtle lift on focus */
  .input-desktop { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease; }
  .input-desktop:focus { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(30,58,95,0.09); }

  /* Desktop sign-in button hover lift */
  .btn-signin-desk { transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease; }
  .btn-signin-desk:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(13,31,60,0.38); }
  .btn-signin-desk:active:not(:disabled) { transform: translateY(0); }
`

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
      <style>{mobileStyles}</style>

      {/* ══════════════════════════════════════════════
          MOBILE LAYOUT
      ══════════════════════════════════════════════ */}
      <div className="flex flex-col min-h-screen lg:hidden relative overflow-hidden"
           style={{ background: '#07132d' }}>
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-left-top"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(22,78,180,0.24),transparent_40%),linear-gradient(180deg,rgba(6,14,32,0.72)_0%,rgba(6,14,32,0.62)_35%,rgba(6,14,32,0.84)_100%)]" />
        <div className="absolute inset-0 opacity-[0.055]"
             style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 flex min-h-screen flex-col px-4 pb-6 pt-6">
          <div className="flex flex-1 flex-col items-center justify-start pt-4">
            <div className="relative mb-6 flex flex-col items-center">
              <div className="absolute -inset-6 rounded-full bg-blue-400/20 blur-3xl" />
              <img
                src={archieLogoUrl}
                alt="Archie Management"
                className="relative h-18 w-auto object-contain drop-shadow-[0_0_18px_rgba(59,130,246,0.35)]"
              />
              <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.35em] text-blue-100/55">
                Business Platform
              </p>
            </div>

            <div className="w-full max-w-md rounded-[28px] overflow-hidden border border-white/10 bg-white/96 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="px-6 pt-5 pb-4 border-b border-slate-200/70 bg-[#0d1f3c]">
                <h2 className="text-[1.1rem] font-bold text-white">Welcome back</h2>
                <p className="text-[11px] text-blue-200/55 mt-0.5">Sign in to access your workspace</p>
              </div>

              <div className="px-5 py-5">
                {error && (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3.5">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Email
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <Mail size={13} className="text-slate-400" />
                      </span>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        autoComplete="off"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-[13px] text-slate-900 placeholder-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Password
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <Lock size={13} className="text-slate-400" />
                      </span>
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        autoComplete="off"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-10 text-[13px] text-slate-900 placeholder-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition-colors hover:text-slate-600"
                      >
                        {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={e => setRemember(e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-[#1e3a5f]"
                      />
                      <span className="text-[12px] text-slate-600">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-[12px] font-semibold text-[#1a5cb0] transition-colors hover:text-[#1e3a5f]"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-semibold text-white transition-all disabled:opacity-70"
                    style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #1a4a8a 100%)', boxShadow: '0 8px 22px rgba(13,31,60,0.35)' }}
                  >
                    {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'Sign in'}
                  </button>
                </form>
                <p className="mt-4 text-center text-[10px] text-slate-400">© 2026 Archie Management. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP LAYOUT (unchanged)
      ══════════════════════════════════════════════ */}
      <div className="hidden lg:flex min-h-screen w-full flex-row">
        <div className="anim-fadeInLeft relative z-10 flex min-h-screen w-[30%] flex-col bg-white shadow-[18px_0_48px_rgba(15,23,42,0.12)]">
          <div className="z-20 flex items-center justify-center lg:absolute lg:left-1/2 lg:top-0 lg:-translate-x-1/2">
            <img src={archieLogoUrl} alt="Archie Management" className="anim-logoDesktop h-[288px] w-auto object-contain"/>
          </div>
          <div className="flex flex-1 flex-col justify-center px-16 py-12">
            <div className="w-full max-w-[420px]">
              <div className="anim-slideUp-1 mb-7">
                <h2 className="text-[1.9rem] font-bold text-gray-900 leading-tight mb-1.5">Welcome back</h2>
                <p className="text-[14px] text-gray-400">Sign in to access your workspace</p>
              </div>
              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-200">{error}</div>
              )}
              <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                <div className="anim-slideUp-2">
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Email address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none"><Mail size={15} className="text-gray-400"/></span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required autoComplete="off"
                      className="input-desktop w-full pl-10 pr-4 py-3 text-[14px] rounded-lg border border-gray-200 bg-gray-50 placeholder-gray-300 text-gray-900 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white"/>
                  </div>
                </div>
                <div className="anim-slideUp-3">
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none"><Lock size={15} className="text-gray-400"/></span>
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="off"
                      className="input-desktop w-full pl-10 pr-11 py-3 text-[14px] rounded-lg border border-gray-200 bg-gray-50 placeholder-gray-300 text-gray-900 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white"/>
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                      {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>
                <div className="anim-slideUp-4 flex items-center justify-between py-1">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 rounded border-gray-300 accent-[#1e3a5f] cursor-pointer"/>
                    <span className="text-[13px] text-gray-600">Remember me</span>
                  </label>
                  <button type="button" onClick={() => navigate('/forgot-password')} className="text-[13px] font-semibold text-[#1a5cb0] hover:text-[#1e3a5f] transition-colors">Forgot password?</button>
                </div>
                <div className="anim-slideUp-5">
                  <button type="submit" disabled={loading}
                          className="btn-signin-desk w-full py-3.5 rounded-lg text-[15px] font-semibold text-white bg-[#0d1f3c] hover:bg-[#172d50] active:bg-[#0a1628] flex items-center justify-center gap-2 disabled:opacity-70 shadow-md shadow-[#0d1f3c]/25">
                    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : 'Sign in'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="px-16 pb-8"><p className="text-[11px] text-gray-300">© 2026 Archie Management. All rights reserved.</p></div>
        </div>
        <div className="anim-fadeInRight flex flex-1 relative overflow-hidden items-center justify-center">
          <img src={backgroundUrl} alt="" className="anim-bgDrift absolute inset-0 w-full h-full object-cover object-left-top"
               style={{ filter: 'blur(18px)', opacity: 0.85 }}/>
          <div className="absolute inset-0" style={{ background: 'rgba(8,18,40,0.45)' }}/>
          <div className="anim-cardEntrance relative z-10 w-[99%] h-[99%] rounded-2xl overflow-hidden" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <img src={backgroundUrl} alt="" className="w-full h-full object-cover object-left-top"/>
          </div>
        </div>
      </div>
    </div>
  )
}
