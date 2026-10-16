import client, { type ApiEnvelope } from './client'
import type { AlertIntelligenceType, AlertStatus, MasterDataEntryOption } from './alerts'
import type { InquiryStatus, InquirySubType } from './inquiries'
import type { Directive, DirectiveAllowedActions, DirectiveMissionRef, DirectiveStatus, DirectiveSummary, DirectiveUserRef } from './directives'
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

// --- FR-SDT-012 to 015: the HQ Trade Officer workspace ---------------------
// App\Services\HqWorkspaceService behind GET /sdt/hq-workspace and its four section lists.
// Ministry HQ Officer only; every other role gets 403.

/**
 * "portfolio" narrows the department-wide views (the alert feed, notified inquiries, reports)
 * to the officer's configured portfolio; "department" shows everything. A requested portfolio
 * falls back to "department" when none is configured; the response says which applied.
 */
export type HqWorkspaceScope = 'portfolio' | 'department'

/** awaiting / acknowledged: alerts assigned to the officer. feed: every alert in the scope. */
export type HqAlertQueue = 'awaiting' | 'acknowledged' | 'feed'

/** open = received, in progress, pending an external response; closed = closed or cancelled. */
export type HqInquiryStatusGroup = 'open' | 'resolved' | 'closed' | 'all'

/** attention = completed and awaiting the officer's closure, overdue, or stale. */
export type HqDirectiveQueue = 'attention' | 'awaiting_closure' | 'open' | 'all'

export type HqDirectiveAttention = 'awaiting_closure' | 'overdue' | 'stale' | 'approaching'

export interface HqMissionRef {
  id: string
  name: string
  city: string | null
  host_country: string | null
  active: boolean
}

export interface HqPersonRef {
  id: string
  full_name: string
}

/** GET /sdt/hq-workspace. Every count equals the matching list's meta.total. */
export interface HqWorkspaceOverview {
  department: { id: string; name: string } | null
  scope: HqWorkspaceScope
  portfolio: {
    configured: boolean
    missions: HqMissionRef[]
    countries: string[]
    sectors: string[]
    /** False when the portfolio holds only sectors, so no report or directive can fall inside it. */
    covers_missions: boolean
  }
  counts: {
    alerts: Record<HqAlertQueue, number>
    inquiries: Record<HqInquiryStatusGroup, number> & { high_value_open: number }
    directives: Record<HqDirectiveQueue, number> & { overdue: number; stale: number }
    reports: { submitted: number; latest_period: { label: string; submitted: number; late: number } | null }
  }
  filter_options: {
    missions: (HqMissionRef & { in_portfolio: boolean })[]
    /** Quarter labels with submitted reports, newest first. */
    periods: string[]
  }
  filters: { scope: HqWorkspaceScope | null; mission_id: string | null }
}

export interface HqWorkspaceAlert {
  id: string
  reference_number: string
  country: string
  sector: string | null
  product_category: string | null
  intelligence_type: AlertIntelligenceType
  urgency: string | null
  status: AlertStatus
  excerpt: string | null
  mission: { id: string; name: string } | null
  submitted_by: HqPersonRef | null
  assigned_to: HqPersonRef | null
  assigned_to_me: boolean
  feedback_count: number
  /** Null when the officer has no portfolio. */
  in_portfolio: boolean | null
  created_at: string
  /** What AlertPolicy lets this officer do on this alert now. */
  actions: { acknowledge: boolean; feedback: boolean }
}

export interface HqWorkspaceInquiry {
  id: string
  reference_number: string
  category: string
  sub_type: InquirySubType
  status: InquiryStatus
  high_value_flag: boolean
  inquirer_name: string
  inquirer_organisation: string | null
  product_or_sector: string | null
  excerpt: string | null
  date_received: string | null
  days_since_received: number | null
  mission: { id: string; name: string } | null
  logged_by: HqPersonRef | null
  /** The latest "HQ Notified" event (FR-INQ-009). */
  hq_notified: { at: string; by: HqPersonRef | null; note: string | null } | null
  in_portfolio: boolean | null
  created_at: string
}

/** A DirectiveResource row with why it needs the issuer and what the issuer may do now. */
export interface HqWorkspaceDirective extends Directive {
  attention: HqDirectiveAttention[]
  in_portfolio: boolean | null
  allowed_actions: DirectiveAllowedActions
}

export interface HqWorkspaceReport {
  id: string
  reporting_period_label: string
  period_start_date: string | null
  period_end_date: string | null
  submitted_at: string | null
  is_late: boolean
  mission: HqMissionRef | null
  authored_by: HqPersonRef | null
  in_portfolio: boolean | null
}

export interface HqWorkspacePageMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
  scope: HqWorkspaceScope
}

export interface HqWorkspacePage<T> {
  data: T[]
  meta: HqWorkspacePageMeta
}

export interface HqWorkspaceFilters {
  scope?: HqWorkspaceScope
  mission_id?: string
}

export interface HqWorkspaceListFilters extends HqWorkspaceFilters {
  q?: string
  page?: number
  per_page?: number
}

export interface HqWorkspaceAlertFilters extends HqWorkspaceListFilters {
  queue?: HqAlertQueue
  intelligence_type?: AlertIntelligenceType
  sort?: '-created_at' | 'created_at'
}

export interface HqWorkspaceInquiryFilters extends HqWorkspaceListFilters {
  status?: HqInquiryStatusGroup
  high_value?: '1'
  sort?: '-notified_at' | 'notified_at' | '-date_received' | 'date_received'
}

export interface HqWorkspaceDirectiveFilters extends HqWorkspaceListFilters {
  queue?: HqDirectiveQueue
  sort?: 'priority' | 'target_completion_date' | '-created_at' | 'last_progress_update_at'
}

export interface HqWorkspaceReportFilters extends HqWorkspaceListFilters {
  period?: string
  timeliness?: 'on_time' | 'late'
  sort?: '-submitted_at' | 'submitted_at'
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

/** GET /sdt/hq-workspace — FR-SDT-012. Ministry HQ Officer only. */
export async function getHqWorkspace(filters: HqWorkspaceFilters = {}): Promise<HqWorkspaceOverview> {
  const { data } = await client.get<ApiEnvelope<HqWorkspaceOverview>>('/sdt/hq-workspace', { params: filters })
  return data.data
}

async function getHqWorkspacePage<T>(section: string, filters: HqWorkspaceListFilters): Promise<HqWorkspacePage<T>> {
  const { data } = await client.get<{ data: T[]; meta: HqWorkspacePageMeta }>(`/sdt/hq-workspace/${section}`, { params: filters })
  return { data: data.data, meta: data.meta }
}

/** GET /sdt/hq-workspace/alerts — FR-SDT-013. */
export function listHqWorkspaceAlerts(filters: HqWorkspaceAlertFilters = {}): Promise<HqWorkspacePage<HqWorkspaceAlert>> {
  return getHqWorkspacePage('alerts', filters)
}

/** GET /sdt/hq-workspace/inquiries — FR-SDT-013, FR-INQ-009. */
export function listHqWorkspaceInquiries(filters: HqWorkspaceInquiryFilters = {}): Promise<HqWorkspacePage<HqWorkspaceInquiry>> {
  return getHqWorkspacePage('inquiries', filters)
}

/** GET /sdt/hq-workspace/directives — FR-SDT-014, FR-DIR-009 to 011. */
export function listHqWorkspaceDirectives(filters: HqWorkspaceDirectiveFilters = {}): Promise<HqWorkspacePage<HqWorkspaceDirective>> {
  return getHqWorkspacePage('directives', filters)
}

/** GET /sdt/hq-workspace/reports — FR-SDT-015. Submitted reports only, read-only. */
export function listHqWorkspaceReports(filters: HqWorkspaceReportFilters = {}): Promise<HqWorkspacePage<HqWorkspaceReport>> {
  return getHqWorkspacePage('reports', filters)
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

// --- The directive oversight board (SDT console) -----------------------------
// App\Services\DirectiveService::getOverview() behind GET /sdt/directives/overview: FR-SDT-001
// (the PS's national directive summary), FR-SDT-008/010 (the directors' read-only oversight),
// FR-DIR-003, FR-DIR-010, FR-DIR-012. Ministry HQ Director, Ministry PS and Acting PS.

/** What needs attention now; every count comes from the API's derived directive flags. */
export interface DirectiveAttentionCounts {
  open: number
  overdue: number
  approaching: number
  stale: number
  no_date: number
  /** Completed by the attache, waiting for the issuer to accept and close. */
  awaiting_closure: number
}

/** attention: overdue or stale work; watch: due within 7 days, or awaiting closure. */
export type DirectiveMissionHealth = 'attention' | 'watch' | 'on_track' | 'idle'

export interface DirectiveMissionBoardRow extends DirectiveAttentionCounts {
  mission_id: string
  mission_name: string
  host_country: string | null
  active: boolean
  /** The department's attache currently posted there, if any. */
  attache: DirectiveUserRef | null
  total: number
  completed: number
  completion_rate: number
  last_progress_at: string | null
  health: DirectiveMissionHealth
}

export interface DirectiveIssuerBoardRow extends DirectiveAttentionCounts {
  user_id: string
  full_name: string | null
  total: number
  completion_rate: number
}

/** One workflow step (status change) from the audit trail. */
export interface DirectiveActivityEntry {
  id: string
  directive_id: string
  description: string
  mission: DirectiveMissionRef | null
  from_status: DirectiveStatus | null
  status: DirectiveStatus
  at: string
  by: DirectiveUserRef | null
}

/** GET /sdt/directives/overview. */
export interface DirectiveOverview {
  summary: DirectiveSummary
  attention: DirectiveAttentionCounts
  /** Worst first: attention, watch, on track, idle. */
  missions: DirectiveMissionBoardRow[]
  /** Largest backlog (awaiting closure + overdue + stale) first. */
  issuers: DirectiveIssuerBoardRow[]
  /** The viewer's own directives, when they issued any (a PS); null otherwise. */
  my_follow_through: DirectiveAttentionCounts | null
  /** The latest twelve workflow steps, newest first. */
  recent_activity: DirectiveActivityEntry[]
  filters: { mission_id: string | null; issued_by_user_id: string | null }
}

export interface DirectiveOverviewFilters {
  mission_id?: string
  issued_by_user_id?: string
}

/** GET /sdt/directives/overview — Ministry HQ Director, Ministry PS, Acting PS. */
export async function getDirectiveOverview(filters: DirectiveOverviewFilters = {}): Promise<DirectiveOverview> {
  const { data } = await client.get<ApiEnvelope<DirectiveOverview>>('/sdt/directives/overview', { params: filters })
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
