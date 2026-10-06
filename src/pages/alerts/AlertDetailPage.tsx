import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowTrendingUpIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon as CheckOutlineIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  DocumentIcon,
  DocumentTextIcon,
  EyeIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  NoSymbolIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PencilSquareIcon,
  RssIcon,
  UserIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'
import {
  acknowledgeAlert,
  delegateAlert,
  getAlert,
  getAlertAttachmentDownloadUrl,
  getAlertIntelligenceTypeOptions,
  postAlertFeedback,
  updateAlert,
  type AlertDetail,
  type AlertIntelligenceType,
  type AlertUpdateRequest,
} from '../../api/alerts'
import { useAuth, isReadOnlyRole } from '../../hooks/useAuth'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Modal } from '../../components/Modal'
import {
  AttachmentRow,
  CopyButton,
  DetailCard,
  DetailSidePanel,
  EmptyState,
  FactTile,
  PersonRow,
  ProgressStep,
  RecordRow,
  RecordUnavailable,
} from '../../components/DetailLayout'
import { formatDate as formatLocaleDate, formatDateTime as formatLocaleDateTime, initials, localeFor } from '../../lib/formatters'
import { AlertStatusBadge } from './AlertStatusBadge'
import { ChoiceTile } from '../../components/ChoiceTile'
import { NEUTRAL_TONE } from '../../components/choiceTileTones'
import { SignalStrength } from './SignalStrength'
import {
  CONFIDENCE_VALUES,
  URGENCY_ICONS,
  URGENCY_TONES,
  URGENCY_VALUES,
  confidenceLevel,
  isConfidenceValue,
  isUrgencyValue,
  urgencyTier,
} from './alertAssessment'
import { useBreadcrumbLabel } from '../../hooks/useBreadcrumbs'
import { useI18n } from '../../i18n/context'
import { retryUnlessClientError } from '../../lib/apiErrors'

/** Mirrors App\Policies\AlertPolicy::DELEGATING_ROLES — the backend also permits Acting PS, not only Ministry PS. */
const DELEGATING_ROLES = ['Ministry PS', 'Acting PS']
const FEEDBACK_MAX_LENGTH = 2000

const INTELLIGENCE_TYPE_STYLE: Record<AlertIntelligenceType, { accent: string; badge: string; icon: typeof NoSymbolIcon }> = {
  opportunities: { accent: 'border-l-success', badge: 'bg-success-soft text-success-soft-text', icon: ArrowTrendingUpIcon },
  trade_barriers: { accent: 'border-l-danger', badge: 'bg-danger-soft text-danger-soft-text', icon: NoSymbolIcon },
}

/**
 * FR-ALERT-006 to FR-ALERT-013. Action visibility mirrors AlertPolicy: Edit for the
 * submitting attache, Delegate for Ministry PS / Acting PS, Acknowledge for the assigned
 * delegate, and nothing but viewing for the four BR-020 read-only roles (UI-006).
 */
export default function AlertDetailPage() {
  const { t, language } = useI18n()
  const copy = t.alerts.detail
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const readOnly = isReadOnlyRole(role?.name)

  const alertQuery = useQuery({
    queryKey: ['alert', id],
    queryFn: () => getAlert(id as string),
    enabled: Boolean(id),
    retry: retryUnlessClientError,
  })

  useBreadcrumbLabel(alertQuery.data?.reference_number, { isCode: true })

  const [isEditing, setIsEditing] = useState(false)
  const [isDelegateModalOpen, setDelegateModalOpen] = useState(false)
  const [feedbackContent, setFeedbackContent] = useState('')

  const acknowledgeMutation = useMutation({
    mutationFn: () => acknowledgeAlert(id as string),
    onSuccess: (updated) => queryClient.setQueryData(['alert', id], updated),
  })

  const feedbackMutation = useMutation({
    mutationFn: () => postAlertFeedback(id as string, { content: feedbackContent }),
    onSuccess: () => {
      setFeedbackContent('')
      queryClient.invalidateQueries({ queryKey: ['alert', id] })
    },
  })

  if (alertQuery.isError && !alertQuery.data) {
    const isMissionOversight = role?.name === 'Head of Mission' || role?.name === 'Deputy Head of Mission'
    return (
      <RecordUnavailable
        status={isAxiosError(alertQuery.error) ? alertQuery.error.response?.status : undefined}
        copy={copy.unavailable}
        back={isMissionOversight ? { to: '/mission-activity', label: copy.unavailable.backToMissionActivity } : { to: '/alerts', label: copy.unavailable.backToAlerts }}
        onRetry={() => void alertQuery.refetch()}
      />
    )
  }

  if (alertQuery.isLoading || !alertQuery.data) {
    return (
      <div className="p-6">
        <p className="text-body text-text-muted">{t.common.loading}</p>
      </div>
    )
  }

  const alert = alertQuery.data
  const locale = localeFor(language)
  const formatDateTime = (value: string) => formatLocaleDateTime(value, locale)
  const formatDate = (value: string) => formatLocaleDate(value, locale)

  const isSubmittingAttache = role?.name === 'Ministry Attache' && alert.submitted_by?.id === user?.id
  const isAssignedDelegate = alert.assigned_to?.id === user?.id
  const canEdit = !readOnly && isSubmittingAttache
  const canDelegate = !readOnly && DELEGATING_ROLES.includes(role?.name ?? '')
  const canAcknowledge = !readOnly && isAssignedDelegate && alert.status !== 'acknowledged'
  const canPostFeedback = !readOnly

  const typeStyle = INTELLIGENCE_TYPE_STYLE[alert.intelligence_type]
  const TypeIcon = typeStyle.icon
  const urgencyKey = alert.urgency ? urgencyTier(alert.urgency) : null
  const UrgencyIcon = urgencyKey ? URGENCY_ICONS[urgencyKey] : InformationCircleIcon
  const assigneeName = alert.assigned_to?.full_name ?? ''

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm" aria-labelledby="alert-reference-heading">
        <div className={`flex flex-wrap items-start justify-between gap-4 border-l-4 px-4 pb-4 pt-5 sm:px-6 ${typeStyle.accent}`}>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <AlertStatusBadge status={alert.status} testId="alert-status-badge" />
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold ${typeStyle.badge}`}>
                <TypeIcon className="size-3.5" aria-hidden="true" />
                {t.alerts.intelligenceType[alert.intelligence_type]}
              </span>
              {alert.urgency && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-section-bg px-2.5 py-0.5 text-caption font-semibold text-text-secondary">
                  <UrgencyIcon className="size-3.5" aria-hidden="true" />
                  {t.alerts.submit.urgencyLabel}: {urgencyDisplayName(alert.urgency, t.alerts.submit.urgencyOptions)}
                </span>
              )}
            </div>

            <div id="alert-reference-heading" className="flex items-center gap-2">
              <h1 data-testid="alert-reference-number" className="font-mono text-[1.5rem] font-medium leading-tight tracking-tight text-primary">
                {alert.reference_number}
              </h1>
              <CopyButton value={alert.reference_number} label={copy.copyReference} copiedLabel={copy.referenceCopied} />
            </div>

            <p className="mt-1.5 text-[1.125rem] font-semibold leading-snug text-text-primary">
              {[alert.product_category, alert.country].filter(Boolean).join(' · ')}
            </p>

            <p className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-body-sm text-text-secondary">
              {alert.submitted_by && (
                <span className="inline-flex items-center gap-1.5">
                  <UserIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                  {alert.submitted_by.full_name}
                </span>
              )}
              {alert.mission && (
                <span className="inline-flex items-center gap-1.5">
                  <BuildingLibraryIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                  {copy.missionName(alert.mission.name)}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDaysIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                <time dateTime={alert.created_at}>{formatDateTime(alert.created_at)}</time>
              </span>
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {canAcknowledge && (
              <Button
                onClick={() => acknowledgeMutation.mutate()}
                disabled={acknowledgeMutation.isPending}
                className="flex-1 sm:flex-none"
              >
                <CheckOutlineIcon className="size-4" aria-hidden="true" />
                {copy.acknowledgeButton}
              </Button>
            )}
            {canDelegate && (
              <Button onClick={() => setDelegateModalOpen(true)} className="flex-1 sm:flex-none">
                <UserPlusIcon className="size-4" aria-hidden="true" />
                {copy.delegateButton}
              </Button>
            )}
            {canEdit && !isEditing && (
              <Button variant="secondary" onClick={() => setIsEditing(true)} className="flex-1 sm:flex-none">
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

        <ol aria-label={copy.progressLabel} className="grid border-t border-border bg-page-bg md:grid-cols-3">
          <ProgressStep
            state="done"
            index={1}
            title={copy.steps.submitted}
            note={copy.steps.submittedNote(formatDate(alert.created_at))}
          />
          <ProgressStep
            state={alert.status === 'new' ? 'current' : 'done'}
            index={2}
            title={copy.steps.assigned}
            note={alert.status === 'new' || !assigneeName ? copy.steps.assignedPending : copy.steps.assignedNote(assigneeName)}
          />
          <ProgressStep
            state={alert.status === 'acknowledged' ? 'done' : alert.status === 'assigned' ? 'current' : 'todo'}
            index={3}
            title={copy.steps.acknowledged}
            note={
              alert.status === 'acknowledged'
                ? copy.steps.acknowledgedNote(assigneeName)
                : alert.status === 'assigned' && assigneeName
                  ? copy.steps.acknowledgedPending(assigneeName)
                  : copy.steps.acknowledgedAfterDelegation
            }
          />
        </ol>
      </section>

      {acknowledgeMutation.isError && <p className="mt-3 text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

      <div className="mt-5 grid gap-5 min-[1200px]:grid-cols-[minmax(0,1fr)_320px] min-[1200px]:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {isEditing ? (
            <AlertEditForm
              alert={alert}
              onCancel={() => setIsEditing(false)}
              onSaved={(updated) => {
                queryClient.setQueryData(['alert', id], updated)
                setIsEditing(false)
              }}
            />
          ) : (
            <>
              <DetailCard icon={<DocumentTextIcon className="size-4" aria-hidden="true" />} title={copy.intelligenceTitle}>
                {alert.product_description ? (
                  <p className="mb-4 rounded-r-lg border-l-[3px] border-border-muted bg-page-bg px-4 py-3 text-[0.9375rem] leading-relaxed text-text-primary">
                    {alert.product_description}
                  </p>
                ) : (
                  <p className="mb-4 text-body-sm italic text-text-muted">{copy.noDescription}</p>
                )}
                <dl className="grid gap-3 sm:grid-cols-2">
                  <FactTile icon={<GlobeAltIcon className="size-4" />} label={t.alerts.submit.countryLabel} value={alert.country} emptyText={copy.notProvided} />
                  <FactTile icon={<ChartBarIcon className="size-4" />} label={t.alerts.submit.sectorLabel} value={alert.sector} emptyText={copy.notProvided} />
                  <FactTile icon={<CubeIcon className="size-4" />} label={t.alerts.submit.productCategoryLabel} value={alert.product_category} emptyText={copy.notProvided} />
                  <FactTile icon={<RssIcon className="size-4" />} label={t.alerts.submit.intelligenceSourceLabel} value={alert.intelligence_source} emptyText={copy.notProvided} />
                </dl>
                {alert.tags && alert.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="mr-0.5 text-caption text-text-secondary">{copy.tagsLabel}</span>
                    {alert.tags.map((tag) => (
                      <Link
                        key={tag}
                        to={`/search?q=${encodeURIComponent(tag)}`}
                        aria-label={copy.searchTag(tag)}
                        className="rounded-full bg-info-soft px-2.5 py-0.5 text-caption font-semibold text-info hover:underline"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                )}
              </DetailCard>

              <DetailCard icon={<ClipboardDocumentCheckIcon className="size-4" aria-hidden="true" />} title={copy.assessmentTitle}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AssessmentGauge
                    label={t.alerts.submit.urgencyLabel}
                    value={alert.urgency ? urgencyDisplayName(alert.urgency, t.alerts.submit.urgencyOptions) : copy.notRated}
                    isRated={Boolean(alert.urgency)}
                    icon={<UrgencyIcon className="size-4" aria-hidden="true" />}
                    iconClassName={urgencyKey ? URGENCY_TONES[urgencyKey].icon : 'bg-section-bg text-text-secondary'}
                    note={urgencyKey && alert.urgency ? t.alerts.submit.urgencyOptions[urgencyKey].timeframe : undefined}
                  />
                  <AssessmentGauge
                    label={t.alerts.submit.confidenceRatingLabel}
                    value={
                      alert.confidence_rating
                        ? confidenceDisplayName(alert.confidence_rating, t.alerts.submit.confidenceOptions)
                        : copy.notRated
                    }
                    isRated={Boolean(alert.confidence_rating)}
                    icon={<SignalStrength level={alert.confidence_rating ? (confidenceLevel(alert.confidence_rating) ?? 0) : 0} />}
                    iconClassName="bg-section-bg"
                    note={alert.confidence_rating ? copy.confidenceNote : undefined}
                  />
                </div>
              </DetailCard>
            </>
          )}

          <DetailCard
            icon={<PaperClipIcon className="size-4" aria-hidden="true" />}
            title={t.alerts.submit.attachmentsLabel}
            count={alert.attachments.length}
          >
            {alert.attachments.length === 0 ? (
              <EmptyState icon={<DocumentIcon className="size-4.5" aria-hidden="true" />} title={copy.noAttachmentsTitle} body={copy.noAttachmentsBody} />
            ) : (
              <ul className="flex flex-col gap-2">
                {alert.attachments.map((attachment) => (
                  <AttachmentRow
                    key={attachment.id}
                    fileName={attachment.original_filename}
                    sizeBytes={attachment.file_size_bytes}
                    mimeType={attachment.mime_type}
                    requestDownloadUrl={() => getAlertAttachmentDownloadUrl(alert.id, attachment.id)}
                    downloadLabel={copy.download}
                    downloadAriaLabel={copy.downloadAttachment(attachment.original_filename)}
                    downloadError={copy.downloadError}
                  />
                ))}
              </ul>
            )}
          </DetailCard>

          <DetailCard
            icon={<ChatBubbleLeftRightIcon className="size-4" aria-hidden="true" />}
            title={copy.feedbackThreadTitle}
            count={alert.feedback.length}
          >
            {alert.feedback.length === 0 ? (
              <div className="px-3 pb-5 pt-2 text-center text-body-sm text-text-secondary">
                <span className="mx-auto mb-2 grid size-10 place-items-center rounded-xl bg-section-bg text-text-muted">
                  <ChatBubbleLeftRightIcon className="size-4.5" aria-hidden="true" />
                </span>
                <strong className="block text-text-primary">{copy.noFeedbackTitle}</strong>
                {canPostFeedback ? copy.noFeedbackBody : copy.noFeedbackReadOnly}
              </div>
            ) : (
              <ol className="mb-4 flex flex-col gap-3.5">
                {alert.feedback.map((entry) => {
                  const isMine = entry.posted_by?.id === user?.id
                  return (
                    <li key={entry.id} className="grid grid-cols-[32px_1fr] gap-2.5">
                      <span className="grid size-8 place-items-center rounded-full bg-section-bg text-[0.6875rem] font-bold text-primary" aria-hidden="true">
                        {initials(entry.posted_by?.full_name)}
                      </span>
                      <div
                        className={`min-w-0 rounded-[4px_12px_12px_12px] border px-3.5 py-2.5 ${
                          isMine ? 'border-info/25 bg-info-soft' : 'border-border bg-page-bg'
                        }`}
                      >
                        <p className="mb-0.5 flex flex-wrap items-baseline gap-x-2">
                          <strong className="text-body-sm text-text-primary">{entry.posted_by?.full_name ?? '—'}</strong>
                          <time dateTime={entry.created_at} className="text-caption text-text-secondary">
                            {formatDateTime(entry.created_at)}
                          </time>
                        </p>
                        <p className="whitespace-pre-line wrap-break-word text-body text-text-primary">{entry.content}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {canPostFeedback && (
              <form
                className="overflow-hidden rounded-xl border border-border-muted bg-white focus-within:border-info focus-within:ring-4 focus-within:ring-info-soft"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault()
                  if (feedbackContent.trim()) {
                    feedbackMutation.mutate()
                  }
                }}
              >
                <label htmlFor="alert-feedback-input" className="sr-only">
                  {copy.feedbackLabel}
                </label>
                <textarea
                  id="alert-feedback-input"
                  value={feedbackContent}
                  onChange={(event) => setFeedbackContent(event.target.value)}
                  placeholder={copy.feedbackPlaceholder}
                  maxLength={FEEDBACK_MAX_LENGTH}
                  rows={3}
                  className="block min-h-21 w-full resize-y border-0 bg-transparent px-3.5 py-3 text-body text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-page-bg py-2 pl-3.5 pr-2.5">
                  <small className="text-caption text-text-secondary">{copy.feedbackVisibility}</small>
                  <Button type="submit" disabled={feedbackMutation.isPending || !feedbackContent.trim()}>
                    {copy.feedbackSubmitButton}
                    <PaperAirplaneIcon className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </form>
            )}
            {feedbackMutation.isError && <p className="mt-2 text-body-sm text-danger-soft-text">{t.common.genericError}</p>}
          </DetailCard>
        </div>

        <aside className="grid min-w-0 gap-4 sm:grid-cols-2 min-[1200px]:sticky min-[1200px]:top-5 min-[1200px]:grid-cols-1">
          <DetailSidePanel title={copy.peopleTitle}>
            <ol className="flex flex-col">
              <PersonRow
                badge={initials(alert.submitted_by?.full_name)}
                role={copy.submittedBy}
                name={alert.submitted_by?.full_name ?? '—'}
                note={alert.mission ? copy.missionName(alert.mission.name) : undefined}
              />
              <PersonRow badge="PS" role={copy.routedTo} name={copy.principalSecretary} note={copy.routedAutomatically} />
              <PersonRow
                badge={alert.assigned_to ? initials(alert.assigned_to.full_name) : '?'}
                role={copy.assignedTo}
                name={alert.assigned_to?.full_name ?? copy.notYetAssigned}
                note={alert.assigned_to ? (alert.status === 'acknowledged' ? copy.acknowledgedState : copy.notYetAcknowledged) : undefined}
                variant={alert.assigned_to ? 'highlight' : 'pending'}
                isLast
              />
            </ol>
          </DetailSidePanel>

          <DetailSidePanel title={copy.recordTitle}>
            <dl className="flex flex-col gap-2.5 text-body-sm">
              <RecordRow label={copy.referenceLabel} value={<span className="font-mono">{alert.reference_number}</span>} />
              <RecordRow label={copy.submittedAt} value={formatDateTime(alert.created_at)} />
              <RecordRow label={copy.lastUpdated} value={formatDateTime(alert.updated_at)} />
              {alert.mission && <RecordRow label={copy.mission} value={alert.mission.name} />}
            </dl>
          </DetailSidePanel>

          <DetailSidePanel title={copy.versionHistoryTitle} count={alert.versions.length} className="sm:col-span-2 min-[1200px]:col-span-1">
            {alert.versions.length === 0 ? (
              <p className="flex items-start gap-2 text-body-sm text-text-secondary">
                <CheckOutlineIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {copy.versionsNone}
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {[...alert.versions]
                  .sort((first, second) => first.created_at.localeCompare(second.created_at))
                  .map((version, index) => ({ version, number: index + 1 }))
                  .reverse()
                  .map(({ version, number }) => (
                    <li key={version.id} className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-section-bg font-mono text-[0.6875rem] text-primary">
                        {number}
                      </span>
                      <span className="min-w-0 text-body-sm">
                        <span className="block font-semibold text-text-primary">{copy.versionEntry(number)}</span>
                        <span className="block text-caption text-text-secondary">
                          {copy.versionSavedBeforeEdit} · {formatDateTime(version.created_at)}
                        </span>
                      </span>
                    </li>
                  ))}
              </ol>
            )}
            <p className="flex gap-2 rounded-lg bg-atrisk-soft px-3 py-2 text-caption leading-snug text-atrisk-soft-text">
              <InformationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
              {copy.versionsNote}
            </p>
          </DetailSidePanel>
        </aside>
      </div>

      {canDelegate && (
        <DelegateModal
          alertId={alert.id}
          open={isDelegateModalOpen}
          onClose={() => setDelegateModalOpen(false)}
          onDelegated={(updated) => {
            queryClient.setQueryData(['alert', id], updated)
            setDelegateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

type UrgencyOptionsCopy = Record<(typeof URGENCY_VALUES)[number], { name: string }>
type ConfidenceOptionsCopy = Record<(typeof CONFIDENCE_VALUES)[number], { name: string }>

/** Localised name for the tile values; any other (legacy/free-text) stored value is shown verbatim. */
function urgencyDisplayName(value: string, options: UrgencyOptionsCopy): string {
  return isUrgencyValue(value) ? options[value].name : value
}

function confidenceDisplayName(value: string, options: ConfidenceOptionsCopy): string {
  return isConfidenceValue(value) ? options[value].name : value
}

function AssessmentGauge({
  label,
  value,
  isRated,
  icon,
  iconClassName,
  note,
}: {
  label: string
  value: string
  isRated: boolean
  icon: ReactNode
  iconClassName: string
  note?: string
}) {
  return (
    <div className="rounded-lg border border-border p-3.5">
      <p className="text-caption font-medium text-text-secondary">{label}</p>
      <p className={`mt-1.5 flex items-center gap-2 ${isRated ? 'text-[1rem] font-bold text-text-primary' : 'text-body italic text-text-muted'}`}>
        <span className={`grid size-7 place-items-center rounded-lg ${iconClassName}`}>{icon}</span>
        {value}
      </p>
      {note && <p className="mt-0.5 text-caption text-text-secondary">{note}</p>}
    </div>
  )
}

function AlertEditForm({
  alert,
  onCancel,
  onSaved,
}: {
  alert: AlertDetail
  onCancel: () => void
  onSaved: (updated: AlertDetail) => void
}) {
  const { t } = useI18n()
  const submitCopy = t.alerts.submit
  const intelligenceTypesQuery = useQuery({
    queryKey: ['master-data', 'alert_intelligence_type'],
    queryFn: getAlertIntelligenceTypeOptions,
  })

  const [country, setCountry] = useState(alert.country)
  const [sector, setSector] = useState(alert.sector ?? '')
  const [productCategory, setProductCategory] = useState(alert.product_category ?? '')
  const [productDescription, setProductDescription] = useState(alert.product_description ?? '')
  const [intelligenceType, setIntelligenceType] = useState(alert.intelligence_type)
  const [intelligenceSource, setIntelligenceSource] = useState(alert.intelligence_source ?? '')
  const [urgency, setUrgency] = useState(alert.urgency ?? '')
  const [confidenceRating, setConfidenceRating] = useState(alert.confidence_rating ?? '')

  const mutation = useMutation({
    mutationFn: (payload: AlertUpdateRequest) => updateAlert(alert.id, payload),
    onSuccess: onSaved,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({
      country,
      sector: sector || undefined,
      product_category: productCategory || undefined,
      product_description: productDescription || undefined,
      intelligence_type: intelligenceType,
      intelligence_source: intelligenceSource || undefined,
      urgency: urgency || undefined,
      confidence_rating: confidenceRating || undefined,
    })
  }

  const textareaClassName =
    'rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <section className="rounded-xl border border-border bg-white shadow-sm">
      <div className="flex items-start gap-2.5 px-4 pt-4 sm:px-5">
        <span className="grid size-8 place-items-center rounded-lg bg-section-bg text-primary">
          <PencilSquareIcon className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-h3 text-primary">{t.alerts.detail.editTitle}</h2>
          <p className="text-body-sm text-text-muted">{t.alerts.detail.editSubtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 sm:p-5">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-body-sm font-semibold text-text-secondary">{submitCopy.intelligenceTypeLabel}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(intelligenceTypesQuery.data ?? []).map((option) => {
              const optionValue = option.value as AlertIntelligenceType
              const OptionIcon = INTELLIGENCE_TYPE_STYLE[optionValue]?.icon ?? ArrowTrendingUpIcon
              return (
                <ChoiceTile
                  key={option.id}
                  name="edit_intelligence_type"
                  value={option.value}
                  isChecked={intelligenceType === option.value}
                  onSelect={(next) => setIntelligenceType(next as AlertIntelligenceType)}
                  tone={NEUTRAL_TONE}
                  icon={<OptionIcon className="size-4" aria-hidden="true" />}
                  title={t.alerts.intelligenceType[optionValue] ?? option.value}
                />
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={submitCopy.countryLabel} value={country} onChange={(event) => setCountry(event.target.value)} />
          <Input label={submitCopy.sectorLabel} value={sector} onChange={(event) => setSector(event.target.value)} />
        </div>
        <Input
          label={submitCopy.productCategoryLabel}
          value={productCategory}
          onChange={(event) => setProductCategory(event.target.value)}
        />
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{submitCopy.productDescriptionLabel}</span>
          <textarea
            value={productDescription}
            onChange={(event) => setProductDescription(event.target.value)}
            rows={4}
            className={textareaClassName}
          />
        </label>
        <Input
          label={submitCopy.intelligenceSourceLabel}
          value={intelligenceSource}
          onChange={(event) => setIntelligenceSource(event.target.value)}
        />

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-body-sm font-semibold text-text-secondary">{submitCopy.urgencyLabel}</legend>
          <div className="grid gap-2.5 md:grid-cols-3">
            {URGENCY_VALUES.map((value) => {
              const UrgencyIcon = URGENCY_ICONS[value]
              return (
                <ChoiceTile
                  key={value}
                  name="edit_urgency"
                  value={value}
                  isChecked={urgency === value}
                  onSelect={setUrgency}
                  tone={URGENCY_TONES[value]}
                  icon={<UrgencyIcon className="size-4" aria-hidden="true" />}
                  title={submitCopy.urgencyOptions[value].name}
                  description={submitCopy.urgencyOptions[value].description}
                />
              )
            })}
          </div>
          {urgency && !isUrgencyValue(urgency) && (
            <p className="mt-1.5 text-caption text-text-secondary">{`${submitCopy.urgencyLabel}: ${urgency}`}</p>
          )}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-body-sm font-semibold text-text-secondary">{submitCopy.confidenceRatingLabel}</legend>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {CONFIDENCE_VALUES.map((value, index) => (
              <ChoiceTile
                key={value}
                name="edit_confidence_rating"
                value={value}
                isChecked={confidenceRating === value}
                onSelect={setConfidenceRating}
                tone={NEUTRAL_TONE}
                icon={<SignalStrength level={index + 1} />}
                title={submitCopy.confidenceOptions[value].name}
              />
            ))}
          </div>
          {confidenceRating && !isConfidenceValue(confidenceRating) && (
            <p className="mt-1.5 text-caption text-text-secondary">{`${submitCopy.confidenceRatingLabel}: ${confidenceRating}`}</p>
          )}
        </fieldset>

        {mutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {t.alerts.detail.saveButton}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        </div>
      </form>
    </section>
  )
}

function DelegateModal({
  alertId,
  open,
  onClose,
  onDelegated,
}: {
  alertId: string
  open: boolean
  onClose: () => void
  onDelegated: (updated: AlertDetail) => void
}) {
  const { t } = useI18n()
  const [userIds, setUserIds] = useState('')
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      delegateAlert(alertId, {
        delegate_user_ids: userIds
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        note: note || undefined,
      }),
    onSuccess: onDelegated,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={t.alerts.detail.delegateModalTitle}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Input
            label={t.alerts.detail.delegateUserIdsLabel}
            value={userIds}
            onChange={(event) => setUserIds(event.target.value)}
            required
          />
          <p className="text-caption text-text-muted">{t.alerts.detail.delegateUserIdsHint}</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{t.alerts.detail.delegateNoteLabel}</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        {mutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}
        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {t.alerts.detail.delegateSubmitButton}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
