import { useEffect, useState } from 'react'
import { itemService } from '@/services/api'
import { toast } from 'react-toastify'
import { Search, Plus } from 'lucide-react'
import { Loading, EmptyState, Modal, FormField, ConfirmDialog, PriceInput } from '@/components/common'

export default function StorePage() {
  const [items, setItems] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({ title: '', description: '', category: '', unit_type: '', rate: '', currency: 'IDR' })

  const load = () => {
    setLoading(true)
    itemService.list()
      .then(r => setItems(r.data.data || []))
      .catch(() => toast.error('Failed to load store'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    let list = items
    if (search) { const q = search.toLowerCase(); list = list.filter(i => i.title?.toLowerCase().includes(q)) }
    if (category) list = list.filter(i => i.category === category)
    setFiltered(list)
  }, [search, category, items])

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))]

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
      if (editItem) { await itemService.update(editItem.id, payload); toast.success('Item updated!') }
      else { await itemService.create(payload); toast.success('Item added to store!') }
      setShowModal(false); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try { await itemService.delete(deleteId); toast.success('Item removed'); load() }
    catch { toast.error('Failed to delete') }
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Store</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add item</button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input input-sm pl-7 w-48" />
        </div>
        <select className="input input-sm w-40" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : (
        filtered.length === 0
          ? <EmptyState message="No items in store." />
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map(item => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-semibold text-sm mb-3">
                    {item.title?.[0]?.toUpperCase()}
                  </div>
                  <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                  {item.category && <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>}
                  {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">
                      {item.currency} {Number(item.rate).toLocaleString('id-ID')}
                      {item.unit_type && <span className="font-normal text-gray-400 text-xs">/{item.unit_type}</span>}
                    </span>
                    <div className="flex gap-1">
                      <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(item)}>Edit</button>
                      <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(item.id)}>×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Item' : 'Add to Store'}
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
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Item name" />
            </FormField>
          </div>
          <FormField label="Category">
            <input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Service" />
          </FormField>
          <FormField label="Unit Type">
            <input className="input" value={form.unit_type} onChange={e => setForm({ ...form, unit_type: e.target.value })} placeholder="hour, pcs..." />
          </FormField>
          <FormField label="Rate">
            <PriceInput value={form.rate} onChange={v => setForm({ ...form, rate: v })} />
          </FormField>
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="IDR">IDR</option><option value="USD">USD</option>
            </select>
          </FormField>
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
