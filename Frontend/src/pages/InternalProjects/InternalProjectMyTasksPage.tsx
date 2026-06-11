import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Search } from 'lucide-react'
import { toast } from 'react-toastify'
import { internalProjectService } from '@/services/api'
import { useLocale } from '@/contexts/LocaleContext'
import { EmptyState, FormField, Loading, StatusBadge } from '@/components/common'

type UserSummary = { id: number; name: string; email: string }
type ProjectSummary = { id: number; name: string }
type ColumnSummary = { id: number; label: string; key: string }
type TaskAssignee = { id: number; user_id: number; user?: UserSummary }
type MyTask = {
  id: number
  project_id: number
  title: string
  description?: string
  category?: string
  priority: string
  status: string
  due_date?: string | null
  project?: ProjectSummary
  column?: ColumnSummary
  assignees?: TaskAssignee[]
}

type TaskTab = 'all' | 'overdue' | 'today' | 'upcoming' | 'done'

const priorityStyle: Record<string, string> = {
  low: 'badge-green', medium: 'badge-blue', high: 'badge-orange', urgent: 'badge-red',
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function taskDateKey(task: MyTask) {
  return task.due_date?.slice(0, 10) || ''
}

export default function InternalProjectMyTasksPage() {
  const { locale, t } = useLocale()
  const [searchParams] = useSearchParams()
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TaskTab>(searchParams.get('tab') as TaskTab || 'all')
  const [search, setSearch] = useState('')
  const [projectID, setProjectID] = useState('')
  const [priority, setPriority] = useState('')

  const userIdParam = searchParams.get('user')
  const viewingOtherUser = !!userIdParam

  useEffect(() => {
    const params: any = { limit: 500, include_done: true }
    if (userIdParam) params.user_id = userIdParam

    internalProjectService.getMyTasks(params)
      .then(response => setTasks(response.data.data || []))
      .catch(() => toast.error(t('internalProjectMyTasks.loadFailed', 'Failed to load tasks')))
      .finally(() => setLoading(false))
  }, [userIdParam, t])

  const today = localDateKey(new Date())
  const projects = useMemo(() => {
    const unique = new Map<number, ProjectSummary>()
    tasks.forEach(task => task.project && unique.set(task.project.id, task.project))
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks])

  const taskMatchesTab = (task: MyTask, selectedTab: TaskTab) => {
    const dueDate = taskDateKey(task)
    if (selectedTab === 'done') return task.status === 'done'
    if (selectedTab === 'overdue') return task.status !== 'done' && !!dueDate && dueDate < today
    if (selectedTab === 'today') return task.status !== 'done' && dueDate === today
    if (selectedTab === 'upcoming') return task.status !== 'done' && !!dueDate && dueDate > today
    return true
  }

  const counts = useMemo(() => ({
    all: tasks.length,
    overdue: tasks.filter(task => taskMatchesTab(task, 'overdue')).length,
    today: tasks.filter(task => taskMatchesTab(task, 'today')).length,
    upcoming: tasks.filter(task => taskMatchesTab(task, 'upcoming')).length,
    done: tasks.filter(task => taskMatchesTab(task, 'done')).length,
  }), [tasks, today])

  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return tasks.filter(task => {
      const matchesTab = taskMatchesTab(task, tab)
      const matchesSearch = !needle || [task.title, task.description, task.category, task.project?.name]
        .some(value => value?.toLowerCase().includes(needle))
      const matchesProject = !projectID || task.project_id === Number(projectID)
      const matchesPriority = !priority || task.priority === priority
      return matchesTab && matchesSearch && matchesProject && matchesPriority
    })
  }, [priority, projectID, search, tab, tasks, today])

  const tabs: { key: TaskTab; label: string; count: number }[] = [
    { key: 'all', label: t('internalProjectMyTasks.all', 'All'), count: counts.all },
    { key: 'overdue', label: t('internalProjectMyTasks.overdue', 'Overdue'), count: counts.overdue },
    { key: 'today', label: t('internalProjectMyTasks.today', 'Today'), count: counts.today },
    { key: 'upcoming', label: t('internalProjectMyTasks.upcoming', 'Upcoming'), count: counts.upcoming },
    { key: 'done', label: t('internalProjectMyTasks.done', 'Done'), count: counts.done },
  ]

  if (loading) return <div className="p-5"><Loading /></div>

  return <div className="p-5">
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><ClipboardList size={22} /></div>
        <div>
          <h1 className="page-title">
            {viewingOtherUser
              ? tasks.length > 0 && tasks[0].assignees?.[0]?.user?.name
                ? `${tasks[0].assignees[0].user.name}'s Tasks`
                : 'Member Tasks'
              : t('internalProjectMyTasks.title', 'My Internal Tasks')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {viewingOtherUser
              ? 'Review all internal project tasks assigned to this member.'
              : t('internalProjectMyTasks.subtitle', 'Review every internal project task assigned to you.')}
          </p>
        </div>
      </div>
      <Link to="/internal-project/projects" className="btn btn-secondary">{t('internalProjectMyTasks.openProjects', 'Open projects')}<ArrowRight size={14} /></Link>
    </div>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="stat-card"><div className="stat-icon bg-blue-50 text-blue-600"><ClipboardList size={19} /></div><div><div className="stat-val">{counts.all}</div><div className="stat-label">{t('internalProjectMyTasks.total', 'Total assigned')}</div></div></div>
      <div className="stat-card"><div className="stat-icon bg-red-50 text-red-600"><AlertTriangle size={19} /></div><div><div className="stat-val">{counts.overdue}</div><div className="stat-label">{t('internalProjectMyTasks.overdue', 'Overdue')}</div></div></div>
      <div className="stat-card"><div className="stat-icon bg-amber-50 text-amber-600"><CalendarDays size={19} /></div><div><div className="stat-val">{counts.today}</div><div className="stat-label">{t('internalProjectMyTasks.dueToday', 'Due today')}</div></div></div>
      <div className="stat-card"><div className="stat-icon bg-emerald-50 text-emerald-600"><CheckCircle2 size={19} /></div><div><div className="stat-val">{counts.done}</div><div className="stat-label">{t('internalProjectMyTasks.completed', 'Completed')}</div></div></div>
    </div>

    <div className="card mb-5 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_180px]">
        <FormField label={t('internalProjectMyTasks.search', 'Search')}><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('internalProjectMyTasks.searchPlaceholder', 'Search task, project, or category...')} /></div></FormField>
        <FormField label={t('internalProjectMyTasks.project', 'Project')}><select className="input" value={projectID} onChange={event => setProjectID(event.target.value)}><option value="">{t('internalProjectMyTasks.allProjects', 'All projects')}</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></FormField>
        <FormField label={t('internalProjectMyTasks.priority', 'Priority')}><select className="input" value={priority} onChange={event => setPriority(event.target.value)}><option value="">{t('internalProjectMyTasks.allPriorities', 'All priorities')}</option>{['urgent', 'high', 'medium', 'low'].map(value => <option key={value} value={value}>{t(`internalProjectDetail.priority.${value}`, value)}</option>)}</select></FormField>
      </div>
    </div>

    <div className="mb-4 flex flex-wrap gap-2">{tabs.map(item => <button key={item.key} className={`rounded-xl px-3 py-2 text-xs font-medium transition ${tab === item.key ? 'bg-primary text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-500 hover:bg-slate-50'}`} onClick={() => setTab(item.key)}>{item.label} <span className="ml-1 opacity-75">{item.count}</span></button>)}</div>

    <div className="table-container"><table className="table"><thead><tr><th>{t('internalProjectMyTasks.task', 'Task')}</th><th>{t('internalProjectMyTasks.project', 'Project')}</th><th>{t('internalProjectMyTasks.priority', 'Priority')}</th><th>{t('internalProjectMyTasks.status', 'Status')}</th><th>{t('internalProjectMyTasks.deadline', 'Deadline')}</th><th /></tr></thead><tbody>{filteredTasks.length === 0 ? <tr><td colSpan={6}><EmptyState message={t('internalProjectMyTasks.empty', 'No assigned tasks match these filters.')} /></td></tr> : filteredTasks.map(task => {
      const overdue = taskMatchesTab(task, 'overdue')
      return <tr key={task.id}><td><p className="font-medium text-gray-800">{task.title}</p><p className="line-clamp-1 max-w-md text-xs text-gray-400">{task.category || task.description || '-'}</p></td><td className="text-gray-600">{task.project?.name || '-'}</td><td><span className={`badge ${priorityStyle[task.priority] || 'badge-gray'}`}>{t(`internalProjectDetail.priority.${task.priority}`, task.priority)}</span></td><td><StatusBadge status={task.status} /></td><td className={overdue ? 'font-medium text-red-500' : 'text-gray-500'}>{task.due_date ? new Date(task.due_date).toLocaleDateString(locale) : t('internalProjectDetail.noDeadline', 'No deadline')}</td><td><Link to={`/internal-project/projects/${task.project_id}?task=${task.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">{t('internalProjectMyTasks.open', 'Open')}<ArrowRight size={12} /></Link></td></tr>
    })}</tbody></table></div>
  </div>
}
