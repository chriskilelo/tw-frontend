import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getHrmdDashboard, getHrmdAttacheSummary } from '../../api/sdt'
import { getCurrentQuarter, type ComparisonMissionRow } from '../../api/kpi'
import { KpiStatusBadge } from '../kpi/KpiStatusBadge'
import { Table, type TableColumn } from '../../components/Table'
import { Badge } from '../../components/Badge'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import en from '../../i18n/en'

interface DrillDownRequest {
  userId: string
  periodLabel: string
}

/**
 * FR-SDT-016, FR-SDT-017, FR-KPI-011. HRM&D Officer only (KpiPolicy::viewHrmdDashboard()/
 * generateAttacheSummary()); every access is audit-logged server-side
 * (App\Services\KpiService::hrmdDashboard()/attachePerformanceSummary()). Read-only per
 * UI-006 — this page has no mutation of any kind, so there is nothing to gate beyond
 * relying on the backend policy to reject anyone else.
 *
 * The drill-down takes a free-text attache User ID rather than a picker: no endpoint
 * reachable by this role lists ministry attaches (GET /users is System Administrator
 * only), mirroring the same free-text-plus-hint fallback used elsewhere in this codebase
 * (e.g. the alert delegate picker, Session 21).
 */
export default function HrmdDashboardPage() {
  const [cycleLabel, setCycleLabel] = useState(() => getCurrentQuarter().label)

  const dashboardQuery = useQuery({
    queryKey: ['sdt', 'hrmd-dashboard', cycleLabel],
    queryFn: () => getHrmdDashboard(cycleLabel),
    enabled: cycleLabel.trim() !== '',
  })

  const [drillDownUserId, setDrillDownUserId] = useState('')
  const [drillDownPeriodLabel, setDrillDownPeriodLabel] = useState(() => getCurrentQuarter().label)
  const [activeDrillDown, setActiveDrillDown] = useState<DrillDownRequest | null>(null)

  const summaryQuery = useQuery({
    queryKey: ['sdt', 'hrmd-dashboard', 'summary', activeDrillDown?.userId, activeDrillDown?.periodLabel],
    queryFn: () => getHrmdAttacheSummary(activeDrillDown!.userId, activeDrillDown!.periodLabel),
    enabled: activeDrillDown !== null,
  })

  function handleDrillDownSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (drillDownUserId.trim() === '' || drillDownPeriodLabel.trim() === '') {
      return
    }
    setActiveDrillDown({ userId: drillDownUserId.trim(), periodLabel: drillDownPeriodLabel.trim() })
  }

  const missions = dashboardQuery.data?.missions ?? []
  const kpiColumns = missions[0]?.kpis ?? []

  const columns: TableColumn<ComparisonMissionRow>[] = [
    { key: 'mission_name', header: en.sdt.hrmdDashboard.columnMission, render: (row) => row.mission_name },
    ...kpiColumns.map(
      (kpiColumn): TableColumn<ComparisonMissionRow> => ({
        key: kpiColumn.kpi_definition_id,
        header: kpiColumn.name,
        render: (row) => {
          const cell = row.kpis.find((kpi) => kpi.kpi_definition_id === kpiColumn.kpi_definition_id)
          if (!cell) {
            return '—'
          }
          return (
            <div className="flex flex-col items-start gap-1">
              <span className="font-mono text-body-sm">{cell.actual ?? '—'}</span>
              <KpiStatusBadge status={cell.status} />
            </div>
          )
        },
      }),
    ),
  ]

  return (
    <div className="p-6" data-testid="hrmd-dashboard-page">
      <h1 className="text-h1 text-primary">{en.sdt.hrmdDashboard.title}</h1>
      <Badge variant="neutral" label={en.common.readOnly} className="mt-2" />

      <div className="mt-4">
        <Input
          label={en.sdt.hrmdDashboard.cycleLabelLabel}
          value={cycleLabel}
          onChange={(event) => setCycleLabel(event.target.value)}
          className="sm:w-40"
        />
      </div>

      <div className="mt-6">
        <Table columns={columns} data={missions} rowKey={(row) => row.mission_id} emptyMessage={en.sdt.hrmdDashboard.empty} />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{en.sdt.hrmdDashboard.drillDownTitle}</h2>
        <form onSubmit={handleDrillDownSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label={en.sdt.hrmdDashboard.userIdLabel}
            required
            value={drillDownUserId}
            onChange={(event) => setDrillDownUserId(event.target.value)}
          />
          <p className="text-caption text-text-muted">{en.sdt.hrmdDashboard.userIdHint}</p>

          <Input
            label={en.sdt.hrmdDashboard.periodLabelLabel}
            required
            value={drillDownPeriodLabel}
            onChange={(event) => setDrillDownPeriodLabel(event.target.value)}
          />

          <div>
            <Button type="submit">{en.sdt.hrmdDashboard.viewSummaryButton}</Button>
          </div>
        </form>

        {activeDrillDown && (
          <div className="mt-6">
            {summaryQuery.data ? (
              <>
                <p className="text-body font-semibold text-text-primary">
                  {summaryQuery.data.attache.full_name} — {summaryQuery.data.attache.mission.name}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {summaryQuery.data.kpis.map((kpi) => (
                    <div key={kpi.kpi_definition_id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-text-primary">{kpi.name}</span>
                        <KpiStatusBadge status={kpi.status} />
                      </div>
                      <p className="mt-1 text-caption text-text-muted">
                        {en.kpi.dashboard.actualLabel}: {kpi.actual ?? '—'} · {en.kpi.dashboard.targetLabel}: {kpi.target ?? '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-body text-text-muted">{en.sdt.hrmdDashboard.summaryEmpty}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
