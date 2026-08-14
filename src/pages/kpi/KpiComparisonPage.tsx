import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getKpiComparison, getCurrentQuarter, type ComparisonMissionRow } from '../../api/kpi'
import { KpiStatusBadge } from './KpiStatusBadge'
import { Table, type TableColumn } from '../../components/Table'
import { Input } from '../../components/Input'
import en from '../../i18n/en'

/**
 * FR-KPI-013: cross-mission comparison matrix. Ministry HQ Director / Ministry PS /
 * Acting PS only (KpiPolicy::viewComparison()). Columns are built from the first
 * mission row's KPI list — App\Services\KpiService::buildComparisonMatrix() evaluates
 * the same active-KPI-definitions set against every mission in the ministry, so every
 * row shares an identical, same-ordered KPI column set.
 */
export default function KpiComparisonPage() {
  const [cycleLabel, setCycleLabel] = useState(() => getCurrentQuarter().label)

  const comparisonQuery = useQuery({
    queryKey: ['kpi-comparison', 'matrix', cycleLabel],
    queryFn: () => getKpiComparison(cycleLabel),
    enabled: cycleLabel.trim() !== '',
  })

  const missions = comparisonQuery.data?.missions ?? []
  const kpiColumns = missions[0]?.kpis ?? []

  const columns: TableColumn<ComparisonMissionRow>[] = [
    { key: 'mission_name', header: en.kpi.comparison.columnMission, render: (row) => row.mission_name },
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
              <KpiStatusBadge status={cell.status} testId={`kpi-comparison-status-${row.mission_id}-${kpiColumn.kpi_definition_id}`} />
            </div>
          )
        },
      }),
    ),
  ]

  return (
    <div className="p-6" data-testid="kpi-comparison-page">
      <h1 className="text-h1 text-primary">{en.kpi.comparison.title}</h1>

      <div className="mt-4">
        <Input
          label={en.kpi.comparison.cycleLabelLabel}
          value={cycleLabel}
          onChange={(event) => setCycleLabel(event.target.value)}
          className="sm:w-40"
        />
      </div>

      <div className="mt-6">
        <Table columns={columns} data={missions} rowKey={(row) => row.mission_id} emptyMessage={en.kpi.comparison.empty} />
      </div>
    </div>
  )
}
