import client, { type ApiEnvelope } from './client'

export type PeriodicReportStatus = 'draft' | 'submitted'
export type ReportSectionType = 'narrative' | 'structured_table'
export type ReportComplianceStatus = 'submitted_on_time' | 'submitted_late' | 'not_yet_submitted'

export interface ReportColumnSchema {
  name: string
  type: string
  mandatory?: boolean
}

export interface ReportMissionRef {
  id: string
  name: string
}

export interface ReportUserRef {
  id: string
  full_name: string
}

export interface ReportDataRow {
  id: string
  row_order: number
  row_data: Record<string, string | number | null>
}

/**
 * A report_sections row as embedded in PeriodicReportResource, joined with its
 * report_template_sections row (section_title/section_type/section_order/column_schema/
 * guidance_text). This is "the active template's sections" for this report instance —
 * ReportService::createDraftReport() (Session 25) instantiates one ReportSection per
 * active template section at draft-creation time, so this embedded list is a complete
 * substitute for calling GET /report-templates directly, which a Ministry Attache
 * cannot do (ReportPolicy::manageTemplate() is System-Administrator-only).
 */
export interface ReportSectionDetail {
  id: string
  report_template_section_id: string
  section_title: string | null
  section_type: ReportSectionType | null
  section_order: number | null
  column_schema: ReportColumnSchema[] | null
  guidance_text: string | null
  content: string | null
  data_rows: ReportDataRow[] | null
  updated_at: string
}

/** GET /periodic-reports list-row and GET/POST detail shape — App\Http\Resources\PeriodicReportResource. */
export interface PeriodicReport {
  id: string
  reporting_period_label: string
  period_start_date: string
  period_end_date: string
  template_version: number
  status: PeriodicReportStatus
  submitted_at: string | null
  is_late: boolean
  mission?: ReportMissionRef
  authored_by?: ReportUserRef
  sections?: ReportSectionDetail[]
  created_at: string
  updated_at: string
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
  status?: PeriodicReportStatus
  mission_id?: string
  reporting_period_label?: string
  page?: number
  per_page?: number
}

export interface CreateDraftReportRequest {
  reporting_period_label: string
  period_start_date: string
  period_end_date: string
}

export interface ComplianceMissionRow {
  mission_id: string
  mission_name: string
  status: ReportComplianceStatus
  submitted_at: string | null
}

/** GET /periodic-reports/compliance — App\Services\ReportService::getComplianceDashboard(). */
export interface ComplianceDashboard {
  period_label: string
  missions: ComplianceMissionRow[]
  summary: {
    submitted_on_time: number
    submitted_late: number
    not_yet_submitted: number
  }
}

/**
 * GET /periodic-reports — FR-RPT-018. PeriodicReportController::index() locks a Ministry
 * Attache to their own mission_id regardless of any mission_id filter; every other
 * ministry-scoped role sees all missions in their ministry, optionally filtered by mission_id.
 */
export async function listPeriodicReports(filters: PeriodicReportListFilters = {}): Promise<PeriodicReportListResponse> {
  const { data } = await client.get<PeriodicReportListResponse>('/periodic-reports', { params: filters })
  return data
}

/** POST /periodic-reports — FR-RPT-003, BR-007 (one draft per mission per period, enforced server-side). */
export async function createDraftReport(payload: CreateDraftReportRequest): Promise<PeriodicReport> {
  const { data } = await client.post<ApiEnvelope<PeriodicReport>>('/periodic-reports', payload)
  return data.data
}

/** GET /periodic-reports/{id} */
export async function getPeriodicReport(id: string): Promise<PeriodicReport> {
  const { data } = await client.get<ApiEnvelope<PeriodicReport>>(`/periodic-reports/${id}`)
  return data.data
}

/** PATCH /periodic-reports/{id}/sections/{sectionId} — FR-RPT-006, narrative section auto-save. */
export async function updateReportSection(reportId: string, sectionId: string, content: string): Promise<PeriodicReport> {
  const { data } = await client.patch<ApiEnvelope<PeriodicReport>>(
    `/periodic-reports/${reportId}/sections/${sectionId}`,
    { content },
  )
  return data.data
}

/**
 * POST /periodic-reports/{id}/data-rows — FR-RPT-007. section_id identifies the target
 * section in the request body, not a route segment (StoreReportDataRowRequest).
 */
export async function addReportDataRow(
  reportId: string,
  sectionId: string,
  rowData: Record<string, string | number | null>,
): Promise<PeriodicReport> {
  const { data } = await client.post<ApiEnvelope<PeriodicReport>>(`/periodic-reports/${reportId}/data-rows`, {
    section_id: sectionId,
    row_data: rowData,
  })
  return data.data
}

/** DELETE /periodic-reports/{id}/data-rows/{dataRowId} — FR-RPT-007. */
export async function removeReportDataRow(reportId: string, dataRowId: string): Promise<PeriodicReport> {
  const { data } = await client.delete<ApiEnvelope<PeriodicReport>>(`/periodic-reports/${reportId}/data-rows/${dataRowId}`)
  return data.data
}

/** POST /periodic-reports/{id}/carry-forward — FR-RPT-011. */
export async function carryForwardReport(reportId: string): Promise<PeriodicReport> {
  const { data } = await client.post<ApiEnvelope<PeriodicReport>>(`/periodic-reports/${reportId}/carry-forward`)
  return data.data
}

/** POST /periodic-reports/{id}/submit — FR-RPT-014, BR-009. Irreversible: the submitting attache can never edit again. */
export async function submitPeriodicReport(reportId: string): Promise<PeriodicReport> {
  const { data } = await client.post<ApiEnvelope<PeriodicReport>>(`/periodic-reports/${reportId}/submit`)
  return data.data
}

/** GET /periodic-reports/compliance — FR-RPT-018, Ministry HQ Director / Ministry PS only (ReportPolicy::viewCompliance()). */
export async function getReportComplianceDashboard(periodLabel?: string): Promise<ComplianceDashboard> {
  const { data } = await client.get<ApiEnvelope<ComplianceDashboard>>('/periodic-reports/compliance', {
    params: periodLabel ? { period_label: periodLabel } : undefined,
  })
  return data.data
}
