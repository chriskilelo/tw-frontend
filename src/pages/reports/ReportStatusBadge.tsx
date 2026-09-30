import type { ReactNode } from 'react'
import { CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, MinusCircleIcon, PencilSquareIcon } from '@heroicons/react/20/solid'
import { Badge, type BadgeVariant } from '../../components/Badge'
import type { PeriodicReport, PeriodicReportStatus, ReportComplianceStatus, SectionCompletion } from '../../api/reports'
import { useI18n } from '../../i18n/context'
import { COMPLIANCE_VARIANT } from './complianceTheme'

const ICON = 'size-3.5'

/** CLAUDE.md Section 4 Rule 9: every status badge pairs colour with an icon and a text label. */
const STATUS_VARIANT: Record<PeriodicReportStatus, BadgeVariant> = {
  draft: 'neutral',
  submitted: 'success',
}

const STATUS_ICON: Record<PeriodicReportStatus, ReactNode> = {
  draft: <PencilSquareIcon aria-hidden="true" className={ICON} />,
  submitted: <CheckCircleIcon aria-hidden="true" className={ICON} />,
}

export function ReportStatusBadge({ status, testId }: { status: PeriodicReportStatus; testId?: string }) {
  const { t } = useI18n()
  return <Badge variant={STATUS_VARIANT[status]} icon={STATUS_ICON[status]} label={t.reports.status[status]} testId={testId} />
}

/**
 * FR-RPT-016 / BR-010: a submitted report is on time or late (with the days overdue); a draft
 * past its deadline is overdue. Late is the amber at-risk colour, never the brand accent
 * (Rule 10); an overdue draft, still owed, is red. Nothing for a draft within its deadline.
 */
export function ReportTimelinessBadge({ report, testId }: { report: Pick<PeriodicReport, 'status' | 'is_late' | 'is_overdue' | 'days_overdue'>; testId?: string }) {
  const { t } = useI18n()
  const days = report.days_overdue ?? 0

  if (report.status === 'submitted') {
    return report.is_late ? (
      <Badge variant="atrisk" icon={<ExclamationTriangleIcon aria-hidden="true" className={ICON} />} label={t.reports.timeliness.late(days)} testId={testId} />
    ) : (
      <Badge variant="success" icon={<CheckCircleIcon aria-hidden="true" className={ICON} />} label={t.reports.timeliness.onTime} testId={testId} />
    )
  }

  return report.is_overdue ? (
    <Badge variant="danger" icon={<ClockIcon aria-hidden="true" className={ICON} />} label={t.reports.timeliness.overdue(days)} testId={testId} />
  ) : null
}

export function ComplianceStatusIcon({ status, className = ICON }: { status: ReportComplianceStatus; className?: string }) {
  switch (status) {
    case 'submitted_on_time':
      return <CheckCircleIcon aria-hidden="true" className={className} />
    case 'submitted_late':
      return <ExclamationTriangleIcon aria-hidden="true" className={className} />
    case 'draft_in_progress':
      return <PencilSquareIcon aria-hidden="true" className={className} />
    default:
      return <MinusCircleIcon aria-hidden="true" className={className} />
  }
}

/** FR-RPT-018's four states. */
export function ComplianceStatusBadge({ status }: { status: ReportComplianceStatus }) {
  const { t } = useI18n()
  return <Badge variant={COMPLIANCE_VARIANT[status]} icon={<ComplianceStatusIcon status={status} />} label={t.reports.complianceStatus[status]} />
}

/**
 * FR-RPT-013: an outline ring (empty), a half-filled ring (started) or a tick (complete). The
 * label is given to screen readers alongside the section title by the caller.
 */
export function CompletionMark({ state, className = 'size-5' }: { state: SectionCompletion; className?: string }) {
  if (state === 'complete') {
    return (
      <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-success text-white ${className}`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
        </svg>
      </span>
    )
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`shrink-0 ${state === 'started' ? 'text-info' : 'text-border-muted'} ${className}`}>
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {state === 'started' && <path d="M10 2.5a7.5 7.5 0 0 1 0 15Z" fill="currentColor" />}
    </svg>
  )
}
