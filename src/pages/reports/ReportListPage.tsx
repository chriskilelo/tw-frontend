import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  QueueListIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import {
  getReportPeriods,
  listPeriodicReports,
  type PeriodicReport,
  type PeriodicReportListFilters,
  type PeriodicReportStatus,
  type ReportListSort,
  type ReportPeriods,
  type ReportTimeliness,
} from '../../api/reports'
import { useAuth } from '../../hooks/useAuth'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Pagination, DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from '../../components/Pagination'
import { useI18n } from '../../i18n/context'
import { formatDate, localeFor } from '../../lib/formatters'
import { ReportStatusBadge, ReportTimelinessBadge } from './ReportStatusBadge'
import { formatDay, formatPeriodRange } from './reportPresentation'

const SEARCH_DEBOUNCE_MS = 300
const SORT_OPTIONS: ReportListSort[] = ['-period_start_date', 'period_start_date', '-submitted_at', 'submitted_at', 'mission']
const DEFAULT_SORT: ReportListSort = '-period_start_date'

/** ReportPolicy::COMPLIANCE_ROLES — FR-RPT-018. */
const COMPLIANCE_ROLES = ['Ministry HQ Director', 'Ministry PS', 'Acting PS']
const MISSION_OVERSIGHT_ROLES = ['Head of Mission', 'Deputy Head of Mission']

/** What the server scopes the list to for this role (PeriodicReport::visibleTo()). */
type ListScope = 'attache' | 'reviewer' | 'oversight'

type ChipKey = 'all' | 'draft' | 'submitted' | 'overdue' | 'on_time' | 'late'

function scopeFor(roleName: string | undefined): ListScope {
  if (roleName === 'Ministry Attache') {
    return 'attache'
  }
  return roleName && MISSION_OVERSIGHT_ROLES.includes(roleName) ? 'oversight' : 'reviewer'
}

function oneOf<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return value !== null && (options as readonly string[]).includes(value) ? (value as T) : undefined
}

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

type FilterKey = 'q' | 'status' | 'timeliness' | 'mission_id' | 'period' | 'sort' | 'page' | 'per_page'

/**
 * FR-RPT-017 (with FR-SDT-007/015 and FR-HOM-001): the report list. The server applies each
 * role's visibility — an attache sees their own mission's reports, drafts included (BR-001);
 * HQ review roles see every mission's submitted reports; a Head of Mission their mission's
 * submitted reports from every department — so filters here only ever narrow it. Filters live
 * in the URL so the compliance dashboards and reminders can link straight into a view.
 */
export default function ReportListPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.reports.list
  const navigate = useNavigate()
  const { role } = useAuth()
  const roleName = role?.name
  const scope = scopeFor(roleName)
  const canViewCompliance = Boolean(roleName && COMPLIANCE_ROLES.includes(roleName))

  const [searchParams, setSearchParams] = useSearchParams()
  const q = (searchParams.get('q') ?? '').trim()
  const status = scope === 'attache' ? oneOf<PeriodicReportStatus>(searchParams.get('status'), ['draft', 'submitted']) : undefined
  const timeliness = oneOf<ReportTimeliness>(searchParams.get('timeliness'), scope === 'attache' ? ['overdue'] : ['on_time', 'late'])
  const missionId = scope === 'reviewer' ? searchParams.get('mission_id') || undefined : undefined
  const period = searchParams.get('period') || undefined
  const sort = oneOf(searchParams.get('sort'), SORT_OPTIONS) ?? DEFAULT_SORT
  const page = positiveInt(searchParams.get('page')) ?? 1
  const requestedPerPage = positiveInt(searchParams.get('per_page'))
  const perPage = requestedPerPage && (PER_PAGE_OPTIONS as readonly number[]).includes(requestedPerPage) ? requestedPerPage : DEFAULT_PER_PAGE
  const hasActiveFilters = Boolean(q || status || timeliness || missionId || period)

  function updateParams(changes: Partial<Record<FilterKey, string | null>>, resetPage = true) {
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

  // Search is typed locally and written to the URL after a pause (same pattern as directives).
  const [searchInput, setSearchInput] = useState(q)
  const [syncedQuery, setSyncedQuery] = useState(q)
  if (q !== syncedQuery) {
    setSyncedQuery(q)
    if (searchInput.trim() !== q) {
      setSearchInput(q)
    }
  }
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateParamsRef = useRef(updateParams)
  useEffect(() => {
    updateParamsRef.current = updateParams
  })
  useEffect(
    () => () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    },
    [],
  )

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null
      updateParamsRef.current({ q: value.trim() || null })
    }, SEARCH_DEBOUNCE_MS)
  }

  function clearFilters() {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    setSearchInput('')
    updateParams({ q: null, status: null, timeliness: null, mission_id: null, period: null })
  }

  const filters: PeriodicReportListFilters = {
    q: q || undefined,
    status,
    timeliness,
    mission_id: missionId,
    period,
    sort,
    page,
    per_page: perPage,
  }

  const listQuery = useQuery({
    queryKey: ['periodic-reports', 'list', filters],
    queryFn: () => listPeriodicReports(filters),
    placeholderData: keepPreviousData,
    enabled: Boolean(roleName),
  })
  const periodsQuery = useQuery({ queryKey: ['report-periods'], queryFn: getReportPeriods, enabled: Boolean(roleName), staleTime: 60 * 1000 })

  const reports = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const periodOptions = (periodsQuery.data?.periods ?? []).map((option) => ({ value: option.label, label: `${option.label} · ${formatPeriodRange(option.start, option.end, locale)}` }))
  const missionOptions = (periodsQuery.data?.missions ?? []).map((mission) => ({ value: mission.id, label: mission.name }))
  const canCreate = Boolean(periodsQuery.data?.can_create)
  const missionName = periodsQuery.data?.missions[0]?.name ?? ''

  const subtitle = scope === 'attache' ? copy.subtitleAttache(missionName) : scope === 'oversight' ? copy.subtitleOversight : copy.subtitleReviewer
  const chips: { key: ChipKey; icon: ReactNode }[] =
    scope === 'attache'
      ? [
          { key: 'all', icon: <QueueListIcon /> },
          { key: 'draft', icon: <PencilSquareIcon /> },
          { key: 'submitted', icon: <CheckCircleIcon /> },
          { key: 'overdue', icon: <ClockIcon /> },
        ]
      : [
          { key: 'all', icon: <QueueListIcon /> },
          { key: 'on_time', icon: <CheckCircleIcon /> },
          { key: 'late', icon: <ExclamationTriangleIcon /> },
        ]

  function isChipActive(key: ChipKey): boolean {
    switch (key) {
      case 'all':
        return !status && !timeliness
      case 'draft':
      case 'submitted':
        return status === key && !timeliness
      default:
        return timeliness === key
    }
  }

  function selectChip(key: ChipKey) {
    if (key === 'all') {
      updateParams({ status: null, timeliness: null })
    } else if (key === 'draft' || key === 'submitted') {
      updateParams({ timeliness: null, status: status === key ? null : key })
    } else {
      updateParams({ status: null, timeliness: timeliness === key ? null : key })
    }
  }

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, id: string) {
    if ((event.target as HTMLElement).closest('a, button, input, select')) {
      return
    }
    navigate(`/reports/${id}`)
  }

  const chipsLabelId = useId()
  const emptyTitle = scope === 'attache' ? copy.emptyTitleAttache : copy.emptyTitleReviewer
  const emptyBody = scope === 'attache' ? copy.emptyBodyAttache : copy.emptyBodyReviewer

  return (
    <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-primary">{copy.title}</h1>
          {roleName && <p className="mt-1 text-body text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canViewCompliance && (
            <Link
              to="/reports/compliance"
              className="inline-flex h-10 items-center justify-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg"
            >
              <DocumentChartBarIcon aria-hidden="true" className="size-4" />
              {copy.complianceLink}
            </Link>
          )}
          {canCreate && (
            <Link
              to="/reports/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-accent px-4 text-button text-accent-text transition-colors hover:bg-accent-light"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {copy.startReport}
            </Link>
          )}
        </div>
      </header>

      {scope === 'attache' && periodsQuery.data && <CurrentReportCallout periods={periodsQuery.data} locale={locale} />}

      <section aria-label={copy.filtersLabel} className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          {scope !== 'attache' && (
            <div className="relative min-w-0 flex-1">
              <Input
                type="search"
                label={copy.searchLabel}
                placeholder={copy.searchPlaceholder}
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="w-full pl-9"
              />
              <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 size-4 text-text-muted" />
            </div>
          )}
          {scope === 'reviewer' && (
            <div className="md:w-56">
              <Select
                label={copy.filterMission}
                value={missionId ?? ''}
                onChange={(event) => updateParams({ mission_id: event.target.value || null })}
                placeholder={copy.allMissions}
                options={withSelected(missionOptions, missionId)}
                className="w-full"
              />
            </div>
          )}
          <div className="md:w-64">
            <Select
              label={copy.filterPeriod}
              value={period ?? ''}
              onChange={(event) => updateParams({ period: event.target.value || null })}
              placeholder={copy.allPeriods}
              options={withSelected(periodOptions, period)}
              className="w-full"
            />
          </div>
          <div className="md:w-56">
            <Select
              label={copy.sortLabel}
              value={sort}
              onChange={(event) => updateParams({ sort: event.target.value === DEFAULT_SORT ? null : event.target.value })}
              options={SORT_OPTIONS.filter((option) => scope === 'reviewer' || option !== 'mission').map((option) => ({ value: option, label: copy.sort[option] }))}
              className="w-full"
            />
          </div>
        </div>

        <div role="group" aria-labelledby={chipsLabelId} className="flex flex-wrap items-center gap-2">
          <span id={chipsLabelId} className="mr-1 text-body-sm font-semibold text-text-secondary">
            {copy.chipsLabel}
          </span>
          {chips.map((chip) => {
            const active = isChipActive(chip.key)
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={active}
                onClick={() => selectChip(chip.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-body-sm font-semibold transition-colors [&_svg]:size-4 ${
                  active ? 'border-primary bg-primary text-white' : 'border-border bg-white text-text-secondary hover:bg-section-bg hover:text-primary'
                }`}
              >
                <span aria-hidden="true" className="contents">
                  {chip.icon}
                </span>
                {copy.chip[chip.key]}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p aria-live="polite" className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary">
            <FunnelIcon aria-hidden="true" className="size-4" />
            {meta ? copy.resultCount(meta.total) : copy.loading}
          </p>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline">
              <XMarkIcon aria-hidden="true" className="size-4" />
              {copy.clearFilters}
            </button>
          )}
        </div>
      </section>

      {listQuery.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
            <ExclamationTriangleIcon className="size-5" />
          </span>
          <p className="max-w-md text-body text-text-secondary">{copy.loadError}</p>
          <button
            type="button"
            onClick={() => void listQuery.refetch()}
            className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light"
          >
            <ArrowPathIcon aria-hidden="true" className="size-4" />
            {copy.retry}
          </button>
        </div>
      ) : !listQuery.data ? (
        <div role="status" aria-label={copy.loading} className="space-y-2 rounded-xl border border-border bg-white p-4 shadow-sm">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-12 animate-pulse rounded bg-section-bg motion-reduce:animate-none" />
          ))}
        </div>
      ) : (meta?.total ?? reports.length) === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-sm">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-success-soft text-success-soft-text [&>svg]:size-5">
            {hasActiveFilters ? <MagnifyingGlassIcon /> : <DocumentTextIcon />}
          </span>
          <p className="text-h4 text-primary">{hasActiveFilters ? copy.noMatchTitle : emptyTitle}</p>
          <p className="max-w-md text-body-sm text-text-secondary">{hasActiveFilters ? copy.noMatchBody : emptyBody}</p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg"
            >
              <XMarkIcon aria-hidden="true" className="size-4" />
              {copy.clearFilters}
            </button>
          ) : (
            canCreate && (
              <Link to="/reports/new" className="mt-2 inline-flex h-10 items-center gap-2 rounded bg-accent px-4 text-button text-accent-text hover:bg-accent-light">
                <PlusIcon aria-hidden="true" className="size-4" />
                {copy.startReport}
              </Link>
            )
          )}
        </div>
      ) : (
        <div className={listQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-border text-body-sm">
              <caption className="sr-only">{copy.title}</caption>
              <thead className="bg-section-bg">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnReport}
                  </th>
                  {scope !== 'attache' && (
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                      {copy.columnMission}
                    </th>
                  )}
                  {scope !== 'attache' && (
                    <th scope="col" className="hidden px-4 py-2 text-left font-semibold text-text-secondary md:table-cell">
                      {copy.columnAttache}
                    </th>
                  )}
                  <th scope="col" className="hidden px-4 py-2 text-left font-semibold text-text-secondary sm:table-cell">
                    {copy.columnSubmitted}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnStatus}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((row) => (
                  <ReportRow key={row.id} row={row} scope={scope} locale={locale} onClick={(event) => handleRowClick(event, row.id)} />
                ))}
              </tbody>
            </table>
          </div>
          {meta && (
            <Pagination
              meta={meta}
              onPageChange={(nextPage) => updateParams({ page: nextPage > 1 ? String(nextPage) : null }, false)}
              onPerPageChange={(nextPerPage) => updateParams({ per_page: nextPerPage === DEFAULT_PER_PAGE ? null : String(nextPerPage) })}
              className="mt-4"
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Keeps a deep-linked value selectable even before (or without) its option list arriving. */
function withSelected(options: { value: string; label: string }[], selected: string | undefined): { value: string; label: string }[] {
  return selected && !options.some((option) => option.value === selected) ? [...options, { value: selected, label: selected }] : options
}

function ReportRow({ row, scope, locale, onClick }: { row: PeriodicReport; scope: ListScope; locale: string; onClick: (event: MouseEvent<HTMLTableRowElement>) => void }) {
  const { t } = useI18n()
  const copy = t.reports.list
  const progress = row.status === 'draft' ? row.progress : undefined

  return (
    <tr data-testid={`report-row-${row.id}`} onClick={onClick} className="tw-table-row cursor-pointer bg-white hover:bg-section-bg">
      <td className="px-4 py-3 align-top">
        <Link to={`/reports/${row.id}`} className="font-semibold text-primary hover:underline">
          {row.reporting_period_label}
        </Link>
        <span className="block text-caption text-text-muted">{formatPeriodRange(row.period_start_date, row.period_end_date, locale)}</span>
        {progress && (
          <span className="mt-1.5 block max-w-52">
            <span className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-section-bg" aria-hidden="true">
              <span className="h-full bg-success" style={{ width: `${progress.total > 0 ? (progress.complete / progress.total) * 100 : 0}%` }} />
              <span className="h-full bg-info" style={{ width: `${progress.total > 0 ? (progress.started / progress.total) * 100 : 0}%` }} />
            </span>
            <span className="mt-0.5 block text-caption text-text-secondary">{copy.progress(progress.complete, progress.total)}</span>
          </span>
        )}
      </td>
      {scope !== 'attache' && (
        <td className="px-4 py-3 align-top text-text-primary">
          {row.mission?.name ?? '—'}
          {(row.mission?.host_country || (scope === 'oversight' && row.ministry)) && (
            <span className="block text-caption text-text-muted">{[row.mission?.host_country, scope === 'oversight' ? row.ministry?.name : null].filter(Boolean).join(' · ')}</span>
          )}
        </td>
      )}
      {scope !== 'attache' && <td className="hidden px-4 py-3 align-top text-text-primary md:table-cell">{row.authored_by?.full_name ?? '—'}</td>}
      <td className="hidden whitespace-nowrap px-4 py-3 align-top text-text-secondary sm:table-cell">
        {row.submitted_at ? formatDate(row.submitted_at, locale) : <span className="text-text-muted">{copy.notSubmitted}</span>}
        {row.status === 'draft' && <span className="block text-caption text-text-muted">{t.reports.deadline.dueOn(formatDay(row.deadline, locale))}</span>}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <ReportStatusBadge status={row.status} />
          <ReportTimelinessBadge report={row} />
        </div>
      </td>
    </tr>
  )
}

/**
 * The attache's next report at a glance: the quarter open for submission while it is still
 * owed, else the quarter in progress (the same choice the start page highlights).
 */
function CurrentReportCallout({ periods, locale }: { periods: ReportPeriods; locale: string }) {
  const { t } = useI18n()
  const copy = t.reports.list.current
  const current = periods.periods.find((period) => period.label === periods.current.label)
  const focus = current && current.report?.status !== 'submitted' ? current : (periods.periods.find((period) => period.phase === 'in_progress') ?? current)

  if (!focus) {
    return null
  }

  const report = focus.report ?? null
  const due = `${t.reports.deadline.dueOn(formatDay(focus.deadline, locale))}${focus.days_to_deadline >= 0 ? ` · ${t.reports.deadline.dueIn(focus.days_to_deadline)}` : ''}`
  let body: string = copy.notStarted
  if (report?.status === 'draft') {
    body = t.reports.complianceStatus.draft_in_progress
  } else if (report?.status === 'submitted' && report.submitted_at) {
    body = report.is_late ? copy.submittedLate(formatDate(report.submitted_at, locale), report.days_overdue ?? 1) : copy.submittedOnTime(formatDate(report.submitted_at, locale))
  }

  const tone = report?.status === 'submitted' ? 'border-l-success' : focus.days_to_deadline < 0 ? 'border-l-danger' : 'border-l-accent'

  return (
    <section aria-labelledby="current-report-heading" className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border border-l-4 border-border bg-white px-4 py-4 shadow-sm sm:px-5 ${tone}`} data-testid="current-report-callout">
      <div className="min-w-0">
        <h2 id="current-report-heading" className="text-h3 text-primary">
          {copy.heading(focus.label)}
        </h2>
        <p className="mt-0.5 text-body-sm text-text-secondary">{body}</p>
        <p className={`mt-1 flex items-center gap-1.5 text-caption font-semibold ${focus.days_to_deadline < 0 && report?.status !== 'submitted' ? 'text-danger-soft-text' : 'text-text-secondary'}`}>
          <ClockIcon aria-hidden="true" className="size-3.5" />
          {due}
        </p>
      </div>
      {report ? (
        <Link
          to={`/reports/${report.id}`}
          className={`inline-flex h-10 items-center gap-2 rounded px-4 text-button transition-colors ${
            report.status === 'draft' ? 'bg-accent text-accent-text hover:bg-accent-light' : 'border border-border bg-white text-primary hover:bg-section-bg'
          }`}
        >
          {report.status === 'draft' ? <PencilSquareIcon aria-hidden="true" className="size-4" /> : <EyeIcon aria-hidden="true" className="size-4" />}
          {report.status === 'draft' ? copy.continue : copy.view}
        </Link>
      ) : (
        periods.can_create && (
          <Link
            to={`/reports/new?period=${encodeURIComponent(focus.label)}`}
            className="inline-flex h-10 items-center gap-2 rounded bg-accent px-4 text-button text-accent-text transition-colors hover:bg-accent-light"
          >
            {copy.start}
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </Link>
        )
      )}
    </section>
  )
}
