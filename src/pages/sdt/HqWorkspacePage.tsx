import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getHqWorkspace, type HqWorkspaceAlert, type HqWorkspaceDirective, type HqWorkspaceInquiry } from '../../api/sdt'
import { Table, type TableColumn } from '../../components/Table'
import { Badge } from '../../components/Badge'
import { AlertStatusBadge } from '../alerts/AlertStatusBadge'
import { InquiryStatusBadge } from '../inquiries/InquiryStatusBadge'
import en from '../../i18n/en'

/** FR-SDT-012, FR-SDT-013. Ministry HQ Officer's unified workspace. */
export default function HqWorkspacePage() {
  const navigate = useNavigate()

  const workspaceQuery = useQuery({ queryKey: ['sdt', 'hq-workspace'], queryFn: () => getHqWorkspace() })

  const alertColumns: TableColumn<HqWorkspaceAlert>[] = [
    {
      key: 'reference_number',
      header: en.sdt.hqWorkspace.columnReference,
      render: (row) => <span className="font-mono">{row.reference_number}</span>,
    },
    { key: 'country', header: en.sdt.hqWorkspace.columnCountry, render: (row) => row.country },
    {
      key: 'status',
      header: en.sdt.hqWorkspace.columnStatus,
      render: (row) => <AlertStatusBadge status={row.status} />,
    },
  ]

  const inquiryColumns: TableColumn<HqWorkspaceInquiry>[] = [
    {
      key: 'reference_number',
      header: en.sdt.hqWorkspace.columnReference,
      render: (row) => <span className="font-mono">{row.reference_number}</span>,
    },
    { key: 'category', header: en.sdt.hqWorkspace.columnCategory, render: (row) => row.category },
    { key: 'inquirer_name', header: en.sdt.hqWorkspace.columnInquirer, render: (row) => row.inquirer_name },
    {
      key: 'status',
      header: en.sdt.hqWorkspace.columnStatus,
      render: (row) => <InquiryStatusBadge status={row.status} />,
    },
  ]

  const directiveColumns: TableColumn<HqWorkspaceDirective>[] = [
    { key: 'description', header: en.sdt.hqWorkspace.columnDescription, render: (row) => row.description },
    {
      key: 'status',
      header: en.sdt.hqWorkspace.columnStatus,
      render: (row) => <Badge variant="directive" label={row.status} />,
    },
    {
      key: 'target_completion_date',
      header: en.sdt.hqWorkspace.columnDate,
      render: (row) => (row.target_completion_date ? new Date(row.target_completion_date).toLocaleDateString() : '—'),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.sdt.hqWorkspace.title}</h1>

      <section className="mt-6">
        <h2 className="text-h3 text-primary">{en.sdt.hqWorkspace.assignedAlertsTitle}</h2>
        <div className="mt-3">
          <Table
            columns={alertColumns}
            data={workspaceQuery.data?.assigned_alerts ?? []}
            rowKey={(row) => row.id}
            emptyMessage={en.sdt.hqWorkspace.assignedAlertsEmpty}
            onRowClick={(row) => navigate(`/alerts/${row.id}`)}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-h3 text-primary">{en.sdt.hqWorkspace.assignedInquiriesTitle}</h2>
        <div className="mt-3">
          <Table
            columns={inquiryColumns}
            data={workspaceQuery.data?.assigned_inquiries ?? []}
            rowKey={(row) => row.id}
            emptyMessage={en.sdt.hqWorkspace.assignedInquiriesEmpty}
            onRowClick={(row) => navigate(`/inquiries/${row.id}`)}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-h3 text-primary">{en.sdt.hqWorkspace.pendingDirectivesTitle}</h2>
        <div className="mt-3">
          <Table
            columns={directiveColumns}
            data={workspaceQuery.data?.pending_directives ?? []}
            rowKey={(row) => row.id}
            emptyMessage={en.sdt.hqWorkspace.pendingDirectivesEmpty}
          />
        </div>
      </section>
    </div>
  )
}
