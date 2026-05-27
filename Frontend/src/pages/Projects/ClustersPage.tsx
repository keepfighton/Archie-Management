import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clusterService } from '@/services/api'
import { toast } from 'react-toastify'
import { ChevronDown, ChevronRight, Edit2, Plus, Trash2 } from 'lucide-react'
import {
  PageHeader, Toolbar, SearchInput, Pagination,
  Modal, FormField, ConfirmDialog, Loading, EmptyState,
  DEFAULT_PAGE_LIMIT, rowNumber,
} from '@/components/common'

export default function ClustersPage() {
  const [clusters, setClusters] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [expandedClusterId, setExpandedClusterId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchClusters = (nextPage = page) => {
    setLoading(true)
    clusterService.list({ page: nextPage, limit: DEFAULT_PAGE_LIMIT, q: search })
      .then(r => {
        setClusters(r.data.data || [])
        setTotal(r.data.total || 0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchClusters() }, [page, search])

  const openAdd = () => {
    setEditItem(null)
    setName('')
    setDescription('')
    setShowModal(true)
  }

  const openEdit = (cluster: any) => {
    setEditItem(cluster)
    setName(cluster.name || '')
    setDescription(cluster.description || '')
    setShowModal(true)
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Nama cluster wajib diisi')
      return
    }
    setSaving(true)
    try {
      if (editItem) {
        await clusterService.update(editItem.id, { name: trimmed, description: description.trim() })
        toast.success('Cluster updated')
      } else {
        await clusterService.create({ name: trimmed, description: description.trim() })
        toast.success('Cluster created')
      }
      setShowModal(false)
      setPage(1)
      fetchClusters(1)
    } catch (error: any) {
      toast.error(error?.response?.data?.error || (editItem ? 'Failed to update cluster' : 'Failed to create cluster'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await clusterService.delete(deleteId)
      toast.success('Cluster deleted')
      fetchClusters()
    } catch {
      toast.error('Failed to delete cluster')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Cluster"
        actions={<button className="btn btn-primary" onClick={openAdd}><Plus size={12} /> Add cluster</button>}
      />

      <Toolbar
        left={null}
        right={<SearchInput value={search} onChange={setSearch} />}
      />

      <div className="table-container">
        {loading ? <Loading /> : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th className="w-16">No.</th>
                  <th>Nama Cluster</th>
                  <th>Deskripsi</th>
                  <th className="w-32"></th>
                </tr>
              </thead>
              <tbody>
                {clusters.length === 0 ? (
                  <tr><td colSpan={4}><EmptyState message="Belum ada cluster." /></td></tr>
                ) : clusters.map((cluster, index) => {
                  const isExpanded = expandedClusterId === cluster.id
                  const projects = cluster.projects || []

                  return (
                    <Fragment key={cluster.id}>
                      <tr>
                        <td className="text-gray-400">{rowNumber(page, index)}</td>
                        <td className="font-medium text-gray-800">
                          <button
                            className="inline-flex items-center gap-2 text-left font-semibold text-gray-800 transition hover:text-blue-600"
                            onClick={() => setExpandedClusterId(isExpanded ? null : cluster.id)}
                          >
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            <span>{cluster.name}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              {projects.length}
                            </span>
                          </button>
                        </td>
                        <td className="max-w-md text-gray-500">
                          <div className="line-clamp-2">{cluster.description || '-'}</div>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(cluster)}>
                              <Edit2 size={12} /> Edit
                            </button>
                            <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(cluster.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td></td>
                          <td colSpan={3} className="bg-slate-50">
                            {projects.length === 0 ? (
                              <div className="py-3 text-sm text-gray-400">Belum ada project di cluster ini.</div>
                            ) : (
                              <div className="space-y-2 py-2">
                                {projects.map((project: any) => (
                                  <Link
                                    key={project.id}
                                    to={`/projects/${project.id}`}
                                    className="block w-fit text-sm font-medium text-blue-600 hover:underline"
                                  >
                                    / {project.title}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={DEFAULT_PAGE_LIMIT} onChange={setPage} />
          </>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Edit Cluster' : 'Add Cluster'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editItem ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Nama Cluster" required>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Nama cluster" />
          </FormField>
          <FormField label="Deskripsi">
            <textarea
              className="input"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Deskripsi cluster..."
            />
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  )
}
