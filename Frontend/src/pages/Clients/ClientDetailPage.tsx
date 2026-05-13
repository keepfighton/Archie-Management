import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { clientService, paymentService, orderService, contractService, fileService, expenseService } from '@/services/api'
import { isValidEmail } from '@/utils/format'
import { toast } from 'react-toastify'
import {
  ChevronLeft, ChevronRight, Plus, Mail, Phone, MapPin,
  Building2, Star, FileText, Users, FolderKanban, CalendarDays,
  UserCircle, Tag, Banknote, StickyNote, Clock, Receipt, ShoppingCart,
  ScrollText, Folder, TrendingDown
} from 'lucide-react'
import {
  Loading, EmptyState, StatusBadge, ProgressBar, Avatar,
  Modal, FormField, ViewTabs
} from '@/components/common'

const TABS = [
  { key: 'overview',   label: 'Overview'   },
  { key: 'projects',   label: 'Projects'   },
  { key: 'invoices',   label: 'Invoices'   },
  { key: 'payments',   label: 'Payments'   },
  { key: 'statement',  label: 'Statement'  },
  { key: 'orders',     label: 'Orders'     },
  { key: 'contracts',  label: 'Contracts'  },
  { key: 'files',      label: 'Files'      },
  { key: 'expenses',   label: 'Expenses'   },
  { key: 'contacts',   label: 'Contacts'   },
]

const fmt = (n: number, cur = 'IDR') =>
  `${cur} ${Number(n).toLocaleString('id-ID')}`

/* ── Mini Calendar ─────────────────────────────────────────── */
function MiniCalendar() {
  const [date, setDate] = useState(new Date())
  const year = date.getFullYear()
  const month = date.getMonth()
  const monthLabel = new Date(year, month, 1).toLocaleString('en', { month: 'long', year: 'numeric' })
  const today = new Date()

  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev  = new Date(year, month, 0).getDate()

  const cells: { day: number; cur: boolean; isToday: boolean }[] = []
  for (let i = startOffset - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, cur: false, isToday: false })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, cur: true, isToday: d === today.getDate() && month === today.getMonth() && year === today.getFullYear() })
  while (cells.length < 42)
    cells.push({ day: cells.length - startOffset - daysInMonth + 1, cur: false, isToday: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-0.5">
          <button onClick={() => setDate(new Date(year, month - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400">
            <ChevronLeft size={13} />
          </button>
          <button onClick={() => setDate(new Date(year, month + 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400">
            <ChevronRight size={13} />
          </button>
        </div>
        <span className="text-sm font-medium text-gray-700">{monthLabel}</span>
        <button onClick={() => setDate(new Date())} className="text-xs text-gray-400 hover:text-gray-600">today</button>
      </div>
      <div className="grid grid-cols-7 text-center mb-0.5">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="text-[10px] text-gray-400 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center">
        {cells.map((c, i) => (
          <div key={i} className={`text-[11px] py-1.5 rounded leading-none
            ${c.cur ? 'text-gray-700' : 'text-gray-300'}
            ${c.isToday ? 'bg-yellow-100 font-semibold text-yellow-800' : ''}`}>
            {c.day}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main component ────────────────────────────────────────── */
export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const clientId = Number(id)

  const [client,    setClient]    = useState<any>(null)
  const [contacts,  setContacts]  = useState<any[]>([])
  const [projects,  setProjects]  = useState<any[]>([])
  const [invoices,  setInvoices]  = useState<any[]>([])
  const [payments,  setPayments]  = useState<any[]>([])
  const [orders,    setOrders]    = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [files,     setFiles]     = useState<any[]>([])
  const [expenses,  setExpenses]  = useState<any[]>([])
  const [tab,       setTab]       = useState('overview')
  const [loading,   setLoading]   = useState(true)
  const [tabLoading, setTabLoading] = useState(false)

  const [showContactModal, setShowContactModal] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', position: '' })
  const [savingContact, setSavingContact] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [cRes, coRes, pRes, iRes] = await Promise.all([
        clientService.get(clientId),
        clientService.getContacts(clientId),
        clientService.getProjects(clientId),
        clientService.getInvoices(clientId),
      ])
      setClient(cRes.data)
      setContacts(coRes.data.data || [])
      setProjects(pRes.data.data || [])
      setInvoices(iRes.data.data || [])
    } catch { toast.error('Failed to load client') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [clientId])

  const handleTabChange = async (key: string) => {
    setTab(key)
    setTabLoading(true)
    try {
      if (key === 'payments' && payments.length === 0) {
        const r = await paymentService.list({ client_id: clientId })
        setPayments(r.data.data || [])
      }
      if (key === 'orders' && orders.length === 0) {
        const r = await orderService.list({ client_id: clientId })
        setOrders(r.data.data || [])
      }
      if (key === 'contracts' && contracts.length === 0) {
        const r = await contractService.list({ client_id: clientId })
        setContracts(r.data.data || [])
      }
      if (key === 'files' && files.length === 0) {
        const r = await fileService.list({ client_id: clientId })
        setFiles(r.data.data || [])
      }
      if (key === 'expenses') {
        const r = await expenseService.list({ client_id: clientId })
        setExpenses(r.data?.data ?? [])
      }
      if (key === 'projects') {
        const [cRes, eRes] = await Promise.all([
          contractService.list({ client_id: clientId }),
          expenseService.list({ client_id: clientId }),
        ])
        setContracts(cRes.data.data || [])
        setExpenses(eRes.data?.data ?? [])
      }
    } catch { /* silent */ }
    finally { setTabLoading(false) }
  }

  const invStats = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {
      overdue: { count: 0, amount: 0 },
      unpaid:  { count: 0, amount: 0 },
      partial: { count: 0, amount: 0 },
      paid:    { count: 0, amount: 0 },
      draft:   { count: 0, amount: 0 },
    }
    invoices.forEach(inv => {
      const s = inv.status?.toLowerCase() || ''
      const a = Number(inv.total_amount) || 0
      if      (s === 'overdue')                    { map.overdue.count++; map.overdue.amount += a }
      else if (s === 'unpaid' || s === 'not_paid') { map.unpaid.count++;  map.unpaid.amount  += a }
      else if (s.includes('partial'))              { map.partial.count++; map.partial.amount += a }
      else if (s === 'paid' || s === 'fully_paid') { map.paid.count++;    map.paid.amount    += a }
      else if (s === 'draft')                      { map.draft.count++;   map.draft.amount   += a }
    })
    const totalInvoiced = Object.values(map).reduce((s, v) => s + v.amount, 0)
    const totalPaid     = map.paid.amount
    const due           = map.overdue.amount + map.unpaid.amount + map.partial.amount
    return { ...map, totalInvoiced, totalPaid, due }
  }, [invoices])

  const handleAddContact = async () => {
    if (!contactForm.name.trim()) { toast.error('Name is required'); return }
    if (contactForm.email && !isValidEmail(contactForm.email)) { toast.error('Invalid email'); return }
    setSavingContact(true)
    try {
      await clientService.addContact(clientId, contactForm)
      toast.success('Contact added!')
      setShowContactModal(false)
      setContactForm({ name: '', email: '', phone: '', position: '' })
      const res = await clientService.getContacts(clientId)
      setContacts(res.data.data || [])
    } catch { toast.error('Failed to add contact') }
    finally { setSavingContact(false) }
  }

  if (loading) return <div className="p-5"><Loading /></div>
  if (!client) return <div className="p-5"><EmptyState message="Client not found." /></div>

  const cur = client.currency || 'IDR'
  const maxInv = invStats.totalInvoiced || 1

  return (
    <div className="p-5 pb-8">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-400">
        <Link to="/clients" className="hover:text-gray-600">Clients</Link>
        <ChevronRight size={12} />
        <span className="text-gray-600 font-medium">{client.name}</span>
      </div>

      {/* ── Page header ── */}
      <div className="flex items-center gap-2 mb-4">
        <FolderKanban size={16} className="text-gray-400" />
        <h1 className="text-lg font-semibold text-gray-900">{client.name}</h1>
        <Star size={14} className="text-gray-300 hover:text-yellow-400 cursor-pointer ml-1" />
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-200 mb-5">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => handleTabChange(t.key)}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors
                ${tab === t.key
                  ? 'border-[#2aacb8] text-[#2aacb8] font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ OVERVIEW TAB ══════════════ */}
      {tab === 'overview' && (
        <div className="flex gap-5">

          {/* ── Left main content ── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Stat row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: '#2aacb8' }}>{projects.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Projects</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-700">{invoices.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Invoices</p>
              </div>
            </div>

            {/* Invoice Overview */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-800 text-sm">Invoice Overview</span>
                </div>
                <ChevronRight size={14} className="text-gray-300" />
              </div>

              <div className="flex gap-6">
                {/* Progress bars */}
                <div className="flex-1 space-y-2.5">
                  {[
                    { label: 'Overdue',        color: '#ef4444', key: 'overdue' },
                    { label: 'Not paid',       color: '#f59e0b', key: 'unpaid'  },
                    { label: 'Partially paid', color: '#3b82f6', key: 'partial' },
                    { label: 'Fully paid',     color: '#2aacb8', key: 'paid'    },
                    { label: 'Draft',          color: '#9ca3af', key: 'draft'   },
                  ].map(row => {
                    const stat = invStats[row.key as keyof typeof invStats] as any
                    const pct = stat?.amount ? (stat.amount / maxInv) * 100 : 0
                    return (
                      <div key={row.key} className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                        <span className="text-xs text-gray-500 w-24 flex-shrink-0">{row.label}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                        </div>
                        <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">{stat.count}</span>
                        <span className="text-xs text-gray-500 w-28 text-right flex-shrink-0">
                          {fmt(stat.amount, cur)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Totals */}
                <div className="w-44 flex-shrink-0 text-right border-l border-gray-100 pl-5 flex flex-col justify-between">
                  <div>
                    <p className="text-xl font-bold text-gray-900 leading-tight">{fmt(invStats.totalInvoiced, cur)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Total invoiced</p>
                  </div>
                  <div className="mt-3">
                    <p className="text-lg font-bold" style={{ color: '#2aacb8' }}>{fmt(invStats.totalPaid, cur)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Payments</p>
                  </div>
                  <div className="mt-3">
                    <p className="text-base font-semibold text-gray-500">{fmt(invStats.due, cur)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Due</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-800 text-sm">Contacts</span>
                </div>
                <div className="flex gap-2">
                  <button className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded">
                    <Mail size={11} /> Send invitation
                  </button>
                  <button
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded text-white"
                    style={{ backgroundColor: '#2aacb8' }}
                    onClick={() => setShowContactModal(true)}
                  >
                    <Plus size={11} /> Add contact
                  </button>
                </div>
              </div>
              {contacts.length === 0
                ? <div className="py-6 text-center text-xs text-gray-400">No record found.</div>
                : (
                  <table className="table">
                    <thead>
                      <tr><th>Name</th><th>Position</th><th>Email</th><th>Phone</th></tr>
                    </thead>
                    <tbody>
                      {contacts.map(c => (
                        <tr key={c.id}>
                          <td className="font-medium">{c.name}</td>
                          <td className="text-gray-400">{c.position || '-'}</td>
                          <td className="text-gray-400">{c.email   || '-'}</td>
                          <td className="text-gray-400">{c.phone   || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>

            {/* Events / Calendar */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-800 text-sm">Events</span>
                </div>
                <button className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-700">
                  <Plus size={11} /> Add event
                </button>
              </div>
              <MiniCalendar />
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-64 flex-shrink-0 space-y-3">

            {/* Client Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Client Info</span>
              </div>
              <div className="space-y-2.5 text-xs text-gray-500">
                <div className="flex items-start gap-2">
                  <Building2 size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                  <span className="capitalize">{client.type || 'Organization'}</span>
                </div>
                {client.email && (
                  <div className="flex items-start gap-2">
                    <Mail size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                    <span className="break-all">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-start gap-2">
                    <Phone size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                    <span className="leading-relaxed">{client.address}</span>
                  </div>
                )}
                {client.currency && (
                  <div className="flex items-center gap-2">
                    <Banknote size={13} className="text-gray-300 flex-shrink-0" />
                    <span>Currency: <span className="font-medium text-gray-700">{client.currency}</span></span>
                  </div>
                )}
                {client.industry && (
                  <div className="flex items-center gap-2">
                    <Tag size={13} className="text-gray-300 flex-shrink-0" />
                    <span>{client.industry}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tasks */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <UserCircle size={13} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-700">Tasks</span>
              </div>
              <button className="text-xs flex items-center gap-1 mt-1" style={{ color: '#2aacb8' }}>
                <Plus size={11} /> Add task
              </button>
            </div>

            {/* Notes */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote size={13} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-700">Notes</span>
              </div>
              <button className="text-xs flex items-center gap-1 mt-1" style={{ color: '#2aacb8' }}>
                <Plus size={11} /> Add note
              </button>
            </div>

            {/* Reminders */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={13} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-700">Reminders (Private)</span>
              </div>
              <button className="text-xs flex items-center gap-1 mt-1" style={{ color: '#2aacb8' }}>
                <Plus size={11} /> Add reminder
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ══ PROJECTS TAB ══ */}
      {tab === 'projects' && (
        <div className="table-container">
          {tabLoading ? <Loading /> : (
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Status</th><th>Contract</th><th>Budget</th><th>Total Expenses</th><th>% Used</th><th>Progress</th><th>Deadline</th></tr>
              </thead>
              <tbody>
                {projects.length === 0
                  ? <tr><td colSpan={8}><EmptyState /></td></tr>
                  : projects.map(p => {
                      const contract = contracts.find(c => c.project_id === p.id)
                      const budget = contract ? Number(contract.amount) : 0
                      const totalExp = expenses.filter(e => e.project_id === p.id).reduce((s, e) => s + (e.total || 0), 0)
                      const pct = budget > 0 ? Math.round((totalExp / budget) * 100) : null
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link to={`/projects/${p.id}`} className="hover:underline" style={{ color: '#2aacb8' }}>{p.title}</Link>
                          </td>
                          <td><StatusBadge status={p.status} /></td>
                          <td className="text-sm text-gray-500">{contract ? contract.contract_number : '-'}</td>
                          <td className="whitespace-nowrap text-sm">{budget > 0 ? `IDR ${budget.toLocaleString('id')}` : '-'}</td>
                          <td className={`whitespace-nowrap text-sm font-medium ${totalExp > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {totalExp > 0 ? `IDR ${totalExp.toLocaleString('id')}` : '-'}
                          </td>
                          <td>
                            {pct !== null
                              ? <span className={`text-sm font-semibold ${pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-yellow-500' : 'text-green-500'}`}>{pct}%</span>
                              : <span className="text-gray-300 text-sm">-</span>
                            }
                          </td>
                          <td><ProgressBar value={p.progress} className="w-20" /></td>
                          <td className="text-gray-400">{p.deadline ? new Date(p.deadline).toLocaleDateString('id') : '-'}</td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ INVOICES TAB ══ */}
      {tab === 'invoices' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Invoice #</th><th>Bill Date</th><th>Due Date</th><th>Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {invoices.length === 0
                ? <tr><td colSpan={5}><EmptyState /></td></tr>
                : invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-medium" style={{ color: '#2aacb8' }}>{inv.invoice_number}</td>
                    <td className="text-gray-400">{new Date(inv.bill_date).toLocaleDateString('id')}</td>
                    <td className="text-gray-400">{new Date(inv.due_date).toLocaleDateString('id')}</td>
                    <td className="whitespace-nowrap">{inv.currency} {Number(inv.total_amount).toLocaleString()}</td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ══ PAYMENTS TAB ══ */}
      {tab === 'payments' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Receipt size={15} className="text-gray-400" /> Payments</h2>
          </div>
          {tabLoading ? <Loading /> : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Invoice #</th><th>Payment Date</th><th>Payment Method</th><th>Note</th><th className="text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {payments.length === 0
                    ? <tr><td colSpan={5}><EmptyState message="No payments found." /></td></tr>
                    : payments.map((p, i) => (
                      <tr key={i}>
                        <td style={{ color: '#2aacb8' }} className="font-medium">{p.invoice_number || `INVOICE #${p.invoice_id}`}</td>
                        <td className="text-gray-500">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('id') : '-'}</td>
                        <td className="text-gray-500">{p.payment_method || '-'}</td>
                        <td className="text-gray-400">{p.note || ''}</td>
                        <td className="text-right text-gray-700 whitespace-nowrap">{p.currency || 'IDR'} {Number(p.amount).toLocaleString('id-ID')}</td>
                      </tr>
                    ))
                  }
                  {payments.length > 0 && (
                    <tr className="font-semibold bg-gray-50">
                      <td colSpan={4} className="text-right text-gray-700">Total</td>
                      <td className="text-right text-gray-900 whitespace-nowrap">
                        IDR {payments.reduce((s, p) => s + (Number(p.amount) || 0), 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ STATEMENT TAB ══ */}
      {tab === 'statement' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ScrollText size={15} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800">Statement</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Invoiced', value: invStats.totalInvoiced, color: 'text-gray-900' },
              { label: 'Total Paid',     value: invStats.totalPaid,     color: 'text-[#2aacb8]' },
              { label: 'Outstanding',    value: invStats.due,           color: 'text-red-500'   },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{fmt(s.value, cur)}</p>
              </div>
            ))}
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Invoice #</th><th>Bill Date</th><th>Due Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {invoices.length === 0
                  ? <tr><td colSpan={7}><EmptyState /></td></tr>
                  : invoices.map(inv => {
                    const total = Number(inv.total_amount) || 0
                    const paid  = Number(inv.paid_amount)  || 0
                    const bal   = total - paid
                    return (
                      <tr key={inv.id}>
                        <td className="font-medium" style={{ color: '#2aacb8' }}>{inv.invoice_number}</td>
                        <td className="text-gray-400">{new Date(inv.bill_date).toLocaleDateString('id')}</td>
                        <td className="text-gray-400">{new Date(inv.due_date).toLocaleDateString('id')}</td>
                        <td className="whitespace-nowrap">{cur} {total.toLocaleString('id-ID')}</td>
                        <td className="whitespace-nowrap text-[#2aacb8]">{cur} {paid.toLocaleString('id-ID')}</td>
                        <td className={`whitespace-nowrap ${bal > 0 ? 'text-red-500' : 'text-gray-400'}`}>{cur} {bal.toLocaleString('id-ID')}</td>
                        <td><StatusBadge status={inv.status} /></td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ ORDERS TAB ══ */}
      {tab === 'orders' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={15} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800">Orders</h2>
          </div>
          {tabLoading ? <Loading /> : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Order #</th><th>Date</th><th>Total</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {orders.length === 0
                    ? <tr><td colSpan={4}><EmptyState message="No orders found." /></td></tr>
                    : orders.map(o => (
                      <tr key={o.id}>
                        <td className="font-medium" style={{ color: '#2aacb8' }}>{o.order_number || `#${o.id}`}</td>
                        <td className="text-gray-400">{o.created_at ? new Date(o.created_at).toLocaleDateString('id') : '-'}</td>
                        <td className="whitespace-nowrap">{cur} {Number(o.total_amount || 0).toLocaleString('id-ID')}</td>
                        <td><StatusBadge status={o.status} /></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ CONTRACTS TAB ══ */}
      {tab === 'contracts' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText size={15} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800">Contracts</h2>
          </div>
          {tabLoading ? <Loading /> : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Title</th><th>Start Date</th><th>End Date</th><th>Value</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {contracts.length === 0
                    ? <tr><td colSpan={5}><EmptyState message="No contracts found." /></td></tr>
                    : contracts.map(c => (
                      <tr key={c.id}>
                        <td className="font-medium">{c.title || '-'}</td>
                        <td className="text-gray-400">{c.start_date ? new Date(c.start_date).toLocaleDateString('id') : '-'}</td>
                        <td className="text-gray-400">{c.end_date   ? new Date(c.end_date).toLocaleDateString('id')   : '-'}</td>
                        <td className="whitespace-nowrap">{cur} {Number(c.value || 0).toLocaleString('id-ID')}</td>
                        <td><StatusBadge status={c.status} /></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ FILES TAB ══ */}
      {tab === 'files' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Folder size={15} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800">Files</h2>
          </div>
          {tabLoading ? <Loading /> : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Size</th><th>Uploaded</th></tr>
                </thead>
                <tbody>
                  {files.length === 0
                    ? <tr><td colSpan={4}><EmptyState message="No files found." /></td></tr>
                    : files.map(f => (
                      <tr key={f.id}>
                        <td className="font-medium" style={{ color: '#2aacb8' }}>{f.name}</td>
                        <td className="text-gray-400 uppercase text-[10px]">{f.file_type || '-'}</td>
                        <td className="text-gray-400">{f.size ? `${(f.size / 1024).toFixed(1)} KB` : '-'}</td>
                        <td className="text-gray-400">{f.created_at ? new Date(f.created_at).toLocaleDateString('id') : '-'}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ EXPENSES TAB ══ */}
      {tab === 'expenses' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Expenses</h2>
            {expenses.length > 0 && (
              <p className="text-sm font-semibold text-red-500">
                Total: IDR {expenses.reduce((s, e) => s + (e.total || 0), 0).toLocaleString('id')}
              </p>
            )}
          </div>
          <div className="table-container">
            {tabLoading ? <Loading /> : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Contract</th>
                    <th>Project</th>
                    <th>Category</th>
                    <th>Title</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0
                    ? <tr><td colSpan={8}><EmptyState /></td></tr>
                    : expenses.map(e => (
                        <tr key={e.id}>
                          <td className="text-gray-400 whitespace-nowrap">{e.date ? new Date(e.date).toLocaleDateString('id') : '-'}</td>
                          <td className="text-sm text-gray-500">{e.contract?.contract_number || '-'}</td>
                          <td className="text-sm text-gray-500">{e.project?.title || '-'}</td>
                          <td><span className="badge badge-blue">{e.category || 'Other'}</span></td>
                          <td className="font-medium">{e.title}</td>
                          <td className="text-right whitespace-nowrap">{Number(e.amount).toLocaleString('id')}</td>
                          <td className="text-right whitespace-nowrap text-gray-400">{Number(e.tax + e.second_tax).toLocaleString('id')}</td>
                          <td className="text-right whitespace-nowrap font-medium text-red-500">{Number(e.total).toLocaleString('id')}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ CONTACTS TAB ══ */}
      {tab === 'contacts' && (
        <div>
          <div className="flex justify-end mb-3">
            <button className="btn btn-primary" onClick={() => setShowContactModal(true)}>
              <Plus size={12} /> Add contact
            </button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Position</th><th>Email</th><th>Phone</th></tr>
              </thead>
              <tbody>
                {contacts.length === 0
                  ? <tr><td colSpan={4}><EmptyState /></td></tr>
                  : contacts.map(c => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="text-gray-500">{c.position || '-'}</td>
                      <td className="text-gray-500">{c.email    || '-'}</td>
                      <td className="text-gray-500">{c.phone    || '-'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Add Contact Modal ══ */}
      <Modal open={showContactModal} onClose={() => setShowContactModal(false)} title="Add Contact"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowContactModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddContact} disabled={savingContact}>
              {savingContact ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Name" required>
              <input className="input" value={contactForm.name}
                onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Contact name" />
            </FormField>
          </div>
          <FormField label="Position">
            <input className="input" value={contactForm.position}
              onChange={e => setContactForm({ ...contactForm, position: e.target.value })} placeholder="Job title" />
          </FormField>
          <FormField label="Email">
            <input className="input" type="email" value={contactForm.email}
              onChange={e => setContactForm({ ...contactForm, email: e.target.value })} placeholder="email@example.com" />
          </FormField>
          <FormField label="Phone">
            <input className="input" value={contactForm.phone}
              onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="+62..." />
          </FormField>
        </div>
      </Modal>

    </div>
  )
}
