import { useEffect, useState } from 'react'
import { expenseService, contractService, projectService } from '@/services/api'
import { toast } from 'react-toastify'
import { Plus, Filter, FileDown } from 'lucide-react'
import {
  PageHeader, Toolbar, SearchInput, Pagination,
  Modal, FormField, ConfirmDialog, Loading, EmptyState, ViewTabs, PriceInput
} from '@/components/common'

const VIEWS = [{ key: 'expenses', label: 'Expenses' }, { key: 'recurring', label: 'Recurring' }]
const CATEGORIES = ['Travel', 'Office', 'Software', 'Hardware', 'Marketing', 'Training', 'Meals', 'Other']

export default function ExpensesPage() {
  const [view, setView] = useState('expenses')
  const [expenses, setExpenses] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [contracts, setContracts] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    date: new Date().toISOString().split('T')[0], category: '', title: '',
    description: '', amount: '', tax: '0', second_tax: '0', is_recurring: false,
    contract_id: '', client_id: '', project_id: '',
  })

  useEffect(() => {
    contractService.list({ per_page: 999 })
      .then(r => setContracts(r.data.data || r.data || []))
      .catch(() => {})
    projectService.list({ limit: 999 })
      .then(r => setProjects(r.data.data || []))
      .catch(() => {})
  }, [])

  const load = () => {
    setLoading(true)
    expenseService.list({ recurring: view === 'recurring' })
      .then(r => { setExpenses(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(() => toast.error('Failed to load expenses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [view])
  useEffect(() => {
    if (!search) { setFiltered(expenses); return }
    const q = search.toLowerCase()
    setFiltered(expenses.filter(e => e.title?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)))
  }, [search, expenses])

  const totalAmount = filtered.reduce((sum, e) => sum + (e.total || 0), 0)

  const openAdd = () => {
    setEditItem(null)
    setForm({ date: new Date().toISOString().split('T')[0], category: '', title: '', description: '', amount: '', tax: '0', second_tax: '0', is_recurring: view === 'recurring', contract_id: '', client_id: '', project_id: '' })
    setShowModal(true)
  }

  const openEdit = (e: any) => {
    setEditItem(e)
    const taxPct = e.amount > 0 ? Math.round((e.tax / e.amount) * 10000) / 100 : 0
    const secondTaxPct = e.amount > 0 ? Math.round((e.second_tax / e.amount) * 10000) / 100 : 0
    setForm({ date: e.date?.split('T')[0] || '', category: e.category || '', title: e.title, description: e.description || '', amount: e.amount, tax: taxPct, second_tax: secondTaxPct, is_recurring: e.is_recurring, contract_id: e.contract_id || '', client_id: e.client_id || '', project_id: e.project_id || '' })
    setShowModal(true)
  }

  const handleContractChange = (contractId: string) => {
    const contract = contracts.find(c => String(c.id) === contractId)
    setForm((f: any) => ({
      ...f,
      contract_id: contractId,
      client_id: contract?.client_id ? String(contract.client_id) : f.client_id,
      project_id: contract?.project_id ? String(contract.project_id) : f.project_id,
    }))
  }

  const handleSave = async () => {
    if (!form.contract_id) { toast.error('Contract is required'); return }
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const amt = Number(form.amount)
      const taxNominal = Math.round(amt * Number(form.tax) / 100)
      const secondTaxNominal = Math.round(amt * Number(form.second_tax) / 100)
      const payload = {
        ...form,
        amount: amt,
        tax: taxNominal,
        second_tax: secondTaxNominal,
        contract_id: form.contract_id ? Number(form.contract_id) : null,
        client_id: form.client_id ? Number(form.client_id) : null,
        project_id: form.project_id ? Number(form.project_id) : null,
      }
      if (editItem) { await expenseService.update(editItem.id, payload); toast.success('Expense updated!') }
      else { await expenseService.create(payload); toast.success('Expense added!') }
      setShowModal(false)
      load()
    } catch { toast.error('Failed to save expense') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try { await expenseService.delete(deleteId); toast.success('Expense deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Expenses"
        actions={
          <>
            <button className="btn btn-secondary"><FileDown size={12} /> Export</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add expense</button>
          </>
        }
      />

      <ViewTabs tabs={VIEWS} active={view} onChange={v => { setView(v); setSearch('') }} />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Total Records</p>
          <p className="text-xl font-semibold text-gray-900">{filtered.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Total Amount</p>
          <p className="text-xl font-semibold text-red-500">IDR {totalAmount.toLocaleString()}</p>
        </div>
      </div>

      <Toolbar
        left={<button className="btn btn-secondary"><Filter size={12} />+ Filter</button>}
        right={
          <>
            <button className="btn btn-secondary"><FileDown size={12} />Excel</button>
            <SearchInput value={search} onChange={setSearch} />
          </>
        }
      />

      <div className="table-container">
        {loading ? <Loading /> : (
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Contract</th><th>Client</th><th>Category</th><th>Title</th><th>Amount</th><th>Tax</th><th>Total</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7}><EmptyState /></td></tr>
                : filtered.map(e => (
                  <tr key={e.id}>
                    <td className="text-gray-400 whitespace-nowrap">{e.date ? new Date(e.date).toLocaleDateString('id') : '-'}</td>
                    <td className="text-sm">{e.contract ? `${e.contract.contract_number}` : '-'}</td>
                    <td className="text-sm text-gray-500">{e.client?.name || '-'}</td>
                    <td>
                      <span className="badge badge-blue">{e.category || 'Other'}</span>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{e.title}</p>
                        {e.description && <p className="text-xs text-gray-400">{e.description}</p>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{Number(e.amount).toLocaleString()}</td>
                    <td className="text-gray-400">{Number(e.tax + e.second_tax).toLocaleString()}</td>
                    <td className="font-medium text-red-500 whitespace-nowrap">{Number(e.total).toLocaleString()}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(e)}>Edit</button>
                        <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(e.id)}>×</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Expense' : 'Add Expense'} size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Contract" required>
              <select className="input" value={form.contract_id} onChange={e => handleContractChange(e.target.value)}>
                <option value="">Select contract...</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>{c.contract_number} — {c.title}</option>
                ))}
              </select>
            </FormField>
          </div>
          {form.client_id && (
            <div className="col-span-2">
              <FormField label="Client">
                <input className="input bg-blue-50 text-blue-700" readOnly
                  value={contracts.find(c => String(c.id) === String(form.contract_id))?.client?.name || `Client #${form.client_id}`} />
              </FormField>
            </div>
          )}
          <div className="col-span-2">
            <FormField label="Project">
              <select className="input" value={form.project_id} onChange={e => setForm((f: any) => ({ ...f, project_id: e.target.value }))}>
                <option value="">No project</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              {form.project_id && contracts.find(c => String(c.id) === String(form.contract_id))?.project_id === Number(form.project_id) && (
                <p className="text-xs text-blue-500 mt-1">Auto-filled from contract</p>
              )}
            </FormField>
          </div>
          <FormField label="Date">
            <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </FormField>
          <FormField label="Category">
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">Select category...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <div className="col-span-2">
            <FormField label="Title" required>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Expense title" />
            </FormField>
          </div>
          <FormField label="Amount">
            <PriceInput value={form.amount} onChange={v => setForm({ ...form, amount: v })} />
          </FormField>
          <FormField label="Tax (%)">
            <div className="relative">
              <input className="input pr-8" type="number" min="0" max="100" step="0.01"
                value={form.tax} onChange={e => setForm({ ...form, tax: e.target.value })}
                placeholder="0" />
              <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">%</span>
            </div>
            {Number(form.amount) > 0 && Number(form.tax) > 0 && (
              <p className="text-xs text-blue-500 mt-1">= {Math.round(Number(form.amount) * Number(form.tax) / 100).toLocaleString('id')}</p>
            )}
          </FormField>
          <FormField label="Second Tax (%)">
            <div className="relative">
              <input className="input pr-8" type="number" min="0" max="100" step="0.01"
                value={form.second_tax} onChange={e => setForm({ ...form, second_tax: e.target.value })}
                placeholder="0" />
              <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">%</span>
            </div>
            {Number(form.amount) > 0 && Number(form.second_tax) > 0 && (
              <p className="text-xs text-blue-500 mt-1">= {Math.round(Number(form.amount) * Number(form.second_tax) / 100).toLocaleString('id')}</p>
            )}
          </FormField>
          <FormField label="Total Amount">
            <input className="input bg-gray-50 font-semibold text-gray-700" readOnly
              value={(() => {
                const amt = Number(form.amount) || 0
                const tax = Math.round(amt * (Number(form.tax) || 0) / 100)
                const tax2 = Math.round(amt * (Number(form.second_tax) || 0) / 100)
                return (amt + tax + tax2).toLocaleString('id')
              })()} />
          </FormField>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="recurring" checked={form.is_recurring} onChange={e => setForm({ ...form, is_recurring: e.target.checked })} />
            <label htmlFor="recurring" className="text-sm text-gray-600">Recurring expense</label>
          </div>
          <div className="col-span-2">
            <FormField label="Description">
              <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  )
}
