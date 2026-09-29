import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  MinusIcon,
} from '@heroicons/react/20/solid'
import type { PerformanceStatus } from '../../api/kpi'
import type { MissionKpiRow } from '../../api/dashboard'
import { KpiStatusBadge } from '../../pages/kpi/KpiStatusBadge'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { formatNumber, percentOf } from '../../lib/dashboardFormat'
import { IconChip, type IconTone } from './DashboardCard'
import { ChartLegend, Sparkline } from './charts'
import { CHART_COLORS, kpiStatusSegments, type StackSegment } from './chartTheme'

// --- Stat tile ---------------------------------------------------------------

export type FootnoteTone = 'neutral' | 'danger' | 'success' | 'atrisk'

const FOOTNOTE_CLASSES: Record<FootnoteTone, string> = {
  neutral: 'text-text-secondary',
  danger: 'text-danger-soft-text',
  success: 'text-success-soft-text',
  atrisk: 'text-atrisk-soft-text',
}

interface StatTileProps {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: IconTone
  to?: string
  /** Renders a change-since-last-quarter pill. Direction is stated, never judged by colour. */
  delta?: { current: number; previous: number }
  footnote?: ReactNode
  footnoteTone?: FootnoteTone
  trend?: number[]
  trendColor?: string
}

export function StatTile({ label, value, icon, tone = 'neutral', to, delta, footnote, footnoteTone = 'neutral', trend, trendColor }: StatTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5 text-body-sm font-medium text-text-secondary">
          <IconChip icon={icon} tone={tone} size="sm" />
          <span className="min-w-0">{label}</span>
        </span>
        {to && (
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
          />
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[2rem] font-semibold leading-none tracking-tight text-primary">{value}</p>
          {delta && <DeltaPill current={delta.current} previous={delta.previous} />}
          {footnote && <p className={`mt-2 text-caption font-medium ${FOOTNOTE_CLASSES[footnoteTone]}`}>{footnote}</p>}
        </div>
        {trend && (
          // Container query: the sparkline steps aside when four tiles share a narrow row.
          <div className="hidden @min-[16rem]:block">
            <Sparkline values={trend} color={trendColor} />
          </div>
        )}
      </div>
    </>
  )

  const className =
    '@container group flex min-w-0 flex-col rounded-xl border border-border bg-white p-4 shadow-sm transition duration-200 motion-reduce:transition-none'

  return to ? (
    <Link to={to} className={`${className} hover:border-primary/25 hover:shadow-md motion-safe:hover:-translate-y-0.5`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

export function DeltaPill({ current, previous }: { current: number; previous: number }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const difference = current - previous
  const Icon = difference > 0 ? ArrowUpRightIcon : difference < 0 ? ArrowDownRightIcon : MinusIcon
  const text =
    difference === 0
      ? t.dashboard.common.unchanged
      : `${difference > 0 ? t.dashboard.common.up(formatNumber(difference, locale)) : t.dashboard.common.down(formatNumber(Math.abs(difference), locale))} ${t.dashboard.common.vsLastQuarter}`

  return (
    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-section-bg px-2 py-0.5 text-caption font-medium text-text-secondary">
      <Icon aria-hidden="true" className="size-3.5" />
      {text}
    </p>
  )
}

// --- Ranked bars ---------------------------------------------------------------

interface RankedItem {
  name: string
  count: number
  to?: string
  note?: string
}

/** A ranked list with proportional bars; the names and numbers are real list text. */
export function RankedBars({ items, limit = 6, barClassName = 'bg-chart-1' }: { items: RankedItem[]; limit?: number; barClassName?: string }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const [expanded, setExpanded] = useState(false)
  const max = Math.max(1, ...items.map((item) => item.count))
  const visible = expanded ? items : items.slice(0, limit)

  return (
    <div>
      <ol className="space-y-3">
        {visible.map((item, index) => {
          const label = (
            <span className="flex items-baseline justify-between gap-3 text-body-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="w-4 shrink-0 text-right font-mono text-caption text-text-muted">{index + 1}</span>
                <span className="truncate font-medium text-text-primary">{item.name}</span>
                {item.note && <span className="shrink-0 text-caption text-text-secondary">{item.note}</span>}
              </span>
              <span className="shrink-0 font-mono font-semibold text-text-primary">{formatNumber(item.count, locale)}</span>
            </span>
          )
          return (
            <li key={item.name}>
              {item.to ? (
                <Link to={item.to} className="block rounded hover:text-primary">
                  {label}
                </Link>
              ) : (
                label
              )}
              <span aria-hidden="true" className="mt-1.5 ml-6 block h-2 overflow-hidden rounded-full bg-section-bg">
                <span className={`block h-full rounded-full ${barClassName}`} style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }} />
              </span>
            </li>
          )
        })}
      </ol>
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-3 text-body-sm font-semibold text-info-soft-text hover:underline"
        >
          {expanded ? t.dashboard.common.showFewer : t.dashboard.common.showAll(items.length)}
        </button>
      )}
    </div>
  )
}

// --- Status stacks -----------------------------------------------------------

/** One horizontal part-to-whole bar with 2px gaps and a legend carrying icon, label and count. */
export function StackedBar({
  segments,
  height = 'h-3',
  showLegend = true,
  legendColumns = 1,
}: {
  segments: StackSegment[]
  height?: string
  showLegend?: boolean
  legendColumns?: 1 | 2
}) {
  const { language } = useI18n()
  const locale = localeFor(language)
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <div>
      <div aria-hidden="true" className={`flex w-full gap-0.5 overflow-hidden rounded-full bg-section-bg ${height}`}>
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.key}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(segment.value / total) * 100}%`,
                  minWidth: 4,
                  background: segment.hatched ? `repeating-linear-gradient(135deg, ${segment.color} 0 2px, ${segment.color}33 2px 6px)` : segment.color,
                }}
              />
            ))}
      </div>
      {showLegend && (
        <ul className={`mt-3 grid grid-cols-1 gap-x-6 gap-y-2 ${legendColumns === 2 ? 'sm:grid-cols-2' : ''}`}>
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center justify-between gap-2 text-body-sm">
              <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                {segment.icon ? (
                  <span aria-hidden="true" className="shrink-0 [&>svg]:size-4" style={{ color: segment.color }}>
                    {segment.icon}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ background: segment.hatched ? `repeating-linear-gradient(135deg, ${segment.color} 0 2px, ${segment.color}33 2px 5px)` : segment.color }}
                  />
                )}
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="shrink-0 font-mono font-semibold text-text-primary">
                {formatNumber(segment.value, locale)}
                <span className="ml-1 font-sans text-caption font-normal text-text-muted">{percentOf(segment.value, total)}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function KpiStatusLegend() {
  const { t } = useI18n()
  return (
    <ChartLegend
      items={[
        { label: t.kpi.status.on_track, color: CHART_COLORS.onTrack },
        { label: t.kpi.status.at_risk, color: CHART_COLORS.atRisk },
        { label: t.kpi.status.below_target, color: CHART_COLORS.below },
        { label: t.kpi.status.no_data, color: CHART_COLORS.none, hatched: true },
      ]}
    />
  )
}

interface MissionStatusRow {
  id: string
  name: string
  counts: Record<PerformanceStatus, number>
  total: number
}

/** Small-multiple status bars, one per mission, weakest first. */
export function MissionStatusRows({ rows, limit = 8 }: { rows: MissionStatusRow[]; limit?: number }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? rows : rows.slice(0, limit)
  const labels = t.kpi.status

  return (
    <div>
      <ul className="space-y-3">
        {visible.map((row) => (
          <li key={row.id} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3">
            <span className="truncate text-body-sm font-medium text-text-primary">{row.name}</span>
            <StackedBar segments={kpiStatusSegments(row.counts, labels)} height="h-2.5" showLegend={false} />
            <span className="text-right text-caption text-text-secondary">
              <span className="font-mono font-semibold text-text-primary">{row.counts.on_track}</span>/{row.total} {t.dashboard.common.onTrackShort}
            </span>
          </li>
        ))}
      </ul>
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-3 text-body-sm font-semibold text-info-soft-text hover:underline"
        >
          {expanded ? t.dashboard.common.showFewer : t.dashboard.common.showAll(rows.length)}
        </button>
      )}
    </div>
  )
}

// --- Ring and meter ---------------------------------------------------------

export function ProgressRing({
  value,
  total,
  color = CHART_COLORS.onTrack,
  size = 120,
  label,
  caption,
}: {
  value: number
  total: number
  color?: string
  size?: number
  label: string
  caption?: string
}) {
  const stroke = 11
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const share = total > 0 ? Math.min(1, value / total) : 0

  return (
    <div role="img" aria-label={label} className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={CHART_COLORS.grid} strokeWidth={stroke} />
        {share > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * share} ${circumference}`}
            className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
          />
        )}
      </svg>
      <span aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-h2 font-semibold text-primary">{percentOf(value, total)}%</span>
        {caption && <span className="text-caption text-text-secondary">{caption}</span>}
      </span>
    </div>
  )
}

export function Meter({ value, max, colorClass = 'bg-chart-1', label }: { value: number; max: number; colorClass?: string; label: string }) {
  const share = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2.5 w-full overflow-hidden rounded-full bg-section-bg">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.max(share, value > 0 ? 1 : 0)}%` }} />
    </div>
  )
}

// --- Funnel ---------------------------------------------------------------------

const FUNNEL_SHADES = ['#2a78d6', '#256abf', '#1c5cab', '#184f95']

/**
 * Stages narrowing from the first, drawn as centred bars so the shape reads as a funnel.
 * Each row writes its label, count and share of the first stage above its bar.
 */
export function FunnelSteps({ steps }: { steps: { key: string; label: string; value: number }[] }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const base = steps[0]?.value ?? 0

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={step.key}>
          <p className="flex items-baseline justify-between gap-3 text-body-sm">
            <span className="font-medium text-text-primary">{step.label}</span>
            <span className="flex items-baseline gap-2">
              {index > 0 && <span className="text-caption text-text-secondary">{t.dashboard.leadership.funnel.shareOfReceived(percentOf(step.value, base))}</span>}
              <span className="font-mono font-semibold text-text-primary">{formatNumber(step.value, locale)}</span>
            </span>
          </p>
          <span aria-hidden="true" className="mt-1.5 flex h-7 justify-center rounded-md bg-page-bg">
            <span
              className="h-full rounded-md transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${Math.max(base > 0 ? (step.value / base) * 100 : 0, 3)}%`, background: FUNNEL_SHADES[index] ?? FUNNEL_SHADES[3] }}
            />
          </span>
        </li>
      ))}
    </ol>
  )
}

// --- KPI bullets (FR-KPI-008 / FR-KPI-010) ---------------------------------

const BULLET_COLOR: Record<PerformanceStatus, string> = {
  on_track: CHART_COLORS.onTrack,
  at_risk: CHART_COLORS.atRisk,
  below_target: CHART_COLORS.below,
  no_target: CHART_COLORS.none,
  no_data: CHART_COLORS.none,
}

/**
 * One bullet chart per KPI: the bar is the actual, the dark tick the target, the hollow
 * marker the previous cycle's actual. Every value is also written out beside it.
 */
export function KpiBulletList({ rows, previousLabel }: { rows: MissionKpiRow[]; previousLabel: string }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.attache.kpi

  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const scale = Math.max(1, row.target ?? 0, row.actual ?? 0, row.previous_actual ?? 0) * 1.12
        const change = row.actual !== null && row.previous_actual !== null ? row.actual - row.previous_actual : null
        return (
          <li key={row.kpi_definition_id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-body-sm font-semibold text-text-primary">{row.name}</p>
              <KpiStatusBadge status={row.status} />
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-4">
              <div aria-hidden="true" className="relative h-3 rounded-full bg-section-bg">
                {row.actual !== null && (
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(row.actual / scale) * 100}%`, background: BULLET_COLOR[row.status] }} />
                )}
                {row.previous_actual !== null && (
                  <span
                    className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
                    style={{ left: `${(row.previous_actual / scale) * 100}%`, borderColor: '#64748b' }}
                  />
                )}
                {row.target !== null && (
                  <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: `${(row.target / scale) * 100}%` }} />
                )}
              </div>
              <p className="text-right text-caption text-text-secondary">
                <span className="font-mono text-body-sm font-semibold text-text-primary">{row.actual === null ? '—' : formatNumber(row.actual, locale, 1)}</span>
                {' / '}
                {row.target === null ? copy.noTarget : copy.targetValue(formatNumber(row.target, locale, 1))}
              </p>
            </div>
            <p className="mt-1.5 text-caption text-text-secondary">
              {change === null ? copy.noComparison : copy.changeSince(change, formatNumber(Math.abs(change), locale, 1), previousLabel)}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export function BulletLegend() {
  const { t } = useI18n()
  const copy = t.dashboard.attache.kpi
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-text-secondary">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-5 rounded-full" style={{ background: CHART_COLORS.onTrack }} />
        {copy.legendActual}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3.5 w-0.5 rounded-full bg-primary" />
        {copy.legendTarget}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full border-2 bg-white" style={{ borderColor: '#64748b' }} />
        {copy.legendPrevious}
      </li>
    </ul>
  )
}
