import type { ReactNode } from 'react'
import { BellAlertIcon, ChatBubbleLeftRightIcon, ClipboardDocumentCheckIcon, DocumentTextIcon } from '@heroicons/react/20/solid'
import type { GovernanceItemType } from '../../api/governance'
import type { IconTone } from '../../components/dashboard/DashboardCard'
import { useI18n } from '../../i18n/context'

/** The four record types the governance feeds aggregate, with their dashboard icon and tone. */
export const GOVERNANCE_TYPES: { type: GovernanceItemType; icon: ReactNode; tone: IconTone }[] = [
  { type: 'alert', icon: <BellAlertIcon />, tone: 'info' },
  { type: 'inquiry', icon: <ChatBubbleLeftRightIcon />, tone: 'accent' },
  { type: 'directive', icon: <ClipboardDocumentCheckIcon />, tone: 'directive' },
  { type: 'periodic_report', icon: <DocumentTextIcon />, tone: 'success' },
]

/**
 * The governance feeds mix record types, and their status values overlap ("draft",
 * "acknowledged"): summaries key them "type:status" (e.g. "alert:new"), feed rows by status
 * alone. A status is labelled from whichever engine's list names it first; unknown values
 * fall back to a readable form of the raw key.
 */
export function useGovernanceStatusLabel(): (status: string) => string {
  const { t } = useI18n()
  const maps: Record<string, string>[] = [t.alerts.status, t.inquiries.status, t.directives.status, t.reports.status]
  const types: Record<string, string> = t.dashboard.governance.types

  const label = (status: string) => {
    for (const map of maps) {
      if (status in map) {
        return map[status]
      }
    }
    const readable = status.replace(/_/g, ' ')
    return readable.charAt(0).toUpperCase() + readable.slice(1)
  }

  return (status: string) => {
    const separator = status.indexOf(':')
    if (separator === -1) {
      return label(status)
    }
    const type = status.slice(0, separator)
    return `${types[type] ?? label(type)} · ${label(status.slice(separator + 1))}`
  }
}

/** Feed summaries embed raw intelligence-type codes ("trade_barriers"); show their labels. */
export function useReadableSummary(): (summary: string) => string {
  const { t } = useI18n()
  const labels: Record<string, string> = t.alerts.intelligenceType
  return (summary: string) => summary.replace(/\b(opportunities|trade_barriers)\b/g, (code) => labels[code] ?? code)
}
