import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { teamService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { toast } from 'react-toastify'
import { Plus, Check, X, Trash2 } from 'lucide-react'
import {
  PageHeader, Loading, EmptyState, StatusBadge,
  Modal, FormField, ConfirmDialog, rowNumber
} from '@/components/common'

const LEAVE_TYPES = ['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other']
const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected']

export default function LeavePage() {
  const user = useSelector((s: RootState) => s.auth.user)
  const isAdmin = user?.role === 'admin'

  const [leaves, setLeaves] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<any>({
    leave_type: 'annual', start_date: '', end_date: '', duration: '', reason: '',
  })

  const load = (overridePage?: number) => {
    setLoading(true)
    teamService.listLeaves()
      .then(r => setLeaves(r.data.data || []))
      .catch(() => toast.error('Failed to load leaves'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const calcDuration = (start: string, end: string) => {
    if (!start || !end) return ''
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
    return String(Math.max(1, diff + 1))
  }

  const handleDateChange = (field: string, value: string) => {
    const newForm = { ...form, [field]: value }
    newForm.duration = calcDuration(
      field === 'start_date' ? value : form.start_date,
      field === 'end_date' ? value : form.end_date,
    )
    setForm(newForm)
  }

  const handleSave = async () => {
    if (!form.start_date || !form.end_date) { toast.error('Start and end dates are required'); return }
    if (!form.reason.trim()) { toast.error('Reason is required'); return }
    setSaving(true)
    try {
      await teamService.applyLeave({
        ...form,
        duration: Number(form.duration || calcDuration(form.start_date, form.end_date)),
        start_date: toISODate(form.start_date),
        end_date: toISODate(form.end_date),
      })
      toast.success(isAdmin ? 'Leave approved!' : 'Leave application submitted! Menunggu persetujuan admin.')
      setShowModal(false)
      setForm({ leave_type: 'annual', start_date: '', end_date: '', duration: '', reason: '' })
      load()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed to submit leave') }
    finally { setSaving(false) }
  }

  const handleApprove = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await teamService.updateLeaveStatus(id, status)
      toast.success(status === 'approved' ? 'Leave disetujui' : 'Leave ditolak')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed to update status') }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await teamService.deleteLeave(deleteId)
      toast.success('Leave dibatalkan')
      setDeleteId(null)
      load()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed to cancel leave') }
  }

  const filtered = statusFilter === 'all' ? leaves : leaves.filter(l => l.status === statusFilter)

  const pendingCount = leaves.filter(l => l.status === 'pending').length

  return (
    <div className="p-5">
      <PageHeader
        title="Leave"
        actions={
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={12} /> Apply leave
          </button>
        }
      />

      {/* Status filter tabs */}
      <div className="mb-3 flex gap-1">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
              statusFilter === s
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'Semua' : s}
            {s === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="table-container">
        {loading ? <Loading /> : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-16">No.</th>
                {isAdmin && <th>Karyawan</th>}
                <th>Jenis Cuti</th>
                <th>Mulai</th>
                <th>Selesai</th>
                <th>Durasi</th>
                <th>Alasan</th>
                <th>Status</th>
                {isAdmin && <th>Disetujui Oleh</th>}
                <th className="w-28">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={isAdmin ? 10 : 9}><EmptyState /></td></tr>
                : filtered.map((l, index) => (
                  <tr key={l.id}>
                    <td className="text-gray-400">{rowNumber(1, index, filtered.length)}</td>
                    {isAdmin && (
                      <td className="font-medium text-gray-800">{l.user?.name ?? '-'}</td>
                    )}
                    <td className="capitalize font-medium">{l.leave_type?.replace(/_/g, ' ')}</td>
                    <td className="text-gray-400">{new Date(l.start_date).toLocaleDateString('id')}</td>
                    <td className="text-gray-400">{new Date(l.end_date).toLocaleDateString('id')}</td>
                    <td className="text-gray-500">{l.duration} hari</td>
                    <td className="text-gray-600 max-w-[200px] truncate">{l.reason}</td>
                    <td><StatusBadge status={l.status} /></td>
                    {isAdmin && (
                      <td className="text-gray-500 text-xs">{l.approved_by?.name ?? '-'}</td>
                    )}
                    <td>
                      <div className="flex items-center gap-1">
                        {/* Admin: approve/reject tombol untuk pending */}
                        {isAdmin && l.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(l.id, 'approved')}
                              className="rounded bg-emerald-100 p-1 text-emerald-700 hover:bg-emerald-200"
                              title="Setujui"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => handleApprove(l.id, 'rejected')}
                              className="rounded bg-red-100 p-1 text-red-600 hover:bg-red-200"
                              title="Tolak"
                            >
                              <X size={13} />
                            </button>
                          </>
                        )}
                        {/* Admin: hapus semua, Member: hanya pending milik sendiri */}
                        {(isAdmin || l.status === 'pending') && (
                          <button
                            onClick={() => setDeleteId(l.id)}
                            className="rounded bg-gray-100 p-1 text-gray-500 hover:bg-gray-200"
                            title={isAdmin ? 'Hapus' : 'Batalkan'}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      {/* Apply Leave Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Ajukan Cuti"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : isAdmin ? 'Simpan & Setujui' : 'Ajukan'}
            </button>
          </>
        }
      >
        {!isAdmin && (
          <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Pengajuan cuti akan menunggu persetujuan dari admin.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Jenis Cuti">
              <select className="input" value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}>
                {LEAVE_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Tanggal Mulai">
            <input className="input" type="date" value={form.start_date} onChange={e => handleDateChange('start_date', e.target.value)} />
          </FormField>
          <FormField label="Tanggal Selesai">
            <input className="input" type="date" value={form.end_date} onChange={e => handleDateChange('end_date', e.target.value)} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Durasi (hari)">
              <input className="input" type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="Otomatis dihitung" />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Alasan" required>
              <textarea className="input" rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Alasan pengajuan cuti..." />
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        message={isAdmin ? 'Hapus data cuti ini?' : 'Batalkan pengajuan cuti ini?'}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  )
}
