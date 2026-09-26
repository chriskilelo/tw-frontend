import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getReportComplianceDashboard, type ComplianceMissionRow, type ReportComplianceStatus } from '../../api/reports'
import { Table, type TableColumn } from '../../components/Table'
import { Badge, type BadgeVariant } from '../../components/Badge'
import { Input } from '../../components/Input'
import { Pagination } from '../../components/Pagination'
import { useClientPagination } from '../../hooks/useClientPagination'
import { useI18n } from '../../i18n/context'

const STATUS_VARIANT: Record<ReportComplianceStatus, BadgeVariant> = {
  submitted_on_time: 'success',
  submitted_late: 'atrisk',
  not_yet_submitted: 'neutral',
}

function OnTimeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  )
}

function LateIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}

function PendingIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <circle cx={12} cy={12} r={9} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  )
}

const STATUS_ICON: Record<ReportComplianceStatus, ReactNode> = {
  submitted_on_time: <OnTimeIcon />,
  submitted_late: <LateIcon />,
  not_yet_submitted: <PendingIcon />,
}

/**
 * FR-RPT-018: Ministry HQ Director / Ministry PS (and Acting PS, which holds the PS
 * permission set for the duration of activation, Session 14) — enforced server-side by
 * ReportPolicy::viewCompliance(); this page renders whatever the endpoint returns rather
 * than re-checking the role client-side.
 */
export default function ComplianceDashboardPage() {
  const { t } = useI18n()
  const STATUS_LABEL: Record<ReportComplianceStatus, string> = {
    submitted_on_time: t.reports.compliance.statusOnTime,
    submitted_late: t.reports.compliance.statusLate,
    not_yet_submitted: t.reports.compliance.statusPending,
  }
  const [periodLabel, setPeriodLabel] = useState('')

  const complianceQuery = useQuery({
    queryKey: ['periodic-reports', 'compliance', periodLabel],
    queryFn: () => getReportComplianceDashboard(periodLabel || undefined),
  })

  const dashboard = complianceQuery.data
  const missions = dashboard?.missions ?? []
  const missionsPage = useClientPagination(missions)

  const columns: TableColumn<ComplianceMissionRow>[] = [
    { key: 'mission_name', header: t.reports.compliance.columnMission, render: (row) => row.mission_name },
    {
      key: 'period',
      header: t.reports.compliance.columnPeriod,
      render: () => dashboard?.period_label ?? '—',
    },
    {
      key: 'status',
      header: t.reports.compliance.columnStatus,
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status]} icon={STATUS_ICON[row.status]} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: 'submitted_at',
      header: t.reports.compliance.columnSubmittedAt,
      render: (row) => (row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—'),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.reports.compliance.title}</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Input
          label={t.reports.compliance.columnPeriod}
          placeholder={dashboard?.period_label}
          value={periodLabel}
          onChange={(event) => setPeriodLabel(event.target.value)}
          className="sm:w-56"
        />
      </div>

      {dashboard && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryTile
            variant="success"
            label={t.reports.compliance.summaryOnTime}
            value={dashboard.summary.submitted_on_time}
          />
          <SummaryTile variant="atrisk" label={t.reports.compliance.summaryLate} value={dashboard.summary.submitted_late} />
          <SummaryTile
            variant="neutral"
            label={t.reports.compliance.summaryPending}
            value={dashboard.summary.not_yet_submitted}
          />
        </div>
      )}

      <div className="mt-6">
        <Table
          columns={columns}
          data={missionsPage.pageItems}
          rowKey={(row) => row.mission_id}
          emptyMessage={t.reports.compliance.empty}
        />
        <Pagination
          meta={missionsPage.meta}
          onPageChange={missionsPage.setPage}
          onPerPageChange={missionsPage.setPerPage}
          className="mt-4"
        />
      </div>
    </div>
  )
}

const TILE_VARIANT_CLASSES: Record<'success' | 'atrisk' | 'neutral', string> = {
  success: 'border-success bg-success-soft text-success-soft-text',
  atrisk: 'border-atrisk bg-atrisk-soft text-atrisk-soft-text',
  neutral: 'border-border bg-section-bg text-text-secondary',
}

function SummaryTile({ variant, label, value }: { variant: 'success' | 'atrisk' | 'neutral'; label: string; value: number }) {
  return (
    <div className={`rounded-lg border p-4 ${TILE_VARIANT_CLASSES[variant]}`}>
      <p className="text-h2 font-bold">{value}</p>
      <p className="text-body-sm font-semibold">{label}</p>
    </div>
  )
}
