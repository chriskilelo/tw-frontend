import client, { type ApiEnvelope } from './client'

/** App\Services\KpiService::performanceStatus() — FR-KPI-008. Thresholds are a documented Sprint-0 default (>=100% on_track, >=75% at_risk, else below_target); no_target/no_data cover missing inputs. */
export type PerformanceStatus = 'on_track' | 'at_risk' | 'below_target' | 'no_target' | 'no_data'

export interface KpiMissionRef {
  id: string
  name: string
}

export interface KpiDefinitionRef {
  id: string
  name: string
}

export interface KpiUserRef {
  id: string
  full_name: string
}

/** GET/POST /kpi-actuals row shape — App\Http\Resources\KpiActualResource. No target field: there is no GET /kpi-targets endpoint, so a target value is never reachable from this resource. */
export interface KpiActual {
  id: string
  mission?: KpiMissionRef
  kpi_definition?: KpiDefinitionRef
  period_label: string
  period_start_date: string
  actual_value: number
  calculation_type: 'auto' | 'manual'
  entered_by?: KpiUserRef | null
  created_at: string
  updated_at: string
}

export interface KpiActualListMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export interface KpiActualListResponse {
  data: KpiActual[]
  meta: KpiActualListMeta
}

export interface KpiActualListFilters {
  mission_id?: string
  kpi_definition_id?: string
  period_label?: string
  page?: number
  per_page?: number
}

export interface RecordKpiActualRequest {
  kpi_definition_id: string
  mission_id: string
  period_label: string
  period_start_date: string
  actual_value: number
}

/** GET /kpi-actuals — FR-KPI-006/007. Open to any authenticated ministry-scoped user (KpiPolicy::viewAny()). */
export async function listKpiActuals(filters: KpiActualListFilters = {}): Promise<KpiActualListResponse> {
  const { data } = await client.get<KpiActualListResponse>('/kpi-actuals', { params: filters })
  return data
}

/** POST /kpi-actuals — FR-KPI-006/007. Ministry Attache / Ministry HQ Officer only (KpiPolicy::recordActual()). Upserts on (mission, kpi_definition, period_start_date) server-side, so re-recording an already-entered period edits it in place. */
export async function recordKpiActual(payload: RecordKpiActualRequest): Promise<KpiActual> {
  const { data } = await client.post<ApiEnvelope<KpiActual>>('/kpi-actuals', payload)
  return data.data
}

/** POST /kpi-targets response shape — App\Http\Resources\KpiTargetResource. */
export interface KpiTarget {
  id: string
  mission?: KpiMissionRef
  kpi_definition?: KpiDefinitionRef
  performance_cycle_label: string
  cycle_start_date: string
  target_value: number
  set_by?: KpiUserRef
  created_at: string
}

export interface SetKpiTargetRequest {
  kpi_definition_id: string
  mission_id: string
  performance_cycle_label: string
  cycle_start_date: string
  target_value: number
}

/** POST /kpi-targets — FR-KPI-004/005, BR-019. Ministry HQ Director / Ministry PS / Acting PS only (KpiPolicy::setTarget()). Always inserts a new versioned row; never overwrites a prior cycle's target. */
export async function setKpiTarget(payload: SetKpiTargetRequest): Promise<KpiTarget> {
  const { data } = await client.post<ApiEnvelope<KpiTarget>>('/kpi-targets', payload)
  return data.data
}

/** One KPI's target/actual/status for one mission and cycle — App\Services\KpiService::kpiTargetVsActual(). */
export interface ComparisonKpiRow {
  kpi_definition_id: string
  name: string
  target: number | null
  actual: number | null
  status: PerformanceStatus
}

export interface ComparisonMissionRow {
  mission_id: string
  mission_name: string
  kpis: ComparisonKpiRow[]
}

/** GET /kpi-comparison response — App\Services\KpiService::buildComparisonMatrix(), FR-KPI-013. */
export interface KpiComparisonMatrix {
  cycle_label: string
  missions: ComparisonMissionRow[]
}

/**
 * GET /kpi-comparison — FR-KPI-013. Ministry HQ Director / Ministry PS / Acting PS only
 * (KpiPolicy::viewComparison()). cycle_label accepts either a quarterly ("Q1 2027") or
 * half-yearly ("H1 2027") label. This is also the only reachable source of target-vs-actual
 * data for these roles (KpiActualResource carries no target field, and GET /kpi-targets
 * does not exist), so KpiDashboardPage sources its per-KPI target/actual/status from here,
 * filtered client-side to one selected mission, rather than from GET /kpi-actuals alone.
 */
export async function getKpiComparison(cycleLabel: string): Promise<KpiComparisonMatrix> {
  const { data } = await client.get<ApiEnvelope<KpiComparisonMatrix>>('/kpi-comparison', {
    params: { cycle_label: cycleLabel },
  })
  return data.data
}

/**
 * CLAUDE.md Section 8's fixed fiscal calendar (Q1 Jul-Sep .. Q4 Apr-Jun), mirroring
 * App\Services\KpiService's private quarterStart()/quarterLabel() mapping exactly (label
 * year = the quarter's own start-month calendar year) — there is no endpoint that exposes
 * "the current quarter" to every role that needs one client-side (ReportService::
 * currentSubmissionPeriod() is not reachable by every KPI-engine role), so this is computed
 * locally instead.
 */
export function getCurrentQuarter(referenceDate: Date = new Date()): { label: string; startDate: string } {
  const month = referenceDate.getMonth() + 1
  const year = referenceDate.getFullYear()

  let quarterNumber: number
  let quarterStartMonth: number

  if (month >= 7 && month <= 9) {
    quarterNumber = 1
    quarterStartMonth = 7
  } else if (month >= 10 && month <= 12) {
    quarterNumber = 2
    quarterStartMonth = 10
  } else if (month >= 1 && month <= 3) {
    quarterNumber = 3
    quarterStartMonth = 1
  } else {
    quarterNumber = 4
    quarterStartMonth = 4
  }

  return {
    label: `Q${quarterNumber} ${year}`,
    startDate: `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`,
  }
}
