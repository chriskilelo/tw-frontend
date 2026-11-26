import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listAlerts, type Alert } from '../../api/alerts'
import { getPsDashboard, type PsDashboardDirective, type PsDashboardInquiry, type PsDashboardMissionRef } from '../../api/sdt'
import type { DirectiveStatus } from '../../api/directives'
import { InquiryStatusBadge } from '../inquiries/InquiryStatusBadge'
import { DirectiveStatusBadge } from '../directives/DirectiveStatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { Table, type TableColumn } from '../../components/Table'
import { AlertStatusBadge } from '../alerts/AlertStatusBadge'
import { Pagination } from '../../components/Pagination'
import { useClientPagination } from '../../hooks/useClientPagination'
import { useI18n } from '../../i18n/context'
import { translatedName } from '../../lib/displayNames'
import { LeadershipSwitchPanel } from './LeadershipSwitchPanel'

/**
 * FR-SDT-001: SdtService::psDashboard() only returns unacknowledged_alerts_count, not
 * the alerts themselves. The unacknowledged-alerts panel (which needs real per-alert
 * links, per the task) is built from two ministry-scoped GET /alerts calls — status=new
 * and status=assigned — merged client-side, since AlertController::index has no
 * "status != acknowledged" filter.
 *
 * The leadership switches (K-02, K-05, K-08: FR-SDT-003 to 006) show the PS and the Acting PS
 * whether an Acting PS or a Designated Deputy is on and who holds it, and let them choose from
 * the people the server accepts. The route has no per-role guard (only ProtectedRoute checks
 * authentication), so the panel is shown to those two roles only. The API decides what each
 * may change (an Acting PS sees its own switch read-only). UI-006: hiding the panel does not
 * substitute for the backend check.
 */
export default function PsDashboardPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { role } = useAuth()
  const showsLeadershipSwitches = role?.name === 'Ministry PS' || role?.name === 'Acting PS'

  const dashboardQuery = useQuery({ queryKey: ['sdt', 'dashboard'], queryFn: getPsDashboard })

  const newAlertsQuery = useQuery({
    queryKey: ['alerts', { status: 'new' }],
    queryFn: () => listAlerts({ status: 'new' }),
  })
  const assignedAlertsQuery = useQuery({
    queryKey: ['alerts', { status: 'assigned' }],
    queryFn: () => listAlerts({ status: 'assigned' }),
  })

  const unacknowledgedAlerts = [...(newAlertsQuery.data?.data ?? []), ...(assignedAlertsQuery.data?.data ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const unacknowledgedAlertsPage = useClientPagination(unacknowledgedAlerts)

  const columns: TableColumn<Alert>[] = [
    {
      key: 'reference_number',
      header: t.sdt.psDashboard.columnReference,
      render: (row) => <span className="font-mono">{row.reference_number}</span>,
    },
    { key: 'country', header: t.sdt.psDashboard.columnCountry, render: (row) => row.country },
    {
      key: 'status',
      header: t.sdt.psDashboard.columnStatus,
      render: (row) => <AlertStatusBadge status={row.status} />,
    },
  ]

  const directiveSummary = dashboardQuery.data?.directive_summary_this_week
  const pendingInquiries = dashboardQuery.data?.pending_inquiries ?? []
  const pendingCount = dashboardQuery.data?.pending_inquiries_count ?? 0
  const weekDirectives = directiveSummary?.directives ?? []
  const missionLabel = (mission: PsDashboardMissionRef | null) => (mission ? `${mission.name} · ${mission.host_country}` : '—')

  const inquiryColumns: TableColumn<PsDashboardInquiry>[] = [
    { key: 'reference_number', header: t.sdt.psDashboard.columnReference, render: (row) => <span className="font-mono">{row.reference_number}</span> },
    { key: 'mission', header: t.sdt.psDashboard.columnMissionCountry, render: (row) => missionLabel(row.mission) },
    { key: 'category', header: t.sdt.psDashboard.columnCategory, render: (row) => translatedName(row.category, t.inquiryCategoryNames) },
    { key: 'status', header: t.sdt.psDashboard.columnStatus, render: (row) => <InquiryStatusBadge status={row.status} /> },
  ]

  const directiveColumns: TableColumn<PsDashboardDirective>[] = [
    { key: 'description', header: t.sdt.psDashboard.columnDirective, render: (row) => <span className="line-clamp-2">{row.description}</span> },
    { key: 'mission', header: t.sdt.psDashboard.columnMissionCountry, render: (row) => missionLabel(row.mission) },
    { key: 'status', header: t.sdt.psDashboard.columnStatus, render: (row) => <DirectiveStatusBadge status={row.status} /> },
  ]

  return (
    <div className="p-6" data-testid="alert-dashboard">
      <h1 className="text-h1 text-primary">{t.sdt.psDashboard.title}</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <p className="text-body-sm text-text-muted">{t.sdt.psDashboard.pendingInquiriesTitle}</p>
          <p className="mt-1 font-mono text-h1 text-primary">{dashboardQuery.data?.pending_inquiries_count ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <p className="text-body-sm text-text-muted">{t.sdt.psDashboard.directiveSummaryTitle}</p>
          <p className="mt-1 font-mono text-h1 text-primary">{directiveSummary?.total ?? '—'}</p>
          {directiveSummary && (
            <dl className="mt-2 space-y-1.5 text-body-sm">
              {(Object.entries(directiveSummary.by_status) as [DirectiveStatus, number][]).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between gap-2">
                  <dt>
                    <DirectiveStatusBadge status={status} />
                  </dt>
                  <dd className="font-mono text-text-primary">{count}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-h3 text-primary">{t.sdt.psDashboard.unacknowledgedAlertsTitle}</h2>
        <div className="mt-3">
          <Table
            columns={columns}
            data={unacknowledgedAlertsPage.pageItems}
            rowKey={(row) => row.id}
            emptyMessage={t.sdt.psDashboard.unacknowledgedAlertsEmpty}
            onRowClick={(row) => navigate(`/alerts/${row.id}`)}
            getRowTestId={() => 'alert-row'}
          />
          <Pagination
            meta={unacknowledgedAlertsPage.meta}
            onPageChange={unacknowledgedAlertsPage.setPage}
            onPerPageChange={unacknowledgedAlertsPage.setPerPage}
            className="mt-4"
          />
        </div>
      </section>

      {/* ISS-014: the items behind the two counts above, with country and status. */}
      <section className="mt-8" aria-labelledby="ps-pending-inquiries-heading">
        <h2 id="ps-pending-inquiries-heading" className="text-h3 text-primary">
          {t.sdt.psDashboard.pendingInquiriesTitle}
        </h2>
        <div className="mt-3">
          <Table
            columns={inquiryColumns}
            data={pendingInquiries}
            rowKey={(row) => row.id}
            emptyMessage={t.sdt.psDashboard.pendingInquiriesEmpty}
            onRowClick={(row) => navigate(`/inquiries/${row.id}`)}
          />
          {pendingCount > pendingInquiries.length && (
            <Link to="/inquiries" className="mt-2 inline-block text-body-sm font-semibold text-info-soft-text hover:underline">
              {t.sdt.psDashboard.viewAllInquiries(pendingInquiries.length, pendingCount)}
            </Link>
          )}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="ps-directives-heading">
        <h2 id="ps-directives-heading" className="text-h3 text-primary">
          {t.sdt.psDashboard.directiveSummaryTitle}
        </h2>
        <p className="text-body-sm text-text-secondary">{t.sdt.psDashboard.directivesThisWeek}</p>
        <div className="mt-3">
          <Table
            columns={directiveColumns}
            data={weekDirectives}
            rowKey={(row) => row.id}
            emptyMessage={t.sdt.psDashboard.directivesEmpty}
            onRowClick={(row) => navigate(`/directives/${row.id}`)}
          />
          {(directiveSummary?.total ?? 0) > weekDirectives.length && (
            <Link to="/directives" className="mt-2 inline-block text-body-sm font-semibold text-info-soft-text hover:underline">
              {t.sdt.psDashboard.viewAllDirectives}
            </Link>
          )}
        </div>
      </section>

      {showsLeadershipSwitches && (
        <section className="mt-8" aria-label={t.admin.leadership.title}>
          <LeadershipSwitchPanel switches={['acting_ps', 'designated_deputy']} columns={2} />
        </section>
      )}
    </div>
  )
}
