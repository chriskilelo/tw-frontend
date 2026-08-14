import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listMissions } from '../../api/missions'
import { getKpiComparison, getCurrentQuarter, listKpiActuals, type ComparisonKpiRow, type KpiActual } from '../../api/kpi'
import { KpiStatusBadge } from './KpiStatusBadge'
import { Input } from '../../components/Input'
import en from '../../i18n/en'

type Trend = 'up' | 'down' | 'flat' | 'none'

const TREND_LABEL: Record<Trend, string> = {
  up: en.kpi.dashboard.trendUp,
  down: en.kpi.dashboard.trendDown,
  flat: en.kpi.dashboard.trendFlat,
  none: en.kpi.dashboard.trendNone,
}

const TREND_CLASS: Record<Trend, string> = {
  up: 'text-success',
  down: 'text-danger',
  flat: 'text-text-muted',
  none: 'text-text-muted',
}

function TrendArrow({ trend }: { trend: Trend }) {
  if (trend === 'none') {
    return (
      <span className={`inline-flex items-center gap-1 text-caption ${TREND_CLASS[trend]}`}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{TREND_LABEL[trend]}</span>
      </span>
    )
  }

  const path = trend === 'up' ? 'M12 19V5m0 0-6 6m6-6 6 6' : trend === 'down' ? 'M12 5v14m0 0 6-6m-6 6-6-6' : 'M5 12h14'

  return (
    <span className={`inline-flex items-center gap-1 text-caption font-semibold ${TREND_CLASS[trend]}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
      <span className="sr-only">{TREND_LABEL[trend]}</span>
    </span>
  )
}

/**
 * FR-KPI-008. target/actual/status per KPI is sourced from GET /kpi-comparison, not
 * GET /kpi-actuals: KpiActualResource carries no target field and there is no
 * GET /kpi-targets endpoint, so a target value is only ever reachable through the
 * comparison matrix App\Services\KpiService::buildComparisonMatrix() already computes
 * (KpiPolicy::viewComparison() grants the same Ministry HQ Director / Ministry PS /
 * Acting PS roles this page targets). GET /kpi-actuals IS used, for the trend arrow —
 * the comparison matrix returns only a single cycle's value, so the two most recent
 * recorded periods for each KPI (from the actuals list, already sorted by
 * period_start_date desc) are compared to derive up/down/flat.
 */
export default function KpiDashboardPage() {
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [cycleLabel, setCycleLabel] = useState(() => getCurrentQuarter().label)

  const missionsQuery = useQuery({ queryKey: ['missions'], queryFn: listMissions })
  const missions = missionsQuery.data ?? []
  const effectiveMissionId = selectedMissionId ?? missions[0]?.id ?? null

  const comparisonQuery = useQuery({
    queryKey: ['kpi-comparison', cycleLabel],
    queryFn: () => getKpiComparison(cycleLabel),
    enabled: cycleLabel.trim() !== '',
  })

  const actualsQuery = useQuery({
    queryKey: ['kpi-actuals', 'dashboard', effectiveMissionId],
    queryFn: () => listKpiActuals({ mission_id: effectiveMissionId as string, per_page: 100 }),
    enabled: effectiveMissionId !== null,
  })

  const missionRow = comparisonQuery.data?.missions.find((row) => row.mission_id === effectiveMissionId)
  const trendByKpi = buildTrendMap(actualsQuery.data?.data ?? [])

  return (
    <div className="p-6" data-testid="kpi-dashboard-page">
      <h1 className="text-h1 text-primary">{en.kpi.dashboard.title}</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="kpi-dashboard-mission" className="text-body-sm font-semibold text-text-secondary">
            {en.kpi.dashboard.missionLabel}
          </label>
          <select
            id="kpi-dashboard-mission"
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            value={effectiveMissionId ?? ''}
            onChange={(event) => setSelectedMissionId(event.target.value)}
          >
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.name}
              </option>
            ))}
          </select>
        </div>

        <Input
          label={en.kpi.dashboard.cycleLabelLabel}
          value={cycleLabel}
          onChange={(event) => setCycleLabel(event.target.value)}
          className="sm:w-40"
        />
      </div>

      {missionRow && missionRow.kpis.length === 0 && (
        <p className="mt-6 text-body text-text-muted">{en.kpi.dashboard.empty}</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(missionRow?.kpis ?? []).map((kpi) => (
          <KpiCard key={kpi.kpi_definition_id} kpi={kpi} trend={trendByKpi.get(kpi.kpi_definition_id) ?? 'none'} />
        ))}
      </div>
    </div>
  )
}

function KpiCard({ kpi, trend }: { kpi: ComparisonKpiRow; trend: Trend }) {
  return (
    <div className="rounded-lg border border-border p-4" data-testid={`kpi-card-${kpi.kpi_definition_id}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-body font-semibold text-text-primary">{kpi.name}</h2>
        <KpiStatusBadge status={kpi.status} testId={`kpi-status-${kpi.kpi_definition_id}`} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <dt className="text-caption text-text-muted">{en.kpi.dashboard.actualLabel}</dt>
          <dd className="text-h3 font-bold text-text-primary">{kpi.actual ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">{en.kpi.dashboard.targetLabel}</dt>
          <dd className="text-h3 font-bold text-text-primary">{kpi.target ?? '—'}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <TrendArrow trend={trend} />
      </div>
    </div>
  )
}

function buildTrendMap(actuals: KpiActual[]): Map<string, Trend> {
  const byKpi = new Map<string, KpiActual[]>()

  for (const actual of actuals) {
    const kpiId = actual.kpi_definition?.id
    if (!kpiId) {
      continue
    }
    const existing = byKpi.get(kpiId) ?? []
    existing.push(actual)
    byKpi.set(kpiId, existing)
  }

  const trends = new Map<string, Trend>()

  for (const [kpiId, entries] of byKpi) {
    const sorted = [...entries].sort((a, b) => b.period_start_date.localeCompare(a.period_start_date))
    if (sorted.length < 2) {
      trends.set(kpiId, 'none')
      continue
    }
    const [latest, previous] = sorted
    if (latest.actual_value > previous.actual_value) {
      trends.set(kpiId, 'up')
    } else if (latest.actual_value < previous.actual_value) {
      trends.set(kpiId, 'down')
    } else {
      trends.set(kpiId, 'flat')
    }
  }

  return trends
}
