import client, { type ApiEnvelope } from './client'

/**
 * App\Services\KpiPerformanceService statuses (FR-KPI-008). on_track / at_risk / below_target
 * compare the actual with the target expected by now against the configured thresholds;
 * pending means no quarter of the period has passed its reporting deadline yet (too early to
 * judge); no_data and no_target cover missing inputs.
 */
export type PerformanceStatus = 'on_track' | 'at_risk' | 'below_target' | 'pending' | 'no_data' | 'no_target'

export const PERFORMANCE_STATUSES: PerformanceStatus[] = ['on_track', 'at_risk', 'below_target', 'pending', 'no_data', 'no_target']

/** The three statuses that pass a judgement on performance. */
export const JUDGED_STATUSES: PerformanceStatus[] = ['on_track', 'at_risk', 'below_target']

export type KpiPeriodType = 'quarter' | 'half' | 'range'
export type KpiPeriodPhase = 'complete' | 'in_progress' | 'upcoming'

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

export interface KpiMissionOption {
  id: string
  name: string
  city: string | null
  host_country: string | null
}

/** A period as App\Support\KpiPeriod::toArray() describes it. */
export interface KpiPeriodInfo {
  type: KpiPeriodType
  label: string
  start: string
  end: string
  phase: KpiPeriodPhase
  /** Share of the period's quarters past their reporting deadline: the share of the target expected by now. */
  progress: number
  is_final: boolean
  completed_quarters: number
  settled_quarters: number
  quarter_count: number
  quarters: { label: string; start: string; end: string; deadline: string; phase: KpiPeriodPhase; settled: boolean }[]
}

export interface KpiPeriodRef {
  label: string
  type: KpiPeriodType
  start: string
  end: string
  phase: KpiPeriodPhase
}

export interface KpiPeriodOptions {
  default: string
  quarters: KpiPeriodRef[]
  halves: KpiPeriodRef[]
  range: { max_quarters: number; latest_end: string }
}

export interface KpiThresholds {
  on_track: number
  at_risk: number
}

/** A period request: a quarter or half-year label, or a custom range of whole quarters (FR-KPI-009). */
export interface KpiPeriodQuery {
  period?: string
  from?: string
  to?: string
}

export interface KpiMeta {
  id: string
  name: string
  description: string | null
  unit: string | null
  calculation_method: 'auto' | 'manual'
  data_source: string | null
  /** live: counted from engine data as the page loads (FR-KPI-006); recorded: read from kpi_actuals. */
  source: 'live' | 'recorded'
}

export interface KpiQuarterValue {
  label: string
  start: string
  end: string
  actual: number | null
  target: number | null
}

export type KpiTargetSource = 'mission' | 'profile' | 'mixed'

/** KpiPerformanceService::measure() — one KPI's numbers for one period. */
export interface KpiMeasure {
  target: number | null
  actual: number | null
  expected: number | null
  attainment: number | null
  variance: number | null
  /** Actual over the target expected by now — the ratio the status judges. */
  performance: number | null
  status: PerformanceStatus
  target_source: KpiTargetSource | null
  quarters_reported: number
  quarters: KpiQuarterValue[]
}

export interface KpiChange {
  previous_actual: number | null
  change: number | null
  change_pct: number | null
}

export interface KpiStatusSummary {
  counts: Record<PerformanceStatus, number>
  total: number
  judged: number
  /** Mean of each judged KPI's performance, capped at 100%. */
  score: number | null
}

export interface DashboardKpiRow extends KpiMeta, KpiMeasure, KpiChange {
  kpi_definition_id: string
  applicable?: boolean
  previous: { target: number | null; actual: number | null; status: PerformanceStatus; attainment: number | null }
  trend: KpiQuarterValue[]
  /** Department view only. */
  actual_all?: number | null
  missions_applicable?: number
  missions_with_target?: number
  distribution?: Record<PerformanceStatus, number>
}

export type KpiComplianceStatus = 'submitted_on_time' | 'submitted_late' | 'draft_in_progress' | 'not_started' | 'not_due'

export interface KpiComplianceQuarter {
  label: string
  start: string
  end: string
  deadline: string
  status: KpiComplianceStatus
  is_overdue: boolean
  submitted_at: string | null
  report_id: string | null
}

export interface KpiMissionHealth extends KpiStatusSummary {
  mission_id: string
  mission_name: string
  city: string | null
  host_country: string | null
}

export interface KpiDashboardCapabilities {
  choose_mission: boolean
  set_targets: boolean
  compare: boolean
  download_report: boolean
  record_actuals: boolean
}

/** GET /kpi-dashboard — FR-KPI-008 to 011, 016. */
export interface KpiDashboard {
  scope: 'mission' | 'ministry'
  period: KpiPeriodInfo
  previous_period: KpiPeriodRef
  thresholds: KpiThresholds
  mission: {
    id: string
    name: string
    city: string | null
    host_country: string | null
    attache: KpiUserRef | null
    profiles: KpiMissionRef[]
  } | null
  summary: KpiStatusSummary
  kpis: DashboardKpiRow[]
  compliance: KpiComplianceQuarter[] | null
  missions?: KpiMissionHealth[]
  options: KpiPeriodOptions
  missions_available: KpiMissionOption[]
  can: KpiDashboardCapabilities
}

export async function getKpiDashboard(query: KpiPeriodQuery & { mission_id?: string }): Promise<KpiDashboard> {
  const { data } = await client.get<ApiEnvelope<KpiDashboard>>('/kpi-dashboard', { params: compact(query) })
  return data.data
}

/** One mission x KPI cell of the comparison matrix. */
export interface ComparisonKpiRow extends KpiMeasure, Partial<KpiChange> {
  kpi_definition_id: string
  name: string
  applicable?: boolean
  previous_status?: PerformanceStatus
}

export interface ComparisonMissionRow {
  mission_id: string
  mission_name: string
  city?: string | null
  host_country?: string | null
  profiles?: KpiMissionRef[]
  summary?: KpiStatusSummary
  kpis: ComparisonKpiRow[]
}

export interface ComparisonKpiColumn extends KpiMeta {
  total: KpiMeasure & {
    actual_all: number | null
    missions_applicable: number
    missions_with_target: number
    distribution: Record<PerformanceStatus, number>
    previous_actual: number | null
  }
}

/** GET /kpi-comparison — FR-KPI-013. Also the shape of the HRM&D dashboard (without options/can). */
export interface KpiComparisonMatrix {
  cycle_label: string
  period?: KpiPeriodInfo
  previous_period?: KpiPeriodRef
  thresholds?: KpiThresholds
  kpis?: ComparisonKpiColumn[]
  missions: ComparisonMissionRow[]
  summary?: KpiStatusSummary
  options?: KpiPeriodOptions
  can?: { set_targets: boolean; download_report: boolean }
}

export async function getKpiComparison(query: KpiPeriodQuery): Promise<KpiComparisonMatrix> {
  const { data } = await client.get<ApiEnvelope<KpiComparisonMatrix>>('/kpi-comparison', { params: compact(query) })
  return data.data
}

// --- Targets (FR-KPI-003 to 005) ----------------------------------------------

export interface KpiTargetVersionRef {
  value: number
  note: string | null
  set_by: KpiUserRef | null
  set_at: string | null
  versions?: number
}

export interface KpiTargetCell {
  applicable: boolean
  value: number | null
  source: 'mission' | 'profile' | null
  override: KpiTargetVersionRef | null
  profile_default: { value: number; profile: KpiMissionRef } | null
  previous: { target: number | null; actual: number | null; status: PerformanceStatus }
}

export interface KpiTargetPlanMission {
  id: string
  name: string
  city: string | null
  host_country: string | null
  attache: KpiUserRef | null
  profiles: KpiMissionRef[]
  missing: number
  targets: Record<string, KpiTargetCell>
}

export interface KpiTargetPlanProfile {
  id: string
  name: string
  kpi_ids: string[]
  mission_ids: string[]
  defaults: Record<string, KpiTargetVersionRef>
}

export type KpiCycleLockReason = 'ended' | 'beyond_horizon' | 'not_a_cycle'

export interface KpiTargetCycle extends KpiPeriodRef {
  editable: boolean
  reason: KpiCycleLockReason | null
}

/** GET /kpi-targets/plan — the target planner for one half-yearly cycle. */
export interface KpiTargetPlan {
  cycle: KpiTargetCycle
  previous_cycle: KpiPeriodRef
  cycles: KpiTargetCycle[]
  thresholds: KpiThresholds
  kpis: KpiMeta[]
  profiles: KpiTargetPlanProfile[]
  missions: KpiTargetPlanMission[]
  summary: { required: number; set: number; missing: number; overrides: number; from_profile: number; missions_complete: number }
  can: { set_targets: boolean }
}

export async function getKpiTargetPlan(cycleLabel?: string): Promise<KpiTargetPlan> {
  const { data } = await client.get<ApiEnvelope<KpiTargetPlan>>('/kpi-targets/plan', {
    params: cycleLabel ? { cycle_label: cycleLabel } : undefined,
  })
  return data.data
}

export interface KpiTargetEntry {
  kpi_definition_id: string
  mission_id?: string
  kpi_profile_id?: string
  target_value: number
}

export interface SaveKpiTargetsResult {
  saved: number
  unchanged: number
  plan: KpiTargetPlan
}

/** POST /kpi-targets/batch — saves the planner's edits as new versions, all or nothing (BR-019). */
export async function saveKpiTargets(payload: { performance_cycle_label: string; note?: string; targets: KpiTargetEntry[] }): Promise<SaveKpiTargetsResult> {
  const { data } = await client.post<ApiEnvelope<SaveKpiTargetsResult>>('/kpi-targets/batch', payload)
  return data.data
}

/** POST /kpi-targets response shape — App\Http\Resources\KpiTargetResource. */
export interface KpiTarget {
  id: string
  scope: 'mission' | 'profile'
  mission?: KpiMissionRef
  kpi_profile?: KpiMissionRef
  kpi_definition?: KpiDefinitionRef
  performance_cycle_label: string
  cycle_start_date: string
  target_value: number | string
  note: string | null
  set_by?: KpiUserRef
  created_at: string
}

export interface SetKpiTargetRequest {
  kpi_definition_id: string
  mission_id?: string
  kpi_profile_id?: string
  performance_cycle_label: string
  target_value: number
  note?: string
}

/** POST /kpi-targets — one target version (FR-KPI-005). */
export async function setKpiTarget(payload: SetKpiTargetRequest): Promise<KpiTarget> {
  const { data } = await client.post<ApiEnvelope<KpiTarget>>('/kpi-targets', payload)
  return data.data
}

export interface KpiTargetHistoryEntry extends KpiTargetVersionRef {
  id: string
  cycle_label: string
  cycle_start_date: string | null
  in_force: boolean
}

/** GET /kpi-targets/history — every version of one target across cycles (FR-KPI-004). */
export async function getKpiTargetHistory(params: { kpi_definition_id: string; mission_id?: string; kpi_profile_id?: string }): Promise<KpiTargetHistoryEntry[]> {
  const { data } = await client.get<ApiEnvelope<KpiTargetHistoryEntry[]>>('/kpi-targets/history', { params: compact(params) })
  return data.data
}

// --- Actuals (FR-KPI-006, 007) -----------------------------------------------

/** GET/POST /kpi-actuals row shape — App\Http\Resources\KpiActualResource. */
export interface KpiActual {
  id: string
  mission?: KpiMissionRef
  kpi_definition?: KpiDefinitionRef
  period_label: string
  period_start_date: string
  actual_value: number | string
  calculation_type: 'auto' | 'manual'
  entered_by?: KpiUserRef | null
  created_at: string
  updated_at: string
}

export interface RecordKpiActualRequest {
  kpi_definition_id: string
  mission_id: string
  period_label: string
  actual_value: number
}

/** POST /kpi-actuals — FR-KPI-007. Upserts on (mission, KPI, quarter). */
export async function recordKpiActual(payload: RecordKpiActualRequest): Promise<KpiActual> {
  const { data } = await client.post<ApiEnvelope<KpiActual>>('/kpi-actuals', payload)
  return data.data
}

export interface KpiEntryRow extends KpiMeta {
  recordable: boolean
  value: number | null
  quarter_target: number | null
  entered_by: KpiUserRef | null
  updated_at: string | null
}

/** GET /kpi-actuals/entry — the manual entry screen for one mission and quarter. */
export interface KpiActualEntry {
  quarter: KpiPeriodRef
  quarters: KpiPeriodRef[]
  mission: KpiMissionOption
  kpis: KpiEntryRow[]
  missions_available: KpiMissionOption[]
}

export async function getKpiActualEntry(params: { mission_id?: string; period_label?: string }): Promise<KpiActualEntry> {
  const { data } = await client.get<ApiEnvelope<KpiActualEntry>>('/kpi-actuals/entry', { params: compact(params) })
  return data.data
}

// --- Report (FR-KPI-015) -----------------------------------------------------

/**
 * GET /kpi-reports/{missionId|all} — downloads the CSV performance report for a quarter or
 * half-year through the authenticated client (the session cookie must travel with it).
 */
export async function downloadKpiReport(missionId: string | 'all', periodLabel: string): Promise<void> {
  const response = await client.get<Blob>(`/kpi-reports/${missionId}`, { params: { period: periodLabel }, responseType: 'blob' })
  const disposition = String(response.headers['content-disposition'] ?? '')
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `kpi-performance-${periodLabel.replace(' ', '-')}.csv`
  saveBlob(response.data, filename)
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * CLAUDE.md Section 8's fiscal calendar (Q1 Jul-Sep .. Q4 Apr-Jun, label year = the quarter's own
 * start-month year), mirroring App\Support\KpiPeriod. Still used by the HRM&D page's defaults.
 */
export function getCurrentQuarter(referenceDate: Date = new Date()): { label: string; startDate: string } {
  const month = referenceDate.getMonth() + 1
  const year = referenceDate.getFullYear()
  const [quarterNumber, quarterStartMonth] = month >= 7 && month <= 9 ? [1, 7] : month >= 10 ? [2, 10] : month <= 3 ? [3, 1] : [4, 4]

  return {
    label: `Q${quarterNumber} ${year}`,
    startDate: `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`,
  }
}

function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')) as Partial<T>
}

// --- Profiles (FR-KPI-002) ------------------------------------------------------

/** GET/POST /kpi-profiles row — App\Http\Resources\KpiProfileResource. */
export interface KpiProfile {
  id: string
  ministry_id: string
  name: string
  kpi_definitions: KpiDefinitionRef[]
  assigned_missions: KpiMissionRef[]
  created_at: string
  updated_at: string
}

/** GET /kpi-profiles — administrators and the target setters (KpiPolicy::viewProfiles()). */
export async function listKpiProfiles(): Promise<KpiProfile[]> {
  const { data } = await client.get<ApiEnvelope<KpiProfile[]>>('/kpi-profiles')
  return data.data
}

/** POST /kpi-profiles — System Administrator or the department's Ministry Administrator. */
export async function createKpiProfile(payload: { ministry_id?: string; name: string; kpi_definition_ids: string[] }): Promise<KpiProfile> {
  const { data } = await client.post<ApiEnvelope<KpiProfile>>('/kpi-profiles', payload)
  return data.data
}

/** PATCH /kpi-profiles/{id}/assign — replaces the profile's missions; a mission moves off any other profile. */
export async function assignKpiProfile(profileId: string, missionIds: string[]): Promise<KpiProfile> {
  const { data } = await client.patch<ApiEnvelope<KpiProfile>>(`/kpi-profiles/${profileId}/assign`, { mission_ids: missionIds })
  return data.data
}
