import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArchiveBoxIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  EyeIcon,
  InboxStackIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  QueueListIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid'
import {
  listHqWorkspaceInquiries,
  type HqInquiryStatusGroup,
  type HqWorkspaceInquiry,
  type HqWorkspaceInquiryFilters,
  type HqWorkspaceOverview,
} from '../../../api/sdt'
import { Pagination, DEFAULT_PER_PAGE } from '../../../components/Pagination'
import { Select } from '../../../components/Select'
import { InquiryStatusBadge } from '../../inquiries/InquiryStatusBadge'
import { InquirySubTypeBadge } from '../../inquiries/InquirySubTypeBadge'
import { useI18n } from '../../../i18n/context'
import { retryUnlessClientError } from '../../../lib/apiErrors'
import { formatDate, formatRelativeTime, localeFor } from '../../../lib/formatters'
import { InquiryReviewModal } from './InquiryReviewModal'
import { ChipGroup, ListSkeleton, OutsidePortfolioPill, SearchField, SectionEmpty } from './workspaceUi'
import { issueDirectiveLink, oneOf, type WorkspaceParams } from './workspaceState'
import { WorkspaceSectionError } from './WorkspaceSectionError'

const STATUS_GROUPS: HqInquiryStatusGroup[] = ['open', 'resolved', 'closed', 'all']
const SORTS = ['-notified_at', 'notified_at', '-date_received', 'date_received'] as const

const STATUS_ICONS: Record<HqInquiryStatusGroup, typeof InboxStackIcon> = {
  open: InboxStackIcon,
  resolved: CheckCircleIcon,
  closed: ArchiveBoxIcon,
  all: QueueListIcon,
}

/**
 * FR-SDT-013 with FR-INQ-009: the inquiries attaches have flagged for HQ ("HQ Notified"),
 * newest notification first, in the current scope. HQ reviews them read-only: the workflow
 * belongs to the attache at the inquiry's mission (InquiryPolicy).
 */
export default function WorkspaceInquiries({ workspace, overview }: { workspace: WorkspaceParams; overview?: HqWorkspaceOverview }) {
  const { t } = useI18n()
  const copy = t.sdt.hqWorkspace.inquiries
  const { params, update } = workspace
  const status = oneOf(params.get('status'), STATUS_GROUPS) ?? 'open'
  const highValue = params.get('high_value') === '1'
  const sort = oneOf(params.get('sort'), SORTS) ?? '-notified_at'
  const hasFilters = Boolean(params.q || highValue)

  const filters: HqWorkspaceInquiryFilters = {
    scope: params.scope,
    mission_id: params.missionId,
    status,
    high_value: highValue ? '1' : undefined,
    q: params.q || undefined,
    sort,
    page: params.page,
    per_page: params.perPage,
  }

  const listQuery = useQuery({
    queryKey: ['sdt', 'hq-workspace', 'inquiries', filters],
    queryFn: () => listHqWorkspaceInquiries(filters),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })

  const [reviewing, setReviewing] = useState<HqWorkspaceInquiry | null>(null)
  const counts = overview?.counts.inquiries
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-4">
      <div role="group" aria-label={t.sdt.hqWorkspace.filters.label} className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChipGroup<HqInquiryStatusGroup>
            label={copy.statusLabel}
            value={status}
            onChange={(next) => update({ status: next === 'open' ? null : next })}
            options={STATUS_GROUPS.map((group) => {
              const Icon = STATUS_ICONS[group]
              return { value: group, label: copy.statuses[group], count: counts?.[group], icon: <Icon /> }
            })}
          />
          <label className="inline-flex cursor-pointer items-center gap-2 text-body-sm font-semibold text-text-secondary">
            <input
              type="checkbox"
              checked={highValue}
              onChange={(event) => update({ high_value: event.target.checked ? '1' : null })}
              className="size-4 rounded border-border-muted accent-primary"
            />
            <SparklesIcon aria-hidden="true" className="size-4 text-accent-soft-text" />
            {copy.highValueOnly}
            {counts && <span className="font-mono text-caption text-text-muted">({copy.highValueOpenCount(counts.high_value_open)})</span>}
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <SearchField label={t.sdt.hqWorkspace.filters.search} placeholder={copy.searchPlaceholder} value={params.q} onSearch={(value) => update({ q: value || null })} />
          <Select
            label={t.sdt.hqWorkspace.filters.sort}
            value={sort}
            onChange={(event) => update({ sort: event.target.value === '-notified_at' ? null : event.target.value })}
            options={SORTS.map((value) => ({ value, label: copy.sort[value] }))}
          />
        </div>
      </div>

      {listQuery.isError && !listQuery.data ? (
        <WorkspaceSectionError error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : !listQuery.data ? (
        <ListSkeleton label={t.sdt.hqWorkspace.loading} />
      ) : rows.length === 0 ? (
        <SectionEmpty
          icon={hasFilters ? <MagnifyingGlassIcon /> : <ChatBubbleLeftRightIcon />}
          title={hasFilters ? t.sdt.hqWorkspace.noMatchTitle : copy.emptyTitle}
          body={hasFilters ? t.sdt.hqWorkspace.noMatchBody : copy.emptyBody}
          action={
            hasFilters ? (
              <button type="button" onClick={() => update({ q: null, high_value: null })} className="text-body-sm font-semibold text-info-soft-text hover:underline">
                {t.sdt.hqWorkspace.filters.clear}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className={listQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <p aria-live="polite" className="mb-2 text-body-sm text-text-secondary">
            {t.sdt.hqWorkspace.filters.resultCount(meta?.total ?? rows.length)}
          </p>
          <ul className="space-y-2.5" data-testid="workspace-inquiry-list">
            {rows.map((inquiry) => (
              <li key={inquiry.id}>
                <InquiryCard inquiry={inquiry} onReview={() => setReviewing(inquiry)} />
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

      <InquiryReviewModal inquiry={reviewing} onClose={() => setReviewing(null)} />
    </div>
  )
}

function InquiryCard({ inquiry, onReview }: { inquiry: HqWorkspaceInquiry; onReview: () => void }) {
  const { t, language } = useI18n()
  const copy = t.sdt.hqWorkspace.inquiries
  const locale = localeFor(language)
  const isOpen = ['received', 'in_progress', 'pending_external_response'].includes(inquiry.status)

  return (
    <article className="rounded-xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:shadow-md motion-reduce:transition-none" data-testid={`workspace-inquiry-${inquiry.id}`}>
      <div className="flex gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-soft text-info-soft-text">
          <ChatBubbleLeftRightIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-mono text-body font-semibold text-primary">{inquiry.reference_number}</h3>
            <InquiryStatusBadge status={inquiry.status} />
            {inquiry.sub_type === 'dispute_or_complaint' && <InquirySubTypeBadge subType={inquiry.sub_type} />}
            {inquiry.high_value_flag && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent-soft-text">
                <SparklesIcon aria-hidden="true" className="size-3.5" />
                {copy.highValue}
              </span>
            )}
            {inquiry.in_portfolio === false && <OutsidePortfolioPill />}
          </div>
          <p className="mt-1 text-body-sm font-medium text-text-primary">
            {[inquiry.category, inquiry.inquirer_organisation ?? inquiry.inquirer_name, inquiry.product_or_sector].filter(Boolean).join(' · ')}
          </p>
          {inquiry.excerpt && <p className="mt-1 line-clamp-2 text-body-sm text-text-secondary">{inquiry.excerpt}</p>}
          {inquiry.hq_notified && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-accent-soft/30 px-2.5 py-1.5 text-caption text-text-primary">
              <MegaphoneIcon aria-hidden="true" className="mt-px size-3.5 shrink-0 text-accent-soft-text" />
              <span className="min-w-0">
                <span className="font-semibold">
                  {inquiry.hq_notified.by
                    ? copy.notified(inquiry.hq_notified.by.full_name, formatRelativeTime(inquiry.hq_notified.at, locale))
                    : copy.notifiedUnknown(formatRelativeTime(inquiry.hq_notified.at, locale))}
                </span>
                {inquiry.hq_notified.note && <span className="text-text-secondary"> — “{inquiry.hq_notified.note}”</span>}
              </span>
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-secondary">
            {inquiry.mission && (
              <span className="inline-flex items-center gap-1">
                <BuildingOffice2Icon aria-hidden="true" className="size-3.5" />
                {inquiry.mission.name}
              </span>
            )}
            {inquiry.date_received && (
              <span className="inline-flex items-center gap-1">
                <CalendarDaysIcon aria-hidden="true" className="size-3.5" />
                {isOpen && inquiry.days_since_received !== null
                  ? copy.receivedOpen(formatDate(inquiry.date_received, locale), inquiry.days_since_received)
                  : copy.received(formatDate(inquiry.date_received, locale))}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        {inquiry.mission && (
          <Link
            to={issueDirectiveLink(inquiry.mission.id, inquiry.reference_number)}
            aria-label={copy.taskMissionAria(inquiry.mission.name, inquiry.reference_number)}
            className="mr-auto inline-flex h-9 items-center gap-1.5 rounded px-2 text-body-sm font-semibold text-info-soft-text hover:bg-info-soft/40"
          >
            <ClipboardDocumentCheckIcon aria-hidden="true" className="size-4" />
            {copy.taskMission}
          </Link>
        )}
        <Link
          to={`/inquiries/${inquiry.id}`}
          aria-label={copy.openFullAria(inquiry.reference_number)}
          className="inline-flex h-9 items-center gap-1.5 rounded px-2 text-body-sm font-semibold text-primary hover:bg-section-bg"
        >
          {copy.openFull}
        </Link>
        <button
          type="button"
          onClick={onReview}
          aria-label={copy.reviewAria(inquiry.reference_number)}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-border bg-white px-3 text-body-sm font-semibold text-primary hover:bg-section-bg"
        >
          <EyeIcon aria-hidden="true" className="size-4" />
          {copy.review}
        </button>
      </div>
    </article>
  )
}
