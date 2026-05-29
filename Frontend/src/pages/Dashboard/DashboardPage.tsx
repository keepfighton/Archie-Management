import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  CheckSquare,
  Clock,
  CreditCard,
  FolderKanban,
  MapPin,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import clsx from 'clsx'
import { toast } from 'react-toastify'
import { RootState, AppDispatch } from '@/store'
import { fetchMe, canRead } from '@/store/slices/authSlice'
import { dashboardService, taskService, projectService, teamService } from '@/services/api'
import { Loading, StatusBadge, ProgressBar, rowNumber, ClockInModal, WorkMode, getLocationWithFallback } from '@/components/common'
import { dashboardItem, findNavigationItemByMenu, navGroups } from '@/config/navigation'
import { formatIDR } from '@/utils/format'
import { useLocale } from '@/contexts/LocaleContext'

const TASK_COLORS = ['#f97316', '#3b82f6', '#10b981', '#ef4444']

const EMPTY_STATS = {
  range: '30d',
  open_tasks: 0,
  open_projects: 0,
  in_progress_projects: 0,
  completed_projects: 0,
  hold_projects: 0,
  cancelled_projects: 0,
  total_clients: 0,
  total_leads: 0,
  total_members: 0,
  due_amount: 0,
  total_income: 0,
  total_expenses: 0,
  tasks_todo: 0,
  tasks_in_progress: 0,
  tasks_done: 0,
  tasks_expired: 0,
  overdue_amount: 0,
  not_paid_amount: 0,
  partially_paid_amount: 0,
  fully_paid_amount: 0,
  draft_amount: 0,
  total_invoiced: 0,
  clocked_in_count: 0,
  on_leave_today: 0,
}

type DashboardStats = typeof EMPTY_STATS
type SectionKey = 'operations' | 'finance' | 'team'

type DashboardTask = {
  id: number
  title: string
  start_date?: string
  deadline?: string
  status: string
}

type DashboardProject = {
  id: number
  title: string
  progress: number
}

type SummaryTile = {
  label: string
  value: string | number
  hint: string
  menu: string
  section: SectionKey
}

type StatCard = SummaryTile & {
  icon: typeof CheckSquare
  iconClass: string
}

type QuickAccessItem = {
  menu: string
  titleKey: string
  title: string
  descriptionKey: string
  description: string
  icon: typeof CheckSquare
  section: SectionKey
}

const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  {
    menu: 'tasks',
    titleKey: 'dashboard.taskBoard',
    title: 'Task board',
    descriptionKey: 'dashboard.reviewAssignments',
    description: 'Review assignments and deadlines',
    icon: CheckSquare,
    section: 'operations',
  },
  {
    menu: 'projects',
    titleKey: 'dashboard.projectTracking',
    title: 'Project tracking',
    descriptionKey: 'dashboard.monitorProgress',
    description: 'Monitor progress and completion',
    icon: TrendingUp,
    section: 'operations',
  },
  {
    menu: 'sales.invoices',
    titleKey: 'dashboard.invoiceCenter',
    title: 'Invoice center',
    descriptionKey: 'dashboard.invoiceCenterDescription',
    description: 'Follow up billing and due amounts',
    icon: CreditCard,
    section: 'finance',
  },
  {
    menu: 'expenses',
    titleKey: 'dashboard.expenseLog',
    title: 'Expense log',
    descriptionKey: 'dashboard.expenseLogDescription',
    description: 'Review submitted operational costs',
    icon: Wallet,
    section: 'finance',
  },
  {
    menu: 'team.timecards',
    titleKey: 'dashboard.timeCards',
    title: 'Time cards',
    descriptionKey: 'dashboard.openAttendanceRecords',
    description: 'Open detailed attendance records',
    icon: Users,
    section: 'team',
  },
  {
    menu: 'team.leave',
    titleKey: 'dashboard.leaveRequests',
    title: 'Leave requests',
    descriptionKey: 'dashboard.leaveRequestsDescription',
    description: 'Track who is away today',
    icon: Calendar,
    section: 'team',
  },
]

function ClickableSummaryCard({
  label,
  value,
  hint,
  to,
  icon: Icon,
  iconClass,
}: {
  label: string
  value: string | number
  hint: string
  to?: string
  icon: typeof CheckSquare
  iconClass: string
}) {
  const content = (
    <div className="card-body flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className="mt-2 truncate text-2xl font-semibold text-gray-900">{value}</div>
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      </div>
      <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', iconClass)}>
        <Icon size={18} />
      </div>
    </div>
  )

  if (!to) {
    return <div className="card">{content}</div>
  }

  return (
    <Link to={to} className="card block transition hover:-translate-y-0.5 hover:shadow-md">
      {content}
    </Link>
  )
}

export default function DashboardPage() {
  const { user, permissions } = useSelector((s: RootState) => s.auth)
  const dispatch = useDispatch<AppDispatch>()
  const { t } = useLocale()
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [loading, setLoading] = useState(true)
  const [funnelData, setFunnelData] = useState<any>(null)
  const [clockLoading, setClockLoading] = useState(false)
  const [showClockInModal, setShowClockInModal] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [storedLocation, setStoredLocation] = useState<{ lat: number; lng: number; accuracy: number; distM: number } | null>(null)

  // South Quarter Tower A, TB Simatupang — 6°17'37"S, 106°46'52"E
  const OFFICE_LAT = -6.2936
  const OFFICE_LNG = 106.7811

  const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const handleRefreshLocation = async () => {
    setLocationLoading(true)
    try {
      const pos = await getLocationWithFallback()
      const distM = haversineM(pos.coords.latitude, pos.coords.longitude, OFFICE_LAT, OFFICE_LNG)
      setStoredLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, distM })
      const distStr = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`
      toast.success(`Lokasi tersimpan — ${distStr} dari kantor`)
    } catch {
      toast.error('Gagal mendapatkan lokasi. Aktifkan izin lokasi di browser.')
    } finally {
      setLocationLoading(false)
    }
  }

  const hasAccess = useCallback((menu: string) => (
    canRead(permissions, user?.role, menu)
  ), [permissions, user?.role])

  const canViewDashboard = hasAccess(dashboardItem.menu)
  const canViewTasks = hasAccess('tasks')
  const canViewProjects = hasAccess('projects')
  const canViewInvoices = hasAccess('sales.invoices')
  const canViewPayments = hasAccess('sales.payments')
  const canViewExpenses = hasAccess('expenses')
  const canViewTimecards = hasAccess('team.timecards')
  const canViewTeamMembers = hasAccess('team.members')
  const canViewLeave = hasAccess('team.leave')

  const canViewTeam = canViewTimecards || canViewTeamMembers || canViewLeave
  const tasksRoute = findNavigationItemByMenu('tasks')?.to || '/tasks'
  const projectsRoute = findNavigationItemByMenu('projects')?.to || '/projects'
  const invoicesRoute = findNavigationItemByMenu('sales.invoices')?.to || '/sales/invoices'
  const paymentsRoute = findNavigationItemByMenu('sales.payments')?.to || '/sales/payments'
  const expensesRoute = findNavigationItemByMenu('expenses')?.to || '/expenses'
  const teamMembersRoute = findNavigationItemByMenu('team.members')?.to || '/team/members'
  const timecardsRoute = findNavigationItemByMenu('team.timecards')?.to || '/team/timecards'
  const leaveRoute = findNavigationItemByMenu('team.leave')?.to || '/team/leave'

  const fallbackRoute = useMemo(() => {
    const visibleItem = [dashboardItem, ...navGroups.flatMap(group => group.items)]
      .find(item => !item.comingSoon && canRead(permissions, user?.role, item.menu))
    return visibleItem?.to ?? '/login'
  }, [permissions, user?.role])

  const matchesFocus = useCallback((_section: SectionKey) => true, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const taskParams: Record<string, string | number> = { limit: 5 }
      const projectParams: Record<string, string | number> = { limit: 3 }

      if (user?.id) taskParams.assigned_to_id = user.id
      projectParams.status = 'open'

      const [dashboardResponse, tasksResponse, projectsResponse] = await Promise.all([
        dashboardService.getStats({ range: '30d' }),
        canViewTasks
          ? taskService.list(taskParams)
          : Promise.resolve({ data: { data: [] as DashboardTask[] } }),
        canViewProjects
          ? projectService.list(projectParams)
          : Promise.resolve({ data: { data: [] as DashboardProject[] } }),
      ])

      setStats({ ...EMPTY_STATS, ...dashboardResponse.data })
      setTasks(tasksResponse.data.data || [])
      setProjects(projectsResponse.data.data || [])

      dashboardService.getFunnelStats()
        .then(r => setFunnelData(r.data || null))
        .catch(() => {})
    } catch (err: any) {
      setStats(EMPTY_STATS)
      setTasks([])
      setProjects([])
      toast.error(err.response?.data?.error || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [canViewProjects, canViewTasks, user?.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleClock = () => {
    if (!canViewTimecards) return
    if (user?.clocked_in) {
      setClockLoading(true)
      teamService.clockOut()
        .then(() => {
          toast.success(t('dashboard.clockOutSuccess', 'Clocked out successfully!'))
          return dispatch(fetchMe()).unwrap()
        })
        .then(() => loadData())
        .catch((err: any) => toast.error(err.response?.data?.error || t('dashboard.clockActionFailed', 'Clock action failed')))
        .finally(() => setClockLoading(false))
    } else {
      setShowClockInModal(true)
    }
  }

  const handleClockInConfirm = async (mode: WorkMode) => {
    setShowClockInModal(false)
    setClockLoading(true)
    try {
      let lat = 0, lng = 0, accuracy = 0
      if (mode === 'WFO') {
        try {
          const pos = await getLocationWithFallback()
          lat = pos.coords.latitude; lng = pos.coords.longitude; accuracy = pos.coords.accuracy
        } catch {
          toast.error('Izin lokasi diperlukan untuk mode WFO. Aktifkan lokasi di browser lalu coba lagi.')
          setClockLoading(false)
          return
        }
      } else {
        try {
          const pos = await getLocationWithFallback()
          lat = pos.coords.latitude; lng = pos.coords.longitude; accuracy = pos.coords.accuracy
        } catch { /* lokasi opsional untuk WFA/WFH */ }
      }
      await teamService.clockIn({ work_mode: mode, latitude: lat, longitude: lng, location_accuracy: accuracy })
      toast.success(t('dashboard.clockInSuccess', 'Clocked in successfully!') + ` (${mode})`)
      await dispatch(fetchMe()).unwrap()
      await loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('dashboard.clockActionFailed', 'Clock action failed'))
    } finally {
      setClockLoading(false)
    }
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return t('dashboard.greetingMorning', 'Good morning')
    if (hour < 17) return t('dashboard.greetingAfternoon', 'Good afternoon')
    return t('dashboard.greetingEvening', 'Good evening')
  }

  const taskChartData = [
    { name: t('dashboard.toDo', 'To do'), value: stats.tasks_todo ?? 0 },
    { name: t('dashboard.inProgress', 'In progress'), value: stats.tasks_in_progress ?? 0 },
    { name: t('dashboard.done', 'Done'), value: stats.tasks_done ?? 0 },
    { name: t('dashboard.expired', 'Expired'), value: stats.tasks_expired ?? 0 },
  ]

  const visibleIncome = canViewPayments ? (stats.total_income ?? 0) : 0
  const visibleExpenses = canViewExpenses ? (stats.total_expenses ?? 0) : 0
  const incomeExpenseData = [
    { value: visibleIncome },
    { value: visibleExpenses },
  ]
  const totalIE = visibleIncome + visibleExpenses
  const incomePercent = totalIE > 0 ? Math.round((visibleIncome / totalIE) * 100) : 0

  const invoiceRows = [
    { label: t('dashboard.overdue', 'Overdue'), color: '#c0392b', val: stats.overdue_amount ?? 0 },
    { label: t('dashboard.notPaid', 'Not paid'), color: '#d97706', val: stats.not_paid_amount ?? 0 },
    { label: t('dashboard.partiallyPaid', 'Partially paid'), color: '#2980b9', val: stats.partially_paid_amount ?? 0 },
    { label: t('dashboard.fullyPaid', 'Fully paid'), color: '#1e8449', val: stats.fully_paid_amount ?? 0 },
    { label: t('dashboard.draft', 'Draft'), color: '#94a3b8', val: stats.draft_amount ?? 0 },
  ]

  const projectTotal =
    (stats.open_projects ?? 0) +
    (stats.in_progress_projects ?? 0) +
    (stats.completed_projects ?? 0) +
    (stats.hold_projects ?? 0) +
    (stats.cancelled_projects ?? 0)
  const projectCompletion = projectTotal > 0
    ? Math.round(((stats.completed_projects ?? 0) / projectTotal) * 100)
    : 0
  const clockedOut = Math.max((stats.total_members ?? 0) - (stats.clocked_in_count ?? 0), 0)

  const summaryTiles: SummaryTile[] = [
    {
      label: t('dashboard.taskHealth', 'Task health'),
      value: stats.open_tasks ?? 0,
      hint: t('dashboard.openTaskAssignedToYou', 'Open task assigned to you'),
      menu: 'tasks',
      section: 'operations',
    },
    {
      label: t('dashboard.projectPace', 'Project pace'),
      value: `${projectCompletion}%`,
      hint: t('dashboard.completionAcrossTrackedProjects', 'Completion across tracked projects'),
      menu: 'projects',
      section: 'operations',
    },
    {
      label: t('dashboard.teamOnSite', 'Team on site'),
      value: stats.clocked_in_count ?? 0,
      hint: t('dashboard.currentlyClockedInToday', 'Currently clocked in today'),
      menu: 'team.timecards',
      section: 'team',
    },
    {
      label: t('dashboard.billingDue', 'Billing due'),
      value: formatIDR(stats.due_amount ?? 0),
      hint: t('dashboard.outstandingAmount', 'Outstanding amount in current period'),
      menu: 'sales.invoices',
      section: 'finance',
    },
  ]

  const statCards: StatCard[] = [
    {
      label: t('dashboard.stat.myOpenTasks', 'My open tasks'),
      value: stats.open_tasks ?? 0,
      hint: t('dashboard.stat.inProgressHint', '{count} in progress', { count: stats.tasks_in_progress ?? 0 }),
      menu: 'tasks',
      section: 'operations',
      icon: CheckSquare,
      iconClass: 'bg-blue-50 text-blue-700',
    },
    {
      label: t('dashboard.stat.openProjects', 'Open projects'),
      value: stats.open_projects ?? 0,
      hint: t('dashboard.stat.completedHint', '{count} completed', { count: stats.completed_projects ?? 0 }),
      menu: 'projects',
      section: 'operations',
      icon: FolderKanban,
      iconClass: 'bg-sky-50 text-sky-700',
    },
    {
      label: t('dashboard.stat.onLeaveToday', 'On leave today'),
      value: stats.on_leave_today ?? 0,
      hint: t('dashboard.stat.totalMembersHint', '{count} total members', { count: stats.total_members ?? 0 }),
      menu: 'team.leave',
      section: 'team',
      icon: Calendar,
      iconClass: 'bg-amber-50 text-amber-700',
    },
    {
      label: t('dashboard.stat.dueAmount', 'Due amount'),
      value: formatIDR(stats.due_amount ?? 0),
      hint: t('dashboard.stat.invoicedHint', '{amount} invoiced', { amount: formatIDR(stats.total_invoiced ?? 0) }),
      menu: 'sales.invoices',
      section: 'finance',
      icon: CreditCard,
      iconClass: 'bg-rose-50 text-rose-700',
    },
  ]

  const visibleSummaryTiles = summaryTiles.filter(tile => hasAccess(tile.menu) && matchesFocus(tile.section))
  const visibleStatCards = statCards.filter(card => hasAccess(card.menu) && matchesFocus(card.section))

  const quickAccessLinks = QUICK_ACCESS_ITEMS
    .map(item => {
      const navItem = findNavigationItemByMenu(item.menu)
      return navItem ? { ...item, to: navItem.to } : null
    })
    .filter((item): item is QuickAccessItem & { to: string } => (
      !!item && hasAccess(item.menu) && matchesFocus(item.section)
    ))

  const showAttendanceCard = canViewTimecards && matchesFocus('team')
  const showProjectsOverview = canViewProjects && matchesFocus('operations')
  const showInvoiceOverview = canViewInvoices && matchesFocus('finance')
  const showIncomeExpenseOverview = (canViewPayments || canViewExpenses) && matchesFocus('finance')
  const showTaskOverview = canViewTasks && matchesFocus('operations')
  const showTeamOverview = canViewTeam && matchesFocus('team')
  const showTaskTable = canViewTasks && matchesFocus('operations')
  const showProjectList = canViewProjects && matchesFocus('operations')
  const teamPrimaryRoute = canViewTeamMembers ? teamMembersRoute : canViewTimecards ? timecardsRoute : leaveRoute
  const attendanceRoute = canViewTimecards ? timecardsRoute : teamPrimaryRoute

  const hasVisibleContent = [
    visibleSummaryTiles.length > 0,
    visibleStatCards.length > 0,
    showAttendanceCard,
    showProjectsOverview,
    showInvoiceOverview,
    showIncomeExpenseOverview,
    showTaskOverview,
    showTeamOverview,
    quickAccessLinks.length > 0,
    showTaskTable,
    showProjectList,
  ].some(Boolean)

  if (!canViewDashboard) {
    return <Navigate to={fallbackRoute} replace />
  }

  if (loading) return <div className="p-6"><Loading /></div>

  return (
    <div className="space-y-5 p-5 md:p-6">
      {/* Daily Overview - Full Width */}
      <section>
        <div className="overflow-hidden rounded-[22px] bg-gradient-to-br from-primary via-primary to-[#236fa0] text-white shadow-[0_24px_70px_rgba(20,64,94,0.28)]">
          <div className="flex h-full flex-col justify-between gap-6 p-6 md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{t('dashboard.dailyOverview', 'Daily overview')}</p>
                <h2 className="mt-2 text-[32px] font-bold leading-tight">
                  {greeting()}, {user?.name?.split(' ')[0] || t('dashboard.teamFallback', 'Team')}.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
                  {t('dashboard.overviewDescription', 'We have condensed today\'s work so you can review tasks, projects, billing, and team status without jumping between pages.')}
                </p>
              </div>

              {null}
            </div>

            {visibleSummaryTiles.length > 0 ? (
              <div className={clsx(
                'grid gap-3',
                visibleSummaryTiles.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' :
                visibleSummaryTiles.length === 3 ? 'sm:grid-cols-3' :
                'sm:grid-cols-2'
              )}>
                {visibleSummaryTiles.map(tile => {
                  const navItem = findNavigationItemByMenu(tile.menu)
                  const tileContent = (
                    <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur-sm transition hover:bg-white/14">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">{tile.label}</p>
                      <div className="mt-2 text-2xl font-semibold">{tile.value}</div>
                      <p className="mt-1 text-xs text-white/68">{tile.hint}</p>
                    </div>
                  )

                  return navItem ? (
                    <Link key={tile.label} to={navItem.to} className="block">
                      {tileContent}
                    </Link>
                  ) : (
                    <div key={tile.label}>{tileContent}</div>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Attendance Section - Below Daily Overview */}
      {showAttendanceCard ? (
        <section>
          <div className="card border-primary/10 bg-white shadow-md">
            <div className="card-header border-b-primary/10 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/55">{t('dashboard.attendance', 'Attendance')}</p>
                  <h3 className="mt-1 text-base font-semibold text-gray-900">{t('dashboard.todayStatus', 'Today status')}</h3>
                </div>
                <div className={clsx(
                  'rounded-full px-3 py-1.5 text-xs font-semibold',
                  user?.clocked_in ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                )}>
                  {user?.clocked_in ? 'Clocked In' : 'Clocked Out'}
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="grid gap-4 md:grid-cols-3">
                {/* Your Session */}
                <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 p-5 border border-blue-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Your session</p>
                      <div className="mt-2 text-2xl font-bold text-blue-900">
                        {user?.clocked_in ? 'Active now' : 'Not started'}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-blue-700">
                        {user?.clocked_in
                          ? 'You are currently clocked in. Remember to clock out when done.'
                          : 'Start your workday to sync timesheet and attendance.'}
                      </p>
                    </div>
                    <div className="ml-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                      <Clock size={20} />
                    </div>
                  </div>
                </div>

                {/* Team Overview */}
                <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 p-5 border border-amber-200">
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Team overview</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-2xl font-bold text-amber-900">{stats.clocked_in_count ?? 0}</div>
                      <div className="mt-1 text-xs text-amber-700">Clocked in</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-900">{clockedOut}</div>
                      <div className="mt-1 text-xs text-amber-700">Clocked out</div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-amber-700">Total team: {stats.total_members ?? 0}</p>
                </div>

                {/* Quick Action */}
                <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 p-5 border border-primary-200">
                  <p className="text-xs font-medium text-primary-700 uppercase tracking-wide">Quick action</p>
                  <div className="mt-4 flex flex-col gap-3">
                    {!user?.clocked_in && (
                      <button
                        onClick={handleRefreshLocation}
                        disabled={locationLoading}
                        className="flex items-center justify-center gap-2 rounded-lg border border-primary-300 bg-white px-4 py-2 text-xs font-medium text-primary-700 transition hover:bg-primary-50 disabled:opacity-60"
                      >
                        <RefreshCw size={13} className={locationLoading ? 'animate-spin' : ''} />
                        {locationLoading ? 'Mengambil lokasi...' : 'Refresh Lokasi'}
                      </button>
                    )}
                    {!user?.clocked_in && storedLocation && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
                        <MapPin size={12} className="shrink-0 text-green-500" />
                        <span>
                          Lokasi tersimpan ✓{' '}
                          <span className="text-green-500">
                            ({storedLocation.distM >= 1000
                              ? `${(storedLocation.distM / 1000).toFixed(1)} km`
                              : `${Math.round(storedLocation.distM)} m`} dari kantor)
                          </span>
                        </span>
                      </div>
                    )}
                    <button
                      onClick={handleClock}
                      disabled={clockLoading}
                      className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-[#1e5a7d] px-4 py-3 text-sm font-semibold text-white transition hover:shadow-lg disabled:opacity-60"
                    >
                      <Clock size={16} />
                      {clockLoading
                        ? t('dashboard.updating', 'Updating...')
                        : user?.clocked_in
                          ? t('dashboard.clockOut', 'Clock Out')
                          : t('dashboard.clockIn', 'Clock In')}
                    </button>
                    <Link
                      to={timecardsRoute}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary-300 bg-white px-4 py-2 text-xs font-medium text-primary-700 transition hover:bg-primary-50"
                    >
                      <Users size={14} />
                      View time cards
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── SALES INTELLIGENCE ──────────────────────── */}
      {funnelData && (() => {
        const rp = (n: number) => `Rp${Number(n||0).toLocaleString('id-ID')}`

        // ── Funnel layers ──
        const funnelLayers = [
          { label: 'Leads',         value: funnelData.leads_value,        count: funnelData.leads_count,        color: '#7dd3fc' },
          { label: 'Proposal',      value: funnelData.proposals_value,    count: funnelData.proposals_count,    color: '#38bdf8' },
          { label: 'Negotiations',  value: funnelData.negotiations_value, count: funnelData.negotiations_count, color: '#0ea5e9' },
          { label: 'Contract/Won',  value: funnelData.won_value,          count: funnelData.won_count,          color: '#0369a1' },
          { label: 'Project',       value: funnelData.projects_value,     count: funnelData.projects_count,     color: '#1a5276' },
        ]
        const maxCount = Math.max(...funnelLayers.map(l => l.count || 1), 1)
        const minW = 28
        const widths = funnelLayers.map(l => minW + ((l.count / maxCount) * (100 - minW)))

        // ── Leads bar chart data ──
        const LEAD_STATUSES = ['new','qualified','discussion','negotiation','won','lost']
        const LEAD_LABELS: Record<string,string> = { new:'New', qualified:'Qualified', discussion:'Discussion', negotiation:'Negotiation', won:'Won', lost:'Lost' }
        const leadsBar = LEAD_STATUSES.map(s => ({
          name: LEAD_LABELS[s],
          jumlah: (funnelData.leads_by_status || []).find((x: any) => x.status === s)?.count || 0,
        }))

        // ── Proposal pie chart data ──
        const PROP_STATUSES = ['draft','sent','accepted','rejected','expired','converted']
        const PROP_LABELS: Record<string,string> = { draft:'Draft', sent:'Sent', accepted:'Accepted', rejected:'Rejected', expired:'Expired', converted:'Converted' }
        const PROP_COLORS = ['#94a3b8','#60a5fa','#34d399','#f87171','#fb923c','#1a5276']
        const proposalPie = PROP_STATUSES.map((s, i) => ({
          name: PROP_LABELS[s],
          value: (funnelData.proposals_by_status || []).find((x: any) => x.status === s)?.count || 0,
          color: PROP_COLORS[i],
        })).filter(d => d.value > 0)

        return (
          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.95fr_0.95fr]">

            {/* SALES FUNNEL */}
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Sales</p>
                  <span className="section-title">Sales Funnel</span>
                </div>
                <p className="text-xs text-gray-400">From Prospect to Contract.</p>
              </div>
              <div className="card-body py-3 px-2">
                {(() => {
                  const W = 300, LH = 48, GAP = 3
                  const cx = W / 2
                  const getTopW = (i: number) => widths[i] * W / 100
                  const getBotW = (i: number) => i < funnelLayers.length - 1
                    ? widths[i + 1] * W / 100
                    : widths[i] * 0.78 * W / 100
                  const totalH = funnelLayers.length * (LH + GAP) - GAP
                  return (
                    <svg viewBox={`0 0 ${W} ${totalH}`} width="100%" style={{ display: 'block' }}>
                      <defs>
                        <filter id="fnl-ts" x="-20%" y="-40%" width="140%" height="180%">
                          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.35"/>
                        </filter>
                      </defs>
                      {funnelLayers.map((layer, i) => {
                        const tw = getTopW(i), bw = getBotW(i)
                        const y = i * (LH + GAP)
                        const tlx = cx - tw / 2, trx = cx + tw / 2
                        const blx = cx - bw / 2, brx = cx + bw / 2
                        const pts = `${tlx},${y} ${trx},${y} ${brx},${y + LH} ${blx},${y + LH}`
                        const line2 = layer.value > 0
                          ? `${rp(layer.value)} (${layer.count} ${i === 4 ? 'projects' : 'items'})`
                          : `${layer.count} ${i === 4 ? 'projects' : 'items'}`
                        return (
                          <g key={layer.label}>
                            <polygon points={pts} fill={layer.color} />
                            <text x={cx} y={y + LH / 2 - 7} textAnchor="middle" dominantBaseline="middle"
                              fontSize="11.5" fontWeight="800" fill="white" filter="url(#fnl-ts)">
                              {layer.label}
                            </text>
                            <text x={cx} y={y + LH / 2 + 8} textAnchor="middle" dominantBaseline="middle"
                              fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.9)" filter="url(#fnl-ts)">
                              {line2}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  )
                })()}
              </div>
            </div>

            {/* LEADS MONITORING */}
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Leads</p>
                  <span className="section-title">Leads Monitoring</span>
                </div>
              </div>
              <div className="card-body p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={leadsBar} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip formatter={(v: any) => [v, 'Jumlah']} />
                    <Bar dataKey="jumlah" radius={[4,4,0,0]}>
                      {leadsBar.map((_, i) => (
                        <Cell key={i} fill={['#60a5fa','#34d399','#fbbf24','#f97316','#1a5276','#f87171'][i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PROPOSAL MONITORING */}
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Proposals</p>
                  <span className="section-title">Proposal Monitoring</span>
                </div>
              </div>
              <div className="card-body flex flex-col items-center p-3">
                <PieChart width={200} height={200}>
                  <Pie data={proposalPie} cx={100} cy={95} innerRadius={50} outerRadius={90} dataKey="value" paddingAngle={2}>
                    {proposalPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [v, n]} />
                </PieChart>
                <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
                  {proposalPie.map(d => (
                    <span key={d.name} className="flex items-center gap-1 text-[10px] text-gray-500">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name} ({d.value})
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </section>
        )
      })()}

      {visibleStatCards.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleStatCards.map(card => (
            <ClickableSummaryCard
              key={card.label}
              label={card.label}
              value={card.value}
              hint={card.hint}
              icon={card.icon}
              iconClass={card.iconClass}
              to={findNavigationItemByMenu(card.menu)?.to}
            />
          ))}
        </section>
      ) : null}

      {(showProjectsOverview || showInvoiceOverview || showIncomeExpenseOverview) ? (
        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr_0.95fr]">
          {showProjectsOverview ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Projects</p>
                  <span className="section-title">Projects overview</span>
                </div>
                <Link to={projectsRoute} className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-5 gap-2 text-center">
                  <Link to={`${projectsRoute}?status=open`} className="rounded-xl bg-slate-50 px-2 py-3 transition hover:bg-slate-100">
                    <div className="text-xl font-semibold text-primary">{stats.open_projects ?? 0}</div>
                    <div className="mt-1 text-[11px] text-gray-500">Open</div>
                  </Link>
                  <Link to={`${projectsRoute}?status=in_progress`} className="rounded-xl bg-blue-50 px-2 py-3 transition hover:bg-blue-100">
                    <div className="text-xl font-semibold text-blue-600">{stats.in_progress_projects ?? 0}</div>
                    <div className="mt-1 text-[11px] text-gray-500">On Progress</div>
                  </Link>
                  <Link to={`${projectsRoute}?status=completed`} className="rounded-xl bg-emerald-50 px-2 py-3 transition hover:bg-emerald-100">
                    <div className="text-xl font-semibold text-emerald-700">{stats.completed_projects ?? 0}</div>
                    <div className="mt-1 text-[11px] text-gray-500">Complete</div>
                  </Link>
                  <Link to={`${projectsRoute}?status=hold`} className="rounded-xl bg-amber-50 px-2 py-3 transition hover:bg-amber-100">
                    <div className="text-xl font-semibold text-amber-600">{stats.hold_projects ?? 0}</div>
                    <div className="mt-1 text-[11px] text-gray-500">On Hold</div>
                  </Link>
                  <Link to={`${projectsRoute}?status=cancelled`} className="rounded-xl bg-red-50 px-2 py-3 transition hover:bg-red-100">
                    <div className="text-xl font-semibold text-red-500">{stats.cancelled_projects ?? 0}</div>
                    <div className="mt-1 text-[11px] text-gray-500">Cancelled</div>
                  </Link>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Completion rate</span>
                    <span className="font-semibold text-gray-800">{projectCompletion}%</span>
                  </div>
                  <ProgressBar value={projectCompletion} />
                </div>
              </div>
            </div>
          ) : <div className="hidden xl:block" />}

          {showInvoiceOverview ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Finance</p>
                  <span className="section-title">Invoice overview</span>
                </div>
                <Link to={invoicesRoute} className="text-xs font-medium text-primary hover:underline">
                  View invoices
                </Link>
              </div>
              <div className="card-body space-y-2.5">
                {invoiceRows.map(item => (
                  <Link
                    key={item.label}
                    to={invoicesRoute}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs transition hover:bg-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-gray-600">{item.label}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{formatIDR(item.val)}</span>
                  </Link>
                ))}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                  <span className="text-gray-500">Total invoiced</span>
                  <span className="font-semibold text-gray-900">{formatIDR(stats.total_invoiced ?? 0)}</span>
                </div>
              </div>
            </div>
          ) : <div className="hidden xl:block" />}

          {showIncomeExpenseOverview ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Flow</p>
                  <span className="section-title">Income vs expenses</span>
                </div>
              </div>
              <div className="card-body flex items-center gap-4">
                <div className="relative">
                  <PieChart width={112} height={112}>
                    <Pie
                      data={incomeExpenseData}
                      dataKey="value"
                      cx={56}
                      cy={56}
                      innerRadius={30}
                      outerRadius={46}
                      strokeWidth={3}
                    >
                      <Cell fill="#2980b9" />
                      <Cell fill="#c0392b" />
                    </Pie>
                    <Tooltip formatter={(v: number) => formatIDR(v)} contentStyle={{ fontSize: 10 }} />
                  </PieChart>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Income</span>
                    <span className="text-sm font-semibold text-gray-900">{incomePercent}%</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  {canViewPayments ? (
                    <Link to={paymentsRoute} className="block rounded-lg bg-slate-50 px-3 py-2 text-xs transition hover:bg-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#2980b9]" />
                        <span className="text-gray-500">Income</span>
                      </div>
                      <div className="mt-1 font-semibold text-gray-900">{formatIDR(stats.total_income ?? 0)}</div>
                    </Link>
                  ) : null}
                  {canViewExpenses ? (
                    <Link to={expensesRoute} className="block rounded-lg bg-slate-50 px-3 py-2 text-xs transition hover:bg-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#c0392b]" />
                        <span className="text-gray-500">Expenses</span>
                      </div>
                      <div className="mt-1 font-semibold text-gray-900">{formatIDR(stats.total_expenses ?? 0)}</div>
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : <div className="hidden xl:block" />}
        </section>
      ) : null}

      {(showTaskOverview || showTeamOverview || quickAccessLinks.length > 0) ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr_0.9fr]">
          {showTaskOverview ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Tasks</p>
                  <span className="section-title">All task overview</span>
                </div>
                <Link to={tasksRoute} className="text-xs font-medium text-primary hover:underline">
                  View tasks
                </Link>
              </div>
              <div className="card-body flex flex-col gap-4 sm:flex-row sm:items-center">
                <PieChart width={112} height={112}>
                  <Pie data={taskChartData} dataKey="value" cx={56} cy={56} innerRadius={30} outerRadius={46} strokeWidth={3}>
                    {taskChartData.map((_, i) => <Cell key={i} fill={TASK_COLORS[i]} />)}
                  </Pie>
                </PieChart>

                <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
                  {taskChartData.map((item, i) => (
                    <Link key={item.name} to={tasksRoute} className="rounded-lg bg-slate-50 px-3 py-2 transition hover:bg-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: TASK_COLORS[i] }} />
                        <span className="text-gray-500">{item.name}</span>
                      </div>
                      <div className="mt-1 text-base font-semibold text-gray-900">{item.value}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : <div className="hidden xl:block" />}

          {showTeamOverview ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Team</p>
                  <span className="section-title">Team overview</span>
                </div>
                <Link
                  to={teamPrimaryRoute}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open module
                </Link>
              </div>
              <div className="card-body space-y-3">
                {(canViewTeamMembers || canViewLeave) ? (
                  <div className={clsx('grid gap-3', canViewTeamMembers && canViewLeave ? 'grid-cols-2' : 'grid-cols-1')}>
                    {canViewTeamMembers ? (
                      <Link
                        to={teamMembersRoute}
                        className="rounded-xl bg-slate-50 p-3 text-center transition hover:bg-slate-100"
                      >
                        <div className="text-xl font-semibold text-gray-900">{stats.total_members ?? 0}</div>
                        <div className="mt-1 text-xs text-gray-500">Members</div>
                      </Link>
                    ) : null}
                    {canViewLeave ? (
                      <Link
                        to={leaveRoute}
                        className="rounded-xl bg-amber-50 p-3 text-center transition hover:bg-amber-100"
                      >
                        <div className="text-xl font-semibold text-amber-700">{stats.on_leave_today ?? 0}</div>
                        <div className="mt-1 text-xs text-gray-500">On leave</div>
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                {canViewTimecards ? (
                  <div className="space-y-2">
                    <Link to={attendanceRoute} className="block rounded-xl border border-emerald-100 bg-emerald-50 p-3 transition hover:bg-emerald-100">
                      <div className="text-xs text-emerald-700">Clocked in</div>
                      <div className="mt-1 text-lg font-semibold text-emerald-800">{stats.clocked_in_count ?? 0}</div>
                    </Link>
                    <Link to={attendanceRoute} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:bg-slate-100">
                      <div className="text-xs text-slate-600">Clocked out</div>
                      <div className="mt-1 text-lg font-semibold text-slate-800">{clockedOut}</div>
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50 p-3 text-xs text-gray-500">
                    Team metrics shown here follow your visible team modules.
                  </div>
                )}
              </div>
            </div>
          ) : <div className="hidden xl:block" />}

          {quickAccessLinks.length > 0 ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Performance</p>
                  <span className="section-title">Quick access</span>
                </div>
              </div>
              <div className="card-body space-y-3">
                {quickAccessLinks.map(item => {
                  const Icon = item.icon
                  return (
                    <Link key={item.menu} to={item.to} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                          <div className="text-xs text-gray-500">{item.description}</div>
                        </div>
                      </div>
                      <ArrowRight size={15} className="text-gray-400" />
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : <div className="hidden xl:block" />}
        </section>
      ) : null}

      {(showTaskTable || showProjectList) ? (
        <section className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]">
          {showTaskTable ? (
            <div className="table-container">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Assignments</p>
                  <span className="section-title">My tasks</span>
                </div>
                <Link to={tasksRoute} className="text-xs font-medium text-primary hover:underline">View all</Link>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-16">No.</th>
                    <th>Title</th>
                    <th>Start date</th>
                    <th>Deadline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-gray-400">No tasks found</td>
                    </tr>
                  ) : tasks.map((task, index) => (
                    <tr key={task.id}>
                      <td className="text-gray-400">{rowNumber(1, index, tasks.length || 1)}</td>
                      <td>
                        <Link to={tasksRoute} className="font-medium text-primary hover:underline">
                          {task.title}
                        </Link>
                      </td>
                      <td className="text-gray-500">
                        {task.start_date ? new Date(task.start_date).toLocaleDateString('id') : '-'}
                      </td>
                      <td className={clsx('text-gray-500', task.deadline && new Date(task.deadline) < new Date() && 'text-red-600')}>
                        {task.deadline ? new Date(task.deadline).toLocaleDateString('id') : '-'}
                      </td>
                      <td><StatusBadge status={task.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="hidden xl:block" />}

          {showProjectList ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">Pipeline</p>
                  <span className="section-title">Project snapshot</span>
                </div>
                <Link to={projectsRoute} className="text-xs font-medium text-primary hover:underline">View all</Link>
              </div>
              <div className="card-body space-y-3">
                {projects.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">No matching projects</div>
                ) : projects.map(project => (
                  <Link key={project.id} to={`/projects/${project.id}`} className="block rounded-xl border border-gray-200 bg-slate-50 p-3 transition hover:bg-slate-100">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-primary">{project.title}</span>
                      <span className="text-xs font-semibold text-gray-500">{project.progress}%</span>
                    </div>
                    <ProgressBar value={project.progress} />
                  </Link>
                ))}
              </div>
            </div>
          ) : <div className="hidden xl:block" />}
        </section>
      ) : null}

      {!hasVisibleContent ? (
        <div className="card">
          <div className="card-body flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="text-base font-semibold text-gray-900">No dashboard widgets are available.</div>
            <p className="max-w-md text-sm text-gray-500">
              The modules shown here follow the current user permissions. Additional widgets will
              appear automatically when access is granted.
            </p>
          </div>
        </div>
      ) : null}

      <ClockInModal
        open={showClockInModal}
        onClose={() => setShowClockInModal(false)}
        onConfirm={handleClockInConfirm}
      />
    </div>
  )
}
