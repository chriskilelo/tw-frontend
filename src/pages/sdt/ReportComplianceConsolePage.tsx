import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSdtReportCompliance } from '../../api/sdt'
import type { ComplianceMissionRow, ReportComplianceStatus } from '../../api/reports'
import { Table, type TableColumn } from '../../components/Table'
import { Badge, type BadgeVariant } from '../../components/Badge'
import { Input } from '../../components/Input'
import en from '../../i18n/en'

const STATUS_VARIANT: Record<ReportComplianceStatus, BadgeVariant> = {
  submitted_on_time: 'success',
  submitted_late: 'danger',
  not_yet_submitted: 'neutral',
}

const STATUS_LABEL: Record<ReportComplianceStatus, string> = {
  submitted_on_time: en.sdt.reportCompliance.statusOnTime,
  submitted_late: en.sdt.reportCompliance.statusLate,
  not_yet_submitted: en.sdt.reportCompliance.statusPending,
}

const TILE_VARIANT_CLASSES: Record<'success' | 'danger' | 'neutral', string> = {
  success: 'border-success bg-success-soft text-success-soft-text',
  danger: 'border-danger bg-danger-soft text-danger-soft-text',
  neutral: 'border-border bg-section-bg text-text-secondary',
}

function SummaryTile({ variant, label, value }: { variant: 'success' | 'danger' | 'neutral'; label: string; value: number }) {
  return (
    <div className={`rounded-lg border p-4 ${TILE_VARIANT_CLASSES[variant]}`}>
      <p className="text-h2 font-bold">{value}</p>
      <p className="text-body-sm font-semibold">{label}</p>
    </div>
  )
}

/**
 * FR-SDT-007: consolidated compliance view of every mission in the PS's ministry against
 * the current (or a specified) reporting quarter — App\Http\Controllers\Api\Sdt\ReportsController::compliance(),
 * gated server-side by MinistryPolicy::viewPsDashboard() (Ministry PS and Acting PS only).
 * This page renders whatever the endpoint returns rather than re-checking the role
 * client-side, matching ComplianceDashboardPage's established precedent.
 */
export default function ReportComplianceConsolePage() {
  const [periodLabel, setPeriodLabel] = useState('')

  const complianceQuery = useQuery({
    queryKey: ['sdt', 'reports', 'compliance', periodLabel],
    queryFn: () => getSdtReportCompliance(periodLabel || undefined),
  })

  const dashboard = complianceQuery.data
  const missions = dashboard?.missions ?? []

  const columns: TableColumn<ComplianceMissionRow>[] = [
    { key: 'mission_name', header: en.sdt.reportCompliance.columnMission, render: (row) => row.mission_name },
    {
      key: 'status',
      header: en.sdt.reportCompliance.columnStatus,
      render: (row) => <Badge variant={STATUS_VARIANT[row.status]} label={STATUS_LABEL[row.status]} />,
    },
    {
      key: 'submitted_at',
      header: en.sdt.reportCompliance.columnSubmittedAt,
      render: (row) => (row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—'),
    },
    {
      key: 'review',
      header: '',
      render: (row) => (
        <Link
          to={`/reports?mission_id=${row.mission_id}${dashboard ? `&period=${encodeURIComponent(dashboard.period_label)}` : ''}`}
          className="font-semibold text-accent-text underline"
        >
          {en.sdt.reportCompliance.reviewLink}
        </Link>
      ),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.sdt.reportCompliance.title}</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Input
          label={en.sdt.reportCompliance.columnStatus}
          placeholder={dashboard?.period_label}
          value={periodLabel}
          onChange={(event) => setPeriodLabel(event.target.value)}
          className="sm:w-56"
        />
      </div>

      {dashboard && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryTile variant="success" label={en.sdt.reportCompliance.summaryOnTime} value={dashboard.summary.submitted_on_time} />
          <SummaryTile variant="danger" label={en.sdt.reportCompliance.summaryLate} value={dashboard.summary.submitted_late} />
          <SummaryTile
            variant="neutral"
            label={en.sdt.reportCompliance.summaryPending}
            value={dashboard.summary.not_yet_submitted}
          />
        </div>
      )}

      <div className="mt-6">
        <Table
          columns={columns}
          data={missions}
          rowKey={(row) => row.mission_id}
          emptyMessage={en.sdt.reportCompliance.empty}
          getRowClassName={(row) => (row.status === 'submitted_late' ? 'bg-danger-soft' : undefined)}
        />
      </div>
    </div>
  )
}
