import { Badge } from '../../components/Badge'
import type { PerformanceStatus } from '../../api/kpi'
import { useI18n } from '../../i18n/context'
import { STATUS_ICON, STATUS_VARIANT } from './kpiPresentation'

/**
 * FR-KPI-008, CLAUDE.md Section 4 Rules 9/10: on track is success green, at risk the
 * --color-at-risk amber (never the brand accent), below target danger red, pending (too early
 * to judge) info blue; no target / no data are neutral, since neither judges performance.
 * Colour always travels with an icon and a text label.
 */
export function KpiStatusBadge({ status, testId, className }: { status: PerformanceStatus; testId?: string; className?: string }) {
  const { t } = useI18n()
  const Icon = STATUS_ICON[status]
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      icon={<Icon aria-hidden="true" className="size-3.5" />}
      label={t.kpi.status[status]}
      testId={testId}
      className={className}
    />
  )
}

/** The status icon on its own, in the status colour, with the label for screen readers. */
export function KpiStatusIcon({ status, className = 'size-4' }: { status: PerformanceStatus; className?: string }) {
  const { t } = useI18n()
  const Icon = STATUS_ICON[status]
  return (
    <span role="img" aria-label={t.kpi.status[status]} className="inline-flex">
      <Icon aria-hidden="true" className={className} />
    </span>
  )
}
