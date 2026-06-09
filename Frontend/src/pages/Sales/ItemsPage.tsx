import { useEffect, useState } from 'react'
import { itemService } from '@/services/api'
import { toast } from 'react-toastify'
import { Plus, Search } from 'lucide-react'
import { PageHeader, Modal, FormField, ConfirmDialog, Loading, EmptyState, PriceInput, Pagination } from '@/components/common'

const PAGE_SIZE = 30

export default function ItemsPage() {
  const [items, setItems] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    title: '', description: '', category: '', unit_type: '', rate: '', currency: 'IDR',
  })

  const load = () => {
    setLoading(true)
    itemService.list()
      .then(r => setItems(r.data.data || []))
      .catch(() => toast.error('Failed to load items'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!search) { setFiltered(items); setPage(1); return }
    const q = search.toLowerCase()
    setFiltered(items.filter(i => i.title?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)))
    setPage(1)
  }, [search, items])
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openAdd = () => {
    setEditItem(null)
    setForm({ title: '', description: '', category: '', unit_type: '', rate: '', currency: 'IDR' })
    setShowModal(true)
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    setForm({ title: item.title, description: item.description || '', category: item.category || '', unit_type: item.unit_type || '', rate: item.rate, currency: item.currency })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const payload = { ...form, rate: Number(form.rate) }
      if (editItem) {
        await itemService.update(editItem.id, payload)
        toast.success('Item updated!')
      } else {
        await itemService.create(payload)
        toast.success('Item created!')
      }
      setShowModal(false)
      load()
    } catch { toast.error('Failed to save item') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await itemService.delete(deleteId)
      toast.success('Item deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Items"
        actions={<button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add item</button>}
      />

      <div className="flex items-center mb-3">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="input input-sm pl-7 w-48"
          />
        </div>
      </div>

      <div className="table-container">
        {loading ? <Loading /> : (
          <table className="table">
            <thead>
              <tr><th className="w-14">No.</th><th>Title</th><th>Category</th><th>Unit</th><th>Rate</th><th>Currency</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7}><EmptyState /></td></tr>
                : paginated.map((item, index) => (
                  <tr key={item.id}>
                    <td className="text-gray-400">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                      </div>
                    </td>
                    <td className="text-gray-500">{item.category || '-'}</td>
                    <td className="text-gray-400">{item.unit_type || '-'}</td>
                    <td className="font-medium whitespace-nowrap">{Number(item.rate).toLocaleString('id-ID')}</td>
                    <td className="text-gray-400">{item.currency}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(item)}>Edit</button>
                        <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(item.id)}>×</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
        {!loading && <Pagination page={page} total={filtered.length} limit={PAGE_SIZE} onChange={setPage} />}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Item' : 'Add Item'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Title" required>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Item / service name" />
            </FormField>
          </div>
          <FormField label="Category">
            <select
              className="input"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Select category...</option>
              <option value="Travel">Travel</option>
              <option value="Office">Office</option>
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Marketing">Marketing</option>
              <option value="Training">Training</option>
              <option value="Meals">Meals</option>
              <option value="Other">Other</option>
            </select>
          </FormField>
          <FormField label="Unit Type">
            <input className="input" value={form.unit_type} onChange={e => setForm({ ...form, unit_type: e.target.value })} placeholder="e.g. hour, pcs, day" />
          </FormField>
          <FormField label="Rate">
            <PriceInput value={form.rate} onChange={v => setForm({ ...form, rate: v })} />
          </FormField>
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="IDR">IDR</option><option value="USD">USD</option><option value="EUR">EUR</option>
            </select>
          </FormField>
          <div className="col-span-2">
            <FormField label="Description">
              <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..." />
            </FormField>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  )
}
