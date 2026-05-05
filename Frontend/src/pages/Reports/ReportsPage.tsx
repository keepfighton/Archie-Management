import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportService, invoiceService, paymentService, expenseService, teamService, taskService, projectService, clientService } from '@/services/api'
import { FileDown } from 'lucide-react'
import { toast } from 'react-toastify'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from 'recharts'
import { Loading, ViewTabs } from '@/components/common'

const VIEWS = [
  { key: 'sales', label: 'Sales' },
  { key: 'finance', label: 'Finance' },
  { key: 'projects', label: 'Projects' },
  { key: 'leads', label: 'Leads' },
]

const SALES_VIEWS = [
  { key: 'summary', label: 'Invoice Summary' },
  { key: 'detail', label: 'Invoice Detail' },
]

const FINANCE_VIEWS = [
  { key: 'income_vs_expenses', label: 'Income vs Expenses' },
  { key: 'expenses_summary', label: 'Expenses Summary' },
  { key: 'payment_summary', label: 'Payment Summary' },
]

const PROJECTS_VIEWS = [
  { key: 'overview', label: 'Overview' },
  { key: 'team_summary', label: 'Team Members Summary' },
  { key: 'clients_summary', label: 'Clients Summary' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af',
  sent: '#3b82f6',
  partial: '#f59e0b',
  fully_paid: '#10b981',
  overdue: '#ef4444',
  cancelled: '#6b7280',
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function SubTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-2 mb-4">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            active === t.key
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [view, setView] = useState('sales')
  const [salesView, setSalesView] = useState('summary')
  const [financeView, setFinanceView] = useState('income_vs_expenses')
  const [projectsView, setProjectsView] = useState('overview')

  // Sales data
  const [invoicesSummary, setInvoicesSummary] = useState<any[]>([])
  const [invoicesDetail, setInvoicesDetail] = useState<any[]>([])

  // Finance data
  const [payments, setPayments] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])

  // Projects data
  const [projectsData, setProjectsData] = useState<any>(null)
  const [teamSummaryData, setTeamSummaryData] = useState<any[]>([])
  const [clientSummaryData, setClientSummaryData] = useState<any[]>([])

  const [leadsData, setLeadsData] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const load = async () => {
    setLoading(true)
    try {
      if (view === 'sales') {
        if (salesView === 'summary') {
          const r = await reportService.invoicesSummary({ year })
          setInvoicesSummary(r.data.data || [])
        } else {
          const r = await invoiceService.list({ limit: 200 })
          setInvoicesDetail(r.data.data || [])
        }
      } else if (view === 'finance') {
        const [pRes, eRes] = await Promise.all([
          paymentService.list({ limit: 500 }),
          expenseService.list({ limit: 500 }),
        ])
        setPayments(pRes.data.data || [])
        setExpenses(eRes.data.data || [])
      } else if (view === 'projects') {
        if (projectsView === 'overview') {
          const r = await reportService.projectsSummary()
          setProjectsData(r.data)
        } else if (projectsView === 'team_summary') {
          const [mRes, pRes, tRes] = await Promise.all([
            teamService.listMembers({ limit: 200 }),
            projectService.list({ limit: 200 }),
            taskService.list({ limit: 500 }),
          ])
          const members: any[] = mRes.data.data || []
          const projects: any[] = pRes.data.data || []
          const tasks: any[] = tRes.data.data || []

          const summary = members.map(m => {
            const mTasks = tasks.filter(t => t.assigned_to_id === m.id)
            return {
              id: m.id,
              name: m.name,
              avatar: m.avatar,
              job_title: m.job_title,
              open_projects: projects.filter(p => p.owner_id === m.id && p.status === 'open').length,
              completed_projects: projects.filter(p => p.owner_id === m.id && p.status === 'completed').length,
              hold_projects: projects.filter(p => p.owner_id === m.id && p.status === 'hold').length,
              open_tasks: mTasks.filter(t => t.status !== 'done').length,
              completed_tasks: mTasks.filter(t => t.status === 'done').length,
            }
          }).sort((a, b) => a.name.localeCompare(b.name))

          setTeamSummaryData(summary)
        } else {
          // clients_summary
          const [cRes, pRes, tRes] = await Promise.all([
            clientService.list({ limit: 200 }),
            projectService.list({ limit: 200 }),
            taskService.list({ limit: 500 }),
          ])
          const clients: any[] = cRes.data.data || []
          const projects: any[] = pRes.data.data || []
          const tasks: any[] = tRes.data.data || []

          const summary = clients.map(c => {
            const cProjects = projects.filter(p => p.client_id === c.id)
            const cProjectIds = new Set(cProjects.map((p: any) => p.id))
            const cTasks = tasks.filter(t => cProjectIds.has(t.project_id))
            return {
              id: c.id,
              name: c.name,
              open_projects: cProjects.filter(p => p.status === 'open').length,
              completed_projects: cProjects.filter(p => p.status === 'completed').length,
              hold_projects: cProjects.filter(p => p.status === 'hold').length,
              open_tasks: cTasks.filter(t => t.status !== 'done').length,
              completed_tasks: cTasks.filter(t => t.status === 'done').length,
            }
          }).sort((a, b) => a.name.localeCompare(b.name))

          setClientSummaryData(summary)
        }
      } else if (view === 'leads') {
        const r = await reportService.leadsSummary()
        setLeadsData(r.data.data || [])
      }
    } catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [view, salesView, financeView, projectsView, year])
  // reload finance when sub-view changes (data already loaded, no extra fetch needed)

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i))

  // ── Sales computed ──────────────────────────────────────────────
  const summaryTotals = invoicesSummary.reduce(
    (acc, r) => ({
      total: acc.total + (r.invoice_total || 0),
      received: acc.received + (r.payment_received || 0),
      due: acc.due + (r.due || 0),
    }),
    { total: 0, received: 0, due: 0 }
  )

  // ── Finance computed ────────────────────────────────────────────
  // Income vs Expenses: group by month for selected year
  const incomeVsExpenses = MONTHS.map((month, idx) => {
    const income = payments
      .filter(p => {
        const d = new Date(p.payment_date)
        return d.getFullYear() === Number(year) && d.getMonth() === idx
      })
      .reduce((s, p) => s + (p.amount || 0), 0)
    const expense = expenses
      .filter(e => {
        const d = new Date(e.date)
        return d.getFullYear() === Number(year) && d.getMonth() === idx
      })
      .reduce((s, e) => s + (e.total || e.amount || 0), 0)
    return { month, income, expense, net: income - expense }
  })

  const incomeTotal = incomeVsExpenses.reduce((s, r) => s + r.income, 0)
  const expenseTotal = incomeVsExpenses.reduce((s, r) => s + r.expense, 0)
  const netTotal = incomeTotal - expenseTotal

  // Expenses summary: group by category
  const expensesByCategory = expenses.reduce((acc: Record<string, number>, e) => {
    const cat = e.category || 'Other'
    acc[cat] = (acc[cat] || 0) + (e.total || e.amount || 0)
    return acc
  }, {})
  const expensesCategoryData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Reports</h1>
        <div className="flex items-center gap-2">
          {(view === 'sales' || view === 'finance') && (
            <select className="input input-sm w-28" value={year} onChange={e => setYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <button
            className="btn btn-secondary text-xs flex items-center gap-1"
            title="Export laporan ke CSV (bisa dibuka di Excel)"
            onClick={() => {
              const typeMap: Record<string, string> = { sales: 'invoices', finance: 'expenses', projects: 'projects', leads: 'leads', hr: 'timecards' }
              reportService.exportCSV(typeMap[view] || 'invoices', year)
            }}
          >
            <FileDown size={13} />
            Export Excel
          </button>
        </div>
      </div>

      <ViewTabs
        tabs={VIEWS}
        active={view}
        onChange={v => { setView(v); setSalesView('summary'); setFinanceView('income_vs_expenses'); setProjectsView('overview') }}
      />

      {loading ? <Loading /> : (
        <div>

          {/* ── SALES ─────────────────────────────────────────── */}
          {view === 'sales' && (
            <div>
              <SubTabs tabs={SALES_VIEWS} active={salesView} onChange={setSalesView} />

              {salesView === 'summary' && (
                <div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      { label: 'Total Invoiced', value: summaryTotals.total, color: 'text-blue-600' },
                      { label: 'Total Received', value: summaryTotals.received, color: 'text-green-600' },
                      { label: 'Total Due', value: summaryTotals.due, color: 'text-red-500' },
                    ].map(kpi => (
                      <div key={kpi.label} className="bg-white border border-gray-200 rounded-lg p-4">
                        <p className="text-xs text-gray-400 mb-1">{kpi.label} ({year})</p>
                        <p className={`text-xl font-bold ${kpi.color}`}>IDR {kpi.value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Sales by Client ({year})</h2>
                    {invoicesSummary.length === 0
                      ? <p className="text-sm text-gray-400 text-center py-8">No data for {year}</p>
                      : (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={invoicesSummary} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                            <XAxis dataKey="client_name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
                            <Tooltip formatter={(v: any) => `IDR ${Number(v).toLocaleString()}`} />
                            <Legend verticalAlign="top" />
                            <Bar dataKey="invoice_total" name="Total Invoiced" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="payment_received" name="Received" fill="#10b981" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="due" name="Due" fill="#ef4444" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )
                    }
                  </div>
                  {invoicesSummary.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="table">
                        <thead>
                          <tr><th>Client</th><th className="text-center">Invoices</th><th>Total Invoiced</th><th>Received</th><th>Due</th></tr>
                        </thead>
                        <tbody>
                          {invoicesSummary.map((row, i) => (
                            <tr key={i}>
                              <td className="font-medium">{row.client_name}</td>
                              <td className="text-center text-gray-400">{row.count}</td>
                              <td className="whitespace-nowrap">IDR {Number(row.invoice_total).toLocaleString()}</td>
                              <td className="whitespace-nowrap text-green-600">IDR {Number(row.payment_received).toLocaleString()}</td>
                              <td className="whitespace-nowrap text-red-500">IDR {Number(row.due).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold text-sm">
                          <tr>
                            <td>Total</td>
                            <td className="text-center">{invoicesSummary.reduce((a, r) => a + r.count, 0)}</td>
                            <td className="whitespace-nowrap text-blue-600">IDR {summaryTotals.total.toLocaleString()}</td>
                            <td className="whitespace-nowrap text-green-600">IDR {summaryTotals.received.toLocaleString()}</td>
                            <td className="whitespace-nowrap text-red-500">IDR {summaryTotals.due.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {salesView === 'detail' && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {invoicesDetail.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-8">No invoices found</p>
                    : (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Invoice #</th><th>Client</th><th>Project</th>
                            <th>Bill Date</th><th>Due Date</th>
                            <th>Total</th><th>Paid</th><th>Outstanding</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoicesDetail.map((inv: any) => (
                            <tr key={inv.id}>
                              <td className="font-mono text-xs font-medium">{inv.invoice_number}</td>
                              <td className="font-medium">{inv.client?.name || '-'}</td>
                              <td className="text-gray-500 text-xs max-w-[160px] truncate">{inv.project?.title || '-'}</td>
                              <td className="whitespace-nowrap text-xs text-gray-500">
                                {inv.bill_date ? new Date(inv.bill_date).toLocaleDateString('id-ID') : '-'}
                              </td>
                              <td className="whitespace-nowrap text-xs text-gray-500">
                                {inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '-'}
                              </td>
                              <td className="whitespace-nowrap text-xs">IDR {Number(inv.total_amount || 0).toLocaleString()}</td>
                              <td className="whitespace-nowrap text-xs text-green-600">IDR {Number(inv.paid_amount || 0).toLocaleString()}</td>
                              <td className="whitespace-nowrap text-xs text-red-500">IDR {Number(inv.due_amount || 0).toLocaleString()}</td>
                              <td>
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                                  style={{
                                    backgroundColor: (STATUS_COLORS[inv.status] || '#9ca3af') + '22',
                                    color: STATUS_COLORS[inv.status] || '#9ca3af',
                                  }}
                                >
                                  {inv.status?.replace('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold text-sm">
                          <tr>
                            <td colSpan={5}>Total ({invoicesDetail.length} invoices)</td>
                            <td className="whitespace-nowrap text-blue-600">
                              IDR {invoicesDetail.reduce((a: number, r: any) => a + (r.total_amount || 0), 0).toLocaleString()}
                            </td>
                            <td className="whitespace-nowrap text-green-600">
                              IDR {invoicesDetail.reduce((a: number, r: any) => a + (r.paid_amount || 0), 0).toLocaleString()}
                            </td>
                            <td className="whitespace-nowrap text-red-500">
                              IDR {invoicesDetail.reduce((a: number, r: any) => a + (r.due_amount || 0), 0).toLocaleString()}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    )
                  }
                </div>
              )}
            </div>
          )}

          {/* ── FINANCE ───────────────────────────────────────── */}
          {view === 'finance' && (
            <div>
              <SubTabs tabs={FINANCE_VIEWS} active={financeView} onChange={setFinanceView} />

              {/* Finance: Income vs Expenses */}
              {financeView === 'income_vs_expenses' && (
                <div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      { label: 'Total Income', value: incomeTotal, color: 'text-green-600', bg: 'border-green-200' },
                      { label: 'Total Expenses', value: expenseTotal, color: 'text-red-500', bg: 'border-red-200' },
                      {
                        label: 'Net Profit / Loss',
                        value: netTotal,
                        color: netTotal >= 0 ? 'text-blue-600' : 'text-red-600',
                        bg: netTotal >= 0 ? 'border-blue-200' : 'border-red-200',
                      },
                    ].map(kpi => (
                      <div key={kpi.label} className={`bg-white border rounded-lg p-4 ${kpi.bg}`}>
                        <p className="text-xs text-gray-400 mb-1">{kpi.label} ({year})</p>
                        <p className={`text-xl font-bold ${kpi.color}`}>IDR {kpi.value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Income vs Expenses per Month ({year})</h2>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={incomeVsExpenses} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v === 0 ? '0' : (v / 1e6).toFixed(0) + 'M'} />
                        <Tooltip formatter={(v: any) => `IDR ${Number(v).toLocaleString()}`} />
                        <Legend verticalAlign="top" />
                        <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Net Cash Flow ({year})</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={incomeVsExpenses} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v === 0 ? '0' : (v / 1e6).toFixed(0) + 'M'} />
                        <Tooltip formatter={(v: any) => `IDR ${Number(v).toLocaleString()}`} />
                        <Line type="monotone" dataKey="net" name="Net" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Finance: Expenses Summary */}
              {financeView === 'expenses_summary' && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Total Expenses (All Time)</p>
                      <p className="text-2xl font-bold text-red-500">
                        IDR {expenses.reduce((s, e) => s + (e.total || e.amount || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Categories</p>
                      <p className="text-2xl font-bold text-gray-800">{expensesCategoryData.length}</p>
                    </div>
                  </div>

                  {expensesCategoryData.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-8">No expenses data</p>
                    : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h2 className="text-sm font-semibold text-gray-700 mb-4">Expenses by Category</h2>
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie
                                data={expensesCategoryData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {expensesCategoryData.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: any) => `IDR ${Number(v).toLocaleString()}`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                          <table className="table">
                            <thead>
                              <tr><th>Category</th><th>Count</th><th>Total</th><th>%</th></tr>
                            </thead>
                            <tbody>
                              {expensesCategoryData.map((row, i) => {
                                const grandTotal = expenses.reduce((s, e) => s + (e.total || e.amount || 0), 0)
                                const pct = grandTotal > 0 ? ((row.value / grandTotal) * 100).toFixed(1) : '0'
                                const count = expenses.filter(e => (e.category || 'Other') === row.name).length
                                return (
                                  <tr key={i}>
                                    <td className="flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                      {row.name}
                                    </td>
                                    <td className="text-gray-400">{count}</td>
                                    <td className="whitespace-nowrap text-red-500">IDR {row.value.toLocaleString()}</td>
                                    <td className="text-gray-500">{pct}%</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot className="bg-gray-50 font-semibold text-sm">
                              <tr>
                                <td>Total</td>
                                <td>{expenses.length}</td>
                                <td className="whitespace-nowrap text-red-500">
                                  IDR {expenses.reduce((s, e) => s + (e.total || e.amount || 0), 0).toLocaleString()}
                                </td>
                                <td>100%</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )
                  }
                </div>
              )}

              {/* Finance: Payment Summary */}
              {financeView === 'payment_summary' && (
                <div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      { label: 'Total Payments', value: payments.length, isCurrency: false, color: 'text-gray-800' },
                      {
                        label: 'Total Received',
                        value: payments.reduce((s, p) => s + (p.amount || 0), 0),
                        isCurrency: true,
                        color: 'text-green-600',
                      },
                      {
                        label: 'Average Payment',
                        value: payments.length > 0
                          ? Math.round(payments.reduce((s, p) => s + (p.amount || 0), 0) / payments.length)
                          : 0,
                        isCurrency: true,
                        color: 'text-blue-600',
                      },
                    ].map(kpi => (
                      <div key={kpi.label} className="bg-white border border-gray-200 rounded-lg p-4">
                        <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
                        <p className={`text-xl font-bold ${kpi.color}`}>
                          {kpi.isCurrency ? `IDR ${kpi.value.toLocaleString()}` : kpi.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {payments.length === 0
                      ? <p className="text-sm text-gray-400 text-center py-8">No payments found</p>
                      : (
                        <table className="table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Invoice</th>
                              <th>Client</th>
                              <th>Payment Date</th>
                              <th>Method</th>
                              <th>Amount</th>
                              <th>Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((p: any, i: number) => (
                              <tr key={p.id}>
                                <td className="text-gray-400 text-xs">{i + 1}</td>
                                <td className="font-mono text-xs font-medium">
                                  {p.invoice?.invoice_number || `INV-${p.invoice_id}`}
                                </td>
                                <td className="font-medium">{p.invoice?.client?.name || '-'}</td>
                                <td className="whitespace-nowrap text-xs text-gray-500">
                                  {p.payment_date ? new Date(p.payment_date).toLocaleDateString('id-ID') : '-'}
                                </td>
                                <td>
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 capitalize">
                                    {p.payment_method || '-'}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap font-medium text-green-600">
                                  IDR {Number(p.amount || 0).toLocaleString()}
                                </td>
                                <td className="text-xs text-gray-400 max-w-[180px] truncate">{p.note || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 font-semibold text-sm">
                            <tr>
                              <td colSpan={5}>Total ({payments.length} payments)</td>
                              <td className="whitespace-nowrap text-green-600">
                                IDR {payments.reduce((s: number, p: any) => s + (p.amount || 0), 0).toLocaleString()}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      )
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PROJECTS ──────────────────────────────────────── */}
          {view === 'projects' && (
            <div>
              <SubTabs tabs={PROJECTS_VIEWS} active={projectsView} onChange={setProjectsView} />

              {/* Projects: Overview */}
              {projectsView === 'overview' && projectsData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Projects by Status</h2>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Open', value: projectsData.open },
                            { name: 'Completed', value: projectsData.completed },
                            { name: 'Hold', value: projectsData.hold },
                            { name: 'Cancelled', value: projectsData.cancelled },
                          ].filter(d => d.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {['#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map((color, i) => (
                            <Cell key={i} fill={color} />
                          ))}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Overview</h2>
                    <div className="space-y-3">
                      {[
                        { label: 'Open', value: projectsData.open, color: 'bg-blue-500' },
                        { label: 'Completed', value: projectsData.completed, color: 'bg-green-500' },
                        { label: 'On Hold', value: projectsData.hold, color: 'bg-yellow-500' },
                        { label: 'Cancelled', value: projectsData.cancelled, color: 'bg-red-500' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                          <span className="text-sm text-gray-600 flex-1">{item.label}</span>
                          <span className="text-sm font-semibold text-gray-800">{item.value}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm text-gray-500">Total</span>
                        <span className="text-sm font-bold text-gray-800">
                          {(projectsData.open || 0) + (projectsData.completed || 0) + (projectsData.hold || 0) + (projectsData.cancelled || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Projects: Team Members Summary */}
              {projectsView === 'team_summary' && (
                <div>
                  <p className="text-xs text-gray-400 mb-3">
                    Data member dari <span className="font-mono bg-gray-100 px-1 rounded">GET /api/v1/team/members</span>.
                    Projects dihitung berdasarkan <span className="font-mono bg-gray-100 px-1 rounded">owner_id</span>,
                    Tasks berdasarkan <span className="font-mono bg-gray-100 px-1 rounded">assigned_to_id</span>.
                  </p>
                  {teamSummaryData.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-8">No team members found</p>
                    : (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Team Member</th>
                              <th className="text-center text-blue-600">Open Projects</th>
                              <th className="text-center text-green-600">Completed Projects</th>
                              <th className="text-center text-yellow-600">Hold Projects</th>
                              <th className="text-center text-blue-500">Open Tasks</th>
                              <th className="text-center text-green-500">Completed Tasks</th>
                              <th className="text-center text-gray-500">Time Logged</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamSummaryData.map(m => (
                              <tr key={m.id}>
                                <td>
                                  <div className="flex items-center gap-2">
                                    {m.avatar
                                      ? <img src={m.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                                      : (
                                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                                          {m.name.charAt(0).toUpperCase()}
                                        </div>
                                      )
                                    }
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">{m.name}</p>
                                      <p className="text-xs text-gray-400">{m.job_title}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-center font-semibold text-blue-600">{m.open_projects}</td>
                                <td className="text-center font-semibold text-green-600">{m.completed_projects}</td>
                                <td className="text-center font-semibold text-yellow-600">{m.hold_projects}</td>
                                <td className="text-center font-semibold text-blue-500">{m.open_tasks}</td>
                                <td className="text-center font-semibold text-green-500">{m.completed_tasks}</td>
                                <td className="text-center text-gray-400 text-xs">00:00:00</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 font-semibold text-sm">
                            <tr>
                              <td>{teamSummaryData.length} Members</td>
                              <td className="text-center text-blue-600">{teamSummaryData.reduce((s, m) => s + m.open_projects, 0)}</td>
                              <td className="text-center text-green-600">{teamSummaryData.reduce((s, m) => s + m.completed_projects, 0)}</td>
                              <td className="text-center text-yellow-600">{teamSummaryData.reduce((s, m) => s + m.hold_projects, 0)}</td>
                              <td className="text-center text-blue-500">{teamSummaryData.reduce((s, m) => s + m.open_tasks, 0)}</td>
                              <td className="text-center text-green-500">{teamSummaryData.reduce((s, m) => s + m.completed_tasks, 0)}</td>
                              <td className="text-center text-gray-400">—</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )
                  }
                </div>
              )}

              {/* Projects: Clients Summary */}
              {projectsView === 'clients_summary' && (
                <div>
                  <p className="text-xs text-gray-400 mb-3">
                    Data client dari <span className="font-mono bg-gray-100 px-1 rounded">GET /api/v1/clients</span>.
                    Projects dihitung berdasarkan <span className="font-mono bg-gray-100 px-1 rounded">client_id</span>,
                    Tasks dihitung melalui project yang dimiliki client.
                  </p>
                  {clientSummaryData.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-8">No clients found</p>
                    : (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Client</th>
                              <th className="text-center text-blue-600">Open Projects</th>
                              <th className="text-center text-green-600">Completed Projects</th>
                              <th className="text-center text-yellow-600">Hold Projects</th>
                              <th className="text-center text-blue-500">Open Tasks</th>
                              <th className="text-center text-green-500">Completed Tasks</th>
                              <th className="text-center text-gray-500">Time Logged</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientSummaryData.map(c => (
                              <tr key={c.id}>
                                <td>
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
                                      {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => navigate('/clients/' + c.id)}>{c.name}</span>
                                  </div>
                                </td>
                                <td className="text-center font-semibold text-blue-600">{c.open_projects}</td>
                                <td className="text-center font-semibold text-green-600">{c.completed_projects}</td>
                                <td className="text-center font-semibold text-yellow-600">{c.hold_projects}</td>
                                <td className="text-center font-semibold text-blue-500">{c.open_tasks}</td>
                                <td className="text-center font-semibold text-green-500">{c.completed_tasks}</td>
                                <td className="text-center text-gray-400 text-xs">00:00:00</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 font-semibold text-sm">
                            <tr>
                              <td>{clientSummaryData.length} Clients</td>
                              <td className="text-center text-blue-600">{clientSummaryData.reduce((s, c) => s + c.open_projects, 0)}</td>
                              <td className="text-center text-green-600">{clientSummaryData.reduce((s, c) => s + c.completed_projects, 0)}</td>
                              <td className="text-center text-yellow-600">{clientSummaryData.reduce((s, c) => s + c.hold_projects, 0)}</td>
                              <td className="text-center text-blue-500">{clientSummaryData.reduce((s, c) => s + c.open_tasks, 0)}</td>
                              <td className="text-center text-green-500">{clientSummaryData.reduce((s, c) => s + c.completed_tasks, 0)}</td>
                              <td className="text-center text-gray-400">—</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )
                  }
                </div>
              )}
            </div>
          )}

          {/* ── LEADS ─────────────────────────────────────────── */}
          {view === 'leads' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Leads by Status</h2>
              {leadsData.length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">No leads data</p>
                : (
                  <div className="grid grid-cols-2 gap-4">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={leadsData} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90}
                          label={({ status, count }) => `${status}: ${count}`}>
                          {leadsData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {leadsData.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm text-gray-600 flex-1 capitalize">{row.status}</span>
                          <span className="text-sm font-semibold">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
            </div>
          )}

        </div>
      )}
    </div>
  )
}
