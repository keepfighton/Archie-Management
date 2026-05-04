import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/api'
import nexoneLogoUrl from '../../../logo/Logo_Nexone.png'
import { ArrowLeft, ShieldAlert, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authService.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
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
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-blue-50">
              {sent ? <CheckCircle size={30} className="text-blue-600" /> : <ShieldAlert size={30} className="text-blue-600" />}
            </div>
          </div>

          {sent ? (
            <>
              <h2 className="text-center text-[1.6rem] font-bold text-gray-900 mb-2">Email Terkirim</h2>
              <p className="text-center text-[15px] text-gray-500 mb-6 leading-relaxed">
                Jika email <span className="font-medium text-gray-700">{email}</span> terdaftar,
                link reset password sudah dikirim. Periksa inbox atau folder spam Anda.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-center text-[1.6rem] font-bold text-gray-900 mb-2">Lupa Password?</h2>
              <p className="text-center text-[15px] text-gray-500 mb-6 leading-relaxed">
                Masukkan email Anda dan kami akan kirim link untuk reset password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[14px] font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="nama@email.com"
                    className="w-full px-3.5 py-3 text-[14px] rounded-xl border border-gray-200 bg-white
                               placeholder-gray-300 text-gray-900
                               focus:outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]
                               transition-colors"
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white
                             bg-[#0d1f3c] hover:bg-[#172d50] active:bg-[#0a1628]
                             flex items-center justify-center gap-2 transition-colors disabled:opacity-70 mt-1"
                >
                  {loading ? 'Mengirim...' : 'Kirim Link Reset'}
                </button>
              </form>
            </>
          )}

          <button
            onClick={() => navigate('/login')}
            className="w-full mt-4 py-3 rounded-xl text-[14px] font-medium text-gray-600 border border-gray-200 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={15} />
            Kembali ke Login
          </button>
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
