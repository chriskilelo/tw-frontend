import client, { type ApiEnvelope } from './client'

/**
 * Referral Register Engine (API-001 Section 10, FR-REF-001 to 006).
 *
 * There is no `GET` endpoint that lists a given inquiry's referral entries
 * (App\Http\Controllers\Api\Referrals\ReferralController has no `index`
 * scoped to an inquiry, and InquiryDetailResource does not embed referrals)
 * — only `POST /inquiries/{id}/referrals` exists. InquiryDetailPage
 * therefore renders referrals recorded during the current session (from
 * this POST's own response) rather than a persisted, refetchable list; a
 * future session adding a real list endpoint should replace that with a
 * proper query, following the same pattern as prior documented backend
 * gaps (e.g. AlertDetailPage's delegate-picker note).
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
