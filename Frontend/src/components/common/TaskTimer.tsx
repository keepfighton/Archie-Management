import { useEffect, useState } from 'react'
import { Play, Square, Clock, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'

type TimeLog = {
  id: number
  task_id: number
  user_id: number
  clock_in: string
  clock_out: string | null
  duration_seconds: number
  user?: { id: number; name: string }
}

type TaskTimerProps = {
  taskId: number
  activeLog?: TimeLog | null
  onClockIn: () => Promise<void>
  onClockOut: () => Promise<void>
  onRefresh?: () => Promise<void>
  compact?: boolean
  disabled?: boolean
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs.toString().padStart(2, '0')}s`
  }
  return `${secs}s`
}

export default function TaskTimer({
  taskId,
  activeLog,
  onClockIn,
  onClockOut,
  onRefresh,
  compact = false,
  disabled = false
}: TaskTimerProps) {
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Calculate elapsed time
  useEffect(() => {
    if (!activeLog) {
      setElapsed(0)
      return
    }

    const updateElapsed = () => {
      const start = new Date(activeLog.clock_in).getTime()
      const now = new Date().getTime()
      const seconds = Math.floor((now - start) / 1000)
      setElapsed(seconds)
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [activeLog])

  const handleClockIn = async () => {
    setLoading(true)
    try {
      await onClockIn()
      if (onRefresh) await onRefresh()
      toast.success('Timer started')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to start timer')
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = async () => {
    setLoading(true)
    try {
      await onClockOut()
      if (onRefresh) await onRefresh()
      toast.success('Timer stopped')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to stop timer')
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {activeLog ? (
          <>
            <div className="flex items-center gap-1.5 text-green-600">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-mono text-sm font-semibold">{formatDuration(elapsed)}</span>
            </div>
            <button
              onClick={handleClockOut}
              disabled={loading || disabled}
              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Stop timer"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            </button>
          </>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={loading || disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>Start</span>
              </>
            )}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Clock className="h-5 w-5" />
          <span className="font-semibold">Time Tracking</span>
        </div>
        {activeLog && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Active
          </span>
        )}
      </div>

      {activeLog ? (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-xs text-green-700 mb-1">Started at</div>
            <div className="text-sm text-green-900 font-medium mb-2">
              {new Date(activeLog.clock_in).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div className="text-2xl font-mono font-bold text-green-600">
              {formatDuration(elapsed)}
            </div>
          </div>
          <button
            onClick={handleClockOut}
            disabled={loading || disabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Square className="h-5 w-5" />
                <span>Stop Timer</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <button
          onClick={handleClockIn}
          disabled={loading || disabled}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Play className="h-5 w-5" />
              <span>Start Timer</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
