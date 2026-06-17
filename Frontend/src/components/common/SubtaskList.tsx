import { useState, useEffect, useCallback } from 'react'
import { Check, Plus, X, Trash2, Clock, Play, Square, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { toast } from 'react-toastify'
import { internalProjectService } from '../../services/api'

type TimeLog = {
  id: number
  user_id: number
  user?: { id: number; name: string }
  clock_in: string
  clock_out: string | null
  duration_seconds: number
  subtask_id?: number
}

type Subtask = {
  id: number
  task_id: number
  title: string
  description: string
  status: string
  position: number
  assignee_id: number | null
  assignee?: { id: number; name: string }
  due_date: string | null
  estimated_seconds: number
}

type SubtaskTimeState = {
  logs: TimeLog[]
  totalSeconds: number
  activeLog: TimeLog | null
  loading: boolean
  expanded: boolean
}

type SubtaskListProps = {
  taskId: number
  subtasks: Subtask[]
  onToggle: (subtaskId: number) => Promise<void>
  onAdd: (title: string) => Promise<void>
  onDelete: (subtaskId: number) => Promise<void>
  onRefresh: () => Promise<void>
  loading?: boolean
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function parseHhMm(value: string): number {
  const parts = value.split(':')
  if (parts.length !== 2) return 0
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  return h * 3600 + m * 60
}

function formatToHhMm(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatLogTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

type EditLogState = {
  logId: number
  clockIn: string
  clockOut: string
}

type ManualLogForm = {
  date: string
  startTime: string
  endTime: string
}

export default function SubtaskList({
  taskId,
  subtasks,
  onToggle,
  onAdd,
  onDelete,
  onRefresh,
  loading = false
}: SubtaskListProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [timeState, setTimeState] = useState<Record<number, SubtaskTimeState>>({})
  const [editLog, setEditLog] = useState<EditLogState | null>(null)
  const [manualForm, setManualForm] = useState<Record<number, ManualLogForm>>({})
  const [showManualForm, setShowManualForm] = useState<Record<number, boolean>>({})
  const [editEstimate, setEditEstimate] = useState<Record<number, string>>({})
  const [showEstimateInput, setShowEstimateInput] = useState<Record<number, boolean>>({})
  const [tickCounter, setTickCounter] = useState(0)

  // Tick every 30s for live timer display
  useEffect(() => {
    const interval = setInterval(() => setTickCounter(t => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const loadSubtaskTime = useCallback(async (subtaskId: number) => {
    setTimeState(prev => ({ ...prev, [subtaskId]: { ...prev[subtaskId], loading: true, expanded: prev[subtaskId]?.expanded ?? false } }))
    try {
      const res = await internalProjectService.getSubtaskTimeLogs(taskId, subtaskId)
      const { data: logs, active_log, total_seconds } = res.data
      setTimeState(prev => ({
        ...prev,
        [subtaskId]: { logs, totalSeconds: total_seconds, activeLog: active_log ?? null, loading: false, expanded: prev[subtaskId]?.expanded ?? false }
      }))
    } catch {
      setTimeState(prev => ({ ...prev, [subtaskId]: { ...(prev[subtaskId] ?? {}), loading: false, expanded: prev[subtaskId]?.expanded ?? false } as SubtaskTimeState }))
    }
  }, [taskId])

  useEffect(() => {
    subtasks.forEach(s => loadSubtaskTime(s.id))
  }, [subtasks.map(s => s.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = (subtaskId: number) => {
    setTimeState(prev => ({ ...prev, [subtaskId]: { ...(prev[subtaskId] ?? { logs: [], totalSeconds: 0, activeLog: null, loading: false }), expanded: !prev[subtaskId]?.expanded } }))
  }

  const handleAdd = async () => {
    if (!newSubtaskTitle.trim()) {
      toast.error('Subtask title is required')
      return
    }
    setAdding(true)
    try {
      await onAdd(newSubtaskTitle.trim())
      setNewSubtaskTitle('')
      setShowAddForm(false)
      await onRefresh()
      toast.success('Subtask added')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to add subtask')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (subtaskId: number) => {
    try {
      await onToggle(subtaskId)
      await onRefresh()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to toggle subtask')
    }
  }

  const handleDelete = async (subtaskId: number) => {
    if (!confirm('Delete this subtask?')) return
    try {
      await onDelete(subtaskId)
      await onRefresh()
      toast.success('Subtask deleted')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to delete subtask')
    }
  }

  const handleClockIn = async (subtaskId: number) => {
    try {
      await internalProjectService.subtaskClockIn(taskId, subtaskId)
      await loadSubtaskTime(subtaskId)
      toast.success('Timer started')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to start timer')
    }
  }

  const handleClockOut = async (subtaskId: number) => {
    try {
      await internalProjectService.subtaskClockOut(taskId, subtaskId)
      await loadSubtaskTime(subtaskId)
      toast.success('Timer stopped')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to stop timer')
    }
  }

  const handleManualLog = async (subtaskId: number) => {
    const form = manualForm[subtaskId]
    if (!form?.date || !form?.startTime || !form?.endTime) {
      toast.error('Please fill date, start and end time')
      return
    }
    const clockIn = new Date(`${form.date}T${form.startTime}:00`).toISOString()
    const clockOut = new Date(`${form.date}T${form.endTime}:00`).toISOString()
    if (new Date(clockOut) <= new Date(clockIn)) {
      toast.error('End time must be after start time')
      return
    }
    try {
      await internalProjectService.createSubtaskManualTimeLog(taskId, subtaskId, { clock_in: clockIn, clock_out: clockOut })
      await loadSubtaskTime(subtaskId)
      setManualForm(prev => ({ ...prev, [subtaskId]: { date: '', startTime: '', endTime: '' } }))
      setShowManualForm(prev => ({ ...prev, [subtaskId]: false }))
      toast.success('Time logged')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to log time')
    }
  }

  const handleDeleteLog = async (subtaskId: number, logId: number) => {
    if (!confirm('Delete this time log?')) return
    try {
      await internalProjectService.deleteSubtaskTimeLog(taskId, subtaskId, logId)
      await loadSubtaskTime(subtaskId)
      toast.success('Log deleted')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to delete log')
    }
  }

  const handleSaveEditLog = async (subtaskId: number) => {
    if (!editLog) return
    try {
      await internalProjectService.updateSubtaskTimeLog(taskId, subtaskId, editLog.logId, {
        clock_in: new Date(editLog.clockIn).toISOString(),
        clock_out: new Date(editLog.clockOut).toISOString(),
      })
      await loadSubtaskTime(subtaskId)
      setEditLog(null)
      toast.success('Log updated')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to update log')
    }
  }

  const handleSaveEstimate = async (subtask: Subtask) => {
    const val = editEstimate[subtask.id] ?? ''
    const seconds = parseHhMm(val)
    try {
      await internalProjectService.updateSubtaskEstimate(taskId, subtask.id, seconds)
      await onRefresh()
      setShowEstimateInput(prev => ({ ...prev, [subtask.id]: false }))
      toast.success('Estimate saved')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to save estimate')
    }
  }

  const completedCount = subtasks.filter(s => s.status === 'completed').length
  const totalCount = subtasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Compute live elapsed for active timers
  const getLiveSeconds = (ts: SubtaskTimeState): number => {
    if (!ts?.activeLog) return ts?.totalSeconds ?? 0
    const elapsed = Math.floor((Date.now() - new Date(ts.activeLog.clock_in).getTime()) / 1000)
    return (ts.totalSeconds ?? 0) + elapsed
  }

  void tickCounter // used to re-render for live timer

  return (
    <div className="border border-slate-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Subtasks</h3>
          {totalCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {completedCount} of {totalCount} completed ({progressPercent}%)
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          disabled={loading}
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel' : 'Add'}
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {showAddForm && (
          <div className="p-3 bg-blue-50">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') setShowAddForm(false)
                }}
                placeholder="Subtask title..."
                className="input flex-1 text-sm"
                autoFocus
                disabled={adding}
              />
              <button onClick={handleAdd} disabled={adding || !newSubtaskTitle.trim()} className="btn btn-primary btn-sm">
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {subtasks.length === 0 && !showAddForm ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No subtasks yet. Click "Add" to create one.
          </div>
        ) : (
          subtasks.map(subtask => {
            const ts = timeState[subtask.id]
            const liveSeconds = getLiveSeconds(ts)
            const isRunning = !!ts?.activeLog
            const estimated = subtask.estimated_seconds ?? 0
            const logProgress = estimated > 0 ? Math.min(100, Math.round((liveSeconds / estimated) * 100)) : 0
            const isOverlogged = estimated > 0 && liveSeconds > estimated
            const expanded = ts?.expanded ?? false

            return (
              <div key={subtask.id} className="border-b border-slate-100 last:border-0">
                {/* Subtask row */}
                <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 transition group">
                  <button
                    onClick={() => handleToggle(subtask.id)}
                    className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                      subtask.status === 'completed'
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 hover:border-green-400'
                    }`}
                    disabled={loading}
                  >
                    {subtask.status === 'completed' && <Check size={12} className="text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${subtask.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {subtask.title}
                    </p>

                    {/* Time info row */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {/* Logged time */}
                      <span className={`flex items-center gap-1 text-xs font-medium ${isRunning ? 'text-blue-600' : 'text-gray-500'}`}>
                        <Clock size={11} className={isRunning ? 'animate-pulse' : ''} />
                        {formatDuration(liveSeconds)}
                        {isRunning && <span className="text-blue-400">running</span>}
                      </span>

                      {/* Estimate */}
                      {showEstimateInput[subtask.id] ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editEstimate[subtask.id] ?? ''}
                            onChange={e => setEditEstimate(prev => ({ ...prev, [subtask.id]: e.target.value }))}
                            placeholder="HH:MM"
                            className="input text-xs py-0 px-1 w-16"
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveEstimate(subtask)
                              if (e.key === 'Escape') setShowEstimateInput(prev => ({ ...prev, [subtask.id]: false }))
                            }}
                            autoFocus
                          />
                          <button onClick={() => handleSaveEstimate(subtask)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Save</button>
                          <button onClick={() => setShowEstimateInput(prev => ({ ...prev, [subtask.id]: false }))} className="text-xs text-gray-400 hover:text-gray-600">×</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setEditEstimate(prev => ({ ...prev, [subtask.id]: estimated > 0 ? formatToHhMm(estimated) : '' }))
                            setShowEstimateInput(prev => ({ ...prev, [subtask.id]: true }))
                          }}
                          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                        >
                          Est: {estimated > 0 ? formatDuration(estimated) : 'none'}
                        </button>
                      )}

                      {/* Progress bar (only if estimate set) */}
                      {estimated > 0 && (
                        <span className={`flex items-center gap-1 text-xs font-medium ${isOverlogged ? 'text-red-600' : 'text-gray-400'}`}>
                          {logProgress}%
                          {isOverlogged && ' (over)'}
                        </span>
                      )}

                      {subtask.assignee && (
                        <span className="text-xs text-gray-400">{subtask.assignee.name}</span>
                      )}
                    </div>

                    {/* Estimate progress bar */}
                    {estimated > 0 && (
                      <div className="mt-1 w-full bg-gray-100 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full transition-all duration-300 ${isOverlogged ? 'bg-red-400' : isRunning ? 'bg-blue-400' : 'bg-teal-500'}`}
                          style={{ width: `${Math.min(100, logProgress)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                    {/* Timer toggle */}
                    {isRunning ? (
                      <button
                        onClick={() => handleClockOut(subtask.id)}
                        className="p-1 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50"
                        title="Stop timer"
                      >
                        <Square size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleClockIn(subtask.id)}
                        className="p-1 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                        title="Start timer"
                      >
                        <Play size={13} />
                      </button>
                    )}

                    {/* Expand time logs */}
                    <button
                      onClick={() => toggleExpand(subtask.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-slate-100"
                      title={expanded ? 'Hide logs' : 'Show logs'}
                    >
                      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    {/* Delete subtask */}
                    <button
                      onClick={() => handleDelete(subtask.id)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded hover:bg-red-50"
                      title="Delete subtask"
                      disabled={loading}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded: time logs panel */}
                {expanded && (
                  <div className="bg-slate-50 border-t border-slate-100 px-3 pb-3 pt-2 ml-8">
                    {/* Manual log form toggle */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time Logs</span>
                      <button
                        onClick={() => setShowManualForm(prev => ({ ...prev, [subtask.id]: !prev[subtask.id] }))}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Plus size={11} />
                        {showManualForm[subtask.id] ? 'Cancel' : 'Log time'}
                      </button>
                    </div>

                    {/* Manual log form */}
                    {showManualForm[subtask.id] && (
                      <div className="bg-white border border-slate-200 rounded p-2 mb-2 space-y-2">
                        <div className="flex gap-2 flex-wrap">
                          <div className="flex flex-col gap-0.5">
                            <label className="text-xs text-gray-500">Date</label>
                            <input
                              type="date"
                              className="input text-xs py-1 w-32"
                              value={manualForm[subtask.id]?.date ?? ''}
                              onChange={e => setManualForm(prev => ({ ...prev, [subtask.id]: { ...prev[subtask.id], date: e.target.value } }))}
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-xs text-gray-500">Start</label>
                            <input
                              type="time"
                              className="input text-xs py-1 w-28"
                              value={manualForm[subtask.id]?.startTime ?? ''}
                              onChange={e => setManualForm(prev => ({ ...prev, [subtask.id]: { ...prev[subtask.id], startTime: e.target.value } }))}
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-xs text-gray-500">End</label>
                            <input
                              type="time"
                              className="input text-xs py-1 w-28"
                              value={manualForm[subtask.id]?.endTime ?? ''}
                              onChange={e => setManualForm(prev => ({ ...prev, [subtask.id]: { ...prev[subtask.id], endTime: e.target.value } }))}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleManualLog(subtask.id)}
                          className="btn btn-primary btn-sm text-xs"
                        >
                          Save Log
                        </button>
                      </div>
                    )}

                    {/* Log list */}
                    {ts?.loading ? (
                      <p className="text-xs text-gray-400 py-2">Loading...</p>
                    ) : !ts?.logs?.length ? (
                      <p className="text-xs text-gray-400 py-2">No time logs yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {ts.logs.map(log => (
                          <div key={log.id} className="group/log flex items-center gap-2 text-xs bg-white border border-slate-100 rounded px-2 py-1.5">
                            {editLog?.logId === log.id ? (
                              <div className="flex items-center gap-2 flex-1 flex-wrap">
                                <input
                                  type="datetime-local"
                                  className="input text-xs py-0.5 w-44"
                                  value={editLog.clockIn}
                                  onChange={e => setEditLog(prev => prev ? { ...prev, clockIn: e.target.value } : null)}
                                />
                                <span className="text-gray-400">→</span>
                                <input
                                  type="datetime-local"
                                  className="input text-xs py-0.5 w-44"
                                  value={editLog.clockOut}
                                  onChange={e => setEditLog(prev => prev ? { ...prev, clockOut: e.target.value } : null)}
                                />
                                <button onClick={() => handleSaveEditLog(subtask.id)} className="text-blue-600 hover:text-blue-800 font-medium">Save</button>
                                <button onClick={() => setEditLog(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                              </div>
                            ) : (
                              <>
                                <Clock size={11} className={log.clock_out ? 'text-gray-300' : 'text-blue-400 animate-pulse'} />
                                <span className="text-gray-500 flex-1">
                                  {formatLogTime(log.clock_in)}
                                  {log.clock_out ? ` → ${formatLogTime(log.clock_out)}` : ' (running)'}
                                </span>
                                <span className="font-medium text-gray-700">{formatDuration(log.duration_seconds)}</span>
                                {log.user?.name && <span className="text-gray-400">· {log.user.name}</span>}
                                <div className="flex items-center gap-1 opacity-0 group-hover/log:opacity-100 transition">
                                  {log.clock_out && (
                                    <button
                                      onClick={() => {
                                        const toLocal = (iso: string) => {
                                          const d = new Date(iso)
                                          const offset = d.getTimezoneOffset()
                                          return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16)
                                        }
                                        setEditLog({ logId: log.id, clockIn: toLocal(log.clock_in), clockOut: toLocal(log.clock_out!) })
                                      }}
                                      className="p-0.5 text-gray-300 hover:text-blue-500"
                                      title="Edit"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteLog(subtask.id, log.id)}
                                    className="p-0.5 text-gray-300 hover:text-red-500"
                                    title="Delete"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {totalCount > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
