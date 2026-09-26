import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { listMissions } from '../../api/missions'
import { getKpiComparison, getCurrentQuarter, setKpiTarget } from '../../api/kpi'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { useI18n } from '../../i18n/context'

/**
 * FR-KPI-004, FR-KPI-005, BR-019. Ministry HQ Director / Ministry PS / Acting PS only
 * (KpiPolicy::setTarget()). Same "no reachable KPI catalogue" gap ManualKpiEntryPage
 * documents, except this role IS one of the roles KpiPolicy::viewComparison() allows —
 * so the current cycle's GET /kpi-comparison call (already needed for KpiComparisonPage)
 * is reused purely to enumerate this ministry's active KPI id/name pairs, discarding its
 * target/actual/status values, rather than duplicating a listing call that doesn't exist.
 * There is no GET /kpi-targets endpoint, so previously-set targets cannot be listed here —
 * BR-019 versioning means POSTing again for the same KPI+mission+cycle would only ever be
 * additive (a new row), never a destructive overwrite, so this is a set-only form.
 */
export default function SetKpiTargetsPage() {
  const { t } = useI18n()
  const missionsQuery = useQuery({ queryKey: ['missions'], queryFn: listMissions })
  const catalogueQuery = useQuery({
    queryKey: ['kpi-comparison', 'catalogue'],
    queryFn: () => getKpiComparison(getCurrentQuarter().label),
  })

  const missions = missionsQuery.data ?? []
  const kpiOptions = catalogueQuery.data?.missions[0]?.kpis ?? []

  const [missionId, setMissionId] = useState('')
  const [kpiDefinitionId, setKpiDefinitionId] = useState('')
  const [cycleLabel, setCycleLabel] = useState('')
  const [cycleStartDate, setCycleStartDate] = useState('')
  const [targetValue, setTargetValue] = useState('')

  const effectiveMissionId = missionId || missions[0]?.id || ''
  const effectiveKpiDefinitionId = kpiDefinitionId || kpiOptions[0]?.kpi_definition_id || ''

  const setTargetMutation = useMutation({
    mutationFn: () =>
      setKpiTarget({
        mission_id: effectiveMissionId,
        kpi_definition_id: effectiveKpiDefinitionId,
        performance_cycle_label: cycleLabel,
        cycle_start_date: cycleStartDate,
        target_value: Number(targetValue),
      }),
    onSuccess: () => {
      setCycleLabel('')
      setCycleStartDate('')
      setTargetValue('')
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!effectiveMissionId || !effectiveKpiDefinitionId) {
      return
    }
    setTargetMutation.mutate()
  }

  return (
    <div className="p-6" data-testid="set-kpi-targets-page">
      <h1 className="text-h1 text-primary">{t.kpi.setTargets.title}</h1>
      <p className="mt-2 text-caption text-text-muted">{t.kpi.setTargets.catalogueHint}</p>

      {kpiOptions.length === 0 && !catalogueQuery.isLoading ? (
        <p className="mt-6 text-body text-text-muted">{t.kpi.setTargets.empty}</p>
      ) : (
        <div className="mt-6 max-w-lg rounded-lg border border-border p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="set-target-mission" className="text-body-sm font-semibold text-text-secondary">
                {t.kpi.setTargets.missionLabel}
              </label>
              <select
                id="set-target-mission"
                className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                value={effectiveMissionId}
                onChange={(event) => setMissionId(event.target.value)}
              >
                {missions.map((mission) => (
                  <option key={mission.id} value={mission.id}>
                    {mission.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="set-target-kpi" className="text-body-sm font-semibold text-text-secondary">
                {t.kpi.setTargets.kpiLabel}
              </label>
              <select
                id="set-target-kpi"
                className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                value={effectiveKpiDefinitionId}
                onChange={(event) => setKpiDefinitionId(event.target.value)}
              >
                {kpiOptions.map((kpi) => (
                  <option key={kpi.kpi_definition_id} value={kpi.kpi_definition_id}>
                    {kpi.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label={t.kpi.setTargets.cycleLabelLabel}
              placeholder="Q2 2027"
              required
              value={cycleLabel}
              onChange={(event) => setCycleLabel(event.target.value)}
            />
            <Input
              type="date"
              label={t.kpi.setTargets.cycleStartLabel}
              required
              value={cycleStartDate}
              onChange={(event) => setCycleStartDate(event.target.value)}
            />
            <Input
              type="number"
              step="any"
              label={t.kpi.setTargets.targetValueLabel}
              required
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
            />

            {setTargetMutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}
            {setTargetMutation.isSuccess && (
              <p className="text-body-sm text-success-soft-text">{t.kpi.setTargets.successMessage}</p>
            )}

            <div>
              <Button type="submit" disabled={setTargetMutation.isPending || !effectiveMissionId || !effectiveKpiDefinitionId}>
                {t.kpi.setTargets.setButton}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
