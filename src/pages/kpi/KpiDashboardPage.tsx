import { useId, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowDownRightIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpRightIcon,
  BuildingLibraryIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FlagIcon,
  LockClosedIcon,
  MapPinIcon,
  MinusIcon,
  PencilSquareIcon,
  PresentationChartLineIcon,
  ScaleIcon,
  SignalIcon,
  Squares2X2Icon,
  UserIcon,
} from '@heroicons/react/20/solid'
import {
  downloadKpiReport,
  getKpiDashboard,
  PERFORMANCE_STATUSES,
  type DashboardKpiRow,
  type KpiComplianceQuarter,
  type KpiDashboard,
  type KpiMissionHealth,
  type KpiPeriodInfo,
  type KpiPeriodQuery,
  type PerformanceStatus,
} from '../../api/kpi'
import { Modal } from '../../components/Modal'
import { Select } from '../../components/Select'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { ProgressRing } from '../../components/dashboard/visuals'
import { CHART_COLORS } from '../../components/dashboard/chartTheme'
import { useI18n } from '../../i18n/context'
import { retryUnlessClientError } from '../../lib/apiErrors'
import { localeFor } from '../../lib/formatters'
import { periodRange } from '../../lib/dashboardFormat'
import { KpiStatusBadge } from './KpiStatusBadge'
import { KpiPeriodBanner, KpiPeriodPicker } from './KpiPeriodControls'
import { KpiBulletBar, KpiBulletLegend, KpiStatusMark, KpiStatusStack, KpiTrendChart } from './KpiVisuals'
import { dataSourceLabel, formatDay, formatKpiValue, formatRatio, formatSigned, formatSignedRatio, periodQueryFrom, periodQueryKey, statusMarkBackground } from './kpiPresentation'

type SortKey = 'attention' | 'name' | 'attainment'

/** Weakest first: what needs attention leads. */
const ATTENTION_ORDER: Record<PerformanceStatus, number> = { below_target: 0, at_risk: 1, no_data: 2, pending: 3, no_target: 4, on_track: 5 }

/**
 * FR-KPI-008 to 011, 016: the KPI dashboard. Directors, the PS and the HRM&D Officer choose a
 * mission or the whole department; an attache sees their own mission, read-only (FR-KPI-010).
 * The period defaults to the half-year holding the latest settled quarter (FR-KPI-016) and can
 * be a quarter or a custom range (FR-KPI-009). Every number comes from GET /kpi-dashboard,
 * computed server-side by KpiPerformanceService — the same engine the comparison matrix,
 * target planner and report use. Mission, period and status filter live in the URL.
 */
export default function KpiDashboardPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.dashboard
  const [params, setParams] = useSearchParams()
  const periodQuery = periodQueryFrom(params)
  const missionParam = params.get('mission') || undefined
  const statusFilter = PERFORMANCE_STATUSES.find((status) => status === params.get('status'))
  const [sortKey, setSortKey] = useState<SortKey>('attention')
  const [detailId, setDetailId] = useState<string | null>(null)

  const dashboardQuery = useQuery({
    queryKey: ['kpi', 'dashboard', missionParam ?? 'all', periodQueryKey(periodQuery)],
    queryFn: () => getKpiDashboard({ ...periodQuery, mission_id: missionParam }),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })

  const downloadMutation = useMutation({
    mutationFn: ({ missionId, label }: { missionId: string; label: string }) => downloadKpiReport(missionId, label),
  })

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

  const error = dashboardQuery.error
  if (isAxiosError(error) && error.response?.status === 403) {
    return (
      <PageShell title={copy.title} subtitle={copy.subtitle.leadership}>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <PanelEmpty icon={<LockClosedIcon />} title={copy.notAvailableTitle} body={copy.notAvailableBody} />
        </div>
      </PageShell>
    )
  }

  const data = dashboardQuery.data
  if (dashboardQuery.isError && !data) {
    const message = isAxiosError(error) ? (error.response?.data as { errors?: string[] } | undefined)?.errors?.[0] : undefined
    return (
      <PageShell title={copy.title} subtitle={copy.subtitle.leadership}>
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
            <ExclamationTriangleIcon className="size-5" />
          </span>
          <p className="max-w-md text-body text-text-secondary">{message ?? copy.loadError}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void dashboardQuery.refetch()} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
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

  if (!data) {
    return (
      <PageShell title={copy.title} subtitle={copy.subtitle.leadership}>
        <div role="status" aria-live="polite" className="space-y-5">
          <span className="sr-only">{copy.loading}</span>
          <div aria-hidden="true" className="h-24 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
          <div aria-hidden="true" className="h-40 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
          <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-56 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
            ))}
          </div>
        </div>
      </PageShell>
    )
  }

  const subtitle = data.can.choose_mission ? (data.can.compare ? copy.subtitle.leadership : copy.subtitle.hrmd) : copy.subtitle.attache
  const reportLabel = data.period.type === 'range' ? null : data.period.label
  const kpis = sortRows(
    data.kpis.filter((row) => !statusFilter || row.status === statusFilter),
    sortKey,
  )
  const detail = detailId ? data.kpis.find((row) => row.kpi_definition_id === detailId) : undefined

  return (
    <PageShell
      title={copy.title}
      subtitle={subtitle}
      action={
        <div className="flex flex-wrap gap-2">
          {data.can.compare && (
            <HeaderLink to={`/kpi/comparison${data.period.type === 'range' ? `?from=${data.period.start}&to=${data.period.end}` : `?period=${encodeURIComponent(data.period.label)}`}`} icon={<ScaleIcon />}>
              {copy.actions.compare}
            </HeaderLink>
          )}
          {data.can.set_targets && (
            <HeaderLink to="/kpi/targets" icon={<FlagIcon />}>
              {copy.actions.setTargets}
            </HeaderLink>
          )}
          {data.can.record_actuals && (
            <HeaderLink to="/kpi/manual-entry" icon={<PencilSquareIcon />}>
              {copy.actions.recordActuals}
            </HeaderLink>
          )}
          {data.can.download_report && (
            <button
              type="button"
              disabled={reportLabel === null || downloadMutation.isPending}
              title={reportLabel === null ? copy.actions.downloadRangeHint : undefined}
              onClick={() => reportLabel && downloadMutation.mutate({ missionId: data.mission?.id ?? 'all', label: reportLabel })}
              className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowDownTrayIcon aria-hidden="true" className="size-4" />
              {downloadMutation.isPending ? copy.actions.downloading : copy.actions.download}
            </button>
          )}
        </div>
      }
    >
      {downloadMutation.isError && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-2 text-body-sm text-danger-soft-text">
          {copy.actions.downloadFailed}
        </p>
      )}

      <section aria-label={copy.filtersLabel} className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {data.can.choose_mission ? (
            <div className="w-full sm:w-72">
              <Select
                label={copy.missionLabel}
                value={data.mission?.id ?? ''}
                onChange={(event) => updateParams({ mission: event.target.value || null, status: null })}
                options={[{ value: '', label: copy.allMissions }, ...data.missions_available.map((mission) => ({ value: mission.id, label: mission.name }))]}
                className="w-full"
              />
            </div>
          ) : (
            data.mission && (
              <div className="flex flex-col gap-1">
                <span className="text-body-sm font-semibold text-text-secondary">{copy.missionLabel}</span>
                <span className="inline-flex h-10.5 items-center gap-2 rounded border border-border bg-section-bg px-3 text-body text-text-primary">
                  <MapPinIcon aria-hidden="true" className="size-4 text-text-muted" />
                  {data.mission.name}
                </span>
              </div>
            )
          )}
          <KpiPeriodPicker options={data.options} period={data.period} onChange={setPeriod} />
        </div>
        {dashboardQuery.isFetching && (
          <span role="status" className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
            <ArrowPathIcon aria-hidden="true" className="size-4 motion-safe:animate-spin" />
            {copy.updating}
          </span>
        )}
      </section>

      <KpiPeriodBanner period={data.period} />

      {data.mission && <MissionStrip data={data} />}

      {data.kpis.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <PanelEmpty icon={<PresentationChartLineIcon />} title={copy.empty.noKpisTitle} body={data.scope === 'mission' ? copy.empty.noKpisMission : copy.empty.noKpisDepartment} />
        </div>
      ) : (
        <>
          <SummaryPanel data={data} statusFilter={statusFilter} onFilter={(status) => updateParams({ status })} />

          {data.scope === 'mission' ? (
            <section aria-labelledby="kpi-cards-heading" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="kpi-cards-heading" className="text-h3 text-primary">
                    {copy.kpis.title}
                  </h2>
                  <p className="text-body-sm text-text-secondary">{copy.kpis.count(kpis.length, data.kpis.length)}</p>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <KpiBulletLegend />
                  <SortSelect value={sortKey} onChange={setSortKey} />
                </div>
              </div>
              {kpis.length === 0 ? (
                <div className="rounded-xl border border-border bg-white p-6 text-center shadow-sm">
                  <p className="text-body text-text-secondary">{copy.kpis.noMatch}</p>
                  <button type="button" onClick={() => updateParams({ status: null })} className="mt-2 text-body-sm font-semibold text-info-soft-text hover:underline">
                    {copy.summary.showAll}
                  </button>
                </div>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {kpis.map((row) => (
                    <li key={row.kpi_definition_id} className="min-w-0">
                      <KpiCard row={row} period={data.period} previousLabel={data.previous_period.label} onOpen={() => setDetailId(row.kpi_definition_id)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <div className="grid gap-4 lg:grid-cols-12">
              <DepartmentTotals data={data} rows={kpis} onOpen={setDetailId} className="lg:col-span-8" />
              <MissionsToWatch missions={data.missions ?? []} onView={(id) => updateParams({ mission: id, status: null })} className="lg:col-span-4" />
            </div>
          )}

          {data.compliance && <ComplianceStrip quarters={data.compliance} />}
        </>
      )}

      <Modal open={detail !== undefined} onClose={() => setDetailId(null)} title={detail ? copy.detail.title(detail.name) : undefined} size="3xl">
        {detail && <KpiDetail row={detail} data={data} locale={locale} onClose={() => setDetailId(null)} />}
      </Modal>
    </PageShell>
  )
}

function sortRows(rows: DashboardKpiRow[], key: SortKey): DashboardKpiRow[] {
  const sorted = [...rows]
  if (key === 'name') {
    return sorted.sort((a, b) => a.name.localeCompare(b.name))
  }
  if (key === 'attainment') {
    return sorted.sort((a, b) => (b.attainment ?? -1) - (a.attainment ?? -1))
  }
  return sorted.sort((a, b) => ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status] || (a.performance ?? 9) - (b.performance ?? 9) || a.name.localeCompare(b.name))
}

function PageShell({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7" data-testid="kpi-dashboard-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-primary">{title}</h1>
          <p className="mt-1 max-w-3xl text-body text-text-secondary">{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

function HeaderLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg [&>svg]:size-4">
      <span aria-hidden="true" className="[&>svg]:size-4">
        {icon}
      </span>
      {children}
    </Link>
  )
}

function SortSelect({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
  const { t } = useI18n()
  const copy = t.kpi.dashboard.kpis
  return (
    <div className="w-48">
      <Select
        label={copy.sortLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as SortKey)}
        options={(['attention', 'name', 'attainment'] as SortKey[]).map((key) => ({ value: key, label: copy.sort[key] }))}
        className="w-full"
      />
    </div>
  )
}

function MissionStrip({ data }: { data: KpiDashboard }) {
  const { t } = useI18n()
  const copy = t.kpi.dashboard
  const mission = data.mission
  if (!mission) {
    return null
  }
  return (
    <section aria-label={copy.missionLabel} className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-primary text-white">
          <BuildingLibraryIcon className="size-5" />
        </span>
        <span>
          <span className="block text-h4 text-primary">{mission.name}</span>
          {(mission.city || mission.host_country) && <span className="block text-caption text-text-secondary">{[mission.city, mission.host_country].filter(Boolean).join(', ')}</span>}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary">
        <UserIcon aria-hidden="true" className="size-4 text-text-muted" />
        {mission.attache ? copy.postedAttache(mission.attache.full_name) : copy.vacantPost}
      </span>
      <span className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary">
        <Squares2X2Icon aria-hidden="true" className="size-4 text-text-muted" />
        {mission.profiles.length > 0 ? copy.profile(mission.profiles.map((profile) => profile.name).join(', ')) : copy.tracksAll}
      </span>
    </section>
  )
}

function SummaryPanel({ data, statusFilter, onFilter }: { data: KpiDashboard; statusFilter?: PerformanceStatus; onFilter: (status: string | null) => void }) {
  const { t } = useI18n()
  const copy = t.kpi.dashboard.summary
  const headingId = useId()
  const { counts, total, judged, score } = data.summary
  const unitLabel = data.scope === 'mission' ? copy.unitKpis : copy.unitPairs

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <section className="flex items-center gap-5 rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-5" aria-label={copy.onTrackOf(counts.on_track, total, unitLabel)}>
        <ProgressRing value={counts.on_track} total={Math.max(total, 1)} label={copy.ringLabel(counts.on_track, total)} caption={copy.ringCaption} color={CHART_COLORS.onTrack} />
        <div className="min-w-0 space-y-1.5">
          <p className="text-h4 text-primary">{copy.onTrackOf(counts.on_track, total, unitLabel)}</p>
          <p className="text-body-sm text-text-secondary">{judged > 0 ? copy.judged(judged, total) : copy.nothingJudged}</p>
          <p className="flex flex-wrap items-baseline gap-x-2 text-body-sm text-text-secondary" title={copy.scoreHelp}>
            <span>{copy.score}</span>
            <span className="font-mono text-h4 font-semibold text-primary">{score === null ? '—' : formatRatio(score)}</span>
          </p>
          <p className="text-caption text-text-muted">{copy.scoreHelp}</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-7" aria-labelledby={headingId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={headingId} className="text-body-sm font-semibold text-text-secondary">
            {copy.filterByStatus}
          </h2>
          {statusFilter && (
            <button type="button" onClick={() => onFilter(null)} className="text-body-sm font-semibold text-info-soft-text hover:underline">
              {copy.showAll}
            </button>
          )}
        </div>
        <div role="group" aria-label={copy.filterByStatus} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PERFORMANCE_STATUSES.map((status) => {
            const active = statusFilter === status
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                disabled={counts[status] === 0 && !active}
                onClick={() => onFilter(active ? null : status)}
                data-testid={`kpi-status-tile-${status}`}
                className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors disabled:cursor-default disabled:opacity-55 ${
                  active ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border enabled:hover:bg-section-bg'
                }`}
              >
                <KpiStatusMark status={status} className="size-7" />
                <span className="min-w-0">
                  <span className="block font-mono text-h4 font-semibold leading-none text-primary">{counts[status]}</span>
                  <span className="mt-0.5 block truncate text-caption text-text-secondary">{t.kpi.status[status]}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-4">
          <KpiStatusStack counts={counts} />
        </div>
        <p className="sr-only">{copy.thresholds(Math.round(data.thresholds.on_track * 100), Math.round(data.thresholds.at_risk * 100))}</p>
        <p aria-hidden="true" className="mt-3 text-caption text-text-muted">
          {copy.thresholds(Math.round(data.thresholds.on_track * 100), Math.round(data.thresholds.at_risk * 100))}
        </p>
      </section>
    </div>
  )
}

function ChangeLine({ row, previousLabel }: { row: DashboardKpiRow; previousLabel: string }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.dashboard.card
  if (row.change === null) {
    return <p className="text-caption text-text-muted">{copy.noPrevious(previousLabel)}</p>
  }
  const Icon = row.change > 0 ? ArrowUpRightIcon : row.change < 0 ? ArrowDownRightIcon : MinusIcon
  return (
    <p className="inline-flex items-center gap-1 rounded-full bg-section-bg px-2 py-0.5 text-caption font-medium text-text-secondary">
      <Icon aria-hidden="true" className="size-3.5" />
      {row.change === 0 ? copy.unchanged(previousLabel) : copy.change(formatSigned(row.change, locale), row.change_pct === null ? null : formatSignedRatio(row.change_pct), previousLabel)}
    </p>
  )
}

function SourceChip({ row }: { row: Pick<DashboardKpiRow, 'source' | 'data_source'> }) {
  const { t } = useI18n()
  const live = row.source === 'live'
  return (
    <span
      title={live ? t.kpi.source.liveHelp(dataSourceLabel(row.data_source, t.kpi.dataSource)) : t.kpi.source.recordedHelp}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${live ? 'bg-info-soft text-info-soft-text' : 'bg-section-bg text-text-secondary'}`}
    >
      {live ? <SignalIcon aria-hidden="true" className="size-3" /> : <PencilSquareIcon aria-hidden="true" className="size-3" />}
      {live ? t.kpi.source.live : t.kpi.source.recorded}
    </span>
  )
}

function KpiCard({ row, period, previousLabel, onOpen }: { row: DashboardKpiRow; period: KpiPeriodInfo; previousLabel: string; onOpen: () => void }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.dashboard.card
  const running = !period.is_final && period.phase !== 'upcoming'
  const bulletLabel = copy.bulletLabel(row.name, formatKpiValue(row.actual, locale), formatKpiValue(row.target, locale), t.kpi.status[row.status])

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md" data-testid={`kpi-card-${row.kpi_definition_id}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-text-primary">{row.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SourceChip row={row} />
            {row.target_source === 'profile' && <span className="rounded-full bg-directive-soft px-2 py-0.5 text-caption font-semibold text-directive-soft-text">{copy.fromProfile}</span>}
          </div>
        </div>
        <KpiStatusBadge status={row.status} testId={`kpi-status-${row.kpi_definition_id}`} />
      </header>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="min-w-0">
          <span className="font-mono text-[2rem] font-semibold leading-none tracking-tight text-primary">{formatKpiValue(row.actual, locale)}</span>
          <span className="ml-1.5 text-body-sm text-text-secondary">{row.target === null ? copy.noTarget : copy.ofTarget(formatKpiValue(row.target, locale))}</span>
        </p>
        {row.attainment !== null && <span className="text-body-sm font-semibold text-text-secondary">{copy.attainment(formatRatio(row.attainment))}</span>}
      </div>

      <div className="mt-3">
        <KpiBulletBar actual={row.actual} target={row.target} expected={running ? row.expected : null} previous={row.previous_actual} status={row.status} label={bulletLabel} />
      </div>

      <div className="mt-3 space-y-1.5 text-caption text-text-secondary">
        {running && row.expected !== null && row.expected > 0 && row.target !== null && <p>{copy.expected(formatKpiValue(row.expected, locale))}</p>}
        {row.target !== null && row.actual !== null && row.actual < row.target && <p>{copy.remaining(formatKpiValue(row.target - row.actual, locale))}</p>}
        <ChangeLine row={row} previousLabel={previousLabel} />
      </div>

      {row.quarters.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={copy.byQuarter}>
          {row.quarters.map((quarter) => (
            <li key={quarter.label} className="rounded-md bg-page-bg px-2 py-1 text-caption text-text-secondary ring-1 ring-border">
              {quarter.label} <span className="font-mono font-semibold text-text-primary">{formatKpiValue(quarter.actual, locale)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={onOpen}
          aria-label={copy.detailsFor(row.name)}
          className="inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline"
        >
          {copy.details}
          <ChevronRightIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
    </article>
  )
}

function DepartmentTotals({ data, rows, onOpen, className }: { data: KpiDashboard; rows: DashboardKpiRow[]; onOpen: (id: string) => void; className: string }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.dashboard.department
  const running = !data.period.is_final && data.period.phase !== 'upcoming'

  return (
    <DashboardCard title={copy.title} subtitle={copy.subtitle} icon={<PresentationChartLineIcon />} tone="info" className={className} action={<KpiBulletLegend showPrevious />}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-body text-text-secondary">{t.kpi.dashboard.kpis.noMatch}</p>
      ) : (
        <ul className="-mx-2 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.kpi_definition_id}>
              <button
                type="button"
                onClick={() => onOpen(row.kpi_definition_id)}
                aria-label={t.kpi.dashboard.card.detailsFor(row.name)}
                data-testid={`kpi-total-${row.kpi_definition_id}`}
                className="group grid w-full gap-2 rounded-lg px-2 py-3 text-left hover:bg-page-bg md:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-body-sm font-semibold text-text-primary">{row.name}</span>
                    <SourceChip row={row} />
                    <KpiStatusBadge status={row.status} />
                  </span>
                  <span className="mt-2 block">
                    <KpiBulletBar
                      size="sm"
                      actual={row.actual}
                      target={row.target}
                      expected={running ? row.expected : null}
                      previous={row.previous_actual}
                      status={row.status}
                      label={t.kpi.dashboard.card.bulletLabel(row.name, formatKpiValue(row.actual, locale), formatKpiValue(row.target, locale), t.kpi.status[row.status])}
                    />
                  </span>
                  <span className="mt-1.5 block text-caption text-text-secondary">
                    {row.target === null
                      ? copy.noTargetsYet
                      : copy.totals(formatKpiValue(row.actual, locale), formatKpiValue(row.target, locale), row.missions_with_target ?? 0, row.missions_applicable ?? 0)}
                  </span>
                </span>
                <span className="min-w-0 self-center">
                  {row.distribution && <KpiStatusStackCompact counts={row.distribution} />}
                  <span className="mt-1 block text-caption text-text-secondary">{copy.onTrackMissions(row.distribution?.on_track ?? 0, row.missions_applicable ?? 0)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}

function KpiStatusStackCompact({ counts }: { counts: Record<PerformanceStatus, number> }) {
  const total = PERFORMANCE_STATUSES.reduce((sum, status) => sum + counts[status], 0)
  return (
    <span aria-hidden="true" className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-section-bg">
      {total > 0 &&
        PERFORMANCE_STATUSES.filter((status) => counts[status] > 0).map((status) => (
          <span
            key={status}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(counts[status] / total) * 100}%`, minWidth: 4, background: statusMarkBackground(status) }}
          />
        ))}
    </span>
  )
}

function MissionsToWatch({ missions, onView, className }: { missions: KpiMissionHealth[]; onView: (id: string) => void; className: string }) {
  const { t } = useI18n()
  const copy = t.kpi.dashboard.attention
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? missions : missions.slice(0, 8)

  return (
    <DashboardCard title={copy.title} subtitle={copy.subtitle} icon={<EyeIcon />} tone="atrisk" className={className}>
      {missions.length === 0 ? (
        <p className="py-6 text-center text-body text-text-secondary">{copy.empty}</p>
      ) : (
        <>
          <ol className="-mx-2 divide-y divide-border">
            {visible.map((mission) => (
              <li key={mission.mission_id}>
                <button type="button" onClick={() => onView(mission.mission_id)} aria-label={copy.view(mission.mission_name)} className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-page-bg">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-body-sm font-semibold text-text-primary">{mission.mission_name}</span>
                      <span className="shrink-0 font-mono text-body-sm font-semibold text-primary">{mission.score === null ? '—' : formatRatio(mission.score)}</span>
                    </span>
                    <span className="mt-1.5 block">
                      <KpiStatusStackCompact counts={mission.counts} />
                    </span>
                    <span className="mt-1 block text-caption text-text-secondary">{copy.counts(mission.counts.on_track, mission.counts.at_risk, mission.counts.below_target, mission.total)}</span>
                  </span>
                  <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-text-muted group-hover:text-primary" />
                </button>
              </li>
            ))}
          </ol>
          {missions.length > 8 && (
            <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="mt-3 text-body-sm font-semibold text-info-soft-text hover:underline">
              {expanded ? copy.showFewer : copy.showAll(missions.length)}
            </button>
          )}
        </>
      )}
    </DashboardCard>
  )
}

const COMPLIANCE_TONE: Record<KpiComplianceQuarter['status'], string> = {
  submitted_on_time: 'bg-success-soft text-success-soft-text',
  submitted_late: 'bg-atrisk-soft text-atrisk-soft-text',
  draft_in_progress: 'bg-info-soft text-info-soft-text',
  not_started: 'bg-section-bg text-text-secondary',
  not_due: 'bg-white text-text-muted',
}

function ComplianceStrip({ quarters }: { quarters: KpiComplianceQuarter[] }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.dashboard.compliance

  return (
    <DashboardCard title={copy.title} subtitle={copy.subtitle} icon={<ClipboardDocumentCheckIcon />} tone="success">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quarters.map((quarter) => (
          <li key={quarter.label} className={`rounded-lg p-3 ring-1 ring-border ${COMPLIANCE_TONE[quarter.status]}`} data-testid={`kpi-compliance-${quarter.label.replace(' ', '-')}`}>
            <p className="text-body-sm font-semibold">
              {quarter.label} <span className="font-normal">· {periodRange(quarter, locale)}</span>
            </p>
            <p className="mt-1 text-caption font-semibold">{copy.status[quarter.status]}</p>
            <p className="mt-0.5 text-caption">
              {quarter.submitted_at ? copy.submittedOn(formatDay(quarter.submitted_at, locale)) : copy.dueOn(formatDay(quarter.deadline, locale))}
              {quarter.is_overdue && !quarter.submitted_at && <span className="ml-1 font-semibold text-danger-soft-text">· {copy.overdue}</span>}
            </p>
            {quarter.report_id && (
              <Link to={`/reports/${quarter.report_id}`} className="mt-2 inline-flex items-center gap-1 text-caption font-semibold text-info-soft-text hover:underline">
                <DocumentTextIcon aria-hidden="true" className="size-3.5" />
                {copy.open}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </DashboardCard>
  )
}

function KpiDetail({ row, data, locale, onClose }: { row: DashboardKpiRow; data: KpiDashboard; locale: string; onClose: () => void }) {
  const { t } = useI18n()
  const copy = t.kpi.dashboard.detail
  const running = !data.period.is_final && data.period.phase !== 'upcoming'
  const firstOpen = data.period.quarters.find((quarter) => !quarter.settled)
  const openFrom = firstOpen?.start ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const stats: { label: string; value: string }[] = [
    { label: copy.stats.target, value: formatKpiValue(row.target, locale) },
    { label: copy.stats.actual, value: formatKpiValue(row.actual, locale) },
    ...(running && data.period.settled_quarters > 0 ? [{ label: copy.stats.expected, value: formatKpiValue(row.expected, locale) }] : []),
    { label: copy.stats.attainment, value: formatRatio(row.attainment) },
    { label: copy.stats.variance, value: formatSigned(row.variance, locale) },
    { label: copy.stats.previous(data.previous_period.label), value: formatKpiValue(row.previous_actual, locale) },
  ]

  return (
    <div className="space-y-5" data-testid="kpi-detail">
      <div className="flex flex-wrap items-center gap-2">
        <KpiStatusBadge status={row.status} />
        <SourceChip row={row} />
        <span className="text-caption text-text-secondary">{t.kpi.statusHelp[row.status]}</span>
      </div>
      {row.description && <p className="text-body-sm text-text-secondary">{row.description}</p>}
      <p className="text-caption text-text-secondary">
        {row.source === 'live' ? t.kpi.source.liveHelp(dataSourceLabel(row.data_source, t.kpi.dataSource)) : t.kpi.source.recordedHelp}
        {row.target_source && ` ${copy.targetSource[row.target_source]}`}
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-page-bg p-3 ring-1 ring-border">
            <dt className="text-caption text-text-secondary">{stat.label}</dt>
            <dd className="mt-1 font-mono text-h4 font-semibold text-primary">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="kpi-detail-quarters">
        <h3 id="kpi-detail-quarters" className="text-h4 text-primary">
          {copy.quartersTitle}
        </h3>
        <div className="relative mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-body-sm">
            <caption className="sr-only">{copy.quartersTitle}</caption>
            <thead className="bg-section-bg text-caption font-semibold uppercase tracking-wide text-text-secondary">
              <tr>
                <th scope="col" className="px-3 py-2">
                  {copy.columns.quarter}
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  {copy.columns.target}
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  {copy.columns.actual}
                </th>
                <th scope="col" className="px-3 py-2">
                  {copy.columns.settles}
                </th>
              </tr>
            </thead>
            <tbody>
              {row.quarters.map((quarter, index) => {
                const meta = data.period.quarters[index]
                return (
                  <tr key={quarter.label} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 font-medium text-text-primary">
                      {quarter.label} <span className="font-normal text-text-secondary">· {periodRange(quarter, locale)}</span>
                    </th>
                    <td className="px-3 py-2 text-right font-mono">{formatKpiValue(quarter.target, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatKpiValue(quarter.actual, locale)}</td>
                    <td className="px-3 py-2 text-text-secondary">{meta ? (meta.settled ? copy.settled : copy.settlesOn(formatDay(meta.deadline, locale))) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-caption text-text-muted">{copy.quarterTargetNote}</p>
      </section>

      <DashboardCard
        title={copy.trendTitle}
        subtitle={copy.trendSubtitle}
        icon={<PresentationChartLineIcon />}
        tone="info"
        className="shadow-none"
        table={{
          caption: copy.trendTitle,
          columns: [
            { key: 'quarter', label: copy.columns.quarter },
            { key: 'target', label: copy.columns.target, numeric: true },
            { key: 'actual', label: copy.columns.actual, numeric: true },
          ],
          rows: row.trend.map((quarter) => ({ quarter: `${quarter.label} · ${periodRange(quarter, locale)}`, target: formatKpiValue(quarter.target, locale), actual: formatKpiValue(quarter.actual, locale) })),
        }}
      >
        <KpiTrendChart quarters={row.trend} openFrom={openFrom} />
      </DashboardCard>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {data.can.set_targets && (
          <Link to="/kpi/targets" className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
            <FlagIcon aria-hidden="true" className="size-4" />
            {copy.setTarget}
          </Link>
        )}
        {data.can.record_actuals && row.source === 'recorded' && (
          <Link to="/kpi/manual-entry" className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
            <PencilSquareIcon aria-hidden="true" className="size-4" />
            {copy.recordActual}
          </Link>
        )}
        <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
          {copy.close}
        </button>
      </div>
    </div>
  )
}
