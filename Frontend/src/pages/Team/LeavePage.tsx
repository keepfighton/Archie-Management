import { useEffect, useState } from 'react'
import { teamService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { toast } from 'react-toastify'
import { Plus } from 'lucide-react'
import {
  PageHeader, Loading, EmptyState, StatusBadge,
  Modal, FormField, ConfirmDialog
} from '@/components/common'

const LEAVE_TYPES = ['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other']

export default function LeavePage() {
  const [leaves, setLeaves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
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
      toast.success('Leave application submitted!')
      setShowModal(false)
      setForm({ leave_type: 'annual', start_date: '', end_date: '', duration: '', reason: '' })
      load()
    } catch { toast.error('Failed to submit leave') }
    finally { setSaving(false) }
  }

  const handleDateChange = (field: string, value: string) => {
    const newForm = { ...form, [field]: value }
    newForm.duration = calcDuration(
      field === 'start_date' ? value : form.start_date,
      field === 'end_date' ? value : form.end_date,
    )
    setForm(newForm)
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Leave"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={12} /> Apply leave</button>}
      />

      <div className="table-container">
        {loading ? <Loading /> : (
          <table className="table">
            <thead>
              <tr><th>Type</th><th>Start Date</th><th>End Date</th><th>Duration</th><th>Reason</th><th>Status</th></tr>
            </thead>
            <tbody>
              {leaves.length === 0
                ? <tr><td colSpan={6}><EmptyState /></td></tr>
                : leaves.map(l => (
                  <tr key={l.id}>
                    <td className="capitalize font-medium">{l.leave_type?.replace(/_/g, ' ')}</td>
                    <td className="text-gray-400">{new Date(l.start_date).toLocaleDateString('id')}</td>
                    <td className="text-gray-400">{new Date(l.end_date).toLocaleDateString('id')}</td>
                    <td className="text-gray-500">{l.duration} day{l.duration !== 1 ? 's' : ''}</td>
                    <td className="text-gray-600">{l.reason}</td>
                    <td><StatusBadge status={l.status} /></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Apply for Leave"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Submitting...' : 'Submit'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Leave Type">
              <select className="input" value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Start Date">
            <input className="input" type="date" value={form.start_date} onChange={e => handleDateChange('start_date', e.target.value)} />
          </FormField>
          <FormField label="End Date">
            <input className="input" type="date" value={form.end_date} onChange={e => handleDateChange('end_date', e.target.value)} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Duration (days)">
              <input className="input" type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="Auto calculated" />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Reason" required>
              <textarea className="input" rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Reason for leave..." />
            </FormField>
          </div>
        </div>
      </Modal>
    </div>
  )
}
