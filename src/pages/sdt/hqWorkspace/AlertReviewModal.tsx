import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/20/solid'
import { acknowledgeAlert, getAlert, postAlertFeedback, type AlertDetail } from '../../../api/alerts'
import type { HqWorkspaceAlert } from '../../../api/sdt'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import { FORM_INPUT_CLASS } from '../../../components/FormLayout'
import { AlertStatusBadge } from '../../alerts/AlertStatusBadge'
import { CONFIDENCE_VALUES, urgencyTier } from '../../alerts/alertAssessment'
import { useI18n } from '../../../i18n/context'
import { retryUnlessClientError } from '../../../lib/apiErrors'
import { formatDateTime, formatRelativeTime, initials, localeFor } from '../../../lib/formatters'
import { issueDirectiveLink, rowActionError } from './workspaceState'

const FEEDBACK_MAX = 2000

interface AlertReviewModalProps {
  /** The row the officer opened; its `actions` say what AlertPolicy allows. */
  alert: HqWorkspaceAlert | null
  onClose: () => void
  /** Called after an acknowledgement or a feedback post, to refresh the workspace. */
  onChanged: (message: string) => void
}

/**
 * FR-SDT-013: review an alert and act on it (FR-ALERT-009 acknowledge, FR-ALERT-010 feedback)
 * without leaving the workspace. The detail comes from GET /alerts/{id}, shared with the alert
 * page's cache; the controls follow the row's server-computed actions, and the API checks
 * them again on every request.
 */
export function AlertReviewModal({ alert, onClose, onChanged }: AlertReviewModalProps) {
  const { t } = useI18n()
  return (
    <Modal open={alert !== null} onClose={onClose} title={alert ? t.sdt.hqWorkspace.alertReview.title(alert.reference_number) : undefined} size="3xl">
      {alert && <AlertReviewBody row={alert} onClose={onClose} onChanged={onChanged} />}
    </Modal>
  )
}

function AlertReviewBody({ row, onClose, onChanged }: { row: HqWorkspaceAlert; onClose: () => void; onChanged: (message: string) => void }) {
  const { t, language } = useI18n()
  const copy = t.sdt.hqWorkspace.alertReview
  const locale = localeFor(language)
  const queryClient = useQueryClient()
  const feedbackId = useId()
  const [feedback, setFeedback] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const detailQuery = useQuery({ queryKey: ['alert', row.id], queryFn: () => getAlert(row.id), retry: retryUnlessClientError })
  const alert = detailQuery.data

  const acknowledgeMutation = useMutation({
    mutationFn: () => acknowledgeAlert(row.id),
    onMutate: () => setActionError(null),
    onSuccess: (updated) => {
      queryClient.setQueryData(['alert', row.id], updated)
      onChanged(t.sdt.hqWorkspace.alerts.acknowledgedNotice(row.reference_number))
    },
    onError: (error) => setActionError(rowActionError(error, t)),
  })

  const feedbackMutation = useMutation({
    mutationFn: (content: string) => postAlertFeedback(row.id, { content }),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setFeedback('')
      void queryClient.invalidateQueries({ queryKey: ['alert', row.id] })
      onChanged(copy.feedbackPosted(row.reference_number))
    },
    onError: (error) => setActionError(rowActionError(error, t)),
  })

  if (detailQuery.isError && !alert) {
    const status = isAxiosError(detailQuery.error) ? detailQuery.error.response?.status : undefined
    return (
      <div role="alert" className="space-y-4">
        <p className="text-body text-text-secondary">{status === 403 || status === 404 ? copy.unavailable : copy.loadError}</p>
        <div className="flex justify-end gap-2">
          {status !== 403 && status !== 404 && (
            <Button variant="secondary" onClick={() => void detailQuery.refetch()}>
              {t.sdt.hqWorkspace.retry}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {copy.close}
          </Button>
        </div>
      </div>
    )
  }

  if (!alert) {
    return (
      <div role="status" aria-label={copy.loading} className="space-y-3">
        <div className="h-20 animate-pulse rounded-lg bg-section-bg motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-lg bg-section-bg motion-reduce:animate-none" />
      </div>
    )
  }

  const canAcknowledge = row.actions.acknowledge && alert.status !== 'acknowledged'
  const trimmed = feedback.trim()
  const typeLabel = t.alerts.intelligenceType[alert.intelligence_type] ?? alert.intelligence_type

  function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (trimmed !== '' && trimmed.length <= FEEDBACK_MAX && !feedbackMutation.isPending) {
      feedbackMutation.mutate(trimmed)
    }
  }

  return (
    <div className="space-y-5" data-testid="alert-review">
      <div className="flex flex-wrap items-center gap-2">
        <AlertStatusBadge status={alert.status} />
        <span className="rounded-full bg-section-bg px-2.5 py-1 text-caption font-semibold text-text-secondary">{typeLabel}</span>
        <span className="text-caption text-text-secondary">
          {copy.submittedBy(alert.submitted_by?.full_name ?? copy.unknown, formatRelativeTime(alert.created_at, locale))}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl bg-page-bg p-4 sm:grid-cols-2">
        <Fact label={copy.facts.country} value={alert.country} />
        <Fact label={copy.facts.mission} value={alert.mission?.name} />
        <Fact label={copy.facts.sector} value={alert.sector} />
        <Fact label={copy.facts.productCategory} value={alert.product_category} />
        <Fact label={copy.facts.urgency} value={urgencyText(alert, t)} />
        <Fact label={copy.facts.confidence} value={confidenceText(alert, t)} />
        <Fact label={copy.facts.source} value={alert.intelligence_source} />
        <Fact label={copy.facts.received} value={formatDateTime(alert.created_at, locale)} />
      </dl>

      <section aria-labelledby={`${feedbackId}-description`}>
        <h3 id={`${feedbackId}-description`} className="text-h4 text-primary">
          {copy.description}
        </h3>
        <p className="mt-1 whitespace-pre-line text-body text-text-primary">{alert.product_description || copy.noDescription}</p>
      </section>

      <section aria-labelledby={`${feedbackId}-thread`} className="space-y-3">
        <h3 id={`${feedbackId}-thread`} className="flex items-center gap-2 text-h4 text-primary">
          <ChatBubbleLeftRightIcon aria-hidden="true" className="size-5 text-info" />
          {copy.feedbackTitle}
          <span className="rounded-full bg-section-bg px-2 font-mono text-caption text-text-secondary">{alert.feedback.length}</span>
        </h3>
        {alert.feedback.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-3 text-body-sm text-text-secondary">{copy.feedbackEmpty}</p>
        ) : (
          <ol className="max-h-64 space-y-3 overflow-y-auto pr-1" tabIndex={0} aria-label={copy.feedbackTitle}>
            {alert.feedback.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-info-soft text-caption font-bold text-info-soft-text">
                  {initials(entry.posted_by?.full_name) || '?'}
                </span>
                <div className="min-w-0 flex-1 rounded-lg bg-page-bg px-3 py-2">
                  <p className="flex flex-wrap items-baseline justify-between gap-2 text-caption text-text-secondary">
                    <span className="font-semibold text-text-primary">{entry.posted_by?.full_name ?? copy.unknown}</span>
                    <time dateTime={entry.created_at}>{formatRelativeTime(entry.created_at, locale)}</time>
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-body-sm text-text-primary">{entry.content}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {row.actions.feedback ? (
          <form onSubmit={submitFeedback} className="space-y-2" noValidate>
            <label htmlFor={`${feedbackId}-input`} className="flex items-baseline justify-between gap-2 text-body-sm font-semibold text-text-secondary">
              {copy.feedbackLabel}
              <span className="font-mono text-[0.6875rem] font-normal text-text-muted">
                {feedback.length.toLocaleString(locale)} / {FEEDBACK_MAX.toLocaleString(locale)}
              </span>
            </label>
            <textarea
              id={`${feedbackId}-input`}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              maxLength={FEEDBACK_MAX}
              rows={3}
              placeholder={copy.feedbackPlaceholder}
              className={`${FORM_INPUT_CLASS} resize-y`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-text-secondary">{copy.feedbackHint}</p>
              <Button type="submit" variant="secondary" disabled={trimmed === '' || feedbackMutation.isPending}>
                <ChatBubbleLeftRightIcon aria-hidden="true" className="size-4" />
                {copy.postFeedback}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-caption text-text-secondary">{copy.feedbackReadOnly}</p>
        )}
      </section>

      {actionError && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-body-sm text-danger-soft-text">
          {actionError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link to={`/alerts/${alert.id}`} className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-info-soft-text hover:underline">
            <ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />
            {copy.openFull}
          </Link>
          {alert.mission && (
            <Link
              to={issueDirectiveLink(alert.mission.id, alert.reference_number)}
              className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-info-soft-text hover:underline"
            >
              <ClipboardDocumentCheckIcon aria-hidden="true" className="size-4" />
              {t.sdt.hqWorkspace.alerts.taskMission}
            </Link>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose}>
            {copy.close}
          </Button>
          {canAcknowledge ? (
            <Button onClick={() => acknowledgeMutation.mutate()} disabled={acknowledgeMutation.isPending}>
              <CheckBadgeIcon aria-hidden="true" className="size-4" />
              {t.sdt.hqWorkspace.alerts.acknowledge}
            </Button>
          ) : (
            alert.status === 'acknowledged' && (
              <span className="inline-flex h-10 items-center gap-1.5 text-body-sm font-semibold text-success-soft-text">
                <CheckBadgeIcon aria-hidden="true" className="size-4" />
                {copy.acknowledgedNote}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="min-w-0">
      <dt className="text-caption font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-body-sm text-text-primary">{value || <span className="text-text-muted">{t.sdt.hqWorkspace.alertReview.notProvided}</span>}</dd>
    </div>
  )
}

type Translations = ReturnType<typeof useI18n>['t']

function urgencyText(alert: AlertDetail, t: Translations): string | null {
  if (!alert.urgency) {
    return null
  }
  const tier = urgencyTier(alert.urgency)
  return tier ? t.alerts.submit.urgencyOptions[tier].summary : alert.urgency
}

function confidenceText(alert: AlertDetail, t: Translations): string | null {
  if (!alert.confidence_rating) {
    return null
  }
  const known = (CONFIDENCE_VALUES as readonly string[]).includes(alert.confidence_rating)
  return known ? t.alerts.submit.confidenceOptions[alert.confidence_rating as (typeof CONFIDENCE_VALUES)[number]].summary : alert.confidence_rating
}
