import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally — but not for the logout endpoint itself (the token may
// already be gone when the user clicks "Sign out"; no need to double-redirect).
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? ''
    if (err.response?.status === 401 && !url.includes('/auth/logout')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('permissions')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      sessionStorage.removeItem('permissions')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ─── Auth ────────────────────────────────────────────
export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (data: any) => api.put('/auth/change-password', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  // Used by ResetPasswordPage — was calling api.post directly before.
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),
}

// ─── Dashboard ───────────────────────────────────────
export const dashboardService = {
  getStats: () => api.get('/dashboard'),
}

// ─── Clients ─────────────────────────────────────────
export const clientService = {
  list: (params?: any) => api.get('/clients', { params }),
  get: (id: number) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
  update: (id: number, data: any) => api.put(`/clients/${id}`, data),
  delete: (id: number) => api.delete(`/clients/${id}`),
  listContacts: () => api.get('/clients/contacts'),
  getContacts: (id: number) => api.get(`/clients/${id}/contacts`),
  addContact: (id: number, data: any) => api.post(`/clients/${id}/contacts`, data),
  updateContact: (clientId: number, contactId: number, data: any) => api.put(`/clients/${clientId}/contacts/${contactId}`, data),
  deleteContact: (clientId: number, contactId: number) => api.delete(`/clients/${clientId}/contacts/${contactId}`),
  getProjects: (id: number) => api.get(`/clients/${id}/projects`),
  getInvoices: (id: number) => api.get(`/clients/${id}/invoices`),
}

// ─── Projects ────────────────────────────────────────
export const projectService = {
  list: (params?: any) => api.get('/projects', { params }),
  get: (id: number) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: number, data: any) => api.put(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  getTasks: (id: number) => api.get(`/projects/${id}/tasks`),
  getTimeline: (id: number) => api.get(`/projects/${id}/timeline`),
}

// ─── Tasks ───────────────────────────────────────────
export const taskService = {
  list: (params?: any) => api.get('/tasks', { params }),
  get: (id: number) => api.get(`/tasks/${id}`),
  create: (data: any) => api.post('/tasks', data),
  update: (id: number, data: any) => api.put(`/tasks/${id}`, data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/tasks/${id}/status`, { status }),
  delete: (id: number) => api.delete(`/tasks/${id}`),
}

// ─── Leads ───────────────────────────────────────────
export const leadService = {
  list: (params?: any) => api.get('/leads', { params }),
  get: (id: number) => api.get(`/leads/${id}`),
  create: (data: any) => api.post('/leads', data),
  update: (id: number, data: any) => api.put(`/leads/${id}`, data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/leads/${id}/status`, { status }),
  delete: (id: number) => api.delete(`/leads/${id}`),
  convert: (id: number) => api.post(`/leads/${id}/convert`),
}

// ─── Invoices ────────────────────────────────────────
export const invoiceService = {
  list: (params?: any) => api.get('/invoices', { params }),
  get: (id: number) => api.get(`/invoices/${id}`),
  create: (data: any) => api.post('/invoices', data),
  update: (id: number, data: any) => api.put(`/invoices/${id}`, data),
  delete: (id: number) => api.delete(`/invoices/${id}`),
  addPayment: (id: number, data: any) => api.post(`/invoices/${id}/payments`, data),
  deletePayment: (id: number, paymentId: number) => api.delete(`/invoices/${id}/payments/${paymentId}`),
  addItem: (id: number, data: any) => api.post(`/invoices/${id}/items`, data),
  updateItem: (id: number, itemId: number, data: any) => api.put(`/invoices/${id}/items/${itemId}`, data),
  deleteItem: (id: number, itemId: number) => api.delete(`/invoices/${id}/items/${itemId}`),
  summary: (params?: any) => api.get('/invoices/summary', { params }),
}

// ─── Payments ────────────────────────────────────────
export const paymentService = {
  list: (params?: any) => api.get('/payments', { params }),
}

// ─── Contracts ───────────────────────────────────────
export const contractService = {
  list: () => api.get('/contracts'),
  create: (data: any) => api.post('/contracts', data),
  update: (id: number, data: any) => api.put(`/contracts/${id}`, data),
  delete: (id: number) => api.delete(`/contracts/${id}`),
}

// ─── Items ───────────────────────────────────────────
export const itemService = {
  list: () => api.get('/items'),
  create: (data: any) => api.post('/items', data),
  update: (id: number, data: any) => api.put(`/items/${id}`, data),
  delete: (id: number) => api.delete(`/items/${id}`),
}

// ─── Events ──────────────────────────────────────────
export const eventService = {
  list: (params?: any) => api.get('/events', { params }),
  create: (data: any) => api.post('/events', data),
  update: (id: number, data: any) => api.put(`/events/${id}`, data),
  delete: (id: number) => api.delete(`/events/${id}`),
}

// ─── Team ────────────────────────────────────────────
export const teamService = {
  listMembers: (params?: any) => api.get('/team/members', { params }),
  getMember: (id: number) => api.get(`/team/members/${id}`),
  createMember: (data: any) => api.post('/team/members', data),
  updateMember: (id: number, data: any) => api.put(`/team/members/${id}`, data),
  resetPassword: (id: number, data?: { password?: string }) =>
    api.post(`/team/members/${id}/reset-password`, data ?? {}),
  listTimeCards: () => api.get('/team/timecards'),
  clockIn: () => api.post('/team/timecards/clock-in'),
  clockOut: () => api.post('/team/timecards/clock-out'),
  listLeaves: () => api.get('/team/leaves'),
  applyLeave: (data: any) => api.post('/team/leaves', data),
  updateLeaveStatus: (id: number, status: string) => api.patch(`/team/leaves/${id}/status`, { status }),
  listAnnouncements: () => api.get('/team/announcements'),
  createAnnouncement: (data: any) => api.post('/team/announcements', data),
}

// ─── Orders ──────────────────────────────────────────
export const orderService = {
  list: () => api.get('/orders'),
  get: (id: number) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  update: (id: number, data: any) => api.put(`/orders/${id}`, data),
  delete: (id: number) => api.delete(`/orders/${id}`),
}

// ─── Expenses ────────────────────────────────────────
export const expenseService = {
  list: (params?: any) => api.get('/expenses', { params }),
  create: (data: any) => api.post('/expenses', data),
  update: (id: number, data: any) => api.put(`/expenses/${id}`, data),
  delete: (id: number) => api.delete(`/expenses/${id}`),
}

// ─── Files ───────────────────────────────────────────
export const fileService = {
  list: (params?: any) => api.get('/files', { params }),
  upload: (formData: FormData) =>
    api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  createFolder: (data: any) => api.post('/files/folder', data),
  delete: (id: number) => api.delete(`/files/${id}`),
  toggleFavorite: (id: number) => api.patch(`/files/${id}/favorite`),
}

// ─── Todos ───────────────────────────────────────────
export const todoService = {
  list: (params?: any) => api.get('/todos', { params }),
  create: (data: any) => api.post('/todos', data),
  markDone: (id: number) => api.patch(`/todos/${id}/done`),
  delete: (id: number) => api.delete(`/todos/${id}`),
}

// ─── Notes ───────────────────────────────────────────
export const noteService = {
  list: () => api.get('/notes'),
  create: (data: any) => api.post('/notes', data),
  update: (id: number, data: any) => api.put(`/notes/${id}`, data),
  delete: (id: number) => api.delete(`/notes/${id}`),
}

// ─── Reports ─────────────────────────────────────────
export const reportService = {
  invoicesSummary: (params?: any) => api.get('/reports/invoices-summary', { params }),
  projectsSummary: () => api.get('/reports/projects-summary'),
  leadsSummary: () => api.get('/reports/leads-summary'),
  expensesSummary: () => api.get('/reports/expenses-summary'),
  exportCSV: (type: string, year?: string) => {
    const params = new URLSearchParams({ type })
    if (year) params.append('year', year)
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    const baseURL = import.meta.env.VITE_API_URL || '/api/v1'
    const a = document.createElement('a')
    a.href = `${baseURL}/reports/export?${params.toString()}`
    // inject token via query is not ideal; use window.fetch instead
    return fetch(`${baseURL}/reports/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      a.href = url
      a.download = `laporan_${type}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  },
}

// ─── Audit Logs ──────────────────────────────────────
export const auditService = {
  list: (params?: any) => api.get('/audit-logs', { params }),
}

// ─── App Roles ───────────────────────────────────────
export const roleService = {
  list: () => api.get('/roles'),
  get: (id: number) => api.get(`/roles/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/roles', data),
  update: (id: number, data: { name?: string; description?: string }) => api.put(`/roles/${id}`, data),
  delete: (id: number) => api.delete(`/roles/${id}`),
  setPermissions: (id: number, permissions: { menu: string; can_read: boolean; can_edit: boolean }[]) =>
    api.put(`/roles/${id}/permissions`, permissions),
}

// ─── Invoice PDF ─────────────────────────────────────
export const invoicePDFService = {
  openPDF: (id: number) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    const baseURL = import.meta.env.VITE_API_URL || '/api/v1'
    fetch(`${baseURL}/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    })
  },
}

// ─── Labels ──────────────────────────────────────────
export const labelService = {
  list: () => api.get('/labels'),
  create: (data: any) => api.post('/labels', data),
  delete: (id: number) => api.delete(`/labels/${id}`),
}
