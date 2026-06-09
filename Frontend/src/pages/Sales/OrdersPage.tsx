import { useEffect, useState } from 'react'
import { orderService, clientService, projectService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { toast } from 'react-toastify'
import { Plus, FileDown, FileText } from 'lucide-react'
import {
  PageHeader, Toolbar, SearchInput,
  StatusBadge, Modal, FormField, ConfirmDialog, Loading, EmptyState, PriceInput
} from '@/components/common'

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    order_number: '', client_id: '', project_id: '', order_date: '', amount: '', currency: 'IDR', status: 'pending',
  })

  const load = () => {
    setLoading(true)
    orderService.list()
      .then(r => setOrders(r.data.data || []))
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    clientService.list({ limit: 100 }).then(r => setClients(r.data.data || [])).catch(() => {})
    projectService.list({ limit: 100 }).then(r => setProjects(r.data.data || [])).catch(() => {})
  }, [])
  useEffect(() => {
    if (!search) { setFiltered(orders); return }
    const q = search.toLowerCase()
    setFiltered(orders.filter(o => o.order_number?.toLowerCase().includes(q) || o.client?.name?.toLowerCase().includes(q)))
  }, [search, orders])

  const genOrderNumber = () => `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`

  const openAdd = () => {
    setForm({ order_number: genOrderNumber(), client_id: '', project_id: '', order_date: new Date().toISOString().split('T')[0], amount: '', currency: 'IDR', status: 'pending' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.client_id) { toast.error('Client is required'); return }
    setSaving(true)
    try {
      await orderService.create({ ...form, client_id: Number(form.client_id), project_id: form.project_id ? Number(form.project_id) : null, amount: Number(form.amount), order_date: toISODate(form.order_date) })
      toast.success('Order created!')
      setShowModal(false)
      load()
    } catch { toast.error('Failed to create order') }
    finally { setSaving(false) }
  }

  const handleConvertToInvoice = async (id: number) => {
    try {
      await orderService.convertToInvoice(id)
      toast.success('Invoice created from order!')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to convert to invoice')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await orderService.delete(deleteId)
      toast.success('Order deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Orders"
        actions={
          <>
            <button className="btn btn-secondary"><FileDown size={12} /> Export</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add order</button>
          </>
        }
      />
      <Toolbar
        left={<span className="text-xs text-gray-400">{filtered.length} orders</span>}
        right={<SearchInput value={search} onChange={setSearch} placeholder="Search orders..." />}
      />
      <div className="table-container">
        {loading ? <Loading /> : (
          <table className="table">
            <thead>
              <tr><th>Order #</th><th>Client</th><th>Order Date</th><th>Amount</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6}><EmptyState /></td></tr>
                : filtered.map(o => (
                  <tr key={o.id}>
                    <td className="font-medium text-blue-600">{o.order_number}</td>
                    <td className="text-gray-500">{o.client?.name || '-'}</td>
                    <td className="text-gray-400 whitespace-nowrap">{o.order_date ? new Date(o.order_date).toLocaleDateString('id') : '-'}</td>
                    <td className="whitespace-nowrap font-medium">{o.currency} {Number(o.amount).toLocaleString('id-ID')}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          title="Convert to Invoice"
                          className="btn btn-secondary text-xs py-0.5 px-2"
                          onClick={() => handleConvertToInvoice(o.id)}
                        ><FileText size={12} /></button>
                        <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(o.id)}>×</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Order"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Order Number">
            <input className="input" value={form.order_number} onChange={e => setForm({ ...form, order_number: e.target.value })} />
          </FormField>
          <FormField label="Status">
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FormField>
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
                    client_id:  String(proj.client_id || f.client_id),
                    order_date: proj.start_date?.split('T')[0] || f.order_date,
                    amount:     proj.price ?? f.amount,
                    currency:   proj.currency || f.currency,
                  } : {}),
                }))
              }}
            >
              <option value="">No project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </FormField>
          <FormField label="Order Date" hint={form.project_id ? 'Auto-filled from project start date' : undefined}>
            <input className="input" type="date" value={form.order_date} onChange={e => setForm({ ...form, order_date: e.target.value })} />
          </FormField>
          <FormField label="Amount" hint={form.project_id ? 'Auto-filled from project price' : undefined}>
            <PriceInput value={form.amount} onChange={v => setForm({ ...form, amount: v })} />
          </FormField>
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="IDR">IDR</option><option value="USD">USD</option>
            </select>
          </FormField>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  )
}
