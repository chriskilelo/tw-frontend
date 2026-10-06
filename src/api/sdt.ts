import client, { type ApiEnvelope } from './client'
import type { AlertIntelligenceType, AlertStatus, MasterDataEntryOption } from './alerts'
import type { InquiryStatus, InquirySubType } from './inquiries'
import type { Directive, DirectiveSummary } from './directives'
import type { ComplianceDashboard } from './reports'
import type { ComparisonKpiRow, KpiComparisonMatrix } from './kpi'
import type { ReferralOrganisation } from './referrals'

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

/** POST /sdt/designated-deputy/activate — FR-SDT-003, FR-ALERT-008 (PS, Acting PS or Ministry Administrator). */
export async function activateDesignatedDeputy(userId: string): Promise<{ ministry_id: string; designated_deputy_user_id: string; active: true }> {
  const { data } = await client.post<ApiEnvelope<{ ministry_id: string; designated_deputy_user_id: string; active: true }>>(
    '/sdt/designated-deputy/activate',
    { user_id: userId },
  )
  return data.data
}

/** POST /sdt/designated-deputy/deactivate — FR-SDT-003. ministry_id only needed from a System Administrator. */
export async function deactivateDesignatedDeputy(ministryId?: string): Promise<{ ministry_id: string; active: false }> {
  const { data } = await client.post<ApiEnvelope<{ ministry_id: string; active: false }>>('/sdt/designated-deputy/deactivate', {
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
 * FR-SDT-008. `summary` is getSummary() for the PS's department with no filters (all time,
 * ministry-wide; the filterable view is GET /directives/summary). Both row lists are
 * DirectiveResource rows, so they carry the server-computed due_state, days_until_due,
 * is_overdue and is_stale flags. recent_directives holds the ten most recently issued.
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

// --- FR-SDT-019: Alert Field Configuration ---------------------------
// Same MasterDataEntryOption shape (api/alerts.ts) as the public
// getAlertIntelligenceTypeOptions() dropdown — ConfigController::presentEntry()
// and MasterDataController::present() return an identical field set.

export interface AlertFieldCreateRequest {
  ministry_id: string
  value: string
  display_order?: number
  active?: boolean
}

export interface AlertFieldUpdateRequest {
  value?: string
  display_order?: number
  active?: boolean
}

/** GET /sdt/config/alert-fields — FR-SDT-019. System Administrator only. */
export async function getAlertFieldSettings(ministryId?: string): Promise<MasterDataEntryOption[]> {
  const { data } = await client.get<ApiEnvelope<MasterDataEntryOption[]>>('/sdt/config/alert-fields', {
    params: ministryId ? { ministry_id: ministryId } : undefined,
  })
  return data.data
}

/** POST /sdt/config/alert-fields — FR-SDT-019. System Administrator only. */
export async function createAlertFieldSetting(payload: AlertFieldCreateRequest): Promise<MasterDataEntryOption> {
  const { data } = await client.post<ApiEnvelope<MasterDataEntryOption>>('/sdt/config/alert-fields', payload)
  return data.data
}

/** PATCH /sdt/config/alert-fields/{id} — FR-SDT-019. System Administrator only. */
export async function updateAlertFieldSetting(id: string, payload: AlertFieldUpdateRequest): Promise<MasterDataEntryOption> {
  const { data } = await client.patch<ApiEnvelope<MasterDataEntryOption>>(`/sdt/config/alert-fields/${id}`, payload)
  return data.data
}

// --- FR-SDT-020: Inquiry Category / Workflow Status / Event Type Configuration --

export type InquirySettingCategory = 'inquiry_category' | 'inquiry_workflow_status' | 'inquiry_event_type'

export interface InquirySettingCreateRequest {
  category: InquirySettingCategory
  ministry_id: string
  value: string
  display_order?: number
  active?: boolean
}

export interface InquirySettingUpdateRequest {
  value?: string
  display_order?: number
  active?: boolean
}

/** GET /sdt/config/inquiry-settings — FR-SDT-020. System Administrator only. */
export async function getInquirySettings(
  category?: InquirySettingCategory,
  ministryId?: string,
): Promise<MasterDataEntryOption[]> {
  const { data } = await client.get<ApiEnvelope<MasterDataEntryOption[]>>('/sdt/config/inquiry-settings', {
    params: { ...(category ? { category } : {}), ...(ministryId ? { ministry_id: ministryId } : {}) },
  })
  return data.data
}

/** POST /sdt/config/inquiry-settings — FR-SDT-020. System Administrator only. */
export async function createInquirySetting(payload: InquirySettingCreateRequest): Promise<MasterDataEntryOption> {
  const { data } = await client.post<ApiEnvelope<MasterDataEntryOption>>('/sdt/config/inquiry-settings', payload)
  return data.data
}

/** PATCH /sdt/config/inquiry-settings/{id} — FR-SDT-020. System Administrator only. */
export async function updateInquirySetting(
  id: string,
  payload: InquirySettingUpdateRequest,
): Promise<MasterDataEntryOption> {
  const { data } = await client.patch<ApiEnvelope<MasterDataEntryOption>>(`/sdt/config/inquiry-settings/${id}`, payload)
  return data.data
}

// --- FR-SDT-010 / FR-DIR-001: Directive Type Configuration ------------
// Sdt\ConfigController only has a store action for this category (CLAUDE.md
// Section 8: directive_type was left unseeded at go-live), so listing and
// editing go through the generic master-data endpoints
// (Api\Admin\MasterDataController): GET lists active and inactive entries,
// PATCH renames, reorders, activates or deactivates one
// (MasterDataEntryPolicy::update(): a System Administrator, or a Ministry
// Administrator for its own department's rows).

export type DirectiveSettingEntry = MasterDataEntryOption

/** GET /master-data?category=directive_type — every entry, inactive ones included. */
export async function listDirectiveSettings(): Promise<DirectiveSettingEntry[]> {
  const { data } = await client.get<ApiEnvelope<DirectiveSettingEntry[]>>('/master-data', {
    params: { category: 'directive_type' },
  })
  return data.data
}

export interface DirectiveSettingUpdateRequest {
  value?: string
  display_order?: number
  active?: boolean
}

/** PATCH /master-data/{id} — FR-MDATA-002 applied to a directive type. */
export async function updateDirectiveSetting(id: string, payload: DirectiveSettingUpdateRequest): Promise<DirectiveSettingEntry> {
  const { data } = await client.patch<ApiEnvelope<DirectiveSettingEntry>>(`/master-data/${id}`, payload)
  return data.data
}

export interface DirectiveSettingCreateRequest {
  ministry_id: string
  value: string
  display_order?: number
  active?: boolean
}

/** POST /sdt/config/directive-settings — FR-SDT-010. System Administrator only. */
export async function createDirectiveSetting(payload: DirectiveSettingCreateRequest): Promise<MasterDataEntryOption> {
  const { data } = await client.post<ApiEnvelope<MasterDataEntryOption>>('/sdt/config/directive-settings', payload)
  return data.data
}

// --- FR-SDT-021: KPI Definition Configuration --------------------------
// Wraps the same App\Services\KpiService::defineKpi() the general-purpose
// Api\Kpi\KpiDefinitionController uses (Session 32/41 note) — KPI Profile
// management (FR-KPI-002) stays on its own /kpi-profiles endpoints, not
// duplicated here.

export interface KpiDefinition {
  id: string
  ministry_id: string
  name: string
  description: string | null
  unit: string | null
  calculation_method: 'auto' | 'manual'
  data_source: string | null
  reporting_frequency: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface KpiDefinitionCreateRequest {
  ministry_id: string
  name: string
  description?: string
  unit?: string
  calculation_method: 'auto' | 'manual'
  data_source?: string
  reporting_frequency: string
  active?: boolean
}

export interface KpiDefinitionUpdateRequest {
  name?: string
  description?: string
  unit?: string
  calculation_method?: 'auto' | 'manual'
  data_source?: string
  reporting_frequency?: string
  active?: boolean
}

/** GET /sdt/config/kpi-settings — FR-SDT-021. System Administrator only. */
export async function getKpiSettings(ministryId?: string): Promise<KpiDefinition[]> {
  const { data } = await client.get<ApiEnvelope<KpiDefinition[]>>('/sdt/config/kpi-settings', {
    params: ministryId ? { ministry_id: ministryId } : undefined,
  })
  return data.data
}

/** POST /sdt/config/kpi-settings — FR-SDT-021. System Administrator only. */
export async function createKpiSetting(payload: KpiDefinitionCreateRequest): Promise<KpiDefinition> {
  const { data } = await client.post<ApiEnvelope<KpiDefinition>>('/sdt/config/kpi-settings', payload)
  return data.data
}

/** PATCH /sdt/config/kpi-settings/{id} — FR-SDT-021. System Administrator only. */
export async function updateKpiSetting(id: string, payload: KpiDefinitionUpdateRequest): Promise<KpiDefinition> {
  const { data } = await client.patch<ApiEnvelope<KpiDefinition>>(`/sdt/config/kpi-settings/${id}`, payload)
  return data.data
}

// --- FR-SDT-023: Referral Organisation Registry ------------------------
// Same ReferralOrganisation shape (api/referrals.ts) as the public
// GET /referral-organisations dropdown — ConfigController::presentOrganisation()
// returns an identical field set. Named *Setting to avoid colliding with
// api/referrals.ts's own public-endpoint functions of a similar name.

export interface ReferralOrganisationCreateRequest {
  ministry_id: string
  name: string
  active?: boolean
}

export interface ReferralOrganisationUpdateRequest {
  name?: string
  active?: boolean
}

/** GET /sdt/config/referral-organisations — FR-SDT-023. System Administrator only. */
export async function getReferralOrganisationSettings(
  ministryId?: string,
  active?: boolean,
): Promise<ReferralOrganisation[]> {
  const { data } = await client.get<ApiEnvelope<ReferralOrganisation[]>>('/sdt/config/referral-organisations', {
    params: { ...(ministryId ? { ministry_id: ministryId } : {}), ...(active !== undefined ? { active } : {}) },
  })
  return data.data
}

/** POST /sdt/config/referral-organisations — FR-SDT-023. System Administrator only. */
export async function createReferralOrganisationSetting(
  payload: ReferralOrganisationCreateRequest,
): Promise<ReferralOrganisation> {
  const { data } = await client.post<ApiEnvelope<ReferralOrganisation>>('/sdt/config/referral-organisations', payload)
  return data.data
}

/** PATCH /sdt/config/referral-organisations/{id} — FR-SDT-023. System Administrator only. */
export async function updateReferralOrganisationSetting(
  id: string,
  payload: ReferralOrganisationUpdateRequest,
): Promise<ReferralOrganisation> {
  const { data } = await client.patch<ApiEnvelope<ReferralOrganisation>>(
    `/sdt/config/referral-organisations/${id}`,
    payload,
  )
  return data.data
}

/**
 * GET /sdt/hrmd-dashboard response — App\Services\KpiService::hrmdDashboard(), FR-SDT-016.
 * Same {cycle_label, missions} shape App\Http\Controllers\Api\Kpi\KpiComparisonController
 * returns (both wrap KpiService::buildComparisonMatrix() internally), reused here rather
 * than duplicated.
 */
export type HrmdDashboard = KpiComparisonMatrix

/** GET /sdt/hrmd-dashboard/{userId}/summary response — App\Services\KpiService::attachePerformanceSummary(), FR-SDT-017. */
export interface HrmdAttacheSummary {
  attache: {
    id: string
    full_name: string
    mission: { id: string; name: string }
  }
  cycle_label: string
  kpis: ComparisonKpiRow[]
}

/** GET /sdt/hrmd-dashboard — FR-SDT-016, FR-KPI-011. HRM&D Officer only (KpiPolicy::viewHrmdDashboard()). Every access is audit-logged server-side. */
export async function getHrmdDashboard(cycleLabel: string): Promise<HrmdDashboard> {
  const { data } = await client.get<ApiEnvelope<HrmdDashboard>>('/sdt/hrmd-dashboard', {
    params: { cycle_label: cycleLabel },
  })
  return data.data
}

/**
 * GET /sdt/hrmd-dashboard/{userId}/summary — FR-SDT-017, FR-KPI-011. HRM&D Officer only
 * (KpiPolicy::generateAttacheSummary()). Note the query param is `period_label`, not
 * `cycle_label` — App\Http\Controllers\Api\Sdt\HrmdDashboardController::attacheSummary()
 * names it differently from the dashboard endpoint above even though both accept the same
 * "Q1 2027"/"H1 2027"-style value. No user-picker endpoint is reachable by this role (GET
 * /users is System Administrator only), so $userId has to be supplied directly by the caller.
 */
export async function getHrmdAttacheSummary(userId: string, periodLabel: string): Promise<HrmdAttacheSummary> {
  const { data } = await client.get<ApiEnvelope<HrmdAttacheSummary>>(`/sdt/hrmd-dashboard/${userId}/summary`, {
    params: { period_label: periodLabel },
  })
  return data.data
}
