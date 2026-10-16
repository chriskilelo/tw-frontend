import { useId, useRef, type KeyboardEvent, type Ref } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
  PauseCircleIcon,
  SparklesIcon,
  UserIcon,
} from '@heroicons/react/20/solid'
import { listDirectives, type Directive } from '../../../api/directives'
import type { DirectiveAttentionCounts } from '../../../api/sdt'
import { Pagination } from '../../../components/Pagination'
import { DirectiveDueBadge, DirectiveStaleBadge, DirectiveStatusBadge } from '../../directives/DirectiveStatusBadge'
import { useI18n } from '../../../i18n/context'
import { retryUnlessClientError } from '../../../lib/apiErrors'
import { daysBetween, formatRelativeTime, localeFor } from '../../../lib/formatters'
import { SearchField, SectionEmpty, ListSkeleton } from '../hqWorkspace/workspaceUi'
import { WorkspaceSectionError } from '../hqWorkspace/WorkspaceSectionError'
import { ATTENTION_QUEUES, QUEUE_COUNT_KEY, QUEUE_FILTERS, directiveListLink, queueListParams, type AttentionQueue } from './overviewState'

const QUEUE_ICONS: Record<AttentionQueue, typeof ClockIcon> = {
  overdue: ExclamationTriangleIcon,
  stale: PauseCircleIcon,
  awaiting_closure: CheckBadgeIcon,
  approaching: ClockIcon,
  no_date: MinusCircleIcon,
}

const QUEUE_TONES: Record<AttentionQueue, string> = {
  overdue: 'bg-danger-soft text-danger-soft-text',
  stale: 'bg-atrisk-soft text-atrisk-soft-text',
  awaiting_closure: 'bg-directive-soft text-directive-soft-text',
  approaching: 'bg-atrisk-soft text-atrisk-soft-text',
  no_date: 'bg-section-bg text-text-secondary',
}

interface AttentionQueueProps {
  queue: AttentionQueue
  attention: DirectiveAttentionCounts
  missionId?: string
  issuerId?: string
  q: string
  page: number
  perPage: number
  onQueueChange: (queue: AttentionQueue) => void
  onSearch: (q: string) => void
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  headingRef: Ref<HTMLHeadingElement>
}

/**
 * FR-DIR-003, FR-DIR-010 and the URD lifecycle's review step: the directives that need someone
 * now, one queue at a time, straight from GET /directives with the board's mission and issuer
 * filters — so each queue's total is the tile's count, and a row opens the directive itself.
 */
export function AttentionQueueCard({ queue, attention, missionId, issuerId, q, page, perPage, onQueueChange, onSearch, onPageChange, onPerPageChange, headingRef }: AttentionQueueProps) {
  const { t } = useI18n()
  const copy = t.sdt.directiveOverview.queue
  const baseId = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const { filters, sort } = QUEUE_FILTERS[queue]

  const listFilters = {
    ...filters,
    ...(missionId ? { mission_id: missionId } : {}),
    ...(issuerId ? { issued_by_user_id: issuerId } : {}),
    ...(q ? { q } : {}),
    sort,
    page,
    per_page: perPage,
  }

  const listQuery = useQuery({
    queryKey: ['directives', 'list', listFilters],
    queryFn: () => listDirectives(listFilters),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: ATTENTION_QUEUES.length - 1 - index }
    const step = keys[event.key]
    if (step === undefined) {
      return
    }
    event.preventDefault()
    const next = ATTENTION_QUEUES[(index + step + ATTENTION_QUEUES.length) % ATTENTION_QUEUES.length]
    onQueueChange(next)
    tabRefs.current[next]?.focus()
  }

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <section aria-labelledby={`${baseId}-heading`} className="rounded-xl border border-border bg-white shadow-sm" data-testid="directive-attention-queue">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 id={`${baseId}-heading`} ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-h3 text-primary focus:outline-none">
            {copy.title}
          </h2>
          <p className="mt-0.5 text-body-sm text-text-secondary">{copy.subtitle}</p>
        </div>
        <Link to={directiveListLink({ missionId, issuerId }, queueListParams(queue))} className="inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline">
          {copy.openInList}
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <div className="px-4 pt-4 sm:px-5">
        <div role="tablist" aria-label={copy.tabsLabel} className="flex gap-1 overflow-x-auto rounded-lg bg-page-bg p-1">
          {ATTENTION_QUEUES.map((option, index) => {
            const isActive = option === queue
            const Icon = QUEUE_ICONS[option]
            const count = attention[QUEUE_COUNT_KEY[option]]
            return (
              <button
                key={option}
                ref={(node) => {
                  tabRefs.current[option] = node
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${option}`}
                aria-selected={isActive}
                aria-controls={`${baseId}-panel`}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(event) => handleKeyDown(event, index)}
                onClick={() => onQueueChange(option)}
                data-testid={`directive-queue-tab-${option}`}
                className={`inline-flex min-w-max flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm font-semibold transition-colors motion-reduce:transition-none ${
                  isActive ? 'bg-white text-primary shadow-sm ring-1 ring-border' : 'text-text-secondary hover:text-primary'
                }`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {copy.tabs[option]}
                <span className={`min-w-5 rounded-full px-1.5 text-center font-mono text-[0.6875rem] font-bold ${count > 0 ? QUEUE_TONES[option] : 'bg-section-bg text-text-muted'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-caption text-text-secondary">{copy.help[queue]}</p>
        <div className="mt-3 max-w-md">
          <SearchField label={copy.searchLabel} placeholder={copy.searchPlaceholder} value={q} onSearch={onSearch} />
        </div>
      </div>

      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${queue}`} className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        {listQuery.isError && !listQuery.data ? (
          <WorkspaceSectionError error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : !listQuery.data ? (
          <ListSkeleton label={t.sdt.directiveOverview.loading} rows={3} />
        ) : rows.length === 0 ? (
          <SectionEmpty icon={<SparklesIcon />} title={q ? t.sdt.hqWorkspace.noMatchTitle : copy.empty[queue].title} body={q ? t.sdt.hqWorkspace.noMatchBody : copy.empty[queue].body} />
        ) : (
          <div className={listQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <ul className="divide-y divide-border rounded-lg border border-border" data-testid="directive-attention-list">
              {rows.map((directive) => (
                <li key={directive.id}>
                  <QueueRow directive={directive} queue={queue} />
                </li>
              ))}
            </ul>
            {meta && <Pagination meta={meta} onPageChange={onPageChange} onPerPageChange={onPerPageChange} className="mt-4" />}
          </div>
        )}
      </div>
    </section>
  )
}

function QueueRow({ directive, queue }: { directive: Directive; queue: AttentionQueue }) {
  const { t, language } = useI18n()
  const copy = t.sdt.directiveOverview.queue
  const locale = localeFor(language)

  return (
    <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:gap-4" data-testid={`overview-queue-row-${directive.id}`}>
      <div className="min-w-0 flex-1">
        <Link to={`/directives/${directive.id}`} className="line-clamp-2 text-body-sm font-semibold text-primary hover:underline">
          {directive.description}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-secondary">
          {directive.mission && (
            <span className="inline-flex items-center gap-1">
              <BuildingOffice2Icon aria-hidden="true" className="size-3.5" />
              {directive.mission.name}
            </span>
          )}
          {directive.target_user && (
            <span className="inline-flex items-center gap-1">
              <UserIcon aria-hidden="true" className="size-3.5" />
              {directive.target_user.full_name}
            </span>
          )}
          {directive.issued_by && <span>{copy.issuedBy(directive.issued_by.full_name)}</span>}
          <span className="inline-flex items-center gap-1">
            <CalendarDaysIcon aria-hidden="true" className="size-3.5" />
            {directive.last_progress_update_at ? copy.lastProgress(formatRelativeTime(directive.last_progress_update_at, locale)) : copy.noProgress}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:max-w-72 sm:justify-end">
        <DirectiveStatusBadge status={directive.status} />
        <DirectiveDueBadge dueState={directive.due_state} daysUntilDue={directive.days_until_due} />
        {directive.is_stale && queue !== 'stale' && <DirectiveStaleBadge />}
        {queue === 'stale' && directive.last_progress_update_at && (
          <span className="inline-flex items-center gap-1 rounded-full bg-atrisk-soft px-2.5 py-1 text-caption font-semibold text-atrisk-soft-text">
            <PauseCircleIcon aria-hidden="true" className="size-3.5" />
            {copy.quietFor(daysBetween(directive.last_progress_update_at))}
          </span>
        )}
        {queue === 'awaiting_closure' && directive.last_progress_update_at && (
          <span className="inline-flex items-center gap-1 rounded-full bg-directive-soft px-2.5 py-1 text-caption font-semibold text-directive-soft-text">
            <CheckBadgeIcon aria-hidden="true" className="size-3.5" />
            {copy.waitingFor(daysBetween(directive.last_progress_update_at))}
          </span>
        )}
      </div>
    </div>
  )
}
