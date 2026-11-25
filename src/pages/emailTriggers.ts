/**
 * The optional emails each role can receive, in the order the profile lists them (FR-NOTIF-006).
 * Mirrors who NotificationService's callers notify in tw-backend. Emails about the account itself
 * (a lock, an unlock) and about a change of role (Acting PS, Designated Deputy) are always sent
 * and are not listed. A role not listed here receives no optional emails.
 */
export const EMAIL_TRIGGERS = [
  'alert_routed',
  'alert_feedback_posted',
  'directive_issued',
  'directive_revised',
  'directive_follow_up',
  'directive_status_changed',
  'directive_due_reminder',
  'directive_stale',
  'report_deadline_reminder',
  'report_overdue',
  'report_submitted',
  'report_received',
  'inquiry_hq_notified',
  'approval_requested',
  'approval_decided',
] as const

export type EmailTrigger = (typeof EMAIL_TRIGGERS)[number]

const LEADERSHIP: EmailTrigger[] = ['alert_routed', 'alert_feedback_posted', 'report_received', 'directive_status_changed', 'directive_stale']

export const EMAIL_TRIGGERS_BY_ROLE: Record<string, EmailTrigger[]> = {
  'Ministry Attache': [
    'directive_issued',
    'directive_revised',
    'directive_follow_up',
    'directive_status_changed',
    'directive_due_reminder',
    'directive_stale',
    'report_deadline_reminder',
    'report_overdue',
    'report_submitted',
    'alert_feedback_posted',
  ],
  'Ministry HQ Officer': ['alert_routed', 'alert_feedback_posted', 'inquiry_hq_notified', 'report_received', 'directive_status_changed', 'directive_stale'],
  'Ministry HQ Director': ['alert_routed', 'alert_feedback_posted', 'report_received'],
  'Ministry PS': LEADERSHIP,
  'Acting PS': LEADERSHIP,
  'Ministry Publishing Authority': ['alert_routed', 'alert_feedback_posted'],
  'Designated Deputy': ['alert_routed', 'alert_feedback_posted'],
  'System Administrator': ['approval_requested'],
  'Ministry Administrator': ['approval_decided'],
}
