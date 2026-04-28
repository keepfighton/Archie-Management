import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useState } from 'react'
import { RootState, AppDispatch } from '@/store'
import { logoutAsync, canRead } from '@/store/slices/authSlice'
import { toggleSidebar } from '@/store/slices/uiSlice'
import nexoraLogoUrl from '../../../logo/Logo_Nexora_Part.png'
import {
  LayoutDashboard, Calendar, Users, FolderKanban, CheckSquare,
  TrendingUp, FileText, MessageSquare, UserCircle,
  FolderOpen, Receipt, BarChart2, CheckCircle, Menu, Search,
  Bell, Globe, Clock, Plus, LogOut, ChevronDown, ChevronRight, X,
  ShoppingCart, ShoppingBag, Package, Banknote, CalendarX, Megaphone,
  Boxes, HelpCircle, Shield, ShieldCheck, UserCog, FileCheck, StickyNote
} from 'lucide-react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

type NavLeaf = {
  to: string
  icon: LucideIcon
  label: string
  menu: string
  comingSoon?: boolean
}

type NavGroupDef = {
  id: string
  label: string
  items: NavLeaf[]
}

const dashboardItem: NavLeaf = { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', menu: 'dashboard' }

const navGroups: NavGroupDef[] = [
  {
    id: 'business',
    label: 'Business & Sales',
    items: [
      { to: '/clients', icon: Users, label: 'Clients', menu: 'clients' },
      { to: '/leads', icon: TrendingUp, label: 'Leads', menu: 'leads' },
      { to: '/sales/orders', icon: ShoppingCart, label: 'Orders', menu: 'sales' },
      { to: '/sales/contracts', icon: FileCheck, label: 'Contracts', menu: 'sales' },
      { to: '/sales/store', icon: ShoppingBag, label: 'Store', menu: 'sales' },
      { to: '/sales/items', icon: Package, label: 'Items', menu: 'sales' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/projects', icon: FolderKanban, label: 'Projects', menu: 'projects' },
      { to: '/tasks', icon: CheckSquare, label: 'Tasks', menu: 'tasks' },
      { to: '/todo', icon: CheckCircle, label: 'To Do', menu: 'todo' },
      { to: '/events', icon: Calendar, label: 'Events', menu: 'events' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { to: '/sales/invoices', icon: FileText, label: 'Invoices', menu: 'sales' },
      { to: '/sales/payments', icon: Banknote, label: 'Payments', menu: 'sales' },
      { to: '/expenses', icon: Receipt, label: 'Expenses', menu: 'expenses' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { to: '/team/members', icon: UserCircle, label: 'Team', menu: 'team' },
      { to: '/team/timecards', icon: Clock, label: 'Time Cards', menu: 'team' },
      { to: '/team/leave', icon: CalendarX, label: 'Leave', menu: 'team' },
      { to: '/team/announcements', icon: Megaphone, label: 'Announcements', menu: 'team' },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    items: [
      { to: '/messages', icon: MessageSquare, label: 'Messages', menu: 'messages' },
      { to: '/notes', icon: StickyNote, label: 'Notes', menu: 'notes' },
      { to: '/files', icon: FolderOpen, label: 'Files', menu: 'files' },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    items: [
      { to: '/assets', icon: Boxes, label: 'Asset Management', menu: 'assets', comingSoon: true },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      { to: '/reports', icon: BarChart2, label: 'Reports', menu: 'reports' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { to: '/settings/users', icon: UserCog, label: 'User Accounts', menu: 'settings' },
      { to: '/settings/roles', icon: Shield, label: 'Roles', menu: 'settings' },
      { to: '/settings/audit-log', icon: ShieldCheck, label: 'Audit Trail', menu: 'settings' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { to: '/team/help', icon: HelpCircle, label: 'Help', menu: 'team' },
    ],
  },
]

export default function Layout() {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, permissions } = useSelector((s: RootState) => s.auth)
  const { sidebarOpen } = useSelector((s: RootState) => s.ui)
  const [expanded, setExpanded] = useState<string[]>(() => {
    const active = navGroups.find(g =>
      g.items.some(item => location.pathname.startsWith(item.to))
    )
    return active ? [active.id] : ['business']
  })
  const [profileOpen, setProfileOpen] = useState(false)

  const titleMap = [
    { key: '/dashboard', label: 'Dashboard' },
    { key: '/events', label: 'Events' },
    { key: '/clients', label: 'Clients' },
    { key: '/projects', label: 'Projects' },
    { key: '/tasks', label: 'Tasks' },
    { key: '/leads', label: 'Leads' },
    { key: '/sales/invoices', label: 'Invoices' },
    { key: '/sales/orders', label: 'Orders' },
    { key: '/sales/store', label: 'Store' },
    { key: '/sales/payments', label: 'Payments' },
    { key: '/sales/items', label: 'Items' },
    { key: '/sales/contracts', label: 'Contracts' },
    { key: '/notes', label: 'Notes' },
    { key: '/messages', label: 'Messages' },
    { key: '/team/members', label: 'Team' },
    { key: '/team/timecards', label: 'Time Cards' },
    { key: '/team/leave', label: 'Leave' },
    { key: '/team/announcements', label: 'Announcements' },
    { key: '/team/help', label: 'Help' },
    { key: '/files', label: 'Files' },
    { key: '/expenses', label: 'Expenses' },
    { key: '/reports', label: 'Reports' },
    { key: '/todo', label: 'To Do' },
    { key: '/settings/users', label: 'User Accounts' },
    { key: '/settings/roles', label: 'Roles' },
    { key: '/settings/audit-log', label: 'Audit Trail' },
    { key: '/assets', label: 'Asset Management' },
  ]
  const pageTitle =
    titleMap.find(item => location.pathname.startsWith(item.key))?.label ?? 'Workspace'

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  // Call the backend logout endpoint so the JWT JTI is added to the
  // server-side blacklist, then clear local state via the Redux thunk.
  const handleLogout = async () => {
    await dispatch(logoutAsync())
    navigate('/login')
  }

  const userInitials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'

  const isDashVisible = canRead(permissions, user?.role, dashboardItem.menu)

  return (
    <div className="flex min-h-screen bg-background text-gray-900">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          onClick={() => dispatch(toggleSidebar())}
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
              Part of CBQA Global Group
            </span>
          </button>
          <button
            onClick={() => dispatch(toggleSidebar())}
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
              Dashboard
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
                    {group.label}
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
                            <span className="flex-1">{item.label}</span>
                            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">
                              Soon
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
                          {item.label}
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
            Sign out
          </button>
        </div>
      </aside>

      <div className={clsx('flex flex-col min-w-0 flex-1 transition-[margin] duration-300 ease-in-out', sidebarOpen ? 'ml-72' : 'ml-0')}>
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-gray-200 bg-white/95 px-5 shadow-sm backdrop-blur lg:px-7">
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/55">NexOne Workspace</p>
            <h1 className="truncate text-xl font-semibold text-gray-800">{pageTitle}</h1>
          </div>

          <div className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-400 md:flex">
            <Search size={16} />
            <span className="min-w-[120px]">Search modules...</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {[Search, Plus, Globe, Clock, Bell].map((Icon, i) => (
              <button key={i} className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 md:hidden">
                <Icon size={16} />
                {i === 4 && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
                )}
              </button>
            ))}
            {[Plus, Globe, Clock, Bell].map((Icon, i) => (
              <button key={i} className="relative hidden h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 md:flex">
                <Icon size={16} />
                {i === 4 && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
                )}
              </button>
            ))}

            <div className="relative ml-1">
              <button
                onClick={() => setProfileOpen(prev => !prev)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors hover:bg-gray-50"
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
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
