import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { eventService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { ManageLabelsModal } from '@/components/common/ManageLabelsModal'
import { toast } from 'react-toastify'
import { Plus, Filter } from 'lucide-react'
import { PageHeader, Modal, FormField, ConfirmDialog, Loading } from '@/components/common'

const localizer = momentLocalizer(moment)

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState<any[]>([])
  const [calEvents, setCalEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768
  const [view, setView] = useState<string>(() => (
    typeof window !== 'undefined' && window.innerWidth < 768
      ? Views.AGENDA
      : Views.MONTH
  ))
  const [date, setDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [showManageLabels, setShowManageLabels] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    title: '', description: '', start_date: '', end_date: '', all_day: false, color: '#3b82f6', type: '',
  })

  const load = () => {
    setLoading(true)
    eventService.list({ month: date.getMonth() + 1, year: date.getFullYear() })
      .then(r => {
        const raw = r.data.data || []
        setEvents(raw)
        setCalEvents(raw.map((e: any) => ({
          id: e.id,
          title: e.title,
          start: new Date(e.start_date),
          end: new Date(e.end_date),
          allDay: e.all_day,
          resource: e,
        })))
      })
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [date.getMonth(), date.getFullYear()])

  const openAdd = (slotInfo?: { start: Date; end: Date }) => {
    setForm({
      title: '',
      description: '',
      start_date: slotInfo ? moment(slotInfo.start).format('YYYY-MM-DDTHH:mm') : '',
      end_date: slotInfo ? moment(slotInfo.end).format('YYYY-MM-DDTHH:mm') : '',
      all_day: false,
      color: '#3b82f6',
      type: '',
    })
    setShowModal(true)
  }

  useEffect(() => {
    if (searchParams.get('compose') !== 'new') return

    setForm({
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      all_day: false,
      color: '#3b82f6',
      type: '',
    })
    setShowModal(true)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('compose')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      await eventService.create({ ...form, start_date: toISODate(form.start_date), end_date: toISODate(form.end_date) })
      toast.success('Event created!')
      setShowModal(false)
      load()
    } catch { toast.error('Failed to create event') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await eventService.delete(deleteId)
      toast.success('Event deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  const onSelectEvent = (event: any) => setDeleteId(event.id)

  const eventStyleGetter = (event: any) => ({
    style: {
      backgroundColor: event.resource?.color || '#3b82f6',
      border: 'none',
      borderRadius: '4px',
      color: 'white',
      fontSize: '11px',
    },
  })

  return (
    <div className="p-5">
      <PageHeader
        title="Events"
        actions={<>
          <button className="btn btn-secondary" onClick={() => setShowManageLabels(true)}><Filter size={12} /> Manage labels</button>
          <button className="btn btn-primary" onClick={() => openAdd()}><Plus size={12} /> Add event</button>
        </>}
      />

      {loading
        ? <Loading />
        : (
          <div className="overflow-hidden rounded-[22px] border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
            <Calendar
              localizer={localizer}
              events={calEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: isMobileViewport ? 560 : 650 }}
              view={view as any}
              onView={setView}
              date={date}
              onNavigate={setDate}
              onSelectSlot={openAdd}
              onSelectEvent={onSelectEvent}
              selectable
              eventPropGetter={eventStyleGetter}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            />
          </div>
        )
      }

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Event"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Title" required>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Event title" />
            </FormField>
          </div>
          <FormField label="Start Date & Time">
            <input className="input" type="datetime-local" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </FormField>
          <FormField label="End Date & Time">
            <input className="input" type="datetime-local" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </FormField>
          <FormField label="Type">
            <input className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="meeting, deadline..." />
          </FormField>
          <FormField label="Color">
            <input className="input" type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
          </FormField>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="all_day" checked={form.all_day} onChange={e => setForm({ ...form, all_day: e.target.checked })} />
            <label htmlFor="all_day" className="text-sm text-gray-600">All day event</label>
          </div>
          <div className="col-span-2">
            <FormField label="Description">
              <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
      <ManageLabelsModal open={showManageLabels} onClose={() => setShowManageLabels(false)} />
    </div>
  )
}
