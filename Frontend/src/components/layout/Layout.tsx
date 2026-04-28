import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RootState, AppDispatch } from '@/store'
import { fetchMe, logoutAsync, canEdit, canRead } from '@/store/slices/authSlice'
import { setSidebar, toggleSidebar } from '@/store/slices/uiSlice'
import { auditService, teamService } from '@/services/api'
import { dashboardItem, navGroups } from '@/config/navigation'
import { useLocale } from '@/contexts/LocaleContext'
import nexoraLogoUrl from '../../../logo/Logo_Nexora_Part.png'
import {
  LayoutDashboard, Calendar, Users, FolderKanban, CheckSquare,
  TrendingUp, Menu, Search,
  Bell, Globe, Clock, Plus, LogOut, ChevronDown, ChevronRight, X, Megaphone,
  LogIn, Check
} from 'lucide-react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'react-toastify'

type HeaderPanel = 'search' | 'quick-add' | 'locale' | 'activity' | 'notifications' | null

type RecentVisit = {
  path: string
  label?: string
  visitedAt: string
}

type AnnouncementItem = {
  id: number
  title: string
  content?: string
  created_at: string
  start_date?: string
  end_date?: string
  created_by?: { name?: string }
}

type AuditItem = {
  id: number
  action: string
  entity_type: string
  entity_name?: string
  created_at: string
  user?: { name?: string }
}

type QuickAction = {
  id: string
  label: string
  description: string
  to: string
  menu: string
  icon: LucideIcon
}

type LocaleOption = {
  code: string
  labelKey: string
  descriptionKey: string
  fallbackLabel: string
  fallbackDescription: string
}

const RECENT_VISITS_KEY = 'nexone.recent-visits'
const ANNOUNCEMENTS_SEEN_KEY = 'nexone.announcements.last-seen'

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'task', label: 'New task', description: 'Create and assign a task', to: '/tasks', menu: 'tasks', icon: CheckSquare },
  { id: 'event', label: 'New event', description: 'Schedule a calendar entry', to: '/events', menu: 'events', icon: Calendar },
  { id: 'project', label: 'New project', description: 'Start a project workspace', to: '/projects', menu: 'projects', icon: FolderKanban },
  { id: 'client', label: 'New client', description: 'Add a relationship record', to: '/clients', menu: 'clients', icon: Users },
  { id: 'lead', label: 'New lead', description: 'Capture a potential deal', to: '/leads', menu: 'leads', icon: TrendingUp },
  { id: 'announcement', label: 'New announcement', description: 'Post an internal update', to: '/team/announcements', menu: 'team.announcements', icon: Megaphone },
]

const LOCALE_OPTIONS: LocaleOption[] = [
  {
    code: 'id-ID',
    labelKey: 'locale.id-id.label',
    descriptionKey: 'locale.id-id.description',
    fallbackLabel: 'Bahasa Indonesia',
    fallbackDescription: 'Default workspace formatting',
  },
  {
    code: 'en-US',
    labelKey: 'locale.en-us.label',
    descriptionKey: 'locale.en-us.description',
    fallbackLabel: 'English (US)',
    fallbackDescription: 'Month/day date format',
  },
  {
    code: 'en-GB',
    labelKey: 'locale.en-gb.label',
    descriptionKey: 'locale.en-gb.description',
    fallbackLabel: 'English (UK)',
    fallbackDescription: 'Day/month date format',
  },
]

const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  convert: 'Converted',
}

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  client: 'client',
  project: 'project',
  task: 'task',
  lead: 'lead',
  invoice: 'invoice',
  contract: 'contract',
}

function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const raw = window.localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function readStoredValue(key: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  return window.localStorage.getItem(key) || fallback
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatRelativeTime(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, 'minute')

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, 'hour')

  const diffDays = Math.round(diffHours / 24)
  return formatter.format(diffDays, 'day')
}

function isActiveAnnouncement(item: AnnouncementItem) {
  const now = Date.now()
  const start = item.start_date ? new Date(item.start_date).getTime() : null
  const end = item.end_date ? new Date(item.end_date).getTime() : null

  if (start && start > now) return false
  if (end && end < now) return false

  return true
}

export default function Layout() {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const location = useLocation()
  const { locale: selectedLocale, setLocale: setSelectedLocale, t } = useLocale()
  const { user, permissions } = useSelector((s: RootState) => s.auth)
  const { sidebarOpen } = useSelector((s: RootState) => s.ui)
  const [expanded, setExpanded] = useState<string[]>(() => {
    const active = navGroups.find(g =>
      g.items.some(item => location.pathname.startsWith(item.to))
    )
    return active ? [active.id] : ['business']
  })
  const [profileOpen, setProfileOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<HeaderPanel>(null)
  const [headerSearch, setHeaderSearch] = useState('')
  const [recentPages, setRecentPages] = useState<RecentVisit[]>(() => readStoredJson<RecentVisit[]>(RECENT_VISITS_KEY, []))
  const [clockLoading, setClockLoading] = useState(false)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityItems, setActivityItems] = useState<AuditItem[]>([])
  const [activityFailed, setActivityFailed] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [lastAnnouncementsSeenAt, setLastAnnouncementsSeenAt] = useState(() => readStoredValue(ANNOUNCEMENTS_SEEN_KEY, ''))
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true
  ))
  const profileRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const desktopSearchInputRef = useRef<HTMLInputElement>(null)

  const titleMap = [
    { key: '/dashboard', translationKey: 'page.dashboard', fallback: 'Dashboard' },
    { key: '/events', translationKey: 'page.events', fallback: 'Events' },
    { key: '/clients', translationKey: 'page.clients', fallback: 'Clients' },
    { key: '/projects', translationKey: 'page.projects', fallback: 'Projects' },
    { key: '/tasks', translationKey: 'page.tasks', fallback: 'Tasks' },
    { key: '/leads', translationKey: 'page.leads', fallback: 'Leads' },
    { key: '/sales/invoices', translationKey: 'page.invoices', fallback: 'Invoices' },
    { key: '/sales/orders', translationKey: 'page.orders', fallback: 'Orders' },
    { key: '/sales/store', translationKey: 'page.store', fallback: 'Store' },
    { key: '/sales/payments', translationKey: 'page.payments', fallback: 'Payments' },
    { key: '/sales/items', translationKey: 'page.items', fallback: 'Items' },
    { key: '/sales/contracts', translationKey: 'page.contracts', fallback: 'Contracts' },
    { key: '/notes', translationKey: 'page.notes', fallback: 'Notes' },
    { key: '/messages', translationKey: 'page.messages', fallback: 'Messages' },
    { key: '/team/members', translationKey: 'page.team', fallback: 'Team' },
    { key: '/team/timecards', translationKey: 'page.timecards', fallback: 'Time Cards' },
    { key: '/team/leave', translationKey: 'page.leave', fallback: 'Leave' },
    { key: '/team/announcements', translationKey: 'page.announcements', fallback: 'Announcements' },
    { key: '/team/help', translationKey: 'page.help', fallback: 'Help' },
    { key: '/files', translationKey: 'page.files', fallback: 'Files' },
    { key: '/expenses', translationKey: 'page.expenses', fallback: 'Expenses' },
    { key: '/reports', translationKey: 'page.reports', fallback: 'Reports' },
    { key: '/todo', translationKey: 'page.todo', fallback: 'To Do' },
    { key: '/settings/users', translationKey: 'page.userAccounts', fallback: 'User Accounts' },
    { key: '/settings/roles', translationKey: 'page.roles', fallback: 'Roles' },
    { key: '/settings/audit-log', translationKey: 'page.auditTrail', fallback: 'Audit Trail' },
    { key: '/assets', translationKey: 'page.assetManagement', fallback: 'Asset Management' },
  ]

  const getNavItemLabel = useCallback((item: { id: string, label: string }) => (
    t(`nav.${item.id}`, item.label)
  ), [t])

  const getNavGroupLabel = useCallback((group: { id: string, label: string }) => (
    t(`nav.group.${group.id}`, group.label)
  ), [t])

  const getPageTitle = useCallback((pathname: string) => {
    const match = titleMap.find(item => pathname.startsWith(item.key))
    return match
      ? t(match.translationKey, match.fallback)
      : t('layout.workspace', 'Workspace')
  }, [t])

  const pageTitle = getPageTitle(location.pathname)

  const searchableModules = useMemo(() => {
    const visibleItems = [
      ...(canRead(permissions, user?.role, dashboardItem.menu)
        ? [{
          to: dashboardItem.to,
          label: getNavItemLabel(dashboardItem),
          group: t('layout.workspace', 'Workspace'),
        }]
        : []),
      ...navGroups.flatMap(group => group.items
        .filter(item => !item.comingSoon && canRead(permissions, user?.role, item.menu))
        .map(item => ({
          to: item.to,
          label: getNavItemLabel(item),
          group: getNavGroupLabel(group),
        }))
      ),
    ]

    return visibleItems.filter((item, index, arr) =>
      arr.findIndex(candidate => candidate.to === item.to) === index
    )
  }, [getNavGroupLabel, getNavItemLabel, permissions, t, user?.role])

  const quickActions = useMemo(() => QUICK_ACTIONS
    .filter(action => canEdit(permissions, user?.role, action.menu))
    .map(action => ({
      ...action,
      label: t(`layout.quickAction.${action.id}.label`, action.label),
      description: t(`layout.quickAction.${action.id}.description`, action.description),
    })), [permissions, t, user?.role])

  const getRecentPageLabel = useCallback((item: RecentVisit) => {
    const translated = getPageTitle(item.path)
    return translated === t('layout.workspace', 'Workspace') && item.label
      ? item.label
      : translated
  }, [getPageTitle, t])

  const recentPageMatches = useMemo(() => {
    const query = headerSearch.trim().toLowerCase()
      const filtered = query
      ? recentPages.filter(item => getRecentPageLabel(item).toLowerCase().includes(query))
      : recentPages
    return filtered.slice(0, 5)
  }, [getRecentPageLabel, headerSearch, recentPages])

  const moduleMatches = useMemo(() => {
    const query = headerSearch.trim().toLowerCase()
    const filtered = query
      ? searchableModules.filter(item =>
        item.label.toLowerCase().includes(query) ||
        item.group.toLowerCase().includes(query)
      )
      : searchableModules

    return filtered.slice(0, 8)
  }, [headerSearch, searchableModules])

  const activeAnnouncements = useMemo(() => {
    const items = announcements.filter(isActiveAnnouncement)
    return (items.length > 0 ? items : announcements).slice(0, 5)
  }, [announcements])

  const unreadAnnouncements = useMemo(() => {
    const seenAt = lastAnnouncementsSeenAt ? new Date(lastAnnouncementsSeenAt).getTime() : 0
    return activeAnnouncements.filter(item => {
      const createdAt = new Date(item.created_at).getTime()
      return !Number.isNaN(createdAt) && createdAt > seenAt
    }).length
  }, [activeAnnouncements, lastAnnouncementsSeenAt])

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  useEffect(() => {
    const activeGroup = navGroups.find(group =>
      group.items.some(item => location.pathname.startsWith(item.to))
    )

    if (activeGroup) {
      setExpanded(prev => prev.includes(activeGroup.id) ? prev : [...prev, activeGroup.id])
    }
  }, [location.pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia('(min-width: 1024px)')
    const syncSidebar = (matches: boolean) => {
      setIsDesktop(matches)
      dispatch(setSidebar(matches))
    }

    syncSidebar(media.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      syncSidebar(event.matches)
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [dispatch])

  useEffect(() => {
    if (!isDesktop) {
      dispatch(setSidebar(false))
      setProfileOpen(false)
    }
  }, [dispatch, isDesktop, location.pathname])

  useEffect(() => {
    if (!profileOpen && !activePanel) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false)
      }
      if (controlsRef.current && !controlsRef.current.contains(target)) {
        setActivePanel(null)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false)
        setActivePanel(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [activePanel, profileOpen])

  useEffect(() => {
    setActivePanel(null)
    setHeaderSearch('')
    setProfileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setRecentPages(previous => {
      const nextVisits = [
        { path: location.pathname, label: pageTitle, visitedAt: new Date().toISOString() },
        ...previous.filter(item => item.path !== location.pathname),
      ].slice(0, 6)

      window.localStorage.setItem(RECENT_VISITS_KEY, JSON.stringify(nextVisits))
      return nextVisits
    })
  }, [location.pathname, pageTitle])

  useEffect(() => {
    if (activePanel === 'search' && isDesktop) {
      desktopSearchInputRef.current?.focus()
    }
  }, [activePanel, isDesktop])

  // Call the backend logout endpoint so the JWT JTI is added to the
  // server-side blacklist, then clear local state via the Redux thunk.
  const handleLogout = async () => {
    await dispatch(logoutAsync())
    navigate('/login')
  }

  const userInitials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'

  const isDashVisible = canRead(permissions, user?.role, dashboardItem.menu)
  const canViewAuditTrail = canRead(permissions, user?.role, 'settings.audit-log')

  const closePanels = () => {
    setActivePanel(null)
    setHeaderSearch('')
  }

  const handleNavigate = (to: string) => {
    navigate(to)
    closePanels()
  }

  const handleQuickCreate = (to: string) => {
    navigate(`${to}${to.includes('?') ? '&' : '?'}compose=new`)
    closePanels()
  }

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const response = await auditService.list({ page: 1, limit: 6 })
      setActivityItems(response.data.data || [])
      setActivityFailed(false)
    } catch {
      setActivityItems([])
      setActivityFailed(true)
    } finally {
      setActivityLoading(false)
    }
  }, [])

  const loadAnnouncements = useCallback(async (markAsSeen = false) => {
    setNotificationsLoading(true)
    try {
      const response = await teamService.listAnnouncements()
      const items = (response.data.data || [])
        .slice()
        .sort((left: AnnouncementItem, right: AnnouncementItem) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        )

      setAnnouncements(items)

      if (markAsSeen) {
        const latestSeenAt = items[0]?.created_at || new Date().toISOString()
        setLastAnnouncementsSeenAt(latestSeenAt)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(ANNOUNCEMENTS_SEEN_KEY, latestSeenAt)
        }
      }
    } catch {
      setAnnouncements([])
    } finally {
      setNotificationsLoading(false)
    }
  }, [])

  const handleClockAction = useCallback(async () => {
    if (!user) return

    setClockLoading(true)
    try {
      if (user.clocked_in) {
        await teamService.clockOut()
        toast.success(t('layout.clockOutSuccess', 'Clocked out successfully'))
      } else {
        await teamService.clockIn()
        toast.success(t('layout.clockInSuccess', 'Clocked in successfully'))
      }
      await dispatch(fetchMe())
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('layout.clockActionFailed', 'Unable to update time card status'))
    } finally {
      setClockLoading(false)
    }
  }, [dispatch, t, user])

  const formatLocaleLabel = useCallback((option: LocaleOption) => (
    t(option.labelKey, option.fallbackLabel)
  ), [t])

  const formatLocaleDescription = useCallback((option: LocaleOption) => (
    t(option.descriptionKey, option.fallbackDescription)
  ), [t])

  const getAuditActionLabel = useCallback((action: string) => (
    t(`audit.action.${action}`, AUDIT_ACTION_LABELS[action] || action)
  ), [t])

  const getAuditEntityLabel = useCallback((entityType: string) => (
    t(`audit.entity.${entityType}`, AUDIT_ENTITY_LABELS[entityType] || entityType)
  ), [t])

  useEffect(() => {
    if (activePanel === 'activity' && !activityLoading && activityItems.length === 0 && !activityFailed) {
      void loadActivity()
    }
    if (activePanel === 'notifications') {
      void loadAnnouncements(true)
    }
  }, [activePanel, activityFailed, activityItems.length, activityLoading, loadActivity, loadAnnouncements])

  useEffect(() => {
    void loadAnnouncements()
  }, [loadAnnouncements])

  const handleSearchSubmit = () => {
    if (moduleMatches[0]) {
      handleNavigate(moduleMatches[0].to)
      return
    }
    if (recentPageMatches[0]) {
      handleNavigate(recentPageMatches[0].path)
    }
  }

  const renderSearchContent = (
    <div className="space-y-4">
      <div>
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{t('layout.modules', 'Modules')}</p>
        <div className="mt-2 space-y-1">
          {moduleMatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              {t('layout.noMatchingModules', 'No matching modules found.')}
            </div>
          ) : moduleMatches.map(item => (
            <button
              key={item.to}
              onClick={() => handleNavigate(item.to)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-400">{item.group}</p>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{t('layout.recentPages', 'Recent pages')}</p>
        <div className="mt-2 space-y-1">
          {recentPageMatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              {t('layout.recentPagesHint', 'Your recent pages will appear here.')}
            </div>
          ) : recentPageMatches.map(item => (
            <button
              key={`${item.path}-${item.visitedAt}`}
              onClick={() => handleNavigate(item.path)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-700">{getRecentPageLabel(item)}</p>
                <p className="text-xs text-gray-400">{formatRelativeTime(item.visitedAt, selectedLocale)}</p>
              </div>
              <span className="text-[11px] text-gray-300">{item.path}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderIconButton = (panel: Exclude<HeaderPanel, null>, icon: LucideIcon, label: string, className?: string) => {
    const Icon = icon
    const isActive = activePanel === panel

    return (
      <button
        type="button"
        onClick={() => setActivePanel(current => current === panel ? null : panel)}
        className={clsx(
          'relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600',
          isActive && 'bg-gray-100 text-gray-700',
          className
        )}
        aria-label={label}
        aria-expanded={isActive}
      >
        <Icon size={16} />
        {panel === 'notifications' && unreadAnnouncements > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadAnnouncements > 9 ? '9+' : unreadAnnouncements}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-gray-900">
      {sidebarOpen && (
        <button
          aria-label={t('layout.closeNavigation', 'Close navigation')}
          className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          onClick={() => dispatch(setSidebar(false))}
        />
      )}

      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden border-r border-white/10 bg-primary shadow-2xl transition-transform duration-300 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-5">
          <button onClick={() => navigate('/dashboard')} className="flex flex-col items-start gap-0.5">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-yellow-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              nexora
            </span>
            <span className="text-[10px] font-medium tracking-wide text-white/40">
              {t('layout.partOfGroup', 'Part of CBQA Global Group')}
            </span>
          </button>
          <button
            onClick={() => dispatch(setSidebar(false))}
            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {/* Dashboard — standalone, no group header */}
          {isDashVisible && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) => clsx('nav-link mb-1', isActive && 'active')}
            >
              <LayoutDashboard size={18} className="flex-shrink-0" />
              {getNavItemLabel(dashboardItem)}
            </NavLink>
          )}

          {navGroups.map(group => {
            const visibleItems = group.items.filter(item =>
              item.comingSoon || canRead(permissions, user?.role, item.menu)
            )
            if (visibleItems.length === 0) return null

            const isExp = expanded.includes(group.id)

            return (
              <div key={group.id} className="mt-3">
                <button
                  onClick={() => toggleExpand(group.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1 transition-colors hover:bg-white/5"
                >
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/40">
                    {getNavGroupLabel(group)}
                  </span>
                  {isExp
                    ? <ChevronDown size={10} className="text-white/25" />
                    : <ChevronRight size={10} className="text-white/25" />
                  }
                </button>

                {isExp && (
                  <div className="mt-0.5 space-y-0.5">
                    {visibleItems.map(item => {
                      const Icon = item.icon
                      if (item.comingSoon) {
                        return (
                          <div
                            key={item.to}
                            className="nav-link cursor-not-allowed opacity-40"
                          >
                            <Icon size={18} className="flex-shrink-0" />
                            <span className="flex-1">{getNavItemLabel(item)}</span>
                            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">
                              {t('layout.soon', 'Soon')}
                            </span>
                          </div>
                        )
                      }
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) => clsx('nav-link', isActive && 'active')}
                        >
                          <Icon size={18} className="flex-shrink-0" />
                          {getNavItemLabel(item)}
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="px-2 pb-2 text-[11px] text-white/35">
            v1.0.2
          </div>
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-primary">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="truncate text-xs text-white/55">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={15} />
            {t('layout.signOut', 'Sign out')}
          </button>
        </div>
      </aside>

      <div className={clsx(
        'flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-in-out',
        sidebarOpen ? 'ml-0 lg:ml-72' : 'ml-0'
      )}>
        <header className="sticky top-0 z-30 flex min-h-[72px] flex-wrap items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-5 lg:flex-nowrap lg:px-7">
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
            aria-label={sidebarOpen
              ? t('layout.closeNavigationMenu', 'Close navigation menu')
              : t('layout.openNavigationMenu', 'Open navigation menu')}
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/55">{t('layout.workspaceHeader', 'NexOne Workspace')}</p>
            <h1 className="truncate text-xl font-semibold text-gray-800">{pageTitle}</h1>
          </div>

          <div ref={controlsRef} className="relative ml-auto flex items-center gap-2">
            <div className="relative hidden lg:block">
              <div className={clsx(
                'flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 transition-colors',
                activePanel === 'search' && 'border-primary/30 bg-white shadow-sm'
              )}>
                <Search size={16} className="text-gray-400" />
                <input
                  ref={desktopSearchInputRef}
                  value={headerSearch}
                  onFocus={() => setActivePanel('search')}
                  onChange={(event) => setHeaderSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleSearchSubmit()
                    }
                  }}
                  placeholder={t('layout.searchPlaceholder', 'Search modules...')}
                  className="min-w-[180px] bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400"
                  aria-label={t('layout.searchModules', 'Search modules')}
                />
              </div>

              {activePanel === 'search' && isDesktop && (
                <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-[360px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
                  {renderSearchContent}
                </div>
              )}
            </div>

            {renderIconButton('search', Search, t('layout.openModuleSearch', 'Open module search'), 'lg:hidden')}
            {renderIconButton('quick-add', Plus, t('layout.openQuickAdd', 'Open quick add'))}
            {renderIconButton('locale', Globe, t('layout.openLocaleSettings', 'Open language and region settings'))}
            {renderIconButton('activity', Clock, t('layout.openActivityPanel', 'Open activity and time card panel'))}
            {renderIconButton('notifications', Bell, t('layout.openNotifications', 'Open notifications'))}

            {activePanel === 'quick-add' && (
              <div className="absolute right-[136px] top-[calc(100%+10px)] z-40 hidden w-[320px] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl lg:block">
                <div className="mb-2 px-2">
                  <p className="text-sm font-semibold text-gray-800">{t('layout.quickAdd', 'Quick add')}</p>
                  <p className="text-xs text-gray-400">{t('layout.quickAddDescription', 'Launch common creation flows from anywhere.')}</p>
                </div>
                <div className="space-y-1">
                  {quickActions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                      {t('layout.noCreationShortcuts', 'No creation shortcuts are available for your role.')}
                    </div>
                  ) : quickActions.map(action => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleQuickCreate(action.to)}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{action.label}</p>
                          <p className="text-xs text-gray-400">{action.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {activePanel === 'locale' && (
              <div className="absolute right-[92px] top-[calc(100%+10px)] z-40 hidden w-[320px] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl lg:block">
                <div className="mb-2 px-2">
                  <p className="text-sm font-semibold text-gray-800">{t('layout.languageRegion', 'Language & region')}</p>
                  <p className="text-xs text-gray-400">{t('layout.languageRegionDescription', 'Stored on this device and used for dates and times.')}</p>
                </div>
                <div className="space-y-1">
                  {LOCALE_OPTIONS.map(option => (
                    <button
                      key={option.code}
                      onClick={() => {
                        setSelectedLocale(option.code)
                        setActivePanel(null)
                      }}
                      className={clsx(
                        'flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50',
                        selectedLocale === option.code && 'bg-slate-50'
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-700">{formatLocaleLabel(option)}</p>
                        <p className="text-xs text-gray-400">{formatLocaleDescription(option)}</p>
                      </div>
                      {selectedLocale === option.code && <Check size={16} className="mt-0.5 text-primary" />}
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs text-gray-500">
                  <p className="font-medium text-gray-700">{t('layout.preview', 'Preview')}</p>
                  <p className="mt-1">{new Intl.DateTimeFormat(selectedLocale, { dateStyle: 'full', timeStyle: 'short' }).format(new Date())}</p>
                </div>
              </div>
            )}

            {activePanel === 'activity' && (
              <div className="absolute right-[46px] top-[calc(100%+10px)] z-40 hidden w-[360px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl lg:block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t('layout.activityTime', 'Activity & time')}</p>
                    <p className="text-xs text-gray-400">{t('layout.activityDescription', 'Quickly manage your time card and review recent changes.')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('/team/timecards')}
                    className="text-xs font-medium text-primary"
                  >
                    {t('layout.timeCards', 'Time cards')}
                  </button>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {user?.clocked_in
                          ? t('layout.currentlyClockedIn', 'Currently clocked in')
                          : t('layout.currentlyClockedOut', 'Currently clocked out')}
                      </p>
                      <p className="text-xs text-gray-400">{user?.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleClockAction()}
                      disabled={clockLoading}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium',
                        user?.clocked_in ? 'bg-white text-gray-700' : 'bg-primary text-white',
                        clockLoading && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      {user?.clocked_in ? <LogOut size={13} /> : <LogIn size={13} />}
                      {clockLoading
                        ? t('layout.saving', 'Saving...')
                        : user?.clocked_in
                          ? t('layout.clockOut', 'Clock out')
                          : t('layout.clockIn', 'Clock in')}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{t('layout.recentActivity', 'Recent activity')}</p>
                    {canViewAuditTrail && (
                      <button type="button" onClick={() => handleNavigate('/settings/audit-log')} className="text-xs font-medium text-primary">
                        {t('layout.auditTrail', 'Audit trail')}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {activityLoading ? (
                      <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                        {t('layout.loadingRecentActivity', 'Loading recent activity...')}
                      </div>
                    ) : activityItems.length > 0 ? activityItems.map(item => (
                      <div key={item.id} className="rounded-xl border border-gray-100 px-3 py-3">
                        <p className="text-sm font-medium text-gray-700">
                          {getAuditActionLabel(item.action)} {getAuditEntityLabel(item.entity_type)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{item.entity_name || t('layout.untitledRecord', 'Untitled record')}</p>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {item.user?.name ? `${item.user.name} · ` : ''}{formatRelativeTime(item.created_at, selectedLocale)}
                        </p>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                        {activityFailed
                          ? t('layout.activityUnavailable', 'Audit activity is unavailable right now.')
                          : t('layout.noRecentActivity', 'No recent activity yet.')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{t('layout.recentPages', 'Recent pages')}</p>
                  <div className="space-y-2">
                    {recentPages.slice(0, 3).map(item => (
                      <button
                        key={`${item.path}-${item.visitedAt}`}
                        onClick={() => handleNavigate(item.path)}
                        className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-700">{getRecentPageLabel(item)}</p>
                          <p className="text-[11px] text-gray-400">{formatRelativeTime(item.visitedAt, selectedLocale)}</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-300" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activePanel === 'notifications' && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-40 hidden w-[360px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl lg:block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t('layout.notifications', 'Notifications')}</p>
                    <p className="text-xs text-gray-400">{t('layout.notificationsDescription', 'Latest company announcements.')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('/team/announcements')}
                    className="text-xs font-medium text-primary"
                  >
                    {t('layout.viewAll', 'View all')}
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {notificationsLoading ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                      {t('layout.loadingNotifications', 'Loading notifications...')}
                    </div>
                  ) : activeAnnouncements.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                      {t('layout.noAnnouncements', 'No announcements available.')}
                    </div>
                  ) : activeAnnouncements.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate('/team/announcements')}
                      className="block w-full rounded-xl border border-gray-100 px-3 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{item.title}</p>
                          {item.content && (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.content}</p>
                          )}
                        </div>
                        {lastAnnouncementsSeenAt && new Date(item.created_at) > new Date(lastAnnouncementsSeenAt) && (
                          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                        )}
                      </div>
                      <p className="mt-2 text-[11px] text-gray-400">
                        {formatDateTime(item.created_at, selectedLocale)}
                        {item.created_by?.name ? ` · ${item.created_by.name}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={profileRef} className="relative ml-1">
              <button
                onClick={() => setProfileOpen(prev => !prev)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors hover:bg-gray-50"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <div className="flex h-9 items-center rounded-lg bg-white px-1">
                  <img src={nexoraLogoUrl} alt="Nexora" className="h-7 w-auto object-contain" />
                </div>
                <div className="hidden text-left sm:block">
                  <p className="max-w-[160px] truncate text-sm font-semibold text-gray-700">{user?.name}</p>
                  <p className="max-w-[160px] truncate text-xs text-gray-500">{user?.role}</p>
                </div>
                <ChevronDown size={15} className={clsx('text-gray-400 transition-transform', profileOpen && 'rotate-180')} />
              </button>

              <div className={clsx(
                'absolute right-0 top-[calc(100%+8px)] w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg transition-all',
                profileOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
              )}>
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-gray-800">{user?.name}</p>
                  <p className="truncate text-xs text-gray-500">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-red-50"
                >
                  <LogOut size={14} />
                  {t('layout.signOut', 'Sign out')}
                </button>
              </div>
            </div>
          </div>
        </header>

        {activePanel === 'search' && !isDesktop && (
          <div className="fixed inset-0 z-50 bg-slate-900/45 p-4 lg:hidden">
            <div className="mx-auto max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                <Search size={16} className="text-gray-400" />
                <input
                  autoFocus
                  value={headerSearch}
                  onChange={(event) => setHeaderSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleSearchSubmit()
                    }
                  }}
                  placeholder={t('layout.searchPlaceholder', 'Search modules...')}
                  className="w-full bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400"
                  aria-label={t('layout.searchModules', 'Search modules')}
                />
                <button type="button" onClick={closePanels} className="text-xs font-medium text-gray-500">
                  {t('layout.close', 'Close')}
                </button>
              </div>
              <div className="mt-4 max-h-[70vh] overflow-y-auto">
                {renderSearchContent}
              </div>
            </div>
          </div>
        )}

        {activePanel === 'quick-add' && !isDesktop && (
          <div className="fixed inset-0 z-50 bg-slate-900/45 p-4 lg:hidden">
            <div className="mx-auto max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t('layout.quickAdd', 'Quick add')}</p>
                  <p className="text-xs text-gray-400">{t('layout.mobileQuickAddDescription', 'Create new workspace records.')}</p>
                </div>
                <button type="button" onClick={closePanels} className="text-xs font-medium text-gray-500">{t('layout.close', 'Close')}</button>
              </div>
              <div className="mt-4 space-y-2">
                {quickActions.map(action => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleQuickCreate(action.to)}
                      className="flex w-full items-start gap-3 rounded-xl border border-gray-100 px-3 py-3 text-left"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">{action.label}</p>
                        <p className="text-xs text-gray-400">{action.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activePanel === 'locale' && !isDesktop && (
          <div className="fixed inset-0 z-50 bg-slate-900/45 p-4 lg:hidden">
            <div className="mx-auto max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t('layout.languageRegion', 'Language & region')}</p>
                  <p className="text-xs text-gray-400">{t('layout.mobileLanguageRegionDescription', 'Choose how dates and times appear.')}</p>
                </div>
                <button type="button" onClick={closePanels} className="text-xs font-medium text-gray-500">{t('layout.close', 'Close')}</button>
              </div>
              <div className="mt-4 space-y-2">
                {LOCALE_OPTIONS.map(option => (
                  <button
                    key={option.code}
                    onClick={() => {
                      setSelectedLocale(option.code)
                      setActivePanel(null)
                    }}
                    className={clsx(
                      'flex w-full items-start justify-between rounded-xl border border-gray-100 px-3 py-3 text-left',
                      selectedLocale === option.code && 'bg-slate-50'
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-700">{formatLocaleLabel(option)}</p>
                      <p className="text-xs text-gray-400">{formatLocaleDescription(option)}</p>
                    </div>
                    {selectedLocale === option.code && <Check size={16} className="mt-0.5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activePanel === 'activity' && !isDesktop && (
          <div className="fixed inset-0 z-50 bg-slate-900/45 p-4 lg:hidden">
            <div className="mx-auto max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t('layout.activityTime', 'Activity & time')}</p>
                  <p className="text-xs text-gray-400">{t('layout.mobileActivityDescription', 'Manage your time card and recent activity.')}</p>
                </div>
                <button type="button" onClick={closePanels} className="text-xs font-medium text-gray-500">{t('layout.close', 'Close')}</button>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {user?.clocked_in
                        ? t('layout.currentlyClockedIn', 'Currently clocked in')
                        : t('layout.currentlyClockedOut', 'Currently clocked out')}
                    </p>
                    <p className="text-xs text-gray-400">{user?.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleClockAction()}
                    disabled={clockLoading}
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium',
                      user?.clocked_in ? 'bg-white text-gray-700' : 'bg-primary text-white',
                      clockLoading && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    {user?.clocked_in ? <LogOut size={13} /> : <LogIn size={13} />}
                    {clockLoading
                      ? t('layout.saving', 'Saving...')
                      : user?.clocked_in
                        ? t('layout.clockOut', 'Clock out')
                        : t('layout.clockIn', 'Clock in')}
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  {activityLoading ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                      {t('layout.loadingRecentActivity', 'Loading recent activity...')}
                    </div>
                  ) : activityItems.length > 0 ? activityItems.map(item => (
                    <div key={item.id} className="rounded-xl border border-gray-100 px-3 py-3">
                      <p className="text-sm font-medium text-gray-700">
                        {getAuditActionLabel(item.action)} {getAuditEntityLabel(item.entity_type)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{item.entity_name || t('layout.untitledRecord', 'Untitled record')}</p>
                      <p className="mt-1 text-[11px] text-gray-400">{formatRelativeTime(item.created_at, selectedLocale)}</p>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                      {activityFailed
                        ? t('layout.activityUnavailable', 'Audit activity is unavailable right now.')
                        : t('layout.noRecentActivity', 'No recent activity yet.')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activePanel === 'notifications' && !isDesktop && (
          <div className="fixed inset-0 z-50 bg-slate-900/45 p-4 lg:hidden">
            <div className="mx-auto max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t('layout.notifications', 'Notifications')}</p>
                  <p className="text-xs text-gray-400">{t('layout.notificationsDescription', 'Latest company announcements.')}</p>
                </div>
                <button type="button" onClick={closePanels} className="text-xs font-medium text-gray-500">{t('layout.close', 'Close')}</button>
              </div>
              <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">
                {notificationsLoading ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                    {t('layout.loadingNotifications', 'Loading notifications...')}
                  </div>
                ) : activeAnnouncements.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                    {t('layout.noAnnouncements', 'No announcements available.')}
                  </div>
                ) : activeAnnouncements.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate('/team/announcements')}
                    className="block w-full rounded-xl border border-gray-100 px-3 py-3 text-left"
                  >
                    <p className="text-sm font-medium text-gray-700">{item.title}</p>
                    {item.content && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.content}</p>}
                    <p className="mt-2 text-[11px] text-gray-400">{formatDateTime(item.created_at, selectedLocale)}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
