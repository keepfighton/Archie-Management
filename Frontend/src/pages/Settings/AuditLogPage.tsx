import { useEffect, useState } from 'react'
import { auditService } from '@/services/api'
import { format } from 'date-fns'
import { ShieldCheck, Search, Filter } from 'lucide-react'
import { DEFAULT_PAGE_LIMIT, rowNumber } from '@/components/common'

interface AuditLog {
  id: number
  user: { id: number; name: string; email: string }
  action: string
  entity_type: string
  entity_id: number
  entity_name: string
  ip_address: string
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  convert: 'bg-purple-100 text-purple-700',
}

const ENTITY_LABELS: Record<string, string> = {
  client: 'Klien',
  project: 'Proyek',
  task: 'Tugas',
  lead: 'Lead',
  invoice: 'Invoice',
  contract: 'Kontrak',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Buat',
  update: 'Ubah',
  delete: 'Hapus',
  convert: 'Konversi',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    from: '',
    to: '',
  })

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: DEFAULT_PAGE_LIMIT }
      if (filters.entity_type) params.entity_type = filters.entity_type
      if (filters.action) params.action = filters.action
      if (filters.from) params.from = filters.from
      if (filters.to) params.to = filters.to
      const res = await auditService.list(params)
      setLogs(res.data.data)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [page, filters])

  const handleFilter = (key: string, value: string) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  const totalPages = Math.ceil(total / DEFAULT_PAGE_LIMIT)

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Trail</h1>
          <p className="text-sm text-gray-500">Rekaman semua perubahan data oleh pengguna</p>
        </div>
        <span className="ml-auto text-sm text-gray-400">{total} aktivitas</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />

        <select
          value={filters.entity_type}
          onChange={e => handleFilter('entity_type', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Modul</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filters.action}
          onChange={e => handleFilter('action', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Aksi</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Dari</span>
          <input
            type="date"
            value={filters.from}
            onChange={e => handleFilter('from', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span>s/d</span>
          <input
            type="date"
            value={filters.to}
            onChange={e => handleFilter('to', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {(filters.entity_type || filters.action || filters.from || filters.to) && (
          <button
            onClick={() => { setFilters({ entity_type: '', action: '', from: '', to: '' }); setPage(1) }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Memuat...</div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            <p>Belum ada aktivitas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Waktu</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pengguna</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Modul</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log, index) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{rowNumber(page, index)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{log.user?.name || '-'}</div>
                    <div className="text-xs text-gray-400">{log.user?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">
                    {ENTITY_LABELS[log.entity_type] || log.entity_type}
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{log.entity_name}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Halaman {page} dari {totalPages} ({total} data)</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              ‹ Sebelumnya
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Berikutnya ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
