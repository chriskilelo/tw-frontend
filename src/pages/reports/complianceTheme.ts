import type { BadgeVariant } from '../../components/Badge'
import { CHART_COLORS, hatchBackground } from '../../components/dashboard/chartTheme'
import type { ReportComplianceStatus } from '../../api/reports'

/** FR-RPT-018 is "updating in real time as reports are submitted": the board re-polls. */
export const LIVE_REFRESH_MS = 30000

export const COMPLIANCE_STATUSES: ReportComplianceStatus[] = ['submitted_on_time', 'submitted_late', 'draft_in_progress', 'not_started']

/**
 * Status marks, validated with the dataviz palette check (green, amber, blue, gray: normal
 * vision ΔE ≥ 19 and CVD ΔE ≥ 8.4 between neighbours). Not started is the neutral "nothing
 * yet" gray, always hatched, and like every status it also carries its icon and label.
 */
export const COMPLIANCE_COLORS: Record<ReportComplianceStatus, string> = {
  submitted_on_time: CHART_COLORS.onTrack,
  submitted_late: CHART_COLORS.atRisk,
  draft_in_progress: '#2563eb',
  not_started: CHART_COLORS.none,
}

/** Rule 9/10: late is the amber at-risk tone, never the brand accent. */
export const COMPLIANCE_VARIANT: Record<ReportComplianceStatus, BadgeVariant> = {
  submitted_on_time: 'success',
  submitted_late: 'atrisk',
  draft_in_progress: 'info',
  not_started: 'neutral',
}

export function markBackground(status: ReportComplianceStatus): string {
  return status === 'not_started' ? hatchBackground(COMPLIANCE_COLORS.not_started) : COMPLIANCE_COLORS[status]
}
