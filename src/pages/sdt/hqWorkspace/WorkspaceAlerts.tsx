import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowTrendingUpIcon,
  BellAlertIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  EyeIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  QueueListIcon,
  UserCircleIcon,
  UserIcon,
} from '@heroicons/react/20/solid'
import { acknowledgeAlert, type AlertIntelligenceType } from '../../../api/alerts'
import {
  listHqWorkspaceAlerts,
  type HqAlertQueue,
  type HqWorkspaceAlert,
  type HqWorkspaceAlertFilters,
  type HqWorkspaceOverview,
  type HqWorkspaceScope,
} from '../../../api/sdt'
import { Pagination, DEFAULT_PER_PAGE } from '../../../components/Pagination'
import { Select } from '../../../components/Select'
import { AlertStatusBadge } from '../../alerts/AlertStatusBadge'
import { urgencyTier } from '../../alerts/alertAssessment'
import { useI18n } from '../../../i18n/context'
import { retryUnlessClientError } from '../../../lib/apiErrors'
import { formatRelativeTime, localeFor } from '../../../lib/formatters'
import { AlertReviewModal } from './AlertReviewModal'
import { ActionNotice, ChipGroup, ListSkeleton, OutsidePortfolioPill, SearchField, SectionEmpty } from './workspaceUi'
import { issueDirectiveLink, oneOf, rowActionError, useActionNotice, type WorkspaceParams } from './workspaceState'
import { WorkspaceSectionError } from './WorkspaceSectionError'

const QUEUES: HqAlertQueue[] = ['awaiting', 'acknowledged', 'feed']
const TYPES: AlertIntelligenceType[] = ['opportunities', 'trade_barriers']
const SORTS = ['-created_at', 'created_at'] as const

const TYPE_STYLE: Record<AlertIntelligenceType, { chip: string; icon: typeof NoSymbolIcon }> = {
  opportunities: { chip: 'bg-success-soft text-success-soft-text', icon: ArrowTrendingUpIcon },
  trade_barriers: { chip: 'bg-danger-soft text-danger-soft-text', icon: NoSymbolIcon },
}

interface SectionProps {
  workspace: WorkspaceParams
  overview?: HqWorkspaceOverview
  scope: HqWorkspaceScope
  onChanged: () => void
}

/**
 * FR-SDT-013: the alerts delegated to the officer, to acknowledge (FR-ALERT-009) and answer
 * (FR-ALERT-010) in place, plus the feed of every alert in the current scope for awareness.
 * Row actions come from the API (HqWorkspaceService: AlertPolicy per row), so an officer is
 * only ever offered what the server accepts.
 */
export default function WorkspaceAlerts({ workspace, overview, scope, onChanged }: SectionProps) {
  const { t } = useI18n()
  const copy = t.sdt.hqWorkspace.alerts
  const queryClient = useQueryClient()
  const { params, update } = workspace
  const queue = oneOf(params.get('queue'), QUEUES) ?? 'awaiting'
  const type = oneOf(params.get('type'), TYPES)
  const sort = oneOf(params.get('sort'), SORTS) ?? '-created_at'
  const hasFilters = Boolean(params.q || type)

  const filters: HqWorkspaceAlertFilters = {
    scope: params.scope,
    mission_id: params.missionId,
    queue,
    intelligence_type: type,
    q: params.q || undefined,
    sort,
    page: params.page,
    per_page: params.perPage,
  }

  const listQuery = useQuery({
    queryKey: ['sdt', 'hq-workspace', 'alerts', filters],
    queryFn: () => listHqWorkspaceAlerts(filters),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })

  const [reviewing, setReviewing] = useState<HqWorkspaceAlert | null>(null)
  const [notice, showNotice] = useActionNotice()
  const [rowError, setRowError] = useState<string | null>(null)

  const acknowledgeMutation = useMutation({
    mutationFn: (alert: HqWorkspaceAlert) => acknowledgeAlert(alert.id),
    onMutate: () => setRowError(null),
    onSuccess: (updated, alert) => {
      queryClient.setQueryData(['alert', alert.id], updated)
      showNotice(copy.acknowledgedNotice(alert.reference_number))
      onChanged()
    },
    onError: (error) => setRowError(rowActionError(error, t)),
  })

  const counts = overview?.counts.alerts
  const feedLabel = scope === 'portfolio' ? copy.feedPortfolio : copy.feedDepartment
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-4">
      <div role="group" aria-label={t.sdt.hqWorkspace.filters.label} className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <ChipGroup<HqAlertQueue>
          label={copy.queueLabel}
          value={queue}
          onChange={(next) => update({ queue: next === 'awaiting' ? null : next })}
          options={[
            { value: 'awaiting', label: copy.queues.awaiting, count: counts?.awaiting, icon: <InboxIcon /> },
            { value: 'acknowledged', label: copy.queues.acknowledged, count: counts?.acknowledged, icon: <CheckBadgeIcon /> },
            { value: 'feed', label: feedLabel, count: counts?.feed, icon: <QueueListIcon /> },
          ]}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_14rem_12rem]">
          <SearchField label={t.sdt.hqWorkspace.filters.search} placeholder={copy.searchPlaceholder} value={params.q} onSearch={(value) => update({ q: value || null })} />
          <Select
            label={copy.type}
            value={type ?? ''}
            placeholder={copy.allTypes}
            onChange={(event) => update({ type: event.target.value || null })}
            options={TYPES.map((value) => ({ value, label: t.alerts.intelligenceType[value] }))}
          />
          <Select
            label={t.sdt.hqWorkspace.filters.sort}
            value={sort}
            onChange={(event) => update({ sort: event.target.value === '-created_at' ? null : event.target.value })}
            options={SORTS.map((value) => ({ value, label: copy.sort[value] }))}
          />
        </div>
        {queue === 'feed' && <p className="text-caption text-text-secondary">{scope === 'portfolio' ? copy.feedPortfolioHelp : copy.feedDepartmentHelp}</p>}
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
          icon={hasFilters ? <MagnifyingGlassIcon /> : <BellAlertIcon />}
          title={hasFilters ? t.sdt.hqWorkspace.noMatchTitle : copy.empty[queue].title}
          body={hasFilters ? t.sdt.hqWorkspace.noMatchBody : copy.empty[queue].body}
          action={
            hasFilters ? (
              <button type="button" onClick={() => update({ q: null, type: null })} className="text-body-sm font-semibold text-info-soft-text hover:underline">
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
          <ul className="space-y-2.5" data-testid="workspace-alert-list">
            {rows.map((alert) => (
              <li key={alert.id}>
                <AlertCard
                  alert={alert}
                  isAcknowledging={acknowledgeMutation.isPending && acknowledgeMutation.variables?.id === alert.id}
                  onReview={() => setReviewing(alert)}
                  onAcknowledge={() => acknowledgeMutation.mutate(alert)}
                />
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

      <AlertReviewModal
        alert={reviewing}
        onClose={() => setReviewing(null)}
        onChanged={(message) => {
          showNotice(message)
          onChanged()
        }}
      />
    </div>
  )
}

function AlertCard({ alert, isAcknowledging, onReview, onAcknowledge }: { alert: HqWorkspaceAlert; isAcknowledging: boolean; onReview: () => void; onAcknowledge: () => void }) {
  const { t, language } = useI18n()
  const copy = t.sdt.hqWorkspace.alerts
  const locale = localeFor(language)
  const style = TYPE_STYLE[alert.intelligence_type] ?? { chip: 'bg-section-bg text-text-secondary', icon: BellAlertIcon }
  const TypeIcon = style.icon
  const typeLabel = t.alerts.intelligenceType[alert.intelligence_type] ?? alert.intelligence_type
  const tier = alert.urgency ? urgencyTier(alert.urgency) : null
  const assignment = alert.assigned_to_me ? copy.assignedToYou : alert.assigned_to ? copy.assignedTo(alert.assigned_to.full_name) : copy.notDelegated

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition duration-200 hover:shadow-md motion-reduce:transition-none ${
        alert.actions.acknowledge ? 'border-accent/40 border-l-4 border-l-accent' : 'border-border'
      }`}
      data-testid={`workspace-alert-${alert.id}`}
    >
      <div className="flex gap-3">
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-lg ${style.chip}`}>
          <TypeIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-mono text-body font-semibold text-primary">{alert.reference_number}</h3>
            <AlertStatusBadge status={alert.status} />
            {tier === 'high' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-atrisk-soft px-2 py-0.5 text-caption font-semibold text-atrisk-soft-text">
                <ClockIcon aria-hidden="true" className="size-3.5" />
                {t.alerts.submit.urgencyOptions.high.summary}
              </span>
            )}
            {alert.in_portfolio === false && <OutsidePortfolioPill />}
          </div>
          <p className="mt-1 text-body-sm font-medium text-text-primary">
            {[alert.country, typeLabel, alert.sector, alert.product_category].filter(Boolean).join(' · ')}
          </p>
          {alert.excerpt && <p className="mt-1 line-clamp-2 text-body-sm text-text-secondary">{alert.excerpt}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-secondary">
            {alert.mission && (
              <span className="inline-flex items-center gap-1">
                <BuildingOffice2Icon aria-hidden="true" className="size-3.5" />
                {alert.mission.name}
              </span>
            )}
            {alert.submitted_by && (
              <span className="inline-flex items-center gap-1">
                <UserIcon aria-hidden="true" className="size-3.5" />
                {alert.submitted_by.full_name}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <ClockIcon aria-hidden="true" className="size-3.5" />
              <time dateTime={alert.created_at}>{formatRelativeTime(alert.created_at, locale)}</time>
            </span>
            <span className="inline-flex items-center gap-1">
              <ChatBubbleLeftRightIcon aria-hidden="true" className="size-3.5" />
              {copy.feedbackCount(alert.feedback_count)}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserCircleIcon aria-hidden="true" className="size-3.5" />
              {assignment}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        {alert.mission && (
          <Link
            to={issueDirectiveLink(alert.mission.id, alert.reference_number)}
            aria-label={copy.taskMissionAria(alert.mission.name, alert.reference_number)}
            className="mr-auto inline-flex h-9 items-center gap-1.5 rounded px-2 text-body-sm font-semibold text-info-soft-text hover:bg-info-soft/40"
          >
            <ClipboardDocumentCheckIcon aria-hidden="true" className="size-4" />
            {copy.taskMission}
          </Link>
        )}
        <button
          type="button"
          onClick={onReview}
          aria-label={copy.reviewAria(alert.reference_number)}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-border bg-white px-3 text-body-sm font-semibold text-primary hover:bg-section-bg"
        >
          <EyeIcon aria-hidden="true" className="size-4" />
          {alert.actions.feedback ? copy.reviewRespond : copy.review}
        </button>
        {alert.actions.acknowledge && (
          <button
            type="button"
            onClick={onAcknowledge}
            disabled={isAcknowledging}
            aria-label={copy.acknowledgeAria(alert.reference_number)}
            className="inline-flex h-9 items-center gap-1.5 rounded bg-accent px-3 text-body-sm font-semibold text-accent-text hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckBadgeIcon aria-hidden="true" className="size-4" />
            {copy.acknowledge}
          </button>
        )}
      </div>
    </article>
  )
}
