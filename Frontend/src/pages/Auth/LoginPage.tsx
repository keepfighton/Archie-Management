import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { login } from '@/store/slices/authSlice'
import { RootState, AppDispatch } from '@/store'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

import frameKananUrl from '../../../logo/FrameKanan.png'
import nexoraPartUrl from '../../../logo/Logo_Nexora_Part.png'

const mobileStyles = `
  @keyframes floatA {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-14px) rotate(4deg); }
  }
  @keyframes floatB {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-10px) rotate(-3deg); }
  }
  @keyframes floatC {
    0%, 100% { transform: translateY(0px) scale(1); }
    50%       { transform: translateY(-8px) scale(1.04); }
  }
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
  @keyframes shimmer {
    0%, 100% { opacity: 0.45; }
    50%       { opacity: 1; }
  }
  @keyframes dotPing {
    0%   { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  @keyframes lineDash {
    0%   { stroke-dashoffset: 120; }
    100% { stroke-dashoffset: 0; }
  }
  @keyframes rotateSlowCW  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
  @keyframes rotateSlowCCW { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .anim-floatA { animation: floatA 4.5s ease-in-out infinite; }
  .anim-floatB { animation: floatB 5.5s ease-in-out infinite 0.8s; }
  .anim-floatC { animation: floatC 3.8s ease-in-out infinite 1.4s; }
  .anim-orbPulse { animation: orbPulse 6s ease-in-out infinite; }
  .anim-orbDrift { animation: orbDrift 9s ease-in-out infinite; }
  .anim-shimmer1 { animation: shimmer 2.8s ease-in-out infinite; }
  .anim-shimmer2 { animation: shimmer 3.4s ease-in-out infinite 1s; }
  .anim-shimmer3 { animation: shimmer 2.2s ease-in-out infinite 0.5s; }
  .anim-rotateCW  { animation: rotateSlowCW  18s linear infinite; }
  .anim-rotateCCW { animation: rotateSlowCCW 24s linear infinite; }
  .anim-fadeInUp  { animation: fadeInUp 0.6s ease-out both; }
`

const stats = [
  { label: 'Projects', value: '128', icon: (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/><rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6"/><rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6"/><rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.4"/></svg>
  ), color: '#60a5fa', delay: '0s' },
  { label: 'Tasks Done', value: '246', icon: (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" opacity="0.4"/><path d="M6.5 10.5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ), color: '#34d399', delay: '0.2s' },
  { label: 'Team', value: '24', icon: (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><circle cx="7" cy="7" r="3" fill="currentColor" opacity="0.9"/><circle cx="14" cy="6" r="2.5" fill="currentColor" opacity="0.6"/><path d="M1 16c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8"/><path d="M14 12c2 0 4 1.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/></svg>
  ), color: '#a78bfa', delay: '0.4s' },
]

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
           style={{ background: 'linear-gradient(160deg, #060e20 0%, #0c1e40 35%, #0d2d60 65%, #07183a 100%)' }}>

        {/* Animated orb blobs */}
        <div className="anim-orbDrift absolute -top-16 -right-16 w-64 h-64 rounded-full"
             style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)', filter: 'blur(32px)' }} />
        <div className="anim-orbPulse absolute top-40 -left-20 w-56 h-56 rounded-full"
             style={{ background: 'radial-gradient(circle, #4f46e5 0%, transparent 70%)', filter: 'blur(28px)', animationDelay: '2s' }} />
        <div className="anim-orbPulse absolute bottom-48 -right-12 w-48 h-48 rounded-full"
             style={{ background: 'radial-gradient(circle, #0891b2 0%, transparent 70%)', filter: 'blur(24px)', animationDelay: '4s' }} />

        {/* Fine dot grid */}
        <div className="absolute inset-0 opacity-[0.035]"
             style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* Rotating ring ornaments */}
        <div className="anim-rotateCW absolute top-16 right-8 w-28 h-28 opacity-[0.07]">
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
            <circle cx="50" cy="50" r="45" stroke="white" strokeWidth="1" strokeDasharray="8 6"/>
            <circle cx="50" cy="50" r="30" stroke="white" strokeWidth="0.8" strokeDasharray="4 8"/>
          </svg>
        </div>
        <div className="anim-rotateCCW absolute bottom-64 left-4 w-20 h-20 opacity-[0.06]">
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
            <circle cx="50" cy="50" r="45" stroke="white" strokeWidth="1.2" strokeDasharray="6 5"/>
          </svg>
        </div>

        {/* ── Hero top ── */}
        <div className="relative z-10 flex flex-col items-center pt-11 pb-3 px-6 anim-fadeInUp">
          <div className="relative">
            <div className="absolute inset-0 rounded-full opacity-30"
                 style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', filter: 'blur(16px)', transform: 'scale(1.5)' }} />
            <img src={nexoraPartUrl} alt="Nexora" className="relative h-12 w-auto object-contain drop-shadow-2xl" />
          </div>
          <p className="mt-3 text-xs font-medium tracking-[0.2em] uppercase text-blue-300/60">Business Platform</p>
        </div>

        {/* ── Animated showcase area ── */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-2 min-h-0">

          {/* Network SVG — animated connecting lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 280" preserveAspectRatio="xMidYMid meet" fill="none">
            {/* Connecting lines with animated dash */}
            <line x1="60" y1="80"  x2="160" y2="140" stroke="rgba(99,102,241,0.25)" strokeWidth="1" strokeDasharray="120" strokeDashoffset="120"
                  style={{ animation: 'lineDash 2s ease-out 0.5s forwards' }} />
            <line x1="260" y1="80"  x2="160" y2="140" stroke="rgba(99,102,241,0.25)" strokeWidth="1" strokeDasharray="120" strokeDashoffset="120"
                  style={{ animation: 'lineDash 2s ease-out 0.8s forwards' }} />
            <line x1="60" y1="80"  x2="260" y2="80"  stroke="rgba(99,102,241,0.15)" strokeWidth="0.8" strokeDasharray="200" strokeDashoffset="200"
                  style={{ animation: 'lineDash 2.5s ease-out 1s forwards' }} />
            <line x1="160" y1="140" x2="160" y2="220" stroke="rgba(99,102,241,0.2)" strokeWidth="1" strokeDasharray="80" strokeDashoffset="80"
                  style={{ animation: 'lineDash 1.5s ease-out 1.2s forwards' }} />
            {/* Pulsing node dots */}
            {[{cx:60,cy:80,c:'#60a5fa'},{cx:260,cy:80,c:'#34d399'},{cx:160,cy:140,c:'#a78bfa'},{cx:160,cy:220,c:'#f472b6'}].map((n,i) => (
              <g key={i}>
                <circle cx={n.cx} cy={n.cy} r="14" fill={n.c} opacity="0.06"/>
                <circle cx={n.cx} cy={n.cy} r="14" fill={n.c} opacity="0"
                        style={{ animation: `dotPing 2s ease-out ${i*0.5}s infinite` }}/>
                <circle cx={n.cx} cy={n.cy} r="4"  fill={n.c} opacity="0.9"/>
                <circle cx={n.cx} cy={n.cy} r="2"  fill="white" opacity="0.8"/>
              </g>
            ))}
          </svg>

          {/* Floating stat cards */}
          <div className="relative w-full flex flex-col items-center gap-3">
            {/* Top row — 2 cards */}
            <div className="flex gap-3 w-full">
              {stats.slice(0,2).map((s, i) => (
                <div key={i} className={`flex-1 rounded-2xl p-3.5 ${i===0?'anim-floatA':'anim-floatB'}`}
                     style={{
                       background: 'rgba(255,255,255,0.05)',
                       border: '1px solid rgba(255,255,255,0.1)',
                       backdropFilter: 'blur(12px)',
                       boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)`,
                       animationDelay: s.delay
                     }}>
                  <div className={`anim-shimmer${i+1} mb-2`} style={{ color: s.color }}>
                    {s.icon}
                  </div>
                  <div className="text-2xl font-bold text-white leading-none">{s.value}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 font-medium">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Bottom — 1 card centered + decorative hex */}
            <div className="flex gap-3 w-full items-center">
              <div className="flex-1 rounded-2xl p-3.5 anim-floatC"
                   style={{
                     background: 'rgba(255,255,255,0.05)',
                     border: '1px solid rgba(255,255,255,0.1)',
                     backdropFilter: 'blur(12px)',
                     boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
                     animationDelay: stats[2].delay
                   }}>
                <div className="anim-shimmer3 mb-2" style={{ color: stats[2].color }}>
                  {stats[2].icon}
                </div>
                <div className="text-2xl font-bold text-white leading-none">{stats[2].value}</div>
                <div className="text-[10px] text-white/40 mt-0.5 font-medium">{stats[2].label}</div>
              </div>

              {/* Decorative hexagonal badge */}
              <div className="anim-floatB flex flex-col items-center justify-center w-24 h-24" style={{ animationDelay: '0.6s' }}>
                <svg viewBox="0 0 80 80" fill="none" className="absolute w-24 h-24 opacity-20">
                  <polygon points="40,4 74,22 74,58 40,76 6,58 6,22" stroke="white" strokeWidth="1.5"/>
                  <polygon points="40,14 66,28 66,52 40,66 14,52 14,28" stroke="white" strokeWidth="1" opacity="0.5"/>
                </svg>
                <div className="relative text-center">
                  <div className="text-xs font-bold text-white/80 leading-tight">NEXONE</div>
                  <div className="text-[9px] text-white/40">by NEXORA</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom tagline */}
          <div className="mt-4 text-center">
            <p className="text-[11px] text-white/30 tracking-wider">Smarter operations · Unified control</p>
          </div>
        </div>

        {/* ── Form card ── */}
        <div className="relative z-10 mx-4 mb-5 rounded-3xl overflow-hidden shadow-2xl"
             style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.4), 0 20px 60px rgba(0,0,0,0.5)' }}>
          {/* Glass header strip */}
          <div className="px-5 pt-5 pb-4"
               style={{ background: 'linear-gradient(135deg, rgba(13,31,60,0.95) 0%, rgba(26,58,107,0.95) 100%)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="text-lg font-bold text-white">Welcome back</h2>
            <p className="text-[11px] text-blue-200/50 mt-0.5">Sign in to access your workspace</p>
          </div>

          {/* Form body */}
          <div className="px-5 py-4" style={{ background: 'rgba(255,255,255,0.97)' }}>
            {error && (
              <div className="mb-3 px-3 py-2.5 rounded-xl text-xs text-red-600 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-widest">Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Mail size={13} className="text-gray-400" />
                  </span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email" required autoComplete="off"
                    className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl border border-gray-200 bg-gray-50
                               placeholder-gray-300 text-gray-900
                               focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-widest">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Lock size={13} className="text-gray-400" />
                  </span>
                  <input type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password" required autoComplete="off"
                    className="w-full pl-9 pr-10 py-2.5 text-[13px] rounded-xl border border-gray-200 bg-gray-50
                               placeholder-gray-300 text-gray-900
                               focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white transition-all" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                          className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                         className="w-3.5 h-3.5 rounded border-gray-300 accent-[#1e3a5f] cursor-pointer" />
                  <span className="text-[12px] text-gray-600">Remember me</span>
                </label>
                <button type="button" onClick={() => navigate('/forgot-password')}
                        className="text-[12px] font-semibold text-[#1a5cb0] hover:text-[#1e3a5f] transition-colors">
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading}
                      className="w-full py-3 rounded-xl text-[14px] font-semibold text-white
                                 flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                      style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #1a4a8a 100%)',
                               boxShadow: '0 4px 18px rgba(13,31,60,0.4)' }}>
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Sign in'}
              </button>
            </form>

            <p className="mt-4 text-center text-[10px] text-gray-300">© 2026 NEXORA. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP LAYOUT (unchanged)
      ══════════════════════════════════════════════ */}
      <div className="hidden lg:flex min-h-screen w-full flex-row">
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
                <div className="mb-5 px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-200">{error}</div>
              )}
              <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Email address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none"><Mail size={15} className="text-gray-400" /></span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required autoComplete="off"
                      className="w-full pl-10 pr-4 py-3 text-[14px] rounded-lg border border-gray-200 bg-gray-50 placeholder-gray-300 text-gray-900 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none"><Lock size={15} className="text-gray-400" /></span>
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="off"
                      className="w-full pl-10 pr-11 py-3 text-[14px] rounded-lg border border-gray-200 bg-gray-50 placeholder-gray-300 text-gray-900 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 focus:bg-white transition-all" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 rounded border-gray-300 accent-[#1e3a5f] cursor-pointer" />
                    <span className="text-[13px] text-gray-600">Remember me</span>
                  </label>
                  <button type="button" onClick={() => navigate('/forgot-password')} className="text-[13px] font-semibold text-[#1a5cb0] hover:text-[#1e3a5f] transition-colors">Forgot password?</button>
                </div>
                <button type="submit" disabled={loading}
                        className="w-full py-3.5 rounded-lg text-[15px] font-semibold text-white bg-[#0d1f3c] hover:bg-[#172d50] active:bg-[#0a1628] flex items-center justify-center gap-2 transition-colors disabled:opacity-70 shadow-md shadow-[#0d1f3c]/25">
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Sign in'}
                </button>
              </form>
            </div>
          </div>
          <div className="px-16 pb-8"><p className="text-[11px] text-gray-300">© 2026 NEXORA. All rights reserved.</p></div>
        </div>
        <div className="flex flex-1 relative overflow-hidden items-center justify-center">
          <img src={frameKananUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-left-top scale-110" style={{ filter: 'blur(18px)', opacity: 0.85 }} />
          <div className="absolute inset-0" style={{ background: 'rgba(8,18,40,0.45)' }} />
          <div className="relative z-10 w-[99%] h-[99%] rounded-2xl overflow-hidden" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <img src={frameKananUrl} alt="" className="w-full h-full object-cover object-left-top" />
          </div>
        </div>
      </div>
    </div>
  )
}
