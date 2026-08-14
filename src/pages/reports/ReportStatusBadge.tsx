import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '../../components/Badge'
import type { PeriodicReportStatus } from '../../api/reports'
import en from '../../i18n/en'

/** CLAUDE.md Section 4 Rule 9: every status badge pairs colour with an icon and a text label. */
const STATUS_VARIANT: Record<PeriodicReportStatus, BadgeVariant> = {
  draft: 'neutral',
  submitted: 'success',
}

function DraftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.5-9.5a2.121 2.121 0 0 1 3 3L12 16l-4 1 1-4 9.5-9.5Z" />
    </svg>
  )
}

function SubmittedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  )
}

const STATUS_ICON: Record<PeriodicReportStatus, ReactNode> = {
  draft: <DraftIcon />,
  submitted: <SubmittedIcon />,
}

export function ReportStatusBadge({ status, testId }: { status: PeriodicReportStatus; testId?: string }) {
  return <Badge variant={STATUS_VARIANT[status]} icon={STATUS_ICON[status]} label={en.reports.status[status]} testId={testId} />
}

/**
 * CLAUDE.md Section 4 Rule 9/10: FR-RPT-016/BR-010 late flag. Amber (atrisk), never the
 * brand accent colour, with a warning icon — a distinct badge from ReportStatusBadge so a
 * late *submitted* report shows both "Submitted" and "Late" rather than one badge trying
 * to encode two independent facts.
 */
export function ReportLateBadge() {
  return (
    <Badge
      variant="atrisk"
      label={en.reports.list.lateLabel}
      icon={
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      }
    />
  )
}
