import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChartPieIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
  LockClosedIcon,
  MinusCircleIcon,
  PauseCircleIcon,
  UserGroupIcon,
  GlobeAltIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import {
  getDirectiveSummary,
  type DirectiveStatus,
  type DirectiveSummary,
  type DirectiveSummaryFilters,
} from '../../api/directives'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { formatNumber, percentOf, recentQuarters } from '../../lib/dashboardFormat'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { SegmentedControl } from '../../components/dashboard/layout'
import { Meter, StackedBar, StatTile } from '../../components/dashboard/visuals'
import { CHART_COLORS, ORDINAL_RAMP, type StackSegment } from '../../components/dashboard/chartTheme'
import { DirectiveStatusBadge } from './DirectiveStatusBadge'

/** DirectivePolicy::viewSummary() — FR-DIR-012. Acting PS carries the full PS permission set. */
const SUMMARY_ROLES = ['Ministry HQ Director', 'Ministry PS', 'Acting PS']

type PeriodPreset = 'all' | 'this_quarter' | 'last_quarter' | 'this_fy' | 'custom'
const PERIOD_PRESETS: PeriodPreset[] = ['all', 'this_quarter', 'last_quarter', 'this_fy', 'custom']

interface DateRange {
  from?: string
  to?: string
}

function isoDate(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Issue-date range for a preset on the fiscal calendar (CLAUDE.md Section 8: Q1 is Jul-Sep,
 * the financial year runs 1 July to 30 June). Fiscal quarters start in the same months as
 * calendar quarters, so recentQuarters() gives both this and last quarter.
 */
function periodRangeFor(preset: PeriodPreset, custom: DateRange, today: Date = new Date()): DateRange {
  if (preset === 'this_quarter' || preset === 'last_quarter') {
    const [lastQuarter, thisQuarter] = recentQuarters(2, today)
    const quarter = preset === 'this_quarter' ? thisQuarter : lastQuarter
    return { from: quarter.start, to: quarter.end }
  }
  if (preset === 'this_fy') {
    const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1
    return { from: toIso(new Date(Date.UTC(startYear, 6, 1))), to: toIso(new Date(Date.UTC(startYear + 1, 5, 30))) }
  }
  return preset === 'custom' ? custom : {}
}

/** Date-only values ("2026-10-12") are calendar days, not instants: format them in UTC. */
function formatDay(value: string, locale: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatPercent(value: number, locale: string): string {
  return `${formatNumber(value, locale, 1)}%`
}

type SummaryParam = 'period' | 'date_from' | 'date_to' | 'mission_id' | 'issued_by_user_id'

/**
 * FR-DIR-012 (directive summary) with FR-DIR-003's target-date groupings. The API computes
 * every count and flag (DirectiveService::getSummary()); this page only draws them and links
 * each number to the directive list with the same filters, so a number is never a dead end.
 * The filters live in the URL: presets are stored by name so a bookmarked "This quarter"
 * stays relative, while a custom range keeps its dates. The role check below only hides a
 * view the API would refuse anyway (GET /directives/summary returns 403 to other roles).
 */
export default function DirectiveSummaryPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.directives.summary
  const { role, isLoading: authLoading } = useAuth()
  const canView = Boolean(role?.name && SUMMARY_ROLES.includes(role.name))

  const [searchParams, setSearchParams] = useSearchParams()
  const customRange: DateRange = { from: isoDate(searchParams.get('date_from')), to: isoDate(searchParams.get('date_to')) }
  const requestedPeriod = searchParams.get('period')
  const period: PeriodPreset = (PERIOD_PRESETS as string[]).includes(requestedPeriod ?? '')
    ? (requestedPeriod as PeriodPreset)
    : customRange.from || customRange.to
      ? 'custom'
      : 'all'
  const range = periodRangeFor(period, customRange)
  const missionId = searchParams.get('mission_id') || undefined
  const issuerId = searchParams.get('issued_by_user_id') || undefined
  const hasFilters = period !== 'all' || Boolean(missionId || issuerId)

  const filters: DirectiveSummaryFilters = {
    ...(range.from ? { date_from: range.from } : {}),
    ...(range.to ? { date_to: range.to } : {}),
    ...(missionId ? { mission_id: missionId } : {}),
    ...(issuerId ? { issued_by_user_id: issuerId } : {}),
  }

  const summaryQuery = useQuery({
    queryKey: ['directives', 'summary', filters],
    queryFn: () => getDirectiveSummary(filters),
    enabled: canView,
    placeholderData: keepPreviousData,
  })
  const summary = summaryQuery.data

  function updateParams(changes: Partial<Record<SummaryParam, string | null>>) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value) {
            next.set(key, value)
          } else {
            next.delete(key)
          }
        }
        return next
      },
      { replace: true },
    )
  }

  function selectPeriod(next: PeriodPreset) {
    if (next === 'custom') {
      // Seed the custom range with whatever range is showing, so switching is not a jump.
      updateParams({ period: 'custom', date_from: range.from ?? null, date_to: range.to ?? null })
    } else {
      updateParams({ period: next === 'all' ? null : next, date_from: null, date_to: null })
    }
  }

  /** The directive list, filtered like this view plus `extra` (status, due or stale). */
  function listLink(extra: Record<string, string> = {}): string {
    const params = new URLSearchParams()
    if (missionId) {
      params.set('mission_id', missionId)
    }
    if (issuerId) {
      params.set('issued_by_user_id', issuerId)
    }
    if (range.from) {
      params.set('date_from', range.from)
    }
    if (range.to) {
      params.set('date_to', range.to)
    }
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value)
    }
    const query = params.toString()
    return query ? `/directives?${query}` : '/directives'
  }

  if (authLoading) {
    return (
      <PageShell>
        <SummarySkeleton label={copy.loading} />
      </PageShell>
    )
  }

  if (!canView) {
    return (
      <PageShell>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <PanelEmpty icon={<LockClosedIcon />} title={copy.notAvailableTitle} body={copy.notAvailableBody} />
          <div className="mt-4 flex justify-center">
            <Link to="/directives" className="text-body-sm font-semibold text-info-soft-text hover:underline">
              {copy.openList}
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  const rangeText =
    range.from || range.to
      ? copy.periodRange(range.from ? formatDay(range.from, locale) : '…', range.to ? formatDay(range.to, locale) : '…')
      : copy.periodAllTime

  return (
    <PageShell
      action={
        <Link
          to={listLink()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg"
        >
          <ListBulletIcon aria-hidden="true" className="size-4" />
          {copy.openList}
        </Link>
      }
    >
      <section aria-label={copy.filtersLabel} className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <span className="text-body-sm font-semibold text-text-secondary">{copy.periodLabel}</span>
          {/* The segmented control wraps on narrow screens, so it never forces a horizontal scroll. */}
          <div>
            <SegmentedControl<PeriodPreset>
              label={copy.periodLabel}
              value={period}
              onChange={selectPeriod}
              options={PERIOD_PRESETS.map((preset) => ({ value: preset, label: copy.period[preset] }))}
            />
          </div>
          <p className="text-caption text-text-secondary" aria-live="polite">
            {rangeText}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {period === 'custom' && (
            <>
              <Input
                type="date"
                label={copy.dateFrom}
                value={customRange.from ?? ''}
                max={customRange.to}
                onChange={(event) => updateParams({ period: 'custom', date_from: event.target.value || null })}
              />
              <Input
                type="date"
                label={copy.dateTo}
                value={customRange.to ?? ''}
                min={customRange.from}
                onChange={(event) => updateParams({ period: 'custom', date_to: event.target.value || null })}
              />
            </>
          )}
          <Select
            label={copy.missionLabel}
            value={missionId ?? ''}
            onChange={(event) => updateParams({ mission_id: event.target.value || null })}
            placeholder={copy.allMissions}
            options={withSelected(
              (summary?.filter_options.missions ?? []).map((mission) => ({ value: mission.id, label: mission.name })),
              missionId,
            )}
          />
          <Select
            label={copy.issuerLabel}
            value={issuerId ?? ''}
            onChange={(event) => updateParams({ issued_by_user_id: event.target.value || null })}
            placeholder={copy.allIssuers}
            options={withSelected(
              (summary?.filter_options.issuers ?? []).map((issuer) => ({ value: issuer.id, label: issuer.full_name })),
              issuerId,
            )}
          />
        </div>

        {hasFilters && (
          <div className="flex justify-end border-t border-border pt-3">
            <button
              type="button"
              onClick={() => updateParams({ period: null, date_from: null, date_to: null, mission_id: null, issued_by_user_id: null })}
              className="inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline"
            >
              <XMarkIcon aria-hidden="true" className="size-4" />
              {copy.clearFilters}
            </button>
          </div>
        )}
      </section>

      {summaryQuery.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
            <ExclamationTriangleIcon className="size-5" />
          </span>
          <p className="max-w-md text-body text-text-secondary">{copy.loadError}</p>
          <button
            type="button"
            onClick={() => void summaryQuery.refetch()}
            className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light"
          >
            <ArrowPathIcon aria-hidden="true" className="size-4" />
            {copy.retry}
          </button>
        </div>
      ) : !summary ? (
        <SummarySkeleton label={copy.loading} />
      ) : (
        <div className={`space-y-5 ${summaryQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}`}>
          <SummaryTiles summary={summary} listLink={listLink} />
          {summary.total === 0 ? (
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <PanelEmpty icon={<ClipboardDocumentCheckIcon />} title={copy.emptyTitle} body={copy.emptyBody} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <DueGroupCard summary={summary} listLink={listLink} />
                <StatusCard summary={summary} listLink={listLink} />
              </div>
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
                <ByMissionCard summary={summary} listLink={listLink} className="xl:col-span-3" />
                <ByIssuerCard summary={summary} listLink={listLink} className="xl:col-span-2" />
              </div>
            </>
          )}
        </div>
      )}
    </PageShell>
  )
}

function PageShell({ action, children }: { action?: ReactNode; children: ReactNode }) {
  const { t } = useI18n()
  const copy = t.directives.summary
  return (
    <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-primary">{copy.title}</h1>
          <p className="mt-1 text-body text-text-secondary">{copy.subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

function SummarySkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-white shadow-sm ring-1 ring-border motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-white shadow-sm ring-1 ring-border motion-reduce:animate-none" />
    </div>
  )
}

/** Keeps a deep-linked id selectable even before (or without) its option list arriving. */
function withSelected(options: { value: string; label: string }[], selected: string | undefined): { value: string; label: string }[] {
  return selected && !options.some((option) => option.value === selected) ? [...options, { value: selected, label: selected }] : options
}

interface SectionProps {
  summary: DirectiveSummary
  listLink: (extra?: Record<string, string>) => string
  className?: string
}

function SummaryTiles({ summary, listLink }: SectionProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.directives.summary
  const open = summary.issued + summary.acknowledged + summary.in_progress

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <StatTile
        label={copy.tileTotal}
        value={formatNumber(summary.total, locale)}
        icon={<ClipboardDocumentCheckIcon />}
        tone="directive"
        to={listLink()}
        footnote={copy.openFootnote(open)}
      />
      <StatTile
        label={copy.tileCompleted}
        value={formatPercent(summary.percentages.completed, locale)}
        icon={<CheckCircleIcon />}
        tone="success"
        to={listLink({ due: 'completed' })}
        footnote={copy.completedFootnote(summary.completed, summary.total, summary.closed)}
      />
      <StatTile
        label={copy.tileInProgress}
        value={formatPercent(summary.percentages.in_progress, locale)}
        icon={<ArrowPathIcon />}
        tone="info"
        to={listLink({ status: 'in_progress' })}
        footnote={copy.ofTotal(summary.in_progress, summary.total)}
      />
      <StatTile
        label={copy.tileOverdue}
        value={formatPercent(summary.percentages.overdue, locale)}
        icon={<ExclamationTriangleIcon />}
        tone="danger"
        to={listLink({ due: 'overdue' })}
        footnote={copy.ofTotal(summary.overdue, summary.total)}
        footnoteTone={summary.overdue > 0 ? 'danger' : 'neutral'}
      />
      <StatTile
        label={copy.tileNoDate}
        value={formatPercent(summary.percentages.no_target_date, locale)}
        icon={<CalendarDaysIcon />}
        tone="neutral"
        to={listLink({ due: 'no_date' })}
        footnote={copy.ofTotal(summary.no_target_date, summary.total)}
      />
      <StatTile
        label={copy.tileStale}
        value={formatNumber(summary.stale, locale)}
        icon={<PauseCircleIcon />}
        tone="atrisk"
        to={listLink({ stale: '1' })}
        footnote={copy.staleFootnote}
        footnoteTone={summary.stale > 0 ? 'atrisk' : 'neutral'}
      />
    </div>
  )
}

interface LinkedSegment extends StackSegment {
  to: string
  /** Rendered in the legend in place of a plain icon + label (e.g. a status badge). */
  badge?: ReactNode
}

/**
 * The part-to-whole bar with a legend whose every row links to the matching list. The bar
 * itself is decorative (StackedBar hides it from assistive technology); the legend carries
 * each group's name, count and share as text, and the card's table view repeats them.
 */
function LinkedBreakdown({ segments }: { segments: LinkedSegment[] }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <div>
      <StackedBar segments={segments} height="h-4" showLegend={false} />
      <ul className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {segments.map((segment) => (
          <li key={segment.key}>
            <Link
              to={segment.to}
              aria-label={t.directives.summary.viewGroup(segment.label, segment.value)}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-body-sm hover:bg-page-bg"
            >
              <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{
                    background: segment.hatched ? `repeating-linear-gradient(135deg, ${segment.color} 0 2px, ${segment.color}33 2px 5px)` : segment.color,
                  }}
                />
                {segment.badge ?? (
                  <>
                    <span aria-hidden="true" className="shrink-0 [&>svg]:size-4" style={{ color: segment.color }}>
                      {segment.icon}
                    </span>
                    <span className="truncate">{segment.label}</span>
                  </>
                )}
              </span>
              <span className="shrink-0 font-mono font-semibold text-text-primary">
                {formatNumber(segment.value, locale)}
                <span className="ml-1 font-sans text-caption font-normal text-text-muted">{percentOf(segment.value, total)}%</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function breakdownTable(caption: string, groupLabel: string, countLabel: string, shareLabel: string, segments: LinkedSegment[], locale: string) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return {
    caption,
    columns: [
      { key: 'group', label: groupLabel },
      { key: 'count', label: countLabel, numeric: true },
      { key: 'share', label: shareLabel, numeric: true },
    ],
    rows: segments.map((segment) => ({
      group: segment.label,
      count: formatNumber(segment.value, locale),
      share: `${percentOf(segment.value, total)}%`,
    })),
  }
}

/**
 * FR-DIR-003 AC2 groupings. Ordered completed -> on track -> approaching -> exceeded -> no
 * date so the status colours run green -> amber -> red and red never touches green
 * (CLAUDE.md Section 21); approaching uses the chart amber (#D97706), never the brand accent.
 */
function DueGroupCard({ summary, listLink }: SectionProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.directives.summary
  const due = t.directives.due

  const segments: LinkedSegment[] = [
    { key: 'completed', label: due.groupCompleted, value: summary.completed, color: CHART_COLORS.series1, icon: <CheckCircleIcon />, to: listLink({ due: 'completed' }) },
    { key: 'on_track', label: due.groupOnTrack, value: summary.on_track, color: CHART_COLORS.onTrack, icon: <CalendarDaysIcon />, to: listLink({ due: 'on_track' }) },
    { key: 'approaching', label: due.groupApproaching, value: summary.approaching, color: CHART_COLORS.atRisk, icon: <ClockIcon />, to: listLink({ due: 'approaching' }) },
    { key: 'overdue', label: due.groupOverdue, value: summary.overdue, color: CHART_COLORS.below, icon: <ExclamationTriangleIcon />, to: listLink({ due: 'overdue' }) },
    {
      key: 'no_date',
      label: due.groupNoDate,
      value: summary.no_target_date,
      color: CHART_COLORS.none,
      icon: <MinusCircleIcon />,
      hatched: true,
      to: listLink({ due: 'no_date' }),
    },
  ]

  return (
    <DashboardCard
      title={copy.dueTitle}
      icon={<CalendarDaysIcon />}
      tone="directive"
      subtitle={copy.dueSubtitle(summary.total - summary.cancelled)}
      table={breakdownTable(copy.dueCaption, copy.columnGroup, copy.columnCount, copy.columnShare, segments, locale)}
    >
      <LinkedBreakdown segments={segments} />
    </DashboardCard>
  )
}

/**
 * Workflow status distribution. The five workflow steps are ordinal, so they share one blue
 * ramp light -> dark (issued -> closed); cancelled sits outside the flow as hatched grey.
 * `summary.completed` counts completed + closed, so the completed step subtracts closed.
 */
function StatusCard({ summary, listLink }: SectionProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.directives.summary

  const steps: { status: DirectiveStatus; value: number; color: string; hatched?: boolean }[] = [
    { status: 'issued', value: summary.issued, color: ORDINAL_RAMP[0] },
    { status: 'acknowledged', value: summary.acknowledged, color: ORDINAL_RAMP[1] },
    { status: 'in_progress', value: summary.in_progress, color: ORDINAL_RAMP[2] },
    { status: 'completed', value: Math.max(0, summary.completed - summary.closed), color: ORDINAL_RAMP[3] },
    { status: 'closed', value: summary.closed, color: ORDINAL_RAMP[4] },
    { status: 'cancelled', value: summary.cancelled, color: CHART_COLORS.context, hatched: true },
  ]
  const segments: LinkedSegment[] = steps.map((step) => ({
    key: step.status,
    label: t.directives.status[step.status],
    value: step.value,
    color: step.color,
    hatched: step.hatched,
    badge: <DirectiveStatusBadge status={step.status} />,
    to: listLink({ status: step.status }),
  }))

  return (
    <DashboardCard
      title={copy.statusTitle}
      icon={<ChartPieIcon />}
      tone="info"
      subtitle={copy.statusSubtitle}
      table={breakdownTable(copy.statusCaption, copy.columnStatus, copy.columnCount, copy.columnShare, segments, locale)}
    >
      <LinkedBreakdown segments={segments} />
    </DashboardCard>
  )
}

const HEADER_CELL = 'px-3 py-2 text-left font-semibold text-text-secondary'
const NUMBER_HEADER_CELL = 'px-3 py-2 text-right font-semibold text-text-secondary'

function ByMissionCard({ summary, listLink, className }: SectionProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.directives.summary
  const rows = [...summary.by_mission].sort(
    (a, b) => a.completion_rate - b.completion_rate || (a.mission_name ?? '').localeCompare(b.mission_name ?? '', locale),
  )

  return (
    <DashboardCard title={copy.byMissionTitle} icon={<GlobeAltIcon />} tone="info" subtitle={copy.byMissionSubtitle} className={className}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body-sm">
          <caption className="sr-only">{copy.byMissionCaption}</caption>
          <thead className="bg-section-bg">
            <tr>
              <th scope="col" className={HEADER_CELL}>
                {copy.columnMission}
              </th>
              <th scope="col" className={NUMBER_HEADER_CELL}>
                {copy.columnTotal}
              </th>
              <th scope="col" className={`hidden sm:table-cell ${NUMBER_HEADER_CELL}`}>
                {copy.columnInProgress}
              </th>
              <th scope="col" className={NUMBER_HEADER_CELL}>
                {copy.columnOverdue}
              </th>
              <th scope="col" className={`${HEADER_CELL} min-w-32`}>
                {copy.columnCompletionRate}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const name = row.mission_name ?? '—'
              return (
                <tr key={row.mission_id} data-testid={`summary-mission-${row.mission_id}`} className="bg-white">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    <Link to={listLink({ mission_id: row.mission_id })} className="text-primary hover:underline">
                      {name}
                    </Link>
                  </th>
                  <td className="px-3 py-2 text-right font-mono text-text-primary">{formatNumber(row.total, locale)}</td>
                  <td className="hidden px-3 py-2 text-right font-mono text-text-secondary sm:table-cell">{formatNumber(row.in_progress, locale)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {row.overdue > 0 ? (
                      <Link
                        to={listLink({ mission_id: row.mission_id, due: 'overdue' })}
                        className="inline-flex items-center gap-1 font-semibold text-danger-soft-text hover:underline"
                      >
                        <ExclamationTriangleIcon aria-hidden="true" className="size-3.5" />
                        {formatNumber(row.overdue, locale)}
                      </Link>
                    ) : (
                      <span className="text-text-secondary">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Meter value={row.completion_rate} max={100} colorClass="bg-success" label={copy.completionRateLabel(name)} />
                      <span className="w-14 shrink-0 text-right font-mono text-caption text-text-primary">{formatPercent(row.completion_rate, locale)}</span>
                    </div>
                    <span className="sr-only">{copy.ofTotal(row.completed, row.total)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  )
}

function ByIssuerCard({ summary, listLink, className }: SectionProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.directives.summary
  const rows = [...summary.by_issuer].sort((a, b) => b.total - a.total || a.full_name.localeCompare(b.full_name, locale))

  return (
    <DashboardCard title={copy.byIssuerTitle} icon={<UserGroupIcon />} tone="directive" subtitle={copy.byIssuerSubtitle} className={className}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body-sm">
          <caption className="sr-only">{copy.byIssuerCaption}</caption>
          <thead className="bg-section-bg">
            <tr>
              <th scope="col" className={HEADER_CELL}>
                {copy.columnIssuer}
              </th>
              <th scope="col" className={NUMBER_HEADER_CELL}>
                {copy.columnTotal}
              </th>
              <th scope="col" className={NUMBER_HEADER_CELL}>
                {copy.columnCompleted}
              </th>
              <th scope="col" className={NUMBER_HEADER_CELL}>
                {copy.columnOverdue}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.user_id} data-testid={`summary-issuer-${row.user_id}`} className="bg-white">
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <Link to={listLink({ issued_by_user_id: row.user_id })} className="text-primary hover:underline">
                    {row.full_name}
                  </Link>
                </th>
                <td className="px-3 py-2 text-right font-mono text-text-primary">{formatNumber(row.total, locale)}</td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">{formatNumber(row.completed, locale)}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {row.overdue > 0 ? (
                    <Link
                      to={listLink({ issued_by_user_id: row.user_id, due: 'overdue' })}
                      className="inline-flex items-center gap-1 font-semibold text-danger-soft-text hover:underline"
                    >
                      <ExclamationTriangleIcon aria-hidden="true" className="size-3.5" />
                      {formatNumber(row.overdue, locale)}
                    </Link>
                  ) : (
                    <span className="text-text-secondary">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  )
}
