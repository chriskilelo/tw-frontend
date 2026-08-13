import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listNotifications, markAllNotificationsRead, type Notification } from '../api/notifications'
import { useI18n } from '../i18n/context'

const NOTIFICATIONS_QUERY_KEY = ['notifications', 'unread'] as const
const POLL_INTERVAL_MS = 60_000
const DROPDOWN_LIMIT = 5

/** FR-NOTIF-001/004: unread badge count, last 5 notifications, mark-all-read. Polls every 60s. */
export function NotificationBell() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => listNotifications({ read: 0 }),
    refetchInterval: POLL_INTERVAL_MS,
  })

  const unreadCount = notifications.length

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
  }

  return (
    <Popover className="relative">
      <PopoverButton
        aria-label={t.notifications.title}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-primary-light"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-danger px-1 text-caption font-semibold text-danger-text">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-50 mt-2 w-80 rounded-lg border border-border bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-h4 text-primary">{t.notifications.title}</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-caption font-semibold text-accent-soft-text hover:underline"
            >
              {t.notifications.markAllRead}
            </button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <li className="px-4 py-6 text-center text-body-sm text-text-muted">{t.notifications.empty}</li>
          ) : (
            notifications.slice(0, DROPDOWN_LIMIT).map((notification) => (
              <li key={notification.id} className="border-b border-border px-4 py-3 last:border-b-0">
                <p className="text-body-sm text-text-primary">{notification.message}</p>
                <p className="mt-1 text-caption text-text-muted">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>
      </PopoverPanel>
    </Popover>
  )
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      />
    </svg>
  )
}
