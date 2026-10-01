import { useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BarsArrowDownIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  GlobeAltIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PresentationChartLineIcon,
  TableCellsIcon,
  TrophyIcon,
} from '@heroicons/react/20/solid'
import {
  downloadKpiReport,
  getKpiComparison,
  saveBlob,
  type ComparisonKpiColumn,
  type ComparisonKpiRow,
  type ComparisonMissionRow,
  type KpiComparisonMatrix,
  type KpiPeriodQuery,
} from '../../api/kpi'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { SegmentedControl } from '../../components/dashboard/layout'
import { StatTile } from '../../components/dashboard/visuals'
import { useI18n } from '../../i18n/context'
import { retryUnlessClientError } from '../../lib/apiErrors'
import { localeFor } from '../../lib/formatters'
import { KpiPeriodBanner, KpiPeriodPicker } from './KpiPeriodControls'
import { KpiStatusMark, KpiStatusStack } from './KpiVisuals'
import { KpiStatusIcon } from './KpiStatusBadge'
import { formatKpiValue, formatRatio, periodQueryFrom, periodQueryKey, STATUS_COLOR, STATUS_TEXT, STATUS_TINT } from './kpiPresentation'

type ViewMode = 'attainment' | 'values'
type SortDirection = 'asc' | 'desc'

/** The ratio a ranking uses: performance against the target expected by now, else attainment. */
function rankValue(cell: ComparisonKpiRow | undefined): number | null {
  if (!cell || cell.applicable === false) {
    return null
  }
  return cell.performance ?? cell.attainment
}

/**
 * FR-KPI-013, 014; FR-SDT-011: every mission of the department against every KPI for a quarter,
 * a half-year (the default) or a custom range, rankable by any KPI or by overall score (AC1:
 * choosing a column reorders the missions). Each cell carries its status as tint, icon and text.
 * The export writes exactly the rows and order on screen (FR-KPI-014); the performance report is
 * the server-built CSV of FR-KPI-015. Period, ranking, view and search live in the URL.
 */
export default function KpiComparisonPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.comparison
  const [params, setParams] = useSearchParams()
  const periodQuery = periodQueryFrom(params)
  const sortKey = params.get('sort') ?? 'score'
  const direction: SortDirection = params.get('dir') === 'asc' ? 'asc' : 'desc'
  const view: ViewMode = params.get('view') === 'values' ? 'values' : 'attainment'
  const [search, setSearch] = useState(params.get('q') ?? '')

  const comparisonQuery = useQuery({
    queryKey: ['kpi', 'comparison', periodQueryKey(periodQuery)],
    queryFn: () => getKpiComparison(periodQuery),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })

  const downloadMutation = useMutation({ mutationFn: (label: string) => downloadKpiReport('all', label) })

  function updateParams(changes: Record<string, string | null>) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace: true },
    )
  }

  function setPeriod(query: KpiPeriodQuery) {
    updateParams({ period: query.period ?? null, from: query.from ?? null, to: query.to ?? null })
  }

  function sortBy(key: string) {
    if (key === sortKey) {
      updateParams({ dir: direction === 'desc' ? 'asc' : 'desc' })
    } else {
      updateParams({ sort: key, dir: key === 'name' ? 'asc' : 'desc' })
    }
  }

  const data = comparisonQuery.data
  const kpis = useMemo(() => data?.kpis ?? [], [data])
  const missions = useMemo(() => {
    if (!data) {
      return []
    }
    const needle = search.trim().toLowerCase()
    const filtered = data.missions.filter(
      (mission) => needle === '' || [mission.mission_name, mission.city, mission.host_country].some((value) => value?.toLowerCase().includes(needle)),
    )
    return sortMissions(filtered, sortKey, direction)
  }, [data, search, sortKey, direction])

  const error = comparisonQuery.error
  if (isAxiosError(error) && error.response?.status === 403) {
    return (
      <PageShell>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <PanelEmpty icon={<LockClosedIcon />} title={copy.notAvailableTitle} body={copy.notAvailableBody} />
        </div>
      </PageShell>
    )
  }

  if (comparisonQuery.isError && !data) {
    const message = isAxiosError(error) ? (error.response?.data as { errors?: string[] } | undefined)?.errors?.[0] : undefined
    return (
      <PageShell>
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
            <ExclamationTriangleIcon className="size-5" />
          </span>
          <p className="max-w-md text-body text-text-secondary">{message ?? copy.loadError}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void comparisonQuery.refetch()} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
              <ArrowPathIcon aria-hidden="true" className="size-4" />
              {copy.retry}
            </button>
            {message && (
              <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} className="inline-flex h-10 items-center rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
                {copy.resetView}
              </button>
            )}
          </div>
        </div>
      </PageShell>
    )
  }

  if (!data || !data.period || !data.options) {
    return (
      <PageShell>
        <div role="status" aria-live="polite" className="space-y-5">
          <span className="sr-only">{copy.loading}</span>
          <div aria-hidden="true" className="h-24 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
          <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-28 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
            ))}
          </div>
          <div aria-hidden="true" className="h-96 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
        </div>
      </PageShell>
    )
  }

  const period = data.period
  const reportLabel = period.type === 'range' ? null : period.label
  const scored = data.missions.filter((mission) => mission.summary?.score !== null && mission.summary?.score !== undefined)
  const best = [...scored].sort((a, b) => (b.summary?.score ?? 0) - (a.summary?.score ?? 0))[0]
  const weakest = [...scored].sort((a, b) => (a.summary?.score ?? 0) - (b.summary?.score ?? 0))[0]
  const summary = data.summary
  const focusKpi = kpis.find((kpi) => kpi.id === sortKey)

  return (
    <PageShell
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={missions.length === 0}
            onClick={() => exportCsv(data, missions, view, t.kpi.status, copy.csv, locale)}
            className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg disabled:opacity-60"
          >
            <TableCellsIcon aria-hidden="true" className="size-4" />
            {copy.actions.export}
          </button>
          {data.can?.download_report && (
            <button
              type="button"
              disabled={reportLabel === null || downloadMutation.isPending}
              title={reportLabel === null ? t.kpi.dashboard.actions.downloadRangeHint : undefined}
              onClick={() => reportLabel && downloadMutation.mutate(reportLabel)}
              className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowDownTrayIcon aria-hidden="true" className="size-4" />
              {downloadMutation.isPending ? t.kpi.dashboard.actions.downloading : copy.actions.report}
            </button>
          )}
          {data.can?.set_targets && (
            <Link to="/kpi/targets" className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
              <FlagIcon aria-hidden="true" className="size-4" />
              {copy.actions.setTargets}
            </Link>
          )}
        </div>
      }
    >
      {downloadMutation.isError && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-2 text-body-sm text-danger-soft-text">
          {t.kpi.dashboard.actions.downloadFailed}
        </p>
      )}

      <section aria-label={copy.filtersLabel} className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <KpiPeriodPicker options={data.options} period={period} onChange={setPeriod} />
        {comparisonQuery.isFetching && (
          <span role="status" className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
            <ArrowPathIcon aria-hidden="true" className="size-4 motion-safe:animate-spin" />
            {t.kpi.dashboard.updating}
          </span>
        )}
      </section>

      <KpiPeriodBanner period={period} />

      {data.missions.length === 0 || kpis.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <PanelEmpty icon={<PresentationChartLineIcon />} title={copy.emptyTitle} body={copy.empty} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile label={copy.tiles.missions} value={data.missions.length} icon={<GlobeAltIcon />} tone="info" footnote={copy.tiles.kpis(kpis.length)} />
            <StatTile
              label={copy.tiles.onTrack}
              value={summary ? `${summary.counts.on_track}/${summary.total}` : '—'}
              icon={<ChartBarIcon />}
              tone="success"
              footnote={summary ? copy.tiles.judged(summary.judged) : undefined}
            />
            <StatTile
              label={copy.tiles.best}
              value={best?.summary?.score !== null && best?.summary?.score !== undefined ? formatRatio(best.summary.score) : '—'}
              icon={<TrophyIcon />}
              tone="accent"
              footnote={best?.mission_name ?? copy.tiles.none}
            />
            <StatTile
              label={copy.tiles.weakest}
              value={weakest?.summary?.score !== null && weakest?.summary?.score !== undefined ? formatRatio(weakest.summary.score) : '—'}
              icon={<ExclamationTriangleIcon />}
              tone="atrisk"
              footnote={weakest?.mission_name ?? copy.tiles.none}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            {summary && (
              <DashboardCard title={copy.distribution.title} subtitle={copy.distribution.subtitle(summary.total)} icon={<ChartBarIcon />} tone="success" className="lg:col-span-5">
                <KpiStatusStack counts={summary.counts} />
                {data.thresholds && (
                  <p className="mt-3 text-caption text-text-muted">{t.kpi.dashboard.summary.thresholds(Math.round(data.thresholds.on_track * 100), Math.round(data.thresholds.at_risk * 100))}</p>
                )}
              </DashboardCard>
            )}
            <RankingCard data={data} missions={missions} sortKey={sortKey} onSortKey={(key) => updateParams({ sort: key, dir: key === 'name' ? 'asc' : 'desc' })} className="lg:col-span-7" />
          </div>

          <section aria-labelledby="kpi-matrix-heading" className="rounded-xl border border-border bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 id="kpi-matrix-heading" className="text-h3 text-primary">
                  {copy.matrix.title}
                </h2>
                <p className="text-body-sm text-text-secondary">
                  {focusKpi ? copy.matrix.rankedBy(focusKpi.name) : sortKey === 'name' ? copy.matrix.rankedByName : copy.matrix.rankedByScore}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="relative w-full sm:w-64">
                  <Input
                    type="search"
                    label={copy.matrix.searchLabel}
                    placeholder={copy.matrix.searchPlaceholder}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      updateParams({ q: event.target.value || null })
                    }}
                    className="w-full pl-9"
                  />
                  <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 size-4 text-text-muted" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-body-sm font-semibold text-text-secondary">{copy.matrix.showLabel}</span>
                  <SegmentedControl<ViewMode>
                    label={copy.matrix.showLabel}
                    value={view}
                    onChange={(value) => updateParams({ view: value === 'attainment' ? null : value })}
                    options={[
                      { value: 'attainment', label: copy.matrix.view.attainment },
                      { value: 'values', label: copy.matrix.view.values },
                    ]}
                  />
                </div>
              </div>
            </div>
            {missions.length === 0 ? (
              <p className="px-4 py-10 text-center text-body text-text-secondary">{copy.matrix.noMatch}</p>
            ) : (
              <MatrixTable data={data} kpis={kpis} missions={missions} view={view} sortKey={sortKey} direction={direction} onSort={sortBy} />
            )}
            <MatrixLegend />
          </section>
        </>
      )}
    </PageShell>
  )
}

function sortMissions(missions: ComparisonMissionRow[], key: string, direction: SortDirection): ComparisonMissionRow[] {
  const factor = direction === 'asc' ? 1 : -1
  const valueOf = (mission: ComparisonMissionRow): number | null =>
    key === 'score' ? (mission.summary?.score ?? null) : rankValue(mission.kpis.find((kpi) => kpi.kpi_definition_id === key))

  return [...missions].sort((a, b) => {
    if (key === 'name') {
      return factor * a.mission_name.localeCompare(b.mission_name)
    }
    const left = valueOf(a)
    const right = valueOf(b)
    if (left === null && right === null) {
      return a.mission_name.localeCompare(b.mission_name)
    }
    if (left === null) {
      return 1
    }
    if (right === null) {
      return -1
    }
    return factor * (left - right) || a.mission_name.localeCompare(b.mission_name)
  })
}

function PageShell({ action, children }: { action?: ReactNode; children: ReactNode }) {
  const { t } = useI18n()
  const copy = t.kpi.comparison
  return (
    <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7" data-testid="kpi-comparison-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-primary">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-body text-text-secondary">{copy.subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

function RankingCard({
  data,
  missions,
  sortKey,
  onSortKey,
  className,
}: {
  data: KpiComparisonMatrix
  missions: ComparisonMissionRow[]
  sortKey: string
  onSortKey: (key: string) => void
  className: string
}) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.comparison.ranking
  const kpis = data.kpis ?? []
  const rankingKey = sortKey === 'name' ? 'score' : sortKey
  const focus = kpis.find((kpi) => kpi.id === rankingKey)
  const rows = sortMissions(missions, rankingKey, 'desc').map((mission) => {
    const cell = focus ? mission.kpis.find((kpi) => kpi.kpi_definition_id === focus.id) : undefined
    return {
      id: mission.mission_id,
      name: mission.mission_name,
      ratio: focus ? rankValue(cell) : (mission.summary?.score ?? null),
      status: cell?.status,
      detail: focus && cell ? copy.cellDetail(formatKpiValue(cell.actual, locale), formatKpiValue(cell.target, locale)) : mission.summary ? copy.scoreDetail(mission.summary.counts.on_track, mission.summary.total) : '',
      applicable: cell?.applicable !== false,
    }
  })
  const scaleMax = Math.max(1.2, ...rows.map((row) => Math.min(row.ratio ?? 0, 2)))

  return (
    <DashboardCard
      title={copy.title}
      subtitle={focus ? copy.subtitleKpi : copy.subtitleScore}
      icon={<BarsArrowDownIcon />}
      tone="info"
      className={className}
      action={
        <div className="w-60 max-w-full">
          <Select
            aria-label={copy.rankBy}
            value={rankingKey}
            onChange={(event) => onSortKey(event.target.value)}
            options={[{ value: 'score', label: copy.overall }, ...kpis.map((kpi) => ({ value: kpi.id, label: kpi.name }))]}
            className="w-full"
          />
        </div>
      }
    >
      <ol className="space-y-2" aria-label={focus ? copy.listLabel(focus.name) : copy.listLabelScore}>
        {rows.map((row, index) => (
          <li key={row.id} className="grid grid-cols-[1.5rem_minmax(0,7.5rem)_1fr_auto] items-center gap-2">
            <span className="text-right font-mono text-caption text-text-muted">{index + 1}</span>
            <span className="truncate text-body-sm font-medium text-text-primary" title={row.name}>
              {row.name}
            </span>
            <span aria-hidden="true" className="relative h-3 rounded-full bg-section-bg">
              {row.ratio !== null && (
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(Math.min(row.ratio, 2) / scaleMax) * 100}%`, background: row.status ? STATUS_COLOR[row.status] : '#2a78d6' }}
                />
              )}
              <span className="absolute -inset-y-1 w-0.5 rounded-full bg-primary" style={{ left: `${(1 / scaleMax) * 100}%` }} />
            </span>
            <span className="flex items-center gap-1.5 text-right text-caption text-text-secondary">
              {row.status && <KpiStatusIcon status={row.status} className={`size-3.5 ${STATUS_TEXT[row.status]}`} />}
              <span className="font-mono text-body-sm font-semibold text-text-primary">{row.applicable ? (row.ratio === null ? '—' : formatRatio(row.ratio)) : copy.notTracked}</span>
              <span className="hidden sm:inline">{row.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-caption text-text-muted">{copy.note}</p>
    </DashboardCard>
  )
}

function MatrixTable({
  data,
  kpis,
  missions,
  view,
  sortKey,
  direction,
  onSort,
}: {
  data: KpiComparisonMatrix
  kpis: ComparisonKpiColumn[]
  missions: ComparisonMissionRow[]
  view: ViewMode
  sortKey: string
  direction: SortDirection
  onSort: (key: string) => void
}) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.comparison.matrix
  const captionId = useId()

  function sortState(key: string): 'ascending' | 'descending' | 'none' {
    return key === sortKey ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
  }

  function SortIcon({ column }: { column: string }) {
    const state = sortState(column)
    const Icon = state === 'ascending' ? ChevronUpIcon : state === 'descending' ? ChevronDownIcon : ChevronUpDownIcon
    return <Icon aria-hidden="true" className={`size-4 shrink-0 ${state === 'none' ? 'text-text-muted' : 'text-primary'}`} />
  }

  return (
    <div className="relative overflow-x-auto" data-testid="kpi-matrix">
      <table className="min-w-full border-separate border-spacing-0 text-body-sm" aria-describedby={captionId}>
        <caption id={captionId} className="sr-only">
          {copy.caption(data.cycle_label)}
        </caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={sortState('name') === 'none' ? (sortState('score') === 'none' ? 'none' : sortState('score')) : sortState('name')} className="sticky left-0 z-10 min-w-32 border-b border-border bg-section-bg px-3 py-2 text-left align-bottom sm:min-w-44">
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => onSort('name')} className="inline-flex items-center gap-1 font-semibold text-text-secondary hover:text-primary">
                  {copy.columnMission}
                  <SortIcon column="name" />
                </button>
                <button type="button" onClick={() => onSort('score')} className="inline-flex items-center gap-1 text-caption font-semibold text-text-secondary hover:text-primary">
                  {copy.columnScore}
                  <SortIcon column="score" />
                </button>
              </div>
            </th>
            {kpis.map((kpi) => (
              <th key={kpi.id} scope="col" aria-sort={sortState(kpi.id)} className="min-w-36 border-b border-border bg-section-bg px-2 py-2 text-left align-bottom">
                <button
                  type="button"
                  onClick={() => onSort(kpi.id)}
                  title={copy.sortBy(kpi.name)}
                  className={`inline-flex items-start gap-1 text-left text-caption font-semibold leading-snug hover:text-primary ${sortKey === kpi.id ? 'text-primary' : 'text-text-secondary'}`}
                >
                  <span className="line-clamp-4">{kpi.name}</span>
                  <SortIcon column={kpi.id} />
                </button>
                {kpi.source === 'live' && <span className="mt-1 block text-[0.6875rem] font-semibold uppercase tracking-wide text-info-soft-text">{t.kpi.source.live}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {missions.map((mission) => (
            <tr key={mission.mission_id} data-testid={`kpi-matrix-row-${mission.mission_id}`}>
              <th scope="row" className="sticky left-0 z-10 border-b border-border bg-white px-3 py-2 text-left align-top">
                <Link to={`/kpi/dashboard?mission=${mission.mission_id}&${periodLink(data)}`} className="font-semibold text-primary hover:underline">
                  {mission.mission_name}
                </Link>
                {mission.host_country && <span className="block text-caption font-normal text-text-secondary">{mission.host_country}</span>}
                <span className="mt-1 block text-caption font-normal text-text-secondary">
                  {copy.score} <span className="font-mono font-semibold text-text-primary">{mission.summary?.score === null || mission.summary?.score === undefined ? '—' : formatRatio(mission.summary.score)}</span>
                </span>
              </th>
              {kpis.map((kpi) => {
                const cell = mission.kpis.find((row) => row.kpi_definition_id === kpi.id)
                return <MatrixCell key={kpi.id} cell={cell} missionName={mission.mission_name} kpiName={kpi.name} view={view} locale={locale} />
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="sticky left-0 z-10 border-t-2 border-border-muted bg-white px-3 py-2 text-left font-semibold text-text-secondary">
              {copy.departmentTotal}
            </th>
            {kpis.map((kpi) => (
              <td key={kpi.id} className="border-t-2 border-border-muted px-2 py-2 align-top text-caption">
                <span className="flex items-center gap-1.5">
                  <KpiStatusIcon status={kpi.total.status} className={`size-3.5 ${STATUS_TEXT[kpi.total.status]}`} />
                  <span className="font-mono font-semibold text-text-primary">
                    {formatKpiValue(kpi.total.actual, locale)}/{formatKpiValue(kpi.total.target, locale)}
                  </span>
                </span>
                <span className="mt-0.5 block text-text-secondary">{copy.onTrackOf(kpi.total.distribution.on_track, kpi.total.missions_applicable)}</span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function periodLink(data: KpiComparisonMatrix): string {
  const period = data.period
  if (period?.type === 'range') {
    return `from=${period.start}&to=${period.end}`
  }
  return `period=${encodeURIComponent(data.cycle_label)}`
}

function MatrixCell({ cell, missionName, kpiName, view, locale }: { cell?: ComparisonKpiRow; missionName: string; kpiName: string; view: ViewMode; locale: string }) {
  const { t } = useI18n()
  const copy = t.kpi.comparison.matrix

  if (!cell || cell.applicable === false) {
    return (
      <td className="border-b border-border px-2 py-2 align-top text-caption text-text-muted" aria-label={copy.notTrackedAria(missionName, kpiName)}>
        {copy.notTracked}
      </td>
    )
  }

  const status = t.kpi.status[cell.status]
  const label = copy.cellAria(missionName, kpiName, formatKpiValue(cell.actual, locale), formatKpiValue(cell.target, locale), formatRatio(cell.attainment), status)
  const primary = view === 'attainment' ? formatRatio(cell.attainment) : formatKpiValue(cell.actual, locale)
  const secondary = view === 'attainment' ? `${formatKpiValue(cell.actual, locale)}/${formatKpiValue(cell.target, locale)}` : copy.ofTarget(formatKpiValue(cell.target, locale))

  return (
    <td className={`border-b border-white px-2 py-2 align-top ${STATUS_TINT[cell.status]}`} title={label} data-testid={`kpi-cell-${cell.kpi_definition_id}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="flex items-center gap-1.5">
        <KpiStatusMark status={cell.status} className="size-4.5" />
        <span className={`font-mono text-body-sm font-semibold ${cell.status === 'no_target' ? 'text-text-muted' : 'text-text-primary'}`}>{primary}</span>
      </span>
      <span aria-hidden="true" className={`mt-0.5 block text-caption ${STATUS_TEXT[cell.status]}`}>
        {secondary}
      </span>
    </td>
  )
}

function MatrixLegend() {
  const { t } = useI18n()
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-caption text-text-secondary">
      {(['on_track', 'at_risk', 'below_target', 'pending', 'no_data', 'no_target'] as const).map((status) => (
        <li key={status} className="inline-flex items-center gap-1.5">
          <KpiStatusMark status={status} className="size-4" />
          {t.kpi.status[status]}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span className="font-semibold text-text-muted">{t.kpi.comparison.matrix.notTracked}</span>
        {t.kpi.comparison.matrix.notTrackedHelp}
      </li>
    </ul>
  )
}

/**
 * FR-KPI-014: the matrix exactly as displayed — the filtered missions in their current order —
 * with each KPI's target, actual, attainment and status.
 */
function exportCsv(
  data: KpiComparisonMatrix,
  missions: ComparisonMissionRow[],
  view: ViewMode,
  statusLabels: Record<string, string>,
  copy: { title: string; period: string; generated: string; mission: string; country: string; score: string; target: string; actual: string; attainment: string; status: string; notTracked: string },
  locale: string,
) {
  const kpis = data.kpis ?? []
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines: string[] = [
    escape(copy.title),
    [escape(copy.period), escape(`${data.cycle_label}${data.period ? ` (${data.period.start} – ${data.period.end})` : ''}`)].join(','),
    [escape(copy.generated), escape(new Date().toLocaleString(locale))].join(','),
    '',
    [
      copy.mission,
      copy.country,
      copy.score,
      ...kpis.flatMap((kpi) => [`${kpi.name} — ${copy.target}`, `${kpi.name} — ${copy.actual}`, `${kpi.name} — ${copy.attainment}`, `${kpi.name} — ${copy.status}`]),
    ]
      .map(escape)
      .join(','),
  ]

  missions.forEach((mission) => {
    const cells = kpis.flatMap((kpi) => {
      const cell = mission.kpis.find((row) => row.kpi_definition_id === kpi.id)
      if (!cell || cell.applicable === false) {
        return ['', '', '', copy.notTracked]
      }
      return [cell.target ?? '', cell.actual ?? '', cell.attainment === null ? '' : Math.round(cell.attainment * 1000) / 10, statusLabels[cell.status]]
    })
    lines.push(
      [mission.mission_name, mission.host_country ?? '', mission.summary?.score === null || mission.summary?.score === undefined ? '' : Math.round(mission.summary.score * 1000) / 10, ...cells].map(escape).join(','),
    )
  })

  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  saveBlob(blob, `kpi-comparison-${data.cycle_label.replace(/[^A-Za-z0-9]+/g, '-')}${view === 'values' ? '-values' : ''}.csv`)
}
