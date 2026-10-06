import type { ReactNode } from 'react'
import { GOVERNANCE_ITEM_TYPES, type GovernanceItemType, type GovernancePeriodSummary, type MissionActivityItem } from '../../api/governance'
import type { IconTone } from '../../components/dashboard/DashboardCard'
import { useI18n } from '../../i18n/context'
import { STATUS_ORDER, TYPE_STYLE, useStatusLabel } from '../governance/governanceTheme'

/**
 * The three record types the governance views count (FR-HOM-002: "alerts, inquiries, and
 * reports"), with the dashboard icon and tone the governance pages also use.
 */
export const GOVERNANCE_TYPES: { type: GovernanceItemType; icon: ReactNode; tone: IconTone }[] = GOVERNANCE_ITEM_TYPES.map((type) => ({
  type,
  icon: TYPE_STYLE[type].icon,
  tone: TYPE_STYLE[type].tone,
}))

/** A quarter's per-type status counts as one ranked list, each named "Alerts · New". */
export function useStatusRanking(): (period: GovernancePeriodSummary) => { name: string; count: number }[] {
  const { t } = useI18n()
  const statusLabel = useStatusLabel()

  return (period) =>
    GOVERNANCE_ITEM_TYPES.flatMap((type) =>
      Object.entries(period.by_status[type] ?? {})
        .filter(([, count]) => count > 0)
        .sort(([first], [second]) => STATUS_ORDER[type].indexOf(first) - STATUS_ORDER[type].indexOf(second))
        .map(([status, count]) => ({ name: `${t.governance.types[type]} · ${statusLabel(type, status)}`, count })),
    ).sort((first, second) => second.count - first.count)
}

/** One readable line for a feed item: an alert's country and intelligence type, an inquiry's category, a report's period. */
export function useFeedLine(): (item: MissionActivityItem) => string {
  const { t } = useI18n()
  const intelligence: Record<string, string> = t.alerts.intelligenceType

  return (item) => {
    switch (item.type) {
      case 'alert':
        return [item.summary?.country, item.summary?.intelligence_type ? (intelligence[item.summary.intelligence_type] ?? item.summary.intelligence_type) : null].filter(Boolean).join(' · ') || t.governance.typeSingular.alert
      case 'inquiry':
        return [item.summary?.category, item.summary?.inquirer_organisation].filter(Boolean).join(' · ') || t.governance.typeSingular.inquiry
      default:
        return item.summary ? `${t.governance.typeSingular.periodic_report} · ${item.summary.period_label}` : t.governance.typeSingular.periodic_report
    }
  }
}
