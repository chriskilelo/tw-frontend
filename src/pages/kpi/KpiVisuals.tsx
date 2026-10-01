import { useId } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { KpiQuarterValue, PerformanceStatus } from '../../api/kpi'
import { CHART_COLORS, kpiStatusSegments, usePrefersReducedMotion } from '../../components/dashboard/chartTheme'
import { StackedBar } from '../../components/dashboard/visuals'
import { useI18n } from '../../i18n/context'
import { periodRange, periodTick } from '../../lib/dashboardFormat'
import { localeFor } from '../../lib/formatters'
import { formatKpiValue, statusMarkBackground, STATUS_COLOR, STATUS_ICON } from './kpiPresentation'

interface KpiBulletBarProps {
  actual: number | null
  target: number | null
  expected?: number | null
  previous?: number | null
  status: PerformanceStatus
  /** Read to screen readers in place of the drawing. */
  label: string
  size?: 'sm' | 'md'
}

/**
 * A bullet chart: the bar is the actual in its status colour, the solid tick the full target,
 * the dashed tick the share of the target expected by now (while a period runs), the hollow
 * dot the previous period's actual. Every value is also written out by the caller.
 */
export function KpiBulletBar({ actual, target, expected, previous, status, label, size = 'md' }: KpiBulletBarProps) {
  const scale = Math.max(1, target ?? 0, actual ?? 0, previous ?? 0) * 1.12
  const position = (value: number) => `${Math.min(100, (value / scale) * 100)}%`
  const showExpected = expected !== null && expected !== undefined && target !== null && expected > 0 && expected < target

  return (
    <div role="img" aria-label={label} className={`relative rounded-full bg-section-bg ${size === 'sm' ? 'h-2' : 'h-3'}`}>
      {actual !== null && actual > 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: position(actual), background: STATUS_COLOR[status === 'no_target' ? 'no_data' : status] }}
        />
      )}
      {previous !== null && previous !== undefined && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-500 bg-white"
          style={{ left: position(previous) }}
        />
      )}
      {showExpected && (
        <span aria-hidden="true" className="absolute -inset-y-1 w-0 -translate-x-1/2 border-l-2 border-dashed border-primary/60" style={{ left: position(expected) }} />
      )}
      {target !== null && (
        <span aria-hidden="true" className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: position(target) }} />
      )}
    </div>
  )
}

export function KpiBulletLegend({ showPrevious = true }: { showPrevious?: boolean }) {
  const { t } = useI18n()
  const copy = t.kpi.legend
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-text-secondary">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-5 rounded-full" style={{ background: CHART_COLORS.onTrack }} />
        {copy.actual}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3.5 w-0.5 rounded-full bg-primary" />
        {copy.target}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3.5 w-0 border-l-2 border-dashed border-primary/60" />
        {copy.expected}
      </li>
      {showPrevious && (
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full border-2 border-slate-500 bg-white" />
          {copy.previous}
        </li>
      )}
    </ul>
  )
}

/** The distribution of statuses as one stacked bar, with counts in the legend. */
export function KpiStatusStack({ counts, height }: { counts: Record<PerformanceStatus, number>; height?: string }) {
  const { t } = useI18n()
  return <StackedBar segments={kpiStatusSegments(counts, t.kpi.status)} height={height} />
}

/** A status mark: an icon on its status colour (hatched for the unmeasured). */
export function KpiStatusMark({ status, className = 'size-6' }: { status: PerformanceStatus; className?: string }) {
  const Icon = STATUS_ICON[status]
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-md text-white ${className}`} style={{ background: statusMarkBackground(status) }}>
      <Icon className="size-[70%]" />
    </span>
  )
}

/**
 * Quarterly actuals as columns against each quarter's share of the cycle target as a step
 * line. Quarters still open for reporting are hatched so a partial figure never reads as a
 * drop. One y-axis: target and actual are the same measure.
 */
export function KpiTrendChart({ quarters, height = 220, openFrom }: { quarters: KpiQuarterValue[]; height?: number; openFrom?: string }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const uid = useId().replace(/:/g, '')
  const reducedMotion = usePrefersReducedMotion()
  const copy = t.kpi.legend
  const data = quarters.map((quarter) => ({
    ...quarter,
    tick: periodTick(quarter, locale),
    actualValue: quarter.actual ?? 0,
    open: openFrom !== undefined && quarter.start >= openFrom,
  }))

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) {
      return null
    }
    const datum = payload[0].payload as (typeof data)[number]
    return (
      <div className="min-w-44 rounded-lg border border-border bg-white px-3 py-2.5 shadow-lg">
        <p className="text-body-sm font-semibold text-primary">
          {periodRange(datum, locale)} · {datum.label}
        </p>
        {datum.open && <p className="text-caption text-text-secondary">{t.kpi.dashboard.detail.openQuarter}</p>}
        <ul className="mt-2 space-y-1 text-caption">
          <li className="flex justify-between gap-4">
            <span className="text-text-secondary">{copy.actual}</span>
            <span className="font-mono font-semibold text-text-primary">{formatKpiValue(datum.actual, locale)}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-text-secondary">{copy.quarterTarget}</span>
            <span className="font-mono font-semibold text-text-primary">{formatKpiValue(datum.target, locale)}</span>
          </li>
        </ul>
      </div>
    )
  }

  return (
    <ComposedChart responsive style={{ width: '100%', height }} data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
      <defs>
        <pattern id={`${uid}-open`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={CHART_COLORS.series1} fillOpacity={0.22} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={CHART_COLORS.series1} strokeWidth="3" />
        </pattern>
      </defs>
      <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
      <XAxis dataKey="tick" tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} minTickGap={4} />
      <YAxis allowDecimals tickLine={false} axisLine={false} width={40} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.15))]} />
      <Tooltip cursor={{ fill: '#f1f5f9' }} content={renderTooltip} />
      <Bar dataKey="actualValue" name={copy.actual} fill={CHART_COLORS.series1} maxBarSize={26} radius={[4, 4, 0, 0]} isAnimationActive={!reducedMotion}>
        {data.map((datum, index) => (
          <Cell key={index} fill={datum.open ? `url(#${uid}-open)` : CHART_COLORS.series1} />
        ))}
      </Bar>
      <Line
        type="stepAfter"
        dataKey="target"
        name={copy.quarterTarget}
        stroke="#13213c"
        strokeWidth={2}
        strokeDasharray="5 3"
        dot={{ r: 3, fill: '#13213c', stroke: '#ffffff', strokeWidth: 2 }}
        connectNulls={false}
        isAnimationActive={!reducedMotion}
      />
    </ComposedChart>
  )
}
