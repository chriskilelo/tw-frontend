import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listPeriodicReports, type PeriodicReport, type PeriodicReportStatus } from '../../api/reports'
import { useAuth, isReadOnlyRole } from '../../hooks/useAuth'
import { Table, type TableColumn } from '../../components/Table'
import { Button } from '../../components/Button'
import { ReportStatusBadge, ReportLateBadge } from './ReportStatusBadge'
import en from '../../i18n/en'

const STATUS_OPTIONS: PeriodicReportStatus[] = ['draft', 'submitted']

/**
 * FR-RPT-018. PeriodicReportController::index() already scopes results server-side: a
 * Ministry Attache always sees only their own mission's reports (regardless of any
 * mission_id filter); every other ministry-scoped role sees every mission in the ministry.
 * This page renders whatever the server returns rather than re-deriving that scoping.
 *
 * `mission_id`/`period` search params (set by ReportComplianceConsolePage's "review reports"
 * link, Session 31) pre-filter the list to the mission/period the PS clicked through from —
 * ComplianceMissionRow carries no report id to link to directly (App\Services\ReportService::
 * getComplianceDashboard() never selects one), so this list, filtered, is the closest
 * "individual report" entry point the backend's actual response shape supports.
 */
export default function ReportListPage() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const readOnly = isReadOnlyRole(role?.name)
  const canCreate = !readOnly && role?.name === 'Ministry Attache'

  const [searchParams] = useSearchParams()
  const missionId = searchParams.get('mission_id') ?? undefined
  const periodLabel = searchParams.get('period') ?? undefined

  const [status, setStatus] = useState<PeriodicReportStatus | ''>('')

  const listQuery = useQuery({
    queryKey: ['periodic-reports', { status, missionId, periodLabel }],
    queryFn: () =>
      listPeriodicReports({ status: status || undefined, mission_id: missionId, reporting_period_label: periodLabel }),
  })

  const reports = listQuery.data?.data ?? []

  function goToReport(id: string) {
    navigate(`/reports/${id}`)
  }

  const columns: TableColumn<PeriodicReport>[] = [
    {
      key: 'mission',
      header: en.reports.list.columnMission,
      render: (row) => row.mission?.name ?? '—',
    },
    {
      key: 'reporting_period_label',
      header: en.reports.list.columnPeriod,
      render: (row) => row.reporting_period_label,
    },
    {
      key: 'status',
      header: en.reports.list.columnStatus,
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <ReportStatusBadge status={row.status} />
          {row.is_late && <ReportLateBadge />}
        </div>
      ),
    },
    {
      key: 'submitted_at',
      header: en.reports.list.columnSubmittedAt,
      render: (row) => (row.submitted_at ? new Date(row.submitted_at).toLocaleString() : en.reports.list.notSubmitted),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 text-primary">{en.reports.list.title}</h1>
        {canCreate && (
          <Link to="/reports/new">
            <Button variant="primary">{en.reports.list.newReportButton}</Button>
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.reports.list.filterStatus}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as PeriodicReportStatus | '')}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">{en.reports.list.allStatuses}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {en.reports.status[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(missionId || periodLabel) && (
        <p className="mt-3 text-body-sm text-text-secondary">
          {en.reports.list.filteredFromCompliance}{' '}
          <Link to="/reports" className="font-semibold text-accent-text underline">
            {en.reports.list.clearFilter}
          </Link>
        </p>
      )}

      <div className="mt-6">
        <Table
          columns={columns}
          data={reports}
          rowKey={(row) => row.id}
          emptyMessage={en.reports.list.empty}
          onRowClick={(row) => goToReport(row.id)}
        />
      </div>
    </div>
  )
}
