import client, { type ApiEnvelope } from './client'

/**
 * Referral Register Engine (API-001 Section 10, FR-REF-001 to 006). An
 * inquiry's referral history is embedded in GET /inquiries/{id}
 * (InquiryDetail.referrals); there is no separate list endpoint.
 */

export interface ReferralOrganisation {
  id: string
  ministry_id: string
  name: string
  active: boolean
}

export interface ReferralUserRef {
  id: string
  full_name: string
}

/** POST /inquiries/{id}/referrals response shape — App\Http\Resources\ReferralResource. */
export interface ReferralEntry {
  id: string
  inquiry_id: string
  referral_organisation?: { id: string; name: string }
  contact_person: string | null
  referral_date: string
  referral_method: string | null
  reference_number: string | null
  remarks: string | null
  created_by?: ReferralUserRef
  created_at: string
}

export interface ReferralAttachment {
  id: string
  referral_entry_id: string
  original_filename: string
  file_size_bytes: number
  mime_type: string
  uploaded_by_user_id: string
  created_at: string
}

export interface ReferralCreateRequest {
  referral_organisation_id: string
  contact_person?: string
  referral_date: string
  referral_method?: string
  reference_number?: string
  remarks?: string
}

export interface ReferralSummary {
  by_organisation: Record<string, number>
  by_mission: Record<string, number>
  by_country: Record<string, number>
  by_sector: Record<string, number>
  by_period: Record<string, number>
}

/** GET /referral-organisations — FR-REF-001 */
export async function getReferralOrganisations(): Promise<ReferralOrganisation[]> {
  const { data } = await client.get<ApiEnvelope<ReferralOrganisation[]>>('/referral-organisations')
  return data.data
}

/** POST /inquiries/{inquiry_id}/referrals — FR-REF-002, FR-REF-003 */
export async function recordReferral(inquiryId: string, payload: ReferralCreateRequest): Promise<ReferralEntry> {
  const { data } = await client.post<ApiEnvelope<ReferralEntry>>(`/inquiries/${inquiryId}/referrals`, payload)
  return data.data
}

/** POST /referrals/{id}/attachments — FR-REF-004 */
export async function uploadReferralAttachment(referralId: string, file: File): Promise<ReferralAttachment> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post<ApiEnvelope<ReferralAttachment>>(`/referrals/${referralId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

/** GET /referrals/summary — FR-REF-005 */
export async function getReferralSummary(): Promise<ReferralSummary> {
  const { data } = await client.get<ApiEnvelope<ReferralSummary>>('/referrals/summary')
  return data.data
}

/** GET /referrals/{id}/attachments/{attachmentId} — a signed download URL that expires after 15 minutes (NFR-SEC-004). */
export async function getReferralAttachmentDownloadUrl(referralId: string, attachmentId: string): Promise<string> {
  const { data } = await client.get<ApiEnvelope<{ url: string; expires_at: string }>>(
    `/referrals/${referralId}/attachments/${attachmentId}`,
  )
  return data.data.url
}
