import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { clientService, teamService, invoiceService, projectService, orderService, labelService } from '@/services/api'
import { toast } from 'react-toastify'
import { Plus, Filter, FileDown, Printer, Briefcase, Users, ClipboardCheck, Clock, FolderKanban, CheckCircle2, PauseCircle, XCircle } from 'lucide-react'
import {
  PageHeader, SearchInput, Pagination,
  Modal, ConfirmDialog, Loading, EmptyState, Avatar
} from '@/components/common'
import { ManageLabelsModal } from '@/components/common/ManageLabelsModal'
import { isValidEmail } from '@/utils/format'

const CURRENCY_SYMBOLS: Record<string, string> = { IDR: 'Rp', USD: '$', EUR: '€', GBP: '£', SGD: 'S$', MYR: 'RM' }


const EMPTY_FORM = {
  name: '', type: 'company', email: '', phone: '', website: '',
  address: '', city: '', state: '', zip: '', country: '',
  vat_number: '', gst_number: '', managers: '', client_groups: '',
  currency: 'IDR', currency_symbol: 'Rp', label_id: 0,
  needs: '', disable_online_payment: false, owner_id: 0,
}

type Tab = 'overview' | 'clients' | 'contacts'

export default function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('overview')

  // Overview state
  const [overview, setOverview] = useState<any>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)

  // Clients tab
  const [clients, setClients] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Contacts tab
  const [contacts, setContacts] = useState<any[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactPage, setContactPage] = useState(1)
  const CONTACT_LIMIT = 10

  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false)
  const [editContact, setEditContact] = useState<any>(null)
  const [deleteContactId, setDeleteContactId] = useState<number | null>(null)
  const [savingContact, setSavingContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', position: '', email: '', phone: '', client_id: 0 })

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [members, setMembers] = useState<any[]>([])

  // Labels & Manage Labels
  const [labels, setLabels] = useState<any[]>([])
  const [showManageLabels, setShowManageLabels] = useState(false)

  // Unique client groups from existing clients
  const [clientGroupOptions, setClientGroupOptions] = useState<string[]>([])

  // Load overview data
  const loadOverview = async () => {
    setOverviewLoading(true)
    try {
      const [cRes, iRes, pRes, contactRes, ordRes] = await Promise.all([
        clientService.list({ limit: 200 }),
        invoiceService.list({ limit: 200 }),
        projectService.list({ limit: 200 }),
        clientService.listContacts(),
        orderService.list(),
      ])
      const allClients: any[] = cRes.data.data || []
      const allInvoices: any[] = iRes.data.data || []
      const allProjects: any[] = pRes.data.data || []
      const allContacts: any[] = contactRes.data.data || []
      const allOrders: any[] = ordRes.data.data || []

      const totalClients = cRes.data.total || allClients.length

      // Clients with invoice statuses
      const clientsWithUnpaid = new Set(
        allInvoices.filter(inv => inv.status === 'not_paid' || inv.status === 'draft').map(inv => inv.client_id)
      ).size
      const clientsWithPartial = new Set(
        allInvoices.filter(inv => inv.status === 'partially_paid').map(inv => inv.client_id)
      ).size
      const clientsWithOverdue = new Set(
        allInvoices.filter(inv => inv.status === 'overdue').map(inv => inv.client_id)
      ).size

      // Clients with projects by status
      const clientsWithOpen = new Set(allProjects.filter(p => p.status === 'open').map(p => p.client_id)).size
      const clientsWithCompleted = new Set(allProjects.filter(p => p.status === 'completed').map(p => p.client_id)).size
      const clientsWithHold = new Set(allProjects.filter(p => p.status === 'hold').map(p => p.client_id)).size
      const clientsWithCancelled = new Set(allProjects.filter(p => p.status === 'cancelled').map(p => p.client_id)).size

      // Clients with new orders
      const clientsWithOrders = new Set(allOrders.map((o: any) => o.client_id).filter(Boolean)).size

      // Contacts today / last 7 days (by created_at)
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const contactsToday = allContacts.filter(ct => new Date(ct.created_at) >= todayStart).length
      const contactsLast7 = allContacts.filter(ct => new Date(ct.created_at) >= last7).length

      setOverview({
        totalClients,
        totalContacts: allContacts.length,
        contactsToday,
        contactsLast7,
        clientsWithUnpaid,
        clientsWithPartial,
        clientsWithOverdue,
        clientsWithOpen,
        clientsWithCompleted,
        clientsWithHold,
        clientsWithCancelled,
        clientsWithOrders,
      })
    } catch { toast.error('Failed to load overview') }
    finally { setOverviewLoading(false) }
  }

  const loadClients = (overridePage?: number) => {
    setLoading(true)
    clientService.list({ page, limit: 10, q: search })
      .then(r => { setClients(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(() => toast.error('Failed to load clients'))
      .finally(() => setLoading(false))
  }

  const loadContacts = () => {
    setContactsLoading(true)
    clientService.listContacts()
      .then(r => setContacts(r.data.data || []))
      .catch(() => toast.error('Failed to load contacts'))
      .finally(() => setContactsLoading(false))
  }

  useEffect(() => {
    if (tab === 'overview') loadOverview()
    else if (tab === 'clients') loadClients()
    else if (tab === 'contacts') {
      loadContacts()
      // load clients list for dropdown if not loaded yet
      if (clients.length === 0) {
        clientService.list({ limit: 200 }).then(r => setClients(r.data.data || []))
      }
    }
  }, [tab])

  useEffect(() => {
    if (tab === 'clients') loadClients()
  }, [page, search])

  useEffect(() => {
    teamService.listMembers({ limit: 100 }).then(r => setMembers(r.data.data || []))
    labelService.list().then(r => setLabels(r.data.data || []))
    // load unique client groups
    clientService.list({ limit: 200 }).then(r => {
      const groups = [...new Set<string>(
        (r.data.data || []).map((c: any) => c.client_groups).filter(Boolean)
      )]
      setClientGroupOptions(groups)
    })
  }, [])

  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }))

  const openAdd = () => {
    setEditItem(null); setForm(EMPTY_FORM); setShowModal(true)
  }

  useEffect(() => {
    if (searchParams.get('compose') !== 'new') return

    setTab('clients')
    setEditItem(null)
    setForm(EMPTY_FORM)
    setShowModal(true)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('compose')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])
  const openEdit = (c: any) => {
    setEditItem(c)
    setForm({
      name: c.name, type: c.type, email: c.email || '', phone: c.phone || '',
      website: c.website || '', address: c.address || '',
      city: c.city || '', state: c.state || '', zip: c.zip || '', country: c.country || '',
      vat_number: c.vat_number || '', gst_number: c.gst_number || '',
      managers: c.managers || '', client_groups: c.client_groups || '',
      currency: c.currency || 'IDR',
      currency_symbol: c.currency_symbol || CURRENCY_SYMBOLS[c.currency || 'IDR'] || '',
      label_id: c.label_id || 0,
      needs: c.needs || '',
      disable_online_payment: c.disable_online_payment || false,
      owner_id: c.owner_id || 0,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (form.email && !isValidEmail(form.email)) { toast.error('Invalid email format'); return }
    setSaving(true)
    try {
      const payload = { ...form, owner_id: form.owner_id || undefined }
      if (editItem) {
        await clientService.update(editItem.id, payload); toast.success('Client updated!')
      } else {
        await clientService.create(payload); toast.success('Client created!')
      }
      setShowModal(false)
      setPage(1)
      if (tab === 'clients') loadClients(1)
      else loadOverview()
    } catch { toast.error('Failed to save client') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await clientService.delete(deleteId); toast.success('Client deleted')
      loadClients()
    } catch { toast.error('Failed to delete') }
  }

  const setC = (key: string, val: any) => setContactForm(f => ({ ...f, [key]: val }))

  const openAddContact = () => {
    setEditContact(null)
    setContactForm({ name: '', position: '', email: '', phone: '', client_id: 0 })
    setShowContactModal(true)
  }

  const openEditContact = (ct: any) => {
    setEditContact(ct)
    setContactForm({ name: ct.name, position: ct.position || '', email: ct.email || '', phone: ct.phone || '', client_id: ct.client_id })
    setShowContactModal(true)
  }

  const handleSaveContact = async () => {
    if (!contactForm.name.trim()) { toast.error('Name is required'); return }
    if (!contactForm.client_id) { toast.error('Please select a client'); return }
    if (contactForm.email && !isValidEmail(contactForm.email)) { toast.error('Invalid email format'); return }
    setSavingContact(true)
    try {
      if (editContact) {
        await clientService.updateContact(editContact.client_id, editContact.id, contactForm)
        toast.success('Contact updated!')
      } else {
        await clientService.addContact(contactForm.client_id, contactForm)
        toast.success('Contact created!')
      }
      setShowContactModal(false)
      loadContacts()
    } catch { toast.error('Failed to save contact') }
    finally { setSavingContact(false) }
  }

  const handleDeleteContact = async () => {
    if (!deleteContactId) return
    const ct = contacts.find(c => c.id === deleteContactId)
    if (!ct) return
    try {
      await clientService.deleteContact(ct.client_id, ct.id)
      toast.success('Contact deleted')
      loadContacts()
    } catch { toast.error('Failed to delete contact') }
  }

  const filteredContacts = contacts.filter(ct =>
    ct.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    ct.email?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    ct.phone?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    ct.position?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    ct.client?.name?.toLowerCase().includes(contactSearch.toLowerCase())
  )

  const pagedContacts = filteredContacts.slice((contactPage - 1) * CONTACT_LIMIT, contactPage * CONTACT_LIMIT)

  const pct = (n: number, total: number) =>
    total > 0 ? Math.round((n / total) * 100) : 0

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'clients', label: 'Clients' },
    { key: 'contacts', label: 'Contacts' },
  ]

  return (
    <div className="space-y-4 p-5 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/55">Relationship workspace</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola company profile, contact person, proyek, invoice, dan kebutuhan client dari satu tempat.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={() => setShowManageLabels(true)}>
            <Filter size={13} />
            Manage labels
          </button>
          <button className="btn btn-secondary">
            <FileDown size={13} />
            Import clients
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={13} />
            Add client
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                tab === t.key
                  ? 'rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm'
                  : 'rounded-xl px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-slate-50 hover:text-gray-700'
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────── */}
      {tab === 'overview' && (
        overviewLoading || !overview
          ? <Loading />
          : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    icon: <Briefcase size={18} />,
                    bg: 'bg-blue-50 text-blue-700',
                    value: overview.totalClients,
                    label: 'Total clients',
                    hint: `${overview.clientsWithOpen} clients with open projects`,
                  },
                  {
                    icon: <Users size={18} />,
                    bg: 'bg-amber-50 text-amber-700',
                    value: overview.totalContacts,
                    label: 'Total contacts',
                    hint: `${overview.contactsToday} logged today`,
                  },
                  {
                    icon: <ClipboardCheck size={18} />,
                    bg: 'bg-sky-50 text-sky-700',
                    value: overview.contactsToday,
                    label: 'Contacts logged today',
                    hint: `${overview.contactsLast7} in last 7 days`,
                  },
                  {
                    icon: <Clock size={18} />,
                    bg: 'bg-indigo-50 text-indigo-700',
                    value: overview.contactsLast7,
                    label: 'Recent contacts',
                    hint: 'Active relationship touchpoints',
                  },
                ].map((kpi, i) => (
                  <div key={i} className="card">
                    <div className="card-body flex items-center gap-4">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${kpi.bg}`}>
                        {kpi.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-semibold text-gray-900">{kpi.value}</p>
                        <p className="text-sm font-medium text-gray-700">{kpi.label}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{kpi.hint}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {[
                  { label: 'Clients with unpaid invoices', count: overview.clientsWithUnpaid, color: 'bg-amber-400' },
                  { label: 'Clients with partially paid invoices', count: overview.clientsWithPartial, color: 'bg-slate-300' },
                  { label: 'Clients with overdue invoices', count: overview.clientsWithOverdue, color: 'bg-rose-500' },
                ].map((card, i) => (
                  <div key={i} className="card">
                    <div className="card-body">
                      <p className="text-base font-semibold text-gray-800">{card.label}</p>
                      <p className="mt-1 text-xs text-gray-400">{pct(card.count, overview.totalClients)}% of all clients</p>
                      <div className="mt-5 flex items-end gap-3">
                        <div className="flex-1">
                          <div className="h-2 rounded-full bg-slate-100">
                            <div
                              className={`h-2 rounded-full ${card.color}`}
                              style={{ width: `${pct(card.count, overview.totalClients)}%`, minWidth: card.count > 0 ? '8px' : '0' }}
                            />
                          </div>
                        </div>
                        <span className="text-3xl font-semibold text-gray-800">{card.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Projects</p>
                      <span className="section-title">Client project status</span>
                    </div>
                  </div>
                  <div className="card-body space-y-3">
                    {[
                      { icon: <FolderKanban size={15} className="text-blue-600" />, label: 'Clients with open projects', count: overview.clientsWithOpen, tone: 'text-blue-700 bg-blue-50' },
                      { icon: <CheckCircle2 size={15} className="text-emerald-600" />, label: 'Clients with completed projects', count: overview.clientsWithCompleted, tone: 'text-emerald-700 bg-emerald-50' },
                      { icon: <PauseCircle size={15} className="text-amber-600" />, label: 'Clients with hold projects', count: overview.clientsWithHold, tone: 'text-amber-700 bg-amber-50' },
                      { icon: <XCircle size={15} className="text-rose-500" />, label: 'Clients with canceled projects', count: overview.clientsWithCancelled, tone: 'text-rose-700 bg-rose-50' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                          {row.icon}
                        </div>
                        <span className="flex-1 text-sm font-medium text-gray-700">{row.label}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.tone}`}>{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Orders</p>
                      <span className="section-title">New client orders</span>
                    </div>
                  </div>
                  <div className="card-body flex h-full flex-col justify-between">
                    <div>
                      <div className="text-4xl font-semibold text-gray-900">{overview.clientsWithOrders}</div>
                      <p className="mt-1 text-sm text-gray-500">Clients with active new orders</p>
                    </div>
                    <div className="mt-6">
                      <p className="mb-2 text-xs text-gray-400">{pct(overview.clientsWithOrders, overview.totalClients)}% of all clients</p>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${pct(overview.clientsWithOrders, overview.totalClients)}%`, minWidth: overview.clientsWithOrders > 0 ? '8px' : '0' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
      )}

      {/* ── CLIENTS TAB ───────────────────────────────────── */}
      {tab === 'clients' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Directory</p>
                <span className="section-title">Client list</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn btn-secondary"><FileDown size={13} />Excel</button>
                <button className="btn btn-secondary"><Printer size={13} />Print</button>
                <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} />
              </div>
            </div>

            <div className="table-container rounded-none border-x-0 border-b-0 shadow-none">
              {loading ? <Loading /> : (
                <>
                  <table className="table">
                    <thead>
                      <tr><th>ID</th><th>Name</th><th>Type</th><th>Email</th><th>Phone</th><th>Currency</th><th>Owner</th><th></th></tr>
                    </thead>
                    <tbody>
                      {clients.length === 0
                        ? <tr><td colSpan={8}><EmptyState /></td></tr>
                        : clients.map(c => (
                          <tr key={c.id}>
                            <td className="text-gray-400">{c.id}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <Avatar name={c.name} />
                                <Link to={`/clients/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link>
                              </div>
                            </td>
                            <td className="text-gray-500 capitalize">{c.type === 'company' ? 'Organization' : 'Person'}</td>
                            <td className="text-gray-500">{c.email || '-'}</td>
                            <td className="text-gray-500">{c.phone || '-'}</td>
                            <td className="text-gray-400">{c.currency}</td>
                            <td className="text-gray-400">{c.owner?.name || '-'}</td>
                            <td>
                              <div className="flex gap-1">
                                <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(c)}>Edit</button>
                                <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(c.id)}>×</button>
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
          </div>
        </div>
      )}

      {/* ── CONTACTS TAB ──────────────────────────────────── */}
      {tab === 'contacts' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Contacts</p>
                <span className="section-title">
                  {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button className="btn btn-secondary"><FileDown size={13} />Excel</button>
                <button className="btn btn-secondary"><Printer size={13} />Print</button>
                <SearchInput
                  value={contactSearch}
                  onChange={v => { setContactSearch(v); setContactPage(1) }}
                />
                <button className="btn btn-primary" onClick={openAddContact}>
                  <Plus size={13} /> Add contact
                </button>
              </div>
            </div>

            <div className="table-container rounded-none border-x-0 border-b-0 shadow-none">
              {contactsLoading ? <Loading /> : (
                <>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Client</th>
                        <th>Created</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedContacts.length === 0
                        ? <tr><td colSpan={7}><EmptyState message="No contacts found" /></td></tr>
                        : pagedContacts.map(ct => (
                          <tr key={ct.id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <Avatar name={ct.name} />
                                <div>
                                  <p className="font-medium text-gray-800">{ct.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-sm text-gray-500">{ct.position || '-'}</td>
                            <td>
                              {ct.email
                                ? <a href={`mailto:${ct.email}`} className="text-sm text-primary hover:underline">{ct.email}</a>
                                : <span className="text-gray-400">-</span>
                              }
                            </td>
                            <td className="text-sm text-gray-500">{ct.phone || '-'}</td>
                            <td>
                              {ct.client
                                ? <Link to={`/clients/${ct.client_id}`} className="text-sm text-primary hover:underline">{ct.client.name}</Link>
                                : <span className="text-gray-400">-</span>
                              }
                            </td>
                            <td className="whitespace-nowrap text-xs text-gray-400">
                              {ct.created_at ? new Date(ct.created_at).toLocaleDateString('id-ID') : '-'}
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button
                                  className="btn btn-secondary text-xs py-0.5 px-2"
                                  onClick={() => openEditContact(ct)}
                                >Edit</button>
                                <button
                                  className="btn btn-danger text-xs py-0.5 px-2"
                                  onClick={() => setDeleteContactId(ct.id)}
                                >×</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                  <Pagination
                    page={contactPage}
                    total={filteredContacts.length}
                    limit={CONTACT_LIMIT}
                    onChange={setContactPage}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ─────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Edit Client' : 'Add client'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 py-1">
            <span className="w-36 text-sm text-gray-600 flex-shrink-0">Type</span>
            <div className="flex gap-5">
              {[{ val: 'company', label: 'Organization' }, { val: 'person', label: 'Person' }].map(opt => (
                <label key={opt.val} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="client_type" value={opt.val} checked={form.type === opt.val}
                    onChange={() => set('type', opt.val)} className="accent-blue-600" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <Row label={form.type === 'company' ? 'Company name' : 'Full name'}>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder={form.type === 'company' ? 'Company name' : 'Full name'} />
          </Row>
          <Row label="Owner">
            <select className="input" value={form.owner_id} onChange={e => set('owner_id', Number(e.target.value))}>
              <option value={0}>— Select owner —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Row>
          <Row label="Managers">
            <select className="input" value={form.managers} onChange={e => set('managers', e.target.value)}>
              <option value="">— Select manager —</option>
              {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </Row>
          <Row label="Address"><textarea className="input" rows={3} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Address" /></Row>
          <Row label="City"><input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" /></Row>
          <Row label="State"><input className="input" value={form.state} onChange={e => set('state', e.target.value)} placeholder="State" /></Row>
          <Row label="Zip"><input className="input" value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="Zip" /></Row>
          <Row label="Country"><input className="input" value={form.country} onChange={e => set('country', e.target.value)} placeholder="Country" /></Row>
          <Row label="Phone"><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Phone" /></Row>
          <Row label="Website"><input className="input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="Website" /></Row>
          <Row label="VAT Number"><input className="input" value={form.vat_number} onChange={e => set('vat_number', e.target.value)} placeholder="VAT Number" /></Row>
          <Row label="GST Number"><input className="input" value={form.gst_number} onChange={e => set('gst_number', e.target.value)} placeholder="GST Number" /></Row>
          <Row label="Client groups">
            <input
              className="input"
              list="client-groups-list"
              value={form.client_groups}
              onChange={e => set('client_groups', e.target.value)}
              placeholder="Type or select a group..."
            />
            <datalist id="client-groups-list">
              {clientGroupOptions.map(g => <option key={g} value={g} />)}
            </datalist>
          </Row>
          <Row label="Email"><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" /></Row>
          <Row label="Currency Symbol">
            <select className="input" value={form.currency} onChange={e => {
              const cur = e.target.value
              set('currency', cur)
              set('currency_symbol', CURRENCY_SYMBOLS[cur] || '')
            }}>
              {Object.keys(CURRENCY_SYMBOLS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Row>
          <Row label="Currency">
            <input
              className="input"
              value={form.currency_symbol}
              onChange={e => {
                const val = e.target.value
                const match = val.match(/^([^0-9]*)([0-9.]*)$/)
                if (match) {
                  const prefix = match[1]
                  const numStr = match[2].replace(/\./g, '')
                  if (numStr === '') { set('currency_symbol', prefix); return }
                  const n = parseInt(numStr, 10)
                  if (!isNaN(n)) { set('currency_symbol', prefix + n.toLocaleString('id-ID')); return }
                }
                set('currency_symbol', val)
              }}
              placeholder="e.g. Rp"
            />
          </Row>
          <Row label="Label">
            <select className="input" value={form.label_id} onChange={e => set('label_id', Number(e.target.value))}>
              <option value={0}>— No label —</option>
              {labels.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Row>
          <Row label="Needs / Requirement">
            <textarea className="input" rows={3} value={form.needs}
              onChange={e => set('needs', e.target.value)}
              placeholder="Describe client needs or requirements..." />
          </Row>
          <Row label="Disable online payment">
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input type="checkbox" className="w-4 h-4 accent-blue-600"
                checked={form.disable_online_payment}
                onChange={e => set('disable_online_payment', e.target.checked)} />
              <span className="text-sm text-gray-600">Disable online payment for this client</span>
            </label>
          </Row>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />

      {/* ── Add/Edit Contact Modal ─────────────────────── */}
      <Modal
        open={showContactModal}
        onClose={() => setShowContactModal(false)}
        title={editContact ? 'Edit Contact' : 'Add Contact'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowContactModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveContact} disabled={savingContact}>
              {savingContact ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Row label="Client *">
            <select
              className="input"
              value={contactForm.client_id}
              onChange={e => setC('client_id', Number(e.target.value))}
            >
              <option value={0}>— Select client —</option>
              {clients.length > 0
                ? clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                : contacts
                    .reduce((acc: any[], ct) => {
                      if (ct.client && !acc.find(a => a.id === ct.client_id)) acc.push(ct.client)
                      return acc
                    }, [])
                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              }
            </select>
          </Row>
          <Row label="Full Name *">
            <input className="input" value={contactForm.name} onChange={e => setC('name', e.target.value)} placeholder="Full name" />
          </Row>
          <Row label="Position">
            <input className="input" value={contactForm.position} onChange={e => setC('position', e.target.value)} placeholder="e.g. IT Director" />
          </Row>
          <Row label="Email">
            <input className="input" type="email" value={contactForm.email} onChange={e => setC('email', e.target.value)} placeholder="email@example.com" />
          </Row>
          <Row label="Phone">
            <input className="input" value={contactForm.phone} onChange={e => setC('phone', e.target.value)} placeholder="+62..." />
          </Row>
        </div>
      </Modal>

      {/* ── Delete Contact Confirm ─────────────────────── */}
      <ConfirmDialog
        open={!!deleteContactId}
        onClose={() => setDeleteContactId(null)}
        onConfirm={handleDeleteContact}
        message="Delete this contact? This action cannot be undone."
      />

      {/* ── Manage Labels Modal ───────────────────────── */}
      <ManageLabelsModal
        open={showManageLabels}
        onClose={() => setShowManageLabels(false)}
        onUpdated={setLabels}
      />
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-36 text-sm text-gray-600 flex-shrink-0 pt-2">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
