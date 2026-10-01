import type { ComponentType, SVGProps } from 'react'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  MinusCircleIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid'
import type { BadgeVariant } from '../../components/Badge'
import { CHART_COLORS, hatchBackground } from '../../components/dashboard/chartTheme'
import { formatNumber } from '../../lib/dashboardFormat'
import type { KpiPeriodQuery, PerformanceStatus } from '../../api/kpi'

/**
 * FR-KPI-008, CLAUDE.md Section 4 Rules 9/10: every status pairs colour with an icon and a
 * label. At risk is the amber at-risk tone, never the brand accent. Pending (too early to
 * judge) reuses the blue the compliance board gives work in progress; the two "not measured"
 * states are neutral and drawn hatched. The mark colours passed the dataviz validator against
 * each other (green, amber, red, blue: CVD ΔE ≥ 8.4).
 */
export const STATUS_VARIANT: Record<PerformanceStatus, BadgeVariant> = {
  on_track: 'success',
  at_risk: 'atrisk',
  below_target: 'danger',
  pending: 'info',
  no_data: 'neutral',
  no_target: 'neutral',
}

export const STATUS_COLOR: Record<PerformanceStatus, string> = {
  on_track: CHART_COLORS.onTrack,
  at_risk: CHART_COLORS.atRisk,
  below_target: CHART_COLORS.below,
  pending: '#2563eb',
  no_data: CHART_COLORS.none,
  no_target: CHART_COLORS.none,
}

export const STATUS_ICON: Record<PerformanceStatus, ComponentType<SVGProps<SVGSVGElement>>> = {
  on_track: CheckCircleIcon,
  at_risk: ExclamationTriangleIcon,
  below_target: XCircleIcon,
  pending: ClockIcon,
  no_data: MinusCircleIcon,
  no_target: FlagIcon,
}

/** Soft cell tints for the comparison matrix: the text on them stays in ink colours. */
export const STATUS_TINT: Record<PerformanceStatus, string> = {
  on_track: 'bg-success-soft',
  at_risk: 'bg-atrisk-soft',
  below_target: 'bg-danger-soft',
  pending: 'bg-info-soft',
  no_data: 'bg-section-bg',
  no_target: 'bg-white',
}

export const STATUS_TEXT: Record<PerformanceStatus, string> = {
  on_track: 'text-success-soft-text',
  at_risk: 'text-atrisk-soft-text',
  below_target: 'text-danger-soft-text',
  pending: 'text-info-soft-text',
  no_data: 'text-text-secondary',
  no_target: 'text-text-muted',
}

export function statusMarkBackground(status: PerformanceStatus): string {
  return status === 'no_data' || status === 'no_target' ? hatchBackground(STATUS_COLOR[status]) : STATUS_COLOR[status]
}

/** KPI values are counts, but a quarter's share of a half-year target can be a half. */
export function formatKpiValue(value: number | null | undefined, locale: string): string {
  return value === null || value === undefined ? '—' : formatNumber(value, locale, 1)
}

export function formatRatio(ratio: number | null | undefined): string {
  return ratio === null || ratio === undefined ? '—' : `${Math.round(ratio * 100)}%`
}

/** "+50%", "−33%": a change as a signed percentage. */
export function formatSignedRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) {
    return '—'
  }
  const percent = Math.round(Math.abs(ratio) * 100)
  return `${ratio > 0 ? '+' : ratio < 0 ? '−' : '±'}${percent}%`
}

export function formatSigned(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${formatNumber(Math.abs(value), locale, 1)}`
}

/** "1 Jul 2026" for a date-only string, read in UTC so no timezone shifts the day. */
export function formatDay(value: string, locale: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** The period part of a KPI page URL: ?period=H1 2026, or ?from=&to= for a custom range. */
export function periodQueryFrom(params: URLSearchParams): KpiPeriodQuery {
  const from = params.get('from') ?? undefined
  const to = params.get('to') ?? undefined
  if (from && to) {
    return { from, to }
  }
  return { period: params.get('period') ?? undefined }
}

export function periodQueryKey(query: KpiPeriodQuery): string {
  return query.from && query.to ? `${query.from}..${query.to}` : (query.period ?? 'default')
}

/** A data_source key's readable name (KpiDataSources), or the stored description as is. */
export function dataSourceLabel(source: string | null, labels: Record<string, string>): string {
  return source ? (labels[source] ?? source) : ''
}
