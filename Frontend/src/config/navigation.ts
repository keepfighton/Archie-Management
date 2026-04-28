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
    id: 'business',
    label: 'Business & Sales',
    items: [
      { id: 'clients', to: '/clients', icon: Users, label: 'Clients', menu: 'clients' },
      { id: 'leads', to: '/leads', icon: TrendingUp, label: 'Leads', menu: 'leads' },
      { id: 'sales-orders', to: '/sales/orders', icon: ShoppingCart, label: 'Orders', menu: 'sales.orders', legacyMenus: ['sales'] },
      { id: 'sales-contracts', to: '/sales/contracts', icon: FileCheck, label: 'Contracts', menu: 'sales.contracts', legacyMenus: ['sales'] },
      { id: 'sales-store', to: '/sales/store', icon: ShoppingBag, label: 'Store', menu: 'sales.store', legacyMenus: ['sales'] },
      { id: 'sales-items', to: '/sales/items', icon: Package, label: 'Items', menu: 'sales.items', legacyMenus: ['sales'] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
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
      { id: 'assets', to: '/assets', icon: Boxes, label: 'Asset Management', menu: 'assets', comingSoon: true },
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
