import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileText, Link2, MessageSquare, Paperclip, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'react-toastify'
import { fileService, internalProjectService } from '@/services/api'

type UserSummary = { id: number; name: string; email?: string }
type ProjectMember = { user_id: number; user?: UserSummary }
type Mention = { id: number; user_id: number; user?: UserSummary }
type Comment = { id: number; user_id: number; body: string; created_at: string; user?: UserSummary; mentions?: Mention[] }
type StoredFile = { id: number; name: string; size: number; mime_type: string }
type Attachment = { id: number; uploaded_by_id: number; created_at: string; file?: StoredFile; uploaded_by?: UserSummary }
type ReferenceLink = { id: number; title: string; url: string; created_by_id: number; created_at: string; created_by?: UserSummary }
type Activity = { id: number; action: string; description: string; created_at: string; user?: UserSummary }

type Props = {
  taskId: number
  members: ProjectMember[]
  currentUserId?: number
  canManageProject: boolean
  locale: string
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function TaskCollaboration({ taskId, members, currentUserId, canManageProject, locale }: Props) {
  const [section, setSection] = useState<'comments' | 'files' | 'activity'>('comments')
  const [comments, setComments] = useState<Comment[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [links, setLinks] = useState<ReferenceLink[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([])
  const [linkForm, setLinkForm] = useState({ title: '', url: '' })

  const loadAll = async () => {
    setLoading(true)
    try {
      const [commentResponse, attachmentResponse, linkResponse, activityResponse] = await Promise.all([
        internalProjectService.listTaskComments(taskId),
        internalProjectService.listTaskAttachments(taskId),
        internalProjectService.listTaskLinks(taskId),
        internalProjectService.listTaskActivities(taskId),
      ])
      setComments(commentResponse.data.data || [])
      setAttachments(attachmentResponse.data.data || [])
      setLinks(linkResponse.data.data || [])
      setActivities(activityResponse.data.data || [])
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load task collaboration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadAll() }, [taskId])

  const mentionMember = (member: ProjectMember) => {
    if (!member.user || mentionedUserIds.includes(member.user_id)) return
    setCommentBody(current => `${current}${current && !current.endsWith(' ') ? ' ' : ''}@${member.user?.name} `)
    setMentionedUserIds(current => [...current, member.user_id])
  }

  const addComment = async () => {
    if (!commentBody.trim()) return
    setSaving(true)
    try {
      await internalProjectService.createTaskComment(taskId, {
        body: commentBody.trim(), mentioned_user_ids: mentionedUserIds,
      })
      setCommentBody('')
      setMentionedUserIds([])
      await loadAll()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add comment')
    } finally {
      setSaving(false)
    }
  }

  const deleteComment = async (commentId: number) => {
    if (!confirm('Delete this comment?')) return
    await internalProjectService.deleteTaskComment(taskId, commentId)
    await loadAll()
  }

  const uploadAttachment = async (file?: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Maximum attachment size is 10 MB')
      return
    }
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadResponse = await fileService.upload(formData)
      await internalProjectService.createTaskAttachment(taskId, uploadResponse.data.id)
      await loadAll()
      toast.success('Attachment uploaded')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to upload attachment')
    } finally {
      setSaving(false)
    }
  }

  const openFile = async (attachment: Attachment, download: boolean) => {
    if (!attachment.file) return
    try {
      const response = await fileService.download(attachment.file.id)
      const objectURL = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = objectURL
      if (download) anchor.download = attachment.file.name
      else anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(objectURL), 60_000)
    } catch {
      toast.error('Failed to open attachment')
    }
  }

  const deleteAttachment = async (attachmentId: number) => {
    if (!confirm('Remove this attachment from the task?')) return
    await internalProjectService.deleteTaskAttachment(taskId, attachmentId)
    await loadAll()
  }

  const addLink = async () => {
    if (!linkForm.title.trim() || !linkForm.url.trim()) return
    setSaving(true)
    try {
      await internalProjectService.createTaskLink(taskId, {
        title: linkForm.title.trim(), url: linkForm.url.trim(),
      })
      setLinkForm({ title: '', url: '' })
      await loadAll()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add reference link')
    } finally {
      setSaving(false)
    }
  }

  const deleteLink = async (linkId: number) => {
    if (!confirm('Delete this reference link?')) return
    await internalProjectService.deleteTaskLink(taskId, linkId)
    await loadAll()
  }

  const tabs = [
    { key: 'comments' as const, label: `Comments (${comments.length})`, icon: MessageSquare },
    { key: 'files' as const, label: `Files & Links (${attachments.length + links.length})`, icon: Paperclip },
    { key: 'activity' as const, label: 'Activity', icon: FileText },
  ]

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Loading collaboration...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-1.5">
        {tabs.map(tab => <button key={tab.key} onClick={() => setSection(tab.key)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${section === tab.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><tab.icon size={14} />{tab.label}</button>)}
      </div>

      {section === 'comments' && <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 p-3">
          <textarea className="input min-h-24 resize-y" value={commentBody} onChange={event => setCommentBody(event.target.value)} placeholder="Write a comment or mention a project member..." />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400">Mention:</span>
            {members.filter(member => member.user_id !== currentUserId).map(member => <button key={member.user_id} type="button" onClick={() => mentionMember(member)} disabled={mentionedUserIds.includes(member.user_id)} className={`rounded-full px-2 py-1 text-xs ${mentionedUserIds.includes(member.user_id) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`}>@{member.user?.name || member.user_id}</button>)}
          </div>
          <div className="mt-3 flex justify-end"><button className="btn btn-primary btn-sm" disabled={saving || !commentBody.trim()} onClick={addComment}><Plus size={14} /> Add comment</button></div>
        </div>
        {comments.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">No comments yet.</div> : <div className="max-h-80 space-y-3 overflow-y-auto pr-1">{comments.map(comment => <div key={comment.id} className="rounded-xl border border-gray-100 bg-white p-3">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-gray-700">{comment.user?.name || `User #${comment.user_id}`}</p><p className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString(locale)}</p></div>{(canManageProject || comment.user_id === currentUserId) && <button className="text-gray-300 hover:text-red-500" onClick={() => deleteComment(comment.id)}><Trash2 size={14} /></button>}</div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{comment.body}</p>
          {!!comment.mentions?.length && <div className="mt-2 flex flex-wrap gap-1">{comment.mentions.map(mention => <span key={mention.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">@{mention.user?.name || mention.user_id}</span>)}</div>}
        </div>)}</div>}
      </div>}

      {section === 'files' && <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-gray-700">Attachments</h3><p className="text-xs text-gray-400">Maximum 10 MB per file</p></div><label className="btn btn-secondary btn-sm cursor-pointer"><Upload size={14} /> Upload<input type="file" className="hidden" disabled={saving} onChange={event => { void uploadAttachment(event.target.files?.[0]); event.currentTarget.value = '' }} /></label></div>
          {attachments.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">No attachments yet.</div> : <div className="space-y-2">{attachments.map(attachment => <div key={attachment.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><FileText size={18} className="shrink-0 text-blue-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-700">{attachment.file?.name}</p><p className="text-xs text-gray-400">{formatSize(attachment.file?.size)} · {attachment.uploaded_by?.name || 'Unknown'}</p></div><button title="Preview" className="text-gray-400 hover:text-blue-600" onClick={() => openFile(attachment, false)}><ExternalLink size={15} /></button><button title="Download" className="text-gray-400 hover:text-blue-600" onClick={() => openFile(attachment, true)}><Download size={15} /></button>{(canManageProject || attachment.uploaded_by_id === currentUserId) && <button className="text-gray-300 hover:text-red-500" onClick={() => deleteAttachment(attachment.id)}><Trash2 size={15} /></button>}</div>)}</div>}
        </section>
        <section className="rounded-xl border border-gray-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Reference Links</h3>
          <div className="space-y-2"><input className="input" placeholder="Link title" value={linkForm.title} onChange={event => setLinkForm(current => ({ ...current, title: event.target.value }))} /><div className="flex gap-2"><input className="input flex-1" placeholder="https://..." value={linkForm.url} onChange={event => setLinkForm(current => ({ ...current, url: event.target.value }))} /><button className="btn btn-primary btn-sm" disabled={saving || !linkForm.title.trim() || !linkForm.url.trim()} onClick={addLink}><Plus size={14} /></button></div></div>
          <div className="mt-4 space-y-2">{links.length === 0 ? <div className="py-6 text-center text-sm text-gray-400">No reference links yet.</div> : links.map(link => <div key={link.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><Link2 size={17} className="shrink-0 text-indigo-500" /><a className="min-w-0 flex-1" href={link.url} target="_blank" rel="noopener noreferrer"><p className="truncate text-sm font-medium text-gray-700 hover:text-primary">{link.title}</p><p className="truncate text-xs text-gray-400">{link.url}</p></a>{(canManageProject || link.created_by_id === currentUserId) && <button className="text-gray-300 hover:text-red-500" onClick={() => deleteLink(link.id)}><Trash2 size={15} /></button>}</div>)}</div>
        </section>
      </div>}

      {section === 'activity' && <div className="max-h-96 space-y-0 overflow-y-auto rounded-xl border border-gray-200 px-4">{activities.length === 0 ? <div className="py-10 text-center text-sm text-gray-400">No activity recorded yet.</div> : activities.map(activity => <div key={activity.id} className="relative border-l border-gray-200 py-3 pl-5 before:absolute before:-left-1.5 before:top-5 before:h-3 before:w-3 before:rounded-full before:border-2 before:border-white before:bg-blue-500"><p className="text-sm text-gray-700"><span className="font-semibold">{activity.user?.name || 'User'}</span> {activity.description.toLowerCase()}</p><p className="mt-0.5 text-xs text-gray-400">{new Date(activity.created_at).toLocaleString(locale)}</p></div>)}</div>}
    </div>
  )
}
