import { useState } from 'react'
import { Check, Plus, X, GripVertical, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'

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
}

type SubtaskListProps = {
  subtasks: Subtask[]
  onToggle: (subtaskId: number) => Promise<void>
  onAdd: (title: string) => Promise<void>
  onDelete: (subtaskId: number) => Promise<void>
  onRefresh: () => Promise<void>
  loading?: boolean
}

export default function SubtaskList({
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

  const completedCount = subtasks.filter(s => s.status === 'completed').length
  const totalCount = subtasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

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
              <button
                onClick={handleAdd}
                disabled={adding || !newSubtaskTitle.trim()}
                className="btn btn-primary btn-sm"
              >
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
          subtasks.map(subtask => (
            <div
              key={subtask.id}
              className="flex items-center gap-3 p-3 hover:bg-slate-50 transition group"
            >
              <button
                onClick={() => handleToggle(subtask.id)}
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                  subtask.status === 'completed'
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 hover:border-green-400'
                }`}
                disabled={loading}
              >
                {subtask.status === 'completed' && <Check size={12} className="text-white" />}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm transition ${
                    subtask.status === 'completed'
                      ? 'line-through text-gray-400'
                      : 'text-gray-700'
                  }`}
                >
                  {subtask.title}
                </p>
                {subtask.assignee && (
                  <p className="text-xs text-gray-400 mt-0.5">{subtask.assignee.name}</p>
                )}
              </div>

              <button
                onClick={() => handleDelete(subtask.id)}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition"
                disabled={loading}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
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
