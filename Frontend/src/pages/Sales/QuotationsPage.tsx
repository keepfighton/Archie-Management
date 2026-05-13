import { useEffect, useState } from 'react'
import { clientService, projectService, quotationPrintService, quotationService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { toast } from 'react-toastify'
import { ArrowRightLeft, FileDown, Plus, Printer } from 'lucide-react'
import {
  ConfirmDialog,
  EmptyState,
  FormField,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  PriceInput,
  SearchInput,
  StatusBadge,
  Toolbar,
} from '@/components/common'

const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']

const fmt = (n: number, cur = 'IDR') => `${cur} ${Number(n || 0).toLocaleString('id-ID')}`

const emptyForm = () => ({
  quote_number: '',
  revision: 1,
  title: '',
  client_id: '',
  project_id: '',
  issue_date: new Date().toISOString().split('T')[0],
  valid_until: '',
  masa_berlaku: '',
  contract_no: '',
  status: 'draft',
  currency: 'IDR',
  subtotal_amount: '' as string | number,
  discount_pct: 0,
  tax_pct: 10,
  payment_terms: '',
  scope_summary: '',
  prepared_by: '',
  prepared_by_title: '',
  approved_by: '',
  approved_by_title: 'Director',
  pic: '',
  contact_phone: '',
  terbilang: '',
  acceptance_notes: '',
  notes: '',
})

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [activeQuotation, setActiveQuotation] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<any>(emptyForm())
  const [itemForm, setItemForm] = useState({ description: '', quantity: 1, unit_price: 0, duration: 12, duration_unit: 'month' })

  const load = (q = search, overridePage?: number) => {
    setLoading(true)
    const params: any = { page: overridePage ?? page, limit: 10 }
    if (statusFilter) params.status = statusFilter
    if (q) params.q = q
    quotationService
      .list(params)
      .then((r: any) => {
        setQuotations(r.data.data || [])
        setTotal(r.data.total || 0)
      })
      .catch(() => toast.error('Failed to load quotations'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); load(search) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    clientService.list({ limit: 200 }).then((r) => setClients(r.data.data || [])).catch(() => {})
    projectService.list({ limit: 200 }).then((r) => setProjects(r.data.data || [])).catch(() => {})
  }, [])

  const genQuoteNumber = () => {
    const d = new Date()
    return `QT-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ ...emptyForm(), quote_number: genQuoteNumber() })
    setShowModal(true)
  }

  const openEdit = (row: any) => {
    setEditItem(row)
    setForm({
      quote_number: row.quote_number,
      revision: row.revision || 1,
      title: row.title,
      client_id: String(row.client_id || ''),
      project_id: String(row.project_id || ''),
      issue_date: row.issue_date?.split('T')[0] || '',
      valid_until: row.valid_until?.split('T')[0] || '',
      masa_berlaku: row.masa_berlaku || '',
      contract_no: row.contract_no || '',
      status: row.status,
      currency: row.currency,
      subtotal_amount: row.subtotal_amount,
      discount_pct: row.discount_pct || 0,
      tax_pct: row.tax_pct ?? 10,
      payment_terms: row.payment_terms || '',
      scope_summary: row.scope_summary || '',
      prepared_by: row.prepared_by || '',
      prepared_by_title: row.prepared_by_title || '',
      approved_by: row.approved_by || '',
      approved_by_title: row.approved_by_title || 'Director',
      pic: row.pic || '',
      contact_phone: row.contact_phone || '',
      terbilang: row.terbilang || '',
      acceptance_notes: row.acceptance_notes || '',
      notes: row.notes || '',
    })
    setShowModal(true)
  }

  // Live total calculation
  const subtotal = Number(form.subtotal_amount) || 0
  const discountAmt = form.discount_pct ? subtotal * Number(form.discount_pct) / 100 : 0
  const afterDiscount = subtotal - discountAmt
  const taxAmt = form.tax_pct ? afterDiscount * Number(form.tax_pct) / 100 : 0
  const grandTotal = afterDiscount + taxAmt

  const handleSave = async () => {
    if (!form.quote_number || !form.title || !form.client_id) {
      toast.error('Quote number, title, and client are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        client_id: Number(form.client_id),
        project_id: form.project_id ? Number(form.project_id) : null,
        revision: Number(form.revision) || 1,
        subtotal_amount: subtotal,
        discount_pct: Number(form.discount_pct) || 0,
        tax_pct: Number(form.tax_pct) || 0,
        total_amount: grandTotal,
        issue_date: toISODate(form.issue_date),
        valid_until: toISODate(form.valid_until),
      }
      if (editItem) {
        await quotationService.update(editItem.id, payload)
        toast.success('Quotation updated!')
      } else {
        await quotationService.create(payload)
        toast.success('Quotation created!')
      }
      setShowModal(false)
      setPage(1)
      load(search, 1)
    } catch {
      toast.error(editItem ? 'Failed to update quotation' : 'Failed to create quotation')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await quotationService.delete(deleteId)
      toast.success('Quotation deleted')
      load()
    } catch {
      toast.error('Failed to delete quotation')
    }
  }

  const openAddItem = (row: any) => {
    setActiveQuotation(row)
    setItemForm({ description: '', quantity: 1, unit_price: 0, duration: 12, duration_unit: 'month' })
    setShowItemModal(true)
  }

  const handleSaveItem = async () => {
    if (!activeQuotation) return
    if (!itemForm.description.trim()) {
      toast.error('Item description is required')
      return
    }
    try {
      await quotationService.addItem(activeQuotation.id, {
        description: itemForm.description,
        quantity: Number(itemForm.quantity),
        unit_price: Number(itemForm.unit_price),
        duration: Number(itemForm.duration),
        duration_unit: itemForm.duration_unit,
        total: Number(itemForm.quantity) * Number(itemForm.unit_price),
      })
      toast.success('Item added to quotation')
      setShowItemModal(false)
      load()
    } catch {
      toast.error('Failed to add quotation item')
    }
  }

  const handleConvert = async (id: number, type: 'invoice' | 'order' | 'contract') => {
    try {
      if (type === 'invoice') await quotationService.convertToInvoice(id)
      if (type === 'order') await quotationService.convertToOrder(id)
      if (type === 'contract') await quotationService.convertToContract(id)
      toast.success(`Converted to ${type}`)
      load()
    } catch {
      toast.error(`Failed to convert to ${type}`)
    }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Quotations"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => load()}>
              <FileDown size={12} /> Refresh
            </button>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={12} /> Add Quotation
            </button>
          </>
        }
      />

      <Toolbar
        left={
          <div className="flex gap-2">
            {['', ...STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`btn text-xs ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              >
                {s ? s.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()) : 'All'}
              </button>
            ))}
          </div>
        }
        right={<SearchInput value={search} onChange={(v) => setSearch(v)} placeholder="Quote #, title, client..." />}
      />

      <div className="table-container">
        {loading ? (
          <Loading />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Rev</th>
                  <th>Title</th>
                  <th>Client</th>
                  <th>PIC</th>
                  <th>Tanggal Order</th>
                  <th>Masa Berlaku</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan={10}><EmptyState message="No quotations yet." /></td>
                  </tr>
                ) : (
                  quotations.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium text-blue-600">{row.quote_number}</td>
                      <td className="text-gray-400 text-xs">r{row.revision || 1}</td>
                      <td>{row.title}</td>
                      <td className="text-gray-500">{row.client?.name || '-'}</td>
                      <td className="text-gray-500 text-xs">{row.pic || '-'}</td>
                      <td>{row.issue_date ? new Date(row.issue_date).toLocaleDateString('id') : '-'}</td>
                      <td className="text-xs">{row.masa_berlaku || (row.valid_until ? new Date(row.valid_until).toLocaleDateString('id') : '-')}</td>
                      <td className="font-medium whitespace-nowrap">{fmt(row.total_amount, row.currency)}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-secondary text-xs py-0.5 px-2"
                            title="Print quotation"
                            onClick={async () => {
                              try { await quotationPrintService.openPrint(row.id) }
                              catch (e: any) { toast.error(e?.message || 'Failed to open print') }
                            }}
                          >
                            <Printer size={12} />
                          </button>
                          <button className="btn btn-secondary text-xs py-0.5 px-2" title="Add item" onClick={() => openAddItem(row)}>
                            +Item
                          </button>
                          <button className="btn btn-secondary text-xs py-0.5 px-2" title="Convert to invoice" onClick={() => handleConvert(row.id, 'invoice')}>
                            <ArrowRightLeft size={12} /> INV
                          </button>
                          <button className="btn btn-secondary text-xs py-0.5 px-2" title="Convert to order" onClick={() => handleConvert(row.id, 'order')}>
                            ORD
                          </button>
                          <button className="btn btn-secondary text-xs py-0.5 px-2" title="Convert to contract" onClick={() => handleConvert(row.id, 'contract')}>
                            CTR
                          </button>
                          <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(row)}>
                            Edit
                          </button>
                          <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(row.id)}>
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={10} onChange={setPage} />
          </>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Edit Quotation' : 'Add Quotation'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">

          {/* HEADER INFO */}
          <FormField label="Quote Number" required>
            <input className="input" value={form.quote_number} onChange={(e) => setForm({ ...form, quote_number: e.target.value })} />
          </FormField>
          <FormField label="Revision">
            <input className="input" type="number" min={1} value={form.revision}
              onChange={(e) => setForm({ ...form, revision: Number(e.target.value) })} />
          </FormField>

          <FormField label="No Kontrak">
            <input className="input" value={form.contract_no} placeholder="e.g. 74/02/BD/JOJO/2020"
              onChange={(e) => setForm({ ...form, contract_no: e.target.value })} />
          </FormField>
          <FormField label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase())}</option>
              ))}
            </select>
          </FormField>

          <div className="col-span-2">
            <FormField label="Title" required>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </FormField>
          </div>

          {/* CLIENT + PROJECT */}
          <FormField label="Client" required>
            <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>

          <FormField label="Project">
            <select
              className="input"
              value={form.project_id}
              onChange={(e) => {
                const pid = e.target.value
                const proj = projects.find((p: any) => String(p.id) === pid)
                setForm((f: any) => ({
                  ...f,
                  project_id: pid,
                  ...(proj ? {
                    client_id: String(proj.client_id || f.client_id),
                    issue_date: proj.start_date?.split('T')[0] || f.issue_date,
                    valid_until: proj.deadline?.split('T')[0] || f.valid_until,
                    subtotal_amount: proj.price ?? f.subtotal_amount,
                    currency: proj.currency || f.currency,
                    scope_summary: proj.description || f.scope_summary,
                  } : {}),
                }))
              }}
            >
              <option value="">No project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </FormField>

          {/* PIC */}
          <FormField label="PIC (Contact Person)">
            <input className="input" value={form.pic} placeholder="Nama PIC"
              onChange={(e) => setForm({ ...form, pic: e.target.value })} />
          </FormField>
          <FormField label="Kontak PIC">
            <input className="input" value={form.contact_phone} placeholder="08xx-xxxx-xxxx"
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </FormField>

          {/* DATES */}
          <FormField label="Tanggal Order">
            <input className="input" type="date" value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
          </FormField>
          <FormField label="Valid Until">
            <input className="input" type="date" value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </FormField>

          <div className="col-span-2">
            <FormField label="Masa Berlaku (teks)">
              <input className="input" value={form.masa_berlaku} placeholder="s/d 14 Maret 2027"
                onChange={(e) => setForm({ ...form, masa_berlaku: e.target.value })} />
            </FormField>
          </div>

          {/* CURRENCY + SUBTOTAL */}
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="IDR">IDR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </FormField>

          <FormField label="Subtotal">
            <PriceInput value={form.subtotal_amount} onChange={(v) => setForm({ ...form, subtotal_amount: v })} />
          </FormField>

          {/* DISCOUNT + TAX */}
          <FormField label="Diskon (%)">
            <input className="input" type="number" min={0} max={100} step={0.1} value={form.discount_pct}
              onChange={(e) => setForm({ ...form, discount_pct: Number(e.target.value) })} />
          </FormField>
          <FormField label="PPN / Tax (%)">
            <input className="input" type="number" min={0} max={100} step={0.1} value={form.tax_pct}
              onChange={(e) => setForm({ ...form, tax_pct: Number(e.target.value) })} />
          </FormField>

          {/* LIVE TOTAL PREVIEW */}
          <div className="col-span-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>{fmt(subtotal, form.currency)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Diskon ({form.discount_pct}%)</span><span>− {fmt(discountAmt, form.currency)}</span>
              </div>
            )}
            {discountAmt > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Total Setelah Diskon</span><span>{fmt(afterDiscount, form.currency)}</span>
              </div>
            )}
            {taxAmt > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>PPN ({form.tax_pct}%)</span><span>{fmt(taxAmt, form.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
              <span>GRAND TOTAL</span><span>{fmt(grandTotal, form.currency)}</span>
            </div>
          </div>

          {/* TERBILANG */}
          <div className="col-span-2">
            <FormField label="Terbilang (jumlah dalam kata)">
              <input className="input" value={form.terbilang}
                placeholder="Empat Juta Sembilan Ratus Lima Puluh Ribu Rupiah"
                onChange={(e) => setForm({ ...form, terbilang: e.target.value })} />
            </FormField>
          </div>

          {/* SIGNATURES */}
          <FormField label="Prepared By">
            <input className="input" value={form.prepared_by}
              onChange={(e) => setForm({ ...form, prepared_by: e.target.value })} />
          </FormField>
          <FormField label="Jabatan Pembuat">
            <input className="input" value={form.prepared_by_title} placeholder="Lead Generation"
              onChange={(e) => setForm({ ...form, prepared_by_title: e.target.value })} />
          </FormField>

          <FormField label="Approved By">
            <input className="input" value={form.approved_by}
              onChange={(e) => setForm({ ...form, approved_by: e.target.value })} />
          </FormField>
          <FormField label="Jabatan Penyetuju">
            <input className="input" value={form.approved_by_title} placeholder="Director"
              onChange={(e) => setForm({ ...form, approved_by_title: e.target.value })} />
          </FormField>

          {/* SCOPE / NOTES */}
          <div className="col-span-2">
            <FormField label="Scope Summary">
              <textarea className="input" rows={2} value={form.scope_summary}
                onChange={(e) => setForm({ ...form, scope_summary: e.target.value })} />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Payment Terms">
              <textarea className="input" rows={2} value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Keterangan / Notes">
              <textarea className="input" rows={3} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* ADD ITEM MODAL */}
      <Modal
        open={showItemModal}
        onClose={() => setShowItemModal(false)}
        title={`Add Item — ${activeQuotation?.quote_number || ''}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveItem}>Save Item</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Product / Description" required>
              <input className="input" value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            </FormField>
          </div>
          <FormField label="QTY">
            <input className="input" type="number" min={0} value={itemForm.quantity}
              onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })} />
          </FormField>
          <FormField label="Duration (bulan)">
            <input className="input" type="number" min={1} value={itemForm.duration}
              onChange={(e) => setItemForm({ ...itemForm, duration: Number(e.target.value) })} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Harga Satuan (Unit Price)">
              <PriceInput value={itemForm.unit_price} onChange={(v) => setItemForm({ ...itemForm, unit_price: Number(v || 0) })} />
            </FormField>
          </div>
          <div className="col-span-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
            <span className="text-gray-500">Jumlah: </span>
            <span className="font-semibold">{fmt(itemForm.quantity * itemForm.unit_price)}</span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  )
}
