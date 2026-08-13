import client, { type ApiEnvelope } from './client'

/** App\Services\GovernanceService::FEED_TYPES */
export type GovernanceItemType = 'alert' | 'inquiry' | 'directive' | 'periodic_report'

/** One normalized row from GovernanceService::normalize() — never the raw underlying record. */
export interface GovernanceFeedItem {
  type: GovernanceItemType
  id: string
  reference: string
  mission_id: string
  mission_name: string | null
  ministry_id: string
  ministry_name: string | null
  submitting_officer: string | null
  status: string | null
  summary: string
  date: string
}

/** GovernanceService::summarisePeriod() shape. */
export interface GovernanceActivityPeriod {
  period_start: string
  period_end: string
  total: number
  by_type: Record<string, number>
  by_status: Record<string, number>
}

/** GovernanceService::summariseAcrossQuarters() shape — FR-HOM-002 current + prior quarter. */
export interface GovernanceActivitySummary {
  current_period: GovernanceActivityPeriod
  prior_period: GovernanceActivityPeriod
}

/** GovernanceService::mfaAwarenessSummary() shape — FR-MFA-001, aggregate-only, no record content. */
export interface MfaAwarenessSummary {
  total: number
  by_type: Record<string, number>
  by_mission: Record<string, number>
  by_ministry: Record<string, number>
  by_period: Record<string, number>
}

/** GovernanceService::nationalOverview() shape — FR-MFA-003, MFA Principal Secretary only. */
export interface NationalOverviewMission extends GovernanceActivitySummary {
  mission_id: string
  mission_name: string
}

export interface NationalOverview {
  missions: NationalOverviewMission[]
}

export interface MissionActivityFilters {
  ministry_id?: string
  page?: number
  per_page?: number
}

/** GET /mission-activity — FR-HOM-001. Head of Mission / Deputy Head of Mission, own mission only. */
export async function getMissionActivityFeed(
  filters: MissionActivityFilters = {},
): Promise<ApiEnvelope<GovernanceFeedItem[]>> {
  const { data } = await client.get<ApiEnvelope<GovernanceFeedItem[]>>('/mission-activity', { params: filters })
  return data
}

/** GET /mission-activity/summary — FR-HOM-002. */
export async function getMissionActivitySummary(): Promise<GovernanceActivitySummary> {
  const { data } = await client.get<ApiEnvelope<GovernanceActivitySummary>>('/mission-activity/summary')
  return data.data
}

/** GET /mfa-awareness — FR-MFA-001. MFA HQ Officer / MFA Principal Secretary. */
export async function getMfaAwarenessSummary(): Promise<MfaAwarenessSummary> {
  const { data } = await client.get<ApiEnvelope<MfaAwarenessSummary>>('/mfa-awareness')
  return data.data
}

/** GET /mfa-awareness/missions/{id} — FR-MFA-002 drill-down, equivalent shape to the HoM summary. */
export async function getMissionDrillDown(missionId: string): Promise<GovernanceActivitySummary> {
  const { data } = await client.get<ApiEnvelope<GovernanceActivitySummary>>(`/mfa-awareness/missions/${missionId}`)
  return data.data
}

/** GET /mfa-awareness/national-overview — FR-MFA-003. MFA Principal Secretary only. */
export async function getNationalOverview(): Promise<NationalOverview> {
  const { data } = await client.get<ApiEnvelope<NationalOverview>>('/mfa-awareness/national-overview')
  return data.data
}
