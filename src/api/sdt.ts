import client, { type ApiEnvelope } from './client'
import type { AlertIntelligenceType, AlertStatus } from './alerts'
import type { InquiryStatus, InquirySubType } from './inquiries'
import type { Directive, DirectiveSummary } from './directives'
import type { ComplianceDashboard } from './reports'

/** SdtService::directiveSummaryForWeek() shape — FR-SDT-001. */
export interface DirectiveWeekSummary {
  period_start: string
  period_end: string
  total: number
  by_status: Record<string, number>
}

/** GET /sdt/dashboard response — SdtService::psDashboard(), FR-SDT-001. */
export interface PsDashboard {
  unacknowledged_alerts_count: number
  pending_inquiries_count: number
  directive_summary_this_week: DirectiveWeekSummary
}

/**
 * SdtService::hqWorkspace() returns raw Eloquent models (no API Resource,
 * no eager-loaded relations) — these types cover only the columns the
 * workspace UI displays, not the full row.
 */
export interface HqWorkspaceAlert {
  id: string
  reference_number: string
  country: string
  intelligence_type: AlertIntelligenceType
  status: AlertStatus
  mission_id: string
  created_at: string
}

export interface HqWorkspaceInquiry {
  id: string
  reference_number: string
  category: string
  sub_type: InquirySubType
  inquirer_name: string
  status: InquiryStatus
  mission_id: string
  created_at: string
}

export interface HqWorkspaceDirective {
  id: string
  description: string
  status: string
  mission_id: string
  target_completion_date: string | null
  created_at: string
}

/** GET /sdt/hq-workspace response — SdtService::hqWorkspace(), FR-SDT-012/013. */
export interface HqWorkspace {
  assigned_alerts: HqWorkspaceAlert[]
  assigned_inquiries: HqWorkspaceInquiry[]
  pending_directives: HqWorkspaceDirective[]
}

export interface HqWorkspaceFilters {
  mission_id?: string
  status?: string
}

export interface ActingPsActivationResult {
  ministry_id: string
  acting_ps_user_id: string
  active: true
}

export interface ActingPsDeactivationResult {
  ministry_id: string
  active: false
}

/** GET /sdt/dashboard — FR-SDT-001. Ministry PS (and Acting PS) only. */
export async function getPsDashboard(): Promise<PsDashboard> {
  const { data } = await client.get<ApiEnvelope<PsDashboard>>('/sdt/dashboard')
  return data.data
}

/** GET /sdt/hq-workspace — FR-SDT-012, FR-SDT-013. Ministry HQ Officer only. */
export async function getHqWorkspace(filters: HqWorkspaceFilters = {}): Promise<HqWorkspace> {
  const { data } = await client.get<ApiEnvelope<HqWorkspace>>('/sdt/hq-workspace', { params: filters })
  return data.data
}

/** POST /sdt/acting-ps/activate — FR-SDT-004, BR-023. */
export async function activateActingPs(userId: string): Promise<ActingPsActivationResult> {
  const { data } = await client.post<ApiEnvelope<ActingPsActivationResult>>('/sdt/acting-ps/activate', {
    user_id: userId,
  })
  return data.data
}

/** POST /sdt/acting-ps/deactivate — FR-SDT-006. ministry_id optional (defaults to the caller's own ministry). */
export async function deactivateActingPs(ministryId?: string): Promise<ActingPsDeactivationResult> {
  const { data } = await client.post<ApiEnvelope<ActingPsDeactivationResult>>('/sdt/acting-ps/deactivate', {
    ...(ministryId ? { ministry_id: ministryId } : {}),
  })
  return data.data
}

/**
 * GET /sdt/reports/compliance — FR-SDT-007. App\Http\Controllers\Api\Sdt\ReportsController::compliance()
 * wraps the identical App\Services\ReportService::getComplianceDashboard() the generic
 * /periodic-reports/compliance endpoint uses (Session 26), always scoped to the requesting
 * PS's own ministry — the response shape is the same ComplianceDashboard type as
 * api/reports.ts's getReportComplianceDashboard(). Ministry PS (and Acting PS) only.
 */
export async function getSdtReportCompliance(periodLabel?: string): Promise<ComplianceDashboard> {
  const { data } = await client.get<ApiEnvelope<ComplianceDashboard>>('/sdt/reports/compliance', {
    params: periodLabel ? { period_label: periodLabel } : undefined,
  })
  return data.data
}

/**
 * GET /sdt/directives/overview response — App\Services\DirectiveService::getOverview(),
 * FR-SDT-008. `summary` is the same all-time, ministry-wide shape DirectiveSummary already
 * covers (App\Services\DirectiveService::getSummary() is not quarter-scoped — there is no
 * "this quarter" filter on the backend to call instead).
 */
export interface DirectiveOverview {
  summary: DirectiveSummary
  recent_directives: Directive[]
  stale_directives: Directive[]
}

/** GET /sdt/directives/overview — FR-SDT-008. Ministry PS (and Acting PS) only. */
export async function getDirectiveOverview(): Promise<DirectiveOverview> {
  const { data } = await client.get<ApiEnvelope<DirectiveOverview>>('/sdt/directives/overview')
  return data.data
}

/** master_data_entries row, category = 'aie_budget_code' — FR-SDT-022. */
export interface AieBudgetCodeEntry {
  id: string
  ministry_id: string
  category: 'aie_budget_code'
  value: string
  display_order: number
  active: boolean
}

export interface AieBudgetCodeCreateRequest {
  ministry_id: string
  value: string
  display_order?: number
  active?: boolean
}

export interface AieBudgetCodeUpdateRequest {
  value?: string
  display_order?: number
  active?: boolean
}

/** GET /sdt/config/aie-budget-codes — FR-SDT-022. System Administrator only. */
export async function getAieBudgetCodes(ministryId?: string): Promise<AieBudgetCodeEntry[]> {
  const { data } = await client.get<ApiEnvelope<AieBudgetCodeEntry[]>>('/sdt/config/aie-budget-codes', {
    params: ministryId ? { ministry_id: ministryId } : undefined,
  })
  return data.data
}

/** POST /sdt/config/aie-budget-codes — FR-SDT-022. System Administrator only. */
export async function createAieBudgetCode(payload: AieBudgetCodeCreateRequest): Promise<AieBudgetCodeEntry> {
  const { data } = await client.post<ApiEnvelope<AieBudgetCodeEntry>>('/sdt/config/aie-budget-codes', payload)
  return data.data
}

/** PATCH /sdt/config/aie-budget-codes/{id} — FR-SDT-022. System Administrator only. */
export async function updateAieBudgetCode(id: string, payload: AieBudgetCodeUpdateRequest): Promise<AieBudgetCodeEntry> {
  const { data } = await client.patch<ApiEnvelope<AieBudgetCodeEntry>>(`/sdt/config/aie-budget-codes/${id}`, payload)
  return data.data
}
