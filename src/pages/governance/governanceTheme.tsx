import type { ReactNode } from 'react'
import { BellAlertIcon, ChatBubbleLeftRightIcon, DocumentTextIcon } from '@heroicons/react/20/solid'
import { isAxiosError } from 'axios'
import { GOVERNANCE_ITEM_TYPES, type GovernanceItemType, type GovernancePeriodRef } from '../../api/governance'
import type { IconTone } from '../../components/dashboard/DashboardCard'
import { CHART_COLORS } from '../../components/dashboard/chartTheme'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { periodRange } from '../../lib/dashboardFormat'

/**
 * The non-component half of the governance presentation (FR-HOM-001 to 003, FR-MFA-001 to
 * 003): one icon, tone and chart colour per record type, each type's status vocabulary, and
 * the shared request helpers. The components live in governanceUi.tsx.
 */

export const TYPE_STYLE: Record<GovernanceItemType, { icon: ReactNode; tone: IconTone; color: string; bar: string }> = {
  alert: { icon: <BellAlertIcon />, tone: 'info', color: CHART_COLORS.series1, bar: 'bg-chart-1' },
  inquiry: { icon: <ChatBubbleLeftRightIcon />, tone: 'accent', color: CHART_COLORS.series2, bar: 'bg-chart-2' },
  periodic_report: { icon: <DocumentTextIcon />, tone: 'success', color: CHART_COLORS.series3, bar: 'bg-chart-3' },
}

/** Each type's statuses in workflow order (CLAUDE.md Section 7; a report's is its timeliness). */
export const STATUS_ORDER: Record<GovernanceItemType, string[]> = {
  alert: ['new', 'assigned', 'acknowledged'],
  inquiry: ['draft', 'received', 'in_progress', 'pending_external_response', 'resolved', 'closed', 'cancelled'],
  periodic_report: ['submitted_on_time', 'submitted_late'],
}

export function isGovernanceType(value: string | null): value is GovernanceItemType {
  return value !== null && (GOVERNANCE_ITEM_TYPES as string[]).includes(value)
}

/** The plain-text label of a status, for selects and screen-reader text. */
export function useStatusLabel(): (type: GovernanceItemType, status: string) => string {
  const { t } = useI18n()
  return (type, status) => {
    const labels: Record<string, string> =
      type === 'alert' ? t.alerts.status : type === 'inquiry' ? t.inquiries.status : t.reports.complianceStatus
    return labels[status] ?? status.replace(/_/g, ' ')
  }
}

/** "Q2 2026 · Oct – Dec 2026", flagged when the quarter is still running. */
export function useQuarterLabel(): (period: GovernancePeriodRef) => string {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  return (period) => (period.is_partial ? t.governance.quarter.inProgress : t.governance.quarter.option)(period.label, periodRange(period, locale))
}

// --- Requests ------------------------------------------------------------------

export function errorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

/** Retry a network failure, never a refusal (403) or a missing record (404). */
export function retryUnlessRefused(failureCount: number, error: unknown): boolean {
  const status = errorStatus(error)
  return !(status !== undefined && status >= 400 && status < 500) && failureCount < 2
}
