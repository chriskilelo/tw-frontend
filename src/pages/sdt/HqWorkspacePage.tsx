import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getHqWorkspace, type HqWorkspaceAlert, type HqWorkspaceDirective, type HqWorkspaceInquiry } from '../../api/sdt'
import { Table, type TableColumn } from '../../components/Table'
import { Badge } from '../../components/Badge'
import { Pagination } from '../../components/Pagination'
import { useClientPagination } from '../../hooks/useClientPagination'
import { AlertStatusBadge } from '../alerts/AlertStatusBadge'
import { InquiryStatusBadge } from '../inquiries/InquiryStatusBadge'
import { useI18n } from '../../i18n/context'

/** FR-SDT-012, FR-SDT-013. Ministry HQ Officer's unified workspace. */
export default function HqWorkspacePage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const workspaceQuery = useQuery({ queryKey: ['sdt', 'hq-workspace'], queryFn: () => getHqWorkspace() })
  const alertsPage = useClientPagination(workspaceQuery.data?.assigned_alerts ?? [])
  const inquiriesPage = useClientPagination(workspaceQuery.data?.assigned_inquiries ?? [])
  const directivesPage = useClientPagination(workspaceQuery.data?.pending_directives ?? [])

  const alertColumns: TableColumn<HqWorkspaceAlert>[] = [
    {
      key: 'reference_number',
      header: t.sdt.hqWorkspace.columnReference,
      render: (row) => <span className="font-mono">{row.reference_number}</span>,
    },
    { key: 'country', header: t.sdt.hqWorkspace.columnCountry, render: (row) => row.country },
    {
      key: 'status',
      header: t.sdt.hqWorkspace.columnStatus,
      render: (row) => <AlertStatusBadge status={row.status} />,
    },
  ]

  const inquiryColumns: TableColumn<HqWorkspaceInquiry>[] = [
    {
      key: 'reference_number',
      header: t.sdt.hqWorkspace.columnReference,
      render: (row) => <span className="font-mono">{row.reference_number}</span>,
    },
    { key: 'category', header: t.sdt.hqWorkspace.columnCategory, render: (row) => row.category },
    { key: 'inquirer_name', header: t.sdt.hqWorkspace.columnInquirer, render: (row) => row.inquirer_name },
    {
      key: 'status',
      header: t.sdt.hqWorkspace.columnStatus,
      render: (row) => <InquiryStatusBadge status={row.status} />,
    },
  ]

  const directiveColumns: TableColumn<HqWorkspaceDirective>[] = [
    { key: 'description', header: t.sdt.hqWorkspace.columnDescription, render: (row) => row.description },
    {
      key: 'status',
      header: t.sdt.hqWorkspace.columnStatus,
      render: (row) => <Badge variant="directive" label={row.status} />,
    },
    {
      key: 'target_completion_date',
      header: t.sdt.hqWorkspace.columnDate,
      render: (row) => (row.target_completion_date ? new Date(row.target_completion_date).toLocaleDateString() : '—'),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.sdt.hqWorkspace.title}</h1>

      <section className="mt-6">
        <h2 className="text-h3 text-primary">{t.sdt.hqWorkspace.assignedAlertsTitle}</h2>
        <div className="mt-3">
          <Table
            columns={alertColumns}
            data={alertsPage.pageItems}
            rowKey={(row) => row.id}
            emptyMessage={t.sdt.hqWorkspace.assignedAlertsEmpty}
            onRowClick={(row) => navigate(`/alerts/${row.id}`)}
          />
          <Pagination meta={alertsPage.meta} onPageChange={alertsPage.setPage} onPerPageChange={alertsPage.setPerPage} className="mt-4" />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-h3 text-primary">{t.sdt.hqWorkspace.assignedInquiriesTitle}</h2>
        <div className="mt-3">
          <Table
            columns={inquiryColumns}
            data={inquiriesPage.pageItems}
            rowKey={(row) => row.id}
            emptyMessage={t.sdt.hqWorkspace.assignedInquiriesEmpty}
            onRowClick={(row) => navigate(`/inquiries/${row.id}`)}
          />
          <Pagination meta={inquiriesPage.meta} onPageChange={inquiriesPage.setPage} onPerPageChange={inquiriesPage.setPerPage} className="mt-4" />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-h3 text-primary">{t.sdt.hqWorkspace.pendingDirectivesTitle}</h2>
        <div className="mt-3">
          <Table
            columns={directiveColumns}
            data={directivesPage.pageItems}
            rowKey={(row) => row.id}
            emptyMessage={t.sdt.hqWorkspace.pendingDirectivesEmpty}
          />
          <Pagination meta={directivesPage.meta} onPageChange={directivesPage.setPage} onPerPageChange={directivesPage.setPerPage} className="mt-4" />
        </div>
      </section>
    </div>
  )
}
