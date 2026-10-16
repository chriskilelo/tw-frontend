import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  InboxStackIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PauseCircleIcon,
  PlusIcon,
  QueueListIcon,
  UserIcon,
} from '@heroicons/react/20/solid'
import { addDirectiveNote, transitionDirectiveStatus } from '../../../api/directives'
import {
  listHqWorkspaceDirectives,
  type HqDirectiveAttention,
  type HqDirectiveQueue,
  type HqWorkspaceDirective,
  type HqWorkspaceDirectiveFilters,
  type HqWorkspaceOverview,
} from '../../../api/sdt'
import { Pagination, DEFAULT_PER_PAGE } from '../../../components/Pagination'
import { Select } from '../../../components/Select'
import { DirectiveDueBadge, DirectiveStaleBadge, DirectiveStatusBadge } from '../../directives/DirectiveStatusBadge'
import { TransitionNoteModal } from '../../directives/DirectiveActionModals'
import { useI18n } from '../../../i18n/context'
import { apiErrorMessages, retryUnlessClientError } from '../../../lib/apiErrors'
import { formatDate, formatRelativeTime, localeFor } from '../../../lib/formatters'
import { ActionNotice, ChipGroup, ListSkeleton, OutsidePortfolioPill, SearchField, SectionEmpty } from './workspaceUi'
import { issueDirectiveLink, oneOf, rowActionError, useActionNotice, type WorkspaceParams } from './workspaceState'
import { WorkspaceSectionError } from './WorkspaceSectionError'

const QUEUES: HqDirectiveQueue[] = ['attention', 'awaiting_closure', 'open', 'all']
const SORTS = ['priority', 'target_completion_date', '-created_at', 'last_progress_update_at'] as const

const QUEUE_ICONS: Record<HqDirectiveQueue, typeof FlagIcon> = {
  attention: FlagIcon,
  awaiting_closure: CheckBadgeIcon,
  open: InboxStackIcon,
  all: QueueListIcon,
}

const ATTENTION_STYLE: Record<HqDirectiveAttention, { className: string; icon: typeof FlagIcon }> = {
  awaiting_closure: { className: 'bg-directive-soft text-directive-soft-text', icon: CheckBadgeIcon },
  overdue: { className: 'bg-danger-soft text-danger-soft-text', icon: ExclamationTriangleIcon },
  stale: { className: 'bg-atrisk-soft text-atrisk-soft-text', icon: PauseCircleIcon },
  approaching: { className: 'bg-atrisk-soft text-atrisk-soft-text', icon: ClockIcon },
}

type PendingAction = { kind: 'closed' | 'cancelled' | 'note'; directive: HqWorkspaceDirective }

/**
 * FR-SDT-014 and FR-DIR-009 to 011: the directives this officer issued, led by what needs them
 * — completed work to accept and close, overdue and stale directives to follow up — with the
 * issuer's actions in place. The actions offered are the API's allowed_actions for each row
 * (DirectivePolicy and the state machine together).
 */
export default function WorkspaceDirectives({ workspace, overview, onChanged }: { workspace: WorkspaceParams; overview?: HqWorkspaceOverview; onChanged: () => void }) {
  const { t } = useI18n()
  const copy = t.sdt.hqWorkspace.directives
  const queryClient = useQueryClient()
  const { params, update } = workspace
  const queue = oneOf(params.get('queue'), QUEUES) ?? 'attention'
  const sort = oneOf(params.get('sort'), SORTS) ?? 'priority'

  const filters: HqWorkspaceDirectiveFilters = {
    scope: params.scope,
    mission_id: params.missionId,
    queue,
    q: params.q || undefined,
    sort,
    page: params.page,
    per_page: params.perPage,
  }

  const listQuery = useQuery({
    queryKey: ['sdt', 'hq-workspace', 'directives', filters],
    queryFn: () => listHqWorkspaceDirectives(filters),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })

  const [pending, setPending] = useState<PendingAction | null>(null)
  const [modalErrors, setModalErrors] = useState<string[] | null>(null)
  const [notice, showNotice] = useActionNotice()
  const [rowError, setRowError] = useState<string | null>(null)

  const actionMutation = useMutation({
    mutationFn: async ({ action, note }: { action: PendingAction; note: string }) => {
      if (action.kind === 'note') {
        await addDirectiveNote(action.directive.id, { content: note })
        return
      }
      await transitionDirectiveStatus(action.directive.id, { status: action.kind, ...(note ? { note } : {}) })
    },
    onMutate: () => {
      setModalErrors(null)
      setRowError(null)
    },
    onSuccess: (_, { action }) => {
      setPending(null)
      showNotice(copy.notices[action.kind])
      void queryClient.invalidateQueries({ queryKey: ['directive', action.directive.id] })
      void queryClient.invalidateQueries({ queryKey: ['directives'] })
      onChanged()
    },
    onError: (error) => {
      // A 422 (e.g. a blank withdrawal reason) is fixable in the dialog; anything else (the
      // directive moved on or is no longer this officer's to act on) closes it and refreshes.
      if (isAxiosError(error) && error.response?.status === 422) {
        setModalErrors(apiErrorMessages(error, t.common.genericError))
        return
      }
      setPending(null)
      setRowError(rowActionError(error, t))
      void queryClient.invalidateQueries({ queryKey: ['sdt', 'hq-workspace'] })
    },
  })

  const counts = overview?.counts.directives
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const modals = t.directives.detail.modals

  return (
    <div className="space-y-4">
      <div role="group" aria-label={t.sdt.hqWorkspace.filters.label} className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChipGroup<HqDirectiveQueue>
            label={copy.queueLabel}
            value={queue}
            onChange={(next) => update({ queue: next === 'attention' ? null : next })}
            options={QUEUES.map((value) => {
              const Icon = QUEUE_ICONS[value]
              return { value, label: copy.queues[value], count: counts?.[value], icon: <Icon /> }
            })}
          />
          <Link
            to={issueDirectiveLink(params.missionId)}
            className="inline-flex h-9 items-center gap-1.5 rounded bg-accent px-3 text-body-sm font-semibold text-accent-text hover:bg-accent-light"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            {t.sdt.hqWorkspace.issueDirective}
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_15rem]">
          <SearchField label={t.sdt.hqWorkspace.filters.search} placeholder={copy.searchPlaceholder} value={params.q} onSearch={(value) => update({ q: value || null })} />
          <Select
            label={t.sdt.hqWorkspace.filters.sort}
            value={sort}
            onChange={(event) => update({ sort: event.target.value === 'priority' ? null : event.target.value })}
            options={SORTS.map((value) => ({ value, label: copy.sort[value] }))}
          />
        </div>
        <p className="text-caption text-text-secondary">{copy.personalNote}</p>
      </div>

      <ActionNotice message={notice} />
      {rowError && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-body-sm text-danger-soft-text">
          {rowError}
        </p>
      )}

      {listQuery.isError && !listQuery.data ? (
        <WorkspaceSectionError error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : !listQuery.data ? (
        <ListSkeleton label={t.sdt.hqWorkspace.loading} />
      ) : rows.length === 0 ? (
        <SectionEmpty
          icon={params.q ? <MagnifyingGlassIcon /> : <ClipboardDocumentListIcon />}
          title={params.q ? t.sdt.hqWorkspace.noMatchTitle : copy.empty[queue].title}
          body={params.q ? t.sdt.hqWorkspace.noMatchBody : copy.empty[queue].body}
          action={
            params.q ? (
              <button type="button" onClick={() => update({ q: null })} className="text-body-sm font-semibold text-info-soft-text hover:underline">
                {t.sdt.hqWorkspace.filters.clear}
              </button>
            ) : (
              <Link to={issueDirectiveLink(params.missionId)} className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-info-soft-text hover:underline">
                <PlusIcon aria-hidden="true" className="size-4" />
                {t.sdt.hqWorkspace.issueDirective}
              </Link>
            )
          }
        />
      ) : (
        <div className={listQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <p aria-live="polite" className="mb-2 text-body-sm text-text-secondary">
            {t.sdt.hqWorkspace.filters.resultCount(meta?.total ?? rows.length)}
          </p>
          <ul className="space-y-2.5" data-testid="workspace-directive-list">
            {rows.map((directive) => (
              <li key={directive.id}>
                <DirectiveCard directive={directive} onAction={(kind) => setPending({ kind, directive })} />
              </li>
            ))}
          </ul>
          {meta && (
            <Pagination
              meta={meta}
              onPageChange={(page) => update({ page: page > 1 ? String(page) : null }, false)}
              onPerPageChange={(perPage) => update({ per_page: perPage === DEFAULT_PER_PAGE ? null : String(perPage) })}
              className="mt-4"
            />
          )}
        </div>
      )}

      <TransitionNoteModal
        open={pending?.kind === 'closed'}
        onClose={() => setPending(null)}
        title={modals.closed.title}
        body={modals.closed.body}
        label={modals.closed.label}
        placeholder={modals.closed.placeholder}
        submitLabel={modals.closed.submit}
        cancelLabel={modals.closed.cancel}
        isRequired={false}
        isPending={actionMutation.isPending}
        errorMessages={modalErrors}
        onSubmit={(note) => pending && actionMutation.mutate({ action: pending, note })}
      />
      <TransitionNoteModal
        open={pending?.kind === 'cancelled'}
        onClose={() => setPending(null)}
        title={modals.cancelled.title}
        body={modals.cancelled.body}
        label={modals.cancelled.label}
        placeholder={modals.cancelled.placeholder}
        submitLabel={modals.cancelled.submit}
        cancelLabel={modals.cancelled.cancel}
        isRequired
        isDestructive
        isPending={actionMutation.isPending}
        errorMessages={modalErrors}
        onSubmit={(note) => pending && actionMutation.mutate({ action: pending, note })}
      />
      <TransitionNoteModal
        open={pending?.kind === 'note'}
        onClose={() => setPending(null)}
        title={copy.followUp.title}
        body={copy.followUp.body}
        label={copy.followUp.label}
        placeholder={t.directives.detail.composer.followUpPlaceholder}
        submitLabel={copy.followUp.submit}
        cancelLabel={copy.followUp.cancel}
        isRequired
        isPending={actionMutation.isPending}
        errorMessages={modalErrors}
        onSubmit={(note) => pending && actionMutation.mutate({ action: pending, note })}
      />
    </div>
  )
}

function DirectiveCard({ directive, onAction }: { directive: HqWorkspaceDirective; onAction: (kind: PendingAction['kind']) => void }) {
  const { t, language } = useI18n()
  const copy = t.sdt.hqWorkspace.directives
  const locale = localeFor(language)
  const canClose = directive.allowed_actions.transitions.includes('closed')
  const canWithdraw = directive.allowed_actions.transitions.includes('cancelled')
  const needsYou = directive.attention.includes('awaiting_closure') || directive.attention.includes('overdue')

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition duration-200 hover:shadow-md motion-reduce:transition-none ${
        needsYou ? 'border-directive/30 border-l-4 border-l-directive' : 'border-border'
      }`}
      data-testid={`workspace-directive-${directive.id}`}
    >
      <div className="flex gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-directive-soft text-directive-soft-text">
          <ClipboardDocumentCheckIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-body font-semibold text-text-primary">
            <Link to={`/directives/${directive.id}`} className="hover:text-primary hover:underline">
              {directive.description}
            </Link>
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <DirectiveStatusBadge status={directive.status} />
            <DirectiveDueBadge dueState={directive.due_state} daysUntilDue={directive.days_until_due} />
            {directive.is_stale && <DirectiveStaleBadge />}
            {directive.attention
              .filter((reason) => reason === 'awaiting_closure')
              .map((reason) => {
                const style = ATTENTION_STYLE[reason]
                const Icon = style.icon
                return (
                  <span key={reason} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold ${style.className}`}>
                    <Icon aria-hidden="true" className="size-3.5" />
                    {copy.attention[reason]}
                  </span>
                )
              })}
            {directive.in_portfolio === false && <OutsidePortfolioPill />}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-secondary">
            {directive.target_user && (
              <span className="inline-flex items-center gap-1">
                <UserIcon aria-hidden="true" className="size-3.5" />
                {directive.target_user.full_name}
              </span>
            )}
            {directive.mission && (
              <span className="inline-flex items-center gap-1">
                <BuildingOffice2Icon aria-hidden="true" className="size-3.5" />
                {directive.mission.name}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDaysIcon aria-hidden="true" className="size-3.5" />
              {copy.issued(formatDate(directive.created_at, locale))}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowPathIcon aria-hidden="true" className="size-3.5" />
              {directive.last_progress_update_at ? copy.lastProgress(formatRelativeTime(directive.last_progress_update_at, locale)) : copy.noProgress}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        <Link
          to={`/directives/${directive.id}`}
          aria-label={copy.openAria(directive.description)}
          className="mr-auto inline-flex h-9 items-center gap-1.5 rounded px-2 text-body-sm font-semibold text-primary hover:bg-section-bg"
        >
          {copy.open}
        </Link>
        {canWithdraw && (
          <button
            type="button"
            onClick={() => onAction('cancelled')}
            aria-label={copy.withdrawAria(directive.description)}
            className="inline-flex h-9 items-center gap-1.5 rounded px-3 text-body-sm font-semibold text-danger-soft-text hover:bg-danger-soft/60"
          >
            <NoSymbolIcon aria-hidden="true" className="size-4" />
            {t.directives.detail.actions.cancelled}
          </button>
        )}
        {directive.allowed_actions.add_note && (
          <button
            type="button"
            onClick={() => onAction('note')}
            aria-label={copy.followUpAria(directive.description)}
            className="inline-flex h-9 items-center gap-1.5 rounded border border-border bg-white px-3 text-body-sm font-semibold text-primary hover:bg-section-bg"
          >
            <ChatBubbleBottomCenterTextIcon aria-hidden="true" className="size-4" />
            {copy.followUpButton}
          </button>
        )}
        {canClose && (
          <button
            type="button"
            onClick={() => onAction('closed')}
            aria-label={copy.closeAria(directive.description)}
            className="inline-flex h-9 items-center gap-1.5 rounded bg-accent px-3 text-body-sm font-semibold text-accent-text hover:bg-accent-light"
          >
            <CheckBadgeIcon aria-hidden="true" className="size-4" />
            {t.directives.detail.actions.closed}
          </button>
        )}
      </div>
    </article>
  )
}
