import client, { type ApiEnvelope } from './client'

export type PeriodicReportStatus = 'draft' | 'submitted'
export type ReportSectionType = 'narrative' | 'structured_table'
/** FR-RPT-018's four states. */
export type ReportComplianceStatus = 'submitted_on_time' | 'submitted_late' | 'draft_in_progress' | 'not_started'
/** FR-RPT-013: a section is left empty, started, or complete. */
export type SectionCompletion = 'empty' | 'started' | 'complete'
/** in_progress: the quarter is running; open: ended, deadline ahead; closed: deadline passed. */
export type ReportingPeriodPhase = 'upcoming' | 'in_progress' | 'open' | 'closed'
export type ReportTimeliness = 'on_time' | 'late' | 'overdue'
export type ReportListSort = '-period_start_date' | 'period_start_date' | '-submitted_at' | 'submitted_at' | 'mission'

export type CellValue = string | number | null

export interface ReportColumnSchema {
  name: string
  type: string
  mandatory?: boolean
  /** A selection column's configured option list, when there is one. */
  options?: string[] | null
}

/** FR-RPT-009: the auto-calculated total row of a structured table. */
export interface ReportTotalConfig {
  label: string
  label_column: string
  sum_columns: string[]
  exclude_labels: string[]
}

/** A structured table's behaviour (App\Models\ReportTemplateSection::table_config). */
export interface ReportTableConfig {
  /** FR-RPT-008: columns filled from master data on every new report. */
  label_columns: string[]
  prepopulated: boolean
  total: ReportTotalConfig | null
  max_rows: number
}

export interface ReportDataRow {
  id: string
  row_order: number
  row_data: Record<string, CellValue>
}

export interface ReportSectionDetail {
  id: string
  report_template_section_id: string
  section_title: string | null
  section_type: ReportSectionType | null
  section_order: number | null
  column_schema: ReportColumnSchema[] | null
  guidance_text: string | null
  table: ReportTableConfig | null
  content: string | null
  data_rows: ReportDataRow[] | null
  completion: SectionCompletion
  updated_at: string
}

export interface ReportProgress {
  total: number
  complete: number
  started: number
  empty: number
}

export interface ReportPersonRef {
  id: string
  full_name: string
}

export interface ReportMissionRef {
  id: string
  name: string
  city?: string | null
  host_country?: string | null
}

/** GET /periodic-reports list row — App\Http\Resources\PeriodicReportResource. */
export interface PeriodicReport {
  id: string
  reporting_period_label: string
  period_start_date: string
  period_end_date: string
  template_version: number
  status: PeriodicReportStatus
  submitted_at: string | null
  is_late: boolean
  /** YYYY-MM-DD: the 15th of the month after the period ends (BR-010). */
  deadline: string
  /** Whole days to the deadline by the server's clock (the one lateness is judged by); negative once passed. */
  days_to_deadline: number
  /** A draft whose deadline has passed. */
  is_overdue: boolean
  /** FR-RPT-016: days past the deadline for a late report or an overdue draft. */
  days_overdue: number | null
  compliance_status: ReportComplianceStatus
  mission?: ReportMissionRef | null
  ministry?: { id: string; name: string } | null
  authored_by?: ReportPersonRef | null
  /** Present on an attache's own list (FR-RPT-013). */
  progress?: ReportProgress
  last_edited_at?: string | null
  created_at: string
  updated_at: string
}

/** What the requesting user may do, computed server-side from ReportPolicy. */
export interface ReportAllowedActions {
  edit: boolean
  submit: boolean
  carry_forward: boolean
  discard: boolean
}

/** GET /periodic-reports/{id} and every mutation — App\Http\Resources\PeriodicReportDetailResource. */
export interface PeriodicReportDetail extends PeriodicReport {
  submitted_by: ReportPersonRef | null
  allowed_actions: ReportAllowedActions
  carry_forward_source: { id: string; reporting_period_label: string; submitted_at: string | null } | null
  sections: ReportSectionDetail[]
  progress: ReportProgress
}

export interface PeriodicReportListMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export interface PeriodicReportListResponse {
  data: PeriodicReport[]
  meta: PeriodicReportListMeta
}

export interface PeriodicReportListFilters {
  q?: string
  status?: PeriodicReportStatus
  mission_id?: string
  ministry_id?: string
  period?: string
  timeliness?: ReportTimeliness
  sort?: ReportListSort
  page?: number
  per_page?: number
}

export interface ReportingPeriod {
  label: string
  start: string
  end: string
  deadline: string
  phase: ReportingPeriodPhase
  /** Negative once the deadline has passed. */
  days_to_deadline: number
  /** The attache's own report for the period (attaches only). */
  report?: {
    id: string
    status: PeriodicReportStatus
    is_late: boolean
    submitted_at: string | null
    days_overdue: number | null
  } | null
}

/** GET /periodic-reports/periods. */
export interface ReportPeriods {
  current: ReportingPeriod
  periods: ReportingPeriod[]
  missions: { id: string; name: string }[]
  can_create: boolean
}

export interface ComplianceMissionRow {
  mission_id: string
  mission_name: string
  mission_city: string | null
  host_country: string | null
  /** Null when the post is vacant. */
  attache: ReportPersonRef | null
  status: ReportComplianceStatus
  /** Only for a submitted report: HQ reads submitted reports only. */
  report_id: string | null
  submitted_at: string | null
  is_late: boolean
  is_overdue: boolean
  days_overdue: number | null
  /** A draft's section progress; never its content. */
  progress: ReportProgress | null
  last_activity_at: string | null
}

export interface ComplianceSummary {
  submitted_on_time: number
  submitted_late: number
  draft_in_progress: number
  not_started: number
  not_yet_submitted: number
  overdue: number
  vacant: number
  total: number
}

export interface ComplianceHistoryCell {
  label: string
  status: ReportComplianceStatus
  is_overdue: boolean
  report_id: string | null
}

export interface ComplianceHistory {
  periods: ReportingPeriod[]
  missions: { mission_id: string; mission_name: string; cells: ComplianceHistoryCell[] }[]
  totals: ({ label: string } & Record<ReportComplianceStatus, number>)[]
}

/** GET /periodic-reports/compliance and GET /sdt/reports/compliance — ReportService::complianceBoard(). */
export interface ComplianceDashboard {
  period_label: string
  period: ReportingPeriod | null
  missions: ComplianceMissionRow[]
  summary: ComplianceSummary
  available_periods: ReportingPeriod[]
  history: ComplianceHistory
}

/** A table row as the editor sends it: a client-generated id is accepted for a new row. */
export interface ReportRowPayload {
  id: string
  row_data: Record<string, CellValue>
}

/**
 * GET /periodic-reports — FR-RPT-017. The server applies each role's visibility (an attache
 * sees their own mission, drafts included; HQ roles and Heads of Mission see submitted
 * reports only), so a filter can narrow but never widen what comes back.
 */
export async function listPeriodicReports(filters: PeriodicReportListFilters = {}): Promise<PeriodicReportListResponse> {
  const { data } = await client.get<PeriodicReportListResponse>('/periodic-reports', { params: filters })
  return data
}

/** GET /periodic-reports/periods — the reporting calendar for the pickers. */
export async function getReportPeriods(): Promise<ReportPeriods> {
  const { data } = await client.get<ApiEnvelope<ReportPeriods>>('/periodic-reports/periods')
  return data.data
}

/**
 * POST /periodic-reports — FR-RPT-003. A 422 whose data names `existing_report` means the
 * mission already has a report for the period (BR-007): open that one instead.
 */
export async function createDraftReport(periodLabel: string): Promise<PeriodicReportDetail> {
  const { data } = await client.post<ApiEnvelope<PeriodicReportDetail>>('/periodic-reports', {
    reporting_period_label: periodLabel,
  })
  return data.data
}

/** GET /periodic-reports/{id} */
export async function getPeriodicReport(id: string): Promise<PeriodicReportDetail> {
  const { data } = await client.get<ApiEnvelope<PeriodicReportDetail>>(`/periodic-reports/${id}`)
  return data.data
}

/** PATCH /periodic-reports/{id}/sections/{sectionId} — FR-RPT-006, a narrative section's auto-save. */
export async function saveSectionContent(reportId: string, sectionId: string, content: string): Promise<PeriodicReportDetail> {
  const { data } = await client.patch<ApiEnvelope<PeriodicReportDetail>>(`/periodic-reports/${reportId}/sections/${sectionId}`, {
    content,
  })
  return data.data
}

/**
 * PATCH /periodic-reports/{id}/sections/{sectionId} — FR-RPT-007: a table's rows as a
 * whole, in display order. Adds, edits, reorders and removes rows in one save.
 */
export async function saveSectionRows(reportId: string, sectionId: string, rows: ReportRowPayload[]): Promise<PeriodicReportDetail> {
  const { data } = await client.patch<ApiEnvelope<PeriodicReportDetail>>(`/periodic-reports/${reportId}/sections/${sectionId}`, {
    rows,
  })
  return data.data
}

/** POST /periodic-reports/{id}/carry-forward — FR-RPT-011, one table's rows from the last submitted report. */
export async function carryForwardSection(reportId: string, sectionId: string): Promise<PeriodicReportDetail> {
  const { data } = await client.post<ApiEnvelope<PeriodicReportDetail>>(`/periodic-reports/${reportId}/carry-forward`, {
    section_id: sectionId,
  })
  return data.data
}

/** POST /periodic-reports/{id}/submit — FR-RPT-014, BR-009. Irreversible: the report locks. */
export async function submitPeriodicReport(reportId: string): Promise<PeriodicReportDetail> {
  const { data } = await client.post<ApiEnvelope<PeriodicReportDetail>>(`/periodic-reports/${reportId}/submit`)
  return data.data
}

/** DELETE /periodic-reports/{id} — discards a draft (never a submitted report). */
export async function discardDraftReport(reportId: string): Promise<void> {
  await client.delete(`/periodic-reports/${reportId}`)
}

/** GET /periodic-reports/compliance — FR-RPT-018: Ministry HQ Director, Ministry PS and Acting PS. */
export async function getReportComplianceDashboard(periodLabel?: string): Promise<ComplianceDashboard> {
  const { data } = await client.get<ApiEnvelope<ComplianceDashboard>>('/periodic-reports/compliance', {
    params: periodLabel ? { period_label: periodLabel } : undefined,
  })
  return data.data
}
