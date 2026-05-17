import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { contractService, expenseService } from '@/services/api'
import { toast } from 'react-toastify'
import { ArrowLeft, Building2, FolderKanban, Calendar, DollarSign, FileText } from 'lucide-react'
import { StatusBadge, Loading, rowNumber } from '@/components/common'

interface Contract {
  id: number
  contract_number: string
  title: string
  status: string
  currency: string
  amount: number
  contract_date?: string
  valid_until?: string
  file_url?: string
  client?: { name: string }
  project?: { title: string }
}

interface Expense {
  id: number
  contract_id: number
  date: string
  title: string
  category: string
  amount: number
  tax: number
  second_tax: number
  total: number
}

export default function ContractDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState<Contract | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      contractService.get(Number(id)),
      expenseService.list({ contract_id: id, limit: 1000 }),
    ])
      .then(([cRes, eRes]) => {
        setContract(cRes.data)
        setExpenses(eRes.data.data || [])
      })
      .catch(() => toast.error('Failed to load contract'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-5"><Loading /></div>
  if (!contract) return <div className="p-5 text-gray-400">Contract not found.</div>

  const totalExpenses = expenses.reduce((s, e) => s + (e.total || 0), 0)
  const isExpired = contract.valid_until && new Date(contract.valid_until) < new Date() && contract.status !== 'completed'

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-1">{contract.contract_number}</p>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{contract.title}</h1>
            <StatusBadge status={contract.status} />
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Contract Value</p>
            <p className="text-2xl font-bold text-gray-900">{contract.currency} {Number(contract.amount).toLocaleString('id')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100 sm:grid-cols-4">
          <div className="flex gap-2">
            <Building2 size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Client</p>
              <p className="text-sm font-medium text-gray-700">{contract.client?.name || '-'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <FolderKanban size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Project</p>
              <p className="text-sm font-medium text-gray-700">{contract.project?.title || '-'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Calendar size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Contract Date</p>
              <p className="text-sm font-medium text-gray-700">
                {contract.contract_date ? new Date(contract.contract_date).toLocaleDateString('id') : '-'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Calendar size={16} className={`mt-0.5 shrink-0 ${isExpired ? 'text-red-400' : 'text-gray-400'}`} />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Valid Until</p>
              <p className={`text-sm font-medium ${isExpired ? 'text-red-500' : 'text-gray-700'}`}>
                {contract.valid_until ? new Date(contract.valid_until).toLocaleDateString('id') : '-'}
                {isExpired && <span className="ml-1 text-xs">(Expired)</span>}
              </p>
            </div>
          </div>
        </div>

        {contract.file_url && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <a href={contract.file_url} target="_blank" rel="noreferrer"
               className="flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
              <FileText size={14} /> View attached file
            </a>
          </div>
        )}
      </div>

      {/* Expenses */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Related Expenses</h2>
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{expenses.length}</span>
          </div>
          {expenses.length > 0 && (
            <p className="text-sm font-semibold text-red-500">Total: {contract.currency} {totalExpenses.toLocaleString('id')}</p>
          )}
        </div>

        {expenses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No expenses linked to this contract.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th className="w-16">No.</th><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Tax</th><th>Total</th></tr>
            </thead>
            <tbody>
              {expenses.map((e, index) => (
                <tr key={e.id}>
                  <td className="text-gray-400">{rowNumber(1, index, expenses.length || 1)}</td>
                  <td className="text-gray-400 whitespace-nowrap">{e.date ? new Date(e.date).toLocaleDateString('id') : '-'}</td>
                  <td className="font-medium">{e.title}</td>
                  <td><span className="badge badge-blue">{e.category || 'Other'}</span></td>
                  <td className="whitespace-nowrap">{Number(e.amount).toLocaleString('id')}</td>
                  <td className="text-gray-400">{Number(e.tax + e.second_tax).toLocaleString('id')}</td>
                  <td className="font-medium text-red-500 whitespace-nowrap">{Number(e.total).toLocaleString('id')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
