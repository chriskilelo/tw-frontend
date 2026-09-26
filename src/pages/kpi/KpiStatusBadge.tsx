import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '../../components/Badge'
import type { PerformanceStatus } from '../../api/kpi'
import { useI18n } from '../../i18n/context'

/**
 * FR-KPI-008, CLAUDE.md Section 4 Rule 9/10: on_track is success green (#0F7A3D),
 * at_risk is --color-at-risk (#F59E0B, the `atrisk` badge variant) — deliberately NOT
 * the `accent` brand colour (#FCA311) — and below_target is danger red (#DC2626).
 * no_target/no_data (no target set yet, or no actual recorded for the cycle) render
 * neutral rather than any of the three performance colours, since neither is a
 * performance judgement.
 */
const STATUS_VARIANT: Record<PerformanceStatus, BadgeVariant> = {
  on_track: 'success',
  at_risk: 'atrisk',
  below_target: 'danger',
  no_target: 'neutral',
  no_data: 'neutral',
}

function OnTrackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  )
}

function AtRiskIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}

function BelowTargetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function NoDataIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <circle cx={12} cy={12} r={9} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7m0 2.5h.01" />
    </svg>
  )
}

const STATUS_ICON: Record<PerformanceStatus, ReactNode> = {
  on_track: <OnTrackIcon />,
  at_risk: <AtRiskIcon />,
  below_target: <BelowTargetIcon />,
  no_target: <NoDataIcon />,
  no_data: <NoDataIcon />,
}

export function KpiStatusBadge({ status, testId }: { status: PerformanceStatus; testId?: string }) {
  const { t } = useI18n()
  return (
    <Badge variant={STATUS_VARIANT[status]} icon={STATUS_ICON[status]} label={t.kpi.status[status]} testId={testId} />
  )
}
