import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { leadService } from '@/services/api'
import { ManageLabelsModal } from '@/components/common/ManageLabelsModal'
import { isValidEmail } from '@/utils/format'
import { toast } from 'react-toastify'
import { Plus, Filter, FileDown } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  PageHeader, Toolbar, SearchInput, Pagination,
  StatusBadge, Modal, FormField, ConfirmDialog, Loading, EmptyState, ViewTabs
} from '@/components/common'

const VIEWS = [{ key: 'list', label: 'List' }, { key: 'kanban', label: 'Kanban' }]
const PIPELINE = ['new', 'qualified', 'discussion', 'negotiation', 'won', 'lost']
const PIPELINE_LABELS: Record<string, string> = {
  new: 'New', qualified: 'Qualified', discussion: 'Discussion',
  negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
}
const PIPELINE_COLORS: Record<string, string> = {
  new: 'bg-gray-100', qualified: 'bg-purple-50', discussion: 'bg-blue-50',
  negotiation: 'bg-yellow-50', won: 'bg-green-50', lost: 'bg-red-50',
}

export default function LeadsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState('list')
  const [leads, setLeads] = useState<any[]>([])
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showManageLabels, setShowManageLabels] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    name: '', primary_contact: '', phone: '', email: '', source: '', status: 'new', notes: '',
  })

  const load = () => {
    setLoading(true)
    const params: any = { page, limit: 10, q: search }
    if (statusFilter) params.status = statusFilter
    leadService.list(params)
      .then(r => { setLeads(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(() => toast.error('Failed to load leads'))
      .finally(() => setLoading(false))
  }

  const loadAll = () => {
    leadService.list({ limit: 300 }).then(r => setAllLeads(r.data.data || [])).catch(() => {})
  }

  useEffect(() => { load() }, [page, search, statusFilter])
  useEffect(() => { loadAll() }, [])

  const openAdd = () => {
    setEditItem(null)
    setForm({ name: '', primary_contact: '', phone: '', email: '', source: '', status: 'new', notes: '' })
    setShowModal(true)
  }

  useEffect(() => {
    if (searchParams.get('compose') !== 'new') return

    setEditItem(null)
    setForm({ name: '', primary_contact: '', phone: '', email: '', source: '', status: 'new', notes: '' })
    setShowModal(true)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('compose')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const openEdit = (l: any) => {
    setEditItem(l)
    setForm({ name: l.name, primary_contact: l.primary_contact || '', phone: l.phone || '', email: l.email || '', source: l.source || '', status: l.status, notes: l.notes || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (form.email && !isValidEmail(form.email)) { toast.error('Invalid email format'); return }
    setSaving(true)
    try {
      if (editItem) {
        await leadService.update(editItem.id, form)
        toast.success('Lead updated!')
      } else {
        await leadService.create(form)
        toast.success('Lead created!')
      }
      setShowModal(false)
      load(); loadAll()
    } catch { toast.error('Failed to save lead') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await leadService.delete(deleteId)
      toast.success('Lead deleted')
      load(); loadAll()
    } catch { toast.error('Failed to delete') }
  }

  const handleConvert = async (lead: any) => {
    if (!window.confirm(`Convert "${lead.name}" menjadi Client?`)) return
    try {
      const res = await leadService.convert(lead.id)
      toast.success(`Lead berhasil dikonversi ke Client!`)
      navigate(`/clients/${res.data.id}`)
    } catch { toast.error('Gagal mengkonversi lead') }
  }

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const newStatus = result.destination.droppableId
    const leadId = Number(result.draggableId)
    setAllLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    try {
      await leadService.updateStatus(leadId, newStatus)
    } catch {
      toast.error('Failed to update status')
      loadAll()
    }
  }

  const kanbanLeads = PIPELINE.reduce((acc, col) => {
    acc[col] = allLeads.filter(l => l.status === col)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="p-5">
      <PageHeader
        title="Leads"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowManageLabels(true)}><Filter size={12} /> Manage labels</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add lead</button>
          </>
        }
      />

      <ViewTabs tabs={VIEWS} active={view} onChange={setView} />

      {/* List View */}
      {view === 'list' && (
        <>
          <Toolbar
            left={
              <select className="input input-sm" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
                <option value="">All status</option>
                {PIPELINE.map(s => <option key={s} value={s}>{PIPELINE_LABELS[s]}</option>)}
              </select>
            }
            right={
              <>
                <button className="btn btn-secondary"><FileDown size={12} />Excel</button>
                <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} />
              </>
            }
          />
          <div className="table-container">
            {loading ? <Loading /> : (
              <>
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Source</th><th>Status</th><th>Owner</th><th></th></tr>
                  </thead>
                  <tbody>
                    {leads.length === 0
                      ? <tr><td colSpan={8}><EmptyState /></td></tr>
                      : leads.map(l => (
                        <tr key={l.id}>
                          <td className="font-medium">{l.name}</td>
                          <td className="text-gray-500">{l.primary_contact || '-'}</td>
                          <td className="text-gray-500">{l.email || '-'}</td>
                          <td className="text-gray-500">{l.phone || '-'}</td>
                          <td className="text-gray-400">{l.source || '-'}</td>
                          <td><StatusBadge status={l.status} /></td>
                          <td className="text-gray-400">{l.owner?.name || '-'}</td>
                          <td>
                            <div className="flex gap-1">
                              <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(l)}>Edit</button>
                              <button className="btn btn-secondary text-xs py-0.5 px-2 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleConvert(l)} title="Convert to Client">→ Client</button>
                              <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(l.id)}>×</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
                <Pagination page={page} total={total} limit={10} onChange={setPage} />
              </>
            )}
          </div>
        </>
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {PIPELINE.map(col => (
              <div key={col} className="flex-shrink-0 w-56">
                <div className={`rounded-t-lg px-3 py-2 flex items-center justify-between ${PIPELINE_COLORS[col]}`}>
                  <span className="text-xs font-semibold text-gray-600">{PIPELINE_LABELS[col]}</span>
                  <span className="text-xs bg-white rounded-full px-1.5 py-0.5 text-gray-500">{kanbanLeads[col]?.length}</span>
                </div>
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] p-2 rounded-b-lg border border-t-0 border-gray-200 space-y-2 ${snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-white'}`}
                    >
                      {kanbanLeads[col]?.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={String(lead.id)} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={`bg-white border border-gray-200 rounded-lg p-3 text-xs shadow-sm cursor-grab ${snap.isDragging ? 'shadow-md ring-1 ring-blue-400' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="font-medium text-gray-800">{lead.name}</p>
                                <button
                                  onClick={e => { e.stopPropagation(); handleConvert(lead) }}
                                  className="text-green-600 hover:text-green-700 text-xs shrink-0"
                                  title="Convert to Client"
                                >→ Client</button>
                              </div>
                              {lead.primary_contact && <p className="text-gray-400 mt-0.5">{lead.primary_contact}</p>}
                              {lead.email && <p className="text-gray-400">{lead.email}</p>}
                              {lead.source && <p className="text-gray-300 mt-1">via {lead.source}</p>}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Lead' : 'Add Lead'} size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Name" required>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Company / lead name" />
            </FormField>
          </div>
          <FormField label="Primary Contact">
            <input className="input" value={form.primary_contact} onChange={e => setForm({ ...form, primary_contact: e.target.value })} placeholder="Contact person" />
          </FormField>
          <FormField label="Source">
            <input className="input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="Website, referral..." />
          </FormField>
          <FormField label="Email">
            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          </FormField>
          <FormField label="Phone">
            <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+62..." />
          </FormField>
          <div className="col-span-2">
            <FormField label="Status">
              <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {PIPELINE.map(s => <option key={s} value={s}>{PIPELINE_LABELS[s]}</option>)}
              </select>
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Notes">
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes..." />
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
      <ManageLabelsModal open={showManageLabels} onClose={() => setShowManageLabels(false)} />
    </div>
  )
}
