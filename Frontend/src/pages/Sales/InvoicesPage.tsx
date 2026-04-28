import { useEffect, useState } from 'react'
import { invoiceService, clientService, projectService, invoicePDFService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { ManageLabelsModal } from '@/components/common/ManageLabelsModal'
import { toast } from 'react-toastify'
import { Plus, Filter, FileDown, Printer } from 'lucide-react'
import {
  PageHeader, Toolbar, SearchInput, Pagination,
  StatusBadge, Modal, FormField, ConfirmDialog, Loading, EmptyState, PriceInput
} from '@/components/common'

const STATUSES = ['draft', 'not_paid', 'partially_paid', 'fully_paid', 'overdue']

const getInvoiceSubtotal = (invoice: any) => {
  const subtotal = Number(invoice?.subtotal_amount ?? (Number(invoice?.total_amount || 0) - Number(invoice?.tax_amount || 0) + Number(invoice?.discount_amount || 0)))
  return subtotal < 0 ? 0 : subtotal
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
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
    invoice_number: '', client_id: '', project_id: '', bill_date: '', due_date: '',
    status: 'draft', currency: 'IDR', subtotal_amount: '', tax_amount: '', discount_amount: '',
    paid_amount: '0', due_amount: '', notes: '',
  })

  const load = (q = search) => {
    setLoading(true)
    const params: any = { page, limit: 10 }
    if (statusFilter) params.status = statusFilter
    if (q) params.q = q
    invoiceService.list(params)
      .then(r => { setInvoices(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(() => toast.error('Failed to load invoices'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); load(search) }, 300)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    clientService.list({ limit: 100 }).then(r => setClients(r.data.data || [])).catch(() => {})
    projectService.list({ limit: 100 }).then(r => setProjects(r.data.data || [])).catch(() => {})
  }, [])

  const genInvoiceNumber = () => {
    const d = new Date()
    return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({
      invoice_number: genInvoiceNumber(), client_id: '', project_id: '', bill_date: '', due_date: '',
      status: 'draft', currency: 'IDR', subtotal_amount: '', tax_amount: '0', discount_amount: '0',
      paid_amount: '0', due_amount: '', notes: '',
    })
    setShowModal(true)
  }

  const openEdit = (inv: any) => {
    setEditItem(inv)
    setForm({
      invoice_number: inv.invoice_number,
      client_id: String(inv.client_id || ''),
      project_id: String(inv.project_id || ''),
      bill_date: inv.bill_date?.split('T')[0] || '',
      due_date: inv.due_date?.split('T')[0] || '',
      status: inv.status,
      currency: inv.currency,
      subtotal_amount: getInvoiceSubtotal(inv),
      tax_amount: inv.tax_amount,
      discount_amount: inv.discount_amount,
      paid_amount: inv.paid_amount,
      due_amount: inv.due_amount,
      notes: inv.notes || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.invoice_number || !form.client_id) { toast.error('Invoice number and client are required'); return }
    setSaving(true)
    try {
      const subtotalAmount = Number(form.subtotal_amount) || 0
      const taxAmount = Number(form.tax_amount) || 0
      const discountAmount = Number(form.discount_amount) || 0
      const paidAmount = Number(form.paid_amount) || 0
      const totalAmount = Math.max(subtotalAmount + taxAmount - discountAmount, 0)
      const payload = {
        ...form,
        client_id: Number(form.client_id),
        project_id: form.project_id ? Number(form.project_id) : null,
        subtotal_amount: subtotalAmount,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        paid_amount: paidAmount,
        due_amount: Math.max(totalAmount - paidAmount, 0),
        bill_date: toISODate(form.bill_date),
        due_date: toISODate(form.due_date),
      }
      if (editItem) {
        await invoiceService.update(editItem.id, payload)
        toast.success('Invoice updated!')
      } else {
        await invoiceService.create(payload)
        toast.success('Invoice created!')
      }
      setShowModal(false)
      load()
    } catch { toast.error(editItem ? 'Failed to update invoice' : 'Failed to create invoice') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await invoiceService.delete(deleteId)
      toast.success('Invoice deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  const fmt = (n: number, cur = 'IDR') => `${cur} ${Number(n || 0).toLocaleString()}`
  const subtotalAmount = Number(form.subtotal_amount) || 0
  const taxAmount = Number(form.tax_amount) || 0
  const discountAmount = Number(form.discount_amount) || 0
  const computedTotal = Math.max(subtotalAmount + taxAmount - discountAmount, 0)

  return (
    <div className="p-5">
      <PageHeader
        title="Invoices"
        actions={
          <>
            <button className="btn btn-secondary"><FileDown size={12} /> Export</button>
            <button className="btn btn-secondary" onClick={() => setShowManageLabels(true)}><Filter size={12} /> Manage labels</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add invoice</button>
          </>
        }
      />

      <Toolbar
        left={
          <div className="flex gap-2">
            {['', ...STATUSES].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`btn text-xs ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
                {s ? s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'All'}
              </button>
            ))}
          </div>
        }
        right={
          <>
            <button className="btn btn-secondary"><Printer size={12} />Print</button>
            <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Invoice #, client..." />
          </>
        }
      />

      <div className="table-container">
        {loading ? <Loading /> : (
          <>
            <table className="table">
              <thead>
                <tr><th>Invoice #</th><th>Client</th><th>Bill Date</th><th>Due Date</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {invoices.length === 0
                  ? <tr><td colSpan={9}><EmptyState /></td></tr>
                  : invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="font-medium text-blue-600">{inv.invoice_number}</td>
                      <td className="text-gray-500">{inv.client?.name || '-'}</td>
                      <td className="text-gray-400 whitespace-nowrap">{inv.bill_date ? new Date(inv.bill_date).toLocaleDateString('id') : '-'}</td>
                      <td className={`whitespace-nowrap ${new Date(inv.due_date) < new Date() && inv.status !== 'fully_paid' ? 'text-red-500' : 'text-gray-400'}`}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('id') : '-'}
                      </td>
                      <td className="whitespace-nowrap font-medium">{fmt(inv.total_amount, inv.currency)}</td>
                      <td className="whitespace-nowrap text-green-600">{fmt(inv.paid_amount, inv.currency)}</td>
                      <td className="whitespace-nowrap text-red-500">{fmt(inv.due_amount, inv.currency)}</td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            title="Export PDF"
                            className="btn btn-secondary text-xs py-0.5 px-2"
                            onClick={() => invoicePDFService.openPDF(inv.id)}
                          >
                            <Printer size={12} />
                          </button>
                          <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(inv)}>Edit</button>
                          <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(inv.id)}>×</button>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Invoice' : 'Add Invoice'} size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editItem ? 'Update' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Invoice Number" required>
            <input className="input" value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} />
          </FormField>
          <FormField label="Status">
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
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
                      client_id:    String(proj.client_id || f.client_id),
                      bill_date:    proj.start_date?.split('T')[0] || f.bill_date,
                      due_date:     proj.deadline?.split('T')[0]   || f.due_date,
                      subtotal_amount: proj.price ?? f.subtotal_amount,
                      currency:     proj.currency || f.currency,
                    } : {}),
                }))
              }}
            >
              <option value="">No project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </FormField>
          <FormField label="Bill Date" hint={form.project_id ? 'Auto-filled from project start date' : undefined}>
            <input className="input" type="date" value={form.bill_date} onChange={e => setForm({ ...form, bill_date: e.target.value })} />
          </FormField>
          <FormField label="Due Date" hint={form.project_id ? 'Auto-filled from project deadline' : undefined}>
            <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </FormField>
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="IDR">IDR</option><option value="USD">USD</option><option value="EUR">EUR</option>
            </select>
          </FormField>
          <FormField label="Subtotal" hint={form.project_id ? 'Auto-filled from project price' : undefined}>
            <PriceInput value={form.subtotal_amount} onChange={v => setForm({ ...form, subtotal_amount: v })} />
          </FormField>
          <FormField label="Tax Amount">
            <PriceInput value={form.tax_amount} onChange={v => setForm({ ...form, tax_amount: v })} />
          </FormField>
          <FormField label="Discount Amount">
            <PriceInput value={form.discount_amount} onChange={v => setForm({ ...form, discount_amount: v })} />
          </FormField>
          <div className="col-span-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-500">Total: </span>
            <span className="font-semibold text-gray-900">{fmt(computedTotal, form.currency)}</span>
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
