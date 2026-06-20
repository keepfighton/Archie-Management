import { useEffect, useState } from 'react'
import { paymentService } from '@/services/api'
import { toast } from 'react-toastify'
import { FileDown, Printer, Trash2 } from 'lucide-react'
import { PageHeader, Toolbar, SearchInput, Loading, EmptyState, ConfirmDialog, Pagination } from '@/components/common'

const PAGE_SIZE = 30

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = (q = search, overridePage = page) => {
    setLoading(true)
    const params: any = { page: overridePage, limit: PAGE_SIZE }
    if (q) params.q = q
    paymentService.list(params)
      .then(r => { setPayments(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setLoading(false))
  }

  const handleExportExcel = () => {
    // Export semua payments ke CSV
    const headers = ['Invoice Number', 'Client', 'Amount', 'Currency', 'Payment Method', 'Payment Date', 'Note']
    const rows = payments.map(p => [
      p.invoice?.invoice_number || '-',
      p.invoice?.client?.name || '-',
      p.amount || 0,
      p.invoice?.currency || 'IDR',
      p.payment_method || '-',
      p.payment_date ? new Date(p.payment_date).toLocaleDateString('id-ID') : '-',
      p.note || '-'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Payments_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('Payments exported to CSV!')
  }

  const handlePrint = () => {
    setTimeout(() => {
      window.print()
    }, 100)
  }

  useEffect(() => { load(search) }, [page])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        load(search, 1)
      } else {
        setPage(1)
      }
    }, 300)
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

  const fmt = (n: number, cur = 'IDR') => `${cur} ${Number(n).toLocaleString('id-ID')}`
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0)

  return (
    <>
      <style>{`
        @media print {
          /* Simple approach - just show what we need */
          @page {
            margin: 1.5cm;
          }

          /* Hide navigation and non-essential elements */
          .no-print,
          nav,
          aside,
          button,
          .sidebar {
            display: none !important;
          }

          /* Show print header */
          .print-header {
            display: block !important;
          }

          /* Clean body */
          body {
            margin: 0;
            padding: 0;
          }

          /* Make table visible and full width */
          table {
            width: 100% !important;
            border-collapse: collapse;
          }

          th, td {
            padding: 6px 8px;
            border: 1px solid #ccc;
            font-size: 11px;
          }

          th {
            background: #f0f0f0 !important;
            font-weight: bold;
          }
        }

        .print-header {
          display: none;
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #333;
        }
        .print-header h1 {
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 5px 0;
        }
        .print-header p {
          font-size: 11px;
          color: #666;
          margin: 3px 0;
        }
      `}</style>
      <div className="p-5">
        <div className="print-header">
          <h1>Payment Records</h1>
          <p>PT Archie TECH • Printed on {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p style={{ marginTop: '8px', fontWeight: 600 }}>Total Received: {fmt(totalAmount)}</p>
        </div>
        <PageHeader title="Payments" />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Total Payments</p>
          <p className="text-xl font-semibold text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Total Received</p>
          <p className="text-xl font-semibold text-green-600">{fmt(totalAmount)}</p>
        </div>
      </div>

      <div className="no-print">
        <Toolbar
          left={<span className="text-xs text-gray-400">{payments.length} records</span>}
          right={
            <>
              <button
                className="btn btn-secondary"
                onClick={handleExportExcel}
                disabled={payments.length === 0}
                title="Export to Excel (CSV)"
              >
                <FileDown size={12} />Excel
              </button>
              <button
                className="btn btn-secondary"
                onClick={handlePrint}
                title="Print payments list"
              >
                <Printer size={12} />Print
              </button>
              <SearchInput value={search} onChange={setSearch} placeholder="Invoice, client, method..." />
            </>
          }
        />
      </div>

      <div className="table-container">
        {loading ? <Loading /> : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-14">No.</th>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Date</th>
                <th>Note</th>
                <th className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0
                ? <tr><td colSpan={8}><EmptyState /></td></tr>
                : payments.map((p, index) => (
                  <tr key={p.id}>
                    <td className="text-gray-400">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="font-medium text-blue-600">{p.invoice?.invoice_number || '-'}</td>
                    <td className="text-gray-500">{p.invoice?.client?.name || '-'}</td>
                    <td className="whitespace-nowrap font-medium text-green-600">{fmt(p.amount, p.currency)}</td>
                    <td className="text-gray-500 capitalize">{p.payment_method || '-'}</td>
                    <td className="text-gray-400 whitespace-nowrap">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('id') : '-'}</td>
                    <td className="text-gray-400">{p.note || '-'}</td>
                    <td className="no-print">
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
        {!loading && (
          <div className="no-print">
            <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />
          </div>
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
    </>
  )
}
