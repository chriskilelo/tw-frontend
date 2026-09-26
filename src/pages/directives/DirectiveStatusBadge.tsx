import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '../../components/Badge'
import type { DirectiveStatus } from '../../api/directives'
import { useI18n } from '../../i18n/context'

/** CLAUDE.md Section 4 Rule 9: every status badge pairs colour with an icon and a text label. */
const STATUS_VARIANT: Record<DirectiveStatus, BadgeVariant> = {
  draft: 'neutral',
  issued: 'info',
  acknowledged: 'directive',
  in_progress: 'accent',
  completed: 'success',
  cancelled: 'danger',
  closed: 'neutral',
}

function DraftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.5-9.5a2.121 2.121 0 0 1 3 3L12 16l-4 1 1-4 9.5-9.5Z" />
    </svg>
  )
}

function IssuedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
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

function InProgressIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <circle cx={12} cy={12} r={9} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  )
}

function CompletedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <circle cx={12} cy={12} r={9} />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 3 3 5-6" />
    </svg>
  )
}

function CancelledIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <circle cx={12} cy={12} r={9} />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 6 6m0-6-6 6" />
    </svg>
  )
}

function ClosedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <rect x={5} y={11} width={14} height={9} rx={2} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

const STATUS_ICON: Record<DirectiveStatus, ReactNode> = {
  draft: <DraftIcon />,
  issued: <IssuedIcon />,
  acknowledged: <AcknowledgedIcon />,
  in_progress: <InProgressIcon />,
  completed: <CompletedIcon />,
  cancelled: <CancelledIcon />,
  closed: <ClosedIcon />,
}

export function DirectiveStatusBadge({ status }: { status: DirectiveStatus }) {
  const { t } = useI18n()
  return <Badge variant={STATUS_VARIANT[status]} icon={STATUS_ICON[status]} label={t.directives.status[status]} />
}

/**
 * FR-DIR-010 / CLAUDE.md Section 4 Rule 9/10: amber (atrisk), never the brand accent colour,
 * with a warning icon — for an in_progress directive with no progress update in 14+ days.
 * A distinct badge from DirectiveStatusBadge, matching ReportLateBadge's precedent, so a
 * stale in-progress directive shows both "In Progress" and "Stale" rather than one badge
 * trying to encode two independent facts.
 */
export function DirectiveStaleBadge() {
  const { t } = useI18n()
  return (
    <Badge
      variant="atrisk"
      label={t.directives.list.staleLabel}
      icon={
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      }
    />
  )
}
