import { useEffect, useState, useCallback } from 'react'
import { paymentService } from '@/services/api'
import { toast } from 'react-toastify'
import { FileDown, Printer, Trash2 } from 'lucide-react'
import { PageHeader, Toolbar, SearchInput, Loading, EmptyState, ConfirmDialog, rowNumber } from '@/components/common'

const MONTHS = [
  { value: '', label: 'All Months' },
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(String(currentYear))
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback((q = '', m = month, y = year) => {
    setLoading(true)
    const params: any = {}
    if (q) params.q = q
    if (m) params.month = m
    if (y) params.year = y
    paymentService.list(Object.keys(params).length ? params : undefined)
      .then(r => { setPayments(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setLoading(false))
  }, [month, year])

  useEffect(() => { load('', month, year) }, [month, year])

  useEffect(() => {
    const timer = setTimeout(() => load(search, month, year), 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleDelete = () => {
    if (!deleteId) return
    paymentService.delete(deleteId)
      .then(() => {
        toast.success('Payment deleted')
        setDeleteId(null)
        load(search)
      })
      .catch((e: any) => {
        toast.error(e?.response?.data?.error || 'Failed to delete payment')
        setDeleteId(null)
      })
  }

  const fmt = (n: number, cur = 'IDR') => `${cur} ${Number(n).toLocaleString()}`
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0)

  return (
    <div className="p-5">
      <PageHeader title="Payments" />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">{(month || year !== String(currentYear)) ? 'Filtered Payments' : 'Total Payments'}</p>
          <p className="text-xl font-semibold text-gray-900">{payments.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">{(month || year !== String(currentYear)) ? 'Filtered Received' : 'Total Received'}</p>
          <p className="text-xl font-semibold text-green-600">{fmt(totalAmount)}</p>
        </div>
      </div>

      <Toolbar
        left={
          <div className="flex gap-2 items-center">
            <select className="input text-xs py-1 h-8" value={year} onChange={e => setYear(e.target.value)}>
              <option value="">All Years</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="input text-xs py-1 h-8" value={month} onChange={e => setMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <span className="text-xs text-gray-400">{payments.length} records</span>
          </div>
        }
        right={
          <>
            <button className="btn btn-secondary"><FileDown size={12} />Excel</button>
            <button className="btn btn-secondary"><Printer size={12} />Print</button>
            <SearchInput value={search} onChange={setSearch} placeholder="Invoice, client, method..." />
          </>
        }
      />

      <div className="table-container">
        {loading ? <Loading /> : (
          <table className="table">
            <thead>
              <tr><th className="w-16">No.</th><th>Invoice #</th><th>Client</th><th>Amount</th><th>Method</th><th>Date</th><th>Note</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {payments.length === 0
                ? <tr><td colSpan={8}><EmptyState /></td></tr>
                : payments.map((p, index) => (
                  <tr key={p.id}>
                    <td className="text-gray-400">{rowNumber(1, index, payments.length || 1)}</td>
                    <td className="font-medium text-blue-600">{p.invoice?.invoice_number || '-'}</td>
                    <td className="text-gray-500">{p.invoice?.client?.name || '-'}</td>
                    <td className="whitespace-nowrap font-medium text-green-600">{fmt(p.amount, p.currency)}</td>
                    <td className="text-gray-500 capitalize">{p.payment_method || '-'}</td>
                    <td className="text-gray-400 whitespace-nowrap">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('id') : '-'}</td>
                    <td className="text-gray-400">{p.note || '-'}</td>
                    <td>
                      <button
                        className="btn btn-danger text-xs py-0.5 px-2"
                        title="Delete payment"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This action cannot be undone."
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  )
}
