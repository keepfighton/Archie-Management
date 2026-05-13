import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { teamService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { toast } from 'react-toastify'
import { Plus, Megaphone } from 'lucide-react'
import { PageHeader, Loading, EmptyState, Modal, FormField } from '@/components/common'

export default function AnnouncementsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({ title: '', content: '', start_date: '', end_date: '' })

  const load = (overridePage?: number) => {
    setLoading(true)
    teamService.listAnnouncements()
      .then(r => setAnnouncements(r.data.data || []))
      .catch(() => toast.error('Failed to load announcements'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (searchParams.get('compose') !== 'new') return

    setShowModal(true)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('compose')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      await teamService.createAnnouncement({ ...form, start_date: toISODate(form.start_date), end_date: toISODate(form.end_date) })
      toast.success('Announcement posted!')
      setShowModal(false)
      setForm({ title: '', content: '', start_date: '', end_date: '' })
      load()
    } catch { toast.error('Failed to post announcement') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Announcements"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={12} /> New announcement</button>}
      />

      {loading ? <Loading /> : (
        announcements.length === 0
          ? <EmptyState message="No announcements yet." />
          : (
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Megaphone size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-gray-800 text-sm">{a.title}</h3>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          {new Date(a.created_at).toLocaleDateString('id')}
                        </span>
                      </div>
                      {a.content && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.content}</p>}
                      {(a.start_date || a.end_date) && (
                        <p className="text-xs text-gray-400 mt-2">
                          {a.start_date && `From: ${new Date(a.start_date).toLocaleDateString('id')}`}
                          {a.end_date && ` · Until: ${new Date(a.end_date).toLocaleDateString('id')}`}
                        </p>
                      )}
                      {a.created_by && (
                        <p className="text-xs text-gray-400 mt-1">Posted by {a.created_by.name}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Announcement"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Posting...' : 'Post'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Title" required>
            <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" />
          </FormField>
          <FormField label="Content">
            <textarea className="input" rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Write your announcement..." />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date">
              <input className="input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </FormField>
            <FormField label="End Date">
              <input className="input" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>
    </div>
  )
}
