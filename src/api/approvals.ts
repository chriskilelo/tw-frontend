import client, { type ApiEnvelope } from './client'

export type ApprovalRequestType = 'ps_appointment' | 'ps_promotion' | 'ps_deactivation' | 'ps_succession'
export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

interface PersonRef {
  id: string
  full_name: string
}

/** App\Http\Resources\ApprovalRequestResource — FR-AUTH-022/023, BR-027. */
export interface ApprovalRequest {
  id: string
  type: ApprovalRequestType
  status: ApprovalRequestStatus
  ministry?: { id: string; name: string }
  requested_by?: PersonRef | null
  subject_user?: PersonRef | null
  /** New-person details for an appointment ({full_name, email}) or a succession (incoming_*). */
  payload: Record<string, string> | null
  decided_by?: PersonRef | null
  decided_at: string | null
  decision_reason: string | null
  created_at: string
}

export interface ApprovalRequestFilters {
  page?: number
  per_page?: number
  status?: ApprovalRequestStatus
}

export async function listApprovalRequests(filters: ApprovalRequestFilters = {}): Promise<ApiEnvelope<ApprovalRequest[]>> {
  const { data } = await client.get<ApiEnvelope<ApprovalRequest[]>>('/approval-requests', { params: filters })
  return data
}

export async function getApprovalRequest(id: string): Promise<ApprovalRequest> {
  const { data } = await client.get<ApiEnvelope<ApprovalRequest>>(`/approval-requests/${id}`)
  return data.data
}

/** Ministry Administrator: request a brand-new account as PS. */
export async function requestPsAppointment(payload: { full_name: string; email: string }): Promise<ApprovalRequest> {
  const { data } = await client.post<ApiEnvelope<ApprovalRequest>>('/approval-requests/ps-appointment', payload)
  return data.data
}

/** Ministry Administrator: request that an existing department account become PS. */
export async function requestPsPromotion(userId: string): Promise<ApprovalRequest> {
  const { data } = await client.post<ApiEnvelope<ApprovalRequest>>('/approval-requests/ps-promotion', { user_id: userId })
  return data.data
}

/** Ministry Administrator: request the deactivation of the sitting PS. */
export async function requestPsDeactivation(userId: string): Promise<ApprovalRequest> {
  const { data } = await client.post<ApiEnvelope<ApprovalRequest>>('/approval-requests/ps-deactivation', { user_id: userId })
  return data.data
}

export interface PsSuccessionPayload {
  outgoing_user_id: string
  incoming_user_id?: string
  incoming_full_name?: string
  incoming_email?: string
}

/** Ministry Administrator: replace the sitting PS in one step. */
export async function requestPsSuccession(payload: PsSuccessionPayload): Promise<ApprovalRequest> {
  const { data } = await client.post<ApiEnvelope<ApprovalRequest>>('/approval-requests/ps-succession', payload)
  return data.data
}

/** System Administrator only. */
export async function approveApprovalRequest(id: string): Promise<ApprovalRequest> {
  const { data } = await client.post<ApiEnvelope<ApprovalRequest>>(`/approval-requests/${id}/approve`)
  return data.data
}

/** System Administrator only; a reason is mandatory. */
export async function rejectApprovalRequest(id: string, reason: string): Promise<ApprovalRequest> {
  const { data } = await client.post<ApiEnvelope<ApprovalRequest>>(`/approval-requests/${id}/reject`, { reason })
  return data.data
}

/** The requesting Ministry Administrator, while still pending. */
export async function cancelApprovalRequest(id: string): Promise<ApprovalRequest> {
  const { data } = await client.post<ApiEnvelope<ApprovalRequest>>(`/approval-requests/${id}/cancel`)
  return data.data
}
