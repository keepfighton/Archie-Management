import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { invoiceService, clientService, projectService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { toast } from 'react-toastify'
import { ChevronLeft, Plus, Trash2, Pencil } from 'lucide-react'
import {
  Loading, EmptyState, StatusBadge, Modal, FormField, ConfirmDialog, PriceInput
} from '@/components/common'

const STATUSES = ['draft', 'not_paid', 'partially_paid', 'fully_paid', 'overdue']
const PAYMENT_METHODS = ['bank_transfer', 'cash', 'credit_card', 'check', 'other']
const CURRENCIES = ['IDR', 'USD', 'EUR', 'GBP', 'SGD', 'MYR']

const fmt = (n: number, cur = 'IDR') =>
  `${cur} ${Number(n || 0).toLocaleString('id-ID')}`

const getInvoiceSubtotal = (invoice: any, items: any[] = []) => {
  if (typeof invoice?.subtotal_amount === 'number') return Math.max(Number(invoice.subtotal_amount), 0)
  if (items.length > 0) return items.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0)
  return Math.max(Number(invoice?.total_amount || 0) - Number(invoice?.tax_amount || 0) + Number(invoice?.discount_amount || 0), 0)
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const invoiceId = Number(id)

  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  // Edit invoice modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

  // Add/Edit item modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [savingItem, setSavingItem] = useState(false)
  const [itemForm, setItemForm] = useState({ description: '', quantity: 1, unit_price: 0 })

  // Delete item
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null)

  // Add payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: 0, payment_date: '', payment_method: 'bank_transfer', note: '', currency: 'IDR',
  })
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await invoiceService.get(invoiceId)
      setInvoice(r.data)
    } catch { toast.error('Failed to load invoice') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [invoiceId])
  useEffect(() => {
    clientService.list({ limit: 200 }).then(r => setClients(r.data.data || [])).catch(() => {})
    projectService.list({ limit: 200 }).then(r => setProjects(r.data.data || [])).catch(() => {})
  }, [])

  // ── Edit Invoice ──────────────────────────────────────
  const openEdit = () => {
    const subtotal = getInvoiceSubtotal(invoice, invoice.items || [])
    setEditForm({
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id,
      project_id: invoice.project_id || '',
      bill_date: invoice.bill_date ? invoice.bill_date.substring(0, 10) : '',
      due_date: invoice.due_date ? invoice.due_date.substring(0, 10) : '',
      status: invoice.status,
      currency: invoice.currency,
      subtotal_amount: subtotal,
      tax_amount: invoice.tax_amount,
      discount_amount: invoice.discount_amount,
      notes: invoice.notes,
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editForm.invoice_number || !editForm.client_id) {
      toast.error('Invoice number and client are required'); return
    }
    setSavingEdit(true)
    try {
      await invoiceService.update(invoiceId, {
        ...editForm,
        client_id: Number(editForm.client_id),
        project_id: editForm.project_id ? Number(editForm.project_id) : null,
        subtotal_amount: Number(editForm.subtotal_amount) || 0,
        tax_amount: Number(editForm.tax_amount) || 0,
        discount_amount: Number(editForm.discount_amount) || 0,
        bill_date: toISODate(editForm.bill_date),
        due_date: toISODate(editForm.due_date),
      })
      toast.success('Invoice updated!')
      setShowEditModal(false)
      load()
    } catch { toast.error('Failed to update invoice') }
    finally { setSavingEdit(false) }
  }

  // ── Items ─────────────────────────────────────────────
  const openAddItem = () => {
    setEditItem(null)
    setItemForm({ description: '', quantity: 1, unit_price: 0 })
    setShowItemModal(true)
  }

  const openEditItem = (item: any) => {
    setEditItem(item)
    setItemForm({ description: item.description, quantity: item.quantity, unit_price: item.unit_price })
    setShowItemModal(true)
  }

  const handleSaveItem = async () => {
    if (!itemForm.description.trim()) { toast.error('Description is required'); return }
    setSavingItem(true)
    try {
      const payload = {
        description: itemForm.description,
        quantity: Number(itemForm.quantity),
        unit_price: Number(itemForm.unit_price),
        total: Number(itemForm.quantity) * Number(itemForm.unit_price),
      }
      if (editItem) {
        await invoiceService.updateItem(invoiceId, editItem.id, payload)
        toast.success('Item updated!')
      } else {
        await invoiceService.addItem(invoiceId, payload)
        toast.success('Item added!')
      }
      setShowItemModal(false)
      load()
    } catch { toast.error('Failed to save item') }
    finally { setSavingItem(false) }
  }

  const handleDeleteItem = async () => {
    if (!deleteItemId) return
    try {
      await invoiceService.deleteItem(invoiceId, deleteItemId)
      toast.success('Item deleted')
      load()
    } catch { toast.error('Failed to delete item') }
  }

  // ── Payments ──────────────────────────────────────────
  const openAddPayment = () => {
    setPaymentForm({
      amount: 0,
      payment_date: new Date().toISOString().substring(0, 10),
      payment_method: 'bank_transfer',
      note: '',
      currency: invoice?.currency || 'IDR',
    })
    setShowPaymentModal(true)
  }

  const handleAddPayment = async () => {
    if (!paymentForm.amount || paymentForm.amount <= 0) { toast.error('Amount is required'); return }
    if (!paymentForm.payment_date) { toast.error('Payment date is required'); return }
    setSavingPayment(true)
    try {
      await invoiceService.addPayment(invoiceId, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
        payment_date: toISODate(paymentForm.payment_date),
      })
      toast.success('Payment recorded!')
      setShowPaymentModal(false)
      load()
    } catch { toast.error('Failed to record payment') }
    finally { setSavingPayment(false) }
  }

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return
    try {
      await invoiceService.deletePayment(invoiceId, deletePaymentId)
      toast.success('Payment deleted')
      load()
    } catch { toast.error('Failed to delete payment') }
  }

  if (loading) return <div className="p-5"><Loading /></div>
  if (!invoice) return <div className="p-5"><EmptyState message="Invoice not found." /></div>

  const items: any[] = invoice.items || []
  const payments: any[] = invoice.payments || []
  const subtotal = getInvoiceSubtotal(invoice, items)
  const dueIsOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'fully_paid'

  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* Back */}
      <div className="flex items-center gap-2 mb-4">
        <Link to="/sales/invoices" className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
          <ChevronLeft size={16} /> Invoices
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{invoice.client?.name || '—'}</p>
            {invoice.project && <p className="text-xs text-gray-400 mt-0.5">Project: {invoice.project.title}</p>}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={invoice.status} />
            <button className="btn btn-secondary text-xs" onClick={openEdit}><Pencil size={11} /> Edit</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">Bill Date</p>
            <p className="text-sm">{invoice.bill_date ? new Date(invoice.bill_date).toLocaleDateString('id') : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Due Date</p>
            <p className={`text-sm ${dueIsOverdue ? 'text-red-500 font-medium' : ''}`}>
              {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('id') : '—'}
              {dueIsOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Currency</p>
            <p className="text-sm">{invoice.currency}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Notes</p>
            <p className="text-sm text-gray-600 truncate">{invoice.notes || '—'}</p>
          </div>
        </div>

        {/* Amount summary */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-gray-400">Subtotal</p>
            <p className="text-sm font-medium">{fmt(subtotal, invoice.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Tax</p>
            <p className="text-sm">{fmt(invoice.tax_amount, invoice.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Discount</p>
            <p className="text-sm text-orange-500">- {fmt(invoice.discount_amount, invoice.currency)}</p>
          </div>
          <div className="border-l border-gray-200 pl-6">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-base font-bold text-gray-900">{fmt(invoice.total_amount, invoice.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Paid</p>
            <p className="text-base font-bold text-green-600">{fmt(invoice.paid_amount, invoice.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Due</p>
            <p className={`text-base font-bold ${invoice.due_amount > 0 ? 'text-red-500' : 'text-gray-400'}`}>{fmt(invoice.due_amount, invoice.currency)}</p>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg border border-gray-200 mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
          <button className="btn btn-primary text-xs" onClick={openAddItem}><Plus size={11} /> Add item</button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0
              ? <tr><td colSpan={5}><EmptyState message="No items yet. Add your first line item." /></td></tr>
              : items.map((item: any) => (
                <tr key={item.id}>
                  <td className="font-medium">{item.description}</td>
                  <td className="text-right text-gray-500">{Number(item.quantity).toLocaleString('id-ID')}</td>
                  <td className="text-right text-gray-500">{fmt(item.unit_price, invoice.currency)}</td>
                  <td className="text-right font-medium">{fmt(item.total, invoice.currency)}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEditItem(item)}><Pencil size={10} /></button>
                      <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteItemId(item.id)}><Trash2 size={10} /></button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={3} className="text-right text-sm font-medium text-gray-600 px-4 py-2">Subtotal</td>
                <td className="text-right font-bold px-4 py-2">{fmt(subtotal, invoice.currency)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Payments</h2>
          <button className="btn btn-primary text-xs" onClick={openAddPayment}><Plus size={11} /> Record payment</button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Note</th>
              <th className="text-right">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0
              ? <tr><td colSpan={5}><EmptyState message="No payments recorded yet." /></td></tr>
              : payments.map((p: any) => (
                <tr key={p.id}>
                  <td className="text-gray-500 whitespace-nowrap">
                    {p.payment_date ? new Date(p.payment_date).toLocaleDateString('id') : '—'}
                  </td>
                  <td className="capitalize text-gray-500">{p.payment_method?.replace(/_/g, ' ')}</td>
                  <td className="text-gray-400 text-sm">{p.note || '—'}</td>
                  <td className="text-right font-medium text-green-600">{fmt(p.amount, p.currency)}</td>
                  <td>
                    <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeletePaymentId(p.id)}><Trash2 size={10} /></button>
                  </td>
                </tr>
              ))
            }
          </tbody>
          {payments.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={3} className="text-right text-sm font-medium text-gray-600 px-4 py-2">Total Paid</td>
                <td className="text-right font-bold text-green-600 px-4 py-2">{fmt(invoice.paid_amount, invoice.currency)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Edit Invoice Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Invoice" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Invoice Number" required>
            <input className="input" value={editForm.invoice_number || ''} onChange={e => setEditForm({ ...editForm, invoice_number: e.target.value })} />
          </FormField>
          <FormField label="Status">
            <select className="input" value={editForm.status || ''} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </FormField>
          <FormField label="Client" required>
            <select className="input" value={editForm.client_id || ''} onChange={e => setEditForm({ ...editForm, client_id: e.target.value })}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Project">
            <select className="input" value={editForm.project_id || ''} onChange={e => setEditForm({ ...editForm, project_id: e.target.value })}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </FormField>
          <FormField label="Bill Date">
            <input className="input" type="date" value={editForm.bill_date || ''} onChange={e => setEditForm({ ...editForm, bill_date: e.target.value })} />
          </FormField>
          <FormField label="Due Date">
            <input className="input" type="date" value={editForm.due_date || ''} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })} />
          </FormField>
          <FormField label="Currency">
            <select className="input" value={editForm.currency || 'IDR'} onChange={e => setEditForm({ ...editForm, currency: e.target.value })}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Tax Amount">
            <PriceInput value={editForm.tax_amount || 0} onChange={v => setEditForm({ ...editForm, tax_amount: v })} />
          </FormField>
          <FormField label="Discount Amount">
            <PriceInput value={editForm.discount_amount || 0} onChange={v => setEditForm({ ...editForm, discount_amount: v })} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Notes">
              <textarea className="input" rows={2} value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Item Modal */}
      <Modal open={showItemModal} onClose={() => setShowItemModal(false)} title={editItem ? 'Edit Item' : 'Add Item'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveItem} disabled={savingItem}>{savingItem ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Description" required>
            <input className="input" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Product or service description" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantity">
              <input className="input" type="number" min="0" step="0.01" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) })} />
            </FormField>
            <FormField label="Unit Price">
              <PriceInput value={itemForm.unit_price} onChange={v => setItemForm({ ...itemForm, unit_price: v })} />
            </FormField>
          </div>
          <div className="bg-gray-50 rounded p-3 text-sm">
            <span className="text-gray-500">Total: </span>
            <span className="font-semibold">{fmt(Number(itemForm.quantity) * Number(itemForm.unit_price), invoice.currency)}</span>
          </div>
        </div>
      </Modal>

      {/* Add Payment Modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddPayment} disabled={savingPayment}>{savingPayment ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Amount" required>
            <PriceInput value={paymentForm.amount} onChange={v => setPaymentForm({ ...paymentForm, amount: v })} />
          </FormField>
          <FormField label="Payment Date" required>
            <input className="input" type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
          </FormField>
          <FormField label="Payment Method">
            <select className="input" value={paymentForm.payment_method} onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </FormField>
          <FormField label="Currency">
            <select className="input" value={paymentForm.currency} onChange={e => setPaymentForm({ ...paymentForm, currency: e.target.value })}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Note">
            <input className="input" value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} placeholder="Optional note..." />
          </FormField>
          <div className="bg-gray-50 rounded p-3 text-sm text-gray-500">
            Remaining due: <span className="font-semibold text-red-500">{fmt(invoice.due_amount, invoice.currency)}</span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteItemId} onClose={() => setDeleteItemId(null)} onConfirm={handleDeleteItem} message="Delete this line item?" />
      <ConfirmDialog open={!!deletePaymentId} onClose={() => setDeletePaymentId(null)} onConfirm={handleDeletePayment} message="Delete this payment record?" />
    </div>
  )
}
