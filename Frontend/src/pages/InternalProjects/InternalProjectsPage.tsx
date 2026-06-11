import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { Archive, ChevronDown, ChevronUp, FolderKanban, Plus, Search, Users, AlertCircle, ArrowRight } from 'lucide-react'
import { toast } from 'react-toastify'
import type { RootState } from '@/store'
import { internalProjectService, teamService } from '@/services/api'
import { useLocale } from '@/contexts/LocaleContext'
import {
  ConfirmDialog,
  DEFAULT_PAGE_LIMIT,
  EmptyState,
  FormField,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  ProgressBar,
  SearchInput,
  Toolbar,
  rowNumber,
} from '@/components/common'

type UserSummary = {
  id: number
  name: string
  email: string
  avatar?: string
  is_active?: boolean
}

type ProjectMember = {
  id: number
  user_id: number
  role: 'owner' | 'member'
  user?: UserSummary
}

type InternalProject = {
  id: number
  name: string
  description: string
  owner_id: number
  owner?: UserSummary
  status: 'active' | 'archived'
  progress: number
  members?: ProjectMember[]
  created_at: string
  updated_at: string
}

const emptyForm = { name: '', description: '', status: 'active' }

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'
}

export default function InternalProjectsPage() {
  const { locale, t } = useLocale()
  const currentUser = useSelector((state: RootState) => state.auth.user)
  const [projects, setProjects] = useState<InternalProject[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editItem, setEditItem] = useState<InternalProject | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteItem, setDeleteItem] = useState<InternalProject | null>(null)
  const [memberProject, setMemberProject] = useState<InternalProject | null>(null)
  const [memberList, setMemberList] = useState<ProjectMember[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberSaving, setMemberSaving] = useState(false)
  const [myTasks, setMyTasks] = useState<any[]>([])
  const [myTasksCollapsed, setMyTasksCollapsed] = useState(false)

  const loadMyTasks = () => {
    internalProjectService.getMyTasks()
      .then(r => setMyTasks(r.data.data || []))
      .catch(() => setMyTasks([]))
  }

  const loadProjects = (overridePage?: number) => {
    const nextPage = overridePage || page
    setLoading(true)
    internalProjectService.list({
      page: nextPage,
      limit: DEFAULT_PAGE_LIMIT,
      q: search || undefined,
      status: status || undefined,
    })
      .then(response => {
        setProjects(response.data.data || [])
        setTotal(response.data.total || 0)
      })
      .catch(() => toast.error(t('internalProjects.loadFailed', 'Failed to load internal projects')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProjects() }, [page, search, status])
  useEffect(() => {
    loadMyTasks()
    teamService.listMembers({ limit: 500 })
      .then(response => setUsers((response.data.data || []).filter((user: UserSummary) => user.is_active !== false)))
      .catch(() => setUsers([]))
  }, [])

  const stats = useMemo(() => ({
    active: projects.filter(project => project.status === 'active').length,
    archived: projects.filter(project => project.status === 'archived').length,
    members: new Set(projects.flatMap(project => (project.members || []).map(member => member.user_id))).size,
  }), [projects])

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (project: InternalProject) => {
    setEditItem(project)
    setForm({ name: project.name, description: project.description || '', status: project.status })
    setShowForm(true)
  }

  const saveProject = async () => {
    if (form.name.trim().length < 2) {
      toast.error(t('internalProjects.nameRequired', 'Project name must contain at least 2 characters'))
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, name: form.name.trim(), description: form.description.trim() }
      if (editItem) {
        await internalProjectService.update(editItem.id, payload)
        toast.success(t('internalProjects.updated', 'Internal project updated'))
      } else {
        await internalProjectService.create(payload)
        toast.success(t('internalProjects.created', 'Internal project created'))
      }
      setShowForm(false)
      setPage(1)
      loadProjects(1)
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('internalProjects.saveFailed', 'Failed to save internal project'))
    } finally {
      setSaving(false)
    }
  }

  const removeProject = async () => {
    if (!deleteItem) return
    try {
      await internalProjectService.delete(deleteItem.id)
      toast.success(t('internalProjects.deleted', 'Internal project deleted'))
      setDeleteItem(null)
      loadProjects()
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('internalProjects.deleteFailed', 'Failed to delete internal project'))
    }
  }

  const loadMembers = async (project: InternalProject) => {
    setMemberProject(project)
    setMemberList(project.members || [])
    setSelectedUserId('')
    setMembersLoading(true)
    try {
      const response = await internalProjectService.listMembers(project.id)
      setMemberList(response.data.data || [])
    } catch {
      toast.error(t('internalProjects.membersLoadFailed', 'Failed to load project members'))
    } finally {
      setMembersLoading(false)
    }
  }

  const addMember = async () => {
    if (!memberProject || !selectedUserId) return
    setMemberSaving(true)
    try {
      const response = await internalProjectService.addMember(memberProject.id, Number(selectedUserId))
      setMemberList(current => [...current, response.data])
      setSelectedUserId('')
      toast.success(t('internalProjects.memberAdded', 'Member added'))
      loadProjects()
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('internalProjects.memberAddFailed', 'Failed to add member'))
    } finally {
      setMemberSaving(false)
    }
  }

  const removeMember = async (member: ProjectMember) => {
    if (!memberProject) return
    try {
      await internalProjectService.removeMember(memberProject.id, member.user_id)
      setMemberList(current => current.filter(item => item.user_id !== member.user_id))
      toast.success(t('internalProjects.memberRemoved', 'Member removed'))
      loadProjects()
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('internalProjects.memberRemoveFailed', 'Failed to remove member'))
    }
  }

  const availableUsers = users.filter(user => !memberList.some(member => member.user_id === user.id))
  const isAdmin = currentUser?.role === 'admin'
  const canManage = (project: InternalProject) => isAdmin || project.owner_id === currentUser?.id

  return (
    <div className="p-5">
      <PageHeader
        title={t('internalProjects.title', 'Internal Projects')}
        actions={currentUser?.role === 'admin' ? <button className="btn btn-primary" onClick={openAdd}><Plus size={15} />{t('internalProjects.add', 'Add project')}</button> : undefined}
      />

      <p className="-mt-2 mb-5 max-w-3xl text-sm text-gray-500">
        {t('internalProjects.subtitle', 'Monitor company initiatives that are not connected to clients, contracts, or billing.')}
      </p>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="stat-card">
          <div className="stat-icon bg-blue-50 text-blue-600"><FolderKanban size={19} /></div>
          <div><div className="stat-val">{total}</div><div className="stat-label">{t('internalProjects.total', 'Total projects')}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-emerald-50 text-emerald-600"><FolderKanban size={19} /></div>
          <div><div className="stat-val">{stats.active}</div><div className="stat-label">{t('internalProjects.active', 'Active on this page')}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-slate-100 text-slate-600"><Archive size={19} /></div>
          <div><div className="stat-val">{stats.archived}</div><div className="stat-label">{t('internalProjects.archived', 'Archived on this page')}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-violet-50 text-violet-600"><Users size={19} /></div>
          <div><div className="stat-val">{stats.members}</div><div className="stat-label">{t('internalProjects.people', 'People involved')}</div></div>
        </div>
      </div>

      <Toolbar
        left={
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {[
              ['', t('internalProjects.all', 'All')],
              ['active', t('internalProjects.statusActive', 'Active')],
              ['archived', t('internalProjects.statusArchived', 'Archived')],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${status === value ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                onClick={() => { setStatus(value); setPage(1) }}
              >{label}</button>
            ))}
          </div>
        }
        right={<SearchInput value={search} onChange={value => { setSearch(value); setPage(1) }} placeholder={t('internalProjects.search', 'Search projects...')} />}
      />

      <div className="table-container">
        {loading ? <Loading /> : (
          <>
            <table className="table">
              <thead><tr>
                <th>{t('internalProjects.no', 'No.')}</th>
                <th>{t('internalProjects.project', 'Project')}</th>
                <th>{t('internalProjects.owner', 'Owner')}</th>
                <th>{t('internalProjects.members', 'Members')}</th>
                <th>{t('internalProjects.progress', 'Progress')}</th>
                <th>{t('internalProjects.status', 'Status')}</th>
                <th>{t('internalProjects.updatedAt', 'Updated')}</th>
                <th></th>
              </tr></thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState message={t('internalProjects.empty', 'Create the first internal project to start monitoring internal initiatives.')} /></td></tr>
                ) : projects.map((project, index) => (
                  <tr key={project.id}>
                    <td className="text-gray-400">{rowNumber(page, index)}</td>
                    <td className="max-w-sm">
                      <Link to={`/internal-project/projects/${project.id}`} className="font-medium text-blue-600 hover:underline">{project.name}</Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{project.description || t('internalProjects.noDescription', 'No description')}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{initials(project.owner?.name)}</div>
                        <div><p className="text-sm font-medium text-gray-700">{project.owner?.name || '-'}</p><p className="text-[11px] text-gray-400">{project.owner?.email || ''}</p></div>
                      </div>
                    </td>
                    <td>
                      <button className="flex items-center gap-2 text-gray-600 hover:text-primary" onClick={() => loadMembers(project)}>
                        <div className="flex -space-x-2">
                          {(project.members || []).slice(0, 3).map(member => (
                            <div key={member.id} title={member.user?.name} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[9px] font-semibold text-slate-600">{initials(member.user?.name)}</div>
                          ))}
                        </div>
                        <span className="text-xs">{project.members?.length || 0}</span>
                      </button>
                    </td>
                    <td><div className="flex min-w-28 items-center gap-2"><ProgressBar value={project.progress || 0} className="w-20" /><span className="text-xs text-gray-500">{project.progress || 0}%</span></div></td>
                    <td><span className={`badge ${project.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{project.status === 'active' ? t('internalProjects.statusActive', 'Active') : t('internalProjects.statusArchived', 'Archived')}</span></td>
                    <td className="whitespace-nowrap text-xs text-gray-400">{new Date(project.updated_at).toLocaleDateString(locale)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="btn btn-secondary btn-sm" onClick={() => loadMembers(project)}><Users size={13} />{t('internalProjects.team', 'Team')}</button>
                        {canManage(project) && <button className="btn btn-secondary btn-sm" onClick={() => openEdit(project)}>{t('internalProjects.edit', 'Edit')}</button>}
                        {isAdmin && <button className="btn btn-danger btn-sm px-2.5" title={t('internalProjects.delete', 'Delete')} onClick={() => setDeleteItem(project)}>×</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={DEFAULT_PAGE_LIMIT} onChange={setPage} />
          </>
        )}
      </div>

      {myTasks.length > 0 && (
        <div className="card mt-5">
          <div className="card-header cursor-pointer" onClick={() => setMyTasksCollapsed(!myTasksCollapsed)}>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500" />
              <p className="section-title">My Tasks ({myTasks.length})</p>
            </div>
            {myTasksCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>
          {!myTasksCollapsed && (
            <div className="divide-y divide-gray-100">
              {myTasks.map(task => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date()
                const priorityColors: Record<string, string> = {
                  urgent: 'badge-red',
                  high: 'badge-orange',
                  medium: 'badge-blue',
                  low: 'badge-green'
                }
                return (
                  <Link
                    key={task.id}
                    to={`/internal-project/projects/${task.project_id}`}
                    className="flex items-center justify-between gap-3 p-4 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">{task.title}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-400">{task.project?.name || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverdue && <span className="badge badge-red text-xs">Overdue</span>}
                      {!isOverdue && task.priority && (
                        <span className={`badge ${priorityColors[task.priority] || 'badge-gray'} text-xs`}>
                          {task.priority}
                        </span>
                      )}
                      <ArrowRight size={14} className="text-gray-300" />
                    </div>
                  </Link>
                )
              })}
              <div className="px-4 py-3 text-center">
                <Link
                  to="/internal-project/my-tasks"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {t('internalProjectMyTasks.viewAll', 'View all my tasks')} <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editItem ? t('internalProjects.editTitle', 'Edit internal project') : t('internalProjects.addTitle', 'Add internal project')}
        size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setShowForm(false)}>{t('internalProjects.cancel', 'Cancel')}</button><button className="btn btn-primary" onClick={saveProject} disabled={saving}>{saving ? t('internalProjects.saving', 'Saving...') : t('internalProjects.save', 'Save')}</button></>}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex gap-3"><div className="rounded-xl bg-white p-2 text-primary shadow-sm"><FolderKanban size={18} /></div><div><p className="text-sm font-medium text-gray-700">{t('internalProjects.workspaceTitle', 'Independent internal workspace')}</p><p className="mt-0.5 text-xs leading-5 text-gray-500">{t('internalProjects.workspaceHint', 'This project is not linked to client, contract, invoice, or payment data.')}</p></div></div>
          </div>
          <FormField label={t('internalProjects.name', 'Project name')} required><input autoFocus className="input" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder={t('internalProjects.namePlaceholder', 'Example: NEXONE Product Development')} /></FormField>
          <FormField label={t('internalProjects.description', 'Description')}><textarea className="input min-h-28 resize-y" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder={t('internalProjects.descriptionPlaceholder', 'Describe the objective and scope of this internal project...')} /></FormField>
          {editItem && <FormField label={t('internalProjects.status', 'Status')}><select className="input" value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value }))}><option value="active">{t('internalProjects.statusActive', 'Active')}</option><option value="archived">{t('internalProjects.statusArchived', 'Archived')}</option></select></FormField>}
        </div>
      </Modal>

      <Modal
        open={!!memberProject}
        onClose={() => setMemberProject(null)}
        title={`${t('internalProjects.manageTeam', 'Manage team')} - ${memberProject?.name || ''}`}
        size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setMemberProject(null)}>{t('internalProjects.close', 'Close')}</button>}
      >
        {memberProject && canManage(memberProject) && <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-slate-50 p-3 sm:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 text-gray-400" size={15} /><select className="input pl-9" value={selectedUserId} onChange={event => setSelectedUserId(event.target.value)}><option value="">{t('internalProjects.selectMember', 'Select a registered NEXONE user...')}</option>{availableUsers.map(user => <option key={user.id} value={user.id}>{user.name} - {user.email}</option>)}</select></div>
          <button className="btn btn-primary" disabled={!selectedUserId || memberSaving} onClick={addMember}><Plus size={14} />{t('internalProjects.addMember', 'Add member')}</button>
        </div>}
        {membersLoading ? <Loading /> : <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {memberList.map(member => <div key={member.id} className="flex items-center gap-3 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(member.user?.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-700">{member.user?.name}</p><p className="truncate text-xs text-gray-400">{member.user?.email}</p></div><span className={`badge ${member.role === 'owner' ? 'badge-blue' : 'badge-gray'}`}>{member.role === 'owner' ? t('internalProjects.roleOwner', 'Owner') : t('internalProjects.roleMember', 'Member')}</span>{memberProject && canManage(memberProject) && member.role !== 'owner' && <button className="btn btn-secondary btn-sm text-red-600" onClick={() => removeMember(member)}>{t('internalProjects.remove', 'Remove')}</button>}</div>)}
        </div>}
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={removeProject}
        title={t('internalProjects.deleteTitle', 'Delete internal project')}
        message={t('internalProjects.deleteMessage', 'This project and all of its internal tasks will be permanently deleted.')}
      />
    </div>
  )
}
