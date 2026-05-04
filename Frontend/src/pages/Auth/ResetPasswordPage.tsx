import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '@/services/api'
import nexoneLogoUrl from '../../../logo/Logo_Nexone.png'

import { KeyRound, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Password tidak cocok'); return }
    if (password.length < 6) { setError('Password minimal 6 karakter'); return }
    if (!token) { setError('Token reset tidak ditemukan'); return }

    setLoading(true)
    try {
      await authService.resetPassword(token, password)
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Token tidak valid atau sudah kadaluarsa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      <div className="w-full lg:w-[40%] xl:w-[38%] flex flex-col justify-center">
        <div className="w-full px-10 xl:px-16 py-12">
          <div className="mb-10">
            <img src={nexoneLogoUrl} alt="NEXONE by NEXORA" className="h-[280px] w-auto object-contain" />
          </div>

          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e6f7f8' }}>
              {done ? <CheckCircle size={30} style={{ color: '#2aacb8' }} /> : <KeyRound size={30} style={{ color: '#2aacb8' }} />}
            </div>
          </div>

          {done ? (
            <>
              <h2 className="text-center text-[1.4rem] font-bold text-gray-900 mb-2">Password Berhasil Direset</h2>
              <p className="text-center text-sm text-gray-500 mb-6">Silakan login dengan password baru Anda.</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 rounded text-sm font-medium text-white"
                style={{ backgroundColor: '#2aacb8' }}
              >
                Login Sekarang
              </button>
            </>
          ) : (
            <>
              <h2 className="text-center text-[1.4rem] font-bold text-gray-900 mb-2">Buat Password Baru</h2>
              <p className="text-center text-sm text-gray-500 mb-6">Masukkan password baru untuk akun Anda.</p>

              {!token && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3 mb-4">
                  Link reset tidak valid. Minta link baru dari halaman Lupa Password.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Minimal 6 karakter"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 pr-10"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-gray-400">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="Ulangi password baru"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2"
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-2.5 rounded text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: '#2aacb8' }}
                >
                  {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </form>
            </>
          )}
        </div>

      </div>

      <div className="hidden lg:flex flex-1 relative overflow-hidden" style={{ background: '#0c1f40' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-center">
          <h2 className="text-[2rem] font-bold text-white leading-tight mb-2">Smarter operations,</h2>
          <h2 className="text-[2rem] font-bold leading-tight mb-4" style={{ color: '#3b82f6' }}>unified control</h2>
          <div className="w-12 h-[3px] rounded-full mx-auto mb-5" style={{ background: '#3b82f6' }} />
          <p className="text-[14px] max-w-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Run your entire business in one integrated platform—
            connecting people, processes, finance, and clients to drive efficiency, visibility, and growth.
          </p>
        </div>
      </div>
    </div>
  )
}
