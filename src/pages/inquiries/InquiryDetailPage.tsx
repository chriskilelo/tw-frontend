import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BellIcon,
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChatBubbleBottomCenterTextIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  EyeIcon,
  InformationCircleIcon,
  LinkIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PhoneIcon,
  PlusIcon,
  ShareIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/20/solid'
import {
  addInquiryNote,
  closeInquiry,
  getInquiry,
  getInquiryCategories,
  logInquiryEvent,
  transitionInquiryStatus,
  updateInquiry,
  type InquiryDetail,
  type InquiryEvent,
  type InquiryEventRequest,
  type InquiryStatus,
  type InquirySubType,
  type InquiryUpdateRequest,
} from '../../api/inquiries'
import { getReferralAttachmentDownloadUrl } from '../../api/referrals'
import { useAuth, isReadOnlyRole } from '../../hooks/useAuth'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { ChoiceTile } from '../../components/ChoiceTile'
import {
  AttachmentRow,
  CopyButton,
  DetailCard,
  DetailSidePanel,
  EmptyState,
  FactTile,
  ProgressStep,
  RecordRow,
  RecordUnavailable,
  type ProgressStepState,
} from '../../components/DetailLayout'
import { FORM_INPUT_CLASS, FieldError, FieldLabel } from '../../components/FormLayout'
import { InquiryMatchingPanel } from '../../components/InquiryMatchingPanel'
import { ReferralRecordModal } from '../../components/ReferralRecordModal'
import { useBreadcrumbLabel } from '../../hooks/useBreadcrumbs'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages, retryUnlessClientError } from '../../lib/apiErrors'
import { daysBetween, formatDate, formatDateTime, formatRelativeTime, initials, localeFor } from '../../lib/formatters'
import { InquiryStatusBadge } from './InquiryStatusBadge'
import { InquirySubTypeBadge } from './InquirySubTypeBadge'
import { HighValueToggle, IconInput } from './InquiryFormFields'
import {
  EMAIL_PATTERN,
  SUB_TYPE_ICONS,
  SUB_TYPE_TONES,
  categoryIcon,
  localDateString,
  type HeroIcon,
} from './inquiryPresentation'

type WorkflowStep = 'draft' | 'received' | 'in_progress' | 'resolved' | 'closed'
type ActionKey = 'markReceived' | 'startWork' | 'awaitExternal' | 'markResolved' | 'resumeWork'
type ActivityFilter = 'all' | 'status' | 'events' | 'referrals'
type LoggableEventType = Exclude<InquiryEventRequest['event_type'], 'referral_made'>

const WORKFLOW_STEPS: WorkflowStep[] = ['draft', 'received', 'in_progress', 'resolved', 'closed']
const ALL_STATUSES: InquiryStatus[] = ['draft', 'received', 'in_progress', 'pending_external_response', 'resolved', 'closed', 'cancelled']

/**
 * CLAUDE.md Section 8 Workflow Statuses and Transitions. `resolved -> closed` is not
 * here: it only happens through the dedicated close action, which requires a resolution
 * summary (BR-016, FR-INQ-012). Cancellation is offered separately, behind a confirmation.
 */
const FORWARD_ACTIONS: Record<InquiryStatus, { to: InquiryStatus; label: ActionKey; isPrimary: boolean }[]> = {
  draft: [{ to: 'received', label: 'markReceived', isPrimary: true }],
  received: [{ to: 'in_progress', label: 'startWork', isPrimary: true }],
  in_progress: [
    { to: 'resolved', label: 'markResolved', isPrimary: true },
    { to: 'pending_external_response', label: 'awaitExternal', isPrimary: false },
  ],
  pending_external_response: [{ to: 'in_progress', label: 'resumeWork', isPrimary: true }],
  resolved: [],
  closed: [],
  cancelled: [],
}
const CANCELLABLE_STATUSES: InquiryStatus[] = ['draft', 'received', 'in_progress']

// `referral_made` is left out: recording a referral (FR-REF-002) is the fuller way to log one,
// and every referral already appears on the activity timeline.
const LOGGABLE_EVENTS: LoggableEventType[] = ['hq_notified', 'feedback_received', 'reminder_sent', 'follow_up_completed']

const EVENT_STYLE: Record<InquiryEvent['event_type'], { icon: HeroIcon; tone: string }> = {
  hq_notified: { icon: BuildingLibraryIcon, tone: 'bg-section-bg text-primary' },
  referral_made: { icon: ShareIcon, tone: 'bg-directive-soft text-directive-soft-text' },
  feedback_received: { icon: ChatBubbleBottomCenterTextIcon, tone: 'bg-info-soft text-info' },
  reminder_sent: { icon: BellIcon, tone: 'bg-accent-soft text-accent-soft-text' },
  follow_up_completed: { icon: CheckCircleIcon, tone: 'bg-success-soft text-success-soft-text' },
  status_changed: { icon: ArrowPathIcon, tone: 'bg-info-soft text-info' },
}

// InquiryService::transitionStatus() writes this note on every status_changed event; the
// target status is recovered from it so the timeline and progress bar can be dated.
const STATUS_CHANGE_NOTE = /^Status changed to ([a-z_]+)\.?$/

function statusFromEvent(event: InquiryEvent): InquiryStatus | null {
  if (event.event_type !== 'status_changed' || !event.note) {
    return null
  }
  const match = STATUS_CHANGE_NOTE.exec(event.note.trim())
  const status = match?.[1] as InquiryStatus | undefined
  return status && ALL_STATUSES.includes(status) ? status : null
}

/** The first time the inquiry reached each status. */
function statusReachedAt(inquiry: InquiryDetail): Partial<Record<InquiryStatus, string>> {
  const reached: Partial<Record<InquiryStatus, string>> = { draft: inquiry.created_at }
  const events = [...inquiry.events].sort((first, second) => first.created_at.localeCompare(second.created_at))
  for (const event of events) {
    const status = statusFromEvent(event)
    if (status && !reached[status]) {
      reached[status] = event.created_at
    }
  }
  if (inquiry.closed_at && !reached.closed) {
    reached.closed = inquiry.closed_at
  }
  return reached
}

function workflowIndex(status: InquiryStatus): number {
  return status === 'pending_external_response' ? WORKFLOW_STEPS.indexOf('in_progress') : WORKFLOW_STEPS.indexOf(status as WorkflowStep)
}

interface ActivityItem {
  id: string
  kind: Exclude<ActivityFilter, 'all'>
  at: string
  icon: HeroIcon
  tone: string
  title: ReactNode
  detail?: string | null
  actor?: string | null
}

/**
 * FR-INQ-002 to FR-INQ-014, FR-INQ-019, FR-REF-002/006. Every write control mirrors
 * InquiryPolicy (the owning mission's Ministry Attache); the four BR-020 roles only view
 * (UI-006). Closed and cancelled inquiries are final records, so their controls are hidden.
 */
export default function InquiryDetailPage() {
  const { t, language } = useI18n()
  const copy = t.inquiries.detail
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const readOnly = isReadOnlyRole(role?.name)
  const locale = localeFor(language)

  const inquiryQuery = useQuery({
    queryKey: ['inquiry', id],
    queryFn: () => getInquiry(id as string),
    enabled: Boolean(id),
    retry: retryUnlessClientError,
  })

  useBreadcrumbLabel(inquiryQuery.data?.reference_number, { isCode: true })

  const [isEditing, setIsEditing] = useState(false)
  const [isCloseModalOpen, setCloseModalOpen] = useState(false)
  const [isCancelModalOpen, setCancelModalOpen] = useState(false)
  const [isReferralModalOpen, setReferralModalOpen] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [noteContent, setNoteContent] = useState('')

  const setInquiry = (updated: InquiryDetail) => queryClient.setQueryData(['inquiry', id], updated)

  const transitionMutation = useMutation({
    mutationFn: (status: InquiryStatus) => transitionInquiryStatus(id as string, { status }),
    onSuccess: (updated) => {
      setInquiry(updated)
      setCancelModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
    },
  })

  const noteMutation = useMutation({
    mutationFn: () => addInquiryNote(id as string, { content: noteContent.trim() }),
    onSuccess: () => {
      setNoteContent('')
      queryClient.invalidateQueries({ queryKey: ['inquiry', id] })
    },
  })

  if (inquiryQuery.isError && !inquiryQuery.data) {
    const isMissionOversight = role?.name === 'Head of Mission' || role?.name === 'Deputy Head of Mission'
    return (
      <RecordUnavailable
        status={isAxiosError(inquiryQuery.error) ? inquiryQuery.error.response?.status : undefined}
        copy={copy.unavailable}
        back={isMissionOversight ? { to: '/mission-activity', label: copy.unavailable.backToMissionActivity } : { to: '/inquiries', label: copy.unavailable.backToInquiries }}
        onRetry={() => void inquiryQuery.refetch()}
      />
    )
  }

  if (inquiryQuery.isLoading || !inquiryQuery.data) {
    return (
      <div className="p-6">
        <p className="text-body text-text-muted">{t.common.loading}</p>
      </div>
    )
  }

  const inquiry = inquiryQuery.data
  const referrals = inquiry.referrals ?? []
  const isFinal = inquiry.status === 'closed' || inquiry.status === 'cancelled'
  const isOwningAttache = role?.name === 'Ministry Attache' && user?.mission_id === inquiry.mission?.id
  const canWrite = !readOnly && isOwningAttache && !isFinal
  const canRecordReferral = !readOnly && role?.name === 'Ministry Attache' && !isFinal
  const reachedAt = statusReachedAt(inquiry)
  const forwardActions = FORWARD_ACTIONS[inquiry.status]
  const canCancel = CANCELLABLE_STATUSES.includes(inquiry.status)
  const CategoryIcon = categoryIcon(inquiry.category)

  const accentBorder =
    inquiry.status === 'cancelled'
      ? 'border-l-text-muted'
      : inquiry.sub_type === 'dispute_or_complaint'
        ? 'border-l-danger'
        : inquiry.high_value_flag
          ? 'border-l-accent'
          : 'border-l-info'

  const currentIndex = workflowIndex(inquiry.status)
  const stepState = (step: WorkflowStep, index: number): ProgressStepState => {
    if (inquiry.status === 'cancelled') {
      return reachedAt[step] ? 'done' : 'todo'
    }
    if (index < currentIndex || (index === currentIndex && inquiry.status === 'closed')) {
      return 'done'
    }
    return index === currentIndex ? 'current' : 'todo'
  }
  const currentStepNote: Record<InquiryStatus, string> = {
    draft: copy.stepNotes.draftCurrent,
    received: copy.stepNotes.receivedCurrent,
    in_progress: copy.stepNotes.inProgressCurrent,
    pending_external_response: copy.stepNotes.pendingCurrent,
    resolved: copy.stepNotes.resolvedCurrent,
    closed: copy.stepNotes.done,
    cancelled: copy.stepNotes.notReached,
  }
  const stepNote = (step: WorkflowStep, state: ProgressStepState): string => {
    if (state === 'done') {
      const reached = reachedAt[step]
      return reached ? formatDate(reached, locale) : copy.stepNotes.done
    }
    if (state === 'current') {
      return currentStepNote[inquiry.status]
    }
    return inquiry.status === 'cancelled' ? copy.stepNotes.notReached : copy.stepNotes.notYet
  }

  const loggedItem: ActivityItem = {
    id: 'logged',
    kind: 'status',
    at: inquiry.created_at,
    icon: PencilSquareIcon,
    tone: 'bg-section-bg text-primary',
    title: copy.activityLogged,
    actor: inquiry.logged_by?.full_name,
  }
  const activity: ActivityItem[] = [
    loggedItem,
    ...inquiry.events.map((event): ActivityItem => {
      const movedTo = statusFromEvent(event)
      if (event.event_type === 'status_changed') {
        return {
          id: event.id,
          kind: 'status',
          at: event.created_at,
          icon: movedTo === 'cancelled' ? XCircleIcon : movedTo === 'closed' ? CheckBadgeIcon : ArrowPathIcon,
          tone:
            movedTo === 'cancelled'
              ? 'bg-danger-soft text-danger-soft-text'
              : movedTo === 'closed' || movedTo === 'resolved'
                ? 'bg-success-soft text-success-soft-text'
                : EVENT_STYLE.status_changed.tone,
          title: movedTo ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {copy.activityMovedTo}
              <InquiryStatusBadge status={movedTo} />
            </span>
          ) : (
            t.inquiries.eventType.status_changed
          ),
          detail: movedTo ? null : event.note,
          actor: event.logged_by?.full_name,
        }
      }
      return {
        id: event.id,
        kind: 'events',
        at: event.created_at,
        icon: EVENT_STYLE[event.event_type].icon,
        tone: EVENT_STYLE[event.event_type].tone,
        title: t.inquiries.eventType[event.event_type],
        detail: event.note,
        actor: event.logged_by?.full_name,
      }
    }),
    ...referrals.map(
      (referral): ActivityItem => ({
        id: `referral-${referral.id}`,
        kind: 'referrals',
        at: referral.created_at,
        icon: ShareIcon,
        tone: EVENT_STYLE.referral_made.tone,
        title: copy.activityReferredTo(referral.referral_organisation?.name ?? '—'),
        detail: referral.remarks,
        actor: referral.created_by?.full_name,
      }),
    ),
  ].sort((first, second) => second.at.localeCompare(first.at))

  const activityCounts: Record<ActivityFilter, number> = {
    all: activity.length,
    status: activity.filter((item) => item.kind === 'status').length,
    events: activity.filter((item) => item.kind === 'events').length,
    referrals: activity.filter((item) => item.kind === 'referrals').length,
  }
  const visibleActivity = activityFilter === 'all' ? activity : activity.filter((item) => item.kind === activityFilter)

  const lastActivityAt = [inquiry.created_at, ...inquiry.events.map((e) => e.created_at), ...inquiry.notes.map((n) => n.created_at), ...referrals.map((r) => r.created_at)]
    .sort()
    .at(-1) as string
  const endOfClock = inquiry.status === 'closed' ? (inquiry.closed_at ?? reachedAt.closed) : inquiry.status === 'cancelled' ? reachedAt.cancelled : undefined
  const daysCount = daysBetween(inquiry.date_received, endOfClock ?? new Date())
  const updateCount = inquiry.events.length + inquiry.notes.length + referrals.length

  function startEditing() {
    setIsEditing(true)
    window.requestAnimationFrame(() =>
      document.getElementById('inquiry-edit-form')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }),
    )
  }

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm" aria-labelledby="inquiry-reference-heading">
        <div className={`flex flex-wrap items-start justify-between gap-4 border-l-4 px-4 pb-4 pt-5 sm:px-6 ${accentBorder}`}>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <InquiryStatusBadge status={inquiry.status} />
              <InquirySubTypeBadge subType={inquiry.sub_type} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-section-bg px-2.5 py-0.5 text-caption font-semibold text-text-secondary">
                <CategoryIcon className="size-3.5" aria-hidden="true" />
                {inquiry.category}
              </span>
              {inquiry.high_value_flag && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-caption font-semibold text-accent-soft-text">
                  <StarSolidIcon className="size-3.5" aria-hidden="true" />
                  {copy.highValueTitle}
                </span>
              )}
            </div>

            <div id="inquiry-reference-heading" className="flex items-center gap-2">
              <h1 data-testid="inquiry-reference-number" className="font-mono text-[1.5rem] font-medium leading-tight tracking-tight text-primary">
                {inquiry.reference_number}
              </h1>
              <CopyButton value={inquiry.reference_number} label={copy.copyReference} copiedLabel={copy.referenceCopied} />
            </div>

            <p className="mt-1.5 text-[1.125rem] font-semibold leading-snug text-text-primary">
              {inquiry.inquirer_name}
              {inquiry.inquirer_organisation && <span className="font-normal text-text-secondary"> · {inquiry.inquirer_organisation}</span>}
            </p>

            <p className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-body-sm text-text-secondary">
              {inquiry.product_or_sector && (
                <span className="inline-flex items-center gap-1.5">
                  <CubeIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                  {inquiry.product_or_sector}
                </span>
              )}
              {inquiry.mission && (
                <span className="inline-flex items-center gap-1.5">
                  <BuildingLibraryIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                  {copy.missionName(inquiry.mission.name)}
                </span>
              )}
              {inquiry.logged_by && (
                <span className="inline-flex items-center gap-1.5">
                  <UserIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                  {inquiry.logged_by.full_name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDaysIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                <time dateTime={inquiry.date_received}>{copy.receivedOn(formatDate(inquiry.date_received, locale))}</time>
              </span>
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {canWrite && !isEditing && (
              <Button variant="secondary" onClick={startEditing} className="flex-1 sm:flex-none">
                <PencilSquareIcon className="size-4" aria-hidden="true" />
                {copy.editButton}
              </Button>
            )}
            {readOnly && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-section-bg px-2.5 py-1.5 text-caption font-semibold text-text-secondary">
                <EyeIcon className="size-4" aria-hidden="true" />
                {copy.viewOnly}
              </span>
            )}
          </div>
        </div>

        <ol aria-label={copy.progressLabel} className="grid border-t border-border bg-page-bg md:grid-cols-5">
          {WORKFLOW_STEPS.map((step, index) => {
            const state = stepState(step, index)
            return <ProgressStep key={step} state={state} index={index + 1} title={copy.steps[step]} note={stepNote(step, state)} />
          })}
        </ol>

        {inquiry.status === 'cancelled' ? (
          <p className="flex items-center gap-2 border-t border-border bg-danger-soft px-4 py-3 text-body-sm font-semibold text-danger-soft-text sm:px-6">
            <XCircleIcon className="size-4.5 shrink-0" aria-hidden="true" />
            {copy.cancelledBanner}
          </p>
        ) : canWrite && (forwardActions.length > 0 || inquiry.status === 'resolved') ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6" data-testid="inquiry-next-step">
            <p className="min-w-0 flex-1 basis-64 text-body-sm text-text-secondary">
              <span className="mr-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-info">{copy.nextStepTitle}</span>
              {copy.nextStep[inquiry.status as keyof typeof copy.nextStep]}
            </p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  disabled={transitionMutation.isPending}
                  className="order-last inline-flex h-10 items-center justify-center gap-2 rounded px-4 text-button text-danger-soft-text transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50 sm:order-first"
                >
                  <XCircleIcon className="size-4" aria-hidden="true" />
                  {copy.actions.cancel}
                </button>
              )}
              {forwardActions.map((action) => (
                <Button
                  key={action.to}
                  variant={action.isPrimary ? 'primary' : 'secondary'}
                  disabled={transitionMutation.isPending}
                  onClick={() => transitionMutation.mutate(action.to)}
                >
                  {copy.actions[action.label]}
                  {action.isPrimary && <ArrowRightIcon className="size-3.5" aria-hidden="true" />}
                </Button>
              ))}
              {inquiry.status === 'resolved' && (
                <Button onClick={() => setCloseModalOpen(true)}>
                  <CheckBadgeIcon className="size-4" aria-hidden="true" />
                  {copy.actions.closeInquiry}
                </Button>
              )}
            </div>
          </div>
        ) : !isFinal && !isOwningAttache && inquiry.mission ? (
          <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-caption text-text-secondary sm:px-6">
            <LockClosedIcon className="size-4 shrink-0" aria-hidden="true" />
            {copy.ownerOnlyNote(inquiry.mission.name)}
          </p>
        ) : null}
      </section>

      {transitionMutation.isError && !isCancelModalOpen && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-body-sm text-danger-soft-text">
          <ExclamationCircleIcon className="size-4 shrink-0" aria-hidden="true" />
          {apiErrorMessages(transitionMutation.error, t.common.genericError).join(' ')}
        </p>
      )}

      <div className="mt-5 grid gap-5 min-[1200px]:grid-cols-[minmax(0,1fr)_320px] min-[1200px]:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {inquiry.status === 'closed' && inquiry.resolution_summary && (
            <section className="rounded-xl border border-success/30 bg-success-soft/50 p-4 shadow-sm sm:px-5" data-testid="inquiry-resolution">
              <h2 className="flex items-center gap-2.5 text-h3 text-primary">
                <span className="grid size-8 place-items-center rounded-lg bg-success text-white">
                  <CheckBadgeIcon className="size-4.5" aria-hidden="true" />
                </span>
                {copy.resolutionTitle}
                {inquiry.closed_at && (
                  <span className="text-caption font-normal text-text-secondary">{copy.closedOn(formatDate(inquiry.closed_at, locale))}</span>
                )}
              </h2>
              <p className="mt-3 whitespace-pre-line text-[0.9375rem] leading-relaxed text-text-primary">{inquiry.resolution_summary}</p>
              <p className="mt-2 flex gap-1.5 text-caption text-text-secondary">
                <InformationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
                {copy.resolutionNote}
              </p>
            </section>
          )}

          {isEditing ? (
            <InquiryEditForm
              inquiry={inquiry}
              onCancel={() => setIsEditing(false)}
              onSaved={(updated) => {
                setInquiry(updated)
                setIsEditing(false)
                queryClient.invalidateQueries({ queryKey: ['inquiries'] })
              }}
            />
          ) : (
            <DetailCard icon={<DocumentTextIcon className="size-4" aria-hidden="true" />} title={copy.infoTitle}>
              {inquiry.description ? (
                <p className="mb-4 whitespace-pre-line rounded-r-lg border-l-[3px] border-border-muted bg-page-bg px-4 py-3 text-[0.9375rem] leading-relaxed text-text-primary">
                  {inquiry.description}
                </p>
              ) : (
                <p className="mb-4 text-body-sm italic text-text-muted">{copy.noDescription}</p>
              )}
              <dl className="grid gap-3 sm:grid-cols-2">
                <FactTile icon={<CategoryIcon className="size-4" />} label={t.inquiries.log.categoryLabel} value={inquiry.category} emptyText={copy.notProvided} />
                <FactTile
                  icon={(() => {
                    const SubTypeIcon = SUB_TYPE_ICONS[inquiry.sub_type]
                    return <SubTypeIcon className="size-4" />
                  })()}
                  label={t.inquiries.log.subTypeLabel}
                  value={t.inquiries.subType[inquiry.sub_type]}
                  emptyText={copy.notProvided}
                />
                <FactTile icon={<CubeIcon className="size-4" />} label={t.inquiries.log.productOrSectorLabel} value={inquiry.product_or_sector} emptyText={copy.notProvided} />
                <FactTile
                  icon={<CalendarDaysIcon className="size-4" />}
                  label={t.inquiries.log.dateReceivedLabel}
                  value={formatDate(inquiry.date_received, locale)}
                  emptyText={copy.notProvided}
                />
              </dl>
              {inquiry.high_value_flag && (
                <div className="mt-4 flex gap-3 rounded-lg border border-accent/40 bg-accent-soft/40 px-3.5 py-3" data-testid="inquiry-high-value">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-text">
                    <StarSolidIcon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 text-body-sm">
                    <strong className="block text-text-primary">{copy.highValueTitle}</strong>
                    <span className={inquiry.high_value_justification ? 'text-text-secondary' : 'italic text-text-muted'}>
                      {inquiry.high_value_justification ?? copy.noJustification}
                    </span>
                  </span>
                </div>
              )}
            </DetailCard>
          )}

          <DetailCard icon={<ClockIcon className="size-4" aria-hidden="true" />} title={copy.activityTitle} count={activity.length}>
            {canWrite && <LogEventComposer inquiryId={inquiry.id} onLogged={setInquiry} />}

            <div role="group" aria-label={copy.activityFilterLabel} className="mb-4 flex flex-wrap gap-1.5">
              {(['all', 'status', 'events', 'referrals'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={activityFilter === filter}
                  onClick={() => setActivityFilter(filter)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-semibold transition-colors ${
                    activityFilter === filter
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-white text-text-secondary hover:border-text-muted hover:text-primary'
                  }`}
                >
                  {copy.activityFilters[filter]}
                  <span className={`font-mono text-[0.6875rem] ${activityFilter === filter ? 'text-white/80' : 'text-text-muted'}`}>
                    {activityCounts[filter]}
                  </span>
                </button>
              ))}
            </div>

            {visibleActivity.length === 0 ? (
              <p className="text-body-sm italic text-text-muted">{copy.activityEmpty}</p>
            ) : (
              <ol className="flex flex-col" data-testid="inquiry-activity">
                {visibleActivity.map((item, index) => {
                  const Icon = item.icon
                  const isLast = index === visibleActivity.length - 1
                  return (
                    <li key={item.id} className={`relative grid grid-cols-[32px_1fr] gap-3 ${isLast ? '' : 'pb-4'}`}>
                      {!isLast && <span className="absolute bottom-0.5 left-3.75 top-8.5 w-0.5 bg-border" aria-hidden="true" />}
                      <span className={`grid size-8 place-items-center rounded-full ${item.tone}`} aria-hidden="true">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 pt-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <strong className="text-body-sm text-text-primary">{item.title}</strong>
                          {item.actor && <span className="text-caption text-text-secondary">{copy.activityBy(item.actor)}</span>}
                          <time dateTime={item.at} title={formatDateTime(item.at, locale)} className="text-caption text-text-muted">
                            {formatRelativeTime(item.at, locale)}
                          </time>
                        </p>
                        {item.detail && <p className="mt-0.5 whitespace-pre-line wrap-break-word text-body-sm text-text-secondary">{item.detail}</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </DetailCard>

          <DetailCard icon={<ChatBubbleLeftRightIcon className="size-4" aria-hidden="true" />} title={copy.notesTitle} count={inquiry.notes.length}>
            {inquiry.notes.length === 0 ? (
              <div className="px-3 pb-5 pt-2 text-center text-body-sm text-text-secondary">
                <span className="mx-auto mb-2 grid size-10 place-items-center rounded-xl bg-section-bg text-text-muted">
                  <ChatBubbleLeftRightIcon className="size-4.5" aria-hidden="true" />
                </span>
                <strong className="block text-text-primary">{copy.notesEmptyTitle}</strong>
                {canWrite ? copy.notesEmptyBody : copy.notesEmptyReadOnly}
              </div>
            ) : (
              <ol className="mb-4 flex flex-col gap-3.5">
                {[...inquiry.notes]
                  .sort((first, second) => first.created_at.localeCompare(second.created_at))
                  .map((note) => {
                    const isMine = note.authored_by?.id === user?.id
                    return (
                      <li key={note.id} className="grid grid-cols-[32px_1fr] gap-2.5">
                        <span className="grid size-8 place-items-center rounded-full bg-section-bg text-[0.6875rem] font-bold text-primary" aria-hidden="true">
                          {initials(note.authored_by?.full_name)}
                        </span>
                        <div
                          className={`min-w-0 rounded-[4px_12px_12px_12px] border px-3.5 py-2.5 ${
                            isMine ? 'border-info/25 bg-info-soft' : 'border-border bg-page-bg'
                          }`}
                        >
                          <p className="mb-0.5 flex flex-wrap items-baseline gap-x-2">
                            <strong className="text-body-sm text-text-primary">{note.authored_by?.full_name ?? '—'}</strong>
                            <time dateTime={note.created_at} className="text-caption text-text-secondary">
                              {formatDateTime(note.created_at, locale)}
                            </time>
                          </p>
                          <p className="whitespace-pre-line wrap-break-word text-body text-text-primary">{note.content}</p>
                        </div>
                      </li>
                    )
                  })}
              </ol>
            )}

            {canWrite && (
              <form
                className="overflow-hidden rounded-xl border border-border-muted bg-white focus-within:border-info focus-within:ring-4 focus-within:ring-info-soft"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault()
                  if (noteContent.trim()) {
                    noteMutation.mutate()
                  }
                }}
              >
                <label htmlFor="inquiry-note-input" className="sr-only">
                  {copy.noteLabel}
                </label>
                <textarea
                  id="inquiry-note-input"
                  value={noteContent}
                  onChange={(event) => setNoteContent(event.target.value)}
                  placeholder={copy.notesPlaceholder}
                  rows={3}
                  className="block min-h-21 w-full resize-y border-0 bg-transparent px-3.5 py-3 text-body text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-page-bg py-2 pl-3.5 pr-2.5">
                  <small className="flex items-center gap-1.5 text-caption text-text-secondary">
                    <LockClosedIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    {copy.notesVisibility}
                  </small>
                  <Button type="submit" disabled={noteMutation.isPending || !noteContent.trim()}>
                    {copy.addNoteButton}
                    <PaperAirplaneIcon className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </form>
            )}
            {noteMutation.isError && <p className="mt-2 text-body-sm text-danger-soft-text">{t.common.genericError}</p>}
          </DetailCard>

          <DetailCard
            icon={<ShareIcon className="size-4" aria-hidden="true" />}
            title={copy.referralsTitle}
            count={referrals.length}
            action={
              canRecordReferral && (
                <Button variant="secondary" onClick={() => setReferralModalOpen(true)}>
                  <PlusIcon className="size-4" aria-hidden="true" />
                  {copy.recordReferralButton}
                </Button>
              )
            }
          >
            {referrals.length === 0 ? (
              <EmptyState icon={<ShareIcon className="size-4.5" aria-hidden="true" />} title={copy.referralsEmptyTitle} body={copy.referralsEmptyBody} />
            ) : (
              <ol className="flex flex-col gap-3" data-testid="inquiry-referrals">
                {referrals.map((referral) => (
                  <li key={referral.id} className="rounded-lg border border-border p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-directive-soft text-directive-soft-text" aria-hidden="true">
                        <BuildingOffice2Icon className="size-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <strong className="text-body-sm text-text-primary">{referral.referral_organisation?.name ?? '—'}</strong>
                          <time dateTime={referral.referral_date} className="text-caption text-text-secondary">
                            {formatDate(referral.referral_date, locale)}
                          </time>
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {referral.referral_method && (
                            <span className="rounded-full bg-section-bg px-2 py-0.5 text-caption text-text-secondary">
                              {copy.referralMethod}: <strong className="font-semibold">{referral.referral_method}</strong>
                            </span>
                          )}
                          {referral.contact_person && (
                            <span className="rounded-full bg-section-bg px-2 py-0.5 text-caption text-text-secondary">
                              {copy.referralContact}: <strong className="font-semibold">{referral.contact_person}</strong>
                            </span>
                          )}
                          {referral.reference_number && (
                            <span className="rounded-full bg-section-bg px-2 py-0.5 text-caption text-text-secondary">
                              {copy.referralExternalRef}: <strong className="font-mono font-medium">{referral.reference_number}</strong>
                            </span>
                          )}
                        </div>
                        {referral.remarks && <p className="mt-2 whitespace-pre-line text-body-sm text-text-primary">{referral.remarks}</p>}
                        {referral.attachments.length > 0 && (
                          <ul className="mt-2.5 flex flex-col gap-2">
                            {referral.attachments.map((attachment) => (
                              <AttachmentRow
                                key={attachment.id}
                                fileName={attachment.original_filename}
                                sizeBytes={attachment.file_size_bytes}
                                mimeType={attachment.mime_type}
                                requestDownloadUrl={() => getReferralAttachmentDownloadUrl(referral.id, attachment.id)}
                                downloadLabel={copy.download}
                                downloadAriaLabel={copy.downloadAttachment(attachment.original_filename)}
                                downloadError={copy.downloadError}
                              />
                            ))}
                          </ul>
                        )}
                        {referral.created_by && (
                          <p className="mt-2 text-caption text-text-muted">{copy.referralRecordedBy(referral.created_by.full_name)}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </DetailCard>

          <InquiryMatchingPanel inquiry={inquiry} onLinked={setInquiry} />
        </div>

        <aside className="grid min-w-0 gap-4 sm:grid-cols-2 min-[1200px]:sticky min-[1200px]:top-5 min-[1200px]:grid-cols-1">
          <DetailSidePanel title={copy.inquirerTitle}>
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-body-sm font-bold text-white" aria-hidden="true">
                {initials(inquiry.inquirer_name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-text-primary">{inquiry.inquirer_name}</span>
                {inquiry.inquirer_organisation && (
                  <span className="block truncate text-body-sm text-text-secondary">{inquiry.inquirer_organisation}</span>
                )}
              </span>
            </div>
            {inquiry.inquirer_email || inquiry.inquirer_phone ? (
              <>
                <ul className="flex flex-col gap-2">
                  {inquiry.inquirer_email && (
                    <ContactRow
                      icon={EnvelopeIcon}
                      href={`mailto:${inquiry.inquirer_email}`}
                      value={inquiry.inquirer_email}
                      copyLabel={copy.copyEmail}
                      copiedLabel={copy.copied}
                    />
                  )}
                  {inquiry.inquirer_phone && (
                    <ContactRow
                      icon={PhoneIcon}
                      href={`tel:${inquiry.inquirer_phone.replace(/[^\d+]/g, '')}`}
                      value={inquiry.inquirer_phone}
                      copyLabel={copy.copyPhone}
                      copiedLabel={copy.copied}
                    />
                  )}
                </ul>
                {inquiry.inquirer_email && !isFinal && (
                  <a
                    href={`mailto:${inquiry.inquirer_email}?subject=${encodeURIComponent(copy.emailSubject(inquiry.reference_number))}`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg"
                  >
                    <EnvelopeIcon className="size-4" aria-hidden="true" />
                    {copy.emailInquirer}
                  </a>
                )}
              </>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <p className="text-body-sm italic text-text-muted">{copy.noContact}</p>
                {canWrite && !isEditing && (
                  <button type="button" onClick={startEditing} className="rounded px-1 text-body-sm font-semibold text-info hover:underline">
                    {copy.addContact}
                  </button>
                )}
              </div>
            )}
          </DetailSidePanel>

          <DetailSidePanel title={copy.glanceTitle}>
            <dl className="grid grid-cols-3 gap-2" data-testid="inquiry-at-a-glance">
              <GlanceTile label={inquiry.status === 'closed' ? copy.daysToClose : copy.daysOpen} value={String(daysCount)} />
              <GlanceTile label={copy.updates} value={String(updateCount)} />
              <GlanceTile label={copy.lastActivity} value={formatRelativeTime(lastActivityAt, locale)} isText />
            </dl>
          </DetailSidePanel>

          <DetailSidePanel title={copy.recordTitle} className="sm:col-span-2 min-[1200px]:col-span-1">
            <dl className="flex flex-col gap-2.5 text-body-sm">
              <RecordRow label={copy.referenceLabel} value={<span className="font-mono">{inquiry.reference_number}</span>} />
              {inquiry.mission && <RecordRow label={copy.mission} value={inquiry.mission.name} />}
              {inquiry.logged_by && <RecordRow label={copy.loggedBy} value={inquiry.logged_by.full_name} />}
              <RecordRow label={copy.loggedOn} value={formatDateTime(inquiry.created_at, locale)} />
              <RecordRow label={copy.lastUpdated} value={formatDateTime(inquiry.updated_at, locale)} />
              {inquiry.linked_inquiry && (
                <RecordRow
                  label={copy.linkedToLabel}
                  value={
                    <Link to={`/inquiries/${inquiry.linked_inquiry.id}`} className="inline-flex items-center gap-1 font-mono text-info hover:underline">
                      <LinkIcon className="size-3.5" aria-hidden="true" />
                      {inquiry.linked_inquiry.reference_number}
                    </Link>
                  }
                />
              )}
            </dl>
            {inquiry.linked_inquiry?.mission && (
              <p className="-mt-1.5 text-right text-caption text-text-muted">{copy.missionName(inquiry.linked_inquiry.mission)}</p>
            )}
          </DetailSidePanel>
        </aside>
      </div>

      {canWrite && inquiry.status === 'resolved' && (
        <CloseInquiryModal
          inquiryId={inquiry.id}
          open={isCloseModalOpen}
          onClose={() => setCloseModalOpen(false)}
          onClosed={(updated) => {
            setInquiry(updated)
            setCloseModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['inquiries'] })
          }}
        />
      )}

      {canWrite && canCancel && (
        <Modal open={isCancelModalOpen} onClose={() => setCancelModalOpen(false)} title={copy.cancelModalTitle}>
          <p className="flex gap-2.5 rounded-lg bg-danger-soft px-3.5 py-3 text-body-sm text-danger-soft-text">
            <ExclamationCircleIcon className="mt-px size-4.5 shrink-0" aria-hidden="true" />
            {copy.cancelModalBody}
          </p>
          {transitionMutation.isError && (
            <p role="alert" className="mt-3 text-body-sm text-danger-soft-text">
              {apiErrorMessages(transitionMutation.error, t.common.genericError).join(' ')}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>
              {copy.cancelKeep}
            </Button>
            <Button variant="danger" onClick={() => transitionMutation.mutate('cancelled')} disabled={transitionMutation.isPending}>
              {copy.cancelConfirm}
            </Button>
          </div>
        </Modal>
      )}

      {canRecordReferral && (
        <ReferralRecordModal
          inquiryId={inquiry.id}
          open={isReferralModalOpen}
          onClose={() => setReferralModalOpen(false)}
          onRecorded={() => {
            setReferralModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['inquiry', id] })
          }}
        />
      )}
    </div>
  )
}

interface ContactRowProps {
  icon: HeroIcon
  href: string
  value: string
  copyLabel: string
  copiedLabel: string
}

function ContactRow({ icon: Icon, href, value, copyLabel, copiedLabel }: ContactRowProps) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
      <Icon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
      <a href={href} className="min-w-0 flex-1 truncate text-body-sm font-semibold text-info hover:underline">
        {value}
      </a>
      <CopyButton value={value} label={copyLabel} copiedLabel={copiedLabel} />
    </li>
  )
}

function GlanceTile({ label, value, isText = false }: { label: string; value: string; isText?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-page-bg px-2.5 py-2">
      <dt className="text-[0.6875rem] font-semibold uppercase leading-tight tracking-wider text-text-secondary">{label}</dt>
      <dd className={`mt-1 text-text-primary ${isText ? 'text-body-sm font-semibold leading-tight' : 'font-mono text-[1.375rem] font-medium leading-none'}`}>
        {value}
      </dd>
    </div>
  )
}

function LogEventComposer({ inquiryId, onLogged }: { inquiryId: string; onLogged: (updated: InquiryDetail) => void }) {
  const { t } = useI18n()
  const copy = t.inquiries.detail
  const idPrefix = useId()
  const [eventType, setEventType] = useState<LoggableEventType | ''>('')
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: () => logInquiryEvent(inquiryId, { event_type: eventType as LoggableEventType, note: note.trim() || undefined }),
    onSuccess: (updated) => {
      setEventType('')
      setNote('')
      onLogged(updated)
    },
  })

  return (
    <form
      className="mb-5 rounded-xl border border-border bg-page-bg p-3.5"
      data-testid="inquiry-log-event"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (eventType) {
          mutation.mutate()
        }
      }}
    >
      <fieldset className="min-w-0">
        <legend className="mb-2 text-body-sm font-semibold text-text-primary">
          {copy.logEventTitle} <span className="font-normal text-text-secondary">· {copy.logEventTypeLabel}</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {LOGGABLE_EVENTS.map((value) => {
            const Icon = EVENT_STYLE[value].icon
            const isChecked = eventType === value
            return (
              <label
                key={value}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-body-sm font-semibold transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-info ${
                  isChecked ? 'border-primary bg-white text-primary ring-4 ring-primary/10' : 'border-border-muted bg-white text-text-secondary hover:border-text-muted'
                }`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-event-type`}
                  value={value}
                  checked={isChecked}
                  onChange={() => setEventType(value)}
                  className="sr-only"
                />
                <Icon className="size-4" aria-hidden="true" />
                {t.inquiries.eventType[value]}
              </label>
            )
          })}
        </div>
      </fieldset>

      {eventType && (
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <FieldLabel htmlFor={`${idPrefix}-note`} label={copy.logEventNoteLabel} className="flex-1">
            <input
              id={`${idPrefix}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={copy.logEventNotePlaceholder}
              className={FORM_INPUT_CLASS}
            />
          </FieldLabel>
          <Button type="submit" disabled={mutation.isPending}>
            {copy.logEventButton}
          </Button>
        </div>
      )}
      <p className="mt-2 flex gap-1.5 text-caption text-text-muted">
        <InformationCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        {copy.logEventHint}
      </p>
      {mutation.isError && <p className="mt-2 text-body-sm text-danger-soft-text">{t.common.genericError}</p>}
    </form>
  )
}

function InquiryEditForm({
  inquiry,
  onCancel,
  onSaved,
}: {
  inquiry: InquiryDetail
  onCancel: () => void
  onSaved: (updated: InquiryDetail) => void
}) {
  const { t } = useI18n()
  const copy = t.inquiries.detail
  const logCopy = t.inquiries.log
  const idPrefix = useId()
  const todayString = localDateString(new Date())

  const categoriesQuery = useQuery({
    queryKey: ['inquiry-categories'],
    queryFn: getInquiryCategories,
  })

  const [category, setCategory] = useState(inquiry.category)
  const [subType, setSubType] = useState<InquirySubType>(inquiry.sub_type)
  const [inquirerName, setInquirerName] = useState(inquiry.inquirer_name)
  const [inquirerOrganisation, setInquirerOrganisation] = useState(inquiry.inquirer_organisation ?? '')
  const [inquirerEmail, setInquirerEmail] = useState(inquiry.inquirer_email ?? '')
  const [inquirerPhone, setInquirerPhone] = useState(inquiry.inquirer_phone ?? '')
  const [productOrSector, setProductOrSector] = useState(inquiry.product_or_sector ?? '')
  const [dateReceived, setDateReceived] = useState(inquiry.date_received.slice(0, 10))
  const [description, setDescription] = useState(inquiry.description ?? '')
  const [isHighValue, setIsHighValue] = useState(inquiry.high_value_flag)
  const [highValueJustification, setHighValueJustification] = useState(inquiry.high_value_justification ?? '')

  const trimmedEmail = inquirerEmail.trim()
  const isEmailValid = trimmedEmail === '' || EMAIL_PATTERN.test(trimmedEmail)
  const isDateInFuture = dateReceived > todayString
  const canSave = inquirerName.trim() !== '' && category !== '' && dateReceived !== '' && isEmailValid && !isDateInFuture

  const categoryOptions = (categoriesQuery.data ?? []).map((option) => option.value)
  if (!categoryOptions.includes(inquiry.category)) {
    categoryOptions.unshift(inquiry.category)
  }

  const mutation = useMutation({
    mutationFn: (payload: InquiryUpdateRequest) => updateInquiry(inquiry.id, payload),
    onSuccess: onSaved,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) {
      return
    }
    mutation.mutate({
      category,
      sub_type: subType,
      inquirer_name: inquirerName.trim(),
      inquirer_organisation: inquirerOrganisation.trim() || null,
      inquirer_email: trimmedEmail || null,
      inquirer_phone: inquirerPhone.trim() || null,
      product_or_sector: productOrSector.trim() || null,
      description: description.trim() || null,
      date_received: dateReceived,
      high_value_flag: isHighValue,
      high_value_justification: isHighValue ? highValueJustification.trim() || null : null,
    })
  }

  return (
    <section id="inquiry-edit-form" className="scroll-mt-5 rounded-xl border border-info/30 bg-white shadow-sm ring-4 ring-info-soft/60">
      <div className="flex items-start gap-2.5 px-4 pt-4 sm:px-5">
        <span className="grid size-8 place-items-center rounded-lg bg-info-soft text-info">
          <PencilSquareIcon className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-h3 text-primary">{copy.editTitle}</h2>
          <p className="text-body-sm text-text-muted">{copy.editSubtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid gap-x-5 gap-y-4 p-4 sm:grid-cols-2 sm:p-5" data-testid="inquiry-edit-form">
        <FieldLabel htmlFor={`${idPrefix}-category`} label={logCopy.categoryLabel} isRequired>
          <select
            id={`${idPrefix}-category`}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={FORM_INPUT_CLASS}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel htmlFor={`${idPrefix}-date`} label={logCopy.dateReceivedLabel} isRequired>
          <input
            id={`${idPrefix}-date`}
            type="date"
            max={todayString}
            value={dateReceived}
            onChange={(event) => setDateReceived(event.target.value)}
            aria-invalid={isDateInFuture}
            aria-describedby={isDateInFuture ? `${idPrefix}-date-error` : undefined}
            className={FORM_INPUT_CLASS}
          />
          {isDateInFuture && <FieldError id={`${idPrefix}-date-error`} message={logCopy.dateReceivedFuture} />}
        </FieldLabel>

        <fieldset className="col-span-full min-w-0">
          <legend className="mb-1.5 text-body-sm font-semibold text-text-secondary">{logCopy.subTypeLabel}</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(['standard', 'dispute_or_complaint'] as const).map((value) => {
              const SubTypeIcon = SUB_TYPE_ICONS[value]
              return (
                <ChoiceTile
                  key={value}
                  name={`${idPrefix}-sub-type`}
                  value={value}
                  isChecked={subType === value}
                  onSelect={(next) => setSubType(next as InquirySubType)}
                  tone={SUB_TYPE_TONES[value]}
                  icon={<SubTypeIcon className="size-4" aria-hidden="true" />}
                  title={t.inquiries.subType[value]}
                />
              )
            })}
          </div>
        </fieldset>

        <div className="col-span-full h-px bg-border" aria-hidden="true" />

        <FieldLabel htmlFor={`${idPrefix}-name`} label={logCopy.inquirerNameLabel} isRequired>
          <input
            id={`${idPrefix}-name`}
            value={inquirerName}
            onChange={(event) => setInquirerName(event.target.value)}
            maxLength={255}
            aria-invalid={inquirerName.trim() === ''}
            className={FORM_INPUT_CLASS}
          />
        </FieldLabel>

        <FieldLabel htmlFor={`${idPrefix}-organisation`} label={logCopy.inquirerOrganisationLabel} optionalText={logCopy.optional}>
          <input
            id={`${idPrefix}-organisation`}
            value={inquirerOrganisation}
            onChange={(event) => setInquirerOrganisation(event.target.value)}
            maxLength={255}
            className={FORM_INPUT_CLASS}
          />
        </FieldLabel>

        <FieldLabel htmlFor={`${idPrefix}-email`} label={logCopy.inquirerEmailLabel} optionalText={logCopy.optional}>
          <IconInput icon={EnvelopeIcon}>
            <input
              id={`${idPrefix}-email`}
              type="email"
              inputMode="email"
              value={inquirerEmail}
              onChange={(event) => setInquirerEmail(event.target.value)}
              maxLength={255}
              aria-invalid={!isEmailValid}
              aria-describedby={!isEmailValid ? `${idPrefix}-email-error` : undefined}
              className={`${FORM_INPUT_CLASS} pl-9`}
            />
          </IconInput>
          {!isEmailValid && <FieldError id={`${idPrefix}-email-error`} message={logCopy.emailInvalid} />}
        </FieldLabel>

        <FieldLabel htmlFor={`${idPrefix}-phone`} label={logCopy.inquirerPhoneLabel} optionalText={logCopy.optional}>
          <IconInput icon={PhoneIcon}>
            <input
              id={`${idPrefix}-phone`}
              type="tel"
              inputMode="tel"
              value={inquirerPhone}
              onChange={(event) => setInquirerPhone(event.target.value)}
              maxLength={50}
              className={`${FORM_INPUT_CLASS} pl-9`}
            />
          </IconInput>
        </FieldLabel>

        <FieldLabel htmlFor={`${idPrefix}-product`} label={logCopy.productOrSectorLabel} optionalText={logCopy.optional} className="col-span-full">
          <input
            id={`${idPrefix}-product`}
            value={productOrSector}
            onChange={(event) => setProductOrSector(event.target.value)}
            maxLength={150}
            className={FORM_INPUT_CLASS}
          />
        </FieldLabel>

        <FieldLabel htmlFor={`${idPrefix}-description`} label={logCopy.descriptionLabel} optionalText={logCopy.optional} className="col-span-full">
          <textarea
            id={`${idPrefix}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className={`${FORM_INPUT_CLASS} min-h-24 resize-y`}
          />
        </FieldLabel>

        <div className="col-span-full min-w-0">
          <HighValueToggle
            id={`${idPrefix}-high-value`}
            isChecked={isHighValue}
            onChange={setIsHighValue}
            label={logCopy.highValueLabel}
            description={logCopy.highValueDescription}
            optionalText={logCopy.optional}
          />
          {isHighValue && (
            <FieldLabel htmlFor={`${idPrefix}-justification`} label={logCopy.highValueJustificationLabel} optionalText={logCopy.optional} className="mt-3.5">
              <textarea
                id={`${idPrefix}-justification`}
                value={highValueJustification}
                onChange={(event) => setHighValueJustification(event.target.value)}
                rows={2}
                placeholder={logCopy.highValueJustificationPlaceholder}
                className={`${FORM_INPUT_CLASS} resize-y`}
              />
            </FieldLabel>
          )}
        </div>

        {mutation.isError && (
          <p role="alert" className="col-span-full text-body-sm text-danger-soft-text">
            {apiErrorMessages(mutation.error, t.common.genericError).join(' ')}
          </p>
        )}

        <div className="col-span-full flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={!canSave || mutation.isPending}>
            {copy.saveButton}
          </Button>
        </div>
      </form>
    </section>
  )
}

function CloseInquiryModal({
  inquiryId,
  open,
  onClose,
  onClosed,
}: {
  inquiryId: string
  open: boolean
  onClose: () => void
  onClosed: (updated: InquiryDetail) => void
}) {
  const { t } = useI18n()
  const copy = t.inquiries.detail
  const [resolutionSummary, setResolutionSummary] = useState('')

  const mutation = useMutation({
    mutationFn: () => closeInquiry(inquiryId, { resolution_summary: resolutionSummary.trim() }),
    onSuccess: onClosed,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (resolutionSummary.trim()) {
      mutation.mutate()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={copy.closeModalTitle}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-body-sm text-text-secondary">{copy.closeModalIntro}</p>
        <FieldLabel htmlFor="inquiry-resolution-summary" label={copy.resolutionSummaryLabel} isRequired>
          <textarea
            id="inquiry-resolution-summary"
            required
            value={resolutionSummary}
            onChange={(event) => setResolutionSummary(event.target.value)}
            rows={4}
            placeholder={copy.resolutionPlaceholder}
            className={`${FORM_INPUT_CLASS} resize-y`}
          />
        </FieldLabel>
        <p className="flex gap-1.5 text-caption text-text-muted">
          <InformationCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {copy.resolutionNote}
        </p>
        {mutation.isError && (
          <p role="alert" className="text-body-sm text-danger-soft-text">
            {apiErrorMessages(mutation.error, t.common.genericError).join(' ')}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={mutation.isPending || !resolutionSummary.trim()}>
            <CheckBadgeIcon className="size-4" aria-hidden="true" />
            {copy.closeSubmitButton}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

