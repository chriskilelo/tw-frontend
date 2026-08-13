import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addInquiryNote,
  closeInquiry,
  getInquiry,
  transitionInquiryStatus,
  type InquiryDetail,
  type InquiryStatus,
} from '../../api/inquiries'
import type { ReferralEntry } from '../../api/referrals'
import { useAuth, isReadOnlyRole } from '../../hooks/useAuth'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { InquiryStatusBadge } from './InquiryStatusBadge'
import { InquirySubTypeBadge } from './InquirySubTypeBadge'
import { ReferralRecordModal } from '../../components/ReferralRecordModal'
import en from '../../i18n/en'

/** CLAUDE.md Section 8 Workflow Statuses and Transitions. `resolved -> closed` is
 * deliberately excluded — that transition only happens through the dedicated
 * close action (FR-INQ-012, mandatory resolution summary), not a plain status change. */
const NEXT_STATUSES: Record<InquiryStatus, InquiryStatus[]> = {
  draft: ['received', 'cancelled'],
  received: ['in_progress', 'cancelled'],
  in_progress: ['pending_external_response', 'resolved', 'cancelled'],
  pending_external_response: ['in_progress'],
  resolved: [],
  closed: [],
  cancelled: [],
}

export default function InquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const readOnly = isReadOnlyRole(role?.name)

  const inquiryQuery = useQuery({
    queryKey: ['inquiry', id],
    queryFn: () => getInquiry(id as string),
    enabled: Boolean(id),
  })

  const [noteContent, setNoteContent] = useState('')
  const [isCloseModalOpen, setCloseModalOpen] = useState(false)
  const [isReferralModalOpen, setReferralModalOpen] = useState(false)
  const [recordedReferrals, setRecordedReferrals] = useState<ReferralEntry[]>([])

  const transitionMutation = useMutation({
    mutationFn: (status: InquiryStatus) => transitionInquiryStatus(id as string, { status }),
    onSuccess: (updated) => queryClient.setQueryData(['inquiry', id], updated),
  })

  const noteMutation = useMutation({
    mutationFn: () => addInquiryNote(id as string, { content: noteContent }),
    onSuccess: () => {
      setNoteContent('')
      queryClient.invalidateQueries({ queryKey: ['inquiry', id] })
    },
  })

  if (inquiryQuery.isLoading || !inquiryQuery.data) {
    return (
      <div className="p-6">
        <p className="text-body text-text-muted">{en.common.loading}</p>
      </div>
    )
  }

  const inquiry = inquiryQuery.data

  const isOwningAttache = role?.name === 'Ministry Attache' && user?.mission_id === inquiry.mission?.id
  const canTransition = !readOnly && isOwningAttache
  const canClose = !readOnly && isOwningAttache && inquiry.status === 'resolved'
  const canAddNote = !readOnly && isOwningAttache
  const canRecordReferral = !readOnly && role?.name === 'Ministry Attache'

  return (
    <div className="p-6">
      <Link to="/inquiries" className="text-body-sm font-semibold text-accent-soft-text hover:underline">
        ← {en.inquiries.detail.backToList}
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 text-primary">{inquiry.reference_number}</h1>
        <div className="flex items-center gap-2">
          <InquirySubTypeBadge subType={inquiry.sub_type} />
          <InquiryStatusBadge status={inquiry.status} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InquiryInfoPanel inquiry={inquiry} />

          {(canTransition || canClose) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {canTransition &&
                NEXT_STATUSES[inquiry.status].map((next) => (
                  <Button
                    key={next}
                    variant="secondary"
                    disabled={transitionMutation.isPending}
                    onClick={() => transitionMutation.mutate(next)}
                  >
                    {en.inquiries.detail.moveToPrefix} {en.inquiries.status[next]}
                  </Button>
                ))}
              {canClose && (
                <Button variant="primary" onClick={() => setCloseModalOpen(true)}>
                  {en.inquiries.detail.closeButton}
                </Button>
              )}
            </div>
          )}

          <section className="mt-8">
            <h2 className="text-h3 text-primary">{en.inquiries.detail.timelineTitle}</h2>
            {inquiry.events.length === 0 ? (
              <p className="mt-2 text-body-sm text-text-muted">{en.inquiries.detail.timelineEmpty}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {[...inquiry.events]
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((event) => (
                    <li key={event.id} className="rounded border border-border bg-white p-3 text-body-sm">
                      <p className="font-semibold text-text-primary">{en.inquiries.eventType[event.event_type]}</p>
                      {event.note && <p className="mt-1 text-text-secondary">{event.note}</p>}
                      <p className="mt-1 text-caption text-text-muted">{new Date(event.created_at).toLocaleString()}</p>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-h3 text-primary">{en.inquiries.detail.notesTitle}</h2>
            {inquiry.notes.length === 0 ? (
              <p className="mt-2 text-body-sm text-text-muted">{en.inquiries.detail.notesEmpty}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {inquiry.notes.map((note) => (
                  <li key={note.id} className="rounded border border-border bg-white p-3">
                    <p className="text-body-sm text-text-primary">{note.content}</p>
                    <p className="mt-1 text-caption text-text-muted">{new Date(note.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}

            {canAddNote && (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault()
                  if (noteContent.trim()) {
                    noteMutation.mutate()
                  }
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="sr-only">{en.inquiries.detail.notesPlaceholder}</span>
                  <textarea
                    value={noteContent}
                    onChange={(event) => setNoteContent(event.target.value)}
                    placeholder={en.inquiries.detail.notesPlaceholder}
                    rows={3}
                    className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
                <Button type="submit" disabled={noteMutation.isPending} className="self-start">
                  {en.inquiries.detail.addNoteButton}
                </Button>
              </form>
            )}
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-h3 text-primary">{en.inquiries.detail.referralsTitle}</h2>
              {canRecordReferral && (
                <Button variant="secondary" onClick={() => setReferralModalOpen(true)}>
                  {en.inquiries.detail.recordReferralButton}
                </Button>
              )}
            </div>
            {recordedReferrals.length === 0 ? (
              <p className="mt-2 text-body-sm text-text-muted">{en.inquiries.detail.referralsEmpty}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {recordedReferrals.map((referral) => (
                  <li key={referral.id} className="rounded border border-border bg-white p-3">
                    <p className="text-body-sm font-semibold text-text-primary">
                      {referral.referral_organisation?.name ?? '—'}
                    </p>
                    <p className="mt-1 text-body-sm text-text-secondary">
                      {new Date(referral.referral_date).toLocaleDateString()}
                      {referral.referral_method ? ` · ${referral.referral_method}` : ''}
                    </p>
                    {referral.remarks && <p className="mt-1 text-body-sm text-text-secondary">{referral.remarks}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {canClose && (
        <CloseInquiryModal
          inquiryId={inquiry.id}
          open={isCloseModalOpen}
          onClose={() => setCloseModalOpen(false)}
          onClosed={(updated) => {
            queryClient.setQueryData(['inquiry', id], updated)
            setCloseModalOpen(false)
          }}
        />
      )}

      {canRecordReferral && (
        <ReferralRecordModal
          inquiryId={inquiry.id}
          open={isReferralModalOpen}
          onClose={() => setReferralModalOpen(false)}
          onRecorded={(referral) => {
            setRecordedReferrals((current) => [...current, referral])
            setReferralModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

function InquiryInfoPanel({ inquiry }: { inquiry: InquiryDetail }) {
  const rows: { label: string; value: string | null }[] = [
    { label: en.inquiries.log.categoryLabel, value: inquiry.category },
    { label: en.inquiries.log.inquirerNameLabel, value: inquiry.inquirer_name },
    { label: en.inquiries.log.inquirerOrganisationLabel, value: inquiry.inquirer_organisation },
    { label: en.inquiries.log.inquirerEmailLabel, value: inquiry.inquirer_email },
    { label: en.inquiries.log.inquirerPhoneLabel, value: inquiry.inquirer_phone },
    { label: en.inquiries.log.productOrSectorLabel, value: inquiry.product_or_sector },
    { label: en.inquiries.log.descriptionLabel, value: inquiry.description },
    { label: en.inquiries.log.dateReceivedLabel, value: new Date(inquiry.date_received).toLocaleDateString() },
    { label: en.inquiries.detail.mission, value: inquiry.mission?.name ?? null },
    { label: en.inquiries.detail.loggedBy, value: inquiry.logged_by?.full_name ?? null },
  ]

  return (
    <section>
      <h2 className="text-h3 text-primary">{en.inquiries.detail.infoTitle}</h2>
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
      {inquiry.high_value_flag && (
        <div className="mt-4 rounded border border-border bg-section-bg p-3">
          <p className="text-body-sm font-semibold text-text-primary">{en.inquiries.detail.highValueLabel}</p>
          {inquiry.high_value_justification && (
            <p className="mt-1 text-body-sm text-text-secondary">{inquiry.high_value_justification}</p>
          )}
        </div>
      )}
      {inquiry.resolution_summary && (
        <div className="mt-4">
          <dt className="text-caption text-text-muted">{en.inquiries.detail.resolutionSummaryLabel}</dt>
          <dd className="text-body text-text-primary">{inquiry.resolution_summary}</dd>
        </div>
      )}
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
  const [resolutionSummary, setResolutionSummary] = useState('')

  const mutation = useMutation({
    mutationFn: () => closeInquiry(inquiryId, { resolution_summary: resolutionSummary }),
    onSuccess: onClosed,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (resolutionSummary.trim()) {
      mutation.mutate()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={en.inquiries.detail.closeModalTitle}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">
            {en.inquiries.detail.resolutionSummaryLabel}
          </span>
          <textarea
            required
            value={resolutionSummary}
            onChange={(event) => setResolutionSummary(event.target.value)}
            rows={4}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {en.inquiries.detail.closeSubmitButton}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {en.common.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
