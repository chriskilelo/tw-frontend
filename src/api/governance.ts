import client, { type ApiEnvelope } from './client'

/**
 * App\Services\GovernanceService::TYPES — the submissions an attache originates (FR-HOM-001,
 * FR-HOM-002 "alerts, inquiries, and reports"). Directives are HQ tasking, not submissions.
 */
export type GovernanceItemType = 'alert' | 'inquiry' | 'periodic_report'

export const GOVERNANCE_ITEM_TYPES: GovernanceItemType[] = ['alert', 'inquiry', 'periodic_report']

export type CountsByType = Record<GovernanceItemType, number>

/** A fiscal quarter (CLAUDE.md Section 8). `is_partial`: the quarter is still running. */
export interface GovernancePeriodRef {
  label: string
  start: string
  end: string
  is_partial: boolean
}

/**
 * FR-HOM-002: one quarter's counts by type and, per type, by status. A submitted report's
 * status is its timeliness: `submitted_on_time` or `submitted_late`.
 */
export interface GovernancePeriodSummary extends GovernancePeriodRef {
  total: number
  by_type: CountsByType
  by_status: Record<GovernanceItemType, Record<string, number>>
}

export interface GovernanceTrendPoint extends GovernancePeriodRef {
  total: number
  by_type: CountsByType
}

/** A department posted to the mission. `attache` is shown to the Head of Mission only. */
export interface MissionDepartment {
  id: string
  name: string
  active: boolean
  posted: boolean
  attache: { full_name: string } | null
  has_activity: boolean
}

export interface GovernanceMission {
  id: string
  name: string
  city: string
  host_country: string
  active: boolean
}

/** GET /mission-activity/summary — FR-HOM-002 (and FR-MFA-002, which adds `recent`). */
export interface MissionActivitySummary {
  mission: GovernanceMission
  ministry_id: string | null
  departments: MissionDepartment[]
  current_period: GovernancePeriodSummary
  prior_period: GovernancePeriodSummary
  trend: GovernanceTrendPoint[]
  last_activity_at: string | null
}

export interface AlertActivitySummary {
  country: string | null
  intelligence_type: string | null
  sector: string | null
  product_category: string | null
  urgency: string | null
  excerpt: string | null
}

export interface InquiryActivitySummary {
  category: string | null
  sub_type: 'standard' | 'dispute_or_complaint' | null
  inquirer_organisation: string | null
  product_or_sector: string | null
  high_value: boolean
  excerpt: string | null
}

export interface ReportActivitySummary {
  period_label: string
  period_start: string
  period_end: string
  is_late: boolean
}

interface MissionActivityItemBase {
  id: string
  reference: string
  status: string
  date: string
  ministry: { id: string; name: string | null }
  submitting_officer: string | null
  /** In-app path to the full, read-only record (FR-HOM-001 AC2). */
  link: string
}

/** One row of GET /mission-activity (FR-HOM-001 AC1). */
export type MissionActivityItem =
  | (MissionActivityItemBase & { type: 'alert'; summary: AlertActivitySummary | null })
  | (MissionActivityItemBase & { type: 'inquiry'; summary: InquiryActivitySummary | null })
  | (MissionActivityItemBase & { type: 'periodic_report'; summary: ReportActivitySummary | null })

export type MissionActivitySort = '-date' | 'date'

export interface MissionActivityFilters {
  ministry_id?: string
  type?: GovernanceItemType
  status?: string
  /** A fiscal quarter label, e.g. "Q1 2026". */
  period?: string
  sort?: MissionActivitySort
  page?: number
  per_page?: number
}

/** GET /mission-activity — FR-HOM-001. Head of Mission / Deputy Head of Mission, own mission only. */
export async function getMissionActivityFeed(filters: MissionActivityFilters = {}): Promise<ApiEnvelope<MissionActivityItem[]>> {
  const { data } = await client.get<ApiEnvelope<MissionActivityItem[]>>('/mission-activity', { params: filters })
  return data
}

/** GET /mission-activity/summary — FR-HOM-002, optionally for one department. */
export async function getMissionActivitySummary(ministryId?: string): Promise<MissionActivitySummary> {
  const { data } = await client.get<ApiEnvelope<MissionActivitySummary>>('/mission-activity/summary', {
    params: ministryId ? { ministry_id: ministryId } : {},
  })
  return data.data
}

// --- MFA awareness (FR-MFA-001 to 003) -------------------------------------------------

export interface MfaMissionCount {
  mission_id: string
  mission_name: string
  city: string
  host_country: string
  active: boolean
  total: number
  by_type: CountsByType
  last_activity_at: string | null
}

export interface MfaMinistryCount {
  ministry_id: string
  ministry_name: string
  total: number
  by_type: CountsByType
  missions_reporting: number
}

export interface DepartmentOption {
  id: string
  name: string
}

/** GET /mfa-awareness — FR-MFA-001: counts only, never record content (AC2). */
export interface MfaAwarenessSummary {
  scope: { ministry_id: string | null; period: GovernancePeriodRef | null }
  current_quarter: GovernancePeriodRef
  ministries: DepartmentOption[]
  total: number
  by_type: CountsByType
  by_mission: MfaMissionCount[]
  by_ministry: MfaMinistryCount[]
  by_period: GovernanceTrendPoint[]
}

/** One metadata-only entry (FR-MFA-001 AC2): type, date, mission and department — nothing else. */
export interface SubmissionLogEntry {
  type: GovernanceItemType
  date: string
  mission: { id: string; name: string | null }
  ministry: { id: string; name: string | null }
}

/** GET /mfa-awareness/missions/{id} — FR-MFA-002: the Head of Mission's summary, plus metadata. */
export interface MissionDrillDown extends MissionActivitySummary {
  recent: SubmissionLogEntry[]
}

export interface NationalOverviewMission {
  mission_id: string
  mission_name: string
  host_country: string
  active: boolean
  current: { total: number; by_type: CountsByType; by_ministry: Record<string, number> }
  prior: { total: number; by_type: CountsByType }
}

export interface NationalOverviewDepartment {
  ministry_id: string
  ministry_name: string
  current: { total: number; by_type: CountsByType; missions_reporting: number }
  prior: { total: number; by_type: CountsByType }
}

/** GET /mfa-awareness/national-overview — FR-MFA-003, MFA Principal Secretary only. */
export interface NationalOverview {
  period: GovernancePeriodRef
  comparison_period: GovernancePeriodRef
  ministries: DepartmentOption[]
  totals: { current: { total: number; by_type: CountsByType }; prior: { total: number; by_type: CountsByType } }
  missions: NationalOverviewMission[]
  departments: NationalOverviewDepartment[]
}

export interface MfaAwarenessFilters {
  ministry_id?: string
  period?: string
}

export interface SubmissionLogFilters {
  mission_id?: string
  ministry_id?: string
  type?: GovernanceItemType
  period?: string
  page?: number
  per_page?: number
}

/** GET /mfa-awareness — FR-MFA-001. MFA HQ Officer / MFA Principal Secretary. */
export async function getMfaAwarenessSummary(filters: MfaAwarenessFilters = {}): Promise<MfaAwarenessSummary> {
  const { data } = await client.get<ApiEnvelope<MfaAwarenessSummary>>('/mfa-awareness', { params: filters })
  return data.data
}

/** GET /mfa-awareness/submissions — FR-MFA-001 AC2, the metadata-only submission log. */
export async function getSubmissionLog(filters: SubmissionLogFilters = {}): Promise<ApiEnvelope<SubmissionLogEntry[]>> {
  const { data } = await client.get<ApiEnvelope<SubmissionLogEntry[]>>('/mfa-awareness/submissions', { params: filters })
  return data
}

/** GET /mfa-awareness/missions/{id} — FR-MFA-002 drill-down, equivalent to the HoM summary. */
export async function getMissionDrillDown(missionId: string, ministryId?: string): Promise<MissionDrillDown> {
  const { data } = await client.get<ApiEnvelope<MissionDrillDown>>(`/mfa-awareness/missions/${missionId}`, {
    params: ministryId ? { ministry_id: ministryId } : {},
  })
  return data.data
}

/** GET /mfa-awareness/national-overview — FR-MFA-003. MFA Principal Secretary only. */
export async function getNationalOverview(period?: string): Promise<NationalOverview> {
  const { data } = await client.get<ApiEnvelope<NationalOverview>>('/mfa-awareness/national-overview', {
    params: period ? { period } : {},
  })
  return data.data
}
