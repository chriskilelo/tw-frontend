import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowPathIcon,
  ChartPieIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ListBulletIcon,
  LockClosedIcon,
  PauseCircleIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { getDirectiveOverview, type DirectiveAttentionCounts, type DirectiveOverviewFilters } from '../../api/sdt'
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from '../../components/Pagination'
import { Select } from '../../components/Select'
import { StatTile } from '../../components/dashboard/visuals'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { retryUnlessClientError } from '../../lib/apiErrors'
import { localeFor } from '../../lib/formatters'
import { formatNumber } from '../../lib/dashboardFormat'
import { ViewOnlyPill } from '../governance/governanceUi'
import { AttentionQueueCard } from './directiveOverview/AttentionQueue'
import { IssuerBoard, MissionBoard, RecentActivity } from './directiveOverview/OverviewBoards'
import { ATTENTION_QUEUES, directiveListLink, firstBusyQueue, type AttentionQueue } from './directiveOverview/overviewState'
import { oneOf } from './hqWorkspace/workspaceState'

/** DirectivePolicy::viewOverview(): the FR-DIR-012 summary roles. The API is the real guard. */
const OVERVIEW_ROLES = ['Ministry HQ Director', 'Ministry PS', 'Acting PS']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type OverviewKey = 'mission_id' | 'issued_by_user_id' | 'queue' | 'q' | 'page' | 'per_page'

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * The SDT console's directive oversight board: FR-SDT-001 (the PS's national directive
 * summary), FR-SDT-008/010 (the directors' read-only oversight of every mission's directives),
 * FR-DIR-003 (target-date groupings), FR-DIR-010 (stale flags) and FR-DIR-012. Where the
 * period summary (/directives/summary) answers "how did we do over a period", this board
 * answers "what needs attention now, and where". It only reads: a directive is acted on by its
 * issuing officer and its target attache, on the directive's own page. Filters live in the URL.
 */
export default function DirectiveOverviewPage() {
  const { t, language } = useI18n()
  const copy = t.sdt.directiveOverview
  const locale = localeFor(language)
  const { user, role, isLoading: authLoading } = useAuth()
  const canView = Boolean(role?.name && OVERVIEW_ROLES.includes(role.name))
  const location = useLocation()
  const queueHeadingRef = useRef<HTMLHeadingElement>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const rawMission = searchParams.get('mission_id')
  const rawIssuer = searchParams.get('issued_by_user_id')
  const missionId = rawMission && UUID_PATTERN.test(rawMission) ? rawMission : undefined
  const issuerId = rawIssuer && UUID_PATTERN.test(rawIssuer) ? rawIssuer : undefined
  const requestedQueue = oneOf(searchParams.get('queue'), ATTENTION_QUEUES)
  const q = (searchParams.get('q') ?? '').trim().slice(0, 200)
  const page = positiveInt(searchParams.get('page')) ?? 1
  const requestedPerPage = positiveInt(searchParams.get('per_page'))
  const perPage = requestedPerPage && (PER_PAGE_OPTIONS as readonly number[]).includes(requestedPerPage) ? requestedPerPage : DEFAULT_PER_PAGE

  function updateParams(changes: Partial<Record<OverviewKey, string | null>>, resetPage = true) {
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
        if (resetPage && !('page' in changes)) {
          next.delete('page')
        }
        return next
      },
      { replace: true },
    )
  }

  const filters: DirectiveOverviewFilters = { ...(missionId ? { mission_id: missionId } : {}), ...(issuerId ? { issued_by_user_id: issuerId } : {}) }
  const overviewQuery = useQuery({
    queryKey: ['sdt', 'directives', 'overview', filters],
    queryFn: () => getDirectiveOverview(filters),
    enabled: canView,
    retry: retryUnlessClientError,
    placeholderData: keepPreviousData,
  })
  const overview = overviewQuery.data

  // A tile links to "?queue=…#queue": bring the queue into view once per such navigation (never
  // again on a background refetch, which would pull focus away from wherever the user is).
  const handledNavigation = useRef<string | null>(null)
  useEffect(() => {
    if (location.hash !== '#queue' || !overview || handledNavigation.current === location.key) {
      return
    }
    handledNavigation.current = location.key
    queueHeadingRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    queueHeadingRef.current?.focus({ preventScroll: true })
  }, [location.hash, location.key, overview])

  if (authLoading) {
    return (
      <PageShell>
        <BoardSkeleton />
      </PageShell>
    )
  }

  const status = isAxiosError(overviewQuery.error) ? overviewQuery.error.response?.status : undefined
  if (!canView || status === 403) {
    return (
      <PageShell>
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        <Notice icon={<LockClosedIcon />} title={copy.forbiddenTitle} body={copy.forbiddenBody} action={<Link to="/directives" className="text-body-sm font-semibold text-info-soft-text hover:underline">{copy.listLink}</Link>} />
      </PageShell>
    )
  }

  if (overviewQuery.isError && !overview) {
    return (
      <PageShell>
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        {status === 422 ? (
          <Notice
            icon={<ExclamationTriangleIcon />}
            title={copy.invalidFiltersTitle}
            body={copy.invalidFilters}
            action={
              <button type="button" onClick={() => updateParams({ mission_id: null, issued_by_user_id: null })} className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
                {copy.filters.clear}
              </button>
            }
          />
        ) : (
          <Notice
            icon={<ExclamationTriangleIcon />}
            title={copy.loadErrorTitle}
            body={copy.loadError}
            action={
              <button type="button" onClick={() => void overviewQuery.refetch()} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
                <ArrowPathIcon aria-hidden="true" className="size-4" />
                {copy.retry}
              </button>
            }
          />
        )}
      </PageShell>
    )
  }

  const queue: AttentionQueue = requestedQueue ?? (overview ? firstBusyQueue(overview.attention) : 'overdue')
  const missionOptions = overview?.summary.filter_options.missions.map((mission) => ({ value: mission.id, label: mission.name })) ?? []
  const issuerOptions = overview?.summary.filter_options.issuers.map((issuer) => ({ value: issuer.id, label: issuer.full_name })) ?? []
  const hasFilters = Boolean(missionId || issuerId)
  const queueLink = (next: AttentionQueue) => {
    const query = new URLSearchParams(location.search)
    query.set('queue', next)
    query.delete('page')
    query.delete('q')
    return `?${query.toString()}#queue`
  }

  return (
    <PageShell>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-primary">{copy.title}</h1>
            <ViewOnlyPill label={copy.viewOnly} />
          </div>
          <p className="mt-1 max-w-2xl text-body text-text-secondary">{user?.ministry?.name ? copy.subtitle(user.ministry.name) : copy.subtitleNoDepartment}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/directives/summary" className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg">
            <ChartPieIcon aria-hidden="true" className="size-4" />
            {copy.summaryLink}
          </Link>
          <Link to={directiveListLink({ missionId, issuerId })} className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg">
            <ListBulletIcon aria-hidden="true" className="size-4" />
            {copy.listLink}
          </Link>
        </div>
      </header>

      <p className="flex items-start gap-2 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-body-sm text-info-soft-text">
        <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {copy.readOnlyNote}
      </p>

      <section aria-label={copy.filters.label} className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="sm:w-64">
          <Select
            label={copy.filters.mission}
            value={missionId ?? ''}
            placeholder={copy.filters.allMissions}
            onChange={(event) => updateParams({ mission_id: event.target.value || null })}
            options={withSelected(missionOptions, missionId)}
            className="w-full"
          />
        </div>
        <div className="sm:w-64">
          <Select
            label={copy.filters.issuer}
            value={issuerId ?? ''}
            placeholder={copy.filters.allIssuers}
            onChange={(event) => updateParams({ issued_by_user_id: event.target.value || null })}
            options={withSelected(issuerOptions, issuerId)}
            className="w-full"
          />
        </div>
        {hasFilters && (
          <button type="button" onClick={() => updateParams({ mission_id: null, issued_by_user_id: null })} className="inline-flex h-10 items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline sm:ml-auto">
            <XMarkIcon aria-hidden="true" className="size-4" />
            {copy.filters.clear}
          </button>
        )}
      </section>

      {!overview ? (
        <BoardSkeleton />
      ) : (
        <div className={`space-y-6 ${overviewQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}`}>
          {overview.my_follow_through && <MyFollowThrough counts={overview.my_follow_through} viewerId={user?.id} missionId={missionId} />}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" data-testid="directive-overview-tiles">
            <StatTile label={copy.tiles.open} value={formatNumber(overview.attention.open, locale)} icon={<ClipboardDocumentCheckIcon />} tone="directive" footnote={copy.tiles.openFootnote(overview.summary.total)} />
            <StatTile
              label={copy.tiles.overdue}
              value={formatNumber(overview.attention.overdue, locale)}
              icon={<ExclamationTriangleIcon />}
              tone="danger"
              to={queueLink('overdue')}
              footnote={copy.tiles.overdueFootnote}
              footnoteTone={overview.attention.overdue > 0 ? 'danger' : 'neutral'}
            />
            <StatTile label={copy.tiles.approaching} value={formatNumber(overview.attention.approaching, locale)} icon={<ClockIcon />} tone="atrisk" to={queueLink('approaching')} footnote={copy.tiles.approachingFootnote} />
            <StatTile
              label={copy.tiles.stale}
              value={formatNumber(overview.attention.stale, locale)}
              icon={<PauseCircleIcon />}
              tone="atrisk"
              to={queueLink('stale')}
              footnote={copy.tiles.staleFootnote}
              footnoteTone={overview.attention.stale > 0 ? 'atrisk' : 'neutral'}
            />
            <StatTile label={copy.tiles.awaitingClosure} value={formatNumber(overview.attention.awaiting_closure, locale)} icon={<CheckBadgeIcon />} tone="info" to={queueLink('awaiting_closure')} footnote={copy.tiles.awaitingClosureFootnote} />
            <StatTile
              label={copy.tiles.completionRate}
              value={`${formatNumber(overview.summary.percentages.completed, locale, 1)}%`}
              icon={<CheckCircleIcon />}
              tone="success"
              to={directiveListLink({ missionId, issuerId }, { due: 'completed' })}
              footnote={copy.tiles.completionFootnote(overview.summary.completed, overview.summary.total)}
            />
          </div>

          <AttentionQueueCard
            queue={queue}
            attention={overview.attention}
            missionId={missionId}
            issuerId={issuerId}
            q={q}
            page={page}
            perPage={perPage}
            headingRef={queueHeadingRef}
            onQueueChange={(next) => updateParams({ queue: next, q: null })}
            onSearch={(value) => updateParams({ q: value || null })}
            onPageChange={(next) => updateParams({ page: next > 1 ? String(next) : null }, false)}
            onPerPageChange={(next) => updateParams({ per_page: next === DEFAULT_PER_PAGE ? null : String(next) })}
          />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
            <MissionBoard rows={overview.missions} issuerId={issuerId} className="xl:col-span-3" />
            <IssuerBoard rows={overview.issuers} viewerId={user?.id} missionId={missionId} className="xl:col-span-2" />
          </div>

          <RecentActivity entries={overview.recent_activity} />
        </div>
      )}
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-310 space-y-6 px-4 py-6 sm:px-7" data-testid="directive-overview">
      {children}
    </div>
  )
}

function BoardSkeleton() {
  const { t } = useI18n()
  return (
    <div role="status" aria-label={t.sdt.directiveOverview.loading} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-white motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-border bg-white motion-reduce:animate-none" />
    </div>
  )
}

function Notice({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-sm" data-testid="directive-overview-notice">
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-section-bg text-text-secondary [&>svg]:size-6">
        {icon}
      </span>
      <p className="text-h3 text-primary">{title}</p>
      <p className="max-w-md text-body-sm text-text-secondary">{body}</p>
      {action}
    </div>
  )
}

/** For a PS or Acting PS who issued directives: what is waiting on them personally. */
function MyFollowThrough({ counts, viewerId, missionId }: { counts: DirectiveAttentionCounts; viewerId?: string; missionId?: string }) {
  const { t, language } = useI18n()
  const copy = t.sdt.directiveOverview.mine
  const locale = localeFor(language)
  const base = { missionId, issuerId: viewerId }
  const needsYou = counts.awaiting_closure + counts.overdue + counts.stale

  return (
    <section
      aria-label={copy.title}
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${needsYou > 0 ? 'border-directive/30 bg-directive-soft/40' : 'border-border bg-white'}`}
      data-testid="directive-overview-mine"
    >
      <p className="flex items-start gap-2 text-body-sm text-text-primary">
        <UserCircleIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-directive-soft-text" />
        <span>
          <span className="font-semibold">{copy.title}. </span>
          {needsYou > 0 ? copy.body(counts.awaiting_closure, counts.overdue, counts.stale) : copy.allClear(counts.open)}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {counts.awaiting_closure > 0 && (
          <Link
            to={directiveListLink(base, { status: 'completed' })}
            className="inline-flex h-9 items-center gap-1.5 rounded bg-accent px-3 text-body-sm font-semibold text-accent-text hover:bg-accent-light"
          >
            <CheckBadgeIcon aria-hidden="true" className="size-4" />
            {copy.reviewCompleted(formatNumber(counts.awaiting_closure, locale))}
          </Link>
        )}
        <Link to={directiveListLink(base)} className="inline-flex h-9 items-center gap-1.5 rounded border border-border bg-white px-3 text-body-sm font-semibold text-primary hover:bg-section-bg">
          {copy.allMine}
        </Link>
      </div>
    </section>
  )
}

/** Keeps a deep-linked id selectable before (or without) its option list arriving. */
function withSelected(options: { value: string; label: string }[], selected: string | undefined): { value: string; label: string }[] {
  return selected && !options.some((option) => option.value === selected) ? [...options, { value: selected, label: selected }] : options
}

