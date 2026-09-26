import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { listMissions } from '../../api/missions'
import {
  getMissionActivityFeed,
  getMissionActivitySummary,
  type GovernanceActivityPeriod,
  type GovernanceFeedItem,
  type GovernanceItemType,
} from '../../api/governance'
import { Table, type TableColumn } from '../../components/Table'
import { Badge, type BadgeVariant } from '../../components/Badge'
import { Pagination } from '../../components/Pagination'
import { useClientPagination } from '../../hooks/useClientPagination'
import { useI18n } from '../../i18n/context'

function typeLabel(t: ReturnType<typeof useI18n>['t'], type: GovernanceItemType): string {
  const TYPE_LABEL: Record<GovernanceItemType, string> = {
    alert: t.nav.alerts,
    inquiry: t.nav.inquiries,
    directive: t.nav.directives,
    periodic_report: t.nav.reports,
  }
  return TYPE_LABEL[type]
}

const TYPE_BADGE_VARIANT: Record<GovernanceItemType, BadgeVariant> = {
  alert: 'accent',
  inquiry: 'info',
  directive: 'directive',
  periodic_report: 'neutral',
}

/**
 * FR-HOM-001, FR-HOM-002. Completely read-only (UI-006, CLAUDE.md Section 4 Rule 2) —
 * no action buttons anywhere on this page, mirroring the structural read-only
 * enforcement BasePolicy::before() already applies at the API layer for this role.
 */
export default function MissionActivityPage() {
  const { t } = useI18n()
  const { user } = useAuth()

  const missionsQuery = useQuery({ queryKey: ['missions'], queryFn: listMissions })
  const mission = missionsQuery.data?.find((candidate) => candidate.id === user?.mission_id)

  const feedQuery = useQuery({
    queryKey: ['mission-activity'],
    queryFn: () => getMissionActivityFeed(),
  })

  const summaryQuery = useQuery({
    queryKey: ['mission-activity', 'summary'],
    queryFn: () => getMissionActivitySummary(),
  })

  const items = feedQuery.data?.data ?? []
  const title = t.governance.missionActivity.title.replace('{mission}', mission?.name ?? '…')
  const itemsPage = useClientPagination(items)

  const columns: TableColumn<GovernanceFeedItem>[] = [
    {
      key: 'type',
      header: t.governance.missionActivity.columnType,
      render: (row) => <Badge variant={TYPE_BADGE_VARIANT[row.type]} label={typeLabel(t, row.type)} />,
    },
    {
      key: 'reference',
      header: t.governance.missionActivity.columnReference,
      render: (row) => <span className="font-mono">{row.reference}</span>,
    },
    {
      key: 'status',
      header: t.governance.missionActivity.columnStatus,
      render: (row) => row.status ?? '—',
    },
    {
      key: 'submitting_officer',
      header: t.governance.missionActivity.columnOfficer,
      render: (row) => row.submitting_officer ?? '—',
    },
    {
      key: 'summary',
      header: t.governance.missionActivity.columnSummary,
      render: (row) => row.summary,
    },
    {
      key: 'date',
      header: t.governance.missionActivity.columnDate,
      render: (row) => new Date(row.date).toLocaleString(),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{title}</h1>
      <Badge variant="neutral" label={t.common.readOnly} className="mt-2" />

      <section className="mt-6">
        <h2 className="text-h3 text-primary">{t.governance.missionActivity.summaryTitle}</h2>
        {summaryQuery.data && (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PeriodSummaryCard label={t.governance.missionActivity.currentPeriodLabel} period={summaryQuery.data.current_period} />
            <PeriodSummaryCard label={t.governance.missionActivity.priorPeriodLabel} period={summaryQuery.data.prior_period} />
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-h3 text-primary">{t.governance.missionActivity.feedTitle}</h2>
        <div className="mt-3">
          <Table
            columns={columns}
            data={itemsPage.pageItems}
            rowKey={(row) => `${row.type}-${row.id}`}
            emptyMessage={t.governance.missionActivity.empty}
          />
          <Pagination
            meta={itemsPage.meta}
            onPageChange={itemsPage.setPage}
            onPerPageChange={itemsPage.setPerPage}
            className="mt-4"
          />
        </div>
      </section>
    </div>
  )
}

function PeriodSummaryCard({ label, period }: { label: string; period: GovernanceActivityPeriod }) {
  const { t } = useI18n()
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-body-sm text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-h1 text-primary">{period.total}</p>
      <p className="text-caption text-text-muted">
        {period.period_start} – {period.period_end}
      </p>
      <dl className="mt-3 space-y-1 text-body-sm">
        {Object.entries(period.by_type).map(([type, count]) => (
          <div key={type} className="flex justify-between">
            <dt className="text-text-secondary">{typeLabel(t, type as GovernanceItemType) ?? type}</dt>
            <dd className="font-mono text-text-primary">{count}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
