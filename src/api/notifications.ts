import client, { backgroundHeaders, type ApiEnvelope, type BackgroundRequestOptions } from './client'

export interface Notification {
  id: string
  recipient_user_id: string
  trigger_type: string
  message: string
  link: string | null
  read_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Backend filter param is `read=0|1` (CLAUDE.md Section 12, Session 8's
 * NotificationController::index()), not `unread`; `read: 0` is how the unread feed is fetched.
 */
export interface ListNotificationsParams {
  read?: 0 | 1
}

export interface NotificationPage {
  items: Notification[]
  /** Every match, not just this page; the bell's badge count (FR-NOTIF-001). */
  total: number
}

/** GET /notifications — FR-NOTIF-001. The bell polls this, so it accepts `background`. */
export async function listNotifications(
  params: ListNotificationsParams = {},
  options?: BackgroundRequestOptions,
): Promise<NotificationPage> {
  const { data } = await client.get<ApiEnvelope<Notification[]>>('/notifications', {
    params,
    headers: backgroundHeaders(options),
  })
  return { items: data.data, total: data.meta?.total ?? data.data.length }
}

/** PATCH /notifications/{notification}/read — FR-NOTIF-004 */
export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await client.patch<ApiEnvelope<Notification>>(`/notifications/${id}/read`)
  return data.data
}

/** POST /notifications/mark-all-read — FR-NOTIF-004 */
export async function markAllNotificationsRead(): Promise<void> {
  await client.post('/notifications/mark-all-read')
}
