import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { CalendarDays, ChevronLeft, Clock, GripVertical, LayoutDashboard, List, MessageSquare, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { toast } from 'react-toastify'
import type { RootState } from '@/store'
import { internalProjectService } from '@/services/api'
import { useLocale } from '@/contexts/LocaleContext'
import { toISODate } from '@/utils/format'
import { Avatar, ConfirmDialog, EmptyState, FormField, Loading, Modal, ProgressBar, StatusBadge, SubtaskList, TaskCollaboration, TaskTimer, ViewTabs } from '@/components/common'

type UserSummary = { id: number; name: string; email: string }
type ProjectMember = { id: number; user_id: number; role: 'owner' | 'member'; user?: UserSummary }
type ProjectColumn = { id: number; key: string; label: string; color: string; position: number }
type InternalProject = {
  id: number; name: string; description: string; owner_id: number; owner?: UserSummary
  status: 'active' | 'archived'; progress: number; members: ProjectMember[]; columns: ProjectColumn[]
}
type TaskAssignee = { id: number; user_id: number; user?: UserSummary }
type InternalTask = {
  id: number; title: string; description: string; category: string; priority: string
  due_date?: string | null; column_id: number; status: string; position: number
  creator_id: number; creator?: UserSummary; assignees: TaskAssignee[]
}
type TaskForm = {
  title: string; description: string; category: string; priority: string
  due_date: string; column_id: string; assignee_ids: number[]
}
type TimeLog = {
  id: number; task_id: number; user_id: number; clock_in: string; clock_out: string | null
  duration_seconds: number; user?: UserSummary
}
type Subtask = {
  id: number; task_id: number; title: string; description: string; status: string
  position: number; assignee_id: number | null; assignee?: UserSummary; due_date: string | null
}
type TaskFilters = {
  search: string; assigneeId: string; priority: string; category: string; columnId: string; deadline: string
}

const emptyTaskForm: TaskForm = {
  title: '', description: '', category: '', priority: 'medium', due_date: '', column_id: '', assignee_ids: [],
}
const emptyTaskFilters: TaskFilters = {
  search: '', assigneeId: '', priority: '', category: '', columnId: '', deadline: '',
}

const priorityStyle: Record<string, string> = {
  low: 'badge-green', medium: 'badge-blue', high: 'badge-orange', urgent: 'badge-red',
}

const columnStyle: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-50 text-blue-700', yellow: 'bg-amber-50 text-amber-700',
  purple: 'bg-purple-50 text-purple-700', cyan: 'bg-cyan-50 text-cyan-700', orange: 'bg-orange-50 text-orange-700',
  green: 'bg-emerald-50 text-emerald-700',
}

function isOverdue(task: InternalTask) {
  return !!task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()
}

export default function InternalProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const projectId = Number(id)
  const { locale, t } = useLocale()
  const currentUser = useSelector((state: RootState) => state.auth.user)
  const [project, setProject] = useState<InternalProject | null>(null)
  const [tasks, setTasks] = useState<InternalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('board')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editTask, setEditTask] = useState<InternalTask | null>(null)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm)
  const [saving, setSaving] = useState(false)
  const [deleteTask, setDeleteTask] = useState<InternalTask | null>(null)
  const [taskModalTab, setTaskModalTab] = useState<'details' | 'time' | 'subtasks' | 'collaboration'>('details')
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [activeLog, setActiveLog] = useState<TimeLog | null>(null)
  const [timeLogsLoading, setTimeLogsLoading] = useState(false)
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [subtasksLoading, setSubtasksLoading] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>(emptyTaskFilters)
  const [loadedFilterKey, setLoadedFilterKey] = useState('')

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const [projectResponse, taskResponse] = await Promise.all([
        internalProjectService.get(projectId),
        internalProjectService.listTasks(projectId),
      ])
      setProject(projectResponse.data)
      setTasks(taskResponse.data.data || [])
    } catch {
      setProject(null)
      toast.error(t('internalProjectDetail.loadFailed', 'Failed to load internal project'))
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => { void load() }, [projectId])

  const filterStorageKey = `nexone.internal-project.${projectId}.task-filters.${currentUser?.id || 'guest'}`
  useEffect(() => {
    try {
      const saved = localStorage.getItem(filterStorageKey)
      setFilters(saved ? { ...emptyTaskFilters, ...JSON.parse(saved) } : emptyTaskFilters)
    } catch {
      setFilters(emptyTaskFilters)
    }
    setLoadedFilterKey(filterStorageKey)
  }, [filterStorageKey])
  useEffect(() => {
    if (loadedFilterKey !== filterStorageKey) return
    localStorage.setItem(filterStorageKey, JSON.stringify(filters))
  }, [filterStorageKey, filters, loadedFilterKey])

  const columns = useMemo(
    () => [...(project?.columns || [])].sort((a, b) => a.position - b.position),
    [project?.columns]
  )
  const categories = useMemo(() => [...new Set(tasks.map(task => task.category?.trim()).filter(Boolean))].sort(), [tasks])
  const filteredTasks = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(now.getDate() + 7)
    return tasks.filter(task => {
      const matchesSearch = !search || [task.title, task.description, task.category, ...task.assignees.map(assignee => assignee.user?.name || '')]
        .some(value => value?.toLowerCase().includes(search))
      const matchesAssignee = !filters.assigneeId || task.assignees.some(assignee => assignee.user_id === Number(filters.assigneeId))
      const matchesPriority = !filters.priority || task.priority === filters.priority
      const matchesCategory = !filters.category || task.category === filters.category
      const matchesColumn = !filters.columnId || task.column_id === Number(filters.columnId)
      let matchesDeadline = true
      if (filters.deadline === 'overdue') matchesDeadline = isOverdue(task)
      if (filters.deadline === 'due_7_days') matchesDeadline = !!task.due_date && task.status !== 'done' && new Date(task.due_date) >= now && new Date(task.due_date) <= sevenDaysFromNow
      if (filters.deadline === 'no_deadline') matchesDeadline = !task.due_date
      return matchesSearch && matchesAssignee && matchesPriority && matchesCategory && matchesColumn && matchesDeadline
    })
  }, [filters, tasks])
  const tasksByColumn = useMemo(() => columns.reduce<Record<number, InternalTask[]>>((result, column) => {
    result[column.id] = filteredTasks.filter(task => task.column_id === column.id).sort((a, b) => a.position - b.position)
    return result
  }, {}), [columns, filteredTasks])
  const hasActiveFilters = Object.values(filters).some(Boolean)
  const visibleColumns = filters.columnId ? columns.filter(column => column.id === Number(filters.columnId)) : columns
  const doneTasks = useMemo(() => tasks.filter(task => task.status === 'done').length, [tasks])
  const overdueTasks = useMemo(() => tasks.filter(isOverdue).length, [tasks])
  const canManageProject = currentUser?.role === 'admin' || project?.owner_id === currentUser?.id

  const openAddTask = (column?: ProjectColumn) => {
    setEditTask(null)
    setTaskForm({ ...emptyTaskForm, column_id: String(column?.id || columns[0]?.id || '') })
    setShowTaskModal(true)
  }

  const openEditTask = (task: InternalTask) => {
    setEditTask(task)
    setTaskForm({
      title: task.title,
      description: task.description || '',
      category: task.category || '',
      priority: task.priority || 'medium',
      due_date: task.due_date?.slice(0, 10) || '',
      column_id: String(task.column_id),
      assignee_ids: (task.assignees || []).map(assignee => assignee.user_id),
    })
    setTaskModalTab('details')
    setShowTaskModal(true)
    void loadTimeLogs(task.id)
    void loadSubtasks(task.id)
  }

  useEffect(() => {
    const taskID = Number(searchParams.get('task'))
    if (!taskID || tasks.length === 0 || showTaskModal) return
    const task = tasks.find(item => item.id === taskID)
    if (!task) return
    openEditTask(task)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, showTaskModal, tasks])

  const loadTimeLogs = async (taskId: number) => {
    setTimeLogsLoading(true)
    try {
      const response = await internalProjectService.getTimeLogs(taskId)
      setTimeLogs(response.data.data || [])
      setActiveLog(response.data.active_log || null)
    } catch {
      setTimeLogs([])
      setActiveLog(null)
    } finally {
      setTimeLogsLoading(false)
    }
  }

  const handleClockIn = async () => {
    if (!editTask) return
    await internalProjectService.clockIn(editTask.id)
  }

  const handleClockOut = async () => {
    if (!editTask) return
    await internalProjectService.clockOut(editTask.id)
  }

  const refreshTimeLogs = async () => {
    if (!editTask) return
    await loadTimeLogs(editTask.id)
  }

  const loadSubtasks = async (taskId: number) => {
    setSubtasksLoading(true)
    try {
      const response = await internalProjectService.listSubtasks(taskId)
      setSubtasks(response.data.data || [])
    } catch {
      setSubtasks([])
    } finally {
      setSubtasksLoading(false)
    }
  }

  const handleAddSubtask = async (title: string) => {
    if (!editTask) return
    await internalProjectService.createSubtask(editTask.id, { title })
  }

  const handleToggleSubtask = async (subtaskId: number) => {
    if (!editTask) return
    await internalProjectService.toggleSubtask(editTask.id, subtaskId)
  }

  const handleDeleteSubtask = async (subtaskId: number) => {
    if (!editTask) return
    await internalProjectService.deleteSubtask(editTask.id, subtaskId)
  }

  const refreshSubtasks = async () => {
    if (!editTask) return
    await loadSubtasks(editTask.id)
  }

  const saveTask = async () => {
    if (taskForm.title.trim().length < 2 || !taskForm.column_id) {
      toast.error(t('internalProjectDetail.taskRequired', 'Task title and column are required'))
      return
    }
    setSaving(true)
    const payload = {
      ...taskForm,
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      category: taskForm.category.trim(),
      column_id: Number(taskForm.column_id),
      due_date: taskForm.due_date ? toISODate(taskForm.due_date) : null,
    }
    try {
      if (editTask) {
        await internalProjectService.updateTask(projectId, editTask.id, payload)
        toast.success(t('internalProjectDetail.taskUpdated', 'Task updated'))
      } else {
        await internalProjectService.createTask(projectId, payload)
        toast.success(t('internalProjectDetail.taskCreated', 'Task created'))
      }
      setShowTaskModal(false)
      await load(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('internalProjectDetail.taskSaveFailed', 'Failed to save task'))
    } finally {
      setSaving(false)
    }
  }

  const removeTask = async () => {
    if (!deleteTask) return
    try {
      await internalProjectService.deleteTask(projectId, deleteTask.id)
      toast.success(t('internalProjectDetail.taskDeleted', 'Task deleted'))
      setDeleteTask(null)
      await load(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('internalProjectDetail.taskDeleteFailed', 'Failed to delete task'))
    }
  }

  const onDragEnd = async (result: DropResult) => {
    if (hasActiveFilters) return
    if (!result.destination) return
    if (result.source.droppableId === result.destination.droppableId && result.source.index === result.destination.index) return
    const taskId = Number(result.draggableId)
    const destinationColumnId = Number(result.destination.droppableId)
    const previousTasks = tasks
    const movedTask = tasks.find(task => task.id === taskId)
    if (!movedTask) return

    const sourceTasks = tasksByColumn[movedTask.column_id].filter(task => task.id !== taskId)
    const destinationTasks = movedTask.column_id === destinationColumnId
      ? sourceTasks
      : tasksByColumn[destinationColumnId].filter(task => task.id !== taskId)
    destinationTasks.splice(result.destination.index, 0, { ...movedTask, column_id: destinationColumnId })
    const changedIds = new Set(destinationTasks.map(task => task.id))
    const optimistic = tasks.map(task => {
      const index = destinationTasks.findIndex(item => item.id === task.id)
      if (index >= 0) return { ...task, column_id: destinationColumnId, position: index + 1, status: columns.find(column => column.id === destinationColumnId)?.key || task.status }
      if (task.column_id === movedTask.column_id && !changedIds.has(task.id)) {
        const sourceIndex = sourceTasks.findIndex(item => item.id === task.id)
        return { ...task, position: sourceIndex + 1 }
      }
      return task
    })
    setTasks(optimistic)
    try {
      await internalProjectService.moveTask(projectId, taskId, { column_id: destinationColumnId, position: result.destination.index })
      await load(false)
    } catch (error: any) {
      setTasks(previousTasks)
      toast.error(error.response?.data?.error || t('internalProjectDetail.moveFailed', 'Failed to move task'))
    }
  }

  if (loading) return <div className="p-5"><Loading /></div>
  if (!project) return <div className="p-5"><EmptyState message={t('internalProjectDetail.notFound', 'Internal project not found.')} /></div>

  const views = [
    { key: 'board', label: t('internalProjectDetail.board', 'Kanban') },
    { key: 'list', label: t('internalProjectDetail.list', 'Task list') },
  ]

  return (
    <div className="p-5">
      <Link to="/internal-project/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
        <ChevronLeft size={16} />{t('internalProjectDetail.back', 'Internal Projects')}
      </Link>

      <div className="card mb-5 overflow-hidden">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">{project.name}</h1>
              <span className={`badge ${project.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{project.status === 'active' ? t('internalProjects.statusActive', 'Active') : t('internalProjects.statusArchived', 'Archived')}</span>
            </div>
            <p className="text-sm leading-6 text-gray-500">{project.description || t('internalProjects.noDescription', 'No description')}</p>
          </div>
          <button className="btn btn-primary" onClick={() => openAddTask()}><Plus size={15} />{t('internalProjectDetail.addTask', 'Add task')}</button>
        </div>
        <div className="grid border-t border-gray-100 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-b border-gray-100 p-4 sm:border-r lg:border-b-0"><p className="text-xs text-gray-400">{t('internalProjectDetail.owner', 'Owner')}</p><div className="mt-2 flex items-center gap-2"><Avatar name={project.owner?.name || '?'} /><div><p className="text-sm font-medium text-gray-700">{project.owner?.name}</p><p className="text-[11px] text-gray-400">{project.owner?.email}</p></div></div></div>
          <div className="border-b border-gray-100 p-4 lg:border-b-0 lg:border-r"><p className="text-xs text-gray-400">{t('internalProjectDetail.progress', 'Progress')}</p><div className="mt-3 flex items-center gap-2"><ProgressBar value={project.progress || 0} className="w-28" /><span className="text-sm font-semibold text-gray-700">{project.progress || 0}%</span></div></div>
          <div className="border-b border-gray-100 p-4 sm:border-r lg:border-b-0"><p className="text-xs text-gray-400">{t('internalProjectDetail.team', 'Project team')}</p><div className="mt-2 flex items-center gap-2"><div className="flex -space-x-2">{project.members.slice(0, 5).map(member => <div key={member.id} className="rounded-full border-2 border-white"><Avatar name={member.user?.name || '?'} /></div>)}</div><span className="text-sm font-medium text-gray-600">{project.members.length}</span></div></div>
          <div className="p-4"><p className="text-xs text-gray-400">{t('internalProjectDetail.taskHealth', 'Task health')}</p><p className="mt-2 text-sm font-medium text-gray-700">{doneTasks}/{tasks.length} {t('internalProjectDetail.completed', 'completed')} · <span className={overdueTasks ? 'text-red-500' : 'text-gray-500'}>{overdueTasks} {t('internalProjectDetail.overdue', 'overdue')}</span></p></div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ViewTabs tabs={views} active={view} onChange={setView} />
        <div className="flex items-center gap-4 text-xs text-gray-400"><span className="inline-flex items-center gap-1"><LayoutDashboard size={13} />{columns.length} {t('internalProjectDetail.columns', 'columns')}</span><span className="inline-flex items-center gap-1"><List size={13} />{tasks.length} {t('internalProjectDetail.tasks', 'tasks')}</span><span className="inline-flex items-center gap-1"><Users size={13} />{project.members.length} {t('internalProjectDetail.members', 'members')}</span></div>
      </div>

      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder={t('internalProjectDetail.searchTasks', 'Search title, description, category, or assignee...')} />
          </div>
          <select className="input" value={filters.assigneeId} onChange={event => setFilters(current => ({ ...current, assigneeId: event.target.value }))}><option value="">{t('internalProjectDetail.allAssignees', 'All assignees')}</option>{project.members.map(member => <option key={member.user_id} value={member.user_id}>{member.user?.name || member.user_id}</option>)}</select>
          <select className="input" value={filters.priority} onChange={event => setFilters(current => ({ ...current, priority: event.target.value }))}><option value="">{t('internalProjectDetail.allPriorities', 'All priorities')}</option>{['low', 'medium', 'high', 'urgent'].map(priority => <option key={priority} value={priority}>{t(`internalProjectDetail.priority.${priority}`, priority)}</option>)}</select>
          <select className="input" value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}><option value="">{t('internalProjectDetail.allCategories', 'All categories')}</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select>
          <select className="input" value={filters.columnId} onChange={event => setFilters(current => ({ ...current, columnId: event.target.value }))}><option value="">{t('internalProjectDetail.allColumns', 'All columns')}</option>{columns.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</select>
          <select className="input" value={filters.deadline} onChange={event => setFilters(current => ({ ...current, deadline: event.target.value }))}><option value="">{t('internalProjectDetail.allDeadlines', 'All deadlines')}</option><option value="overdue">{t('internalProjectDetail.onlyOverdue', 'Overdue only')}</option><option value="due_7_days">{t('internalProjectDetail.dueSevenDays', 'Due in 7 days')}</option><option value="no_deadline">{t('internalProjectDetail.noDeadlineFilter', 'No deadline')}</option></select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-gray-400">{t('internalProjectDetail.showingTasks', 'Showing')} <strong className="text-gray-600">{filteredTasks.length}</strong> {t('internalProjectDetail.ofTasks', 'of')} {tasks.length} {t('internalProjectDetail.tasks', 'tasks')}</span>
          {hasActiveFilters && <div className="flex items-center gap-3"><span className="text-amber-600">{t('internalProjectDetail.dragDisabledFiltered', 'Drag and drop is disabled while filters are active.')}</span><button className="inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={() => setFilters(emptyTaskFilters)}><X size={13} />{t('internalProjectDetail.clearFilters', 'Clear filters')}</button></div>}
        </div>
      </div>

      {view === 'board' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-5">
            {visibleColumns.map(column => (
              <div key={column.id} className="w-72 flex-shrink-0">
                <div className={`flex items-center justify-between rounded-t-2xl px-4 py-3 ${columnStyle[column.color] || columnStyle.slate}`}>
                  <div><p className="text-sm font-semibold">{column.label}</p><p className="mt-0.5 text-[11px] opacity-70">{tasksByColumn[column.id]?.length || 0} {t('internalProjectDetail.cards', 'cards')}</p></div>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 transition hover:bg-white" onClick={() => openAddTask(column)} aria-label={`${t('internalProjectDetail.addTask', 'Add task')} ${column.label}`}><Plus size={14} /></button>
                </div>
                <Droppable droppableId={String(column.id)}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-[420px] rounded-b-2xl border border-t-0 border-gray-200 p-3 transition ${snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-white'}`}>
                      <div className="space-y-3">
                        {(tasksByColumn[column.id] || []).map((task, index) => (
                          <Draggable key={task.id} draggableId={String(task.id)} index={index} isDragDisabled={hasActiveFilters}>
                            {(dragProvided, dragSnapshot) => (
                              <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} style={dragProvided.draggableProps.style} onClick={() => openEditTask(task)} className={`kanban-card mb-0 select-none ${dragSnapshot.isDragging ? 'ring-1 ring-primary shadow-lg' : ''}`}>
                                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-medium text-gray-800">{task.title}</p>{task.category && <span className="mt-1 inline-block text-[11px] text-gray-400">{task.category}</span>}</div><button {...dragProvided.dragHandleProps} onClick={event => event.stopPropagation()} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100" aria-label={`Drag ${task.title}`}><GripVertical size={14} /></button></div>
                                {task.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{task.description}</p>}
                                <div className="mt-3 flex items-center justify-between"><span className={`badge ${priorityStyle[task.priority] || 'badge-gray'}`}>{t(`internalProjectDetail.priority.${task.priority}`, task.priority)}</span><div className="flex -space-x-1">{task.assignees.slice(0, 3).map(assignee => <div key={assignee.id} className="rounded-full border border-white"><Avatar name={assignee.user?.name || '?'} /></div>)}</div></div>
                                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2"><span className={`inline-flex items-center gap-1 text-[11px] ${isOverdue(task) ? 'text-red-500' : 'text-gray-400'}`}><CalendarDays size={12} />{task.due_date ? new Date(task.due_date).toLocaleDateString(locale) : t('internalProjectDetail.noDeadline', 'No deadline')}</span>{(canManageProject || task.creator_id === currentUser?.id) && <button onClick={event => { event.stopPropagation(); setDeleteTask(task) }} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>}</div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {(tasksByColumn[column.id] || []).length === 0 && <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-xs text-gray-400">{hasActiveFilters ? t('internalProjectDetail.noFilteredTasks', 'No tasks match the selected filters.') : t('internalProjectDetail.emptyColumn', 'Drop a task here or add a new card.')}</div>}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {view === 'list' && <div className="table-container"><table className="table"><thead><tr><th>{t('internalProjectDetail.task', 'Task')}</th><th>{t('internalProjectDetail.category', 'Category')}</th><th>{t('internalProjectDetail.assignees', 'Assignees')}</th><th>{t('internalProjectDetail.priority', 'Priority')}</th><th>{t('internalProjectDetail.deadline', 'Deadline')}</th><th>{t('internalProjectDetail.column', 'Column')}</th></tr></thead><tbody>{filteredTasks.length === 0 ? <tr><td colSpan={6}><EmptyState message={tasks.length === 0 ? t('internalProjectDetail.emptyTasks', 'No internal tasks yet.') : t('internalProjectDetail.noFilteredTasks', 'No tasks match the selected filters.')} /></td></tr> : filteredTasks.map(task => <tr key={task.id} className="cursor-pointer" onClick={() => openEditTask(task)}><td><p className="font-medium text-gray-800">{task.title}</p><p className="line-clamp-1 max-w-sm text-xs text-gray-400">{task.description}</p></td><td className="text-gray-500">{task.category || '-'}</td><td><div className="flex items-center gap-1">{task.assignees.map(assignee => <Avatar key={assignee.id} name={assignee.user?.name || '?'} />)}{task.assignees.length === 0 && <span className="text-gray-300">-</span>}</div></td><td><span className={`badge ${priorityStyle[task.priority] || 'badge-gray'}`}>{t(`internalProjectDetail.priority.${task.priority}`, task.priority)}</span></td><td className={isOverdue(task) ? 'text-red-500' : 'text-gray-400'}>{task.due_date ? new Date(task.due_date).toLocaleDateString(locale) : '-'}</td><td><StatusBadge status={task.status} /></td></tr>)}</tbody></table></div>}

      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title={editTask ? t('internalProjectDetail.editTask', 'Edit task') : t('internalProjectDetail.addTask', 'Add task')} size="xl" footer={taskModalTab === 'details' ? <><button className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>{t('internalProjects.cancel', 'Cancel')}</button><button className="btn btn-primary" disabled={saving} onClick={saveTask}>{saving ? t('internalProjects.saving', 'Saving...') : t('internalProjects.save', 'Save')}</button></> : <button className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>{t('common.close', 'Close')}</button>}>
        {editTask && (
          <div className="mb-4 flex gap-2 border-b border-gray-100">
            <button className={`pb-2 px-3 text-sm font-medium transition ${taskModalTab === 'details' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setTaskModalTab('details')}>Details</button>
            <button className={`pb-2 px-3 text-sm font-medium transition flex items-center gap-1.5 ${taskModalTab === 'subtasks' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setTaskModalTab('subtasks')}>Subtasks {subtasks.length > 0 && <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{subtasks.length}</span>}</button>
            <button className={`pb-2 px-3 text-sm font-medium transition flex items-center gap-1.5 ${taskModalTab === 'time' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setTaskModalTab('time')}><Clock size={14} />Time Tracking</button>
            <button className={`pb-2 px-3 text-sm font-medium transition flex items-center gap-1.5 ${taskModalTab === 'collaboration' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setTaskModalTab('collaboration')}><MessageSquare size={14} />Collaboration</button>
          </div>
        )}

        {taskModalTab === 'details' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><FormField label={t('internalProjectDetail.taskTitle', 'Task title')} required><input autoFocus className="input" value={taskForm.title} onChange={event => setTaskForm(current => ({ ...current, title: event.target.value }))} placeholder={t('internalProjectDetail.taskPlaceholder', 'What needs to be completed?')} /></FormField></div>
            <FormField label={t('internalProjectDetail.column', 'Column')} required><select className="input" value={taskForm.column_id} onChange={event => setTaskForm(current => ({ ...current, column_id: event.target.value }))}>{columns.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</select></FormField>
            <FormField label={t('internalProjectDetail.priority', 'Priority')}><select className="input" value={taskForm.priority} onChange={event => setTaskForm(current => ({ ...current, priority: event.target.value }))}><option value="low">{t('internalProjectDetail.priority.low', 'Low')}</option><option value="medium">{t('internalProjectDetail.priority.medium', 'Medium')}</option><option value="high">{t('internalProjectDetail.priority.high', 'High')}</option><option value="urgent">{t('internalProjectDetail.priority.urgent', 'Urgent')}</option></select></FormField>
            <FormField label={t('internalProjectDetail.category', 'Category')}><input className="input" value={taskForm.category} onChange={event => setTaskForm(current => ({ ...current, category: event.target.value }))} placeholder={t('internalProjectDetail.categoryPlaceholder', 'Development, HR, Operations...')} /></FormField>
            <FormField label={t('internalProjectDetail.deadline', 'Deadline')}><input type="date" className="input" value={taskForm.due_date} onChange={event => setTaskForm(current => ({ ...current, due_date: event.target.value }))} /></FormField>
            <div className="sm:col-span-2"><FormField label={t('internalProjectDetail.description', 'Description')}><textarea className="input min-h-24 resize-y" value={taskForm.description} onChange={event => setTaskForm(current => ({ ...current, description: event.target.value }))} /></FormField></div>
            <div className="sm:col-span-2"><FormField label={t('internalProjectDetail.assignees', 'Assignees')}><div className="grid gap-2 rounded-2xl border border-gray-200 bg-slate-50 p-3 sm:grid-cols-2">{project.members.map(member => { const checked = taskForm.assignee_ids.includes(member.user_id); return <label key={member.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked ? 'border-primary bg-white shadow-sm' : 'border-transparent hover:bg-white'}`}><input type="checkbox" checked={checked} onChange={() => setTaskForm(current => ({ ...current, assignee_ids: checked ? current.assignee_ids.filter(id => id !== member.user_id) : [...current.assignee_ids, member.user_id] }))} /><Avatar name={member.user?.name || '?'} /><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-700">{member.user?.name}</p><p className="truncate text-xs text-gray-400">{member.user?.email}</p></div></label> })}</div></FormField></div>
          </div>
        )}

        {taskModalTab === 'subtasks' && editTask && (
          <SubtaskList
            subtasks={subtasks}
            onToggle={handleToggleSubtask}
            onAdd={handleAddSubtask}
            onDelete={handleDeleteSubtask}
            onRefresh={refreshSubtasks}
            loading={subtasksLoading}
          />
        )}

        {taskModalTab === 'time' && editTask && (
          <div className="space-y-4">
            <TaskTimer taskId={editTask.id} activeLog={activeLog} onClockIn={handleClockIn} onClockOut={handleClockOut} onRefresh={refreshTimeLogs} />

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Time Log History</h3>
              {timeLogsLoading ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : timeLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No time logs yet</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {timeLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">{log.user?.name || `User #${log.user_id}`}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(log.clock_in).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {log.clock_out && ` - ${new Date(log.clock_out).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <div className="text-sm font-mono font-semibold text-gray-600">
                        {log.clock_out ? `${Math.floor(log.duration_seconds / 3600)}h ${Math.floor((log.duration_seconds % 3600) / 60)}m` : 'Active'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {taskModalTab === 'collaboration' && editTask && project && (
          <TaskCollaboration
            taskId={editTask.id}
            members={project.members}
            currentUserId={currentUser?.id}
            canManageProject={canManageProject}
            locale={locale}
          />
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTask} onClose={() => setDeleteTask(null)} onConfirm={removeTask} title={t('internalProjectDetail.deleteTask', 'Delete task')} message={t('internalProjectDetail.deleteTaskMessage', 'This internal task will be permanently deleted.')} />
    </div>
  )
}
