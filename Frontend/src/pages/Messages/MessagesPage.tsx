import { FormEvent, useEffect, useMemo, useState } from 'react'
import { MessageSquare, RefreshCw, Search, Send, Users } from 'lucide-react'
import { messageService } from '@/services/api'

type User = {
  id: number
  name: string
  email: string
  job_title?: string
  role: string
}

type Presence = {
  status: 'online' | 'away' | 'offline'
  last_seen_at?: string
}

type ChatUser = {
  user: User
  presence: Presence
}

type Conversation = {
  id: number
  title: string
  type: string
  unread_count: number
  last_message?: Message
}

type Message = {
  id: number
  conversation_id: number
  sender_id: number
  body: string
  created_at: string
  sender?: User
}

const statusClass: Record<Presence['status'], string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  offline: 'bg-gray-300',
}

const statusLabel: Record<Presence['status'], string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
}

function getCurrentUserId() {
  const raw = localStorage.getItem('user') || sessionStorage.getItem('user')
  if (!raw) return 0
  try {
    return Number(JSON.parse(raw).id) || 0
  } catch {
    return 0
  }
}

function formatTime(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function MessagesPage() {
  const currentUserId = useMemo(() => getCurrentUserId(), [])
  const [users, setUsers] = useState<ChatUser[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(({ user }) =>
      [user.name, user.email, user.job_title].filter(Boolean).some((value) => value!.toLowerCase().includes(q))
    )
  }, [query, users])

  const loadSidebar = async () => {
    const [usersRes, conversationsRes] = await Promise.all([
      messageService.listUsers(),
      messageService.listConversations(),
    ])
    setUsers(usersRes.data.users || [])
    setConversations(conversationsRes.data.conversations || [])
  }

  const loadMessages = async (conversation: Conversation) => {
    setActiveConversation(conversation)
    const res = await messageService.listMessages(conversation.id)
    setMessages(res.data.messages || [])
    setConversations((items) =>
      items.map((item) => (item.id === conversation.id ? { ...item, unread_count: 0 } : item))
    )
  }

  const openDirect = async (userId: number) => {
    const res = await messageService.openDirectConversation(userId)
    const conversation = res.data.conversation
    await loadSidebar()
    await loadMessages(conversation)
  }

  const refresh = async () => {
    await messageService.heartbeat()
    await loadSidebar()
    if (activeConversation) {
      const res = await messageService.listMessages(activeConversation.id)
      setMessages(res.data.messages || [])
    }
  }

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!activeConversation || !body || sending) return
    setSending(true)
    try {
      const res = await messageService.sendMessage(activeConversation.id, body)
      setMessages((items) => [...items, res.data.message])
      setDraft('')
      await loadSidebar()
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const boot = async () => {
      setLoading(true)
      try {
        await messageService.heartbeat()
        if (mounted) await loadSidebar()
      } finally {
        if (mounted) setLoading(false)
      }
    }
    boot()
    const interval = window.setInterval(() => {
      refresh().catch(() => undefined)
    }, 15000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [activeConversation?.id])

  return (
    <div className="h-full min-h-[calc(100vh-88px)] bg-gray-50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="text-sm text-gray-500">Internal chat untuk user aktif di workspace.</p>
        </div>
        <button className="btn btn-secondary flex items-center gap-2" onClick={refresh}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="grid h-[calc(100vh-170px)] min-h-[560px] grid-cols-[320px_1fr] overflow-hidden rounded-lg border border-gray-200 bg-white">
        <aside className="flex min-h-0 flex-col border-r border-gray-200">
          <div className="border-b border-gray-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                className="input pl-9"
                placeholder="Search users"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Conversations
            </div>
            {conversations.length === 0 && (
              <div className="px-4 pb-4 text-sm text-gray-400">Belum ada percakapan.</div>
            )}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                  activeConversation?.id === conversation.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => loadMessages(conversation)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
                  <MessageSquare size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900">{conversation.title}</div>
                  <div className="truncate text-xs text-gray-500">
                    {conversation.last_message?.body || 'No messages yet'}
                  </div>
                </div>
                {conversation.unread_count > 0 && (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {conversation.unread_count}
                  </span>
                )}
              </button>
            ))}

            <div className="px-4 pb-2 pt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Active users
            </div>
            {loading && <div className="px-4 text-sm text-gray-400">Loading users...</div>}
            {filteredUsers.map(({ user, presence }) => (
              <button
                key={user.id}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                onClick={() => openDirect(user.id)}
              >
                <div className="relative h-10 w-10 shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-700">
                    {initials(user.name)}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${statusClass[presence.status]}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{user.name}</div>
                  <div className="truncate text-xs text-gray-500">
                    {statusLabel[presence.status]} · {user.job_title || user.email}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {activeConversation ? (
            <>
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <div>
                  <div className="font-semibold text-gray-900">{activeConversation.title}</div>
                  <div className="text-xs text-gray-500">Direct internal message</div>
                </div>
                <Users size={18} className="text-gray-400" />
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gray-50 px-5 py-4">
                {messages.length === 0 && (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">
                    Mulai percakapan dengan mengirim pesan pertama.
                  </div>
                )}
                {messages.map((message) => {
                  const mine = message.sender_id === currentUserId
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[68%] rounded-lg px-4 py-3 shadow-sm ${
                          mine ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-800'
                        }`}
                      >
                        {!mine && (
                          <div className="mb-1 text-xs font-semibold text-gray-500">{message.sender?.name}</div>
                        )}
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</div>
                        <div className={`mt-1 text-right text-[11px] ${mine ? 'text-blue-100' : 'text-gray-400'}`}>
                          {formatTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <form className="flex gap-3 border-t border-gray-200 p-4" onSubmit={sendMessage}>
                <input
                  className="input"
                  placeholder="Type a message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button className="btn btn-primary flex items-center gap-2" disabled={sending || !draft.trim()}>
                  <Send size={15} /> Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-50">
                <MessageSquare size={28} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Pilih user untuk mulai chat</p>
                <p className="mt-1 text-xs text-gray-400">Status online akan diperbarui otomatis saat user aktif.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
