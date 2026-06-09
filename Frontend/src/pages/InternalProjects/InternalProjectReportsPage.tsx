import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { toast } from 'react-toastify'
import { internalProjectService } from '@/services/api'
import { useLocale } from '@/contexts/LocaleContext'
import { FormField, Loading } from '@/components/common'

type UserSummary = { id: number; name: string }
type Member = { user_id: number; user?: UserSummary }
type Project = { id: number; name: string; members?: Member[] }
type Summary = {
  total_projects: number; active_projects: number; total_tasks: number; done_tasks: number
  overdue_tasks: number; high_priority_tasks: number; overall_progress: number
}

const emptySummary: Summary = {
  total_projects: 0, active_projects: 0, total_tasks: 0, done_tasks: 0,
  overdue_tasks: 0, high_priority_tasks: 0, overall_progress: 0,
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function currentMonthRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { from: localDate(first), to: localDate(last) }
}

export default function InternalProjectReportsPage() {
  const { t } = useLocale()
  const month = currentMonthRange()
  const [projects, setProjects] = useState<Project[]>([])
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [projectId, setProjectId] = useState('')
  const [userId, setUserId] = useState('')
  const [from, setFrom] = useState(month.from)
  const [to, setTo] = useState(month.to)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState('')

  const members = useMemo(() => {
    const unique = new Map<number, UserSummary>()
    const scope = projectId ? projects.filter(project => project.id === Number(projectId)) : projects
    scope.forEach(project => project.members?.forEach(member => member.user && unique.set(member.user_id, member.user)))
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [projectId, projects])

  const params = useMemo(() => ({
    project_id: projectId || undefined,
    user_id: userId || undefined,
    from: from || undefined,
    to: to || undefined,
  }), [from, projectId, to, userId])

  useEffect(() => {
    internalProjectService.list({ limit: 500 })
      .then(response => setProjects(response.data.data || []))
      .catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    internalProjectService.dashboard({ project_id: projectId || undefined, user_id: userId || undefined, days: 90 })
      .then(response => setSummary(response.data.summary || emptySummary))
      .catch(() => {
        setSummary(emptySummary)
        toast.error(t('internalProjectReports.loadFailed', 'Failed to load report summary'))
      })
      .finally(() => setLoading(false))
  }, [projectId, t, userId])

  useEffect(() => {
    if (userId && !members.some(member => member.id === Number(userId))) setUserId('')
  }, [members, userId])

  const exportCSV = async (type: 'tasks' | 'timesheet') => {
    setExporting(type)
    try {
      const response = await internalProjectService.exportReportCSV(type, params)
      downloadBlob(response.data, `internal_project_${type}_${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(t('internalProjectReports.exported', 'Report exported'))
    } catch {
      toast.error(t('internalProjectReports.exportFailed', 'Failed to export report'))
    } finally {
      setExporting('')
    }
  }

  const printSummary = async () => {
    setExporting('summary')
    try {
      await internalProjectService.openReportSummary(params)
    } catch {
      toast.error(t('internalProjectReports.popupBlocked', 'Unable to open report. Allow popups and try again.'))
    } finally {
      setExporting('')
    }
  }

  if (loading && projects.length === 0) return <div className="p-5"><Loading /></div>

  return <div className="p-5">
    <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><BarChart3 size={22} /></div><div><h1 className="page-title">{t('internalProjectReports.title', 'Internal Project Reports')}</h1><p className="mt-1 text-sm text-gray-500">{t('internalProjectReports.subtitle', 'Export project progress, task, workload, overdue, and timesheet data.')}</p></div></div>

    <div className="card mb-5 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <FormField label={t('internalProjectReports.project', 'Project')}><select className="input" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">{t('internalProjectReports.allProjects', 'All projects')}</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></FormField>
      <FormField label={t('internalProjectReports.member', 'Member')}><select className="input" value={userId} onChange={event => setUserId(event.target.value)}><option value="">{t('internalProjectReports.allMembers', 'All members')}</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></FormField>
      <FormField label={t('internalProjectReports.from', 'From')}><input type="date" className="input" value={from} onChange={event => setFrom(event.target.value)} /></FormField>
      <FormField label={t('internalProjectReports.to', 'To')}><input type="date" className="input" value={to} min={from} onChange={event => setTo(event.target.value)} /></FormField>
    </div></div>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="stat-card"><div><div className="stat-val">{summary.active_projects}</div><div className="stat-label">{t('internalProjectReports.activeProjects', 'Active projects')}</div></div></div>
      <div className="stat-card"><div><div className="stat-val">{summary.done_tasks}/{summary.total_tasks}</div><div className="stat-label">{t('internalProjectReports.completedTasks', 'Completed tasks')}</div></div></div>
      <div className="stat-card"><div><div className="stat-val text-red-500">{summary.overdue_tasks}</div><div className="stat-label">{t('internalProjectReports.overdue', 'Overdue')}</div></div></div>
      <div className="stat-card"><div><div className="stat-val text-orange-500">{summary.high_priority_tasks}</div><div className="stat-label">{t('internalProjectReports.highPriority', 'High priority')}</div></div></div>
      <div className="stat-card"><div><div className="stat-val">{summary.overall_progress}%</div><div className="stat-label">{t('internalProjectReports.progress', 'Overall progress')}</div></div></div>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card p-5"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FileSpreadsheet size={20} /></div><h2 className="font-semibold text-gray-800">{t('internalProjectReports.taskReport', 'Task Report')}</h2><p className="mt-1 min-h-10 text-sm text-gray-500">{t('internalProjectReports.taskReportHint', 'Detailed tasks, status, priority, assignees, deadline, and overdue data.')}</p><button className="btn btn-secondary mt-5 w-full" disabled={!!exporting} onClick={() => void exportCSV('tasks')}><Download size={15} />{exporting === 'tasks' ? t('internalProjectReports.exporting', 'Exporting...') : 'CSV'}</button></div>
      <div className="card p-5"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><FileText size={20} /></div><h2 className="font-semibold text-gray-800">{t('internalProjectReports.timesheetReport', 'Timesheet Report')}</h2><p className="mt-1 min-h-10 text-sm text-gray-500">{t('internalProjectReports.timesheetReportHint', 'Tracked hours by project, task, member, and selected period.')}</p><button className="btn btn-secondary mt-5 w-full" disabled={!!exporting} onClick={() => void exportCSV('timesheet')}><Download size={15} />{exporting === 'timesheet' ? t('internalProjectReports.exporting', 'Exporting...') : 'CSV'}</button></div>
      <div className="card p-5"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Printer size={20} /></div><h2 className="font-semibold text-gray-800">{t('internalProjectReports.managementSummary', 'Management Summary')}</h2><p className="mt-1 min-h-10 text-sm text-gray-500">{t('internalProjectReports.managementSummaryHint', 'Printable project health and management overview, ready to save as PDF.')}</p><button className="btn btn-primary mt-5 w-full" disabled={!!exporting} onClick={() => void printSummary()}><Printer size={15} />{exporting === 'summary' ? t('internalProjectReports.preparing', 'Preparing...') : 'PDF / Print'}</button></div>
    </div>
  </div>
}
