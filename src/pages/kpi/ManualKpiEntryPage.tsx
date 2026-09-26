import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { listMissions } from '../../api/missions'
import { getCurrentQuarter, listKpiActuals, recordKpiActual, type KpiActual } from '../../api/kpi'
import { Table, type TableColumn } from '../../components/Table'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { Pagination, DEFAULT_PER_PAGE } from '../../components/Pagination'
import { useI18n } from '../../i18n/context'

/**
 * FR-KPI-006, FR-KPI-007. Ministry Attache / Ministry HQ Officer only
 * (KpiPolicy::recordActual()). There is no endpoint reachable by either role that lists
 * "the manual KPIs assigned to this mission" — GET /kpi-definitions and GET /kpi-profiles
 * are both System-Administrator-only (KpiPolicy::manageDefinitions()/manageProfiles()),
 * and GET /kpi-comparison (which does expose a KPI id/name catalogue) is restricted to
 * Ministry HQ Director/PS/Acting PS. Mirrors the free-text-id-plus-hint fallback already
 * established for other unreachable-catalogue cases in this codebase (e.g. the alert
 * delegate picker, Session 21): a KPI Definition ID is entered directly. Actuals already
 * recorded for the current mission+period (from GET /kpi-actuals, which IS open to any
 * authenticated ministry-scoped user) are listed below by name and editable in place —
 * recordActual() upserts on (mission, kpi_definition, period_start_date) server-side.
 */
export default function ManualKpiEntryPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const ownMissionId = user?.mission_id ?? null
  const missionsQuery = useQuery({ queryKey: ['missions'], queryFn: listMissions, enabled: ownMissionId === null })
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const effectiveMissionId = ownMissionId ?? selectedMissionId ?? missionsQuery.data?.[0]?.id ?? null

  const currentQuarter = getCurrentQuarter()
  const [periodLabel, setPeriodLabel] = useState(currentQuarter.label)
  const [periodStartDate, setPeriodStartDate] = useState(currentQuarter.startDate)

  const [kpiDefinitionId, setKpiDefinitionId] = useState('')
  const [actualValue, setActualValue] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)

  useEffect(() => {
    setPage(1)
  }, [effectiveMissionId, periodLabel, perPage])

  const actualsQuery = useQuery({
    queryKey: ['kpi-actuals', 'manual-entry', effectiveMissionId, periodLabel, page, perPage],
    queryFn: () =>
      listKpiActuals({
        mission_id: effectiveMissionId as string,
        period_label: periodLabel,
        page,
        per_page: perPage,
      }),
    enabled: effectiveMissionId !== null && periodLabel.trim() !== '',
  })

  const recordMutation = useMutation({
    mutationFn: () =>
      recordKpiActual({
        kpi_definition_id: kpiDefinitionId,
        mission_id: effectiveMissionId as string,
        period_label: periodLabel,
        period_start_date: periodStartDate,
        actual_value: Number(actualValue),
      }),
    onSuccess: () => {
      setKpiDefinitionId('')
      setActualValue('')
      queryClient.invalidateQueries({ queryKey: ['kpi-actuals', 'manual-entry', effectiveMissionId, periodLabel] })
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (effectiveMissionId === null) {
      return
    }
    recordMutation.mutate()
  }

  function startEdit(actual: KpiActual) {
    if (!actual.kpi_definition) {
      return
    }
    setKpiDefinitionId(actual.kpi_definition.id)
    setActualValue(String(actual.actual_value))
  }

  const columns: TableColumn<KpiActual>[] = [
    { key: 'kpi', header: t.kpi.manualEntry.columnKpi, render: (row) => row.kpi_definition?.name ?? row.id },
    { key: 'period', header: t.kpi.manualEntry.columnPeriod, render: (row) => row.period_label },
    {
      key: 'actual',
      header: t.kpi.manualEntry.columnActual,
      render: (row) => <span className="font-mono">{row.actual_value}</span>,
    },
    { key: 'entered_by', header: t.kpi.manualEntry.columnEnteredBy, render: (row) => row.entered_by?.full_name ?? '—' },
    {
      key: 'actions',
      header: t.common.actions,
      render: (row) => (
        <Button variant="secondary" onClick={() => startEdit(row)}>
          {t.kpi.manualEntry.editButton}
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6" data-testid="manual-kpi-entry-page">
      <h1 className="text-h1 text-primary">{t.kpi.manualEntry.title}</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {ownMissionId === null && (
          <div className="flex flex-col gap-1">
            <label htmlFor="manual-kpi-mission" className="text-body-sm font-semibold text-text-secondary">
              {t.kpi.dashboard.missionLabel}
            </label>
            <select
              id="manual-kpi-mission"
              className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              value={effectiveMissionId ?? ''}
              onChange={(event) => setSelectedMissionId(event.target.value)}
            >
              {(missionsQuery.data ?? []).map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <Input
          label={t.kpi.manualEntry.periodLabelLabel}
          value={periodLabel}
          onChange={(event) => setPeriodLabel(event.target.value)}
          className="sm:w-40"
        />
        <Input
          type="date"
          label={t.kpi.manualEntry.periodStartLabel}
          value={periodStartDate}
          onChange={(event) => setPeriodStartDate(event.target.value)}
          className="sm:w-48"
        />
      </div>

      <div className="mt-6">
        <Table
          columns={columns}
          data={actualsQuery.data?.data ?? []}
          rowKey={(row) => row.id}
          emptyMessage={t.kpi.manualEntry.empty}
        />
        {actualsQuery.data?.meta && (
          <Pagination meta={actualsQuery.data.meta} onPageChange={setPage} onPerPageChange={setPerPage} className="mt-4" />
        )}
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{t.kpi.manualEntry.recordButton}</h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label={t.kpi.manualEntry.kpiDefinitionIdLabel}
            required
            value={kpiDefinitionId}
            onChange={(event) => setKpiDefinitionId(event.target.value)}
          />
          <p className="text-caption text-text-muted">{t.kpi.manualEntry.kpiDefinitionIdHint}</p>

          <Input
            type="number"
            step="any"
            label={t.kpi.manualEntry.actualValueLabel}
            required
            value={actualValue}
            onChange={(event) => setActualValue(event.target.value)}
          />

          {recordMutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}
          {recordMutation.isSuccess && <p className="text-body-sm text-success-soft-text">{t.kpi.manualEntry.successMessage}</p>}

          <div>
            <Button type="submit" disabled={recordMutation.isPending || effectiveMissionId === null}>
              {t.kpi.manualEntry.recordButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
