import { useEffect, useState, useRef } from 'react'
import { API_BASE_URL, fileService } from '@/services/api'
import { toast } from 'react-toastify'
import { Folder, File, Star, Upload, FolderPlus, Trash2, ChevronRight, Download } from 'lucide-react'
import { Loading, EmptyState, Modal, FormField, ConfirmDialog, rowNumber } from '@/components/common'
import clsx from 'clsx'

function formatBytes(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentFolder, setCurrentFolder] = useState<number | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: number | null; name: string }[]>([{ id: null, name: 'My Files' }])
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    const params: any = {}
    if (currentFolder !== null) params.folder_id = currentFolder
    fileService.list(params)
      .then(r => setFiles(r.data.data || []))
      .catch(() => toast.error('Failed to load files'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [currentFolder])

  const openFolder = (folder: any) => {
    setCurrentFolder(folder.id)
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }])
  }

  const navigateTo = (index: number) => {
    const crumb = breadcrumbs[index]
    setCurrentFolder(crumb.id)
    setBreadcrumbs(prev => prev.slice(0, index + 1))
  }

  const handleCreateFolder = async () => {
    if (!folderName.trim()) { toast.error('Folder name is required'); return }
    setSaving(true)
    try {
      await fileService.createFolder({ name: folderName, folder_id: currentFolder })
      toast.success('Folder created!')
      setShowFolderModal(false)
      setFolderName('')
      load()
    } catch { toast.error('Failed to create folder') }
    finally { setSaving(false) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    if (currentFolder) formData.append('folder_id', String(currentFolder))
    try {
      await fileService.upload(formData)
      toast.success(`"${file.name}" uploaded!`)
      load()
    } catch { toast.error('Failed to upload file') }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleToggleFavorite = async (id: number) => {
    try {
      await fileService.toggleFavorite(id)
      load()
    } catch { toast.error('Failed to update favorite') }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await fileService.delete(deleteId)
      toast.success('Deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  const folders = files.filter(f => f.is_folder)
  const docs = files.filter(f => !f.is_folder)

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Files</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowFolderModal(true)}>
            <FolderPlus size={12} /> New folder
          </button>
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={12} /> Upload
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
            <button
              onClick={() => navigateTo(i)}
              className={clsx('hover:text-blue-600', i === breadcrumbs.length - 1 ? 'font-medium text-gray-800' : '')}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {loading ? <Loading /> : (
        files.length === 0
          ? <EmptyState message="This folder is empty." />
          : (
            <div>
              {folders.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Folders</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {folders.map(f => (
                      <div
                        key={f.id}
                        className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
                        onDoubleClick={() => openFolder(f)}
                      >
                        <div className="flex items-start justify-between">
                          <Folder size={28} className="text-yellow-400" />
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                            <button onClick={() => handleToggleFavorite(f.id)} className="p-1 hover:text-yellow-500">
                              <Star size={12} className={f.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''} />
                            </button>
                            <button onClick={() => setDeleteId(f.id)} className="p-1 hover:text-red-500">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs font-medium text-gray-700 mt-2 truncate">{f.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {docs.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Files</p>
                  <div className="bg-white rounded-lg border border-gray-200">
                    <table className="table">
                      <thead>
                        <tr><th className="w-16">No.</th><th>Name</th><th>Size</th><th>Type</th><th></th></tr>
                      </thead>
                      <tbody>
                        {docs.map((f, index) => (
                          <tr key={f.id} className="group">
                            <td className="text-gray-400">{rowNumber(1, index, docs.length || 1)}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <File size={14} className="text-gray-400 flex-shrink-0" />
                                <span className="text-sm">{f.name}</span>
                                {f.is_favorite && <Star size={11} className="fill-yellow-400 text-yellow-400" />}
                              </div>
                            </td>
                            <td className="text-gray-400">{formatBytes(f.size)}</td>
                            <td className="text-gray-400 text-xs">{f.mime_type || '-'}</td>
                            <td>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                {f.url && (
                                  <a
                                    href={f.url}
                                    download={f.name}
                                    onClick={e => {
                                      e.preventDefault()
                                      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
                                      fetch(`${API_BASE_URL}/files/${f.id}/download`, { headers: { Authorization: `Bearer ${token}` } })
                                        .then(r => r.blob()).then(blob => {
                                          const a = document.createElement('a')
                                          a.href = URL.createObjectURL(blob)
                                          a.download = f.name
                                          a.click()
                                          URL.revokeObjectURL(a.href)
                                        })
                                    }}
                                    className="btn btn-secondary text-xs py-0.5 px-2"
                                    title="Download"
                                  >
                                    <Download size={11} />
                                  </a>
                                )}
                                <button onClick={() => handleToggleFavorite(f.id)} className="btn btn-secondary text-xs py-0.5 px-2">
                                  <Star size={11} />
                                </button>
                                <button onClick={() => setDeleteId(f.id)} className="btn btn-danger text-xs py-0.5 px-2">×</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
      )}

      <Modal open={showFolderModal} onClose={() => setShowFolderModal(false)} title="New Folder" size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowFolderModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateFolder} disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
          </>
        }
      >
        <FormField label="Folder Name" required>
          <input className="input" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="My folder" autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
        </FormField>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  )
}
