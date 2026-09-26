import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getKpiComparison, getCurrentQuarter, type ComparisonMissionRow } from '../../api/kpi'
import { KpiStatusBadge } from './KpiStatusBadge'
import { Table, type TableColumn } from '../../components/Table'
import { Input } from '../../components/Input'
import { Pagination } from '../../components/Pagination'
import { useClientPagination } from '../../hooks/useClientPagination'
import { useI18n } from '../../i18n/context'

/**
 * FR-KPI-013: cross-mission comparison matrix. Ministry HQ Director / Ministry PS /
 * Acting PS only (KpiPolicy::viewComparison()). Columns are built from the first
 * mission row's KPI list — App\Services\KpiService::buildComparisonMatrix() evaluates
 * the same active-KPI-definitions set against every mission in the ministry, so every
 * row shares an identical, same-ordered KPI column set.
 */
export default function KpiComparisonPage() {
  const { t } = useI18n()
  const [cycleLabel, setCycleLabel] = useState(() => getCurrentQuarter().label)

  const comparisonQuery = useQuery({
    queryKey: ['kpi-comparison', 'matrix', cycleLabel],
    queryFn: () => getKpiComparison(cycleLabel),
    enabled: cycleLabel.trim() !== '',
  })

  const missions = comparisonQuery.data?.missions ?? []
  const kpiColumns = missions[0]?.kpis ?? []
  const missionsPage = useClientPagination(missions)

  const columns: TableColumn<ComparisonMissionRow>[] = [
    { key: 'mission_name', header: t.kpi.comparison.columnMission, render: (row) => row.mission_name },
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
      <h1 className="text-h1 text-primary">{t.kpi.comparison.title}</h1>

      <div className="mt-4">
        <Input
          label={t.kpi.comparison.cycleLabelLabel}
          value={cycleLabel}
          onChange={(event) => setCycleLabel(event.target.value)}
          className="sm:w-40"
        />
      </div>

      <div className="mt-6">
        <Table
          columns={columns}
          data={missionsPage.pageItems}
          rowKey={(row) => row.mission_id}
          emptyMessage={t.kpi.comparison.empty}
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
