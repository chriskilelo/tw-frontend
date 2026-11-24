import { CloseButton, Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
  type NotificationPage,
} from '../api/notifications'
import { useI18n } from '../i18n/context'
import { formatRelativeTime, localeFor } from '../lib/formatters'

const NOTIFICATIONS_QUERY_KEY = ['notifications', 'unread'] as const
const POLL_INTERVAL_MS = 60_000
const DROPDOWN_LIMIT = 5

/** Only in-app paths are followed; a notification link is never sent off-site. */
function isInAppPath(link: string | null): link is string {
  return link !== null && link.startsWith('/') && !link.startsWith('//')
}

/**
 * FR-NOTIF-001/003/004: unread badge count, the latest 5 unread notifications, each
 * opening its record (and marking itself read), and mark-all-read. Polls every 60s as a
 * background request, so an untouched tab does not count as activity (FR-AUTH-010).
 */
export function NotificationBell() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const queryClient = useQueryClient()

  const { data } = useQuery<NotificationPage>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => listNotifications({ read: 0 }, { background: true }),
    refetchInterval: POLL_INTERVAL_MS,
  })

  const notifications = data?.items ?? []
  const unreadCount = data?.total ?? 0
  const shown = notifications.slice(0, DROPDOWN_LIMIT)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    refresh()
  }

  function handleOpen(notification: Notification) {
    // Navigation goes ahead whether or not this succeeds; the next poll corrects the badge.
    markNotificationRead(notification.id).then(refresh, refresh)
  }

  return (
    <Popover className="relative">
      <PopoverButton
        aria-label={unreadCount > 0 ? `${t.notifications.title}, ${t.notifications.unreadCount(unreadCount)}` : t.notifications.title}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-primary-light"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-danger px-1 text-caption font-semibold text-danger-text"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-white shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <span className="block text-h4 text-primary">{t.notifications.title}</span>
            {unreadCount > 0 && (
              <span className="block text-caption text-text-secondary">{t.notifications.unreadCount(unreadCount)}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="shrink-0 text-caption font-semibold text-accent-soft-text hover:underline"
            >
              {t.notifications.markAllRead}
            </button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {shown.length === 0 ? (
            <li className="px-4 py-6 text-center text-body-sm text-text-muted">{t.notifications.empty}</li>
          ) : (
            shown.map((notification) => {
              const body = (
                <>
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-info" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm text-text-primary">{notification.message}</span>
                    <span className="mt-0.5 block text-caption text-text-secondary">
                      {formatRelativeTime(notification.created_at, locale)}
                    </span>
                  </span>
                </>
              )
              const rowClass =
                'flex w-full gap-3 px-4 py-3 text-left hover:bg-page-bg focus-visible:bg-page-bg focus-visible:outline-none'

              return (
                <li key={notification.id} className="border-b border-border last:border-b-0">
                  {isInAppPath(notification.link) ? (
                    <CloseButton
                      as={Link}
                      to={notification.link}
                      onClick={() => handleOpen(notification)}
                      className={rowClass}
                    >
                      {body}
                      <ChevronIcon />
                    </CloseButton>
                  ) : (
                    <div className="flex gap-3 px-4 py-3">
                      {body}
                      <button
                        type="button"
                        onClick={() => handleOpen(notification)}
                        className="shrink-0 self-start text-caption font-semibold text-accent-soft-text hover:underline"
                      >
                        {t.notifications.markRead}
                      </button>
                    </div>
                  )}
                </li>
              )
            })
          )}
        </ul>
        {unreadCount > shown.length && shown.length > 0 && (
          <p className="border-t border-border px-4 py-2 text-caption text-text-secondary">
            {t.notifications.showingLatest(shown.length, unreadCount)}
          </p>
        )}
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

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="mt-1 size-4 shrink-0 text-text-muted">
      <path
        fillRule="evenodd"
        d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}
