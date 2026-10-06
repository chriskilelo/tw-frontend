import { useId, useRef, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  QueueListIcon,
  SparklesIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import {
  GOVERNANCE_ITEM_TYPES,
  getMissionActivityFeed,
  getMissionActivitySummary,
  type GovernanceItemType,
  type MissionActivityFilters,
  type MissionActivityItem,
  type MissionActivitySort,
} from '../../api/governance'
import { Select } from '../../components/Select'
import { Pagination, DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from '../../components/Pagination'
import { useI18n } from '../../i18n/context'
import { formatRelativeTime, localeFor } from '../../lib/formatters'
import { periodRange } from '../../lib/dashboardFormat'
import { urgencyTier } from '../alerts/alertAssessment'
import { ActivityTrendCard, DepartmentFilter, GovernanceStatusBadge, GovernanceUnavailable, QuarterSummary, SummarySkeleton, TypeChip, ViewOnlyPill } from './governanceUi'
import { STATUS_ORDER, TYPE_STYLE, isGovernanceType, retryUnlessRefused, useQuarterLabel, useStatusLabel } from './governanceTheme'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const QUARTER_PATTERN = /^Q[1-4] \d{4}$/

type FilterKey = 'ministry_id' | 'type' | 'status' | 'period' | 'sort' | 'page' | 'per_page'

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * FR-HOM-001 to 003: the Head of Mission's (and Deputy Head of Mission's) read-only view of
 * every trade submission from their own mission — alerts, inquiries and submitted quarterly
 * reports from each department posted there. The API fixes the mission to the viewer's own;
 * a department filter (AC3), the FR-HOM-002 quarter summary and a six-quarter trend sit above
 * a dated feed whose every item opens the full record read-only (AC2). There is no create,
 * edit, approve or reject control anywhere on the page (AC4, BR-020). Filters live in the URL.
 */
export default function MissionActivityPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.missionActivity
  const feedCopy = copy.feed
  const quarterLabel = useQuarterLabel()
  const statusLabel = useStatusLabel()
  const feedHeadingRef = useRef<HTMLHeadingElement>(null)
  const typeGroupId = useId()

  const [searchParams, setSearchParams] = useSearchParams()
  const rawMinistry = searchParams.get('ministry_id')
  const ministryId = rawMinistry && UUID_PATTERN.test(rawMinistry) ? rawMinistry : undefined
  const rawType = searchParams.get('type')
  const type = isGovernanceType(rawType) ? rawType : undefined
  const rawStatus = searchParams.get('status')
  const status = type && rawStatus && STATUS_ORDER[type].includes(rawStatus) ? rawStatus : undefined
  const rawPeriod = searchParams.get('period')
  const period = rawPeriod && QUARTER_PATTERN.test(rawPeriod) ? rawPeriod : undefined
  const sort: MissionActivitySort = searchParams.get('sort') === 'date' ? 'date' : '-date'
  const page = positiveInt(searchParams.get('page')) ?? 1
  const requestedPerPage = positiveInt(searchParams.get('per_page'))
  const perPage = requestedPerPage && (PER_PAGE_OPTIONS as readonly number[]).includes(requestedPerPage) ? requestedPerPage : DEFAULT_PER_PAGE
  const hasFeedFilters = Boolean(type || status || period)

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

  const summaryQuery = useQuery({
    queryKey: ['mission-activity', 'summary', ministryId ?? null],
    queryFn: () => getMissionActivitySummary(ministryId),
    retry: retryUnlessRefused,
    placeholderData: keepPreviousData,
  })

  const filters: MissionActivityFilters = { ministry_id: ministryId, type, status, period, sort, page, per_page: perPage }
  const feedQuery = useQuery({
    queryKey: ['mission-activity', 'feed', filters],
    queryFn: () => getMissionActivityFeed(filters),
    retry: retryUnlessRefused,
    placeholderData: keepPreviousData,
  })

  if (summaryQuery.isError && !summaryQuery.data) {
    return (
      <PageShell>
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        <GovernanceUnavailable error={summaryQuery.error} forbiddenBody={t.governance.unavailable.missionActivityBody} onRetry={() => void summaryQuery.refetch()} />
      </PageShell>
    )
  }

  const summary = summaryQuery.data
  const items = feedQuery.data?.data ?? []
  const meta = feedQuery.data?.meta
  const quarterOptions = [...(summary?.trend ?? [])].reverse().map((point) => ({ value: point.label, label: quarterLabel(point) }))
  if (period && !quarterOptions.some((option) => option.value === period)) {
    quarterOptions.push({ value: period, label: period })
  }

  function showStatusInFeed(nextType: GovernanceItemType, nextStatus: string) {
    updateParams({ type: nextType, status: nextStatus, period: summary?.current_period.label ?? null })
    feedHeadingRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    feedHeadingRef.current?.focus({ preventScroll: true })
  }

  function clearFeedFilters() {
    updateParams({ type: null, status: null, period: null })
  }

  return (
    <PageShell>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-primary">{copy.title}</h1>
            <ViewOnlyPill label={t.governance.viewOnly} />
          </div>
          {summary ? (
            <p className="mt-1 text-body text-text-secondary" data-testid="mission-activity-subtitle">
              {copy.subtitle(summary.mission.name, summary.mission.host_country)}
            </p>
          ) : (
            <span className="mt-2 block h-5 w-56 animate-pulse rounded bg-section-bg motion-reduce:animate-none" />
          )}
          <p className="mt-1 max-w-2xl text-body-sm text-text-secondary">{copy.intro}</p>
        </div>
        {summary && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-caption font-semibold text-text-secondary shadow-sm ring-1 ring-border">
            <ClockIcon aria-hidden="true" className="size-4" />
            {summary.last_activity_at ? copy.lastActivity(formatRelativeTime(summary.last_activity_at, locale)) : copy.noActivityYet}
          </p>
        )}
      </header>

      <p className="flex items-start gap-2 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-body-sm text-info-soft-text">
        <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {copy.readOnlyNote}
      </p>

      {summary ? (
        <>
          <section aria-labelledby="departments-heading" className="space-y-3">
            <h2 id="departments-heading" className="text-h4 text-primary">
              {t.governance.departments.title}
            </h2>
            <DepartmentFilter departments={summary.departments} selectedId={ministryId ?? null} onSelect={(id) => updateParams({ ministry_id: id })} />
          </section>

          <section aria-labelledby="summary-heading" className="space-y-3">
            <div>
              <h2 id="summary-heading" className="text-h3 text-primary">
                {t.governance.summary.title}
              </h2>
              <p className="text-body-sm text-text-secondary">{t.governance.summary.subtitle(quarterLabel(summary.current_period), quarterLabel(summary.prior_period))}</p>
            </div>
            <QuarterSummary current={summary.current_period} prior={summary.prior_period} onSelectStatus={showStatusInFeed} />
          </section>

          <ActivityTrendCard points={summary.trend} />
        </>
      ) : (
        <SummarySkeleton label={t.common.loading} />
      )}

      <section aria-labelledby="feed-heading" className="space-y-4">
        <div>
          <h2 id="feed-heading" ref={feedHeadingRef} tabIndex={-1} className="scroll-mt-4 text-h3 text-primary focus:outline-none">
            {feedCopy.title}
          </h2>
          <p className="text-body-sm text-text-secondary">{feedCopy.subtitle}</p>
        </div>

        <div aria-label={feedCopy.filtersLabel} role="group" className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
          <div role="group" aria-labelledby={typeGroupId} className="flex flex-wrap items-center gap-2">
            <span id={typeGroupId} className="mr-1 text-body-sm font-semibold text-text-secondary">
              {feedCopy.typeLabel}
            </span>
            <FilterChip active={!type} onClick={() => updateParams({ type: null, status: null })} icon={<QueueListIcon />} label={feedCopy.allTypes} />
            {GOVERNANCE_ITEM_TYPES.map((option) => (
              <FilterChip
                key={option}
                active={type === option}
                onClick={() => updateParams({ type: type === option ? null : option, status: null })}
                icon={TYPE_STYLE[option].icon}
                label={t.governance.types[option]}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            {type && (
              <div className="md:w-56">
                <Select
                  label={feedCopy.statusLabel}
                  value={status ?? ''}
                  onChange={(event) => updateParams({ status: event.target.value || null })}
                  placeholder={feedCopy.allStatuses}
                  options={STATUS_ORDER[type].map((value) => ({ value, label: statusLabel(type, value) }))}
                  className="w-full"
                />
              </div>
            )}
            <div className="md:w-72">
              <Select
                label={feedCopy.quarterLabel}
                value={period ?? ''}
                onChange={(event) => updateParams({ period: event.target.value || null })}
                placeholder={t.governance.quarter.allQuarters}
                options={quarterOptions}
                className="w-full"
              />
            </div>
            <div className="md:w-48">
              <Select
                label={feedCopy.sortLabel}
                value={sort}
                onChange={(event) => updateParams({ sort: event.target.value === '-date' ? null : event.target.value })}
                options={(['-date', 'date'] as const).map((value) => ({ value, label: feedCopy.sort[value] }))}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p aria-live="polite" className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary">
              <FunnelIcon aria-hidden="true" className="size-4" />
              {meta ? feedCopy.resultCount(meta.total) : feedCopy.loading}
            </p>
            {hasFeedFilters && (
              <button type="button" onClick={clearFeedFilters} className="inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline">
                <XMarkIcon aria-hidden="true" className="size-4" />
                {feedCopy.clearFilters}
              </button>
            )}
          </div>
        </div>

        {feedQuery.isError && !feedQuery.data ? (
          <GovernanceUnavailable error={feedQuery.error} forbiddenBody={t.governance.unavailable.missionActivityBody} onRetry={() => void feedQuery.refetch()} />
        ) : !feedQuery.data ? (
          <div role="status" aria-label={feedCopy.loading} className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl border border-border bg-white motion-reduce:animate-none" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-sm">
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-success-soft text-success-soft-text [&>svg]:size-5">
              {hasFeedFilters || ministryId ? <MagnifyingGlassIcon /> : <SparklesIcon />}
            </span>
            <p className="text-h4 text-primary">{hasFeedFilters || ministryId ? feedCopy.noMatchTitle : feedCopy.emptyTitle}</p>
            <p className="max-w-md text-body-sm text-text-secondary">{hasFeedFilters || ministryId ? feedCopy.noMatchBody : feedCopy.emptyBody}</p>
            {(hasFeedFilters || ministryId) && (
              <button
                type="button"
                onClick={() => updateParams({ type: null, status: null, period: null, ministry_id: null })}
                className="mt-2 inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg"
              >
                <XMarkIcon aria-hidden="true" className="size-4" />
                {feedCopy.clearFilters}
              </button>
            )}
          </div>
        ) : (
          <div className={feedQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <ActivityFeed items={items} />
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
      </section>
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-310 space-y-6 px-4 py-6 sm:px-7">{children}</div>
}

function FilterChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-body-sm font-semibold transition-colors [&_svg]:size-4 ${
        active ? 'border-primary bg-primary text-white' : 'border-border bg-white text-text-secondary hover:bg-section-bg hover:text-primary'
      }`}
    >
      <span aria-hidden="true" className="contents">
        {icon}
      </span>
      {label}
    </button>
  )
}

function dayKey(value: string): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** The feed, grouped under one heading per day ("Today", "Yesterday", then the date). */
function ActivityFeed({ items }: { items: MissionActivityItem[] }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.missionActivity.feed
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  const groups: { key: string; heading: string; items: MissionActivityItem[] }[] = []
  for (const item of items) {
    const key = dayKey(item.date)
    let group = groups.find((candidate) => candidate.key === key)
    if (!group) {
      const heading =
        key === dayKey(now.toISOString())
          ? copy.today
          : key === dayKey(yesterday.toISOString())
            ? copy.yesterday
            : new Date(item.date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      group = { key, heading, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }

  return (
    <div className="space-y-5" data-testid="mission-activity-feed">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.heading}>
          <h3 className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-muted">{group.heading}</h3>
          <ol className="space-y-2.5">
            {group.items.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <FeedItem item={item} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

/**
 * One submission. The record's title is the link to its full, read-only content (FR-HOM-001
 * AC2); it is stretched over the card so the whole card is a target while screen readers hear
 * one short link name.
 */
function FeedItem({ item }: { item: MissionActivityItem }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.missionActivity.feed
  const typeLabel = t.governance.typeSingular[item.type]
  const { headline, details, excerpt, flags } = describe(item, t, locale)

  return (
    <article className="group relative flex gap-3 rounded-xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:border-primary/25 hover:shadow-md has-[a:focus-visible]:border-primary motion-reduce:transition-none" data-testid={`activity-item-${item.id}`}>
      <TypeChip type={item.type} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={item.link}
            aria-label={copy.openAria(typeLabel.toLowerCase(), item.reference)}
            className="font-semibold text-primary after:absolute after:inset-0 after:rounded-xl hover:underline"
          >
            {typeLabel} <span className="font-mono text-body-sm font-medium text-text-secondary">{item.reference}</span>
          </Link>
          <GovernanceStatusBadge type={item.type} status={item.status} />
          {flags}
        </div>
        <p className="mt-1 text-body-sm font-medium text-text-primary">{headline}</p>
        {details.length > 0 && <p className="mt-0.5 text-caption text-text-secondary">{details.join(' · ')}</p>}
        {excerpt && <p className="mt-1 line-clamp-2 text-body-sm text-text-secondary">{excerpt}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <BuildingOffice2Icon aria-hidden="true" className="size-3.5" />
            {item.ministry.name}
          </span>
          <span className="inline-flex items-center gap-1">
            <UserIcon aria-hidden="true" className="size-3.5" />
            {item.submitting_officer ? copy.submittedBy(item.submitting_officer) : copy.unknownOfficer}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon aria-hidden="true" className="size-3.5" />
            <time dateTime={item.date}>{new Date(item.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time>
          </span>
        </p>
      </div>
      <span aria-hidden="true" className="hidden shrink-0 items-center gap-1 self-center text-body-sm font-semibold text-info-soft-text sm:inline-flex">
        {copy.open}
        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </span>
    </article>
  )
}

function Flag({ tone, icon, label }: { tone: 'accent' | 'danger'; icon: ReactNode; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold [&_svg]:size-3.5 ${
        tone === 'accent' ? 'bg-accent-soft text-accent-soft-text' : 'bg-danger-soft text-danger-soft-text'
      }`}
    >
      <span aria-hidden="true" className="contents">
        {icon}
      </span>
      {label}
    </span>
  )
}

function describe(
  item: MissionActivityItem,
  t: ReturnType<typeof useI18n>['t'],
  locale: string,
): { headline: string; details: string[]; excerpt: string | null; flags: ReactNode } {
  const copy = t.governance.missionActivity.feed

  switch (item.type) {
    case 'alert': {
      const summary = item.summary
      const intelligence = summary?.intelligence_type ? ((t.alerts.intelligenceType as Record<string, string>)[summary.intelligence_type] ?? summary.intelligence_type) : null
      const tier = summary?.urgency ? urgencyTier(summary.urgency) : null
      const details = [
        summary?.sector ? copy.sector(summary.sector) : null,
        summary?.product_category ?? null,
        summary?.urgency ? (tier ? t.alerts.submit.urgencyOptions[tier].summary : copy.urgency(summary.urgency)) : null,
      ].filter((value): value is string => Boolean(value))
      return {
        headline: [summary?.country, intelligence].filter(Boolean).join(' · ') || t.governance.typeSingular.alert,
        details,
        excerpt: summary?.excerpt ?? null,
        flags: null,
      }
    }
    case 'inquiry': {
      const summary = item.summary
      return {
        headline: [summary?.category, summary?.inquirer_organisation].filter(Boolean).join(' · ') || t.governance.typeSingular.inquiry,
        details: summary?.product_or_sector ? [summary.product_or_sector] : [],
        excerpt: summary?.excerpt ?? null,
        flags: (
          <>
            {summary?.high_value && <Flag tone="accent" icon={<SparklesIcon />} label={copy.highValue} />}
            {summary?.sub_type === 'dispute_or_complaint' && <Flag tone="danger" icon={<ExclamationTriangleIcon />} label={copy.dispute} />}
          </>
        ),
      }
    }
    default: {
      const summary = item.summary
      return {
        headline: summary ? copy.reportFor(summary.period_label, periodRange({ label: summary.period_label, start: summary.period_start, end: summary.period_end }, locale)) : t.governance.typeSingular.periodic_report,
        details: [],
        excerpt: null,
        flags: null,
      }
    }
  }
}
