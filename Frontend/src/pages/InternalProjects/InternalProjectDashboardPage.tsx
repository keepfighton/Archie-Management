import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, FolderKanban, ListChecks, RefreshCw, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'react-toastify'
import { internalProjectService } from '@/services/api'
import { useLocale } from '@/contexts/LocaleContext'
import { Avatar, EmptyState, FormField, Loading, ProgressBar, StatusBadge } from '@/components/common'

type UserSummary = { id: number; name: string; email: string }
type Member = { id: number; user_id: number; user?: UserSummary }
type FilterProject = { id: number; name: string; members?: Member[] }
type DashboardSummary = {
  total_projects: number; active_projects: number; archived_projects: number; total_tasks: number
  done_tasks: number; overdue_tasks: number; high_priority_tasks: number; overall_progress: number; my_tasks: number
}
type StatusDistribution = { status: string; label: string; count: number }
type ProjectHealth = {
  id: number; name: string; status: string; progress: number; owner?: UserSummary; members?: Member[]
  total_tasks: number; done_tasks: number; overdue_tasks: number; high_priority_tasks: number; updated_at: string
}
type Workload = { user_id: number; name: string; email: string; total: number; open: number; done: number; overdue: number }
type AttentionTask = {
  id: number; project_id: number; project_name: string; title: string; status: string
  priority: string; due_date?: string | null; overdue: boolean; assignees?: { id: number; user_id: number; user?: UserSummary }[]
}
type DashboardData = {
  summary: DashboardSummary; status_distribution: StatusDistribution[]; projects: ProjectHealth[]
  workload: Workload[]; attention_tasks: AttentionTask[]; days: number
}

// Format hours to "Xh Ym" (e.g., 0.8 → "0h 48m", 1.5 → "1h 30m", 24 → "24h 0m")
function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const emptyData: DashboardData = {
  summary: { total_projects: 0, active_projects: 0, archived_projects: 0, total_tasks: 0, done_tasks: 0, overdue_tasks: 0, high_priority_tasks: 0, overall_progress: 0, my_tasks: 0 },
  status_distribution: [], projects: [], workload: [], attention_tasks: [], days: 30,
}

const statusColors: Record<string, string> = {
  backlog: '#64748b', todo: '#3b82f6', development: '#f59e0b', review: '#8b5cf6',
  uat: '#06b6d4', deploy_to_production: '#f97316', done: '#10b981',
}

const priorityBadge: Record<string, string> = {
  low: 'badge-green', medium: 'badge-blue', high: 'badge-orange', urgent: 'badge-red',
}

export default function InternalProjectDashboardPage() {
  const { locale, t } = useLocale()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<DashboardData>(emptyData)
  const [filterProjects, setFilterProjects] = useState<FilterProject[]>([])
  const [projectId, setProjectId] = useState('')
  const [userId, setUserId] = useState(searchParams.get('user') || '')
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [todayHours, setTodayHours] = useState(0)
  const [weekHours, setWeekHours] = useState(0)

  const members = useMemo(() => {
    const unique = new Map<number, UserSummary>()
    filterProjects.forEach(project => project.members?.forEach(member => {
      if (member.user) unique.set(member.user_id, member.user)
    }))
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [filterProjects])

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const params = { project_id: projectId || undefined, user_id: userId || undefined }
      const [dashboardResponse, timeResponse] = await Promise.all([
        internalProjectService.dashboard({ ...params, days }),
        internalProjectService.getTimeSummary(params),
      ])
      setData(dashboardResponse.data)
      setTodayHours(Math.round((timeResponse.data.today_seconds || 0) / 360) / 10)
      setWeekHours(Math.round((timeResponse.data.week_seconds || 0) / 360) / 10)
    } catch {
      toast.error(t('internalProjectDashboard.loadFailed', 'Failed to load internal project monitoring'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [days, projectId, t, userId])

  useEffect(() => {
    internalProjectService.list({ limit: 500 })
      .then(response => setFilterProjects(response.data.data || []))
      .catch(() => setFilterProjects([]))
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const maxWorkload = Math.max(1, ...data.workload.map(item => item.total))

  if (loading) return <div className="p-5"><Loading /></div>

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">{t('internalProjectDashboard.title', 'Internal Project Monitoring')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">{t('internalProjectDashboard.subtitle', 'Monitor internal project progress, workload, deadlines, and delivery stages in one place.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" disabled={refreshing} onClick={() => void loadDashboard(true)}><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />{t('internalProjectDashboard.refresh', 'Refresh')}</button>
          <Link to="/internal-project/projects" className="btn btn-primary"><FolderKanban size={14} />{t('internalProjectDashboard.openProjects', 'Open projects')}</Link>
        </div>
      </div>

      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <FormField label={t('internalProjectDashboard.filterProject', 'Project')}>
              <select className="input" value={projectId} onChange={event => setProjectId(event.target.value)}>
                <option value="">{t('internalProjectDashboard.allProjects', 'All projects')}</option>
                {filterProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="flex-1 min-w-[200px]">
            <FormField label={t('internalProjectDashboard.filterMember', 'Member')}>
              <select className="input" value={userId} onChange={event => setUserId(event.target.value)}>
                <option value="">{t('internalProjectDashboard.allMembers', 'All members')}</option>
                {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="flex-1 min-w-[150px]">
            <FormField label={t('internalProjectDashboard.period', 'Deadline horizon')}>
              <select className="input" value={days} onChange={event => setDays(event.target.value)}>
                <option value="7">7 {t('internalProjectDashboard.days', 'days')}</option>
                <option value="30">30 {t('internalProjectDashboard.days', 'days')}</option>
                <option value="90">90 {t('internalProjectDashboard.days', 'days')}</option>
              </select>
            </FormField>
          </div>
          <div className="mb-3">
            <button className="btn btn-secondary whitespace-nowrap" onClick={() => { setProjectId(''); setUserId(''); setDays('30') }}>
              {t('internalProjectDashboard.clear', 'Clear')}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Link to="/internal-project/projects" className="stat-card cursor-pointer transition-shadow hover:shadow-md"><div className="stat-icon bg-blue-50 text-blue-600"><FolderKanban size={19} /></div><div><div className="stat-val">{data.summary.active_projects}</div><div className="stat-label">{t('internalProjectDashboard.activeProjects', 'Active projects')}</div></div></Link>
        <Link to="/internal-project/my-tasks" className="stat-card cursor-pointer transition-shadow hover:shadow-md"><div className="stat-icon bg-indigo-50 text-indigo-600"><ListChecks size={19} /></div><div><div className="stat-val">{data.summary.my_tasks}</div><div className="stat-label">{t('internalProjectDashboard.myTasks', 'My tasks')}</div></div></Link>
        <Link to="/internal-project/my-tasks?tab=completed" className="stat-card cursor-pointer transition-shadow hover:shadow-md"><div className="stat-icon bg-emerald-50 text-emerald-600"><CheckCircle2 size={19} /></div><div><div className="stat-val">{data.summary.done_tasks}/{data.summary.total_tasks}</div><div className="stat-label">{t('internalProjectDashboard.completedTasks', 'Completed tasks')}</div></div></Link>
        <Link to="/internal-project/my-tasks?tab=overdue" className="stat-card cursor-pointer transition-shadow hover:shadow-md"><div className="stat-icon bg-red-50 text-red-600"><AlertTriangle size={19} /></div><div><div className="stat-val">{data.summary.overdue_tasks}</div><div className="stat-label">{t('internalProjectDashboard.overdueTasks', 'Overdue tasks')}</div></div></Link>
        <Link to="/internal-project/projects" className="stat-card cursor-pointer transition-shadow hover:shadow-md"><div className="stat-icon bg-violet-50 text-violet-600"><Users size={19} /></div><div><div className="stat-val">{data.summary.overall_progress}%</div><div className="stat-label">{t('internalProjectDashboard.overallProgress', 'Overall progress')}</div></div></Link>
        <Link to="/internal-project/timesheet" className="stat-card cursor-pointer transition-shadow hover:shadow-md"><div className="stat-icon bg-amber-50 text-amber-600"><Clock size={19} /></div><div><div className="stat-val">{formatHours(todayHours)} / {formatHours(weekHours)}</div><div className="stat-label">{t('internalProjectDashboard.hoursTodayWeek', 'Hours (Today / Week)')}</div></div></Link>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.05fr_1.05fr_1.4fr]">
        <div className="card">
          <div className="card-header"><div><p className="section-title">{t('internalProjectDashboard.statusDistribution', 'Task distribution')}</p><p className="mt-0.5 text-xs text-gray-400">{t('internalProjectDashboard.statusHint', 'Tasks across the seven delivery stages')}</p></div></div>
          <div className="card-body min-w-0">
            <div className="relative mx-auto h-[220px] w-full max-w-[220px] min-w-0 overflow-visible">
              <ResponsiveContainer width="100%" height="100%"><PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}><Pie data={data.status_distribution} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2}>{data.status_distribution.map(item => <Cell key={item.status} fill={statusColors[item.status] || '#94a3b8'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">{data.status_distribution.map(item => <div key={item.status} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-2"><span className="flex min-w-0 items-center gap-2 text-xs leading-4 text-gray-600"><span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: statusColors[item.status] }} /><span>{item.label}</span></span><span className="flex-shrink-0 text-sm font-semibold text-gray-800">{item.count}</span></div>)}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div><p className="section-title">{t('internalProjectDashboard.hoursToday', 'Hours Today')}</p><p className="mt-0.5 text-xs text-gray-400">{userId ? t('internalProjectDashboard.individualDailyHours', 'Individual daily hours') : t('internalProjectDashboard.teamDailyHours', 'Team daily hours')}</p></div></div>
          <div className="card-body">
            <div className="relative mx-auto h-[220px] w-full max-w-[220px] min-w-0 overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Pie
                    data={[
                      { name: 'Worked', value: Math.min(todayHours, 24) },
                      { name: 'Remaining', value: Math.max(0, 24 - todayHours) }
                    ]}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={0}
                  >
                    <Cell fill={todayHours >= 16 ? '#ef4444' : todayHours >= 8 ? '#f59e0b' : '#10b981'} />
                    <Cell fill="#e5e7eb" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-gray-800">{formatHours(todayHours)}</p>
                <p className="text-xs text-gray-400">{t('internalProjectDashboard.of24Hours', 'of 24h')}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-2 text-xs text-gray-600">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                  <span>{t('internalProjectDashboard.hoursLow', 'Low (0-8h)')}</span>
                </span>
                <span className="text-xs font-semibold text-gray-800">{todayHours < 8 ? '✓' : ''}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-2 text-xs text-gray-600">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
                  <span>{t('internalProjectDashboard.hoursMedium', 'Medium (8-16h)')}</span>
                </span>
                <span className="text-xs font-semibold text-gray-800">{todayHours >= 8 && todayHours < 16 ? '✓' : ''}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-2 text-xs text-gray-600">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
                  <span>{t('internalProjectDashboard.hoursHigh', 'High (16-24h)')}</span>
                </span>
                <span className="text-xs font-semibold text-gray-800">{todayHours >= 16 ? '✓' : ''}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div><p className="section-title">{t('internalProjectDashboard.workload', 'Member workload')}</p><p className="mt-0.5 text-xs text-gray-400">{t('internalProjectDashboard.workloadHint', 'Open, completed, and overdue assigned tasks')}</p></div></div>
          <div className="card-body">
            {data.workload.length === 0 ? <EmptyState message={t('internalProjectDashboard.noWorkload', 'No assigned tasks for this filter.')} /> : <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.workload.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} domain={[0, maxWorkload]} /><YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="open" name={t('internalProjectDashboard.open', 'Open')} fill="#3b82f6" /><Bar dataKey="done" name={t('internalProjectDashboard.done', 'Done')} fill="#10b981" /><Bar dataKey="overdue" name={t('internalProjectDashboard.overdue', 'Overdue')} fill="#ef4444" /></BarChart></ResponsiveContainer></div>}
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="card overflow-hidden">
          <div className="card-header"><div><p className="section-title">{t('internalProjectDashboard.projectHealth', 'Project health')}</p><p className="mt-0.5 text-xs text-gray-400">{t('internalProjectDashboard.projectHealthHint', 'Progress and delivery risks for accessible projects')}</p></div></div>
          {data.projects.length === 0 ? <EmptyState message={t('internalProjectDashboard.noProjects', 'No internal projects match this filter.')} /> : <div className="divide-y divide-gray-100">{data.projects.map(project => <Link key={project.id} to={`/internal-project/projects/${project.id}`} className="flex flex-col gap-3 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium text-gray-800">{project.name}</p><span className={`badge ${project.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{project.status}</span></div><div className="mt-2 flex items-center gap-2"><ProgressBar value={project.progress} className="max-w-52 flex-1" /><span className="text-xs font-semibold text-gray-600">{project.progress}%</span></div><p className="mt-2 text-xs text-gray-400">{project.done_tasks}/{project.total_tasks} {t('internalProjectDashboard.tasksDone', 'tasks done')} · {project.members?.length || 0} {t('internalProjectDashboard.members', 'members')}</p></div><div className="flex items-center gap-3 text-xs"><span className={project.overdue_tasks ? 'text-red-500' : 'text-gray-400'}>{project.overdue_tasks} {t('internalProjectDashboard.overdue', 'overdue')}</span><span className={project.high_priority_tasks ? 'text-orange-500' : 'text-gray-400'}>{project.high_priority_tasks} {t('internalProjectDashboard.highPriority', 'high priority')}</span><ArrowRight size={15} className="text-gray-300" /></div></Link>)}</div>}
        </div>

        <div className="card overflow-hidden">
          <div className="card-header"><div><p className="section-title">{t('internalProjectDashboard.attention', 'Needs attention')}</p><p className="mt-0.5 text-xs text-gray-400">{t('internalProjectDashboard.attentionHint', 'Overdue, high-priority, or upcoming tasks')}</p></div><span className="badge badge-orange">{data.attention_tasks.length}</span></div>
          {data.attention_tasks.length === 0 ? <EmptyState message={t('internalProjectDashboard.noAttention', 'No urgent tasks in this period.')} /> : <div className="divide-y divide-gray-100">{data.attention_tasks.map(task => <Link key={task.id} to={`/internal-project/projects/${task.project_id}`} className="block p-4 transition hover:bg-slate-50"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800">{task.title}</p><p className="mt-0.5 truncate text-xs text-gray-400">{task.project_name}</p></div><span className={`badge ${priorityBadge[task.priority] || 'badge-gray'}`}>{t(`internalProjectDetail.priority.${task.priority}`, task.priority)}</span></div><div className="mt-3 flex items-center justify-between"><StatusBadge status={task.status} /><span className={`text-[11px] ${task.overdue ? 'font-medium text-red-500' : 'text-gray-400'}`}>{task.due_date ? new Date(task.due_date).toLocaleDateString(locale) : t('internalProjectDetail.noDeadline', 'No deadline')}</span></div><div className="mt-2 flex -space-x-1">{task.assignees?.slice(0, 4).map(assignee => <Avatar key={assignee.id} name={assignee.user?.name || '?'} />)}</div></Link>)}</div>}
        </div>
      </div>
    </div>
  )
}
