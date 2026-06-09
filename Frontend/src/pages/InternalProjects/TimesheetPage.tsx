import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Clock, Download, Filter, Users } from 'lucide-react'
import { toast } from 'react-toastify'
import type { RootState } from '@/store'
import { internalProjectService } from '@/services/api'
import { Avatar, EmptyState, FormField, Loading } from '@/components/common'

type TimeLog = {
  id: number
  task_id: number
  user_id: number
  clock_in: string
  clock_out: string | null
  duration_seconds: number
  user?: { id: number; name: string }
  task?: { id: number; title: string; project?: { id: number; name: string } }
}

type Project = {
  id: number
  name: string
}

type ProjectMember = {
  id: number
  user_id: number
  user?: { id: number; name: string }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekRange(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    from: formatLocalDate(monday),
    to: formatLocalDate(sunday),
    label: `${monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
}

export default function TimesheetPage() {
  const currentUser = useSelector((state: RootState) => state.auth.user)
  const [loading, setLoading] = useState(true)
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [filterProject, setFilterProject] = useState<string>('')
  const [filterUser, setFilterUser] = useState<string>(String(currentUser?.id || ''))

  const weekRange = getWeekRange(weekOffset)

  const load = async () => {
    setLoading(true)
    try {
      const [projectsRes] = await Promise.all([
        internalProjectService.list(),
      ])
      setProjects(projectsRes.data.data || [])
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const loadTimeLogs = async () => {
    try {
      let logs: TimeLog[] = []

      if (filterProject) {
        const response = await internalProjectService.getProjectTimeLogs(Number(filterProject), {
          from: weekRange.from,
          to: weekRange.to,
          user_id: filterUser || undefined,
        })
        logs = response.data.data || []
      } else {
        const response = await internalProjectService.getMyTimeLogs({
          from: weekRange.from,
          to: weekRange.to,
        })
        logs = response.data.data || []
      }

      setTimeLogs(logs.filter(log => log.clock_out !== null))
    } catch {
      toast.error('Failed to load time logs')
      setTimeLogs([])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setFilterUser('')
    if (!filterProject) {
      setProjectMembers([])
      return
    }

    const loadProjectMembers = async () => {
      try {
        const response = await internalProjectService.listMembers(Number(filterProject))
        setProjectMembers(response.data.data || [])
      } catch {
        setProjectMembers([])
        toast.error('Failed to load project members')
      }
    }

    void loadProjectMembers()
  }, [filterProject])

  useEffect(() => {
    void loadTimeLogs()
  }, [weekRange.from, weekRange.to, filterProject, filterUser])

  const totalSeconds = timeLogs.reduce((sum, log) => sum + log.duration_seconds, 0)
  const totalHours = Math.floor(totalSeconds / 3600)
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60)

  const groupedByDate = timeLogs.reduce<Record<string, TimeLog[]>>((acc, log) => {
    const date = log.clock_in.substring(0, 10)
    if (!acc[date]) acc[date] = []
    acc[date].push(log)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedByDate).sort().reverse()

  if (loading) return <Loading />

  return (
    <div className="p-5">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="text-primary" size={24} />
          <h1 className="text-2xl font-bold text-gray-900">Timesheet</h1>
        </div>
        <p className="text-sm text-gray-500">Track and manage your time logs</p>
      </div>

      <div className="card mb-5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="btn btn-secondary"
            >
              ← Prev
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">{weekRange.label}</p>
              <p className="text-xs text-gray-400">Week {weekOffset === 0 ? 'Current' : weekOffset > 0 ? `+${weekOffset}` : weekOffset}</p>
            </div>
            <button
              onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
              disabled={weekOffset >= 0}
              className="btn btn-secondary"
            >
              Next →
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
              <Clock size={18} className="text-primary" />
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-base font-bold text-primary">{totalHours}h {totalMinutes}m</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FormField label="Filter by Project">
            <select
              className="input"
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
            >
              <option value="">My Time Logs</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </FormField>

          {filterProject && (
            <FormField label="Filter by User">
              <select
                className="input"
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
              >
                <option value="">All Users</option>
                {projectMembers.map(member => (
                  <option key={member.id} value={member.user_id}>
                    {member.user?.name || `User #${member.user_id}`}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>
      </div>

      {timeLogs.length === 0 ? (
        <EmptyState message="No time logs for this period" />
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => {
            const dayLogs = groupedByDate[date]
            const dayTotal = dayLogs.reduce((sum, log) => sum + log.duration_seconds, 0)
            const dateObj = new Date(date + 'T00:00:00')
            const dayLabel = dateObj.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })

            return (
              <div key={date} className="card overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-5 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800">{dayLabel}</h3>
                  <span className="text-sm font-mono font-semibold text-primary">
                    {formatDuration(dayTotal)}
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {dayLogs.map(log => (
                    <div key={log.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Avatar name={log.user?.name || '?'} />
                            <p className="text-sm font-medium text-gray-700">{log.user?.name || `User #${log.user_id}`}</p>
                          </div>
                          <p className="text-sm text-gray-800 font-medium">{log.task?.title || `Task #${log.task_id}`}</p>
                          {log.task?.project && (
                            <p className="text-xs text-gray-400 mt-0.5">{log.task.project.name}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(log.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {log.clock_out && new Date(log.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-mono font-semibold text-gray-700">
                            {formatDuration(log.duration_seconds)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
