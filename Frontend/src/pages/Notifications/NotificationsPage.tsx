import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Megaphone } from 'lucide-react'
import { toast } from 'react-toastify'
import { EmptyState, Loading, PageHeader } from '@/components/common'
import { useLocale } from '@/contexts/LocaleContext'
import { notificationService, teamService } from '@/services/api'

type PersonalNotification = {
  id: number
  title: string
  message?: string
  link?: string
  created_at: string
  read_at?: string | null
}

type Announcement = {
  id: number
  title: string
  content?: string
  created_at: string
  created_by?: { name?: string }
}

type FeedItem =
  | { kind: 'personal'; created_at: string; item: PersonalNotification }
  | { kind: 'announcement'; created_at: string; item: Announcement }

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { locale, t } = useLocale()
  const [personalNotifications, setPersonalNotifications] = useState<PersonalNotification[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([notificationService.list(), teamService.listAnnouncements()])
      .then(([notificationResponse, announcementResponse]) => {
        setPersonalNotifications(notificationResponse.data.data || [])
        setAnnouncements(announcementResponse.data.data || [])
      })
      .catch(() => toast.error(t('notifications.loadFailed', 'Failed to load notifications')))
      .finally(() => setLoading(false))
  }, [t])

  const feed = useMemo<FeedItem[]>(() => [
    ...personalNotifications.map(item => ({ kind: 'personal' as const, created_at: item.created_at, item })),
    ...announcements.map(item => ({ kind: 'announcement' as const, created_at: item.created_at, item })),
  ].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()), [announcements, personalNotifications])

  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

  const openPersonalNotification = async (item: PersonalNotification) => {
    if (!item.read_at) {
      try {
        await notificationService.markRead(item.id)
        setPersonalNotifications(current => current.map(notification => notification.id === item.id
          ? { ...notification, read_at: new Date().toISOString() }
          : notification))
      } catch {
        // Keep the destination accessible if updating read state fails.
      }
    }
    navigate(item.link || '/internal-project/projects')
  }

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead()
      const readAt = new Date().toISOString()
      setPersonalNotifications(current => current.map(item => ({ ...item, read_at: item.read_at || readAt })))
    } catch {
      toast.error(t('layout.notificationReadFailed', 'Failed to update notifications'))
    }
  }

  return (
    <div className="p-5">
      <PageHeader
        title={t('layout.notifications', 'Notifications')}
        actions={<button type="button" className="btn btn-secondary" onClick={() => void markAllRead()}>{t('layout.markAllRead', 'Mark all read')}</button>}
      />

      {loading ? <Loading /> : feed.length === 0 ? <EmptyState message={t('layout.noNotifications', 'No notifications available.')} /> : (
        <div className="space-y-3">
          {feed.map(entry => entry.kind === 'personal' ? (
            <button
              key={`notification-${entry.item.id}`}
              type="button"
              onClick={() => void openPersonalNotification(entry.item)}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-slate-50 ${entry.item.read_at ? 'border-gray-200 bg-white' : 'border-blue-100 bg-blue-50/40'}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Bell size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3"><span className="text-sm font-semibold text-gray-800">{entry.item.title}</span>{!entry.item.read_at && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />}</span>
                {entry.item.message && <span className="mt-1 block text-sm text-gray-500">{entry.item.message}</span>}
                <span className="mt-2 block text-xs text-gray-400">{formatDateTime(entry.item.created_at)}</span>
              </span>
            </button>
          ) : (
            <button
              key={`announcement-${entry.item.id}`}
              type="button"
              onClick={() => navigate('/team/announcements')}
              className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><Megaphone size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-gray-800">{entry.item.title}</span>
                {entry.item.content && <span className="mt-1 block text-sm text-gray-500">{entry.item.content}</span>}
                <span className="mt-2 block text-xs text-gray-400">{formatDateTime(entry.item.created_at)}{entry.item.created_by?.name ? ` · ${entry.item.created_by.name}` : ''}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
