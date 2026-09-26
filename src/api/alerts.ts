import client, { type ApiEnvelope } from './client'

export type AlertStatus = 'new' | 'assigned' | 'acknowledged'
export type AlertIntelligenceType = 'opportunities' | 'trade_barriers'

export interface MasterDataEntryOption {
  id: string
  ministry_id: string | null
  category: string
  value: string
  display_order: number
  active: boolean
}

export interface AlertMissionRef {
  id: string
  name: string
}

export interface AlertUserRef {
  id: string
  full_name: string
}

/** GET /alerts list-item shape — App\Http\Resources\AlertResource. */
export interface Alert {
  id: string
  reference_number: string
  country: string
  sector: string | null
  product_category: string | null
  intelligence_type: AlertIntelligenceType
  urgency: string | null
  status: AlertStatus
  mission?: AlertMissionRef
  submitted_by?: AlertUserRef
  assigned_to_user_id: string | null
  created_at: string
}

export interface AlertFeedback {
  id: string
  content: string
  posted_by: AlertUserRef | null
  created_at: string
}

export interface AlertVersion {
  id: string
  snapshot: Record<string, unknown>
  edited_by_user_id: string
  created_at: string
}

export interface AlertAttachment {
  id: string
  original_filename: string
  file_size_bytes: number
  mime_type: string
  created_at: string
}

/** GET /alerts/{id} shape — App\Http\Resources\AlertDetailResource. */
export interface AlertDetail {
  id: string
  reference_number: string
  country: string
  sector: string | null
  product_category: string | null
  product_description: string | null
  intelligence_type: AlertIntelligenceType
  intelligence_source: string | null
  urgency: string | null
  confidence_rating: string | null
  tags: string[] | null
  status: AlertStatus
  mission?: AlertMissionRef
  submitted_by?: AlertUserRef
  assigned_to: AlertUserRef | null
  attachments: AlertAttachment[]
  feedback: AlertFeedback[]
  versions: AlertVersion[]
  created_at: string
  updated_at: string
}

export interface AlertListFilters {
  mission_id?: string
  country?: string
  intelligence_type?: AlertIntelligenceType
  status?: AlertStatus
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
  sort?: string
}

export interface AlertCreateRequest {
  country: string
  intelligence_type: AlertIntelligenceType
  sector?: string
  product_category?: string
  product_description?: string
  intelligence_source?: string
  urgency?: string
  confidence_rating?: string
  tags?: string[]
}

/** Matches UpdateAlertRequest::rules(): every field, including intelligence_type, is `sometimes`. */
export type AlertUpdateRequest = Partial<AlertCreateRequest>

export interface AlertDelegateRequest {
  delegate_user_ids: string[]
  note?: string
}

export interface AlertFeedbackRequest {
  content: string
}

/**
 * POST /alerts/{id}/feedback's raw response shape — a flat
 * `posted_by_user_id`, unlike the nested `posted_by` object AlertFeedback
 * carries when embedded in GET /alerts/{id} (AlertDetailResource). Callers
 * should invalidate/refetch the alert detail query rather than merge this
 * response directly into a feedback thread built from AlertFeedback[].
 */
export interface PostedAlertFeedback {
  id: string
  content: string
  posted_by_user_id: string
  created_at: string
}

/**
 * GET /master-data?category=alert_intelligence_type — FR-ALERT-001. The
 * literal `/alert-fields` path (Api\Sdt\ConfigController::alertFields()) is
 * System-Administrator-only config management (MasterDataEntryPolicy::
 * manage(), CLAUDE.md Session 13/14 notes) and cannot be called by the
 * Ministry Attache submitting an alert. The public `/master-data` endpoint
 * (Session 13, open to any authenticated user for dropdown population) is
 * the correct, reachable source for the configured Intelligence Type
 * option list; every other alert form field is fixed per CLAUDE.md
 * Section 8's Alert Field Schema table, since no other alert-field
 * category is seeded.
 */
export async function getAlertIntelligenceTypeOptions(): Promise<MasterDataEntryOption[]> {
  const { data } = await client.get<ApiEnvelope<MasterDataEntryOption[]>>('/master-data', {
    params: { category: 'alert_intelligence_type' },
  })
  return data.data
}

/** GET /alerts — FR-ALERT-006, FR-ALERT-014 */
export async function listAlerts(filters: AlertListFilters = {}): Promise<ApiEnvelope<Alert[]>> {
  const { data } = await client.get<ApiEnvelope<Alert[]>>('/alerts', { params: filters })
  return data
}

/** POST /alerts — FR-ALERT-002 */
export async function submitAlert(payload: AlertCreateRequest): Promise<Alert> {
  const { data } = await client.post<ApiEnvelope<Alert>>('/alerts', payload)
  return data.data
}

/** GET /alerts/{id} — FR-ALERT-006 */
export async function getAlert(id: string): Promise<AlertDetail> {
  const { data } = await client.get<ApiEnvelope<AlertDetail>>(`/alerts/${id}`)
  return data.data
}

/** PATCH /alerts/{id} — FR-ALERT-011, FR-ALERT-012. Returns the AlertDetailResource shape. */
export async function updateAlert(id: string, payload: AlertUpdateRequest): Promise<AlertDetail> {
  const { data } = await client.patch<ApiEnvelope<AlertDetail>>(`/alerts/${id}`, payload)
  return data.data
}

/** POST /alerts/{id}/attachments — FR-ALERT-003 */
export async function uploadAlertAttachment(id: string, file: File): Promise<AlertAttachment> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post<ApiEnvelope<AlertAttachment>>(`/alerts/${id}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

/** GET /alerts/{id}/attachments/{attachmentId} — a signed download URL that expires after 15 minutes (NFR-SEC-004). */
export async function getAlertAttachmentDownloadUrl(id: string, attachmentId: string): Promise<string> {
  const { data } = await client.get<ApiEnvelope<{ url: string; expires_at: string }>>(
    `/alerts/${id}/attachments/${attachmentId}`,
  )
  return data.data.url
}

/** POST /alerts/{id}/delegate — FR-ALERT-007, FR-SDT-002. Returns the AlertDetailResource shape. */
export async function delegateAlert(id: string, payload: AlertDelegateRequest): Promise<AlertDetail> {
  const { data } = await client.post<ApiEnvelope<AlertDetail>>(`/alerts/${id}/delegate`, payload)
  return data.data
}

/** POST /alerts/{id}/acknowledge — FR-ALERT-009. Returns the AlertDetailResource shape. */
export async function acknowledgeAlert(id: string): Promise<AlertDetail> {
  const { data } = await client.post<ApiEnvelope<AlertDetail>>(`/alerts/${id}/acknowledge`)
  return data.data
}

/** POST /alerts/{id}/feedback — FR-ALERT-010 */
export async function postAlertFeedback(id: string, payload: AlertFeedbackRequest): Promise<PostedAlertFeedback> {
  const { data } = await client.post<ApiEnvelope<PostedAlertFeedback>>(`/alerts/${id}/feedback`, payload)
  return data.data
}

/** PATCH /alert-routing/designated-deputy — FR-ALERT-008, FR-SDT-003 */
export async function setDesignatedDeputy(payload: { user_id: string | null; active: boolean }): Promise<void> {
  await client.patch('/alert-routing/designated-deputy', payload)
}
