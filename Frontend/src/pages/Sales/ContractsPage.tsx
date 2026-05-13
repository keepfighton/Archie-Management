import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { contractService, clientService, projectService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { toast } from 'react-toastify'
import { Plus, Filter, FileDown } from 'lucide-react'
import {
  PageHeader, Toolbar, SearchInput,
  StatusBadge, Modal, FormField, ConfirmDialog, Loading, EmptyState, PriceInput
} from '@/components/common'

export default function ContractsPage() {
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    contract_number: '', title: '', client_id: '', project_id: '',
    contract_date: '', valid_until: '', amount: '', currency: 'IDR', status: 'draft', file_url: '',
  })

  const load = () => {
    setLoading(true)
    contractService.list()
      .then(r => setContracts(r.data.data || []))
      .catch(() => toast.error('Failed to load contracts'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    clientService.list({ limit: 100 }).then(r => setClients(r.data.data || [])).catch(() => {})
    projectService.list({ limit: 100 }).then(r => setProjects(r.data.data || [])).catch(() => {})
  }, [])
  useEffect(() => {
    if (!search) { setFiltered(contracts); return }
    const q = search.toLowerCase()
    setFiltered(contracts.filter(c => c.title?.toLowerCase().includes(q) || c.contract_number?.toLowerCase().includes(q)))
  }, [search, contracts])

  const genContractNumber = () => `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`

  const openAdd = () => {
    setEditItem(null)
    setForm({ contract_number: genContractNumber(), title: '', client_id: '', project_id: '', contract_date: '', valid_until: '', amount: '', currency: 'IDR', status: 'draft', file_url: '' })
    setShowModal(true)
  }

  const openEdit = (c: any) => {
    setEditItem(c)
    setForm({
      contract_number: c.contract_number, title: c.title, client_id: c.client_id, project_id: c.project_id || '',
      contract_date: c.contract_date?.split('T')[0] || '', valid_until: c.valid_until?.split('T')[0] || '',
      amount: c.amount, currency: c.currency, status: c.status, file_url: c.file_url || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.client_id) { toast.error('Title and client are required'); return }
    setSaving(true)
    try {
      const payload = { ...form, client_id: Number(form.client_id), project_id: form.project_id ? Number(form.project_id) : null, amount: Number(form.amount), contract_date: toISODate(form.contract_date), valid_until: toISODate(form.valid_until) }
      if (editItem) {
        await contractService.update(editItem.id, payload)
        toast.success('Contract updated!')
      } else {
        await contractService.create(payload)
        toast.success('Contract created!')
      }
      setShowModal(false)
      load()
    } catch { toast.error('Failed to save contract') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await contractService.delete(deleteId)
      toast.success('Contract deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Contracts"
        actions={
          <>
            <button className="btn btn-secondary"><FileDown size={12} /> Export</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add contract</button>
          </>
        }
      />
      <Toolbar
        left={<button className="btn btn-secondary"><Filter size={12} />+ Add new filter</button>}
        right={<SearchInput value={search} onChange={setSearch} />}
      />
      <div className="table-container">
        {loading ? <Loading /> : (
          <table className="table">
            <thead>
              <tr><th>Contract #</th><th>Title</th><th>Client</th><th>Date</th><th>Valid Until</th><th>Amount</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={8}><EmptyState /></td></tr>
                : filtered.map(c => (
                  <tr key={c.id} className="cursor-pointer hover:bg-blue-50/50" onClick={() => navigate(`/sales/contracts/${c.id}`)}>
                    <td className="font-medium text-blue-600">{c.contract_number}</td>
                    <td className="font-medium">{c.title}</td>
                    <td className="text-gray-500">{c.client?.name || '-'}</td>
                    <td className="text-gray-400">{c.contract_date ? new Date(c.contract_date).toLocaleDateString('id') : '-'}</td>
                    <td className={`${new Date(c.valid_until) < new Date() && c.status !== 'completed' ? 'text-red-500' : 'text-gray-400'}`}>
                      {c.valid_until ? new Date(c.valid_until).toLocaleDateString('id') : '-'}
                    </td>
                    <td className="whitespace-nowrap">{c.currency} {Number(c.amount).toLocaleString()}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={e => { e.stopPropagation(); openEdit(c) }}>Edit</button>
                        <button className="btn btn-danger text-xs py-0.5 px-2" onClick={e => { e.stopPropagation(); setDeleteId(c.id) }}>×</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Contract' : 'Add Contract'} size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Contract Number">
            <input className="input" value={form.contract_number} onChange={e => setForm({ ...form, contract_number: e.target.value })} />
          </FormField>
          <FormField label="Status">
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FormField>
          <div className="col-span-2">
            <FormField label="Title" required>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Contract title" />
            </FormField>
          </div>
          <FormField label="Client" required>
            <select className="input" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Project">
            <select
              className="input"
              value={form.project_id}
              onChange={e => {
                const pid = e.target.value
                const proj = projects.find((p: any) => String(p.id) === pid)
                setForm((f: any) => ({
                  ...f,
                  project_id: pid,
                  ...(proj ? {
                    client_id:     String(proj.client_id || f.client_id),
                    contract_date: proj.start_date?.split('T')[0] || f.contract_date,
                    valid_until:   proj.deadline?.split('T')[0]   || f.valid_until,
                    amount:        proj.price ?? f.amount,
                    currency:      proj.currency || f.currency,
                  } : {}),
                }))
              }}
            >
              <option value="">No project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </FormField>
          <FormField label="Contract Date" hint={form.project_id ? 'Auto-filled from project start date' : undefined}>
            <input className="input" type="date" value={form.contract_date} onChange={e => setForm({ ...form, contract_date: e.target.value })} />
          </FormField>
          <FormField label="Valid Until" hint={form.project_id ? 'Auto-filled from project deadline' : undefined}>
            <input className="input" type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
          </FormField>
          <FormField label="Amount" hint={form.project_id ? 'Auto-filled from project price' : undefined}>
            <PriceInput value={form.amount} onChange={v => setForm({ ...form, amount: v })} />
          </FormField>
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="IDR">IDR</option><option value="USD">USD</option><option value="EUR">EUR</option>
            </select>
          </FormField>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  )
}
