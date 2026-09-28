import client, { type ApiEnvelope } from './client'

export type InquirySubType = 'standard' | 'dispute_or_complaint'

/** SDT-configured workflow statuses (CLAUDE.md Section 8). */
export type InquiryStatus =
  | 'draft'
  | 'received'
  | 'in_progress'
  | 'pending_external_response'
  | 'resolved'
  | 'closed'
  | 'cancelled'

/** SDT-configured operational event types (CLAUDE.md Section 8), plus the system-generated status_changed case. */
export type InquiryEventType =
  | 'hq_notified'
  | 'referral_made'
  | 'feedback_received'
  | 'reminder_sent'
  | 'follow_up_completed'
  | 'status_changed'

export interface InquiryCategory {
  id: string
  value: string
  display_order: number
}

export interface InquiryMissionRef {
  id: string
  name: string
}

export interface InquiryUserRef {
  id: string
  full_name: string
}

/** GET /inquiries list-item shape — App\Http\Resources\InquiryResource. */
export interface Inquiry {
  id: string
  reference_number: string
  category: string
  sub_type: InquirySubType
  inquirer_name: string
  product_or_sector: string | null
  status: InquiryStatus
  high_value_flag: boolean
  date_received: string
  mission?: InquiryMissionRef
  logged_by?: InquiryUserRef
  created_at: string
}

export interface InquiryNote {
  id: string
  content: string
  authored_by: InquiryUserRef | null
  created_at: string
}

/** InquiryDetailResource's linked_inquiry shape (Session 34, FR-INQ-019 AC2). */
export interface InquiryLinkRef {
  id: string
  reference_number: string
  mission: string | null
}

/** One entry of InquiryDetailResource's `referrals` history, ordered by referral date (FR-REF-006). */
export interface InquiryReferral {
  id: string
  referral_organisation: { id: string; name: string } | null
  contact_person: string | null
  referral_date: string
  referral_method: string | null
  reference_number: string | null
  remarks: string | null
  created_by: InquiryUserRef | null
  attachments: InquiryReferralAttachment[]
  created_at: string
}

export interface InquiryReferralAttachment {
  id: string
  original_filename: string
  file_size_bytes: number
  mime_type: string
}

export interface InquiryEvent {
  id: string
  event_type: InquiryEventType
  note: string | null
  logged_by: InquiryUserRef | null
  created_at: string
}

/** GET /inquiries/{id} shape — App\Http\Resources\InquiryDetailResource. */
export interface InquiryDetail {
  id: string
  reference_number: string
  category: string
  sub_type: InquirySubType
  inquirer_name: string
  inquirer_organisation: string | null
  inquirer_email: string | null
  inquirer_phone: string | null
  product_or_sector: string | null
  description: string | null
  date_received: string
  status: InquiryStatus
  high_value_flag: boolean
  high_value_justification: string | null
  resolution_summary: string | null
  closed_at: string | null
  linked_inquiry?: InquiryLinkRef | null
  mission?: InquiryMissionRef
  logged_by?: InquiryUserRef
  notes: InquiryNote[]
  events: InquiryEvent[]
  referrals: InquiryReferral[]
  created_at: string
  updated_at: string
}

export interface InquiryListFilters {
  status?: InquiryStatus
  category?: string
  high_value_flag?: boolean
  mission_id?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
  sort?: string
}

export interface InquiryCreateRequest {
  category: string
  sub_type: InquirySubType
  inquirer_name: string
  inquirer_organisation?: string
  inquirer_email?: string
  inquirer_phone?: string
  product_or_sector?: string
  description?: string
  date_received: string
  high_value_flag?: boolean
  high_value_justification?: string
}

/** PATCH /inquiries/{id} — UpdateInquiryRequest accepts every create field as `sometimes`, sub_type included; nullable fields may be cleared with null. */
export interface InquiryUpdateRequest {
  category?: string
  sub_type?: InquirySubType
  inquirer_name?: string
  inquirer_organisation?: string | null
  inquirer_email?: string | null
  inquirer_phone?: string | null
  product_or_sector?: string | null
  description?: string | null
  date_received?: string
  high_value_flag?: boolean
  high_value_justification?: string | null
}

export interface InquiryStatusTransitionRequest {
  status: InquiryStatus
}

export interface InquiryEventRequest {
  event_type: Exclude<InquiryEventType, 'status_changed'>
  note?: string
}

/** POST /inquiries/{id}/notes' own response — flatter than the notes embedded in InquiryDetail. */
export interface PostedInquiryNote {
  id: string
  content: string
  authored_by_user_id: string
  created_at: string
}

export interface InquiryNoteRequest {
  content: string
}

export interface InquiryCloseRequest {
  resolution_summary: string
}

/**
 * GET /master-data?category=inquiry_category — FR-INQ-001. There is no
 * `/inquiry-categories` route on the backend (it 404s); the configured
 * categories are master-data rows, served by the same public endpoint the
 * alert form uses for its intelligence types.
 */
export async function getInquiryCategories(): Promise<InquiryCategory[]> {
  const { data } = await client.get<ApiEnvelope<InquiryCategory[]>>('/master-data', {
    params: { category: 'inquiry_category', active: 1 },
  })
  return data.data
}

/** GET /inquiries — FR-INQ-015, FR-INQ-018 */
export async function listInquiries(filters: InquiryListFilters = {}): Promise<ApiEnvelope<Inquiry[]>> {
  const { data } = await client.get<ApiEnvelope<Inquiry[]>>('/inquiries', { params: filters })
  return data
}

/** POST /inquiries — FR-INQ-002, FR-INQ-003 */
export async function logInquiry(payload: InquiryCreateRequest): Promise<Inquiry> {
  const { data } = await client.post<ApiEnvelope<Inquiry>>('/inquiries', payload)
  return data.data
}

/** GET /inquiries/{id} — FR-INQ-002 */
export async function getInquiry(id: string): Promise<InquiryDetail> {
  const { data } = await client.get<ApiEnvelope<InquiryDetail>>(`/inquiries/${id}`)
  return data.data
}

/**
 * PATCH /inquiries/{id} — FR-INQ-004. InquiryController::update() returns
 * `new InquiryDetailResource($inquiry->fresh(DETAIL_RELATIONS))`, the same
 * detail shape as GET /inquiries/{id}, not the list-row Inquiry shape.
 */
export async function updateInquiry(id: string, payload: InquiryUpdateRequest): Promise<InquiryDetail> {
  const { data } = await client.patch<ApiEnvelope<InquiryDetail>>(`/inquiries/${id}`, payload)
  return data.data
}

/** PATCH /inquiries/{id}/status — FR-INQ-006. Returns the InquiryDetailResource shape (see updateInquiry note). */
export async function transitionInquiryStatus(id: string, payload: InquiryStatusTransitionRequest): Promise<InquiryDetail> {
  const { data } = await client.patch<ApiEnvelope<InquiryDetail>>(`/inquiries/${id}/status`, payload)
  return data.data
}

/** POST /inquiries/{id}/events — FR-INQ-008. Returns the updated InquiryDetailResource, not the bare event. */
export async function logInquiryEvent(id: string, payload: InquiryEventRequest): Promise<InquiryDetail> {
  const { data } = await client.post<ApiEnvelope<InquiryDetail>>(`/inquiries/${id}/events`, payload)
  return data.data
}

/** POST /inquiries/{id}/notes — FR-INQ-014 */
export async function addInquiryNote(id: string, payload: InquiryNoteRequest): Promise<PostedInquiryNote> {
  const { data } = await client.post<ApiEnvelope<PostedInquiryNote>>(`/inquiries/${id}/notes`, payload)
  return data.data
}

/** POST /inquiries/{id}/close — FR-INQ-012. Returns the InquiryDetailResource shape (see updateInquiry note). */
export async function closeInquiry(id: string, payload: InquiryCloseRequest): Promise<InquiryDetail> {
  const { data } = await client.post<ApiEnvelope<InquiryDetail>>(`/inquiries/${id}/close`, payload)
  return data.data
}

/**
 * POST /inquiries/{id}/link — FR-INQ-019. One endpoint serving both halves of the
 * requirement (App\Http\Controllers\Api\Inquiries\InquiryController::link()):
 * omitting target_inquiry_id (findInquiryMatches() below) returns suggested
 * matches without persisting anything; supplying one (linkInquiry() here)
 * confirms and persists a symmetric link, returning the full InquiryDetailResource
 * shape, not the list-row Inquiry shape the field was previously typed as.
 * Body param is `target_inquiry_id` (LinkInquiryRequest), not `linked_inquiry_id`.
 */
export async function linkInquiry(id: string, targetInquiryId: string): Promise<InquiryDetail> {
  const { data } = await client.post<ApiEnvelope<InquiryDetail>>(`/inquiries/${id}/link`, {
    target_inquiry_id: targetInquiryId,
  })
  return data.data
}

/**
 * POST /inquiries/{id}/link with no target_inquiry_id — FR-INQ-019 AC1.
 * InquiryMatchingService::findMatches() ranks candidates by ts_rank and the
 * controller returns InquiryResource::collection() in that same rank order
 * (highest relevance first); the resource itself carries no numeric score,
 * so callers use list position as the relevance signal.
 */
export async function findInquiryMatches(id: string): Promise<Inquiry[]> {
  const { data } = await client.post<ApiEnvelope<Inquiry[]>>(`/inquiries/${id}/link`, {})
  return data.data
}

/** GET /inquiries/export — FR-INQ-017 */
export async function exportInquiries(filters: InquiryListFilters = {}): Promise<Blob> {
  const { data } = await client.get<Blob>('/inquiries/export', { params: filters, responseType: 'blob' })
  return data
}
