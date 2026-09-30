import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  CheckIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  EyeIcon,
  InformationCircleIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlayIcon,
  ShieldExclamationIcon,
  TagIcon,
  UserIcon,
  UserCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import {
  addDirectiveNote,
  getDirective,
  transitionDirectiveStatus,
  type DirectiveActionableStatus,
  type DirectiveDetail,
} from '../../api/directives'
import { useAuth } from '../../hooks/useAuth'
import { useBreadcrumbLabel } from '../../hooks/useBreadcrumbs'
import { Button } from '../../components/Button'
import { DetailCard, DetailSidePanel, FactTile, PersonRow, RecordRow } from '../../components/DetailLayout'
import { apiErrorMessages } from '../../lib/apiErrors'
import { daysBetween, formatDate, formatDateTime, formatRelativeTime, initials, localeFor } from '../../lib/formatters'
import { useI18n } from '../../i18n/context'
import { DirectiveDueBadge, DirectiveStaleBadge, DirectiveStatusBadge } from './DirectiveStatusBadge'
import { DirectiveActivity, DirectiveProgressSteps } from './DirectiveTimeline'
import { ReviseTargetDateModal, TransitionNoteModal } from './DirectiveActionModals'
import { DIRECTIVE_TEXT_MAX, formatCalendarDate, truncateText } from './directivePresentation'

/** Headline length before the full description moves into the details card. */
const TITLE_MAX = 160

type NoteModalKind = 'completed' | 'cancelled' | 'closed'

const ACTION_ICONS: Record<DirectiveActionableStatus, typeof CheckIcon> = {
  acknowledged: CheckIcon,
  in_progress: PlayIcon,
  completed: CheckBadgeIcon,
  cancelled: XCircleIcon,
  closed: LockClosedIcon,
}

/** The forward action shown as the primary button, in order of precedence. */
const PRIMARY_ORDER: DirectiveActionableStatus[] = ['closed', 'completed', 'acknowledged', 'in_progress']

function errorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

/** FR-DIR-003, FR-DIR-005 to FR-DIR-011, FR-DIR-013. */
export default function DirectiveDetailPage() {
  const { t, language } = useI18n()
  const copy = t.directives.detail
  const locale = localeFor(language)
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const directiveQuery = useQuery({
    queryKey: ['directive', id],
    queryFn: () => getDirective(id as string),
    enabled: Boolean(id),
    retry: (failureCount, error) => ![403, 404].includes(errorStatus(error) ?? 0) && failureCount < 2,
  })

  useBreadcrumbLabel(directiveQuery.data ? truncateText(directiveQuery.data.description, 48) : null)

  const [noteModal, setNoteModal] = useState<NoteModalKind | null>(null)
  const [isReviseOpen, setReviseOpen] = useState(false)
  const [noteContent, setNoteContent] = useState('')

  function refreshAfterMutation(updated?: DirectiveDetail) {
    if (updated) {
      queryClient.setQueryData(['directive', id], updated)
    }
    queryClient.invalidateQueries({ queryKey: ['directives'] })
    queryClient.invalidateQueries({ queryKey: ['directive', id] })
  }

  const transitionMutation = useMutation({
    mutationFn: ({ status, note }: { status: DirectiveActionableStatus; note?: string }) =>
      transitionDirectiveStatus(id as string, note ? { status, note } : { status }),
    onSuccess: (updated) => {
      refreshAfterMutation(updated)
      setNoteModal(null)
    },
  })

  const noteMutation = useMutation({
    mutationFn: () => addDirectiveNote(id as string, { content: noteContent.trim() }),
    onSuccess: () => {
      setNoteContent('')
      refreshAfterMutation()
    },
  })

  if (directiveQuery.isError) {
    const status = errorStatus(directiveQuery.error)
    if (status === 403 || status === 404) {
      return (
        <DirectiveUnavailable
          icon={status === 403 ? <ShieldExclamationIcon className="size-5" aria-hidden="true" /> : <MagnifyingGlassIcon className="size-5" aria-hidden="true" />}
          title={status === 403 ? copy.forbiddenTitle : copy.notFoundTitle}
          body={status === 403 ? copy.forbiddenBody : copy.notFoundBody}
        />
      )
    }
    return (
      <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-3.5 py-3 text-body-sm text-danger-soft-text">
          <ExclamationCircleIcon className="size-4.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{apiErrorMessages(directiveQuery.error, t.common.genericError).join(' ')}</span>
          <Button variant="secondary" onClick={() => directiveQuery.refetch()}>
            <ArrowPathIcon className="size-4" aria-hidden="true" />
            {copy.retry}
          </Button>
        </div>
      </div>
    )
  }

  if (directiveQuery.isLoading || !directiveQuery.data) {
    return <DirectiveDetailSkeleton label={copy.loading} />
  }

  const directive = directiveQuery.data
  const { transitions, add_note: canAddNote, revise: canRevise } = directive.allowed_actions
  const isTarget = Boolean(user && directive.target_user && user.id === directive.target_user.id)
  const isIssuer = Boolean(user && directive.issued_by && user.id === directive.issued_by.id)
  const hasNoActions = transitions.length === 0 && !canAddNote && !canRevise
  const isFinal = directive.status === 'closed' || directive.status === 'cancelled'

  const primaryAction = PRIMARY_ORDER.find((status) => transitions.includes(status))
  const forwardActions = transitions.filter((status) => status !== 'cancelled')
  const canWithdraw = transitions.includes('cancelled')
  const nextStepText =
    primaryAction === 'closed'
      ? copy.nextStep.close
      : primaryAction === 'completed'
        ? copy.nextStep.complete
        : primaryAction === 'acknowledged'
          ? copy.nextStep.acknowledge
          : primaryAction === 'in_progress'
            ? copy.nextStep.start
            : copy.nextStep.withdraw

  const title = truncateText(directive.description, TITLE_MAX)
  const isTitleTruncated = title !== directive.description.replace(/\s+/g, ' ').trim()

  const accentBorder =
    directive.status === 'cancelled'
      ? 'border-l-text-muted'
      : directive.due_state === 'overdue'
        ? 'border-l-danger'
        : directive.is_stale || directive.due_state === 'approaching'
          ? 'border-l-atrisk'
          : directive.due_state === 'completed'
            ? 'border-l-success'
            : 'border-l-directive'

  const cancelledEntry = [...directive.status_history].reverse().find((entry) => entry.status === 'cancelled')
  const completedEntry = [...directive.status_history].reverse().find((entry) => entry.status === 'completed')
  const endOfClock = isFinal || directive.status === 'completed' ? (completedEntry ?? cancelledEntry)?.at : undefined
  const daysCount = daysBetween(directive.created_at, endOfClock ?? new Date())
  const lastActivityAt = [directive.created_at, ...directive.notes.map((note) => note.created_at), ...directive.status_history.map((entry) => entry.at)]
    .sort()
    .at(-1) as string

  function runTransition(status: DirectiveActionableStatus) {
    if (status === 'completed' || status === 'cancelled' || status === 'closed') {
      transitionMutation.reset()
      setNoteModal(status)
      return
    }
    transitionMutation.mutate({ status })
  }

  const composerLabel = isTarget ? copy.composer.progressLabel : isIssuer ? copy.composer.followUpLabel : copy.composer.noteLabel
  const composerPlaceholder = isTarget
    ? copy.composer.progressPlaceholder
    : isIssuer
      ? copy.composer.followUpPlaceholder
      : copy.composer.notePlaceholder
  const composerVisibility = isTarget ? copy.composer.progressVisibility : isIssuer ? copy.composer.followUpVisibility : copy.composer.noteVisibility

  const composer = canAddNote ? (
    <form
      className="mb-5 overflow-hidden rounded-xl border border-border-muted bg-white focus-within:border-info focus-within:ring-4 focus-within:ring-info-soft"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (noteContent.trim() && !noteMutation.isPending) {
          noteMutation.mutate()
        }
      }}
      data-testid="directive-note-composer"
    >
      <div className="flex items-baseline justify-between gap-2 px-3.5 pt-3">
        <label htmlFor="directive-note-input" className="text-body-sm font-semibold text-text-secondary">
          {composerLabel}
        </label>
        <span className="font-mono text-[0.6875rem] text-text-muted">{copy.characterCount(noteContent.length, DIRECTIVE_TEXT_MAX)}</span>
      </div>
      <textarea
        id="directive-note-input"
        value={noteContent}
        onChange={(event) => setNoteContent(event.target.value)}
        placeholder={composerPlaceholder}
        rows={3}
        maxLength={DIRECTIVE_TEXT_MAX}
        className="block min-h-21 w-full resize-y border-0 bg-transparent px-3.5 py-2 text-body text-text-primary placeholder:text-text-muted focus:outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-page-bg py-2 pl-3.5 pr-2.5">
        <small className="flex min-w-0 flex-1 basis-48 items-center gap-1.5 text-caption text-text-secondary">
          <InformationCircleIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {composerVisibility}
        </small>
        <Button type="submit" disabled={noteMutation.isPending || !noteContent.trim()}>
          {copy.composer.submit}
          <PaperAirplaneIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      {noteMutation.isError && (
        <p role="alert" className="border-t border-border px-3.5 py-2 text-body-sm text-danger-soft-text">
          {apiErrorMessages(noteMutation.error, t.common.genericError).join(' ')}
        </p>
      )}
    </form>
  ) : undefined

  const noteModalCopy = noteModal ? copy.modals[noteModal] : null

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm" aria-labelledby="directive-title">
        <div className={`flex flex-wrap items-start justify-between gap-4 border-l-4 px-4 pb-4 pt-5 sm:px-6 ${accentBorder}`}>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="directive-badges">
              <DirectiveStatusBadge status={directive.status} />
              <DirectiveDueBadge dueState={directive.due_state} daysUntilDue={directive.days_until_due} />
              {directive.is_stale && <DirectiveStaleBadge />}
              {directive.type_category && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-section-bg px-2.5 py-0.5 text-caption font-semibold text-text-secondary">
                  <TagIcon className="size-3.5" aria-hidden="true" />
                  {directive.type_category}
                </span>
              )}
            </div>
            <h1 id="directive-title" className="wrap-break-word text-h2 leading-snug text-primary">
              {title}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-body-sm text-text-secondary">
              {directive.mission && (
                <span className="inline-flex items-center gap-1.5">
                  <BuildingLibraryIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                  {directive.mission.name}
                </span>
              )}
              {directive.target_user && (
                <span className="inline-flex items-center gap-1.5">
                  <UserIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                  {directive.target_user.full_name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDaysIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                <time dateTime={directive.created_at}>{copy.issuedOn(formatDate(directive.created_at, locale))}</time>
              </span>
            </p>
          </div>
          {hasNoActions && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-section-bg px-2.5 py-1.5 text-caption font-semibold text-text-secondary">
              <EyeIcon className="size-4" aria-hidden="true" />
              {copy.viewOnly}
            </span>
          )}
        </div>

        <DirectiveProgressSteps directive={directive} locale={locale} />

        {directive.status === 'cancelled' ? (
          <p className="flex items-center gap-2 border-t border-border bg-danger-soft px-4 py-3 text-body-sm font-semibold text-danger-soft-text sm:px-6">
            <XCircleIcon className="size-4.5 shrink-0" aria-hidden="true" />
            {cancelledEntry
              ? copy.cancelledBanner(formatDate(cancelledEntry.at, locale), cancelledEntry.by?.full_name ?? null)
              : copy.cancelledBannerUndated}
          </p>
        ) : transitions.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6" data-testid="directive-next-step">
            <p className="min-w-0 flex-1 basis-64 text-body-sm text-text-secondary">
              <span className="mr-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-info">{copy.nextStepTitle}</span>
              {nextStepText}
            </p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              {canWithdraw && (
                <button
                  type="button"
                  onClick={() => runTransition('cancelled')}
                  disabled={transitionMutation.isPending}
                  className="order-last inline-flex h-10 items-center justify-center gap-2 rounded px-4 text-button text-danger-soft-text transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50 sm:order-first"
                >
                  <XCircleIcon className="size-4" aria-hidden="true" />
                  {copy.actions.cancelled}
                </button>
              )}
              {forwardActions.map((status) => {
                const Icon = ACTION_ICONS[status]
                const isPrimary = status === primaryAction
                return (
                  <Button
                    key={status}
                    variant={isPrimary ? 'primary' : 'secondary'}
                    disabled={transitionMutation.isPending}
                    onClick={() => runTransition(status)}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {copy.actions[status]}
                    {isPrimary && <ArrowRightIcon className="size-3.5" aria-hidden="true" />}
                  </Button>
                )
              })}
            </div>
          </div>
        ) : null}

        {hasNoActions && (
          <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-caption text-text-secondary sm:px-6" data-testid="directive-read-only">
            <LockClosedIcon className="size-4 shrink-0" aria-hidden="true" />
            {isFinal ? copy.readOnlyFinal : copy.readOnlyBanner}
          </p>
        )}
      </section>

      {transitionMutation.isError && noteModal === null && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-body-sm text-danger-soft-text">
          <ExclamationCircleIcon className="size-4 shrink-0" aria-hidden="true" />
          {apiErrorMessages(transitionMutation.error, t.common.genericError).join(' ')}
        </p>
      )}

      <div className="mt-5 grid gap-5 min-[1200px]:grid-cols-[minmax(0,1fr)_320px] min-[1200px]:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {directive.completion_summary && (
            <section className="rounded-xl border border-success/30 bg-success-soft/50 p-4 shadow-sm sm:px-5" data-testid="directive-completion">
              <h2 className="flex flex-wrap items-center gap-2.5 text-h3 text-primary">
                <span className="grid size-8 place-items-center rounded-lg bg-success text-white">
                  <CheckBadgeIcon className="size-4.5" aria-hidden="true" />
                </span>
                {copy.completionTitle}
                {completedEntry && (
                  <span className="text-caption font-normal text-text-secondary">
                    {copy.completedOn(formatDate(completedEntry.at, locale))}
                  </span>
                )}
              </h2>
              <p className="mt-3 whitespace-pre-line wrap-break-word text-[0.9375rem] leading-relaxed text-text-primary">
                {directive.completion_summary}
              </p>
              {directive.status === 'completed' && (
                <p className="mt-2 flex gap-1.5 text-caption text-text-secondary">
                  <InformationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
                  {copy.completionAwaitingClose}
                </p>
              )}
            </section>
          )}

          <DetailCard icon={<DocumentTextIcon className="size-4" aria-hidden="true" />} title={copy.factsTitle}>
            {isTitleTruncated && (
              <div className="mb-4">
                <h3 className="mb-1.5 text-caption font-semibold uppercase tracking-wider text-text-secondary">{copy.fullInstruction}</h3>
                <p className="whitespace-pre-line wrap-break-word rounded-r-lg border-l-[3px] border-border-muted bg-page-bg px-4 py-3 text-[0.9375rem] leading-relaxed text-text-primary">
                  {directive.description}
                </p>
              </div>
            )}
            <dl className="grid gap-3 sm:grid-cols-2">
              <FactTile
                icon={<BuildingLibraryIcon className="size-4" />}
                label={copy.missionLabel}
                value={directive.mission?.name}
                emptyText={copy.notProvided}
              />
              <FactTile
                icon={<UserIcon className="size-4" />}
                label={copy.targetAttacheLabel}
                value={directive.target_user?.full_name}
                emptyText={copy.notProvided}
              />
              <FactTile
                icon={<UserCircleIcon className="size-4" />}
                label={copy.issuedByLabel}
                value={directive.issued_by?.full_name}
                emptyText={copy.notProvided}
              />
              <FactTile
                icon={<PaperAirplaneIcon className="size-4" />}
                label={copy.issuedOnLabel}
                value={formatDateTime(directive.created_at, locale)}
                emptyText={copy.notProvided}
              />
              <FactTile
                icon={<CalendarDaysIcon className="size-4" />}
                label={copy.targetDateLabel}
                value={
                  <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className={directive.target_completion_date ? '' : 'font-normal italic text-text-muted'}>
                      {directive.target_completion_date ? formatCalendarDate(directive.target_completion_date, locale) : copy.noTargetDate}
                    </span>
                    {canRevise && (
                      <button
                        type="button"
                        onClick={() => setReviseOpen(true)}
                        aria-label={copy.reviseAria}
                        className="inline-flex items-center gap-1 rounded px-1 text-caption font-semibold text-info hover:underline"
                      >
                        <PencilSquareIcon className="size-3.5" aria-hidden="true" />
                        {copy.reviseButton}
                      </button>
                    )}
                  </span>
                }
                emptyText={copy.noTargetDate}
              />
              <FactTile
                icon={<ClockIcon className="size-4" />}
                label={copy.lastProgressLabel}
                value={
                  directive.last_progress_update_at ? (
                    <span>
                      <time dateTime={directive.last_progress_update_at} title={formatDateTime(directive.last_progress_update_at, locale)}>
                        {formatRelativeTime(directive.last_progress_update_at, locale)}
                      </time>
                      <span className="block text-caption font-normal text-text-secondary">
                        {formatDateTime(directive.last_progress_update_at, locale)}
                      </span>
                    </span>
                  ) : null
                }
                emptyText={copy.noProgressYet}
              />
            </dl>
            {directive.is_stale && (
              <p className="mt-3 flex gap-2 rounded-lg bg-atrisk-soft px-3.5 py-2.5 text-caption leading-snug text-atrisk-soft-text">
                <ExclamationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
                {copy.staleNote}
              </p>
            )}
          </DetailCard>

          <DetailCard
            icon={<ClockIcon className="size-4" aria-hidden="true" />}
            title={copy.activityTitle}
            count={directive.notes.length + Math.max(1, directive.status_history.length)}
          >
            <DirectiveActivity directive={directive} locale={locale} composer={composer} />
          </DetailCard>
        </div>

        <aside className="grid min-w-0 gap-4 sm:grid-cols-2 min-[1200px]:sticky min-[1200px]:top-5 min-[1200px]:grid-cols-1">
          <DetailSidePanel title={copy.peopleTitle}>
            <ol className="flex flex-col">
              <PersonRow
                badge={initials(directive.issued_by?.full_name) || '—'}
                role={copy.issuedByLabel}
                name={directive.issued_by?.full_name ?? copy.notProvided}
                note={isIssuer ? copy.youLabel : undefined}
              />
              <PersonRow
                badge={initials(directive.target_user?.full_name) || '—'}
                role={copy.targetAttacheLabel}
                name={directive.target_user?.full_name ?? copy.notProvided}
                note={[directive.mission?.name, isTarget ? copy.youLabel : null].filter(Boolean).join(' · ') || undefined}
                variant="highlight"
                isLast
              />
            </ol>
            <p className="flex gap-2 rounded-lg bg-section-bg px-3 py-2 text-caption leading-snug text-text-secondary">
              <LockClosedIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
              {copy.immutableNote}
            </p>
          </DetailSidePanel>

          <DetailSidePanel title={copy.glanceTitle}>
            <dl className="grid grid-cols-3 gap-2" data-testid="directive-at-a-glance">
              <GlanceTile label={endOfClock ? copy.daysToFinish : copy.daysOpen} value={String(daysCount)} />
              <GlanceTile label={copy.notesCount} value={String(directive.notes.length)} />
              <GlanceTile label={copy.lastActivity} value={formatRelativeTime(lastActivityAt, locale)} isText />
            </dl>
          </DetailSidePanel>

          <DetailSidePanel title={copy.recordTitle} className="sm:col-span-2 min-[1200px]:col-span-1">
            <dl className="flex flex-col gap-2.5 text-body-sm">
              <RecordRow label={copy.issuedOnLabel} value={formatDateTime(directive.created_at, locale)} />
              <RecordRow label={copy.lastUpdated} value={formatDateTime(directive.updated_at, locale)} />
              <RecordRow label={copy.typeCategoryLabel} value={directive.type_category ?? copy.noTypeCategory} />
            </dl>
            <Link to="/directives" className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-info hover:underline">
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              {copy.allDirectives}
            </Link>
          </DetailSidePanel>
        </aside>
      </div>

      {noteModal && noteModalCopy && (
        <TransitionNoteModal
          open
          onClose={() => {
            // The modal shows its own error; don't let it resurface under the header once dismissed.
            transitionMutation.reset()
            setNoteModal(null)
          }}
          title={noteModalCopy.title}
          body={noteModalCopy.body}
          label={noteModalCopy.label}
          placeholder={noteModalCopy.placeholder}
          submitLabel={noteModalCopy.submit}
          cancelLabel={noteModalCopy.cancel}
          isRequired={noteModal !== 'closed'}
          isDestructive={noteModal === 'cancelled'}
          isPending={transitionMutation.isPending}
          errorMessages={transitionMutation.isError ? apiErrorMessages(transitionMutation.error, t.common.genericError) : null}
          onSubmit={(note) => transitionMutation.mutate({ status: noteModal, note: note || undefined })}
        />
      )}

      {canRevise && (
        <ReviseTargetDateModal
          open={isReviseOpen}
          onClose={() => setReviseOpen(false)}
          directive={directive}
          onRevised={(updated) => {
            refreshAfterMutation(updated)
            setReviseOpen(false)
          }}
        />
      )}
    </div>
  )
}

function GlanceTile({ label, value, isText = false }: { label: string; value: string; isText?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-page-bg px-2 py-2.5 text-center">
      <dd className={`truncate font-semibold text-primary ${isText ? 'text-body-sm' : 'font-mono text-[1.25rem] leading-tight'}`}>{value}</dd>
      <dt className="mt-0.5 text-[0.6875rem] leading-tight text-text-secondary">{label}</dt>
    </div>
  )
}

function DirectiveUnavailable({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  const { t } = useI18n()
  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <section
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:p-6"
        data-testid="directive-unavailable"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-section-bg text-primary">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-h3 text-primary">{title}</h1>
          <p className="mt-1 text-body text-text-secondary">{body}</p>
          <Link to="/directives" className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-semibold text-info hover:underline">
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {t.directives.detail.allDirectives}
          </Link>
        </div>
      </section>
    </div>
  )
}

function DirectiveDetailSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7" role="status" aria-live="polite" data-testid="directive-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="h-56 rounded-2xl border border-border bg-white motion-safe:animate-pulse" />
      <div aria-hidden="true" className="mt-5 grid gap-5 min-[1200px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <div className="h-64 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
          <div className="h-80 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-40 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
          <div className="h-28 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  )
}
