import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { projectService, clientService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { ManageLabelsModal } from '@/components/common/ManageLabelsModal'
import { toast } from 'react-toastify'
import { Plus, Printer, FileDown, Filter } from 'lucide-react'
import {
  PageHeader, Toolbar, SearchInput, Pagination,
  StatusBadge, ProgressBar, Modal, FormField, ConfirmDialog, Loading, EmptyState, PriceInput
} from '@/components/common'

export default function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showManageLabels, setShowManageLabels] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<any>({
    title: '', client_id: '', price: '', currency: 'IDR',
    start_date: '', deadline: '', status: 'open', description: ''
  })
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    projectService.list({ page, limit: 10, q: search })
      .then(r => { setProjects(r.data.data || []); setTotal(r.data.total || 0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [page, search])
  useEffect(() => { clientService.list({ limit: 100 }).then(r => setClients(r.data.data || [])) }, [])

  const openAdd = () => {
    setEditItem(null)
    setForm({ title: '', client_id: '', price: '', currency: 'IDR', start_date: '', deadline: '', status: 'open', description: '' })
    setShowModal(true)
  }

  useEffect(() => {
    if (searchParams.get('compose') !== 'new') return

    setEditItem(null)
    setForm({ title: '', client_id: '', price: '', currency: 'IDR', start_date: '', deadline: '', status: 'open', description: '' })
    setShowModal(true)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('compose')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const openEdit = (p: any) => {
    setEditItem(p)
    setForm({
      title: p.title,
      client_id: String(p.client_id || ''),
      price: p.price,
      currency: p.currency,
      start_date: p.start_date?.split('T')[0] || '',
      deadline: p.deadline?.split('T')[0] || '',
      status: p.status,
      description: p.description || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        client_id: Number(form.client_id) || 0,
        price: Number(form.price) || 0,
        start_date: toISODate(form.start_date),
        deadline: toISODate(form.deadline),
      }
      if (editItem) {
        await projectService.update(editItem.id, payload)
        toast.success('Project updated!')
      } else {
        await projectService.create(payload)
        toast.success('Project created!')
      }
      setShowModal(false)
      fetch()
    } catch { toast.error(editItem ? 'Failed to update project' : 'Failed to create project') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await projectService.delete(deleteId)
    toast.success('Project deleted')
    fetch()
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Projects"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowManageLabels(true)}><Filter size={12} /> Manage labels</button>
            <button className="btn btn-secondary"><FileDown size={12} /> Import projects</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add project</button>
          </>
        }
      />

      <Toolbar
        left={<button className="btn btn-secondary"><Filter size={12} />+ Add new filter</button>}
        right={
          <>
            <button className="btn btn-secondary"><FileDown size={12} />Excel</button>
            <button className="btn btn-secondary"><Printer size={12} />Print</button>
            <SearchInput value={search} onChange={setSearch} />
          </>
        }
      />

      <div className="table-container">
        {loading ? <Loading /> : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Title</th><th>Client</th><th>Price</th>
                  <th>Start date</th><th>Deadline</th><th>Progress</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0
                  ? <tr><td colSpan={9}><EmptyState /></td></tr>
                  : projects.map(p => (
                    <tr key={p.id}>
                      <td className="text-gray-400">{p.id}</td>
                      <td>
                        <Link to={`/projects/${p.id}`} className="text-blue-600 hover:underline font-medium">{p.title}</Link>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.labels?.map((l: any) => (
                            <span key={l.id} className="badge badge-blue">{l.name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-gray-500">{p.client?.name || '-'}</td>
                      <td className="whitespace-nowrap">{p.currency} {Number(p.price).toLocaleString()}</td>
                      <td className="text-gray-400 whitespace-nowrap">{p.start_date ? new Date(p.start_date).toLocaleDateString('id') : '-'}</td>
                      <td className={`whitespace-nowrap ${new Date(p.deadline) < new Date() && p.status !== 'completed' ? 'text-red-500' : 'text-gray-400'}`}>
                        {p.deadline ? new Date(p.deadline).toLocaleDateString('id') : '-'}
                      </td>
                      <td><ProgressBar value={p.progress} className="w-20" /></td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(p)}>Edit</button>
                          <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(p.id)}>×</button>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Project' : 'Add Project'} size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editItem ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Title" required>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Project title" />
            </FormField>
          </div>
          <FormField label="Client">
            <select className="input" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
              <option value="hold">Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FormField>
          <FormField label="Price">
            <PriceInput value={form.price} onChange={v => setForm({ ...form, price: v })} />
          </FormField>
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="IDR">IDR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </FormField>
          <FormField label="Start Date">
            <input className="input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </FormField>
          <FormField label="Deadline">
            <input className="input" type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Description">
              <textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Project description..." />
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
      <ManageLabelsModal open={showManageLabels} onClose={() => setShowManageLabels(false)} />
    </div>
  )
}
