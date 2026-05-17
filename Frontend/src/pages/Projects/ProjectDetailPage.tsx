import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { projectService, taskService, milestoneService, deliverableService, teamService } from '@/services/api'
import { toISODate } from '@/utils/format'
import { toast } from 'react-toastify'
import { ChevronLeft, Plus } from 'lucide-react'
import {
  Loading, EmptyState, StatusBadge, ProgressBar, Avatar,
  Modal, FormField, ConfirmDialog, ViewTabs, rowNumber
} from '@/components/common'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'timesheet', label: 'Timesheet' },
  { key: 'timeline', label: 'Timeline' },
]

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)
  const [project, setProject] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  // Milestones
  const [milestones, setMilestones] = useState<any[]>([])
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [editMilestone, setEditMilestone] = useState<any>(null)
  const [deleteMilestoneId, setDeleteMilestoneId] = useState<number | null>(null)
  const [milestoneForm, setMilestoneForm] = useState<any>({ name: '', description: '', due_date: '', status: 'pending', assignee_id: '' })

  // Deliverables
  const [deliverables, setDeliverables] = useState<any[]>([])
  const [showDeliverableModal, setShowDeliverableModal] = useState(false)
  const [editDeliverable, setEditDeliverable] = useState<any>(null)
  const [deleteDeliverableId, setDeleteDeliverableId] = useState<number | null>(null)
  const [deliverableForm, setDeliverableForm] = useState<any>({ name: '', description: '', due_date: '', status: 'draft' })

  // Timesheet
  const [timecards, setTimecards] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [deleteTaskId, setDeleteTaskId] = useState<number | null>(null)
  const [savingTask, setSavingTask] = useState(false)
  const [taskForm, setTaskForm] = useState<any>({
    title: '', status: 'todo', priority: 'medium', start_date: '', deadline: '', description: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const pRes = await projectService.get(projectId)
      setProject(pRes.data)

      const [tRes, tlRes, mRes, dRes, tcRes, membersRes] = await Promise.allSettled([
        projectService.getTasks(projectId),
        projectService.getTimeline(projectId),
        milestoneService.list(projectId),
        deliverableService.list(projectId),
        teamService.listTimeCards({ project_id: projectId }),
        teamService.listMembers({ limit: 200 }),
      ])

      setTasks(tRes.status === 'fulfilled' ? tRes.value.data.data || [] : [])
      setTimeline(tlRes.status === 'fulfilled' ? tlRes.value.data.data || [] : [])
      setMilestones(mRes.status === 'fulfilled' ? mRes.value.data.data || [] : [])
      setDeliverables(dRes.status === 'fulfilled' ? dRes.value.data.data || [] : [])
      setTimecards(tcRes.status === 'fulfilled' ? tcRes.value.data.data || [] : [])
      setMembers(membersRes.status === 'fulfilled' ? membersRes.value.data.data || [] : [])

      if ([tRes, tlRes, mRes, dRes, tcRes, membersRes].some(r => r.status === 'rejected')) {
        toast.warn('Project opened, but some related data failed to load')
      }
    } catch {
      setProject(null)
      toast.error('Failed to load project')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [projectId])

  // ── Milestone handlers ──────────────────────────────
  const openMilestoneModal = (m?: any) => {
    setEditMilestone(m || null)
    setMilestoneForm(m ? { name: m.name, description: m.description, due_date: m.due_date ? m.due_date.slice(0, 10) : '', status: m.status, assignee_id: m.assignee_id || '' } : { name: '', description: '', due_date: '', status: 'pending', assignee_id: '' })
    setShowMilestoneModal(true)
  }
  const handleSaveMilestone = async () => {
    if (!milestoneForm.name.trim()) { toast.error('Name is required'); return }
    const payload = { ...milestoneForm, assignee_id: milestoneForm.assignee_id ? Number(milestoneForm.assignee_id) : null }
    try {
      if (editMilestone) await milestoneService.update(projectId, editMilestone.id, payload)
      else await milestoneService.create(projectId, payload)
      toast.success('Saved')
      setShowMilestoneModal(false)
      const r = await milestoneService.list(projectId)
      setMilestones(r.data.data || [])
    } catch { toast.error('Failed to save') }
  }
  const handleDeleteMilestone = async () => {
    if (!deleteMilestoneId) return
    await milestoneService.delete(projectId, deleteMilestoneId)
    toast.success('Deleted')
    const r = await milestoneService.list(projectId)
    setMilestones(r.data.data || [])
  }

  // ── Deliverable handlers ────────────────────────────
  const openDeliverableModal = (d?: any) => {
    setEditDeliverable(d || null)
    setDeliverableForm(d ? { name: d.name, description: d.description, due_date: d.due_date ? d.due_date.slice(0, 10) : '', status: d.status } : { name: '', description: '', due_date: '', status: 'draft' })
    setShowDeliverableModal(true)
  }
  const handleSaveDeliverable = async () => {
    if (!deliverableForm.name.trim()) { toast.error('Name is required'); return }
    try {
      if (editDeliverable) await deliverableService.update(projectId, editDeliverable.id, deliverableForm)
      else await deliverableService.create(projectId, deliverableForm)
      toast.success('Saved')
      setShowDeliverableModal(false)
      const r = await deliverableService.list(projectId)
      setDeliverables(r.data.data || [])
    } catch { toast.error('Failed to save') }
  }
  const handleDeleteDeliverable = async () => {
    if (!deleteDeliverableId) return
    await deliverableService.delete(projectId, deleteDeliverableId)
    toast.success('Deleted')
    const r = await deliverableService.list(projectId)
    setDeliverables(r.data.data || [])
  }

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) { toast.error('Title is required'); return }
    setSavingTask(true)
    try {
      await taskService.create({ ...taskForm, project_id: projectId, start_date: toISODate(taskForm.start_date), deadline: toISODate(taskForm.deadline) })
      toast.success('Task created!')
      setShowTaskModal(false)
      setTaskForm({ title: '', status: 'todo', priority: 'medium', start_date: '', deadline: '', description: '' })
      const res = await projectService.getTasks(projectId)
      setTasks(res.data.data || [])
    } catch { toast.error('Failed to create task') }
    finally { setSavingTask(false) }
  }

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return
    try {
      await taskService.delete(deleteTaskId)
      toast.success('Task deleted')
      const res = await projectService.getTasks(projectId)
      setTasks(res.data.data || [])
    } catch { toast.error('Failed to delete task') }
  }

  const priorityColor: Record<string, string> = {
    high: 'text-red-500', medium: 'text-yellow-500', low: 'text-green-500',
  }

  if (loading) return <div className="p-5"><Loading /></div>
  if (!project) return <div className="p-5"><EmptyState message="Project not found." /></div>

  const doneTasks = tasks.filter(t => t.status === 'done').length

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/projects" className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
          <ChevronLeft size={16} /> Projects
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{project.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{project.client?.name || 'No client'}</p>
            {project.description && <p className="text-sm text-gray-600 mt-2">{project.description}</p>}
          </div>
          <StatusBadge status={project.status} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">Price</p>
            <p className="text-sm font-medium">{project.currency} {Number(project.price).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Start Date</p>
            <p className="text-sm">{project.start_date ? new Date(project.start_date).toLocaleDateString('id') : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Deadline</p>
            <p className={`text-sm ${new Date(project.deadline) < new Date() && project.status !== 'completed' ? 'text-red-500' : ''}`}>
              {project.deadline ? new Date(project.deadline).toLocaleDateString('id') : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Progress</p>
            <div className="flex items-center gap-2 mt-1">
              <ProgressBar value={project.progress} className="w-20" />
              <span className="text-xs text-gray-500">{project.progress}%</span>
            </div>
          </div>
        </div>
        {project.members?.length > 0 && (
          <div className="mt-3 flex items-center gap-1">
            <p className="text-xs text-gray-400 mr-2">Members:</p>
            {project.members.map((m: any) => <Avatar key={m.id} name={m.name} />)}
          </div>
        )}
      </div>

      <ViewTabs tabs={TABS} active={tab} onChange={setTab} />

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Total Tasks</p>
            <p className="text-2xl font-semibold text-gray-900">{tasks.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Completed</p>
            <p className="text-2xl font-semibold text-green-600">{doneTasks}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Remaining</p>
            <p className="text-2xl font-semibold text-blue-600">{tasks.length - doneTasks}</p>
          </div>
        </div>
      )}

      {/* Tasks */}
      {tab === 'tasks' && (
        <div>
          <div className="flex justify-end mb-3">
            <button className="btn btn-primary" onClick={() => setShowTaskModal(true)}><Plus size={12} /> Add task</button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th className="w-16">No.</th><th>Title</th><th>Assigned To</th><th>Priority</th><th>Deadline</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {tasks.length === 0
                  ? <tr><td colSpan={7}><EmptyState /></td></tr>
                  : tasks.map((t, index) => (
                    <tr key={t.id}>
                      <td className="text-gray-400">{rowNumber(1, index, tasks.length || 1)}</td>
                      <td className="font-medium">{t.title}</td>
                      <td>
                        {t.assigned_to
                          ? <div className="flex items-center gap-1"><Avatar name={t.assigned_to.name} /><span className="text-xs text-gray-500">{t.assigned_to.name}</span></div>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td><span className={`text-xs font-medium capitalize ${priorityColor[t.priority] || ''}`}>{t.priority}</span></td>
                      <td className={`text-sm ${new Date(t.deadline) < new Date() && t.status !== 'done' ? 'text-red-500' : 'text-gray-400'}`}>
                        {t.deadline ? new Date(t.deadline).toLocaleDateString('id') : '-'}
                      </td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>
                        <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteTaskId(t.id)}>×</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Milestones */}
      {tab === 'milestones' && (
        <div>
          <div className="flex justify-end mb-3">
            <button className="btn btn-primary" onClick={() => openMilestoneModal()}><Plus size={12} /> Add Milestone</button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th className="w-16">No.</th><th>Name</th><th>Assignee</th><th>Due Date</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {milestones.length === 0
                  ? <tr><td colSpan={6}><EmptyState /></td></tr>
                  : milestones.map((m, index) => (
                    <tr key={m.id}>
                      <td className="text-gray-400">{rowNumber(1, index, milestones.length || 1)}</td>
                      <td>
                        <p className="font-medium text-gray-800">{m.name}</p>
                        {m.description && <p className="text-xs text-gray-400">{m.description}</p>}
                      </td>
                      <td>
                        {m.assignee
                          ? <div className="flex items-center gap-1"><Avatar name={m.assignee.name} /><span className="text-xs">{m.assignee.name}</span></div>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="text-sm text-gray-600">{m.due_date ? new Date(m.due_date).toLocaleDateString('id') : '—'}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.status === 'done' ? 'bg-green-100 text-green-700' :
                          m.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>{m.status === 'in_progress' ? 'In Progress' : m.status.charAt(0).toUpperCase() + m.status.slice(1)}</span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openMilestoneModal(m)}>Edit</button>
                          <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteMilestoneId(m.id)}>×</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deliverables */}
      {tab === 'deliverables' && (
        <div>
          <div className="flex justify-end mb-3">
            <button className="btn btn-primary" onClick={() => openDeliverableModal()}><Plus size={12} /> Add Deliverable</button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th className="w-16">No.</th><th>Name</th><th>Due Date</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {deliverables.length === 0
                  ? <tr><td colSpan={5}><EmptyState /></td></tr>
                  : deliverables.map((d, index) => (
                    <tr key={d.id}>
                      <td className="text-gray-400">{rowNumber(1, index, deliverables.length || 1)}</td>
                      <td>
                        <p className="font-medium text-gray-800">{d.name}</p>
                        {d.description && <p className="text-xs text-gray-400">{d.description}</p>}
                      </td>
                      <td className="text-sm text-gray-600">{d.due_date ? new Date(d.due_date).toLocaleDateString('id') : '—'}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          d.status === 'approved' ? 'bg-green-100 text-green-700' :
                          d.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>{d.status.charAt(0).toUpperCase() + d.status.slice(1)}</span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openDeliverableModal(d)}>Edit</button>
                          <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteDeliverableId(d.id)}>×</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timesheet */}
      {tab === 'timesheet' && (
        <div>
          {/* Summary per member */}
          {(() => {
            const summary = members.map(m => {
              const cards = timecards.filter(tc => tc.user_id === m.id)
              const totalHours = cards.reduce((s, tc) => s + (tc.duration || 0), 0)
              return { ...m, sessions: cards.length, totalHours }
            }).filter(m => m.sessions > 0)
            return summary.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 mb-5">
                {summary.map(m => (
                  <div key={m.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                    <Avatar name={m.name} />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.totalHours.toFixed(1)}h · {m.sessions} session{m.sessions > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null
          })()}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th className="w-16">No.</th><th>Member</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th className="text-right">Duration</th><th>Note</th></tr>
              </thead>
              <tbody>
                {timecards.length === 0
                  ? <tr><td colSpan={7}><EmptyState message="No timesheet entries for this project" /></td></tr>
                  : timecards.map((tc, index) => (
                    <tr key={tc.id}>
                      <td className="text-gray-400">{rowNumber(1, index, timecards.length || 1)}</td>
                      <td>
                        {tc.user ? <div className="flex items-center gap-1"><Avatar name={tc.user.name} /><span className="text-xs">{tc.user.name}</span></div> : '—'}
                      </td>
                      <td className="text-sm">{new Date(tc.in_date).toLocaleDateString('id')}</td>
                      <td className="text-sm">{new Date(tc.in_time).toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="text-sm">{tc.out_time ? new Date(tc.out_time).toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' }) : <span className="text-yellow-500">Active</span>}</td>
                      <td className="text-right text-sm font-medium">{tc.duration ? `${tc.duration.toFixed(1)}h` : '—'}</td>
                      <td className="text-sm text-gray-400">{tc.note || '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
              {timecards.length > 0 && (
                <tfoot className="bg-gray-50 font-semibold text-sm">
                  <tr>
                    <td colSpan={5}>Total</td>
                    <td className="text-right">{timecards.reduce((s, tc) => s + (tc.duration || 0), 0).toFixed(1)}h</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Timeline */}
      {tab === 'timeline' && (
        <div className="bg-white rounded-lg border border-gray-200">
          {timeline.length === 0
            ? <EmptyState />
            : (
              <div className="p-4">
                <div className="overflow-x-auto">
                  <GanttChart tasks={timeline} />
                </div>
              </div>
            )
          }
        </div>
      )}

      {/* Add Task Modal */}
      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title="Add Task" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddTask} disabled={savingTask}>{savingTask ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Title" required>
              <input className="input" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" />
            </FormField>
          </div>
          <FormField label="Status">
            <select className="input" value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </FormField>
          <FormField label="Priority">
            <select className="input" value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </FormField>
          <FormField label="Start Date">
            <input className="input" type="date" value={taskForm.start_date} onChange={e => setTaskForm({ ...taskForm, start_date: e.target.value })} />
          </FormField>
          <FormField label="Deadline">
            <input className="input" type="date" value={taskForm.deadline} onChange={e => setTaskForm({ ...taskForm, deadline: e.target.value })} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Description">
              <textarea className="input" rows={2} value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTaskId} onClose={() => setDeleteTaskId(null)} onConfirm={handleDeleteTask} />

      {/* Milestone Modal */}
      <Modal open={showMilestoneModal} onClose={() => setShowMilestoneModal(false)} title={editMilestone ? 'Edit Milestone' : 'Add Milestone'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowMilestoneModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSaveMilestone}>Save</button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Name" required>
              <input className="input" value={milestoneForm.name} onChange={e => setMilestoneForm({ ...milestoneForm, name: e.target.value })} placeholder="Milestone name" />
            </FormField>
          </div>
          <FormField label="Due Date">
            <input className="input" type="date" value={milestoneForm.due_date} onChange={e => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })} />
          </FormField>
          <FormField label="Status">
            <select className="input" value={milestoneForm.status} onChange={e => setMilestoneForm({ ...milestoneForm, status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </FormField>
          <div className="col-span-2">
            <FormField label="Assignee">
              <select className="input" value={milestoneForm.assignee_id} onChange={e => setMilestoneForm({ ...milestoneForm, assignee_id: e.target.value })}>
                <option value="">— No assignee —</option>
                {members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Description">
              <textarea className="input" rows={2} value={milestoneForm.description} onChange={e => setMilestoneForm({ ...milestoneForm, description: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteMilestoneId} onClose={() => setDeleteMilestoneId(null)} onConfirm={handleDeleteMilestone} />

      {/* Deliverable Modal */}
      <Modal open={showDeliverableModal} onClose={() => setShowDeliverableModal(false)} title={editDeliverable ? 'Edit Deliverable' : 'Add Deliverable'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowDeliverableModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSaveDeliverable}>Save</button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Name" required>
              <input className="input" value={deliverableForm.name} onChange={e => setDeliverableForm({ ...deliverableForm, name: e.target.value })} placeholder="Deliverable name" />
            </FormField>
          </div>
          <FormField label="Due Date">
            <input className="input" type="date" value={deliverableForm.due_date} onChange={e => setDeliverableForm({ ...deliverableForm, due_date: e.target.value })} />
          </FormField>
          <FormField label="Status">
            <select className="input" value={deliverableForm.status} onChange={e => setDeliverableForm({ ...deliverableForm, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
            </select>
          </FormField>
          <div className="col-span-2">
            <FormField label="Description">
              <textarea className="input" rows={2} value={deliverableForm.description} onChange={e => setDeliverableForm({ ...deliverableForm, description: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteDeliverableId} onClose={() => setDeleteDeliverableId(null)} onConfirm={handleDeleteDeliverable} />
    </div>
  )
}

function GanttChart({ tasks }: { tasks: any[] }) {
  const validTasks = tasks.filter(t => t.start_date && t.deadline)
  if (validTasks.length === 0) return <EmptyState />

  const dates = validTasks.flatMap(t => [new Date(t.start_date), new Date(t.deadline)])
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
  const totalDays = Math.max((maxDate.getTime() - minDate.getTime()) / 86400000, 1)

  const statusColors: Record<string, string> = {
    todo: 'bg-gray-300', in_progress: 'bg-blue-400', done: 'bg-green-400', expired: 'bg-red-400',
  }

  return (
    <div className="min-w-[600px]">
      <div className="text-xs text-gray-400 mb-2 flex justify-between">
        <span>{minDate.toLocaleDateString('id')}</span>
        <span>{maxDate.toLocaleDateString('id')}</span>
      </div>
      <div className="space-y-2">
        {validTasks.map(t => {
          const start = (new Date(t.start_date).getTime() - minDate.getTime()) / 86400000
          const duration = (new Date(t.deadline).getTime() - new Date(t.start_date).getTime()) / 86400000
          const left = (start / totalDays) * 100
          const width = Math.max((duration / totalDays) * 100, 2)
          return (
            <div key={t.id} className="flex items-center gap-3">
              <div className="w-32 text-xs text-gray-600 truncate flex-shrink-0">{t.title}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded relative">
                <div
                  className={`absolute h-full rounded text-[10px] text-white flex items-center px-1 truncate ${statusColors[t.status] || 'bg-blue-400'}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  {t.title}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
