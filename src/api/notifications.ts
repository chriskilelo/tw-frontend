import client, { type ApiEnvelope } from './client'

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

export async function listNotifications(params: ListNotificationsParams = {}): Promise<Notification[]> {
  const { data } = await client.get<ApiEnvelope<Notification[]>>('/notifications', { params })
  return data.data
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
