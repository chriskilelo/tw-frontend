import { useId, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  FunnelIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MinusIcon,
  QueueListIcon,
  RectangleStackIcon,
  ScaleIcon,
  TableCellsIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import {
  GOVERNANCE_ITEM_TYPES,
  getMfaAwarenessSummary,
  getNationalOverview,
  getSubmissionLog,
  type CountsByType,
  type GovernanceItemType,
  type MfaAwarenessSummary,
  type SubmissionLogFilters,
} from '../../api/governance'
import { useAuth } from '../../hooks/useAuth'
import { Select } from '../../components/Select'
import { Pagination, DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from '../../components/Pagination'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { SegmentedControl } from '../../components/dashboard/layout'
import { DeltaPill, RankedBars, StackedBar, StatTile } from '../../components/dashboard/visuals'
import { useI18n } from '../../i18n/context'
import { formatDate, formatRelativeTime, localeFor } from '../../lib/formatters'
import { formatNumber } from '../../lib/dashboardFormat'
import { ActivityTrendCard, GovernanceUnavailable, ScrollRegion, SummarySkeleton, TypeBadge, TypeChip, ViewOnlyPill } from './governanceUi'
import { TYPE_STYLE, isGovernanceType, retryUnlessRefused, useQuarterLabel } from './governanceTheme'

type View = 'overview' | 'log' | 'national'
type ParamKey = 'view' | 'ministry_id' | 'mission_id' | 'type' | 'period' | 'page' | 'per_page'
type NationalOrder = 'activity' | 'change' | 'name'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const QUARTER_PATTERN = /^Q[1-4] \d{4}$/

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function uuidParam(value: string | null): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined
}

/**
 * FR-MFA-001 to 003: the MFA HQ Officer's and MFA Principal Secretary's aggregate view of trade
 * submissions across every mission and department. Three views: an overview of counts by
 * mission, department, type and quarter (FR-MFA-001); a submission log showing only each
 * entry's type, date, mission and department (AC2); and, for the Principal Secretary, a
 * national comparison of every mission and department against the quarter before (FR-MFA-003).
 * Each mission opens its FR-MFA-002 drill-down. No record content is ever requested or shown,
 * and nothing here changes a record (BR-020). The API decides access: a role outside the view,
 * or a non-Principal-Secretary opening the national comparison, gets its refusal explained.
 */
export default function MfaAwarenessPage() {
  const { t } = useI18n()
  const copy = t.governance.mfaAwareness
  const { role } = useAuth()
  const isPrincipalSecretary = role?.name === 'MFA Principal Secretary'

  const [searchParams, setSearchParams] = useSearchParams()
  const rawView = searchParams.get('view')
  const view: View = rawView === 'log' || rawView === 'national' ? rawView : 'overview'
  const ministryId = uuidParam(searchParams.get('ministry_id'))
  const rawPeriod = searchParams.get('period')
  const period = rawPeriod && QUARTER_PATTERN.test(rawPeriod) ? rawPeriod : undefined

  function updateParams(changes: Partial<Record<ParamKey, string | null>>, resetPage = true) {
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
        if (resetPage) {
          next.delete('page')
        }
        return next
      },
      { replace: true },
    )
  }

  // The overview figures double as the filter options (departments, missions, quarters) for
  // every view, and as the access check: a refusal here is the page's refusal.
  const summaryQuery = useQuery({
    queryKey: ['mfa-awareness', 'summary', ministryId ?? null, view === 'overview' ? (period ?? null) : null],
    queryFn: () => getMfaAwarenessSummary({ ministry_id: ministryId, period: view === 'overview' ? period : undefined }),
    retry: retryUnlessRefused,
    placeholderData: keepPreviousData,
  })

  if (summaryQuery.isError && !summaryQuery.data) {
    return (
      <PageShell>
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        <GovernanceUnavailable error={summaryQuery.error} forbiddenBody={t.governance.unavailable.mfaBody} onRetry={() => void summaryQuery.refetch()} />
      </PageShell>
    )
  }

  const summary = summaryQuery.data
  const views: { key: View; icon: ReactNode }[] = [
    { key: 'overview', icon: <ChartBarSquareIcon /> },
    { key: 'log', icon: <TableCellsIcon /> },
    ...(isPrincipalSecretary || view === 'national' ? [{ key: 'national' as const, icon: <ScaleIcon /> }] : []),
  ]

  return (
    <PageShell>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-h1 text-primary">{copy.title}</h1>
          <ViewOnlyPill label={t.governance.totalsOnly} />
        </div>
        <p className="text-body text-text-secondary">{copy.subtitle}</p>
      </header>

      <p className="flex items-start gap-2 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-body-sm text-info-soft-text" data-testid="aggregate-note">
        <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {copy.aggregateNote}
      </p>

      <nav aria-label={copy.viewsLabel} className="flex flex-wrap gap-1 rounded-xl border border-border bg-page-bg p-1 sm:inline-flex">
        {views.map((option) => {
          const active = view === option.key
          const params = new URLSearchParams(searchParams)
          params.delete('page')
          if (option.key === 'overview') {
            params.delete('view')
          } else {
            params.set('view', option.key)
          }
          const query = params.toString()
          return (
            <Link
              key={option.key}
              to={query ? `?${query}` : '.'}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-body-sm font-semibold transition-colors [&_svg]:size-4 ${
                active ? 'bg-white text-primary shadow-sm ring-1 ring-border' : 'text-text-secondary hover:text-primary'
              }`}
            >
              <span aria-hidden="true" className="contents">
                {option.icon}
              </span>
              {copy.views[option.key]}
            </Link>
          )
        })}
      </nav>

      {view === 'overview' &&
        (summary ? <OverviewView summary={summary} ministryId={ministryId} period={period} onChange={updateParams} isRefreshing={summaryQuery.isFetching} /> : <SummarySkeleton label={t.common.loading} />)}
      {view === 'log' && <SubmissionLogView summary={summary} searchParams={searchParams} onChange={updateParams} />}
      {view === 'national' && <NationalView summary={summary} period={period} onChange={updateParams} />}
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-310 space-y-6 px-4 py-6 sm:px-7">{children}</div>
}

function FilterBar({ label, children, footer }: { label: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">{footer}</div>}
    </div>
  )
}

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline">
      <XMarkIcon aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
}

function useQuarterOptions(summary: MfaAwarenessSummary | undefined, selected: string | undefined) {
  const quarterLabel = useQuarterLabel()
  const options = [...(summary?.by_period ?? [])].reverse().map((point) => ({ value: point.label, label: quarterLabel(point) }))
  if (selected && !options.some((option) => option.value === selected)) {
    options.push({ value: selected, label: selected })
  }
  return options
}

// --- Overview (FR-MFA-001) -----------------------------------------------------------

function OverviewView({
  summary,
  ministryId,
  period,
  onChange,
  isRefreshing,
}: {
  summary: MfaAwarenessSummary
  ministryId: string | undefined
  period: string | undefined
  onChange: (changes: Partial<Record<ParamKey, string | null>>) => void
  isRefreshing: boolean
}) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.mfaAwareness
  const quarterOptions = useQuarterOptions(summary, period)
  const scopeLabel = summary.scope.period ? copy.tiles.inPeriod(summary.scope.period.label) : copy.tiles.toDate

  const activeMissions = summary.by_mission.filter((mission) => mission.active).length
  const missionsReporting = summary.by_mission.filter((mission) => mission.total > 0).length
  const departmentsReporting = summary.by_ministry.filter((ministry) => ministry.total > 0).length
  const quarters = summary.by_period
  const thisQuarter = quarters[quarters.length - 1]
  const lastQuarter = quarters[quarters.length - 2]

  return (
    <div className={`space-y-6 ${isRefreshing ? 'opacity-80 transition-opacity' : 'transition-opacity'}`} data-testid="mfa-overview">
      <FilterBar
        label={copy.filters.label}
        footer={
          (ministryId || period) && (
            <>
              <span />
              <ClearButton label={copy.filters.clear} onClick={() => onChange({ ministry_id: null, period: null })} />
            </>
          )
        }
      >
        <div className="md:w-72">
          <Select
            label={copy.filters.department}
            value={ministryId ?? ''}
            onChange={(event) => onChange({ ministry_id: event.target.value || null })}
            placeholder={copy.filters.allDepartments}
            options={summary.ministries.map((ministry) => ({ value: ministry.id, label: ministry.name }))}
            className="w-full"
          />
        </div>
        <div className="md:w-72">
          <Select
            label={copy.filters.period}
            value={period ?? ''}
            onChange={(event) => onChange({ period: event.target.value || null })}
            placeholder={t.governance.quarter.allTime}
            options={quarterOptions}
            className="w-full"
          />
        </div>
      </FilterBar>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={copy.tiles.submissions} value={formatNumber(summary.total, locale)} icon={<RectangleStackIcon />} tone="info" footnote={scopeLabel} />
        <StatTile
          label={copy.tiles.missions}
          value={formatNumber(missionsReporting, locale)}
          icon={<MapPinIcon />}
          tone="accent"
          footnote={activeMissions > 0 ? copy.tiles.ofMissions(activeMissions) : undefined}
        />
        <StatTile
          label={copy.tiles.departments}
          value={formatNumber(departmentsReporting, locale)}
          icon={<BuildingLibraryIcon />}
          tone="directive"
          footnote={summary.ministries.length > 0 ? copy.tiles.ofDepartments(summary.ministries.length) : undefined}
        />
        {thisQuarter && (
          <StatTile
            label={copy.tiles.thisQuarter}
            value={formatNumber(thisQuarter.total, locale)}
            icon={<GlobeAltIcon />}
            tone="success"
            delta={lastQuarter ? { current: thisQuarter.total, previous: lastQuarter.total } : undefined}
            footnote={thisQuarter.is_partial ? t.dashboard.common.quarterInProgress : undefined}
            trend={quarters.map((quarter) => quarter.total)}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ActivityTrendCard className="lg:col-span-8" points={summary.by_period} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          <DashboardCard title={copy.byType.title} icon={<RectangleStackIcon />} tone="neutral" subtitle={copy.byType.subtitle(scopeLabel.toLowerCase())}>
            <StackedBar
              segments={GOVERNANCE_ITEM_TYPES.map((type) => ({
                key: type,
                label: t.governance.types[type],
                value: summary.by_type[type] ?? 0,
                color: TYPE_STYLE[type].color,
                icon: TYPE_STYLE[type].icon,
              }))}
            />
          </DashboardCard>
          <DashboardCard title={copy.byDepartment.title} icon={<BuildingLibraryIcon />} tone="directive" subtitle={copy.byDepartment.subtitle(scopeLabel.toLowerCase())}>
            {summary.by_ministry.length > 0 ? (
              <RankedBars
                items={summary.by_ministry.map((ministry) => ({ name: ministry.ministry_name, count: ministry.total, note: copy.byDepartment.missions(ministry.missions_reporting) }))}
                barClassName="bg-chart-3"
              />
            ) : (
              <PanelEmpty icon={<BuildingLibraryIcon />} title={t.dashboard.common.emptyTitle} body={t.dashboard.common.empty} />
            )}
          </DashboardCard>
        </div>
      </div>

      <section aria-labelledby="mfa-missions-heading" className="min-w-0 rounded-xl border border-border bg-white shadow-sm">
        <header className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-text [&>svg]:size-5">
            <MapPinIcon />
          </span>
          <div className="min-w-0">
            <h2 id="mfa-missions-heading" className="text-h3 text-primary">
              {copy.missions.title}
            </h2>
            <p className="mt-0.5 text-body-sm text-text-secondary">{copy.missions.subtitle}</p>
          </div>
        </header>
        <div className="p-4 sm:p-5">
          {summary.by_mission.length === 0 ? (
            <PanelEmpty icon={<MapPinIcon />} title={t.dashboard.common.emptyTitle} body={copy.missions.empty} />
          ) : (
            <MissionCountsTable summary={summary} />
          )}
        </div>
      </section>
    </div>
  )
}

function MissionCountsTable({ summary }: { summary: MfaAwarenessSummary }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.mfaAwareness.missions
  const max = Math.max(1, ...summary.by_mission.map((mission) => mission.total))
  const params = new URLSearchParams()
  if (summary.scope.ministry_id) {
    params.set('ministry_id', summary.scope.ministry_id)
  }
  const query = params.toString()

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border text-body-sm" data-testid="mfa-missions-table">
        <caption className="sr-only">{copy.title}</caption>
        <thead className="bg-section-bg">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">
              {copy.mission}
            </th>
            {GOVERNANCE_ITEM_TYPES.map((type) => (
              <th key={type} scope="col" className="hidden px-3 py-2 text-right font-semibold text-text-secondary md:table-cell">
                {t.governance.types[type]}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-semibold text-text-secondary">
              {copy.total}
            </th>
            <th scope="col" className="hidden whitespace-nowrap px-3 py-2 text-left font-semibold text-text-secondary sm:table-cell">
              {copy.lastActivity}
            </th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">{copy.view}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {summary.by_mission.map((mission) => (
            <tr key={mission.mission_id} className="tw-table-row bg-white hover:bg-section-bg">
              <th scope="row" className="min-w-40 px-3 py-2.5 text-left font-normal">
                <span className="block font-semibold text-primary">{mission.mission_name}</span>
                <span className="block text-caption text-text-muted">
                  {mission.host_country}
                  {!mission.active && ` · ${copy.inactive}`}
                </span>
              </th>
              {GOVERNANCE_ITEM_TYPES.map((type) => (
                <td key={type} className="hidden px-3 py-2.5 text-right font-mono text-text-primary md:table-cell">
                  {formatNumber(mission.by_type[type] ?? 0, locale)}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right">
                <span className="font-mono font-semibold text-text-primary">{formatNumber(mission.total, locale)}</span>
                <span aria-hidden="true" className="mt-1 ml-auto block h-1.5 w-20 overflow-hidden rounded-full bg-section-bg">
                  <span className="block h-full rounded-full bg-chart-2" style={{ width: `${Math.max(mission.total > 0 ? 4 : 0, (mission.total / max) * 100)}%` }} />
                </span>
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-text-secondary sm:table-cell">
                {mission.last_activity_at ? formatRelativeTime(mission.last_activity_at, locale) : <span className="text-text-muted">{copy.never}</span>}
              </td>
              <td className="px-3 py-2.5 text-right">
                <Link
                  to={`/mfa-awareness/missions/${mission.mission_id}${query ? `?${query}` : ''}`}
                  aria-label={copy.viewAria(mission.mission_name)}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-body-sm font-semibold text-info-soft-text hover:underline"
                >
                  {copy.view}
                  <ArrowRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Submission log (FR-MFA-001 AC2) -------------------------------------------------

function SubmissionLogView({
  summary,
  searchParams,
  onChange,
}: {
  summary: MfaAwarenessSummary | undefined
  searchParams: URLSearchParams
  onChange: (changes: Partial<Record<ParamKey, string | null>>, resetPage?: boolean) => void
}) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.mfaAwareness
  const typeGroupId = useId()

  const missionId = uuidParam(searchParams.get('mission_id'))
  const ministryId = uuidParam(searchParams.get('ministry_id'))
  const rawType = searchParams.get('type')
  const type = isGovernanceType(rawType) ? rawType : undefined
  const rawPeriod = searchParams.get('period')
  const period = rawPeriod && QUARTER_PATTERN.test(rawPeriod) ? rawPeriod : undefined
  const page = positiveInt(searchParams.get('page')) ?? 1
  const requestedPerPage = positiveInt(searchParams.get('per_page'))
  const perPage = requestedPerPage && (PER_PAGE_OPTIONS as readonly number[]).includes(requestedPerPage) ? requestedPerPage : DEFAULT_PER_PAGE
  const hasFilters = Boolean(missionId || ministryId || type || period)
  const quarterOptions = useQuarterOptions(summary, period)

  const filters: SubmissionLogFilters = { mission_id: missionId, ministry_id: ministryId, type, period, page, per_page: perPage }
  const logQuery = useQuery({
    queryKey: ['mfa-awareness', 'submissions', filters],
    queryFn: () => getSubmissionLog(filters),
    retry: retryUnlessRefused,
    placeholderData: keepPreviousData,
  })

  const entries = logQuery.data?.data ?? []
  const meta = logQuery.data?.meta

  return (
    <section aria-labelledby="log-heading" className="space-y-4" data-testid="mfa-log">
      <div>
        <h2 id="log-heading" className="text-h3 text-primary">
          {copy.log.title}
        </h2>
        <p className="text-body-sm text-text-secondary">{copy.log.subtitle}</p>
      </div>

      <FilterBar
        label={copy.filters.label}
        footer={
          <>
            <p aria-live="polite" className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary">
              <FunnelIcon aria-hidden="true" className="size-4" />
              {meta ? copy.log.resultCount(meta.total) : t.common.loading}
            </p>
            {hasFilters && <ClearButton label={copy.filters.clear} onClick={() => onChange({ mission_id: null, ministry_id: null, type: null, period: null })} />}
          </>
        }
      >
        <div className="md:w-56">
          <Select
            label={copy.filters.mission}
            value={missionId ?? ''}
            onChange={(event) => onChange({ mission_id: event.target.value || null })}
            placeholder={copy.filters.allMissions}
            options={[...(summary?.by_mission ?? [])].sort((first, second) => first.mission_name.localeCompare(second.mission_name)).map((mission) => ({ value: mission.mission_id, label: mission.mission_name }))}
            className="w-full"
          />
        </div>
        <div className="md:w-64">
          <Select
            label={copy.filters.department}
            value={ministryId ?? ''}
            onChange={(event) => onChange({ ministry_id: event.target.value || null })}
            placeholder={copy.filters.allDepartments}
            options={(summary?.ministries ?? []).map((ministry) => ({ value: ministry.id, label: ministry.name }))}
            className="w-full"
          />
        </div>
        <div className="md:w-64">
          <Select
            label={copy.filters.quarter}
            value={period ?? ''}
            onChange={(event) => onChange({ period: event.target.value || null })}
            placeholder={t.governance.quarter.allQuarters}
            options={quarterOptions}
            className="w-full"
          />
        </div>
        <div role="group" aria-labelledby={typeGroupId} className="flex flex-wrap items-center gap-2 md:basis-full">
          <span id={typeGroupId} className="mr-1 text-body-sm font-semibold text-text-secondary">
            {copy.filters.type}
          </span>
          {[undefined, ...GOVERNANCE_ITEM_TYPES].map((option) => {
            const active = type === option
            return (
              <button
                key={option ?? 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ type: option ?? null })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-body-sm font-semibold transition-colors [&_svg]:size-4 ${
                  active ? 'border-primary bg-primary text-white' : 'border-border bg-white text-text-secondary hover:bg-section-bg hover:text-primary'
                }`}
              >
                <span aria-hidden="true" className="contents">
                  {option ? TYPE_STYLE[option].icon : <QueueListIcon />}
                </span>
                {option ? t.governance.types[option] : copy.filters.allTypes}
              </button>
            )
          })}
        </div>
      </FilterBar>

      {logQuery.isError && !logQuery.data ? (
        <GovernanceUnavailable error={logQuery.error} forbiddenBody={t.governance.unavailable.mfaBody} onRetry={() => void logQuery.refetch()} />
      ) : !logQuery.data ? (
        <div role="status" aria-label={t.common.loading} className="space-y-2 rounded-xl border border-border bg-white p-4 shadow-sm">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-10 animate-pulse rounded bg-section-bg motion-reduce:animate-none" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-sm">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-success-soft text-success-soft-text [&>svg]:size-5">
            {hasFilters ? <MagnifyingGlassIcon /> : <TableCellsIcon />}
          </span>
          <p className="text-h4 text-primary">{hasFilters ? copy.log.noMatchTitle : copy.log.emptyTitle}</p>
          <p className="max-w-md text-body-sm text-text-secondary">{hasFilters ? copy.log.noMatchBody : copy.log.emptyBody}</p>
        </div>
      ) : (
        <div className={logQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <ScrollRegion label={copy.log.title} className="rounded-xl border border-border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-border text-body-sm" data-testid="mfa-log-table">
              <caption className="sr-only">{copy.log.title}</caption>
              <thead className="bg-section-bg">
                <tr>
                  {[copy.log.date, copy.log.type, copy.log.mission, copy.log.department].map((heading) => (
                    <th key={heading} scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry, index) => (
                  <tr key={`${entry.date}-${index}`} className="tw-table-row bg-white">
                    <td className="whitespace-nowrap px-4 py-2.5 text-text-primary">
                      <time dateTime={entry.date}>{formatDate(entry.date, locale)}</time>
                    </td>
                    <td className="px-4 py-2.5">
                      <TypeBadge type={entry.type} />
                    </td>
                    <td className="px-4 py-2.5 text-text-primary">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinIcon aria-hidden="true" className="size-3.5 text-text-muted" />
                        {entry.mission.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-primary">
                      <span className="inline-flex items-center gap-1.5">
                        <BuildingOffice2Icon aria-hidden="true" className="size-3.5 text-text-muted" />
                        {entry.ministry.name}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
          {meta && (
            <Pagination
              meta={meta}
              onPageChange={(nextPage) => onChange({ page: nextPage > 1 ? String(nextPage) : null }, false)}
              onPerPageChange={(nextPerPage) => onChange({ per_page: nextPerPage === DEFAULT_PER_PAGE ? null : String(nextPerPage) })}
              className="mt-4"
            />
          )}
        </div>
      )}
    </section>
  )
}

// --- National comparison (FR-MFA-003) ------------------------------------------------

function ChangeCell({ current, previous }: { current: number; previous: number }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.mfaAwareness.national
  const difference = current - previous
  const Icon = difference > 0 ? ArrowUpRightIcon : difference < 0 ? ArrowDownRightIcon : MinusIcon
  const text = difference === 0 ? copy.same : difference > 0 ? copy.up(formatNumber(difference, locale)) : copy.down(formatNumber(Math.abs(difference), locale))

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-section-bg px-2 py-0.5 text-caption font-semibold text-text-secondary">
      <Icon aria-hidden="true" className="size-3.5" />
      {text}
    </span>
  )
}

/** A count cell; a zero is muted so the active missions and departments stand out. */
function CountCell({ value, className = '', strong = false }: { value: number; className?: string; strong?: boolean }) {
  const { language } = useI18n()
  return (
    <td className={`px-3 py-2.5 text-right font-mono ${value === 0 ? 'text-text-muted' : strong ? 'font-semibold text-text-primary' : 'text-text-primary'} ${className}`}>
      {formatNumber(value, localeFor(language))}
    </td>
  )
}

function TypeCells({ counts }: { counts: CountsByType }) {
  return (
    <>
      {GOVERNANCE_ITEM_TYPES.map((type: GovernanceItemType) => (
        <CountCell key={type} value={counts[type] ?? 0} className="hidden md:table-cell" />
      ))}
    </>
  )
}

function NationalView({
  summary,
  period,
  onChange,
}: {
  summary: MfaAwarenessSummary | undefined
  period: string | undefined
  onChange: (changes: Partial<Record<ParamKey, string | null>>) => void
}) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.mfaAwareness.national
  const quarterLabel = useQuarterLabel()
  const quarterOptions = useQuarterOptions(summary, period)
  const [order, setOrder] = useState<NationalOrder>('activity')

  const overviewQuery = useQuery({
    queryKey: ['mfa-awareness', 'national-overview', period ?? null],
    queryFn: () => getNationalOverview(period),
    retry: retryUnlessRefused,
    placeholderData: keepPreviousData,
  })

  if (overviewQuery.isError && !overviewQuery.data) {
    return <GovernanceUnavailable error={overviewQuery.error} forbiddenBody={t.governance.unavailable.nationalBody} onRetry={() => void overviewQuery.refetch()} />
  }

  const overview = overviewQuery.data
  if (!overview) {
    return <SummarySkeleton label={t.common.loading} />
  }

  const showDepartments = overview.ministries.length > 1
  const { current, prior } = overview.totals
  const missions = [...overview.missions].sort((first, second) => {
    const byName = first.mission_name.localeCompare(second.mission_name)
    if (order === 'name') {
      return byName
    }
    const measure = (mission: (typeof overview.missions)[number]) =>
      order === 'change' ? Math.abs(mission.current.total - mission.prior.total) : mission.current.total
    return measure(second) - measure(first) || byName
  })

  return (
    <section aria-labelledby="national-heading" className={`space-y-6 ${overviewQuery.isFetching ? 'opacity-80 transition-opacity' : 'transition-opacity'}`} data-testid="mfa-national">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="national-heading" className="text-h3 text-primary">
            {copy.title}
          </h2>
          <p className="text-body-sm text-text-secondary">{copy.subtitle(quarterLabel(overview.period), quarterLabel(overview.comparison_period))}</p>
        </div>
        <div className="w-full sm:w-72">
          <Select
            label={copy.quarter}
            value={period ?? overview.period.label}
            onChange={(event) => onChange({ period: event.target.value || null })}
            options={quarterOptions.some((option) => option.value === overview.period.label) ? quarterOptions : [...quarterOptions, { value: overview.period.label, label: quarterLabel(overview.period) }]}
            className="w-full"
          />
        </div>
      </div>

      {overview.period.is_partial && (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-white px-4 py-3 text-body-sm text-text-secondary shadow-sm">
          <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
          {copy.partialNote}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={copy.thisPeriod(overview.period.label)} value={formatNumber(current.total, locale)} icon={<RectangleStackIcon />} tone="info" footnote={copy.comparison(overview.comparison_period.label) + `: ${formatNumber(prior.total, locale)}`} />
        {GOVERNANCE_ITEM_TYPES.map((type) => (
          <div key={type} className="flex min-w-0 flex-col rounded-xl border border-border bg-white p-4 shadow-sm">
            <span className="flex items-center gap-2.5 text-body-sm font-medium text-text-secondary">
              <TypeChip type={type} size="sm" />
              {t.governance.types[type]}
            </span>
            <p className="mt-3 font-mono text-[2rem] font-semibold leading-none tracking-tight text-primary">{formatNumber(current.by_type[type] ?? 0, locale)}</p>
            <DeltaPill current={current.by_type[type] ?? 0} previous={prior.by_type[type] ?? 0} />
          </div>
        ))}
      </div>

      <section aria-labelledby="national-missions-heading" className="min-w-0 rounded-xl border border-border bg-white shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-text [&>svg]:size-5">
              <MapPinIcon />
            </span>
            <div className="min-w-0">
              <h3 id="national-missions-heading" className="text-h3 text-primary">
                {copy.missionsTitle}
              </h3>
              <p className="mt-0.5 text-body-sm text-text-secondary">{copy.missionsSubtitle}</p>
            </div>
          </div>
          <SegmentedControl<NationalOrder>
            label={copy.sortLabel}
            value={order}
            onChange={setOrder}
            options={(['activity', 'change', 'name'] as const).map((value) => ({ value, label: copy.sort[value] }))}
          />
        </header>
        <div className="p-4 sm:p-5">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border text-body-sm" data-testid="national-missions-table">
              <caption className="sr-only">{copy.missionsTitle}</caption>
              <thead className="bg-section-bg">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">
                    {copy.mission}
                  </th>
                  {GOVERNANCE_ITEM_TYPES.map((type) => (
                    <th key={type} scope="col" className="hidden px-3 py-2 text-right font-semibold text-text-secondary md:table-cell">
                      {t.governance.types[type]}
                    </th>
                  ))}
                  {showDepartments &&
                    overview.ministries.map((ministry) => (
                      <th key={ministry.id} scope="col" className="hidden px-3 py-2 text-right font-semibold text-text-secondary lg:table-cell">
                        {ministry.name}
                      </th>
                    ))}
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-text-secondary">
                    {copy.total}
                  </th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold text-text-secondary sm:table-cell">
                    {copy.previous}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">
                    {copy.change}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {missions.map((mission) => (
                  <tr key={mission.mission_id} className="tw-table-row bg-white">
                    <th scope="row" className="px-3 py-2.5 text-left font-normal">
                      <Link to={`/mfa-awareness/missions/${mission.mission_id}`} className="font-semibold text-primary hover:underline">
                        {mission.mission_name}
                      </Link>
                      <span className="block text-caption text-text-muted">{mission.host_country}</span>
                    </th>
                    <TypeCells counts={mission.current.by_type} />
                    {showDepartments &&
                      overview.ministries.map((ministry) => (
                        <CountCell key={ministry.id} value={(mission.current.by_ministry as Record<string, number>)[ministry.id] ?? 0} className="hidden lg:table-cell" />
                      ))}
                    <CountCell value={mission.current.total} strong />
                    <CountCell value={mission.prior.total} className="hidden sm:table-cell" />
                    <td className="px-3 py-2.5">
                      <ChangeCell current={mission.current.total} previous={mission.prior.total} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="national-departments-heading" className="min-w-0 rounded-xl border border-border bg-white shadow-sm">
        <header className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-directive-soft text-directive-soft-text [&>svg]:size-5">
            <BuildingLibraryIcon />
          </span>
          <div className="min-w-0">
            <h3 id="national-departments-heading" className="text-h3 text-primary">
              {copy.departmentsTitle}
            </h3>
            <p className="mt-0.5 text-body-sm text-text-secondary">{copy.departmentsSubtitle}</p>
          </div>
        </header>
        <div className="p-4 sm:p-5">
          <ScrollRegion label={copy.departmentsTitle} className="rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border text-body-sm" data-testid="national-departments-table">
              <caption className="sr-only">{copy.departmentsTitle}</caption>
              <thead className="bg-section-bg">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">
                    {copy.department}
                  </th>
                  {GOVERNANCE_ITEM_TYPES.map((type) => (
                    <th key={type} scope="col" className="hidden px-3 py-2 text-right font-semibold text-text-secondary md:table-cell">
                      {t.governance.types[type]}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-text-secondary">
                    {copy.total}
                  </th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold text-text-secondary sm:table-cell">
                    {copy.previous}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">
                    {copy.change}
                  </th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold text-text-secondary sm:table-cell">
                    {copy.missionsReporting}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overview.departments.map((department) => (
                  <tr key={department.ministry_id} className="tw-table-row bg-white">
                    <th scope="row" className="px-3 py-2.5 text-left font-semibold text-primary">
                      {department.ministry_name}
                    </th>
                    <TypeCells counts={department.current.by_type} />
                    <CountCell value={department.current.total} strong />
                    <CountCell value={department.prior.total} className="hidden sm:table-cell" />
                    <td className="px-3 py-2.5">
                      <ChangeCell current={department.current.total} previous={department.prior.total} />
                    </td>
                    <CountCell value={department.current.missions_reporting} className="hidden sm:table-cell" />
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </div>
      </section>
    </section>
  )
}
