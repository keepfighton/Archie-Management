import axios from 'axios'

export const API_BASE_URL = (() => {
  const envValue = import.meta.env.VITE_API_URL
  const normalized = normalizeApiBaseURL(envValue)

  // Jika URL adalah absolut (mengandung http), gunakan langsung agar browser memanggil port backend.
  // Ini penting agar browser bisa memanggil port 8080 dari port 3000.
  if (normalized.startsWith('http')) {
    return normalized
  }

  // Fallback ke relative path jika tidak ada http
  return normalized.includes('/api') ? normalized : '/api/v1'
})()

function normalizeApiBaseURL(value: string | undefined) {
  const baseURL = value?.trim()
  if (!baseURL || baseURL === '/' || baseURL === '.') {
    return '/api/v1'
  }
  return baseURL.replace(/\/+$/, '')
}


const api = axios.create({
  baseURL: API_BASE_URL,
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
  getStats: (params?: any) => api.get('/dashboard', { params }),
  getFunnelStats: () => api.get('/dashboard/funnel'),
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

// ─── Clusters ────────────────────────────────────────
export const clusterService = {
  list: (params?: any) => api.get('/clusters', { params }),
  get: (id: number) => api.get(`/clusters/${id}`),
  create: (data: any) => api.post('/clusters', data),
  update: (id: number, data: any) => api.put(`/clusters/${id}`, data),
  delete: (id: number) => api.delete(`/clusters/${id}`),
}

// ─── Projects ────────────────────────────────────────
export const projectService = {
  list: (params?: any) => api.get('/projects', { params }),
  get: (id: number) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: number, data: any) => api.put(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  patchStatus: (id: number, status: string) => api.patch(`/projects/${id}/status`, { status }),
  getTasks: (id: number) => api.get(`/projects/${id}/tasks`),
  getTimeline: (id: number) => api.get(`/projects/${id}/timeline`),
  getKanbanColumns: (id: number) => api.get(`/projects/${id}/kanban-columns`),
}

// ─── Tasks ───────────────────────────────────────────
export const taskService = {
  list: (params?: any) => api.get('/tasks', { params }),
  openReportPDF: (params?: any) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    const query = new URLSearchParams()
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    })
    const url = `${API_BASE_URL}/tasks/report/pdf${query.toString() ? `?${query.toString()}` : ''}`
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(async (res) => {
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    })
  },
  listKanbanColumns: () => api.get('/tasks/columns'),
  createKanbanColumn: (data: any) => api.post('/tasks/columns', data),
  reorderKanbanColumns: (data: { column_ids: number[] }) => api.patch('/tasks/columns/reorder', data),
  updateKanbanColumn: (id: number, data: any) => api.put(`/tasks/columns/${id}`, data),
  deleteKanbanColumn: (id: number) => api.delete(`/tasks/columns/${id}`),
  get: (id: number) => api.get(`/tasks/${id}`),
  create: (data: any) => api.post('/tasks', data),
  update: (id: number, data: any) => api.put(`/tasks/${id}`, data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/tasks/${id}/status`, { status }),
  moveKanbanTask: (id: number, data: { destination_column_id: number; destination_index: number }) =>
    api.patch(`/tasks/${id}/kanban`, data),
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
  rollback: (id: number) => api.post(`/leads/${id}/rollback`),
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
  delete: (id: number) => api.delete(`/payments/${id}`),
}

// ─── Contracts ───────────────────────────────────────
export const contractService = {
  list: (params?: any) => api.get('/contracts', { params }),
  get: (id: number) => api.get(`/contracts/${id}`),
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
  setMemberStatus: (id: number, is_active: boolean) => api.patch(`/team/members/${id}/status`, { is_active }),
  resetPassword: (id: number, data?: { password?: string }) =>
    api.post(`/team/members/${id}/reset-password`, data ?? {}),
  deleteMember: (id: number) => api.delete(`/team/members/${id}`),
  listTimeCards: (params?: any) => api.get('/team/timecards', { params }),
  clockIn: (data: {
    work_mode: 'WFO' | 'WFA' | 'WFH'
    latitude?: number
    longitude?: number
    location_accuracy?: number
    project_id?: number
    note?: string
  }) => api.post('/team/timecards/clock-in', data),
  clockOut: () => api.post('/team/timecards/clock-out'),
  listLeaves: () => api.get('/team/leaves'),
  applyLeave: (data: any) => api.post('/team/leaves', data),
  updateLeaveStatus: (id: number, status: string) => api.patch(`/team/leaves/${id}/status`, { status }),
  deleteLeave: (id: number) => api.delete(`/team/leaves/${id}`),
  listAnnouncements: () => api.get('/team/announcements'),
  createAnnouncement: (data: any) => api.post('/team/announcements', data),
}

// ─── Orders ──────────────────────────────────────────
export const orderService = {
  list: (params?: any) => api.get('/orders', { params }),
  get: (id: number) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  update: (id: number, data: any) => api.put(`/orders/${id}`, data),
  delete: (id: number) => api.delete(`/orders/${id}`),
  convertToInvoice: (id: number) => api.post(`/orders/${id}/convert-to-invoice`),
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
  download: (id: number) => api.get(`/files/${id}/download`, { responseType: 'blob' }),
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

// ─── Internal Messages ──────────────────────────────
export const messageService = {
  heartbeat: () => api.post('/presence/heartbeat'),
  listUsers: () => api.get('/messages/users'),
  listConversations: () => api.get('/messages/conversations'),
  openDirectConversation: (userId: number) =>
    api.post('/messages/conversations/direct', { user_id: userId }),
  listMessages: (conversationId: number) =>
    api.get(`/messages/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: number, body: string) =>
    api.post(`/messages/conversations/${conversationId}/messages`, { body }),
  markRead: (conversationId: number) =>
    api.post(`/messages/conversations/${conversationId}/read`),
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

    const fileName = `laporan_${type}_${new Date().toISOString().slice(0, 10)}.csv`

    // Force Authorization header for this export request.
    // Even if axios interceptor is configured, this prevents edge-cases
    // where token storage/redirect timing results in missing Authorization.
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      // Let caller handle errors; keep behavior consistent with other services.
      return Promise.reject(new Error('Missing auth token'))
    }

    const path = `/reports/export?${params.toString()}`
    console.log('[reportService.exportCSV] API_BASE_URL:', API_BASE_URL, 'path:', path)

    return api
      .get(path, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        console.log(
          '[reportService.exportCSV] status:', res.status,
          'content-type:', res.headers?.['content-type']
        )

        const blob = res.data
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = fileName
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
    const baseURL = API_BASE_URL
    fetch(`${baseURL}/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    })
  },
}

// ─── Milestones ──────────────────────────────────────
export const milestoneService = {
  list: (projectId: number) => api.get(`/projects/${projectId}/milestones`),
  create: (projectId: number, data: any) => api.post(`/projects/${projectId}/milestones`, data),
  update: (projectId: number, id: number, data: any) => api.put(`/projects/${projectId}/milestones/${id}`, data),
  delete: (projectId: number, id: number) => api.delete(`/projects/${projectId}/milestones/${id}`),
}

// ─── Deliverables ────────────────────────────────────
export const deliverableService = {
  list: (projectId: number) => api.get(`/projects/${projectId}/deliverables`),
  create: (projectId: number, data: any) => api.post(`/projects/${projectId}/deliverables`, data),
  update: (projectId: number, id: number, data: any) => api.put(`/projects/${projectId}/deliverables/${id}`, data),
  delete: (projectId: number, id: number) => api.delete(`/projects/${projectId}/deliverables/${id}`),
}

// ─── Labels ──────────────────────────────────────────
export const labelService = {
  list: () => api.get('/labels'),
  create: (data: any) => api.post('/labels', data),
  delete: (id: number) => api.delete(`/labels/${id}`),
}

// ─── Quotations ──────────────────────────────────────
export const quotationService = {
  list: (params?: any) => api.get('/quotations', { params }),
  get: (id: number) => api.get(`/quotations/${id}`),
  create: (data: any) => api.post('/quotations', data),
  update: (id: number, data: any) => api.put(`/quotations/${id}`, data),
  delete: (id: number) => api.delete(`/quotations/${id}`),
  addItem: (id: number, data: any) => api.post(`/quotations/${id}/items`, data),
  updateItem: (id: number, itemId: number, data: any) => api.put(`/quotations/${id}/items/${itemId}`, data),
  deleteItem: (id: number, itemId: number) => api.delete(`/quotations/${id}/items/${itemId}`),
  convertToInvoice: (id: number, data?: any) => api.post(`/quotations/${id}/convert-to-invoice`, data),
  convertToOrder: (id: number) => api.post(`/quotations/${id}/convert-to-order`),
  convertToContract: (id: number) => api.post(`/quotations/${id}/convert-to-contract`),
}

// ─── Quotation PDF ───────────────────────────────────
export const quotationPrintService = {
  openPDF: (id: number) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    const baseURL = API_BASE_URL
    fetch(`${baseURL}/quotations/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    })
  },
  openPrint: (id: number) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    const baseURL = API_BASE_URL
    return fetch(`${baseURL}/quotations/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    })
  },
  openDownload: (id: number) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    const baseURL = API_BASE_URL
    return fetch(`${baseURL}/quotations/${id}/pdf?download=1`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    })
  },
}

// ─── Asset Master Data (Kategori / Status / Kondisi) ─
export const assetSettingsService = {
  list: (type?: string) => api.get('/asset-settings', { params: type ? { type } : {} }),
  create: (data: any) => api.post('/asset-settings', data),
  update: (id: number, data: any) => api.put(`/asset-settings/${id}`, data),
  delete: (id: number) => api.delete(`/asset-settings/${id}`),
}

// ─── Assets ──────────────────────────────────────────
export const assetService = {
  list: (params?: any) => api.get('/assets', { params }),
  get: (id: number) => api.get(`/assets/${id}`),
  create: (data: any) => api.post('/assets', data),
  update: (id: number, data: any) => api.put(`/assets/${id}`, data),
  delete: (id: number) => api.delete(`/assets/${id}`),
  scan: (code: string) => api.get('/assets/scan', { params: { code } }),
  export: () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    const a = document.createElement('a')
    a.href = `${API_BASE_URL}/assets/export`
    const headers = new Headers({ Authorization: `Bearer ${token}` })
    fetch(`${API_BASE_URL}/assets/export`, { headers })
      .then(r => r.blob())
      .then(blob => {
        a.href = URL.createObjectURL(blob)
        a.download = 'assets.csv'
        a.click()
      })
  },
}
