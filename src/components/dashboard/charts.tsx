import { useId } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { PeriodRef } from '../../api/dashboard'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { formatNumber, periodRange, periodTick, weekTick } from '../../lib/dashboardFormat'
import { CHART_COLORS, hatchBackground, usePrefersReducedMotion } from './chartTheme'

export interface SeriesSpec {
  key: string
  label: string
  color: string
}

export function ChartLegend({ items }: { items: { label: string; color: string; hatched?: boolean; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-caption text-text-secondary">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: item.hatched ? hatchBackground(item.color) : item.color }} />
          <span>{item.label}</span>
          {item.value && <span className="font-mono font-semibold text-text-primary">{item.value}</span>}
        </li>
      ))}
    </ul>
  )
}

function TooltipShell({ heading, note, rows, total }: { heading: string; note?: string; rows: { label: string; color: string; value: string }[]; total?: string }) {
  const { t } = useI18n()
  return (
    <div className="min-w-44 rounded-lg border border-border bg-white px-3 py-2.5 shadow-lg">
      <p className="text-body-sm font-semibold text-primary">{heading}</p>
      {note && <p className="text-caption text-text-secondary">{note}</p>}
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 text-caption">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: row.color }} />
              {row.label}
            </span>
            <span className="font-mono font-semibold text-text-primary">{row.value}</span>
          </li>
        ))}
      </ul>
      {total && (
        <p className="mt-1.5 flex justify-between border-t border-border pt-1.5 text-caption">
          <span className="text-text-secondary">{t.dashboard.common.total}</span>
          <span className="font-mono font-semibold text-text-primary">{total}</span>
        </p>
      )}
    </div>
  )
}

interface QuarterBarChartProps<T extends PeriodRef> {
  data: T[]
  series: SeriesSpec[]
  stacked?: boolean
  height?: number
  /** Index of the period still in progress, drawn hatched. Defaults to the last period. */
  partialIndex?: number | null
  /** Optional per-period note shown in the tooltip, e.g. "Not yet due". */
  noteFor?: (datum: T, index: number) => string | undefined
}

function seriesValue(datum: PeriodRef, key: string): number {
  return Number((datum as unknown as Record<string, unknown>)[key] ?? 0)
}

/**
 * Columns per fiscal quarter, grouped or stacked. Axis ticks name the months ("Jul–Sep
 * '26"); the tooltip adds the official label. The quarter still in progress is hatched so a
 * partial count never reads as a drop.
 */
export function QuarterBarChart<T extends PeriodRef>({ data, series, stacked = false, height = 240, partialIndex, noteFor }: QuarterBarChartProps<T>) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const uid = useId().replace(/:/g, '')
  const reducedMotion = usePrefersReducedMotion()
  const partial = partialIndex === undefined ? data.length - 1 : partialIndex
  const chartData = data.map((datum) => ({ ...datum, tick: periodTick(datum, locale) }))

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) {
      return null
    }
    const datum = payload[0].payload as T
    const index = data.findIndex((item) => item.start === datum.start)
    const rows = series.map((item) => ({ label: item.label, color: item.color, value: formatNumber(seriesValue(datum, item.key), locale) }))
    const note = noteFor?.(datum, index) ?? (index === partial ? t.dashboard.common.quarterInProgress : undefined)
    const total = stacked && series.length > 1 ? formatNumber(series.reduce((sum, item) => sum + seriesValue(datum, item.key), 0), locale) : undefined
    return <TooltipShell heading={`${periodRange(datum, locale)} · ${datum.label}`} note={note} rows={rows} total={total} />
  }

  return (
    <BarChart responsive style={{ width: '100%', height }} data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="22%" barGap={3}>
      <defs>
        {series.map((item) => (
          <pattern key={item.key} id={`${uid}-hatch-${item.key}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={item.color} fillOpacity={0.22} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={item.color} strokeWidth="3" />
          </pattern>
        ))}
      </defs>
      <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
      <XAxis dataKey="tick" tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} minTickGap={6} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} />
      <Tooltip cursor={{ fill: '#f1f5f9' }} content={renderTooltip} />
      {series.map((item, seriesIndex) => (
        <Bar
          key={item.key}
          dataKey={item.key}
          name={item.label}
          stackId={stacked ? 'stack' : undefined}
          fill={item.color}
          maxBarSize={stacked ? 34 : 20}
          radius={!stacked || seriesIndex === series.length - 1 ? [4, 4, 0, 0] : 0}
          stroke={stacked ? '#ffffff' : undefined}
          strokeWidth={stacked ? 1 : 0}
          isAnimationActive={!reducedMotion}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={index === partial ? `url(#${uid}-hatch-${item.key})` : item.color} />
          ))}
        </Bar>
      ))}
    </BarChart>
  )
}

/** Weekly people-signed-in area with failed attempts as a line (administrator dashboard). */
export function WeeklyActivityChart({ data, height = 240 }: { data: { week_start: string; active_users: number; failed_attempts: number }[]; height?: number }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const uid = useId().replace(/:/g, '')
  const reducedMotion = usePrefersReducedMotion()
  const copy = t.dashboard.admin.signIns
  const chartData = data.map((datum) => ({ ...datum, tick: weekTick(datum.week_start, locale) }))

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) {
      return null
    }
    const datum = payload[0].payload as (typeof chartData)[number]
    return (
      <TooltipShell
        heading={copy.weekOf(datum.tick)}
        rows={[
          { label: copy.active, color: CHART_COLORS.series1, value: formatNumber(datum.active_users, locale) },
          { label: copy.failed, color: CHART_COLORS.series2, value: formatNumber(datum.failed_attempts, locale) },
        ]}
      />
    )
  }

  return (
    <ComposedChart responsive style={{ width: '100%', height }} data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
      <defs>
        <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.series1} stopOpacity={0.28} />
          <stop offset="100%" stopColor={CHART_COLORS.series1} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
      <XAxis dataKey="tick" tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} minTickGap={10} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} />
      <Tooltip cursor={{ stroke: CHART_COLORS.axis, strokeDasharray: '0', strokeWidth: 1 }} content={renderTooltip} />
      <Area
        type="monotone"
        dataKey="active_users"
        name={copy.active}
        stroke={CHART_COLORS.series1}
        strokeWidth={2}
        fill={`url(#${uid}-area)`}
        dot={{ r: 3, fill: CHART_COLORS.series1, stroke: '#ffffff', strokeWidth: 2 }}
        activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
        isAnimationActive={!reducedMotion}
      />
      <Line
        type="monotone"
        dataKey="failed_attempts"
        name={copy.failed}
        stroke={CHART_COLORS.series2}
        strokeWidth={2}
        dot={{ r: 3, fill: CHART_COLORS.series2, stroke: '#ffffff', strokeWidth: 2 }}
        activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
        isAnimationActive={!reducedMotion}
      />
    </ComposedChart>
  )
}

/** Horizontal "this period against the last" bars per category (Head of Mission view). */
export function ComparisonBarChart({
  data,
  currentLabel,
  priorLabel,
  height,
}: {
  data: { name: string; current: number; prior: number }[]
  currentLabel: string
  priorLabel: string
  height?: number
}) {
  const { language } = useI18n()
  const locale = localeFor(language)
  const reducedMotion = usePrefersReducedMotion()

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) {
      return null
    }
    const datum = payload[0].payload as (typeof data)[number]
    return (
      <TooltipShell
        heading={datum.name}
        rows={[
          { label: currentLabel, color: CHART_COLORS.series1, value: formatNumber(datum.current, locale) },
          { label: priorLabel, color: CHART_COLORS.context, value: formatNumber(datum.prior, locale) },
        ]}
      />
    )
  }

  return (
    <BarChart
      responsive
      layout="vertical"
      style={{ width: '100%', height: height ?? Math.max(160, data.length * 56) }}
      data={data}
      margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
      barGap={3}
      barCategoryGap="26%"
    >
      <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} />
      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={92} tick={{ fill: '#374151', fontSize: 12 }} />
      <Tooltip cursor={{ fill: '#f1f5f9' }} content={renderTooltip} />
      <Bar dataKey="prior" name={priorLabel} fill={CHART_COLORS.context} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={!reducedMotion} />
      <Bar dataKey="current" name={currentLabel} fill={CHART_COLORS.series1} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={!reducedMotion} />
    </BarChart>
  )
}

/** A decorative trend line for a stat tile; the tile states the number in text. */
export function Sparkline({ values, color = CHART_COLORS.series1, width = 104, height = 40 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const uid = useId().replace(/:/g, '')
  if (values.length < 2) {
    return null
  }
  const data = values.map((value, index) => ({ index, value }))
  return (
    <div aria-hidden="true" className="shrink-0">
      <AreaChart width={width} height={height} data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }} accessibilityLayer={false}>
        <defs>
          <linearGradient id={`${uid}-spark`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${uid}-spark)`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </div>
  )
}
