import { useEffect, useState } from 'react'
import { invoiceService, clientService, projectService, invoicePDFService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { ManageLabelsModal } from '@/components/common/ManageLabelsModal'
import { toast } from 'react-toastify'
import { Plus, Filter, FileDown, Printer, CreditCard, Edit } from 'lucide-react'
import {
  PageHeader, Toolbar, SearchInput, Pagination,
  StatusBadge, Modal, FormField, ConfirmDialog, Loading, EmptyState, PriceInput
} from '@/components/common'

const STATUSES = ['draft', 'not_paid', 'partially_paid', 'fully_paid', 'overdue']
const PAGE_SIZE = 30

const getInvoiceSubtotal = (invoice: any) => {
  const fallback = Number(invoice?.total_amount || 0)
    + Number(invoice?.discount_amount || 0)
    + (invoice?.tax_type === 'pph' ? Number(invoice?.tax_amount || 0) : 0)
    - (invoice?.tax_type === 'ppn' || !invoice?.tax_type ? Number(invoice?.tax_amount || 0) : 0)
  const subtotal = Number(invoice?.subtotal_amount ?? fallback)
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
  const [payInvoice, setPayInvoice] = useState<any>(null)
  const [payForm, setPayForm] = useState<any>({ amount: '', payment_method: 'transfer', payment_date: '', note: '' })
  const [paying, setPaying] = useState(false)
  const [form, setForm] = useState<any>({
    invoice_number: '', client_id: '', project_id: '', parent_invoice_id: '', bill_date: '', due_date: '',
    status: 'draft', currency: 'IDR', subtotal_amount: '', percentage: '', tax_type: 'ppn', tax_pct: 11, discount_amount: '', notes: '',
  })

  // Create Remaining Invoice
  const [showCreateRemaining, setShowCreateRemaining] = useState(false)
  const [sourceInvoice, setSourceInvoice] = useState<any>(null)
  const [remainingPct, setRemainingPct] = useState(100)
  const [remainingNote, setRemainingNote] = useState('')

  const load = (q = search, overridePage?: number) => {
    setLoading(true)
    const params: any = { page: overridePage ?? page, limit: PAGE_SIZE }
    if (statusFilter) params.status = statusFilter
    if (q) params.q = q
    invoiceService.list(params)
      .then(r => { setInvoices(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(() => toast.error('Failed to load invoices'))
      .finally(() => setLoading(false))
  }

  const handleExportExcel = () => {
    // Export semua invoices ke CSV
    const headers = ['Invoice Number', 'Client', 'Project', 'Bill Date', 'Due Date', 'Subtotal', 'Tax', 'Total', 'Paid', 'Due', 'Status']
    const rows = invoices.map(inv => [
      inv.invoice_number || '-',
      inv.client?.name || '-',
      inv.project?.title || '-',
      inv.bill_date ? new Date(inv.bill_date).toLocaleDateString('id-ID') : '-',
      inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '-',
      getInvoiceSubtotal(inv),
      inv.tax_amount || 0,
      inv.total_amount || 0,
      inv.paid_amount || 0,
      inv.due_amount || 0,
      inv.status || 'draft'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Invoices_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('Invoices exported to CSV!')
  }

  const handlePrint = () => {
    // Delay sebentar agar React selesai render
    setTimeout(() => {
      window.print()
    }, 100)
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
      invoice_number: genInvoiceNumber(), client_id: '', project_id: '', parent_invoice_id: '', bill_date: '', due_date: '',
      status: 'draft', currency: 'IDR', subtotal_amount: '', percentage: '', tax_type: 'ppn', tax_pct: 11, discount_amount: '0', notes: '',
    })
    setShowModal(true)
  }

  const openEdit = (inv: any) => {
    setEditItem(inv)
    const subtotal = getInvoiceSubtotal(inv)
    const taxPct = subtotal > 0 ? ((inv.tax_amount || 0) / subtotal) * 100 : 11
    setForm({
      invoice_number: inv.invoice_number,
      client_id: String(inv.client_id || ''),
      project_id: String(inv.project_id || ''),
      parent_invoice_id: String(inv.parent_invoice_id || ''),
      bill_date: inv.bill_date?.split('T')[0] || '',
      due_date: inv.due_date?.split('T')[0] || '',
      status: inv.status,
      currency: inv.currency,
      tax_type: inv.tax_type || 'ppn',
      subtotal_amount: subtotal,
      percentage: '', // Don't pre-fill percentage in edit mode
      tax_pct: Number(taxPct.toFixed(2)),
      discount_amount: inv.discount_amount,
      notes: inv.notes || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.invoice_number || !form.client_id) { toast.error('Invoice number and client are required'); return }
    setSaving(true)
    try {
      const subtotalAmount = Number(form.subtotal_amount) || 0
      const discountAmount = Number(form.discount_amount) || 0
      const baseAmount = subtotalAmount - discountAmount
      const taxType = String(form.tax_type || 'ppn')
      const taxPct = Number(form.tax_pct) || 0
      const taxAmount = taxType === 'none' ? 0 : (subtotalAmount * taxPct) / 100
      const totalAmount = taxType === 'pph'
        ? Math.max(baseAmount - taxAmount, 0)
        : taxType === 'none'
          ? Math.max(baseAmount, 0)
          : Math.max(baseAmount + taxAmount, 0)
      const payload = {
        ...form,
        client_id: Number(form.client_id),
        project_id: form.project_id ? Number(form.project_id) : null,
        parent_invoice_id: form.parent_invoice_id ? Number(form.parent_invoice_id) : null,
        tax_type: taxType,
        subtotal_amount: subtotalAmount,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
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
      setPage(1)
      load(search, 1)
    } catch { toast.error(editItem ? 'Failed to update invoice' : 'Failed to create invoice') }
    finally { setSaving(false) }
  }

  const openMarkAsPaid = (inv: any) => {
    setPayInvoice(inv)

    // Logic berbeda untuk 2 jenis partially paid:
    // 1. Partially Paid dari CONVERT quotation → paid_amount sudah di-set, amount = paid_amount
    // 2. Not Paid dari CREATE REMAINING → akan dibayar bertahap, amount = due_amount
    let defaultAmount = 0

    if (inv.status === 'partially_paid' && inv.paid_amount > 0 && inv.paid_amount === inv.total_amount - inv.due_amount) {
      // Skenario A: Invoice partially paid DARI CONVERT (paid_amount sudah di-set saat convert)
      // Amount = paid_amount (nilai yang ditentukan saat convert, untuk record ke tabel payments)
      defaultAmount = inv.paid_amount
    } else {
      // Skenario B: Invoice not_paid atau partially_paid dari cicilan bertahap
      // Amount = due_amount (sisa yang harus dibayar, bisa diedit untuk cicilan)
      defaultAmount = inv.due_amount || inv.total_amount
    }

    setPayForm({
      amount: defaultAmount,
      payment_method: 'transfer',
      payment_date: new Date().toISOString().split('T')[0],
      note: '',
    })
  }

  const handleMarkAsPaid = async () => {
    if (!payInvoice) return
    if (!payForm.amount || Number(payForm.amount) <= 0) { toast.error('Amount is required'); return }
    setPaying(true)
    try {
      await invoiceService.addPayment(payInvoice.id, {
        amount: Number(payForm.amount),
        payment_method: payForm.payment_method,
        payment_date: toISODate(payForm.payment_date),
        note: payForm.note,
        currency: payInvoice.currency,
      })
      toast.success('Payment recorded!')
      setPayInvoice(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to record payment')
    } finally { setPaying(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await invoiceService.delete(deleteId)
      toast.success('Invoice deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  const openCreateRemaining = (inv: any) => {
    if (inv.status !== 'partially_paid' || !inv.due_amount || inv.due_amount <= 0) {
      toast.error('Invoice harus partially paid dan punya sisa tagihan')
      return
    }
    setSourceInvoice(inv)
    // Calculate default percentage from remaining due amount
    const defaultPct = inv.total_amount > 0 ? Math.round((inv.due_amount / inv.total_amount) * 100) : 100
    setRemainingPct(defaultPct)
    setRemainingNote('')
    setShowCreateRemaining(true)
  }

  const handleCreateRemainingInvoice = async () => {
    if (!sourceInvoice) return
    if (remainingPct <= 0 || remainingPct > 100) {
      toast.error('Persentase harus antara 1-100%')
      return
    }

    // Calculate amount from percentage of ORIGINAL TOTAL
    const calculatedAmount = (sourceInvoice.total_amount * remainingPct) / 100

    // Validate: amount tidak boleh lebih dari due amount
    if (calculatedAmount > sourceInvoice.due_amount) {
      toast.error(`Amount (${fmt(calculatedAmount, sourceInvoice.currency)}) melebihi sisa tagihan (${fmt(sourceInvoice.due_amount, sourceInvoice.currency)})`)
      return
    }

    setSaving(true)
    try {
      const d = new Date()
      const newInvoiceNumber = `INV-${d.getFullYear()}-${String(Date.now()).slice(-4)}`

      // Logic: Invoice termin dibuat sebagai tagihan BARU yang belum dibayar
      // User akan Record Payment untuk bayar invoice ini
      const payload = {
        invoice_number: newInvoiceNumber,
        client_id: sourceInvoice.client_id,
        project_id: sourceInvoice.project_id,
        parent_invoice_id: sourceInvoice.id,
        bill_date: toISODate(new Date().toISOString().split('T')[0]),
        due_date: sourceInvoice.due_date,
        status: 'not_paid',
        currency: sourceInvoice.currency,
        tax_type: sourceInvoice.tax_type || 'ppn',
        subtotal_amount: calculatedAmount,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: calculatedAmount,
        paid_amount: 0,              // Belum dibayar
        due_amount: calculatedAmount, // Sama dengan total
        notes: remainingNote,
      }
      await invoiceService.create(payload)
      toast.success(`Invoice ${newInvoiceNumber} berhasil dibuat!`)
      setShowCreateRemaining(false)
      setPage(1)
      load(search, 1)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number, cur = 'IDR') => `${cur} ${Number(n || 0).toLocaleString('id-ID')}`
  const subtotalAmount = Number(form.subtotal_amount) || 0
  const taxType = String(form.tax_type || 'ppn')
  const taxPct = Number(form.tax_pct) || 0
  const taxAmount = taxType === 'none' ? 0 : (subtotalAmount * taxPct) / 100
  const discountAmount = Number(form.discount_amount) || 0
  const baseAmount = subtotalAmount - discountAmount
  const computedTotal = taxType === 'pph'
    ? Math.max(baseAmount - taxAmount, 0)
    : taxType === 'none'
      ? Math.max(baseAmount, 0)
      : Math.max(baseAmount + taxAmount, 0)

  return (
    <>
      <style>{`
        @media print {
          /* Simple approach - just show what we need */
          @page {
            margin: 1.5cm;
            size: landscape;
          }

          /* Hide navigation and non-essential elements */
          .no-print,
          nav,
          aside,
          button,
          .sidebar {
            display: none !important;
          }

          /* Show print header */
          .print-header {
            display: block !important;
          }

          /* Clean body */
          body {
            margin: 0;
            padding: 0;
          }

          /* Make table visible and full width */
          table {
            width: 100% !important;
            border-collapse: collapse;
          }

          th, td {
            padding: 6px 8px;
            border: 1px solid #ccc;
            font-size: 11px;
          }

          th {
            background: #f0f0f0 !important;
            font-weight: bold;
          }
        }

        .print-header {
          display: none;
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #333;
        }
        .print-header h1 {
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 5px 0;
        }
        .print-header p {
          font-size: 11px;
          color: #666;
          margin: 3px 0;
        }
      `}</style>
      <div className="p-5">
        <div className="print-header">
          <h1>Invoice List</h1>
          <p>PT Archie TECH • Printed on {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <PageHeader
        title="Invoices"
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={handleExportExcel}
              disabled={invoices.length === 0}
              title="Export to Excel (CSV)"
            >
              <FileDown size={12} /> Export
            </button>
            <button className="btn btn-secondary" onClick={() => setShowManageLabels(true)}><Filter size={12} /> Manage labels</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add invoice</button>
          </>
        }
      />

      <div className="no-print">
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
              <button
                className="btn btn-secondary"
                onClick={handlePrint}
                title="Print invoices list"
              >
                <Printer size={12} />Print
              </button>
              <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Invoice #, client..." />
            </>
          }
        />
      </div>

      <div className="table-container">
        {loading ? <Loading /> : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th className="w-14">No.</th>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Bill Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0
                  ? <tr><td colSpan={11}><EmptyState /></td></tr>
                  : invoices.map((inv, index) => (
                    <tr key={inv.id}>
                      <td className="text-gray-400">{(page - 1) * PAGE_SIZE + index + 1}</td>
                      <td className="font-medium text-blue-600">{inv.invoice_number}</td>
                      <td className="text-gray-500">{inv.client?.name || '-'}</td>
                      <td className="text-gray-400 whitespace-nowrap">{inv.bill_date ? new Date(inv.bill_date).toLocaleDateString('id') : '-'}</td>
                      <td className={`whitespace-nowrap ${new Date(inv.due_date) < new Date() && inv.status !== 'fully_paid' ? 'text-red-500' : 'text-gray-400'}`}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('id') : '-'}
                      </td>
                      <td className="whitespace-nowrap font-medium">{fmt(inv.total_amount, inv.currency)}</td>
                      <td className="whitespace-nowrap text-green-600">{fmt(inv.paid_amount, inv.currency)}</td>
                      <td className="whitespace-nowrap">
                        {inv.status === 'partially_paid' && inv.due_amount > 0 ? (
                          <button
                            onClick={() => openCreateRemaining(inv)}
                            className="text-red-600 hover:text-red-800 font-medium hover:underline transition-all"
                            title="Klik untuk buat invoice sisa tagihan"
                          >
                            {fmt(inv.due_amount, inv.currency)}
                          </button>
                        ) : (
                          <span className="text-red-500">{fmt(inv.due_amount, inv.currency)}</span>
                        )}
                      </td>
                      <td className="text-xs text-gray-500 max-w-xs truncate" title={inv.notes || '-'}>
                        {inv.notes || '-'}
                      </td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td className="no-print">
                        <div className="flex gap-1">
                          <button
                            title="Export PDF"
                            className="btn btn-secondary text-xs py-0.5 px-2"
                            onClick={() => invoicePDFService.openPDF(inv.id)}
                          >
                            <Printer size={12} />
                          </button>
                          {inv.status !== 'fully_paid' && inv.status !== 'draft' && (
                            <button
                              title="Record Payment"
                              className="btn btn-success text-xs py-0.5 px-2"
                              onClick={() => openMarkAsPaid(inv)}
                            ><CreditCard size={12} /></button>
                          )}
                          <button
                            className="btn btn-secondary text-xs py-0.5 px-2"
                            onClick={() => openEdit(inv)}
                            title="Edit Invoice"
                          >
                            <Edit size={12} />
                          </button>
                          <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(inv.id)}>×</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
            <div className="no-print">
              <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />
            </div>
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
          <FormField label="Status" hint={editItem ? 'Can be changed manually, but normally auto-updated from payments' : 'Initial status for new invoice'}>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="not_paid">Not Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </FormField>
          <FormField label="Client" required hint={editItem ? 'Cannot change client in edit mode' : undefined}>
            {editItem ? (
              <input
                className="input bg-gray-50"
                value={clients.find((c: any) => c.id === editItem.client_id)?.name || 'Unknown Client'}
                disabled
              />
            ) : (
              <select className="input" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </FormField>
          {!editItem && (
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
          )}
          <FormField
            label="Parent Invoice (Optional)"
            hint="Link payment to another invoice (e.g., TERM 2/3 linked to TERM 1)"
          >
            <select
              className="input"
              value={form.parent_invoice_id}
              onChange={e => setForm({ ...form, parent_invoice_id: e.target.value })}
            >
              <option value="">No parent invoice</option>
              {invoices
                .filter((inv: any) => !editItem || inv.id !== editItem.id)
                .map((inv: any) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} - {inv.client?.name} ({inv.status})
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="Bill Date" hint={!editItem && form.project_id ? 'Auto-filled from project start date' : undefined}>
            <input className="input" type="date" value={form.bill_date} onChange={e => setForm({ ...form, bill_date: e.target.value })} />
          </FormField>
          <FormField label="Due Date" hint={!editItem && form.project_id ? 'Auto-filled from project deadline' : undefined}>
            <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </FormField>
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="IDR">IDR</option><option value="USD">USD</option><option value="EUR">EUR</option>
            </select>
          </FormField>
          {!editItem && form.project_id && (
            <FormField
              label="Percentage of Project (%)"
              hint={form.percentage ? `${form.percentage}% dari project price → auto-calculate subtotal` : 'Contoh: 30 untuk TERM 1 (30%), 50 untuk TERM 2 (50%)'}
            >
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                step={1}
                placeholder="30"
                value={form.percentage}
                onChange={(e) => {
                  const pct = Number(e.target.value) || 0
                  const proj = projects.find((p: any) => String(p.id) === form.project_id)
                  const projectPrice = proj?.price || 0
                  const calculatedSubtotal = pct > 0 ? (projectPrice * pct) / 100 : ''
                  setForm({
                    ...form,
                    percentage: e.target.value,
                    subtotal_amount: calculatedSubtotal
                  })
                }}
              />
            </FormField>
          )}
          <FormField label="Subtotal" hint={!editItem && form.project_id && form.percentage ? `Auto-calculated: ${form.percentage}% × ${fmt(projects.find((p: any) => String(p.id) === form.project_id)?.price || 0, form.currency)}` : (!editItem && form.project_id ? 'Auto-filled from project price' : undefined)}>
            <PriceInput value={form.subtotal_amount} onChange={v => setForm({ ...form, subtotal_amount: v })} />
          </FormField>
          <FormField label="Jenis Pajak">
            <select className="input" value={form.tax_type} onChange={e => setForm({ ...form, tax_type: e.target.value })}>
              <option value="ppn">PPN</option>
              <option value="pph">PPH</option>
              <option value="none">None</option>
            </select>
          </FormField>
          <FormField label={`${taxType === 'pph' ? 'PPH' : taxType === 'none' ? 'Pajak' : 'PPN'} (%)`} hint={`Tax amount: ${taxType === 'pph' ? '-' : ''}${fmt(taxAmount, form.currency)}`}>
            <input className="input" type="number" min={0} max={100} step={0.1} value={form.tax_pct}
              onChange={(e) => setForm({ ...form, tax_pct: Number(e.target.value) })} />
          </FormField>
          <FormField label="Discount Amount">
            <PriceInput value={form.discount_amount} onChange={v => setForm({ ...form, discount_amount: v })} />
          </FormField>
          <div className="col-span-2">
            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-blue-600 mb-1">Total Invoice</p>
                  <p className="font-bold text-blue-900">{fmt(computedTotal, form.currency)}</p>
                </div>
                {editItem && (
                  <>
                    <div>
                      <p className="text-xs text-green-600 mb-1">Paid</p>
                      <p className="font-bold text-green-900">{fmt(editItem.paid_amount || 0, form.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-orange-600 mb-1">Due</p>
                      <p className="font-bold text-orange-900">{fmt(editItem.due_amount || 0, form.currency)}</p>
                    </div>
                  </>
                )}
              </div>
              {editItem && (editItem.status === 'not_paid' || editItem.status === 'partially_paid') && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-600 text-center">💡 Gunakan tombol <strong>"Record Payment"</strong> di tabel untuk input cicilan/tagihan berikutnya</p>
                </div>
              )}
            </div>
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

      <Modal
        open={!!payInvoice}
        onClose={() => setPayInvoice(null)}
        title="Record Payment"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPayInvoice(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleMarkAsPaid} disabled={paying}>{paying ? 'Saving...' : 'Record Payment'}</button>
          </>
        }
      >
        {payInvoice && (
          <div className="space-y-3">
            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-3">
              <div className="font-semibold text-blue-900 mb-2">{payInvoice.invoice_number}</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-blue-600">Total:</span>
                  <div className="font-semibold text-blue-900">{fmt(payInvoice.total_amount, payInvoice.currency)}</div>
                </div>
                <div>
                  <span className="text-green-600">Paid:</span>
                  <div className="font-semibold text-green-900">{fmt(payInvoice.paid_amount || 0, payInvoice.currency)}</div>
                </div>
                <div>
                  <span className="text-orange-600">Due:</span>
                  <div className="font-semibold text-orange-900">{fmt(payInvoice.due_amount, payInvoice.currency)}</div>
                </div>
              </div>
            </div>
            <FormField
              label="Amount"
              required
              hint={
                payInvoice.status === 'partially_paid' && payInvoice.paid_amount > 0
                  ? 'Pre-filled dengan nilai Paid (untuk record ke payment module)'
                  : 'Pre-filled dengan Due amount (bisa diedit untuk cicilan)'
              }
            >
              <PriceInput value={payForm.amount} onChange={(v: any) => setPayForm({ ...payForm, amount: v })} />
            </FormField>
            <FormField label="Payment Method">
              <select className="input" value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                <option value="transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="credit_card">Credit Card</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            <FormField label="Payment Date">
              <input className="input" type="date" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} />
            </FormField>
            <FormField label="Note">
              <input className="input" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} placeholder="Optional note..." />
            </FormField>
          </div>
        )}
      </Modal>

      {/* Modal Create Remaining Invoice */}
      <Modal
        open={showCreateRemaining}
        onClose={() => setShowCreateRemaining(false)}
        title="Create Invoice for Remaining Amount"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreateRemaining(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateRemainingInvoice} disabled={saving}>
              {saving ? 'Creating...' : 'Create Invoice'}
            </button>
          </>
        }
      >
        {sourceInvoice && (() => {
          const calculatedAmount = (sourceInvoice.total_amount * remainingPct) / 100
          const exceedsRemaining = calculatedAmount > sourceInvoice.due_amount

          return (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Source Invoice</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Invoice Number:</span>
                    <span className="font-medium text-blue-900">{sourceInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Client:</span>
                    <span className="font-medium text-blue-900">{sourceInvoice.client?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Project:</span>
                    <span className="font-medium text-blue-900">{sourceInvoice.project?.title || '-'}</span>
                  </div>
                  <div className="flex justify-between border-t border-blue-300 pt-2 mt-2">
                    <span className="text-blue-700 font-medium">Original Total:</span>
                    <span className="font-bold text-blue-900">{fmt(sourceInvoice.total_amount, sourceInvoice.currency)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-3">Persentase untuk Invoice Baru</h4>
                <FormField
                  label="Persentase (%)"
                  hint={`Dari Total Original (${fmt(sourceInvoice.total_amount, sourceInvoice.currency)})`}
                >
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    className="input"
                    value={remainingPct}
                    onChange={(e) => setRemainingPct(Number(e.target.value))}
                  />
                </FormField>

                <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Amount yang akan dibuat:</span>
                    <span className={`text-lg font-bold ${exceedsRemaining ? 'text-red-600' : 'text-purple-900'}`}>
                      {fmt(calculatedAmount, sourceInvoice.currency)}
                    </span>
                  </div>
                  {exceedsRemaining && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      ⚠️ Amount melebihi sisa tagihan ({fmt(sourceInvoice.due_amount, sourceInvoice.currency)})
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-900 mb-3">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Original Total:</span>
                    <span className="font-medium">{fmt(sourceInvoice.total_amount, sourceInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Already Paid/Invoiced:</span>
                    <span className="font-medium">-{fmt(sourceInvoice.paid_amount, sourceInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-purple-700">
                    <span>This Invoice ({remainingPct}%):</span>
                    <span className="font-medium">-{fmt(calculatedAmount, sourceInvoice.currency)}</span>
                  </div>
                  <div className="border-t border-orange-300 pt-2 flex justify-between">
                    <span className="font-semibold text-orange-900">Remaining After:</span>
                    <span className="font-bold text-orange-900">
                      {fmt(Math.max(sourceInvoice.due_amount - calculatedAmount, 0), sourceInvoice.currency)}
                    </span>
                  </div>
                </div>
              </div>

              <FormField label="Notes">
                <textarea
                  className="input"
                  rows={2}
                  value={remainingNote}
                  onChange={(e) => setRemainingNote(e.target.value)}
                  placeholder="Catatan untuk invoice ini..."
                />
              </FormField>
            </div>
          )
        })()}
      </Modal>
      </div>
    </>
  )
}
