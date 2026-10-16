import { useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentCheckIcon,
  InformationCircleIcon,
  MegaphoneIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid'
import { getInquiry, type InquiryDetail } from '../../../api/inquiries'
import type { HqWorkspaceInquiry } from '../../../api/sdt'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import { InquiryStatusBadge } from '../../inquiries/InquiryStatusBadge'
import { InquirySubTypeBadge } from '../../inquiries/InquirySubTypeBadge'
import { useI18n } from '../../../i18n/context'
import { retryUnlessClientError } from '../../../lib/apiErrors'
import { formatDate, formatRelativeTime, localeFor } from '../../../lib/formatters'
import { issueDirectiveLink } from './workspaceState'

const TIMELINE_LIMIT = 6

/**
 * FR-SDT-013, FR-INQ-009, FR-INQ-018: review an inquiry an attache notified HQ of, read-only.
 * The inquiry's workflow belongs to the attache at its mission; HQ follows it, and links it to
 * a related inquiry from the full record (FR-INQ-019).
 */
export function InquiryReviewModal({ inquiry, onClose }: { inquiry: HqWorkspaceInquiry | null; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Modal open={inquiry !== null} onClose={onClose} title={inquiry ? t.sdt.hqWorkspace.inquiryReview.title(inquiry.reference_number) : undefined} size="3xl">
      {inquiry && <InquiryReviewBody row={inquiry} onClose={onClose} />}
    </Modal>
  )
}

interface TimelineEntry {
  id: string
  at: string
  title: string
  body: string | null
  by: string | null
}

function InquiryReviewBody({ row, onClose }: { row: HqWorkspaceInquiry; onClose: () => void }) {
  const { t, language } = useI18n()
  const copy = t.sdt.hqWorkspace.inquiryReview
  const locale = localeFor(language)
  const headingId = useId()

  const detailQuery = useQuery({ queryKey: ['inquiry', row.id], queryFn: () => getInquiry(row.id), retry: retryUnlessClientError })
  const inquiry = detailQuery.data

  if (detailQuery.isError && !inquiry) {
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

  if (!inquiry) {
    return (
      <div role="status" aria-label={copy.loading} className="space-y-3">
        <div className="h-20 animate-pulse rounded-lg bg-section-bg motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-lg bg-section-bg motion-reduce:animate-none" />
      </div>
    )
  }

  const timeline = buildTimeline(inquiry, t)
  const missionName = inquiry.mission?.name ?? copy.unknown

  return (
    <div className="space-y-5" data-testid="inquiry-review">
      <div className="flex flex-wrap items-center gap-2">
        <InquiryStatusBadge status={inquiry.status} />
        <InquirySubTypeBadge subType={inquiry.sub_type} />
        {inquiry.high_value_flag && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-caption font-semibold text-accent-soft-text">
            <SparklesIcon aria-hidden="true" className="size-3.5" />
            {t.sdt.hqWorkspace.inquiries.highValue}
          </span>
        )}
      </div>

      <p className="flex gap-2 rounded-lg bg-info-soft px-3.5 py-2.5 text-body-sm text-info-soft-text">
        <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {copy.attacheOwns(missionName)}
      </p>

      {row.hq_notified && (
        <div className="flex gap-3 rounded-xl border border-accent/30 bg-accent-soft/30 px-4 py-3">
          <MegaphoneIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-soft-text" />
          <div className="min-w-0">
            <p className="text-body-sm font-semibold text-text-primary">
              {row.hq_notified.by
                ? t.sdt.hqWorkspace.inquiries.notified(row.hq_notified.by.full_name, formatRelativeTime(row.hq_notified.at, locale))
                : t.sdt.hqWorkspace.inquiries.notifiedUnknown(formatRelativeTime(row.hq_notified.at, locale))}
            </p>
            {row.hq_notified.note && <p className="mt-0.5 whitespace-pre-line text-body-sm text-text-secondary">“{row.hq_notified.note}”</p>}
          </div>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl bg-page-bg p-4 sm:grid-cols-2">
        <Fact label={copy.category} value={inquiry.category} />
        <Fact label={copy.product} value={inquiry.product_or_sector} />
        <Fact label={copy.inquirer} value={inquiry.inquirer_name} />
        <Fact label={copy.organisation} value={inquiry.inquirer_organisation} />
        <Fact label={copy.mission} value={inquiry.mission?.name} />
        <Fact label={copy.loggedBy} value={inquiry.logged_by?.full_name} />
        <Fact label={copy.received} value={inquiry.date_received ? formatDate(inquiry.date_received, locale) : null} />
        <Fact label={copy.referrals} value={copy.referralCount(inquiry.referrals.length)} />
      </dl>

      <section aria-labelledby={`${headingId}-description`}>
        <h3 id={`${headingId}-description`} className="text-h4 text-primary">
          {copy.description}
        </h3>
        <p className="mt-1 whitespace-pre-line text-body text-text-primary">{inquiry.description || copy.noDescription}</p>
      </section>

      <section aria-labelledby={`${headingId}-timeline`}>
        <h3 id={`${headingId}-timeline`} className="text-h4 text-primary">
          {copy.timelineTitle}
        </h3>
        {timeline.length === 0 ? (
          <p className="mt-2 text-body-sm text-text-secondary">{copy.timelineEmpty}</p>
        ) : (
          <ol className="mt-2 space-y-3 border-l-2 border-border pl-4">
            {timeline.slice(0, TIMELINE_LIMIT).map((entry) => (
              <li key={entry.id} className="relative">
                <span aria-hidden="true" className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-info ring-4 ring-white" />
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-body-sm">
                  <span className="font-semibold text-text-primary">{entry.title}</span>
                  <time dateTime={entry.at} className="text-caption text-text-secondary">
                    {formatRelativeTime(entry.at, locale)}
                  </time>
                </p>
                {entry.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-body-sm text-text-secondary">{entry.body}</p>}
                {entry.by && <p className="mt-0.5 text-caption text-text-muted">{copy.by(entry.by)}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link to={`/inquiries/${inquiry.id}`} className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-info-soft-text hover:underline">
            <ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />
            {copy.openFull}
          </Link>
          {inquiry.mission && (
            <Link
              to={issueDirectiveLink(inquiry.mission.id, inquiry.reference_number)}
              className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-info-soft-text hover:underline"
            >
              <ClipboardDocumentCheckIcon aria-hidden="true" className="size-4" />
              {t.sdt.hqWorkspace.inquiries.taskMission}
            </Link>
          )}
        </div>
        <Button variant="ghost" onClick={onClose}>
          {copy.close}
        </Button>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="min-w-0">
      <dt className="text-caption font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-body-sm text-text-primary">{value || <span className="text-text-muted">{t.sdt.hqWorkspace.inquiryReview.notProvided}</span>}</dd>
    </div>
  )
}

/** Operational events and progress notes, newest first, in one list. */
function buildTimeline(inquiry: InquiryDetail, t: ReturnType<typeof useI18n>['t']): TimelineEntry[] {
  const copy = t.sdt.hqWorkspace.inquiryReview
  const events: TimelineEntry[] = inquiry.events.map((event) => ({
    id: `event-${event.id}`,
    at: event.created_at,
    title: t.inquiries.eventType[event.event_type] ?? event.event_type,
    body: event.note,
    by: event.logged_by?.full_name ?? null,
  }))
  const notes: TimelineEntry[] = inquiry.notes.map((note) => ({
    id: `note-${note.id}`,
    at: note.created_at,
    title: copy.progressNote,
    body: note.content,
    by: note.authored_by?.full_name ?? null,
  }))

  return [...events, ...notes].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
