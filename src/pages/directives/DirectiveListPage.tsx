import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ChartPieIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PauseCircleIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import {
  getDirectiveSummary,
  listDirectives,
  type Directive,
  type DirectiveDueFilter,
  type DirectiveListFilters,
  type DirectiveSort,
  type DirectiveStatus,
} from '../../api/directives'
import { listMissions } from '../../api/missions'
import { useAuth, isReadOnlyRole } from '../../hooks/useAuth'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Pagination, DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from '../../components/Pagination'
import { DirectiveDueBadge, DirectiveStaleBadge, DirectiveStatusBadge } from './DirectiveStatusBadge'
import { useI18n } from '../../i18n/context'
import { formatDate, localeFor } from '../../lib/formatters'

const SEARCH_DEBOUNCE_MS = 300

/** Every status a directive can be observed in through the API ('draft' never is). */
const STATUS_OPTIONS: DirectiveStatus[] = ['issued', 'acknowledged', 'in_progress', 'completed', 'closed', 'cancelled']
const DUE_FILTERS: DirectiveDueFilter[] = ['overdue', 'approaching', 'no_date', 'on_track', 'completed', 'cancelled']
const SORT_OPTIONS: DirectiveSort[] = [
  '-created_at',
  'created_at',
  'target_completion_date',
  '-target_completion_date',
  '-last_progress_update_at',
  'last_progress_update_at',
]
const DEFAULT_SORT: DirectiveSort = '-created_at'

/** DirectivePolicy::create() — Ministry HQ Officer, Ministry PS, Acting PS. */
const ISSUING_ROLES = ['Ministry HQ Officer', 'Ministry PS', 'Acting PS']
/** DirectivePolicy::viewSummary() — Ministry HQ Director, Ministry PS, Acting PS. */
const SUMMARY_ROLES = ['Ministry HQ Director', 'Ministry PS', 'Acting PS']

/** What the server scopes the list to for this role (DirectiveController::index()). */
type ListScope = 'attache' | 'issuer' | 'oversight' | 'all'

function scopeFor(roleName: string | undefined): ListScope {
  if (roleName === 'Ministry Attache') {
    return 'attache'
  }
  if (roleName === 'Ministry HQ Officer') {
    return 'issuer'
  }
  return roleName && SUMMARY_ROLES.includes(roleName) ? 'oversight' : 'all'
}

function oneOf<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return value !== null && (options as readonly string[]).includes(value) ? (value as T) : undefined
}

function isoDate(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/** Date-only values ("2026-10-12") are calendar days, not instants: format them in UTC. */
function formatDay(value: string, locale: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** The URL-backed filter keys this page reads and writes (so dashboards can deep-link). */
type FilterKey = 'q' | 'status' | 'due' | 'stale' | 'mission_id' | 'issued_by_user_id' | 'date_from' | 'date_to' | 'sort' | 'page' | 'per_page'

/**
 * FR-DIR-005, FR-DIR-009, FR-DIR-010, FR-DIR-003. DirectiveController::index() scopes the rows
 * per role (Ministry Attache: assigned to them; Ministry HQ Officer: issued by them; PS, Acting
 * PS and HQ Director: the whole department) and computes every flag (due_state, is_stale), so
 * this page only renders them. Filters live in the URL so dashboards can link straight into a
 * filtered view (e.g. /directives?due=overdue&mission_id=…).
 */
export default function DirectiveListPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.directives.list
  const navigate = useNavigate()
  const { role } = useAuth()
  const roleName = role?.name
  const scope = scopeFor(roleName)
  const canIssue = !isReadOnlyRole(roleName) && Boolean(roleName && ISSUING_ROLES.includes(roleName))
  const canViewSummary = Boolean(roleName && SUMMARY_ROLES.includes(roleName))
  const showMissionFilter = scope !== 'attache'
  const showIssuerFilter = canViewSummary

  const [searchParams, setSearchParams] = useSearchParams()
  const q = (searchParams.get('q') ?? '').trim()
  const status = oneOf(searchParams.get('status'), STATUS_OPTIONS)
  const due = oneOf(searchParams.get('due'), DUE_FILTERS)
  const stale = ['1', 'true'].includes(searchParams.get('stale') ?? '')
  const missionId = showMissionFilter ? searchParams.get('mission_id') || undefined : undefined
  const issuerId = showIssuerFilter ? searchParams.get('issued_by_user_id') || undefined : undefined
  const dateFrom = isoDate(searchParams.get('date_from'))
  const dateTo = isoDate(searchParams.get('date_to'))
  const sort = oneOf(searchParams.get('sort'), SORT_OPTIONS) ?? DEFAULT_SORT
  const page = positiveInt(searchParams.get('page')) ?? 1
  const requestedPerPage = positiveInt(searchParams.get('per_page'))
  const perPage = requestedPerPage && (PER_PAGE_OPTIONS as readonly number[]).includes(requestedPerPage) ? requestedPerPage : DEFAULT_PER_PAGE

  const hasActiveFilters = Boolean(q || status || due || stale || missionId || issuerId || dateFrom || dateTo)

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

  // Search is typed into local state and written to the URL after a pause. When the URL's q
  // changes from elsewhere (clear filters, back button), the box follows it.
  const [searchInput, setSearchInput] = useState(q)
  const [syncedQuery, setSyncedQuery] = useState(q)
  if (q !== syncedQuery) {
    setSyncedQuery(q)
    if (searchInput.trim() !== q) {
      setSearchInput(q)
    }
  }
  // The debounce timer fires after later renders, so it calls the latest updateParams (whose
  // setSearchParams sees the current URL) through a ref rather than a stale closure.
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

  function cancelPendingSearch() {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    cancelPendingSearch()
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null
      updateParamsRef.current({ q: value.trim() || null })
    }, SEARCH_DEBOUNCE_MS)
  }

  function clearFilters() {
    cancelPendingSearch()
    setSearchInput('')
    updateParams({ q: null, status: null, due: null, stale: null, mission_id: null, issued_by_user_id: null, date_from: null, date_to: null })
  }

  const listFilters: DirectiveListFilters = {
    q: q || undefined,
    status,
    due,
    stale: stale || undefined,
    mission_id: missionId,
    issued_by_user_id: issuerId,
    date_from: dateFrom,
    date_to: dateTo,
    sort,
    page,
    per_page: perPage,
  }

  const listQuery = useQuery({
    queryKey: ['directives', 'list', listFilters],
    queryFn: () => listDirectives(listFilters),
    placeholderData: keepPreviousData,
    enabled: Boolean(roleName),
  })

  // Oversight roles take the option lists from the summary endpoint (missions and issuers that
  // actually have directives); everyone else who may filter by mission uses GET /missions.
  const filterOptionsQuery = useQuery({
    queryKey: ['directives', 'summary', {}],
    queryFn: () => getDirectiveSummary(),
    enabled: canViewSummary,
    staleTime: 5 * 60 * 1000,
    select: (summary) => summary.filter_options,
  })
  const missionsQuery = useQuery({
    queryKey: ['missions'],
    queryFn: listMissions,
    enabled: Boolean(roleName) && showMissionFilter && !canViewSummary,
  })

  const missionOptions = canViewSummary
    ? (filterOptionsQuery.data?.missions ?? [])
    : (missionsQuery.data ?? []).map((mission) => ({ id: mission.id, name: mission.name }))
  const issuerOptions = filterOptionsQuery.data?.issuers ?? []

  const directives = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  const subtitle = { attache: copy.subtitleAttache, issuer: copy.subtitleIssuer, oversight: copy.subtitleOversight, all: copy.subtitleAll }[scope]
  const emptyBody = { attache: copy.emptyAttache, issuer: copy.emptyIssuer, oversight: copy.emptyOversight, all: copy.emptyOversight }[scope]

  const dueChips: { key: DirectiveDueFilter | 'all' | 'stale'; label: string; icon: ReactNode }[] = [
    { key: 'all', label: copy.dueAll, icon: <ClipboardDocumentCheckIcon /> },
    { key: 'overdue', label: copy.dueOverdue, icon: <ExclamationTriangleIcon /> },
    { key: 'approaching', label: copy.dueApproaching, icon: <ClockIcon /> },
    { key: 'no_date', label: copy.dueNoDate, icon: <CalendarDaysIcon /> },
    { key: 'on_track', label: copy.dueOnTrack, icon: <CheckCircleIcon /> },
    { key: 'stale', label: copy.dueStale, icon: <PauseCircleIcon /> },
    { key: 'completed', label: copy.dueCompleted, icon: <CheckBadgeIcon /> },
    { key: 'cancelled', label: copy.dueCancelled, icon: <NoSymbolIcon /> },
  ]

  function isChipActive(key: (typeof dueChips)[number]['key']): boolean {
    if (key === 'all') {
      return !due && !stale
    }
    return key === 'stale' ? stale : due === key
  }

  function selectChip(key: (typeof dueChips)[number]['key']) {
    if (key === 'all') {
      updateParams({ due: null, stale: null })
    } else if (key === 'stale') {
      updateParams({ due: null, stale: stale ? null : '1' })
    } else {
      updateParams({ stale: null, due: due === key ? null : key })
    }
  }

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, id: string) {
    // The description link (and anything else interactive) handles its own activation.
    if ((event.target as HTMLElement).closest('a, button, input, select')) {
      return
    }
    navigate(`/directives/${id}`)
  }

  const personHeader = scope === 'attache' ? copy.columnIssuedBy : copy.columnTargetAttache
  const chipsLabelId = useId()

  return (
    <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-primary">{copy.title}</h1>
          {roleName && <p className="mt-1 text-body text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canViewSummary && (
            <Link
              to="/directives/summary"
              className="inline-flex h-10 items-center justify-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg"
            >
              <ChartPieIcon aria-hidden="true" className="size-4" />
              {copy.summaryLink}
            </Link>
          )}
          {canIssue && (
            <Link
              to="/directives/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-accent px-4 text-button text-accent-text transition-colors hover:bg-accent-light"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {copy.newDirectiveButton}
            </Link>
          )}
        </div>
      </header>

      <section aria-label={copy.filtersLabel} className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
          <div className="md:w-60">
            <Select
              label={copy.sortLabel}
              value={sort}
              onChange={(event) => updateParams({ sort: event.target.value === DEFAULT_SORT ? null : event.target.value })}
              options={SORT_OPTIONS.map((option) => ({ value: option, label: copy.sort[option] }))}
              className="w-full"
            />
          </div>
        </div>

        <div role="group" aria-labelledby={chipsLabelId} className="flex flex-wrap items-center gap-2">
          <span id={chipsLabelId} className="mr-1 text-body-sm font-semibold text-text-secondary">
            {copy.dueGroupLabel}
          </span>
          {dueChips.map((chip) => {
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
                {chip.label}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label={copy.filterStatus}
            value={status ?? ''}
            onChange={(event) => updateParams({ status: event.target.value || null })}
            placeholder={copy.allStatuses}
            options={STATUS_OPTIONS.map((option) => ({ value: option, label: t.directives.status[option] }))}
          />
          {showMissionFilter && (
            <Select
              label={copy.filterMission}
              value={missionId ?? ''}
              onChange={(event) => updateParams({ mission_id: event.target.value || null })}
              placeholder={copy.allMissions}
              options={withSelected(
                missionOptions.map((mission) => ({ value: mission.id, label: mission.name })),
                missionId,
              )}
            />
          )}
          {showIssuerFilter && (
            <Select
              label={copy.filterIssuer}
              value={issuerId ?? ''}
              onChange={(event) => updateParams({ issued_by_user_id: event.target.value || null })}
              placeholder={copy.allIssuers}
              options={withSelected(
                issuerOptions.map((issuer) => ({ value: issuer.id, label: issuer.full_name })),
                issuerId,
              )}
            />
          )}
          <Input
            type="date"
            label={copy.filterDateFrom}
            value={dateFrom ?? ''}
            max={dateTo}
            onChange={(event) => updateParams({ date_from: event.target.value || null })}
          />
          <Input
            type="date"
            label={copy.filterDateTo}
            value={dateTo ?? ''}
            min={dateFrom}
            onChange={(event) => updateParams({ date_to: event.target.value || null })}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p aria-live="polite" className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary">
            <FunnelIcon aria-hidden="true" className="size-4" />
            {meta ? copy.resultCount(meta.total) : copy.loading}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline"
            >
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
      ) : (meta?.total ?? directives.length) === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-sm">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-directive-soft text-directive-soft-text [&>svg]:size-5">
            {hasActiveFilters ? <MagnifyingGlassIcon /> : <ClipboardDocumentCheckIcon />}
          </span>
          <p className="text-h4 text-primary">{hasActiveFilters ? copy.noMatchTitle : copy.emptyTitle}</p>
          <p className="max-w-md text-body-sm text-text-secondary">{hasActiveFilters ? copy.noMatchBody : emptyBody}</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg"
            >
              <XMarkIcon aria-hidden="true" className="size-4" />
              {copy.clearFilters}
            </button>
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
                    {copy.columnDirective}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnMission}
                  </th>
                  <th scope="col" className="hidden px-4 py-2 text-left font-semibold text-text-secondary sm:table-cell">
                    {personHeader}
                  </th>
                  <th scope="col" className="hidden px-4 py-2 text-left font-semibold text-text-secondary md:table-cell">
                    {copy.columnIssued}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnDue}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnStatus}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {directives.map((row) => (
                  <DirectiveRow
                    key={row.id}
                    row={row}
                    scope={scope}
                    locale={locale}
                    onClick={(event) => handleRowClick(event, row.id)}
                  />
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

/** Keeps a deep-linked id selectable even before (or without) its option list arriving. */
function withSelected(options: { value: string; label: string }[], selected: string | undefined): { value: string; label: string }[] {
  return selected && !options.some((option) => option.value === selected) ? [...options, { value: selected, label: selected }] : options
}

function DirectiveRow({
  row,
  scope,
  locale,
  onClick,
}: {
  row: Directive
  scope: ListScope
  locale: string
  onClick: (event: MouseEvent<HTMLTableRowElement>) => void
}) {
  const { t } = useI18n()
  const copy = t.directives.list
  const person = scope === 'attache' ? row.issued_by?.full_name : row.target_user?.full_name
  const isOpen = row.due_state !== 'completed' && row.due_state !== 'cancelled'

  return (
    <tr data-testid={`directive-row-${row.id}`} onClick={onClick} className="tw-table-row cursor-pointer bg-white hover:bg-section-bg">
      <td className="px-4 py-3 align-top">
        <div className="min-w-48 max-w-md">
          <Link to={`/directives/${row.id}`} title={row.description} className="line-clamp-2 font-semibold text-primary hover:underline">
            {row.description}
          </Link>
          {row.type_category && (
            <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-directive-soft px-2 py-0.5 text-caption font-medium text-directive-soft-text">
              {row.type_category}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-text-primary">{row.mission?.name ?? '—'}</td>
      <td className="hidden px-4 py-3 align-top text-text-primary sm:table-cell">{person ?? '—'}</td>
      <td className="hidden whitespace-nowrap px-4 py-3 align-top text-text-secondary md:table-cell">{formatDate(row.created_at, locale)}</td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col items-start gap-1">
          <DirectiveDueBadge dueState={row.due_state} daysUntilDue={row.days_until_due} />
          {row.target_completion_date ? (
            <span className="whitespace-nowrap text-caption text-text-muted">{formatDay(row.target_completion_date, locale)}</span>
          ) : (
            !isOpen && <span className="text-caption text-text-muted">{copy.noTargetDate}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <DirectiveStatusBadge status={row.status} />
          {row.is_stale && <DirectiveStaleBadge />}
        </div>
      </td>
    </tr>
  )
}
