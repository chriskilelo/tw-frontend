import type { ReactNode } from 'react'
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
  UserIcon,
} from '@heroicons/react/20/solid'
import {
  GOVERNANCE_ITEM_TYPES,
  type GovernanceItemType,
  type GovernancePeriodSummary,
  type GovernanceTrendPoint,
  type MissionDepartment,
} from '../../api/governance'
import type { AlertStatus } from '../../api/alerts'
import type { InquiryStatus } from '../../api/inquiries'
import type { ReportComplianceStatus } from '../../api/reports'
import { Badge } from '../../components/Badge'
import { DashboardCard, IconChip } from '../../components/dashboard/DashboardCard'
import { ChartLegend, QuarterBarChart } from '../../components/dashboard/charts'
import { CHART_COLORS } from '../../components/dashboard/chartTheme'
import { DeltaPill } from '../../components/dashboard/visuals'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { formatNumber, periodRange } from '../../lib/dashboardFormat'
import { AlertStatusBadge } from '../alerts/AlertStatusBadge'
import { InquiryStatusBadge } from '../inquiries/InquiryStatusBadge'
import { ComplianceStatusBadge } from '../reports/ReportStatusBadge'
import { STATUS_ORDER, TYPE_STYLE, errorStatus, useStatusLabel } from './governanceTheme'

/**
 * Shared components for the two mission-governance views (FR-HOM-001 to 003, FR-MFA-001 to
 * 003): status and type badges, the FR-HOM-002 quarter summary, the quarterly trend, the
 * department filter and the access states. Both views are read-only (BR-020): nothing here
 * renders a control that changes a record. Constants and helpers are in governanceTheme.tsx.
 */

/** CLAUDE.md Section 4 Rule 9: every status shows colour, an icon and a text label. */
export function GovernanceStatusBadge({ type, status }: { type: GovernanceItemType; status: string }) {
  const statusLabel = useStatusLabel()

  if (type === 'alert' && STATUS_ORDER.alert.includes(status)) {
    return <AlertStatusBadge status={status as AlertStatus} />
  }
  if (type === 'inquiry' && STATUS_ORDER.inquiry.includes(status)) {
    return <InquiryStatusBadge status={status as InquiryStatus} />
  }
  if (type === 'periodic_report' && STATUS_ORDER.periodic_report.includes(status)) {
    return <ComplianceStatusBadge status={status as ReportComplianceStatus} />
  }
  return <Badge variant="neutral" label={statusLabel(type, status)} />
}

export function TypeChip({ type, size = 'md' }: { type: GovernanceItemType; size?: 'sm' | 'md' }) {
  return <IconChip icon={TYPE_STYLE[type].icon} tone={TYPE_STYLE[type].tone} size={size} />
}

/** A badge naming the record type (icon plus text, never colour alone). */
export function TypeBadge({ type }: { type: GovernanceItemType }) {
  const { t } = useI18n()
  const variant = type === 'alert' ? 'info' : type === 'inquiry' ? 'accent' : 'success'
  return <Badge variant={variant} icon={<span aria-hidden="true" className="[&>svg]:size-3.5">{TYPE_STYLE[type].icon}</span>} label={t.governance.typeSingular[type]} />
}

export function ViewOnlyPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-section-bg px-3 py-1 text-caption font-semibold text-text-secondary ring-1 ring-border">
      <EyeIcon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  )
}

// --- Access and error states --------------------------------------------------

/**
 * The page-level state for a refused or failed request: a 403 explains who the view is for
 * (the API refused it; hiding the navigation alone is never the protection), a 404 says the
 * record does not exist, anything else offers a retry.
 */
export function GovernanceUnavailable({ error, forbiddenBody, onRetry }: { error: unknown; forbiddenBody: string; onRetry: () => void }) {
  const { t } = useI18n()
  const copy = t.governance.unavailable
  const status = errorStatus(error)

  if (status === 403 || status === 404) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-sm" data-testid="governance-unavailable">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-section-bg text-text-secondary [&>svg]:size-6">
          {status === 403 ? <ShieldExclamationIcon /> : <MagnifyingGlassIcon />}
        </span>
        <p className="text-h3 text-primary">{status === 403 ? copy.forbiddenTitle : copy.notFoundTitle}</p>
        <p className="max-w-md text-body-sm text-text-secondary">{status === 403 ? forbiddenBody : copy.notFoundBody}</p>
      </div>
    )
  }

  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
        <ExclamationTriangleIcon className="size-5" />
      </span>
      <p className="max-w-md text-body text-text-secondary">{copy.loadError}</p>
      <button type="button" onClick={onRetry} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
        <ArrowPathIcon aria-hidden="true" className="size-4" />
        {copy.retry}
      </button>
    </div>
  )
}

/**
 * A horizontally scrollable wrapper for a wide table whose rows hold nothing focusable: it
 * takes focus itself, under a name, so a keyboard user can scroll it too (WCAG 2.1.1; axe
 * scrollable-region-focusable).
 */
export function ScrollRegion({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={`overflow-x-auto ${className}`}>
      {children}
    </div>
  )
}

export function SummarySkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="h-48 animate-pulse rounded-xl border border-border bg-white shadow-sm motion-reduce:animate-none" />
      ))}
    </div>
  )
}

// --- FR-HOM-002: the quarter summary -----------------------------------------------

/**
 * One card per record type: this quarter's count against last quarter's, then this quarter's
 * count per status. With `onSelectStatus`, each status line filters the activity feed to it.
 */
export function QuarterSummary({
  current,
  prior,
  onSelectStatus,
}: {
  current: GovernancePeriodSummary
  prior: GovernancePeriodSummary
  onSelectStatus?: (type: GovernanceItemType, status: string) => void
}) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.summary
  const statusLabel = useStatusLabel()

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {GOVERNANCE_ITEM_TYPES.map((type) => {
        const count = current.by_type[type] ?? 0
        const previous = prior.by_type[type] ?? 0
        const statuses = Object.entries(current.by_status[type] ?? {})
          .filter(([, value]) => value > 0)
          .sort(([first], [second]) => STATUS_ORDER[type].indexOf(first) - STATUS_ORDER[type].indexOf(second))

        return (
          <section key={type} aria-label={t.governance.types[type]} className="flex min-w-0 flex-col rounded-xl border border-border bg-white p-4 shadow-sm" data-testid={`summary-${type}`}>
            <div className="flex items-center gap-2.5">
              <TypeChip type={type} size="sm" />
              <h3 className="text-body font-semibold text-primary">{t.governance.types[type]}</h3>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="font-mono text-[2rem] font-semibold leading-none tracking-tight text-primary">{formatNumber(count, locale)}</p>
              <p className="text-caption text-text-secondary">{copy.priorCount(formatNumber(previous, locale))}</p>
            </div>
            <DeltaPill current={count} previous={previous} />

            <p className="mt-4 text-caption font-semibold uppercase tracking-wide text-text-muted">{copy.byStatus}</p>
            {statuses.length === 0 ? (
              <p className="mt-2 text-body-sm text-text-secondary">{copy.noneThisQuarter}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {statuses.map(([status, value]) => {
                  const content = (
                    <>
                      <GovernanceStatusBadge type={type} status={status} />
                      <span className="ml-auto font-mono text-body-sm font-semibold text-text-primary">{formatNumber(value, locale)}</span>
                    </>
                  )
                  return (
                    <li key={status}>
                      {onSelectStatus ? (
                        <button
                          type="button"
                          onClick={() => onSelectStatus(type, status)}
                          aria-label={copy.showInFeed(formatNumber(value, locale), statusLabel(type, status), t.governance.types[type].toLowerCase())}
                          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-section-bg"
                        >
                          {content}
                        </button>
                      ) : (
                        <span className="flex items-center gap-2 px-1.5 py-1">{content}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

// --- Quarterly trend ------------------------------------------------------------------

export function ActivityTrendCard({ points, className = '' }: { points: GovernanceTrendPoint[]; className?: string }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.trend
  const series = GOVERNANCE_ITEM_TYPES.map((type) => ({ key: type, label: t.governance.types[type], color: TYPE_STYLE[type].color }))
  const data = points.map((point) => ({ label: point.label, start: point.start, end: point.end, ...point.by_type }))
  const partialIndex = points.findIndex((point) => point.is_partial)

  return (
    <DashboardCard
      className={className}
      title={copy.title}
      icon={<ArrowPathIcon />}
      tone="info"
      subtitle={copy.subtitle(points.length)}
      table={{
        caption: copy.title,
        columns: [
          { key: 'quarter', label: copy.quarter },
          ...GOVERNANCE_ITEM_TYPES.map((type) => ({ key: type, label: t.governance.types[type], numeric: true })),
          { key: 'total', label: copy.total, numeric: true },
        ],
        rows: points.map((point) => ({
          quarter: `${point.label} (${periodRange(point, locale)})`,
          ...Object.fromEntries(GOVERNANCE_ITEM_TYPES.map((type) => [type, formatNumber(point.by_type[type] ?? 0, locale)])),
          total: formatNumber(point.total, locale),
        })),
      }}
    >
      <ChartLegend
        items={[
          ...series.map((item) => ({ label: item.label, color: item.color })),
          ...(partialIndex >= 0 ? [{ label: t.dashboard.common.quarterInProgress, color: CHART_COLORS.context, hatched: true }] : []),
        ]}
      />
      <div className="mt-3">
        <QuarterBarChart data={data} series={series} stacked partialIndex={partialIndex >= 0 ? partialIndex : null} />
      </div>
    </DashboardCard>
  )
}

// --- Departments at a mission --------------------------------------------------------

/**
 * The departments posted to a mission as a filter (FR-HOM-001 AC3): "All departments" plus one
 * toggle per department, each naming its attache for the Head of Mission or just whether the
 * post is filled for the MFA drill-down (FR-MFA-001 AC2).
 */
export function DepartmentFilter({
  departments,
  selectedId,
  onSelect,
}: {
  departments: MissionDepartment[]
  selectedId: string | null
  onSelect: (ministryId: string | null) => void
}) {
  const { t } = useI18n()
  const copy = t.governance.departments

  if (departments.length === 0) {
    return <p className="text-body-sm text-text-secondary">{copy.none}</p>
  }

  const optionClass = (active: boolean) =>
    `flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
      active ? 'border-primary bg-primary text-white shadow-sm' : 'border-border bg-white text-text-primary hover:border-primary/30 hover:bg-section-bg'
    }`

  return (
    <div role="group" aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={selectedId === null} onClick={() => onSelect(null)} className={optionClass(selectedId === null)}>
        <BuildingOffice2Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className="text-body-sm font-semibold">{copy.all}</span>
      </button>
      {departments.map((department) => {
        const active = selectedId === department.id
        const detail = department.attache ? copy.attache(department.attache.full_name) : department.posted ? copy.posted : copy.vacant
        return (
          <button key={department.id} type="button" aria-pressed={active} onClick={() => onSelect(active ? null : department.id)} className={optionClass(active)}>
            <BuildingOffice2Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-body-sm font-semibold">{department.name}</span>
              <span className={`flex items-center gap-1 text-caption ${active ? 'text-white/80' : 'text-text-secondary'}`}>
                <UserIcon aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">{detail}</span>
                {!department.active && <span>· {copy.inactive}</span>}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
