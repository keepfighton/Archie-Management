import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Provider } from 'react-redux'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { store } from '@/store'
import type { AppDispatch, RootState } from '@/store'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import Layout from '@/components/layout/Layout'
import ProtectedRoute, { PermissionRoute } from '@/components/common/ProtectedRoute'

import LoginPage from '@/pages/Auth/LoginPage'
import ForgotPasswordPage from '@/pages/Auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/Auth/ResetPasswordPage'
import DashboardPage from '@/pages/Dashboard/DashboardPage'
import EventsPage from '@/pages/Events/EventsPage'
import ClientsPage from '@/pages/Clients/ClientsPage'
import ClientDetailPage from '@/pages/Clients/ClientDetailPage'
import ClustersPage from '@/pages/Projects/ClustersPage'
import ProjectsPage from '@/pages/Projects/ProjectsPage'
import ProjectDetailPage from '@/pages/Projects/ProjectDetailPage'
import InternalProjectsPage from '@/pages/InternalProjects/InternalProjectsPage'
import InternalProjectDetailPage from '@/pages/InternalProjects/InternalProjectDetailPage'
import InternalProjectDashboardPage from '@/pages/InternalProjects/InternalProjectDashboardPage'
import TimesheetPage from '@/pages/InternalProjects/TimesheetPage'
import InternalProjectReportsPage from '@/pages/InternalProjects/InternalProjectReportsPage'
import InternalProjectMyTasksPage from '@/pages/InternalProjects/InternalProjectMyTasksPage'
import TasksPage from '@/pages/Tasks/TasksPage'
import LeadsPage from '@/pages/Leads/LeadsPage'
import InvoicesPage from '@/pages/Sales/InvoicesPage'
import OrdersPage from '@/pages/Sales/OrdersPage'
import StorePage from '@/pages/Sales/StorePage'
import PaymentsPage from '@/pages/Sales/PaymentsPage'
import ItemsPage from '@/pages/Sales/ItemsPage'
import ContractsPage from '@/pages/Sales/ContractsPage'
import ContractDetailPage from '@/pages/Sales/ContractDetailPage'
import QuotationsPage from '@/pages/Sales/QuotationsPage'
import NotesPage from '@/pages/Notes/NotesPage'
import MessagesPage from '@/pages/Messages/MessagesPage'
import TeamMembersPage from '@/pages/Team/TeamMembersPage'
import TimeCardsPage from '@/pages/Team/TimeCardsPage'
import LeavePage from '@/pages/Team/LeavePage'
import AnnouncementsPage from '@/pages/Team/AnnouncementsPage'
import HelpPage from '@/pages/Team/HelpPage'
import FilesPage from '@/pages/Files/FilesPage'
import AssetsPage from '@/pages/Assets/AssetsPage'
import ExpensesPage from '@/pages/Expenses/ExpensesPage'
import ReportsPage from '@/pages/Reports/ReportsPage'
import TodoPage from '@/pages/Todo/TodoPage'
import UsersPage from '@/pages/Settings/UsersPage'
import AuditLogPage from '@/pages/Settings/AuditLogPage'
import RolesPage from '@/pages/Settings/RolesPage'
import NotificationsPage from '@/pages/Notifications/NotificationsPage'
import { fetchMe } from '@/store/slices/authSlice'
import { LocaleProvider } from '@/contexts/LocaleContext'

export default function App() {
  return (
    <Provider store={store}>
      <LocaleProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </LocaleProvider>
      <ToastContainer position="top-right" autoClose={3000} />
    </Provider>
  )
}

function AppShell() {
  const dispatch = useDispatch<AppDispatch>()
  const token = useSelector((s: RootState) => s.auth.token)

  useEffect(() => {
    if (token) {
      void dispatch(fetchMe())
    }
  }, [dispatch, token])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="clusters" element={<ClustersPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="internal-project/projects" element={<PermissionRoute menu="internal-project.projects"><InternalProjectsPage /></PermissionRoute>} />
        <Route path="internal-project/projects/:id" element={<PermissionRoute menu="internal-project.projects"><InternalProjectDetailPage /></PermissionRoute>} />
        <Route path="internal-project/my-tasks" element={<PermissionRoute menu="internal-project.projects"><InternalProjectMyTasksPage /></PermissionRoute>} />
        <Route path="internal-project/dashboard" element={<PermissionRoute menu="internal-project.dashboard"><InternalProjectDashboardPage /></PermissionRoute>} />
        <Route path="internal-project/timesheet" element={<PermissionRoute menu="internal-project.timesheet"><TimesheetPage /></PermissionRoute>} />
        <Route path="internal-project/reports" element={<PermissionRoute menu="internal-project.reports"><InternalProjectReportsPage /></PermissionRoute>} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="sales/invoices" element={<InvoicesPage />} />
        <Route path="sales/orders" element={<OrdersPage />} />
        <Route path="sales/store" element={<StorePage />} />
        <Route path="sales/payments" element={<PaymentsPage />} />
        <Route path="sales/items" element={<ItemsPage />} />
        <Route path="sales/contracts" element={<ContractsPage />} />
        <Route path="sales/contracts/:id" element={<ContractDetailPage />} />
        <Route path="sales/quotations" element={<QuotationsPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="team/members" element={<TeamMembersPage />} />
        <Route path="team/timecards" element={<TimeCardsPage />} />
        <Route path="team/leave" element={<LeavePage />} />
        <Route path="team/announcements" element={<AnnouncementsPage />} />
        <Route path="team/help" element={<HelpPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="todo" element={<TodoPage />} />
        <Route path="settings/users" element={<UsersPage />} />
        <Route path="settings/roles" element={<RolesPage />} />
        <Route path="settings/audit-log" element={<AuditLogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
