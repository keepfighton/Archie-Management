import type { LucideIcon } from 'lucide-react'
import {
  BarChart2,
  Banknote,
  Boxes,
  Calendar,
  CalendarX,
  CheckCircle,
  CheckSquare,
  Clock,
  FileCheck,
  FileText,
  FolderKanban,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  Receipt,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  StickyNote,
  TrendingUp,
  UserCircle,
  UserCog,
  Users,
} from 'lucide-react'

export type NavLeaf = {
  id: string
  to: string
  icon: LucideIcon
  label: string
  menu: string
  legacyMenus?: string[]
  comingSoon?: boolean
}

export type NavGroupDef = {
  id: string
  label: string
  items: NavLeaf[]
}

export const dashboardItem: NavLeaf = {
  id: 'dashboard',
  to: '/dashboard',
  icon: LayoutDashboard,
  label: 'Dashboard',
  menu: 'dashboard',
}

export const navGroups: NavGroupDef[] = [
  {
    id: 'internal-project',
    label: 'Internal Project',
    items: [
      {
        id: 'internal-project-dashboard',
        to: '/internal-project/dashboard',
        icon: LayoutDashboard,
        label: 'Monitoring',
        menu: 'internal-project.dashboard',
      },
      {
        id: 'internal-project-projects',
        to: '/internal-project/projects',
        icon: FolderKanban,
        label: 'Project',
        menu: 'internal-project.projects',
      },
      {
        id: 'internal-project-timesheet',
        to: '/internal-project/timesheet',
        icon: Clock,
        label: 'Timesheet',
        menu: 'internal-project.timesheet',
      },
      {
        id: 'internal-project-reports',
        to: '/internal-project/reports',
        icon: BarChart2,
        label: 'Report',
        menu: 'internal-project.reports',
      },
    ],
  },
  {
    id: 'business',
    label: 'Business & Sales',
    items: [
      { id: 'leads', to: '/leads', icon: TrendingUp, label: 'Leads', menu: 'leads' },
      { id: 'clients', to: '/clients', icon: Users, label: 'Clients', menu: 'clients' },
      { id: 'sales-quotations', to: '/sales/quotations', icon: FileText, label: 'Quotations', menu: 'sales.quotations', legacyMenus: ['sales'] },
      { id: 'sales-contracts', to: '/sales/contracts', icon: FileCheck, label: 'Contracts', menu: 'sales.contracts', legacyMenus: ['sales'] },
      // Orders and Store remain available by direct URL for legacy data, but
      // the primary workflow is Quotation -> Contract -> Project.
      { id: 'sales-items', to: '/sales/items', icon: Package, label: 'Items', menu: 'sales.items', legacyMenus: ['sales'] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'clusters', to: '/clusters', icon: Boxes, label: 'Cluster', menu: 'clusters' },
      { id: 'projects', to: '/projects', icon: FolderKanban, label: 'Projects', menu: 'projects' },
      { id: 'tasks', to: '/tasks', icon: CheckSquare, label: 'Tasks', menu: 'tasks' },
      { id: 'todo', to: '/todo', icon: CheckCircle, label: 'To Do', menu: 'todo' },
      { id: 'events', to: '/events', icon: Calendar, label: 'Events', menu: 'events' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { id: 'sales-invoices', to: '/sales/invoices', icon: FileText, label: 'Invoices', menu: 'sales.invoices', legacyMenus: ['sales'] },
      { id: 'sales-payments', to: '/sales/payments', icon: Banknote, label: 'Payments', menu: 'sales.payments', legacyMenus: ['sales'] },
      { id: 'expenses', to: '/expenses', icon: Receipt, label: 'Expenses', menu: 'expenses' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { id: 'team-members', to: '/team/members', icon: UserCircle, label: 'Team', menu: 'team.members', legacyMenus: ['team'] },
      { id: 'team-timecards', to: '/team/timecards', icon: Clock, label: 'Time Cards', menu: 'team.timecards', legacyMenus: ['team'] },
      { id: 'team-leave', to: '/team/leave', icon: CalendarX, label: 'Leave', menu: 'team.leave', legacyMenus: ['team'] },
      { id: 'team-announcements', to: '/team/announcements', icon: Megaphone, label: 'Announcements', menu: 'team.announcements', legacyMenus: ['team'] },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    items: [
      { id: 'messages', to: '/messages', icon: MessageSquare, label: 'Messages', menu: 'messages' },
      { id: 'notes', to: '/notes', icon: StickyNote, label: 'Notes', menu: 'notes' },
      { id: 'files', to: '/files', icon: FolderOpen, label: 'Files', menu: 'files' },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    items: [
      { id: 'assets', to: '/assets', icon: Boxes, label: 'Asset Management', menu: 'assets' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      { id: 'reports', to: '/reports', icon: BarChart2, label: 'Reports', menu: 'reports' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'settings-users', to: '/settings/users', icon: UserCog, label: 'User Accounts', menu: 'settings.users', legacyMenus: ['settings'] },
      { id: 'settings-roles', to: '/settings/roles', icon: Shield, label: 'Roles', menu: 'settings.roles', legacyMenus: ['settings'] },
      { id: 'settings-audit-log', to: '/settings/audit-log', icon: ShieldCheck, label: 'Audit Trail', menu: 'settings.audit-log', legacyMenus: ['settings'] },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { id: 'help', to: '/team/help', icon: HelpCircle, label: 'Help', menu: 'help', legacyMenus: ['team'] },
    ],
  },
]

export const permissionItems = [dashboardItem, ...navGroups.flatMap(group => group.items)]

const permissionAliases = permissionItems.reduce<Record<string, string[]>>((acc, item) => {
  acc[item.menu] = item.legacyMenus ?? []
  return acc
}, {})

export function getPermissionLookupKeys(menu: string) {
  return [menu, ...(permissionAliases[menu] ?? [])]
}

export function findPermissionEntry<T extends { menu: string }>(
  permissions: T[] | null | undefined,
  menu: string
) {
  if (!permissions) return undefined

  for (const key of getPermissionLookupKeys(menu)) {
    const permission = permissions.find(item => item.menu === key)
    if (permission) return permission
  }

  return undefined
}

export function findNavigationItemByMenu(menu: string) {
  return permissionItems.find(item => getPermissionLookupKeys(item.menu).includes(menu))
}
