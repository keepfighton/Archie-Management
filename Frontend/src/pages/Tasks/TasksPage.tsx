import { useEffect, useMemo, useState } from 'react'
import { taskService, projectService, teamService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { ManageLabelsModal } from '@/components/common/ManageLabelsModal'
import { toast } from 'react-toastify'
import { Plus, Filter, FileDown, GripVertical, Pencil, Trash2, Check, X } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  PageHeader, SearchInput, Pagination,
  StatusBadge, Modal, FormField, ConfirmDialog, Loading, EmptyState, ViewTabs, Avatar,
} from '@/components/common'

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'expired'

interface ProjectOption {
  id: number
  title: string
}

interface MemberOption {
  id: number
  name: string
}

interface KanbanColumn {
  id: number
  title: string
  status: TaskStatus | string
  position: number
}

interface TaskItem {
  id: number
  title: string
  project_id?: number | null
  project?: ProjectOption | null
  assigned_to_id?: number | null
  assigned_to?: MemberOption | null
  kanban_column_id?: number | null
  kanban_column?: KanbanColumn | null
  kanban_position?: number
  status: TaskStatus | string
  priority: string
  start_date?: string
  deadline?: string
  description?: string
}

interface TaskFormState {
  title: string
  project_id: string
  assigned_to_id: string
  kanban_column_id: string
  status: TaskStatus
  priority: string
  start_date: string
  deadline: string
  description: string
}

type TaskBoardState = Record<string, TaskItem[]>

const VIEWS = [
  { key: 'list', label: 'List' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'gantt', label: 'Gantt' },
]

const TASK_STATUSES: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'done', label: 'Done', color: 'bg-green-50' },
  { id: 'expired', label: 'Expired', color: 'bg-red-50' },
]

const LIST_LIMIT = 10

const priorityColor: Record<string, string> = {
  high: 'text-red-500',
  medium: 'text-yellow-500',
  low: 'text-green-500',
}

function isTaskStatus(status: string): status is TaskStatus {
  return TASK_STATUSES.some(col => col.id === status)
}

function getStatusMeta(status: string) {
  return TASK_STATUSES.find(col => col.id === status) || TASK_STATUSES[0]
}

function createEmptyBoard(columns: KanbanColumn[]): TaskBoardState {
  return columns.reduce((acc, column) => {
    acc[String(column.id)] = []
    return acc
  }, {} as TaskBoardState)
}

function createEmptyForm(status: TaskStatus = 'todo', kanbanColumnId?: number): TaskFormState {
  return {
    title: '',
    project_id: '',
    assigned_to_id: '',
    kanban_column_id: kanbanColumnId ? String(kanbanColumnId) : '',
    status,
    priority: 'medium',
    start_date: '',
    deadline: '',
    description: '',
  }
}

function groupTasksByColumn(items: TaskItem[], columns: KanbanColumn[]): TaskBoardState {
  const grouped = createEmptyBoard(columns)
  const defaultColumnByStatus = columns.reduce((acc, column) => {
    if (isTaskStatus(column.status) && !acc[column.status]) {
      acc[column.status] = column.id
    }
    return acc
  }, {} as Partial<Record<TaskStatus, number>>)

  items.forEach(task => {
    const status = isTaskStatus(task.status) ? task.status : 'todo'
    const columnId = task.kanban_column_id
      || task.kanban_column?.id
      || defaultColumnByStatus[status]

    if (!columnId || !grouped[String(columnId)]) return

    grouped[String(columnId)].push({
      ...task,
      status,
      kanban_column_id: columnId,
    })
  })

  Object.keys(grouped).forEach(columnId => {
    grouped[columnId] = [...grouped[columnId]].sort((a, b) => {
      const positionDiff = (a.kanban_position || 0) - (b.kanban_position || 0)
      if (positionDiff !== 0) return positionDiff
      return a.id - b.id
    })
  })

  return grouped
}

function mapTaskToForm(task: TaskItem | null | undefined, defaultColumnByStatus: Partial<Record<TaskStatus, number>>) {
  if (!task) return createEmptyForm('todo', defaultColumnByStatus.todo)

  const status = isTaskStatus(task.status) ? task.status : 'todo'
  const kanbanColumnId = task.kanban_column_id
    || task.kanban_column?.id
    || defaultColumnByStatus[status]

  return {
    title: task.title || '',
    project_id: task.project_id ? String(task.project_id) : task.project?.id ? String(task.project.id) : '',
    assigned_to_id: task.assigned_to_id ? String(task.assigned_to_id) : task.assigned_to?.id ? String(task.assigned_to.id) : '',
    kanban_column_id: kanbanColumnId ? String(kanbanColumnId) : '',
    status,
    priority: task.priority || 'medium',
    start_date: task.start_date?.split('T')[0] || '',
    deadline: task.deadline?.split('T')[0] || '',
    description: task.description || '',
  }
}

function buildTaskPayload(form: TaskFormState) {
  return {
    ...form,
    project_id: form.project_id ? Number(form.project_id) : null,
    assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : null,
    kanban_column_id: form.kanban_column_id ? Number(form.kanban_column_id) : null,
    start_date: toISODate(form.start_date),
    deadline: toISODate(form.deadline),
  }
}

function formatTaskDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id')
}

function isTaskOverdue(task: TaskItem) {
  if (!task.deadline || task.status === 'done') return false
  const deadline = new Date(task.deadline)
  return !Number.isNaN(deadline.getTime()) && deadline < new Date()
}

function reorderBoard(board: TaskBoardState, result: DropResult): TaskBoardState {
  if (!result.destination) return board

  const sourceColumnId = result.source.droppableId
  const destinationColumnId = result.destination.droppableId

  const nextBoard = Object.keys(board).reduce((acc, key) => {
    acc[key] = [...board[key]]
    return acc
  }, {} as TaskBoardState)

  const sourceItems = [...(nextBoard[sourceColumnId] || [])]
  const [movedTask] = sourceItems.splice(result.source.index, 1)

  if (!movedTask) return board

  if (sourceColumnId === destinationColumnId) {
    sourceItems.splice(result.destination.index, 0, movedTask)
    nextBoard[sourceColumnId] = sourceItems
    return nextBoard
  }

  const destinationItems = [...(nextBoard[destinationColumnId] || [])]
  destinationItems.splice(result.destination.index, 0, movedTask)

  nextBoard[sourceColumnId] = sourceItems
  nextBoard[destinationColumnId] = destinationItems

  return nextBoard
}

function reorderColumns(columns: KanbanColumn[], result: DropResult) {
  const nextColumns = [...columns]
  const [movedColumn] = nextColumns.splice(result.source.index, 1)
  if (!movedColumn) return columns
  nextColumns.splice(result.destination?.index ?? result.source.index, 0, movedColumn)
  return nextColumns.map((column, index) => ({ ...column, position: index + 1 }))
}

export default function TasksPage() {
  const [view, setView] = useState('list')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([])
  const [boardTasks, setBoardTasks] = useState<TaskBoardState>({})
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [projectFilter, setProjectFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [boardLoading, setBoardLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showManageLabels, setShowManageLabels] = useState(false)
  const [editTask, setEditTask] = useState<TaskItem | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<TaskFormState>(createEmptyForm())
  const [showAddColumnForm, setShowAddColumnForm] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [newColumnStatus, setNewColumnStatus] = useState<TaskStatus>('todo')
  const [columnSaving, setColumnSaving] = useState(false)
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null)
  const [editingColumnTitle, setEditingColumnTitle] = useState('')
  const [columnToDelete, setColumnToDelete] = useState<KanbanColumn | null>(null)
  const [columnDeleting, setColumnDeleting] = useState(false)
  const [quickAddColumnId, setQuickAddColumnId] = useState<number | null>(null)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)

  const defaultColumnIdByStatus = useMemo(
    () => kanbanColumns.reduce((acc, column) => {
      if (isTaskStatus(column.status) && !acc[column.status]) {
        acc[column.status] = column.id
      }
      return acc
    }, {} as Partial<Record<TaskStatus, number>>),
    [kanbanColumns]
  )

  const allBoardTasks = useMemo(
    () => kanbanColumns.flatMap(column => boardTasks[String(column.id)] || []),
    [boardTasks, kanbanColumns]
  )

  const summaryCounts = useMemo(
    () => TASK_STATUSES.reduce((acc, statusOption) => {
      acc[statusOption.id] = allBoardTasks.filter(task => task.status === statusOption.id).length
      return acc
    }, {} as Record<TaskStatus, number>),
    [allBoardTasks]
  )

  const availableFormColumns = useMemo(
    () => kanbanColumns.filter(column => column.status === form.status),
    [kanbanColumns, form.status]
  )

  const selectedColumnTaskCount = useMemo(
    () => columnToDelete ? (boardTasks[String(columnToDelete.id)] || []).length : 0,
    [boardTasks, columnToDelete]
  )

  const buildQueryParams = (base?: Record<string, string | number | boolean>) => {
    const params: Record<string, string | number | boolean> = { ...(base || {}) }

    if (search.trim()) params.q = search.trim()
    if (statusFilter) params.status = statusFilter
    if (projectFilter) params.project_id = projectFilter
    if (assigneeFilter) params.assigned_to_id = assigneeFilter

    return params
  }

  const loadList = async () => {
    setLoading(true)

    try {
      const params = buildQueryParams({ page, limit: LIST_LIMIT })
      const response = await taskService.list(params)
      setTasks(response.data.data || [])
      setTotal(response.data.total || 0)
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const loadBoard = async () => {
    setBoardLoading(true)

    try {
      const params = buildQueryParams({ fetch_all: true })
      const [taskResponse, columnResponse] = await Promise.all([
        taskService.list(params),
        taskService.listKanbanColumns(),
      ])

      const columns = columnResponse.data.data || []
      setKanbanColumns(columns)
      setBoardTasks(groupTasksByColumn(taskResponse.data.data || [], columns))
    } catch {
      toast.error('Failed to load board')
    } finally {
      setBoardLoading(false)
    }
  }

  const refreshTasks = async () => {
    await Promise.all([loadList(), loadBoard()])
  }

  useEffect(() => {
    void loadList()
  }, [page, search, statusFilter, projectFilter, assigneeFilter])

  useEffect(() => {
    void loadBoard()
  }, [search, statusFilter, projectFilter, assigneeFilter])

  useEffect(() => {
    Promise.all([
      projectService.list({ limit: 100 }),
      teamService.listMembers({ limit: 100 }),
    ])
      .then(([projectRes, memberRes]) => {
        setProjects(projectRes.data.data || [])
        setMembers(memberRes.data.data || [])
      })
      .catch(() => {
        toast.error('Failed to load task dependencies')
      })
  }, [])

  const closeTaskModal = () => {
    setShowModal(false)
    setEditTask(null)
    setForm(createEmptyForm('todo', defaultColumnIdByStatus.todo))
  }

  const openAdd = (column?: KanbanColumn) => {
    const nextStatus = column && isTaskStatus(column.status) ? column.status : 'todo'
    const nextColumnId = column?.id || defaultColumnIdByStatus[nextStatus]
    setEditTask(null)
    setForm(createEmptyForm(nextStatus, nextColumnId))
    setShowModal(true)
  }

  const openEdit = (task: TaskItem) => {
    setEditTask(task)
    setForm(mapTaskToForm(task, defaultColumnIdByStatus))
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!form.kanban_column_id) {
      toast.error('Please choose a kanban column')
      return
    }

    setSaving(true)

    try {
      const payload = buildTaskPayload(form)

      if (editTask) {
        await taskService.update(editTask.id, payload)
        toast.success('Task updated!')
      } else {
        await taskService.create(payload)
        toast.success('Task created!')
      }

      closeTaskModal()
      await refreshTasks()
    } catch {
      toast.error(editTask ? 'Failed to update task' : 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      await taskService.delete(deleteId)
      toast.success('Task deleted')

      if (editTask?.id === deleteId) {
        closeTaskModal()
      }

      await refreshTasks()
    } catch {
      toast.error('Failed to delete task')
    }
  }

  const handleStatusChange = (status: TaskStatus) => {
    setForm(current => {
      const matchingColumn = kanbanColumns.find(column => column.id === Number(current.kanban_column_id) && column.status === status)
      const fallbackColumnId = defaultColumnIdByStatus[status]

      return {
        ...current,
        status,
        kanban_column_id: matchingColumn
          ? String(matchingColumn.id)
          : fallbackColumnId
            ? String(fallbackColumnId)
            : '',
      }
    })
  }

  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) {
      toast.error('Column title is required')
      return
    }

    setColumnSaving(true)

    try {
      await taskService.createKanbanColumn({
        title: newColumnTitle.trim(),
        status: newColumnStatus,
      })

      toast.success('Kanban column added')
      setNewColumnTitle('')
      setNewColumnStatus('todo')
      setShowAddColumnForm(false)
      await loadBoard()
    } catch {
      toast.error('Failed to add kanban column')
    } finally {
      setColumnSaving(false)
    }
  }

  const startEditingColumn = (column: KanbanColumn) => {
    setEditingColumnId(column.id)
    setEditingColumnTitle(column.title)
  }

  const cancelEditingColumn = () => {
    setEditingColumnId(null)
    setEditingColumnTitle('')
  }

  const handleUpdateColumn = async (column: KanbanColumn) => {
    const title = editingColumnTitle.trim()
    if (!title) {
      toast.error('Column title is required')
      return
    }

    setColumnSaving(true)

    try {
      await taskService.updateKanbanColumn(column.id, {
        title,
        status: column.status,
      })

      toast.success('Kanban title updated')
      cancelEditingColumn()
      await loadBoard()
    } catch {
      toast.error('Failed to update kanban title')
    } finally {
      setColumnSaving(false)
    }
  }

  const handleQuickAddCard = async (column: KanbanColumn) => {
    if (!quickAddTitle.trim()) {
      toast.error('Card title is required')
      return
    }

    setQuickAdding(true)

    try {
      await taskService.create({
        title: quickAddTitle.trim(),
        status: column.status,
        kanban_column_id: column.id,
        priority: 'medium',
      })

      toast.success('Card created')
      setQuickAddTitle('')
      setQuickAddColumnId(null)
      await refreshTasks()
    } catch {
      toast.error('Failed to create card')
    } finally {
      setQuickAdding(false)
    }
  }

  const handleDeleteColumn = async () => {
    if (!columnToDelete || selectedColumnTaskCount > 0) return

    setColumnDeleting(true)

    try {
      await taskService.deleteKanbanColumn(columnToDelete.id)
      toast.success('Kanban column deleted')
      setColumnToDelete(null)
      await refreshTasks()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete kanban column')
    } finally {
      setColumnDeleting(false)
    }
  }

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    if (result.type === 'COLUMN') {
      if (result.source.index === result.destination.index) return

      const previousColumns = kanbanColumns
      const nextColumns = reorderColumns(kanbanColumns, result)
      setKanbanColumns(nextColumns)

      try {
        await taskService.reorderKanbanColumns({
          column_ids: nextColumns.map(column => column.id),
        })
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to reorder columns')
        setKanbanColumns(previousColumns)
      }

      return
    }

    if (
      result.source.droppableId === result.destination.droppableId
      && result.source.index === result.destination.index
    ) {
      return
    }

    const taskId = Number(result.draggableId)
    const previousBoard = boardTasks
    const nextBoard = reorderBoard(boardTasks, result)
    const destinationColumn = kanbanColumns.find(column => String(column.id) === result.destination?.droppableId)

    if (!destinationColumn) return

    setBoardTasks(nextBoard)

    try {
      await taskService.moveKanbanTask(taskId, {
        destination_column_id: destinationColumn.id,
        destination_index: result.destination.index,
      })
      await Promise.all([loadList(), loadBoard()])
    } catch {
      toast.error('Failed to move card')
      setBoardTasks(previousBoard)
      void loadList()
    }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Tasks"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowManageLabels(true)}>
              <Filter size={12} />
              Manage labels
            </button>
            <button className="btn btn-primary" onClick={() => openAdd()}>
              <Plus size={12} />
              Add task
            </button>
          </>
        }
      />

      <ViewTabs tabs={VIEWS} active={view} onChange={setView} />

      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="grid flex-1 gap-3 md:grid-cols-3">
            <select
              className="input input-sm h-10"
              value={statusFilter}
              onChange={e => {
                setStatusFilter((e.target.value as TaskStatus) || '')
                setPage(1)
              }}
            >
              <option value="">All status</option>
              {TASK_STATUSES.map(col => (
                <option key={col.id} value={col.id}>{col.label}</option>
              ))}
            </select>

            <select
              className="input input-sm h-10"
              value={projectFilter}
              onChange={e => {
                setProjectFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All projects</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>

            <select
              className="input input-sm h-10"
              value={assigneeFilter}
              onChange={e => {
                setAssigneeFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All assignees</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:ml-auto xl:flex-nowrap">
            <button className="btn btn-secondary">
              <FileDown size={12} />
              Excel
            </button>
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              className="xl:min-w-[240px]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 xl:grid-cols-4">
        {TASK_STATUSES.map(col => {
          const active = statusFilter === col.id
          return (
            <button
              key={col.id}
              onClick={() => {
                setStatusFilter(current => current === col.id ? '' : col.id)
                setPage(1)
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${
                active
                  ? 'border-blue-300 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-600">{col.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-white text-blue-600' : 'bg-slate-100 text-gray-500'}`}>
                  {summaryCounts[col.id] || 0}
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">{summaryCounts[col.id] || 0}</p>
              <p className="mt-1 text-xs text-gray-400">
                {active ? 'Status filter active — click to clear.' : 'Click to filter this status.'}
              </p>
            </button>
          )
        })}
      </div>

      {view === 'list' && (
        <div className="table-container">
          {loading ? <Loading /> : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Project</th>
                    <th>Assigned To</th>
                    <th>Priority</th>
                    <th>Deadline</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0
                    ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState message="No tasks match the current filters." />
                        </td>
                      </tr>
                    )
                    : tasks.map(task => (
                      <tr
                        key={task.id}
                        className="cursor-pointer"
                        onClick={() => openEdit(task)}
                      >
                        <td>
                          <div className="max-w-[280px]">
                            <p className="font-medium text-gray-900">{task.title}</p>
                            {task.description && (
                              <p className="mt-0.5 truncate text-xs text-gray-400">{task.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="text-gray-500">{task.project?.title || '-'}</td>
                        <td>
                          {task.assigned_to
                            ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar name={task.assigned_to.name} />
                                <span className="text-xs text-gray-500">{task.assigned_to.name}</span>
                              </div>
                            )
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td>
                          <span className={`text-xs font-medium capitalize ${priorityColor[task.priority] || ''}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className={`text-sm whitespace-nowrap ${isTaskOverdue(task) ? 'text-red-500' : 'text-gray-400'}`}>
                          {formatTaskDate(task.deadline)}
                        </td>
                        <td><StatusBadge status={isTaskStatus(task.status) ? task.status : 'todo'} /></td>
                        <td>
                          <div className="flex gap-1 justify-end">
                            <button
                              className="btn btn-secondary text-xs py-0.5 px-2"
                              onClick={(event) => {
                                event.stopPropagation()
                                openEdit(task)
                              }}
                            >
                              <Pencil size={10} />
                              Edit
                            </button>
                            <button
                              className="btn btn-danger text-xs py-0.5 px-2"
                              onClick={(event) => {
                                event.stopPropagation()
                                setDeleteId(task.id)
                              }}
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
              <Pagination page={page} total={total} limit={LIST_LIMIT} onChange={setPage} />
            </>
          )}
        </div>
      )}

      {view === 'kanban' && (
        <>
          <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Drag cards to reorder or move across custom columns. Column titles and new cards are saved to the backend instantly.
            </p>
            <button className="btn btn-secondary" onClick={() => setShowAddColumnForm(current => !current)}>
              <Plus size={12} />
              Add column
            </button>
          </div>

          {showAddColumnForm && (
            <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[1fr,180px,auto]">
                <input
                  className="input"
                  value={newColumnTitle}
                  onChange={e => setNewColumnTitle(e.target.value)}
                  placeholder="Kanban column title"
                />
                <select
                  className="input"
                  value={newColumnStatus}
                  onChange={e => setNewColumnStatus(e.target.value as TaskStatus)}
                >
                  {TASK_STATUSES.map(statusOption => (
                    <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button className="btn btn-secondary" onClick={() => setShowAddColumnForm(false)} disabled={columnSaving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleAddColumn} disabled={columnSaving}>
                    {columnSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {boardLoading ? (
            <div className="table-container">
              <Loading />
            </div>
          ) : kanbanColumns.length === 0 ? (
            <div className="table-container">
              <EmptyState message="No kanban columns available yet." />
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="kanban-columns" direction="horizontal" type="COLUMN">
                {(columnDropProvided) => (
                  <div
                    ref={columnDropProvided.innerRef}
                    {...columnDropProvided.droppableProps}
                    className="flex gap-3 overflow-x-auto pb-4"
                  >
                    {kanbanColumns.map((column, columnIndex) => {
                      const columnTasks = boardTasks[String(column.id)] || []
                      const statusMeta = getStatusMeta(column.status)
                      const isEditing = editingColumnId === column.id

                      return (
                        <Draggable key={column.id} draggableId={`column-${column.id}`} index={columnIndex}>
                          {(columnProvided, columnSnapshot) => (
                            <div
                              ref={columnProvided.innerRef}
                              {...columnProvided.draggableProps}
                              style={columnProvided.draggableProps.style}
                              className={`flex w-72 flex-shrink-0 flex-col ${columnSnapshot.isDragging ? 'opacity-95' : ''}`}
                            >
                              <div className={`rounded-t-2xl px-4 py-3 ${statusMeta.color}`}>
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <input
                                      className="input input-sm"
                                      value={editingColumnTitle}
                                      onChange={e => setEditingColumnTitle(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') void handleUpdateColumn(column)
                                        if (e.key === 'Escape') cancelEditingColumn()
                                      }}
                                      placeholder="Column title"
                                      autoFocus
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <StatusBadge status={statusMeta.id} />
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-white"
                                          onClick={cancelEditingColumn}
                                          disabled={columnSaving}
                                        >
                                          <X size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-white"
                                          onClick={() => void handleUpdateColumn(column)}
                                          disabled={columnSaving}
                                        >
                                          <Check size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          {...columnProvided.dragHandleProps}
                                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-600 cursor-grab active:cursor-grabbing"
                                          aria-label={`Reorder ${column.title}`}
                                        >
                                          <GripVertical size={14} />
                                        </button>
                                        <span className="truncate text-sm font-semibold text-gray-700">{column.title}</span>
                                        <button
                                          type="button"
                                          onClick={() => startEditingColumn(column)}
                                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-600"
                                          aria-label={`Rename ${column.title}`}
                                        >
                                          <Pencil size={13} />
                                        </button>
                                      </div>
                                      <div className="mt-1">
                                        <StatusBadge status={statusMeta.id} />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500">
                                        {columnTasks.length}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setColumnToDelete(column)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                                        aria-label={`Delete ${column.title}`}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <Droppable droppableId={String(column.id)} type="TASK">
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`min-h-[320px] rounded-b-2xl border border-t-0 border-gray-200 p-3 transition-colors ${
                                      snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-white'
                                    }`}
                                  >
                                    <div className="space-y-3">
                                      {columnTasks.map((task, index) => (
                                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                                          {(prov, snap) => (
                                            <div
                                              ref={prov.innerRef}
                                              {...prov.draggableProps}
                                              style={prov.draggableProps.style}
                                              onClick={() => openEdit(task)}
                                              className={`kanban-card mb-0 select-none ${snap.isDragging ? 'ring-1 ring-blue-400 shadow-md' : ''}`}
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                  <p className="font-medium text-gray-900">{task.title}</p>
                                                  {task.project && (
                                                    <p className="mt-0.5 truncate text-[11px] text-gray-400">{task.project.title}</p>
                                                  )}
                                                </div>

                                                <div className="flex items-center gap-1">
                                                  <button
                                                    type="button"
                                                    {...prov.dragHandleProps}
                                                    onClick={event => event.stopPropagation()}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                                                    aria-label={`Drag ${task.title}`}
                                                  >
                                                    <GripVertical size={14} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(event) => {
                                                      event.stopPropagation()
                                                      setDeleteId(task.id)
                                                    }}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                                                    aria-label={`Delete ${task.title}`}
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                </div>
                                              </div>

                                              {task.description && (
                                                <p className="mt-2 max-h-10 overflow-hidden text-xs text-gray-500">{task.description}</p>
                                              )}

                                              <div className="mt-3 flex items-center justify-between gap-2">
                                                <span className={`text-xs font-medium capitalize ${priorityColor[task.priority] || ''}`}>
                                                  {task.priority}
                                                </span>
                                                {task.assigned_to
                                                  ? <Avatar name={task.assigned_to.name} />
                                                  : <span className="text-[11px] text-gray-300">Unassigned</span>}
                                              </div>

                                              <div className="mt-2 flex items-center justify-between gap-2">
                                                <StatusBadge status={isTaskStatus(task.status) ? task.status : 'todo'} />
                                                <span className={`text-[11px] ${isTaskOverdue(task) ? 'text-red-500' : 'text-gray-400'}`}>
                                                  {task.deadline ? `Due ${formatTaskDate(task.deadline)}` : 'No deadline'}
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}

                                      {columnTasks.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-gray-200 px-3 py-5 text-center text-xs text-gray-400">
                                          No cards in this column yet.
                                        </div>
                                      )}

                                      {provided.placeholder}

                                      {quickAddColumnId === column.id ? (
                                        <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                                          <input
                                            className="input input-sm"
                                            value={quickAddTitle}
                                            onChange={e => setQuickAddTitle(e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') void handleQuickAddCard(column)
                                              if (e.key === 'Escape') {
                                                setQuickAddColumnId(null)
                                                setQuickAddTitle('')
                                              }
                                            }}
                                            placeholder="New card title"
                                            autoFocus
                                          />
                                          <div className="mt-2 flex items-center justify-end gap-2">
                                            <button
                                              className="btn btn-secondary"
                                              onClick={() => {
                                                setQuickAddColumnId(null)
                                                setQuickAddTitle('')
                                              }}
                                              disabled={quickAdding}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="btn btn-primary"
                                              onClick={() => void handleQuickAddCard(column)}
                                              disabled={quickAdding}
                                            >
                                              {quickAdding ? 'Saving...' : 'Add card'}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                                          onClick={() => {
                                            setQuickAddColumnId(column.id)
                                            setQuickAddTitle('')
                                          }}
                                        >
                                          <Plus size={12} />
                                          Add card
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {columnDropProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </>
      )}

      {view === 'gantt' && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
          {boardLoading
            ? <Loading />
            : <GanttView tasks={allBoardTasks} columns={TASK_STATUSES} />}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={closeTaskModal}
        title={editTask ? 'Edit Task' : 'Add Task'}
        size="lg"
        footer={
          <>
            {editTask && (
              <button
                className="btn btn-danger"
                onClick={() => setDeleteId(editTask.id)}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <button className="btn btn-secondary" onClick={closeTaskModal}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editTask ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Title" required>
              <input
                className="input"
                value={form.title}
                onChange={e => setForm(current => ({ ...current, title: e.target.value }))}
                placeholder="Task title"
              />
            </FormField>
          </div>

          <FormField label="Project">
            <select
              className="input"
              value={form.project_id}
              onChange={e => setForm(current => ({ ...current, project_id: e.target.value }))}
            >
              <option value="">No project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Assign To">
            <select
              className="input"
              value={form.assigned_to_id}
              onChange={e => setForm(current => ({ ...current, assigned_to_id: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Status">
            <select
              className="input"
              value={form.status}
              onChange={e => handleStatusChange(e.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map(statusOption => (
                <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Kanban Column" required>
            <select
              className="input"
              value={form.kanban_column_id}
              onChange={e => setForm(current => ({ ...current, kanban_column_id: e.target.value }))}
            >
              <option value="">Select column</option>
              {availableFormColumns.map(column => (
                <option key={column.id} value={column.id}>{column.title}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Priority">
            <select
              className="input"
              value={form.priority}
              onChange={e => setForm(current => ({ ...current, priority: e.target.value }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </FormField>

          <FormField label="Start Date">
            <input
              className="input"
              type="date"
              value={form.start_date}
              onChange={e => setForm(current => ({ ...current, start_date: e.target.value }))}
            />
          </FormField>

          <FormField label="Deadline">
            <input
              className="input"
              type="date"
              value={form.deadline}
              onChange={e => setForm(current => ({ ...current, deadline: e.target.value }))}
            />
          </FormField>

          <div className="col-span-2">
            <FormField label="Description">
              <textarea
                className="input"
                rows={3}
                value={form.description}
                onChange={e => setForm(current => ({ ...current, description: e.target.value }))}
              />
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
      <Modal
        open={!!columnToDelete}
        onClose={() => {
          if (columnDeleting) return
          setColumnToDelete(null)
        }}
        title={columnToDelete ? `Delete ${columnToDelete.title}?` : 'Delete column'}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setColumnToDelete(null)}
              disabled={columnDeleting}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => void handleDeleteColumn()}
              disabled={columnDeleting || selectedColumnTaskCount > 0}
            >
              {selectedColumnTaskCount > 0 ? 'Move tasks first' : columnDeleting ? 'Deleting...' : 'Delete column'}
            </button>
          </>
        }
      >
        {selectedColumnTaskCount > 0 ? (
          <p className="text-sm text-red-500">
            This kanban column still has tasks. Move them to another kanban column first.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            This will permanently remove the kanban column and keep the rest of the board intact.
          </p>
        )}
      </Modal>
      <ManageLabelsModal open={showManageLabels} onClose={() => setShowManageLabels(false)} />
    </div>
  )
}

function GanttView({ tasks, columns }: { tasks: TaskItem[]; columns: { id: string; label: string }[] }) {
  const validTasks = tasks.filter(task => task.start_date && task.deadline)

  if (validTasks.length === 0) {
    return <EmptyState message="No tasks with dates to display." />
  }

  const allDates = validTasks.flatMap(task => [new Date(task.start_date as string), new Date(task.deadline as string)])
  const minDate = new Date(Math.min(...allDates.map(date => date.getTime())))
  const maxDate = new Date(Math.max(...allDates.map(date => date.getTime())))
  const totalDays = Math.max((maxDate.getTime() - minDate.getTime()) / 86400000, 1)

  const defaultColors = ['bg-gray-400', 'bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-purple-500', 'bg-yellow-500']
  const barColors = columns.reduce((acc, col, index) => {
    acc[col.id] = defaultColors[index % defaultColors.length]
    return acc
  }, {} as Record<string, string>)

  return (
    <div className="min-w-[700px]">
      <div className="flex text-xs text-gray-400 mb-2 px-36">
        <span>{minDate.toLocaleDateString('id')}</span>
        <span className="ml-auto">{maxDate.toLocaleDateString('id')}</span>
      </div>
      <div className="space-y-2">
        {validTasks.map(task => {
          const start = (new Date(task.start_date as string).getTime() - minDate.getTime()) / 86400000
          const duration = Math.max((new Date(task.deadline as string).getTime() - new Date(task.start_date as string).getTime()) / 86400000, 1)
          const left = `${(start / totalDays) * 100}%`
          const width = `${Math.max((duration / totalDays) * 100, 2)}%`

          return (
            <div key={task.id} className="flex items-center gap-2 h-7">
              <div className="w-32 text-xs text-gray-600 truncate flex-shrink-0">{task.title}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded relative">
                <div
                  className={`absolute h-full rounded text-[10px] text-white flex items-center px-1 truncate ${barColors[task.status] || 'bg-blue-400'}`}
                  style={{ left, width }}
                  title={`${task.title}: ${formatTaskDate(task.start_date)} - ${formatTaskDate(task.deadline)}`}
                >
                  {task.title}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
