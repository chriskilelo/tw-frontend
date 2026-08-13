import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acknowledgeAlert,
  delegateAlert,
  getAlert,
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
import { AlertStatusBadge } from './AlertStatusBadge'
import en from '../../i18n/en'

/** Mirrors App\Policies\AlertPolicy::DELEGATING_ROLES — the backend also permits Acting PS, not only Ministry PS. */
const DELEGATING_ROLES = ['Ministry PS', 'Acting PS']

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const readOnly = isReadOnlyRole(role?.name)

  const alertQuery = useQuery({
    queryKey: ['alert', id],
    queryFn: () => getAlert(id as string),
    enabled: Boolean(id),
  })

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

  if (alertQuery.isLoading || !alertQuery.data) {
    return (
      <div className="p-6">
        <p className="text-body text-text-muted">{en.common.loading}</p>
      </div>
    )
  }

  const alert = alertQuery.data

  const isSubmittingAttache = role?.name === 'Ministry Attache' && alert.submitted_by?.id === user?.id
  const isAssignedDelegate = alert.assigned_to?.id === user?.id
  const canEdit = !readOnly && isSubmittingAttache
  const canDelegate = !readOnly && DELEGATING_ROLES.includes(role?.name ?? '')
  const canAcknowledge = !readOnly && isAssignedDelegate && alert.status !== 'acknowledged'
  const canPostFeedback = !readOnly

  return (
    <div className="p-6">
      <Link to="/alerts" className="text-body-sm font-semibold text-accent-soft-text hover:underline">
        ← {en.alerts.detail.backToList}
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 data-testid="alert-reference-number" className="text-h1 text-primary">
          {alert.reference_number}
        </h1>
        <AlertStatusBadge status={alert.status} testId="alert-status-badge" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
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
            <AlertInfoPanel alert={alert} />
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {canEdit && !isEditing && (
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                {en.alerts.detail.editButton}
              </Button>
            )}
            {canDelegate && (
              <Button variant="secondary" onClick={() => setDelegateModalOpen(true)}>
                {en.alerts.detail.delegateButton}
              </Button>
            )}
            {canAcknowledge && (
              <Button
                variant="primary"
                onClick={() => acknowledgeMutation.mutate()}
                disabled={acknowledgeMutation.isPending}
              >
                {en.alerts.detail.acknowledgeButton}
              </Button>
            )}
          </div>

          <section className="mt-8">
            <h2 className="text-h3 text-primary">{en.alerts.detail.attachmentsTitle}</h2>
            {alert.attachments.length === 0 ? (
              <p className="mt-2 text-body-sm text-text-muted">{en.alerts.detail.noAttachments}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {alert.attachments.map((attachment) => (
                  <li key={attachment.id} className="text-body-sm text-text-secondary">
                    {attachment.original_filename}{' '}
                    <span className="text-caption text-text-muted">
                      ({Math.round(attachment.file_size_bytes / 1024)} KB)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-h3 text-primary">{en.alerts.detail.feedbackThreadTitle}</h2>
            {alert.feedback.length === 0 ? (
              <p className="mt-2 text-body-sm text-text-muted">{en.alerts.detail.noFeedback}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {alert.feedback.map((entry) => (
                  <li key={entry.id} className="rounded border border-border bg-white p-3">
                    <p className="text-body-sm text-text-primary">{entry.content}</p>
                    <p className="mt-1 text-caption text-text-muted">
                      {entry.posted_by?.full_name ?? '—'} · {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {canPostFeedback && (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault()
                  if (feedbackContent.trim()) {
                    feedbackMutation.mutate()
                  }
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="sr-only">{en.alerts.detail.feedbackPlaceholder}</span>
                  <textarea
                    value={feedbackContent}
                    onChange={(event) => setFeedbackContent(event.target.value)}
                    placeholder={en.alerts.detail.feedbackPlaceholder}
                    rows={3}
                    className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
                <Button type="submit" disabled={feedbackMutation.isPending} className="self-start">
                  {en.alerts.detail.feedbackSubmitButton}
                </Button>
              </form>
            )}
          </section>
        </div>

        <div>
          <h2 className="text-h3 text-primary">{en.alerts.detail.versionHistoryTitle}</h2>
          {alert.versions.length === 0 ? (
            <p className="mt-2 text-body-sm text-text-muted">{en.alerts.detail.noVersions}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {alert.versions.map((version) => (
                <li key={version.id} className="rounded border border-border bg-white p-3 text-body-sm">
                  <p className="text-text-secondary">{new Date(version.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
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

function AlertInfoPanel({ alert }: { alert: AlertDetail }) {
  const rows: { label: string; value: string | null }[] = [
    { label: en.alerts.submit.countryLabel, value: alert.country },
    { label: en.alerts.submit.sectorLabel, value: alert.sector },
    { label: en.alerts.submit.productCategoryLabel, value: alert.product_category },
    { label: en.alerts.submit.productDescriptionLabel, value: alert.product_description },
    { label: en.alerts.submit.intelligenceTypeLabel, value: en.alerts.intelligenceType[alert.intelligence_type] },
    { label: en.alerts.submit.intelligenceSourceLabel, value: alert.intelligence_source },
    { label: en.alerts.submit.urgencyLabel, value: alert.urgency },
    { label: en.alerts.submit.confidenceRatingLabel, value: alert.confidence_rating },
    { label: en.alerts.detail.mission, value: alert.mission?.name ?? null },
    { label: en.alerts.detail.submittedBy, value: alert.submitted_by?.full_name ?? null },
    { label: en.alerts.detail.assignedTo, value: alert.assigned_to?.full_name ?? null },
  ]

  return (
    <section>
      <h2 className="text-h3 text-primary">{en.alerts.detail.infoTitle}</h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows
          .filter((row) => row.value)
          .map((row) => (
            <div key={row.label}>
              <dt className="text-caption text-text-muted">{row.label}</dt>
              <dd className="text-body text-text-primary">{row.value}</dd>
            </div>
          ))}
      </dl>
      {alert.tags && alert.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {alert.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-section-bg px-2.5 py-1 text-caption text-text-secondary">
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label={en.alerts.submit.countryLabel} value={country} onChange={(event) => setCountry(event.target.value)} />
      <Input label={en.alerts.submit.sectorLabel} value={sector} onChange={(event) => setSector(event.target.value)} />
      <Input
        label={en.alerts.submit.productCategoryLabel}
        value={productCategory}
        onChange={(event) => setProductCategory(event.target.value)}
      />
      <label className="flex flex-col gap-1">
        <span className="text-body-sm font-semibold text-text-secondary">
          {en.alerts.submit.productDescriptionLabel}
        </span>
        <textarea
          value={productDescription}
          onChange={(event) => setProductDescription(event.target.value)}
          rows={3}
          className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-body-sm font-semibold text-text-secondary">{en.alerts.submit.intelligenceTypeLabel}</span>
        <select
          value={intelligenceType}
          onChange={(event) => setIntelligenceType(event.target.value as AlertIntelligenceType)}
          className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {(intelligenceTypesQuery.data ?? []).map((option) => (
            <option key={option.id} value={option.value}>
              {en.alerts.intelligenceType[option.value as 'opportunities' | 'trade_barriers'] ?? option.value}
            </option>
          ))}
        </select>
      </label>
      <Input
        label={en.alerts.submit.intelligenceSourceLabel}
        value={intelligenceSource}
        onChange={(event) => setIntelligenceSource(event.target.value)}
      />
      <Input label={en.alerts.submit.urgencyLabel} value={urgency} onChange={(event) => setUrgency(event.target.value)} />
      <Input
        label={en.alerts.submit.confidenceRatingLabel}
        value={confidenceRating}
        onChange={(event) => setConfidenceRating(event.target.value)}
      />

      <div className="flex gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {en.alerts.detail.saveButton}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {en.common.cancel}
        </Button>
      </div>
    </form>
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
    <Modal open={open} onClose={onClose} title={en.alerts.detail.delegateModalTitle}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Input
            label={en.alerts.detail.delegateUserIdsLabel}
            value={userIds}
            onChange={(event) => setUserIds(event.target.value)}
            required
          />
          <p className="text-caption text-text-muted">{en.alerts.detail.delegateUserIdsHint}</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.alerts.detail.delegateNoteLabel}</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {en.alerts.detail.delegateSubmitButton}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {en.common.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
