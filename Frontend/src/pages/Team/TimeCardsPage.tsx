import { useEffect, useState } from 'react'
import { teamService } from '@/services/api'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { fetchMe } from '@/store/slices/authSlice'
import { toast } from 'react-toastify'
import { Clock, LogIn, LogOut, MapPin, Filter } from 'lucide-react'
import { Loading, EmptyState, Avatar, Pagination, ClockInModal, WorkMode, WORK_MODE_CONFIG, getLocationWithFallback } from '@/components/common'

const LIST_LIMIT = 30

function ModeBadge({ mode }: { mode: string }) {
  const cfg = WORK_MODE_CONFIG[mode as WorkMode]
  if (!cfg) return <span className="text-gray-400 text-xs">-</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

export default function TimeCardsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const user = useSelector((s: RootState) => s.auth.user)
  const [cards, setCards] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [clockLoading, setClockLoading] = useState(false)

  const [showModeModal, setShowModeModal] = useState(false)

  const [filterMode, setFilterMode] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const load = (params?: Record<string, string>) => {
    setLoading(true)
    teamService.listTimeCards(params)
      .then(r => setCards(r.data.data || []))
      .catch(() => toast.error('Gagal memuat data absen'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const applyFilter = () => {
    const params: Record<string, string> = {}
    if (filterMode) params.work_mode = filterMode
    if (filterFrom) params.date_from = filterFrom
    if (filterTo)   params.date_to   = filterTo
    setPage(1)
    load(params)
  }

  const resetFilter = () => {
    setFilterMode('')
    setFilterFrom('')
    setFilterTo('')
    setPage(1)
    load()
  }

  const handleClockInClick = () => {
    if (user?.clocked_in) { toast.warning('Anda sudah clock in'); return }
    setShowModeModal(true)
  }

  const handleConfirmMode = async (mode: WorkMode) => {
    setShowModeModal(false)
    setClockLoading(true)
    try {
      let lat = 0, lng = 0, accuracy = 0

      if (mode === 'WFO') {
        try {
          const pos = await getLocationWithFallback()
          lat      = pos.coords.latitude
          lng      = pos.coords.longitude
          accuracy = pos.coords.accuracy
        } catch {
          toast.error('Izin lokasi diperlukan untuk mode WFO. Aktifkan lokasi di browser lalu coba lagi.')
          setClockLoading(false)
          return
        }
      } else {
        try {
          const pos = await getLocationWithFallback()
          lat      = pos.coords.latitude
          lng      = pos.coords.longitude
          accuracy = pos.coords.accuracy
        } catch {
          toast.warning('Lokasi tidak dapat dideteksi — jarak tidak akan tercatat.')
        }
      }

      await teamService.clockIn({ work_mode: mode, latitude: lat, longitude: lng, location_accuracy: accuracy })
      await dispatch(fetchMe())
      toast.success(`Clock in berhasil! Mode: ${mode}`)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal clock in')
    } finally {
      setClockLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!user?.clocked_in) { toast.warning('Anda belum clock in'); return }
    setClockLoading(true)
    try {
      await teamService.clockOut()
      await dispatch(fetchMe())
      toast.success('Clock out berhasil!')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal clock out')
    } finally { setClockLoading(false) }
  }

  const fmtTime = (t?: string) => t ? new Date(t).toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' }) : '-'
  const fmtDate = (t?: string) => t ? new Date(t).toLocaleDateString('id') : '-'
  const fmtDist = (m?: number) => m && m > 0 ? (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`) : '-'
  const pagedCards = cards.slice((page - 1) * LIST_LIMIT, page * LIST_LIMIT)

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Time Cards</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary flex items-center gap-1.5" onClick={handleClockInClick} disabled={clockLoading}>
            <LogIn size={13} /> Clock In
          </button>
          <button className="btn btn-secondary flex items-center gap-1.5" onClick={handleClockOut} disabled={clockLoading}>
            <LogOut size={13} /> Clock Out
          </button>
        </div>
      </div>

      {user && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex items-center gap-3">
          <Clock size={18} className={user.clocked_in ? 'text-green-500' : 'text-gray-400'} />
          <div>
            <p className="text-sm font-medium text-gray-800">{user.name}</p>
            <p className={`text-xs ${user.clocked_in ? 'text-green-500' : 'text-gray-400'}`}>
              {user.clocked_in ? 'Sedang clock in' : 'Belum clock in'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap items-end gap-3">
        <Filter size={14} className="text-gray-400 mt-1" />
        <div>
          <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Mode</label>
          <select className="input text-xs py-1.5" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="">Semua</option>
            <option value="WFO">WFO</option>
            <option value="WFA">WFA</option>
            <option value="WFH">WFH</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Dari</label>
          <input type="date" className="input text-xs py-1.5" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Sampai</label>
          <input type="date" className="input text-xs py-1.5" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        </div>
        <button className="btn btn-primary text-xs py-1.5" onClick={applyFilter}>Terapkan</button>
        <button className="btn btn-secondary text-xs py-1.5" onClick={resetFilter}>Reset</button>
      </div>

      <div className="table-container">
        {loading ? <Loading /> : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Member</th>
                  <th>Mode</th>
                  <th>Tanggal</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Durasi</th>
                  <th>Jarak</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {pagedCards.length === 0
                  ? <tr><td colSpan={9}><EmptyState /></td></tr>
                  : pagedCards.map((c, index) => (
                    <tr key={c.id}>
                      <td className="text-gray-400">{(page - 1) * LIST_LIMIT + index + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={c.user?.name || '?'} />
                          <span className="text-sm">{c.user?.name || '-'}</span>
                        </div>
                      </td>
                      <td><ModeBadge mode={c.work_mode} /></td>
                      <td className="text-gray-400">{fmtDate(c.in_date)}</td>
                      <td className="text-gray-600">{fmtTime(c.in_time)}</td>
                      <td className={c.out_time ? 'text-gray-600' : 'text-green-500'}>
                        {c.out_time ? fmtTime(c.out_time) : 'Aktif'}
                      </td>
                      <td className="text-gray-400">
                        {c.duration ? `${Number(c.duration).toFixed(1)}h` : '-'}
                      </td>
                      <td className="text-gray-400">
                        {c.distance_m > 0
                          ? <span className="flex items-center gap-1"><MapPin size={10} className="text-blue-400" />{fmtDist(c.distance_m)}</span>
                          : <span className="text-gray-300">-</span>
                        }
                      </td>
                      <td className="text-gray-400">{c.note || '-'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
            <Pagination page={page} total={cards.length} limit={LIST_LIMIT} onChange={setPage} />
          </>
        )}
      </div>

      <ClockInModal
        open={showModeModal}
        onClose={() => setShowModeModal(false)}
        onConfirm={handleConfirmMode}
      />
    </div>
  )
}
