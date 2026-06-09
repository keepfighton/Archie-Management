import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { contractService, expenseService, invoiceService, projectService, fileService } from '@/services/api'
import { toast } from 'react-toastify'
import {
  ArrowLeft, Building2, Calendar, DollarSign, FileText,
  Phone, MapPin, Mail, Receipt, TrendingUp, CheckCircle2,
  Clock, AlertCircle, Edit2, ExternalLink, FolderKanban,
  Upload, FileCheck, Trash2
} from 'lucide-react'
import { StatusBadge, Loading } from '@/components/common'

const fmt = (n: number, cur = 'IDR') => `${cur} ${Number(n || 0).toLocaleString('id-ID')}`
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'
const progressWidth = (value: unknown) => `${Math.min(Math.max(Number(value) || 0, 0), 100)}%`

const CONTRACT_STATUSES = ['draft', 'active', 'completed', 'cancelled']
const STATUS_COLOR: Record<string, string> = {
  draft: 'text-gray-500 bg-gray-100',
  active: 'text-green-700 bg-green-100',
  completed: 'text-blue-700 bg-blue-100',
  cancelled: 'text-red-700 bg-red-100',
}

export default function ContractDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingStatus, setEditingStatus] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)

  const load = () => {
    if (!id) return
    Promise.all([
      contractService.get(Number(id)),
      expenseService.list({ limit: 999 }),
      invoiceService.list({ limit: 999 }),
      projectService.list({ contract_id: id, limit: 100 }),
    ])
      .then(([cRes, eRes, iRes, pRes]) => {
        const c = cRes.data
        const linkedProjects = pRes.data.data || []
        const projectIds = linkedProjects.map((p: any) => p.id)

        setContract(c)
        setExpenses((eRes.data.data || []).filter((e: any) => e.contract_id === Number(id)))

        // Filter invoice:
        // 1. Prioritas: Invoice yang punya project_id yang linked ke contract
        // 2. Fallback: Invoice yang client_id sama dengan contract (untuk invoice tanpa project)
        const allInvoices = iRes.data.data || []
        const filteredInvoices = allInvoices.filter((inv: any) => {
          // Filter by project_id jika ada
          if (inv.project_id && projectIds.includes(inv.project_id)) {
            return true
          }
          // Fallback: filter by client_id (untuk invoice tanpa project atau quotation convert)
          if (!inv.project_id && inv.client_id === c.client_id) {
            return true
          }
          return false
        })

        setInvoices(filteredInvoices)
        setProjects(linkedProjects)

      })
      .catch(() => toast.error('Failed to load contract'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleStatusChange = async (status: string) => {
    setSavingStatus(true)
    try {
      await contractService.update(Number(id), { ...contract, status })
      setContract((c: any) => ({ ...c, status }))
      setEditingStatus(false)
      toast.success('Status updated')
    } catch { toast.error('Failed to update status') }
    finally { setSavingStatus(false) }
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
      // Simpan file ID saja, bukan full URL
      await contractService.update(Number(id), { ...contract, file_url: String(fileData.id), file_name: file.name })
      setContract((c: any) => ({ ...c, file_url: String(fileData.id), file_name: file.name }))
      toast.success('Dokumen berhasil diupload')
    } catch { toast.error('Gagal upload dokumen') }
    finally { setUploadingDoc(false); e.target.value = '' }
  }

  const handleDocView = async () => {
    if (!contract.file_url) return
    try {
      const res = await fileService.download(Number(contract.file_url))
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', contract.file_name || 'contract.pdf')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch { toast.error('Gagal membuka dokumen') }
  }

  const handleDocRemove = async () => {
    if (!window.confirm('Hapus dokumen kontrak?')) return
    try {
      await contractService.update(Number(id), { ...contract, file_url: '', file_name: '' })
      setContract((c: any) => ({ ...c, file_url: '', file_name: '' }))
      toast.success('Dokumen dihapus')
    } catch { toast.error('Gagal menghapus dokumen') }
  }

  if (loading) return <div className="p-5"><Loading /></div>
  if (!contract) return <div className="p-5 text-gray-400">Contract not found.</div>

  const totalExpenses = expenses.reduce((s, e) => s + (e.total || 0), 0)
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_amount || 0), 0)
  const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0)
  const contractValue = Number(contract.amount) || 0

  // Outstanding = what still needs to be paid from contract value
  const outstanding = Math.max(contractValue - totalPaid, 0)

  // All percentages based on contract value (reference amount that must be paid)
  const invoicedPct = contractValue > 0 ? Math.min((totalInvoiced / contractValue) * 100, 100) : 0
  const paidPct = contractValue > 0 ? Math.min((totalPaid / contractValue) * 100, 100) : 0
  const outstandingPct = contractValue > 0 ? Math.min((outstanding / contractValue) * 100, 100) : 0
  const isExpired = contract.valid_until && new Date(contract.valid_until) < new Date() && contract.status !== 'completed'
  const client = contract.client

  const daysLeft = contract.valid_until
    ? Math.ceil((new Date(contract.valid_until).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-4">

      {/* Top nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={15} /> Back to Contracts
        </button>
        <button onClick={() => navigate(`/sales/contracts`)} className="btn btn-secondary text-xs py-1.5 px-3">
          <Edit2 size={12} /> Edit Contract
        </button>
      </div>

      {/* ── HEADER ── */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">{contract.contract_number}</p>
            <h1 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{contract.title}</h1>

            {/* Status */}
            <div className="flex items-center gap-3">
              {editingStatus ? (
                <div className="flex items-center gap-2">
                  <select className="input input-sm py-1 text-xs" defaultValue={contract.status}
                    onChange={e => handleStatusChange(e.target.value)} disabled={savingStatus}>
                    {CONTRACT_STATUSES.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                  <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setEditingStatus(false)}>✕</button>
                </div>
              ) : (
                <button onClick={() => setEditingStatus(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 ${STATUS_COLOR[contract.status] || 'bg-gray-100 text-gray-500'}`}>
                  {contract.status === 'active' && <CheckCircle2 size={11} />}
                  {contract.status === 'draft' && <Clock size={11} />}
                  {contract.status === 'completed' && <CheckCircle2 size={11} />}
                  {contract.status === 'cancelled' && <AlertCircle size={11} />}
                  {contract.status?.charAt(0).toUpperCase() + contract.status?.slice(1)}
                  <Edit2 size={9} className="opacity-60" />
                </button>
              )}
              {isExpired && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> Expired
                </span>
              )}
              {!isExpired && daysLeft !== null && daysLeft <= 30 && daysLeft > 0 && (
                <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
                  <Clock size={12} /> {daysLeft} hari lagi
                </span>
              )}
            </div>
          </div>

          {/* Contract Value */}
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 mb-1">Contract Value</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(contractValue, contract.currency)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {contract.contract_date ? fmtDate(contract.contract_date) : ''}
              {contract.valid_until ? ` — ${fmtDate(contract.valid_until)}` : ''}
            </p>
          </div>
        </div>

        {/* Payment Progress */}
        <div className="mt-5 pt-5 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-medium text-gray-700">Payment Progress</span>
            <span>{paidPct.toFixed(1)}% paid • {outstandingPct.toFixed(1)}% outstanding</span>
          </div>
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-700 ease-out" style={{ width: progressWidth(paidPct) }} />
          </div>

          {/* Financial Summary - 3 Columns */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Contract Value</p>
              <p className="font-bold text-base text-gray-900">{fmt(contractValue, contract.currency)}</p>
              <p className="text-xs text-gray-400 mt-0.5">100%</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-xs text-green-600 mb-1">Total Paid</p>
              <p className="font-bold text-base text-green-700">{fmt(totalPaid, contract.currency)}</p>
              <p className="text-xs text-green-500 mt-0.5">{paidPct.toFixed(1)}%</p>
            </div>
            <div className={`rounded-lg border p-3 ${
              outstandingPct === 0
                ? 'bg-gray-50 border-gray-200'
                : outstandingPct <= 50
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-xs mb-1 ${
                outstandingPct === 0
                  ? 'text-gray-500'
                  : outstandingPct <= 50
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}>Outstanding</p>
              <p className={`font-bold text-base ${
                outstandingPct === 0
                  ? 'text-gray-700'
                  : outstandingPct <= 50
                    ? 'text-yellow-700'
                    : 'text-red-700'
              }`}>{fmt(outstanding, contract.currency)}</p>
              <p className={`text-xs mt-0.5 ${
                outstandingPct === 0
                  ? 'text-gray-400'
                  : outstandingPct <= 50
                    ? 'text-yellow-500'
                    : 'text-red-500'
              }`}>{outstandingPct.toFixed(1)}%</p>
            </div>
          </div>

          {/* Additional Info Row */}
          <div className="grid grid-cols-2 gap-3 text-center text-xs pt-2">
            <div className="rounded-lg bg-blue-50 py-2 px-3">
              <p className="text-blue-500 mb-0.5">Total Invoiced</p>
              <p className="font-semibold text-blue-700">{fmt(totalInvoiced, contract.currency)}</p>
            </div>
            <div className="rounded-lg bg-purple-50 py-2 px-3">
              <p className="text-purple-500 mb-0.5">Payments Received</p>
              <p className="font-semibold text-purple-700">{invoices.flatMap(i => i.payments || []).length} transactions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* ── CLIENT INFO ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Client Information</h2>
          </div>
          {client ? (
            <div className="space-y-2.5">
              <p className="font-semibold text-gray-900 text-base">{client.name}</p>
              {client.type && (
                <span className="inline-block text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 capitalize">
                  {client.type === 'company' ? 'Organization' : 'Person'}
                </span>
              )}
              <div className="space-y-2 pt-1">
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={13} className="text-gray-400 shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={13} className="text-gray-400 shrink-0" />
                    <span>{client.email}</span>
                  </div>
                )}
                {(client.address || client.city) && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
                    <span>
                      {[client.address, client.city, client.state, client.zip, client.country]
                        .filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {client.vat_number && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <FileText size={12} className="shrink-0" />
                    <span>VAT: {client.vat_number}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No client linked.</p>
          )}
        </div>

        {/* ── CONTRACT DETAILS ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Contract Details</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Contract Number', value: contract.contract_number },
              { label: 'Contract Date', value: fmtDate(contract.contract_date) },
              { label: 'Valid Until', value: fmtDate(contract.valid_until), danger: isExpired },
              { label: 'Currency', value: contract.currency },
              { label: 'Contract Value', value: fmt(contractValue, contract.currency) },
              { label: 'Linked Projects', value: projects.length > 0 ? `${projects.length} project(s)` : 'No projects linked yet' },
            ].map(({ label, value, danger }) => (
              <div key={label} className="flex justify-between items-start gap-4 text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-400 shrink-0">{label}</span>
                <span className={`font-medium text-right ${danger ? 'text-red-500' : 'text-gray-800'}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Contract Document Upload */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <FileCheck size={14} className="text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-600">Dokumen Kontrak (Signed)</h3>
            </div>

            {contract.file_url ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <FileCheck size={16} className="text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700">{contract.file_name || 'Contract Document'}</p>
                    <p className="text-xs text-green-500">Dokumen sudah diupload</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleDocView}
                    className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1">
                    <ExternalLink size={11} /> Download
                  </button>
                  <button onClick={handleDocRemove} className="btn btn-danger text-xs py-1 px-2.5 flex items-center gap-1">
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
                    {uploadingDoc ? 'Uploading...' : 'Klik untuk upload dokumen kontrak yang sudah ditandatangani'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX (max 10MB)</p>
                </div>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* ── LINKED PROJECTS ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderKanban size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Linked Projects</h2>
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{projects.length}</span>
          </div>
          <Link to="/projects?compose=new" className="btn btn-secondary text-xs py-1 px-3">
            + Add Project
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Belum ada project yang terhubung ke kontrak ini.<br />
            <span className="text-xs text-gray-300">Buat project baru dan pilih kontrak ini saat Add Project.</span>
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Start Date</th><th>Deadline</th><th>Progress</th><th>Status</th></tr>
            </thead>
            <tbody>
              {projects.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/projects/${p.id}`} className="font-medium text-blue-600 hover:underline">{p.title}</Link>
                  </td>
                  <td className="text-gray-400 text-xs whitespace-nowrap">{p.start_date ? new Date(p.start_date).toLocaleDateString('id') : '-'}</td>
                  <td className={`text-xs whitespace-nowrap ${new Date(p.deadline) < new Date() && p.status !== 'completed' ? 'text-red-500' : 'text-gray-400'}`}>
                    {p.deadline ? new Date(p.deadline).toLocaleDateString('id') : '-'}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out" style={{ width: progressWidth(p.progress) }} />
                      </div>
                      <span className="text-xs text-gray-400">{p.progress || 0}%</span>
                    </div>
                  </td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── RELATED INVOICES ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Related Invoices</h2>
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{invoices.length}</span>
          </div>
          {invoices.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-blue-600 font-medium">Invoiced: {fmt(totalInvoiced, contract.currency)}</span>
              <span className="text-green-600 font-medium">Paid: {fmt(totalPaid, contract.currency)}</span>
            </div>
          )}
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No invoices linked to this client yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th><th>Bill Date</th><th>Due Date</th>
                <th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td>
                    <a
                      href={`/sales/invoices#${inv.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      title="View invoice detail"
                    >
                      {inv.invoice_number}
                    </a>
                  </td>
                  <td className="text-gray-400 text-xs whitespace-nowrap">{inv.bill_date ? new Date(inv.bill_date).toLocaleDateString('id') : '-'}</td>
                  <td className="text-gray-400 text-xs whitespace-nowrap">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('id') : '-'}</td>
                  <td className="whitespace-nowrap">{fmt(inv.total_amount, inv.currency)}</td>
                  <td className="text-green-600 whitespace-nowrap">{fmt(inv.paid_amount, inv.currency)}</td>
                  <td className={`whitespace-nowrap font-medium ${inv.due_amount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {fmt(inv.due_amount, inv.currency)}
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="text-xs text-gray-500 max-w-xs truncate" title={inv.notes}>
                    {inv.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── RELATED EXPENSES ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Related Expenses</h2>
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{expenses.length}</span>
          </div>
          {expenses.length > 0 && (
            <p className="text-xs font-semibold text-red-500">Total: {fmt(totalExpenses, contract.currency)}</p>
          )}
        </div>

        {/* Expense vs Contract Value */}
        {contractValue > 0 && expenses.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 flex items-center justify-between text-xs">
            <span className="text-red-700 font-medium">Cost Ratio</span>
            <span className="text-red-700 font-bold">
              {((totalExpenses / contractValue) * 100).toFixed(1)}% of contract value
            </span>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No expenses linked to this contract.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Tax</th><th>Total</th></tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id}>
                  <td className="text-gray-400 text-xs whitespace-nowrap">{e.date ? new Date(e.date).toLocaleDateString('id') : '-'}</td>
                  <td className="font-medium">{e.title}</td>
                  <td><span className="badge badge-blue">{e.category || 'Other'}</span></td>
                  <td className="whitespace-nowrap">{Number(e.amount).toLocaleString('id-ID')}</td>
                  <td className="text-gray-400">{Number(e.tax + e.second_tax).toLocaleString('id-ID')}</td>
                  <td className="font-medium text-red-500 whitespace-nowrap">{Number(e.total).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
