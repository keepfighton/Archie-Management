import { useEffect, useState } from 'react'
import { teamService } from '@/services/api'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { fetchMe } from '@/store/slices/authSlice'
import { toast } from 'react-toastify'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { Loading, EmptyState, Avatar, rowNumber } from '@/components/common'

export default function TimeCardsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const user = useSelector((s: RootState) => s.auth.user)
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clockLoading, setClockLoading] = useState(false)

  const load = () => {
    setLoading(true)
    teamService.listTimeCards()
      .then(r => setCards(r.data.data || []))
      .catch(() => toast.error('Failed to load time cards'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleClockIn = async () => {
    if (user?.clocked_in) { toast.warning('You are already clocked in'); return }
    setClockLoading(true)
    try {
      await teamService.clockIn()
      await dispatch(fetchMe())
      toast.success('Clocked in successfully!')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to clock in')
    } finally { setClockLoading(false) }
  }

  const handleClockOut = async () => {
    if (!user?.clocked_in) { toast.warning('You are not clocked in'); return }
    setClockLoading(true)
    try {
      await teamService.clockOut()
      await dispatch(fetchMe())
      toast.success('Clocked out successfully!')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to clock out')
    } finally { setClockLoading(false) }
  }

  const fmtTime = (t?: string) => t ? new Date(t).toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' }) : '-'
  const fmtDate = (t?: string) => t ? new Date(t).toLocaleDateString('id') : '-'

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Time Cards</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary flex items-center gap-1.5" onClick={handleClockIn} disabled={clockLoading}>
            <LogIn size={13} /> Clock In
          </button>
          <button className="btn btn-secondary flex items-center gap-1.5" onClick={handleClockOut} disabled={clockLoading}>
            <LogOut size={13} /> Clock Out
          </button>
        </div>
      </div>

      {/* Current Status */}
      {user && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex items-center gap-3">
          <Clock size={18} className={user.clocked_in ? 'text-green-500' : 'text-gray-400'} />
          <div>
            <p className="text-sm font-medium text-gray-800">{user.name}</p>
            <p className={`text-xs ${user.clocked_in ? 'text-green-500' : 'text-gray-400'}`}>
              {user.clocked_in ? 'Currently clocked in' : 'Not clocked in'}
            </p>
          </div>
        </div>
      )}

      <div className="table-container">
        {loading ? <Loading /> : (
          <table className="table">
            <thead>
              <tr><th className="w-16">No.</th><th>Member</th><th>In Date</th><th>In Time</th><th>Out Time</th><th>Duration</th><th>Note</th></tr>
            </thead>
            <tbody>
              {cards.length === 0
                ? <tr><td colSpan={7}><EmptyState /></td></tr>
                : cards.map((c, index) => (
                  <tr key={c.id}>
                    <td className="text-gray-400">{rowNumber(1, index, cards.length || 1)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={c.user?.name || '?'} />
                        <span className="text-sm">{c.user?.name || '-'}</span>
                      </div>
                    </td>
                    <td className="text-gray-400">{fmtDate(c.in_date)}</td>
                    <td className="text-gray-600">{fmtTime(c.in_time)}</td>
                    <td className={c.out_time ? 'text-gray-600' : 'text-green-500'}>
                      {c.out_time ? fmtTime(c.out_time) : 'Active'}
                    </td>
                    <td className="text-gray-400">
                      {c.duration ? `${Number(c.duration).toFixed(1)}h` : '-'}
                    </td>
                    <td className="text-gray-400">{c.note || '-'}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
