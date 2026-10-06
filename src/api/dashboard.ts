import client, { type ApiEnvelope } from './client'
import type { AlertStatus } from './alerts'
import type { DirectiveSummary } from './directives'
import type { PerformanceStatus } from './kpi'

/** A fiscal quarter or KPI cycle (CLAUDE.md Section 8: Q1 Jul-Sep .. Q4 Apr-Jun). */
export interface PeriodRef {
  label: string
  start: string
  end: string
}

export interface DashboardCalendar {
  today: string
  quarter: PeriodRef & { days_elapsed: number; days_total: number }
  /** The reporting period whose 15th-of-next-month deadline comes next (BR-010). */
  reporting_period: PeriodRef & { deadline: string; days_remaining: number }
}

export interface DashboardAlertItem {
  id: string
  reference_number: string
  country: string
  intelligence_type: string
  urgency: string | null
  status: AlertStatus
  mission_name: string | null
  created_at: string
}

export interface DashboardDirectiveItem {
  id: string
  description: string
  status: string
  mission_name: string | null
  target_name: string | null
  target_completion_date: string | null
  is_overdue: boolean
  is_stale: boolean
}

export interface NamedCount {
  name: string
  count: number
}

export interface KeyedCount {
  key: string
  count: number
}

/** FR-KPI-010: one KPI's target, actual and status for the attache's own mission. */
export interface MissionKpiRow {
  kpi_definition_id: string
  name: string
  target: number | null
  actual: number | null
  status: PerformanceStatus
  previous_actual: number | null
}

export type ReportProgressStatus = 'not_started' | 'draft' | 'submitted'

export interface AttacheDashboard {
  view: 'attache'
  calendar: DashboardCalendar
  mission: { id: string; name: string; city: string; host_country: string; time_zone: string } | null
  activity_trend?: (PeriodRef & { alerts: number; inquiries: number })[]
  alerts?: { this_quarter: number; previous_quarter: number; outcomes: Record<AlertStatus, number> }
  inquiries?: {
    open: number
    high_value_open: number
    closed_this_quarter: number
    pipeline: Record<'draft' | 'received' | 'in_progress' | 'pending_external_response' | 'resolved', number>
  }
  directives?: { open: number; overdue: number; items: DashboardDirectiveItem[] }
  report?: {
    period: DashboardCalendar['reporting_period']
    id: string | null
    status: ReportProgressStatus
    is_late: boolean
    submitted_at: string | null
    sections_total: number
    sections_drafted: number
  }
  kpi?: { cycle: PeriodRef; previous_cycle: PeriodRef; options: PeriodRef[]; kpis: MissionKpiRow[] }
}

export interface HqOfficerDashboard {
  view: 'hq_officer'
  calendar: DashboardCalendar
  alerts: { awaiting_me: number; acknowledged_by_me: number; items: DashboardAlertItem[] }
  inquiries: {
    open: number
    received_this_quarter: number
    closed_this_quarter: number
    age: KeyedCount[]
    categories: NamedCount[]
  }
  inquiry_trend: (PeriodRef & { received: number; closed: number })[]
  directives: { issued_open: number; needs_follow_up: number; items: DashboardDirectiveItem[] }
  referrals: NamedCount[]
}

/** FR-RPT-018's four states (ReportService::getComplianceDashboard()). */
export type ComplianceStatus = 'submitted_on_time' | 'submitted_late' | 'draft_in_progress' | 'not_started'

/** The four states' counts, plus the totals the dashboard reads. */
export interface ComplianceSummaryCounts extends Record<ComplianceStatus, number> {
  not_yet_submitted: number
  overdue: number
  vacant: number
  total: number
}

export interface MissionKpiHealth {
  mission_id: string
  mission_name: string
  counts: Record<PerformanceStatus, number>
  total: number
}

export interface LeadershipDashboard {
  view: 'leadership'
  variant: 'director' | 'executive'
  calendar: DashboardCalendar
  alerts: { this_quarter: number; previous_quarter: number; awaiting_action: number; unacknowledged: number }
  alert_trend: (PeriodRef & { opportunities: number; trade_barriers: number; other: number })[]
  inquiries: {
    open: number
    high_value_open: number
    closed_this_quarter: number
    closed_previous_quarter: number
    funnel: { logged: number; worked_on: number; resolved: number; closed: number; cancelled: number }
  }
  inquiry_trend: (PeriodRef & { received: number; closed: number })[]
  reports: {
    period: DashboardCalendar['reporting_period']
    summary: ComplianceSummaryCounts
    total: number
    attention: {
      mission_id: string
      mission_name: string
      status: ComplianceStatus
      submitted_at: string | null
      report_id: string | null
      is_overdue: boolean
      days_overdue: number | null
    }[]
    trend: (PeriodRef & { is_open: boolean; on_time: number; late: number; missing: number })[]
  }
  directives: { summary: DirectiveSummary; needs_attention: number; items: DashboardDirectiveItem[] }
  kpi: { cycle: PeriodRef; options: PeriodRef[]; missions: MissionKpiHealth[] }
  top_countries: NamedCount[]
  top_sectors: NamedCount[]
  alert_inbox?: DashboardAlertItem[]
}

export interface GeneralDashboard {
  view: 'general'
  calendar: DashboardCalendar
  assigned_alerts: { count: number; items: DashboardAlertItem[] }
  notifications: { unread: number; items: { id: string; message: string; link: string | null; created_at: string }[] }
}

export type OperationalDashboard = AttacheDashboard | HqOfficerDashboard | LeadershipDashboard | GeneralDashboard

/** GET /dashboard — the role-shaped home dashboard (App\Services\DashboardService). */
export async function getDashboard(kpiCycle?: string): Promise<OperationalDashboard> {
  const { data } = await client.get<ApiEnvelope<OperationalDashboard>>('/dashboard', {
    params: kpiCycle ? { kpi_cycle: kpiCycle } : undefined,
  })
  return data.data
}

// --- Administration (ADR-006) ---------------------------------------------

export type HealthStatus = 'pass' | 'warn' | 'fail'

export type HealthCheckKey =
  | 'system_administrators'
  | 'principal_secretaries'
  | 'ministry_administrators'
  | 'locked_accounts'
  | 'stale_invitations'
  | 'dormant_accounts'
  | 'vacant_attache_posts'
  | 'overdue_approvals'
  | 'configuration_gaps'
  | 'failed_jobs'

export interface HealthCheck {
  key: HealthCheckKey
  status: HealthStatus
  value: number
  detail?: string[]
}

export type ConfigurationListKey =
  | 'inquiry_categories'
  | 'alert_intelligence_types'
  | 'directive_types'
  | 'aie_budget_codes'
  | 'referral_organisations'
  | 'kpi_definitions'
  | 'report_template_sections'

export interface DepartmentHealth {
  id: string
  name: string
  active: boolean
  active_accounts: number
  ministry_administrators: { filled: number; limit: number }
  principal_secretary: { id: string; full_name: string } | null
  acting_ps: { id: string; full_name: string } | null
  designated_deputy_active: boolean
  attache_posts: { total: number; vacant: number }
  configuration: Record<ConfigurationListKey, number>
}

export type SignInRecencyKey = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'older' | 'never'

export interface AdministrationDashboard {
  scope: { type: 'platform' | 'department'; ministry: { id: string; name: string } | null }
  accounts: {
    total: number
    by_status: Record<'activation_pending' | 'active' | 'locked' | 'deactivated', number>
    sign_in_recency: { key: SignInRecencyKey; count: number }[]
    dormant: number
    never_signed_in: number
    stale_invitations: number
    close_to_locking: number
    by_role: { role: string; count: number }[]
  }
  sign_in_activity: { week_start: string; active_users: number; failed_attempts: number }[]
  departments: DepartmentHealth[]
  approvals: {
    pending: number
    overdue: number
    decided_last_90_days: number
    median_decision_hours: number | null
    items: { id: string; type: string; ministry_name: string | null; requested_by: string | null; subject: string | null; created_at: string }[]
  }
  health_checks: HealthCheck[]
  recent_activity: { id: string; action: string; actor: string | null; entity_type: string; created_at: string }[]
  platform: {
    system_administrators: number
    storage: { used_bytes: number; capacity_bytes: number; files: number }
    queue: { pending: number; failed: number }
    records: { alerts: number; inquiries: number; directives: number; periodic_reports: number }
  } | null
}

/** GET /admin/dashboard — System Administrator (every department) and Ministry Administrator (its own). */
export async function getAdministrationDashboard(ministryId?: string): Promise<AdministrationDashboard> {
  const { data } = await client.get<ApiEnvelope<AdministrationDashboard>>('/admin/dashboard', {
    params: ministryId ? { ministry: ministryId } : undefined,
  })
  return data.data
}
