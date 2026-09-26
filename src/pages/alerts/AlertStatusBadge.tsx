import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '../../components/Badge'
import type { AlertStatus } from '../../api/alerts'
import { useI18n } from '../../i18n/context'

/**
 * CLAUDE.md Section 4 Rule 9: every status badge pairs colour with an icon
 * and a text label. Colours match the session spec exactly: new = amber
 * (--color-at-risk, #F59E0B), assigned = blue (--color-info, #2563EB),
 * acknowledged = green (--color-success, #0F7A3D). Reusing the `atrisk`
 * badge variant here is a colour match only — this is an alert workflow
 * state, not the KPI "at risk" state Section 13/Rule 10 guards against
 * reusing `accent` for.
 */
const STATUS_VARIANT: Record<AlertStatus, BadgeVariant> = {
  new: 'atrisk',
  assigned: 'info',
  acknowledged: 'success',
}

function NewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}

function AssignedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8m0 0-3-3m3 3-3 3M4 5h16v14H4z" />
    </svg>
  )
}

function AcknowledgedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  )
}

const STATUS_ICON: Record<AlertStatus, ReactNode> = {
  new: <NewIcon />,
  assigned: <AssignedIcon />,
  acknowledged: <AcknowledgedIcon />,
}

export function AlertStatusBadge({ status, testId }: { status: AlertStatus; testId?: string }) {
  const { t } = useI18n()
  return <Badge variant={STATUS_VARIANT[status]} icon={STATUS_ICON[status]} label={t.alerts.status[status]} testId={testId} />
}
