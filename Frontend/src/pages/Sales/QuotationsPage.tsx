import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fileService, leadService, quotationPrintService, quotationService } from '@/services/api'
import { toISODate, terbilangIDR } from '@/utils/format'
import { toast } from 'react-toastify'
import { FileDown, Plus, Printer, Upload, FileCheck, Trash2, ExternalLink } from 'lucide-react'
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
const PAGE_SIZE = 30

const fmt = (n: number, cur = 'IDR') => `${cur} ${Number(n || 0).toLocaleString('id-ID')}`

const emptyForm = () => ({
  quote_number: '',
  revision: 0,
  title: '',
  lead_id: '',
  client_id: '',
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
  approved_by_title: '',
  pic: '',
  contact_phone: '',
  terbilang: '',
  acceptance_notes: '',
  notes: '',
})

export default function QuotationsPage() {
  const [searchParams] = useSearchParams()
  const [quotations, setQuotations] = useState<any[]>([])
  const [wonLeads, setWonLeads] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '')
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)

  const [form, setForm] = useState<any>(emptyForm())
  const [localItems, setLocalItems] = useState<any[]>([])
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null)
  const emptyItemRow = () => ({ description: '', quantity: 1, unit_price: 0, duration: 12, duration_unit: 'month', total: 0 })

  // Convert to Invoice modal
  const [showConvertInvoice, setShowConvertInvoice] = useState(false)
  const [convertQuotation, setConvertQuotation] = useState<any>(null)
  const [convertForm, setConvertForm] = useState<any>({
    invoice_number: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  })

  const load = (q = search, overridePage?: number) => {
    setLoading(true)
    const params: any = { page: overridePage ?? page, limit: PAGE_SIZE }
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
    leadService.list({ limit: 200 }).then((r) => {
      const active = (r.data.data || []).filter((l: any) => ['discussion', 'negotiation'].includes(l.status))
      setWonLeads(active)
    }).catch(() => {})
  }, [])

  const genQuoteNumber = () => {
    const d = new Date()
    return `QT-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ ...emptyForm(), quote_number: genQuoteNumber() })
    setLocalItems([])
    setEditingItemIdx(null)
    setShowModal(true)
  }

  const openEdit = async (row: any) => {
    setLoadingEdit(true)
    try {
      const res = await quotationService.get(row.id)
      const detail = res.data
      setEditItem(detail)
      setForm({
        quote_number: detail.quote_number,
        revision: detail.revision ?? 0,
        title: detail.title,
        lead_id: String(detail.lead_id || ''),
        client_id: String(detail.client_id || ''),
        issue_date: detail.issue_date?.split('T')[0] || '',
        valid_until: detail.valid_until?.split('T')[0] || '',
        masa_berlaku: detail.masa_berlaku || '',
        contract_no: detail.contract_no || '',
        status: detail.status,
        currency: detail.currency,
        subtotal_amount: detail.subtotal_amount,
        discount_pct: detail.discount_pct || 0,
        tax_pct: detail.tax_pct ?? 10,
        payment_terms: detail.payment_terms || '',
        scope_summary: detail.scope_summary || '',
        prepared_by: detail.prepared_by || '',
        prepared_by_title: detail.prepared_by_title || '',
        approved_by: detail.approved_by || '',
        approved_by_title: detail.approved_by_title || 'Director',
        pic: detail.pic || '',
        contact_phone: detail.contact_phone || '',
        terbilang: detail.terbilang || '',
        acceptance_notes: detail.acceptance_notes || '',
        notes: detail.notes || '',
      })
      setLocalItems((detail.items || []).map((it: any) => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        duration: it.duration || 12,
        duration_unit: it.duration_unit || 'month',
        total: it.total,
      })))
      setEditingItemIdx(null)
      setShowModal(true)
    } catch {
      toast.error('Failed to load quotation details')
    } finally {
      setLoadingEdit(false)
    }
  }

  // Live total calculation — subtotal dari localItems
  const subtotal = localItems.reduce((s, it) => s + (Number(it.quantity) * Number(it.unit_price)), 0)
  const discountAmt = form.discount_pct ? subtotal * Number(form.discount_pct) / 100 : 0
  const afterDiscount = subtotal - discountAmt
  const taxAmt = form.tax_pct ? afterDiscount * Number(form.tax_pct) / 100 : 0
  const grandTotal = afterDiscount + taxAmt

  // Auto-fill terbilang saat grand total berubah
  useEffect(() => {
    if (grandTotal > 0 && form.currency === 'IDR') {
      setForm((f: any) => ({ ...f, terbilang: terbilangIDR(grandTotal) }))
    }
  }, [grandTotal, form.currency])

  const handleSave = async () => {
    if (!form.quote_number || !form.title || !form.lead_id) {
      toast.error('Quote number, title, dan lead wajib diisi')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        lead_id: Number(form.lead_id),
        client_id: form.client_id ? Number(form.client_id) : null,
        project_id: null,
        revision: Number(form.revision),
        subtotal_amount: subtotal,
        discount_pct: Number(form.discount_pct) || 0,
        tax_pct: Number(form.tax_pct) || 0,
        total_amount: grandTotal,
        issue_date: toISODate(form.issue_date),
        valid_until: toISODate(form.valid_until),
      }
      let qid: number
      if (editItem) {
        await quotationService.update(editItem.id, payload)
        qid = editItem.id
        // sync items sequentially so backend recalc stays deterministic
        for (const ex of editItem.items || []) {
          await quotationService.deleteItem(qid, ex.id).catch(() => {})
        }
        toast.success('Quotation updated!')
      } else {
        const res = await quotationService.create(payload)
        qid = res.data.id
        toast.success('Quotation created!')
      }
      // add all localItems sequentially so the last recalc sees the full set
      for (const it of localItems) {
        await quotationService.addItem(qid, {
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          duration: Number(it.duration),
          duration_unit: it.duration_unit,
          total: Number(it.quantity) * Number(it.unit_price),
        })
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

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fileService.upload(fd)
      const fileData = res.data
      setForm((f: any) => ({ ...f, file_url: String(fileData.id), file_name: file.name }))
      toast.success('Dokumen berhasil diupload')
    } catch { toast.error('Gagal upload dokumen') }
    finally { setUploadingDoc(false); e.target.value = '' }
  }

  const handleDocRemove = () => {
    setForm((f: any) => ({ ...f, file_url: '', file_name: '' }))
    toast.success('Dokumen dihapus dari form')
  }

  const handleDocView = async (fileId: string) => {
    if (!fileId) return
    try {
      const res = await fileService.download(Number(fileId))
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', form.file_name || 'quotation.pdf')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch { toast.error('Gagal membuka dokumen') }
  }

  const openConvertInvoice = async (quotation: any) => {
    setConvertQuotation(quotation)
    const d = new Date()
    const invNumber = `INV-${d.getFullYear()}-${String(Date.now()).slice(-4)}`
    setConvertForm({
      invoice_number: invNumber,
      bill_date: new Date().toISOString().split('T')[0],
      due_date: '',
      notes: '',
    })
    setShowConvertInvoice(true)
  }

  const handleConvertToInvoice = async () => {
    if (!convertForm.invoice_number || !convertForm.bill_date) {
      toast.error('Invoice number and bill date are required')
      return
    }
    setSaving(true)
    try {
      const subtotal = convertQuotation.subtotal_amount || 0
      const taxPct = convertQuotation.tax_pct || 0
      const taxAmount = (subtotal * taxPct) / 100
      const discountPct = convertQuotation.discount_pct || 0
      const discountAmount = (subtotal * discountPct) / 100
      const total = subtotal + taxAmount - discountAmount

      // FINANCE POLICY: Always create invoice as "not_paid"
      // Finance team must verify bank statement and record payment manually
      const payload = {
        quotation_id: convertQuotation.id,
        invoice_number: convertForm.invoice_number,
        client_id: convertQuotation.client_id,
        project_id: convertQuotation.project_id,
        bill_date: toISODate(convertForm.bill_date),
        due_date: convertForm.due_date ? toISODate(convertForm.due_date) : null,
        status: 'not_paid',  // ALWAYS not_paid - finance will verify & record payment
        currency: convertQuotation.currency,
        subtotal_amount: subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: total,
        paid_amount: 0,  // ALWAYS 0 - finance will record payment after bank verification
        due_amount: total,  // Full amount due until finance verifies payment
        notes: convertForm.notes,
      }

      await quotationService.convertToInvoice(convertQuotation.id, payload)
      toast.success('Berhasil convert to invoice!')
      setShowConvertInvoice(false)
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Gagal convert to invoice'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleConvert = async (id: number, type: 'order' | 'contract') => {
    try {
      if (type === 'order') await quotationService.convertToOrder(id)
      if (type === 'contract') await quotationService.convertToContract(id)
      toast.success(`Berhasil diconvert ke ${type}`)
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.error || `Gagal convert ke ${type}`
      toast.error(msg)
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
                  <th className="w-14">No.</th>
                  <th>Quote #</th>
                  <th>Rev</th>
                  <th>Title</th>
                  <th>Lead</th>
                  <th>PIC</th>
                  <th>Tanggal Order</th>
                  <th>Masa Berlaku</th>
                  <th>Estimated Value (IDR)</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan={11}><EmptyState message="No quotations yet." /></td>
                  </tr>
                ) : (
                  quotations.map((row, index) => (
                    <tr key={row.id}>
                      <td className="text-gray-400">{(page - 1) * PAGE_SIZE + index + 1}</td>
                      <td>
                        <button
                          className="font-medium text-blue-600 hover:underline hover:text-blue-800 text-left"
                          title="Preview PDF"
                          onClick={async () => {
                            try { await quotationPrintService.openPrint(row.id) }
                            catch { toast.error('Gagal membuka PDF') }
                          }}
                        >
                          {row.quote_number}
                        </button>
                      </td>
                      <td className="text-gray-400 text-xs">r{row.revision ?? 0}</td>
                      <td>{row.title}</td>
                      <td className="text-gray-500">{row.lead?.name || row.client?.name || '-'}</td>
                      <td className="text-gray-500 text-xs">{row.pic || '-'}</td>
                      <td>{row.issue_date ? new Date(row.issue_date).toLocaleDateString('id') : '-'}</td>
                      <td className="text-xs">{row.masa_berlaku || (row.valid_until ? new Date(row.valid_until).toLocaleDateString('id') : '-')}</td>
                      <td className="font-medium whitespace-nowrap">{fmt(row.total_amount, row.currency)}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td>
                        <div className="flex gap-1 items-center">
                          <button
                            className="btn btn-secondary text-xs py-0.5 px-2"
                            title="Print / Preview PDF"
                            onClick={async () => {
                              try { await quotationPrintService.openPrint(row.id) }
                              catch (e: any) { toast.error(e?.message || 'Failed to open print') }
                            }}
                          >
                            <Printer size={12} />
                          </button>
                          <div className="w-px h-4 bg-gray-200 mx-0.5" />
                          <button
                            className="btn btn-secondary text-xs py-0.5 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                            title="Convert → Kontrak"
                            onClick={() => handleConvert(row.id, 'contract')}
                          >
                            → CTR
                          </button>
                          <button
                            className="btn btn-secondary text-xs py-0.5 px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            title="Convert → Invoice"
                            onClick={() => openConvertInvoice(row)}
                          >
                            → INV
                          </button>
                          <div className="w-px h-4 bg-gray-200 mx-0.5" />
                          <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => void openEdit(row)} disabled={loadingEdit}>
                            {loadingEdit ? 'Loading...' : 'Edit'}
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
            <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Edit Quotation' : 'Add Quotation'}
        size="xl"
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
            <input className="input" type="number" min={0} value={form.revision}
              onChange={(e) => setForm({ ...form, revision: Number(e.target.value) })} />
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

          {/* LEAD */}
          <div className="col-span-2">
            <FormField label="Lead (Discussion / Negotiation)" required>
              <select
                className="input"
                value={form.lead_id}
                onChange={(e) => {
                  const lid = e.target.value
                  const lead = wonLeads.find((l: any) => String(l.id) === lid)
                  setForm((f: any) => ({
                    ...f,
                    lead_id: lid,
                    client_id: lead?.converted_client_id ? String(lead.converted_client_id) : '',
                    pic: lead?.primary_contact || f.pic,
                    contact_phone: lead?.phone || f.contact_phone,
                  }))
                }}
              >
                <option value="">Select lead...</option>
                {/* Tampilkan lead dari editItem jika tidak ada di wonLeads */}
                {editItem?.lead && !wonLeads.find((l: any) => l.id === editItem.lead.id) && (
                  <option key={editItem.lead.id} value={editItem.lead.id}>
                    {editItem.lead.name} — {editItem.lead.status}
                  </option>
                )}
                {wonLeads.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name} — {l.status}</option>
                ))}
              </select>
            </FormField>
          </div>

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

          {/* CURRENCY */}
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="IDR">IDR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </FormField>
          <div />

          {/* INLINE ITEM TABLE */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-600">Product / Item</label>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-8">No</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Deskripsi Produk</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500 w-20">Qty</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500 w-24">Durasi</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 w-36">Harga Satuan</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 w-32">Total</th>
                    <th className="w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {localItems.map((it, idx) => (
                    editingItemIdx === idx ? (
                      <tr key={idx} className="bg-blue-50 border-t border-blue-100">
                        <td className="px-3 py-1.5 text-gray-400">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <textarea className="input text-xs py-1 resize-none" rows={3} value={it.description}
                            onChange={e => setLocalItems(prev => prev.map((r,i) => i===idx ? {...r, description: e.target.value} : r))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="input text-xs py-1.5 text-center w-full" type="number" min={1} value={it.quantity}
                            onChange={e => setLocalItems(prev => prev.map((r,i) => i===idx ? {...r, quantity: Number(e.target.value), total: Number(e.target.value)*r.unit_price} : r))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="input text-xs py-1 text-center" type="number" min={0} value={it.duration}
                            onChange={e => setLocalItems(prev => prev.map((r,i) => i===idx ? {...r, duration: Number(e.target.value)} : r))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <PriceInput value={it.unit_price} onChange={v => setLocalItems(prev => prev.map((r,i) => i===idx ? {...r, unit_price: Number(v), total: r.quantity*Number(v)} : r))} />
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-700">{fmt(it.quantity * it.unit_price, form.currency)}</td>
                        <td className="px-2 py-1.5">
                          <button className="btn btn-primary btn-sm text-xs px-2 py-1" onClick={() => setEditingItemIdx(null)}>✓</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setEditingItemIdx(idx)}>
                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2 text-gray-800">{it.description || <span className="text-gray-400 italic">—</span>}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{it.quantity}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{it.duration} bln</td>
                        <td className="px-3 py-2 text-right text-gray-600">{fmt(it.unit_price, form.currency)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(it.quantity * it.unit_price, form.currency)}</td>
                        <td className="px-2 py-2">
                          <button className="text-red-400 hover:text-red-600 px-1"
                            onClick={e => { e.stopPropagation(); setLocalItems(prev => prev.filter((_,i) => i !== idx)); if (editingItemIdx === idx) setEditingItemIdx(null) }}>×</button>
                        </td>
                      </tr>
                    )
                  ))}
                  <tr className="border-t border-dashed border-gray-200">
                    <td colSpan={7} className="px-3 py-2">
                      <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() => { setLocalItems(prev => [...prev, emptyItemRow()]); setEditingItemIdx(localItems.length) }}>
                        <span className="text-base leading-none">+</span> Add Item
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* DISCOUNT + TAX + TOTAL */}
          <div className="col-span-2 grid grid-cols-3 gap-3">
            <FormField label="Diskon (%)">
              <input className="input" type="number" min={0} max={100} step={0.1} value={form.discount_pct}
                onChange={(e) => setForm({ ...form, discount_pct: Number(e.target.value) })} />
            </FormField>
            <FormField label="PPN / Tax (%)">
              <input className="input" type="number" min={0} max={100} step={0.1} value={form.tax_pct}
                onChange={(e) => setForm({ ...form, tax_pct: Number(e.target.value) })} />
            </FormField>
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs space-y-1 self-end mb-0">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(subtotal, form.currency)}</span></div>
              {discountAmt > 0 && <div className="flex justify-between text-gray-500"><span>Diskon</span><span>− {fmt(discountAmt, form.currency)}</span></div>}
              {taxAmt > 0 && <div className="flex justify-between text-gray-500"><span>PPN {form.tax_pct}%</span><span>{fmt(taxAmt, form.currency)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-300"><span>GRAND TOTAL</span><span>{fmt(grandTotal, form.currency)}</span></div>
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

          {/* UPLOAD DOKUMEN QUOTATION */}
          <div className="col-span-2 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <FileCheck size={14} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-600">Dokumen Quotation (TTD & Cap)</h3>
            </div>

            {form.file_url ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <FileCheck size={16} className="text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700">{form.file_name || 'Quotation Document'}</p>
                    <p className="text-xs text-green-500">Dokumen sudah diupload</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleDocView(form.file_url)}
                    className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1">
                    <ExternalLink size={11} /> Download
                  </button>
                  <button type="button" onClick={handleDocRemove} className="btn btn-danger text-xs py-1 px-2.5 flex items-center gap-1">
                    <Trash2 size={11} /> Hapus
                  </button>
                </div>
              </div>
            ) : (
              <label className="block">
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleDocUpload} disabled={uploadingDoc} />
                <div className="border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                  <Upload size={20} className="mx-auto text-gray-400 mb-1" />
                  <p className="text-xs text-gray-500">
                    {uploadingDoc ? 'Uploading...' : 'Upload dokumen quotation yang sudah ditandatangani & cap'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX (max 10MB)</p>
                </div>
              </label>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Convert to Invoice */}
      <Modal
        open={showConvertInvoice}
        onClose={() => setShowConvertInvoice(false)}
        title="Convert to Invoice"
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowConvertInvoice(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleConvertToInvoice} disabled={saving}>
              {saving ? 'Converting...' : 'Send to Invoice'}
            </button>
          </>
        }
      >
        {convertQuotation && (() => {
          const subtotal = convertQuotation.subtotal_amount || 0
          const taxPct = convertQuotation.tax_pct || 0
          const taxAmount = (subtotal * taxPct) / 100
          const discountPct = convertQuotation.discount_pct || 0
          const discountAmount = (subtotal * discountPct) / 100
          const total = subtotal + taxAmount - discountAmount
          const paidPct = convertForm.payment_method === 'fully_paid' ? 100 : Number(convertForm.paid_pct || 0)
          const paidAmount = (total * paidPct) / 100
          const dueAmount = total - paidAmount

          return (
            <div className="space-y-4">
              {/* Invoice Options Helper */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Invoice Options</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-700 font-medium min-w-[140px]">Full Invoice (100%):</span>
                        <div className="text-blue-600">
                          <div>→ Use this "Convert to Invoice" ✅</div>
                          <div className="text-xs text-blue-500 mt-0.5">Items will be copied from quotation</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 pt-1 border-t border-blue-200">
                        <span className="text-blue-700 font-medium min-w-[140px]">TERM-based:</span>
                        <div className="text-blue-600">
                          <div>→ Go to <strong>Finance → Invoices → Add Invoice</strong></div>
                          <div className="text-xs text-blue-500 mt-0.5">Use percentage field for each TERM (30%, 50%, 20%)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Finance Policy Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-800 mb-1">Finance Policy</h4>
                    <p className="text-sm text-amber-700">
                      Invoice akan dibuat dengan status <strong>"Not Paid"</strong>.
                      Finance team harus verify bank statement dan record payment secara manual untuk audit trail yang proper.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Invoice Number" required>
                  <input
                    className="input"
                    value={convertForm.invoice_number}
                    onChange={(e) => setConvertForm({ ...convertForm, invoice_number: e.target.value })}
                  />
                </FormField>
                <FormField label="Client">
                  <input
                    className="input bg-gray-50"
                    value={convertQuotation.client?.name || convertQuotation.lead?.name || '-'}
                    disabled
                  />
                </FormField>
                <FormField label="Project">
                  <input
                    className="input bg-gray-50"
                    value={convertQuotation.project?.title || convertQuotation.title || '-'}
                    disabled
                  />
                </FormField>
                <FormField label="Bill Date" required>
                  <input
                    type="date"
                    className="input"
                    value={convertForm.bill_date}
                    onChange={(e) => setConvertForm({ ...convertForm, bill_date: e.target.value })}
                  />
                </FormField>
                <FormField label="Due Date">
                  <input
                    type="date"
                    className="input"
                    value={convertForm.due_date}
                    onChange={(e) => setConvertForm({ ...convertForm, due_date: e.target.value })}
                  />
                </FormField>
              </div>

              {/* Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3 text-sm">Invoice Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{fmt(subtotal, convertQuotation.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PPN / Tax ({taxPct}%):</span>
                    <span className="font-medium">{fmt(taxAmount, convertQuotation.currency)}</span>
                  </div>
                  {discountPct > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount ({discountPct}%):</span>
                      <span className="font-medium">-{fmt(discountAmount, convertQuotation.currency)}</span>
                    </div>
                  )}
                  <div className="border-t border-blue-300 pt-2 flex justify-between">
                    <span className="font-semibold text-blue-900">Total Invoice:</span>
                    <span className="font-bold text-blue-900">{fmt(total, convertQuotation.currency)}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Paid ({paidPct}%):</span>
                    <span className="font-semibold">{fmt(paidAmount, convertQuotation.currency)}</span>
                  </div>
                  <div className="flex justify-between text-orange-700">
                    <span>Due:</span>
                    <span className="font-semibold">{fmt(dueAmount, convertQuotation.currency)}</span>
                  </div>
                </div>
              </div>

              <FormField label="Notes">
                <textarea
                  className="input"
                  rows={2}
                  value={convertForm.notes}
                  onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
                  placeholder="Catatan untuk invoice ini..."
                />
              </FormField>
            </div>
          )
        })()}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  )
}
