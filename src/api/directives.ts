import client, { type ApiEnvelope } from './client'

/**
 * App\Enums\DirectiveStatus. 'draft' and 'closed' exist on the enum but are never actually
 * reachable through the API: issueDirective() creates the row as draft then immediately
 * transitions it to issued within the same transaction (Session 27 note), and no code path
 * ever sets 'closed'.
 */
export type DirectiveStatus = 'draft' | 'issued' | 'acknowledged' | 'in_progress' | 'completed' | 'cancelled' | 'closed'

/** The subset of DirectiveStatus that UpdateDirectiveStatusRequest actually accepts. */
export type DirectiveActionableStatus = 'acknowledged' | 'in_progress' | 'completed' | 'cancelled'

export interface DirectiveTypeOption {
  id: string
  value: string
  display_order: number
}

export interface DirectiveMissionRef {
  id: string
  name: string
}

export interface DirectiveUserRef {
  id: string
  full_name: string
}

/** GET /directives list-item shape — App\Http\Resources\DirectiveResource. No reference_number
 * column exists on the directives table (CLAUDE.md Section 6), unlike alerts/inquiries. */
export interface Directive {
  id: string
  type_category: string | null
  description: string
  status: DirectiveStatus
  target_completion_date: string | null
  last_progress_update_at: string | null
  mission?: DirectiveMissionRef
  target_user?: DirectiveUserRef
  issued_by?: DirectiveUserRef
  created_at: string
}

export interface DirectiveNote {
  id: string
  content: string
  authored_by: DirectiveUserRef | null
  created_at: string
}

/** GET /directives/{id} shape — App\Http\Resources\DirectiveDetailResource. */
export interface DirectiveDetail {
  id: string
  type_category: string | null
  description: string
  status: DirectiveStatus
  target_completion_date: string | null
  completion_summary: string | null
  last_progress_update_at: string | null
  mission?: DirectiveMissionRef
  target_user?: DirectiveUserRef
  issued_by?: DirectiveUserRef
  notes: DirectiveNote[]
  created_at: string
  updated_at: string
}

/**
 * POST /directives/{id}/notes's raw response shape — a flat `authored_by_user_id`, unlike
 * the nested `authored_by` object DirectiveNote carries when embedded in GET /directives/{id}
 * (DirectiveDetailResource). Mirrors api/alerts.ts's PostedAlertFeedback precedent (Session 21):
 * callers should invalidate/refetch the directive detail query rather than merge this
 * response directly into a notes thread built from DirectiveNote[].
 */
export interface PostedDirectiveNote {
  id: string
  content: string
  authored_by_user_id: string
  created_at: string
}

export interface DirectiveListFilters {
  status?: DirectiveStatus
  mission_id?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
}

export interface DirectiveListMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export interface DirectiveListResponse {
  data: Directive[]
  meta: DirectiveListMeta
}

export interface DirectiveCreateRequest {
  mission_id: string
  target_user_id: string
  type_category?: string
  description: string
  target_completion_date?: string
}

export interface DirectiveStatusTransitionRequest {
  status: DirectiveActionableStatus
  /** Required when status is 'completed' (FR-DIR-007); doubles as an optional progress note otherwise. */
  note?: string
}

export interface DirectiveNoteRequest {
  content: string
}

/** GET /directives/summary — FR-DIR-012. App\Services\DirectiveService::getSummary(). */
export interface DirectiveSummary {
  total: number
  completed: number
  in_progress: number
  issued: number
  acknowledged: number
  cancelled: number
  overdue: number
  percentages: {
    completed: number
    in_progress: number
    overdue: number
  }
}

/**
 * GET /master-data?category=directive_type — FR-DIR-002. CLAUDE.md Section 8 records that
 * directive_type was deliberately left unseeded at go-live (no fixed category list), so this
 * list may legitimately come back empty until a System Administrator configures entries via
 * Sdt\ConfigController::storeDirectiveSetting() (Session 27); type_category stays optional
 * on the issue form either way (StoreDirectiveRequest: 'nullable').
 */
export async function getDirectiveTypeOptions(): Promise<DirectiveTypeOption[]> {
  const { data } = await client.get<ApiEnvelope<DirectiveTypeOption[]>>('/master-data', {
    params: { category: 'directive_type' },
  })
  return data.data
}

/** GET /directives — FR-DIR-005, FR-DIR-009. Server-side scoping per role (see DirectivePolicy::view()). */
export async function listDirectives(filters: DirectiveListFilters = {}): Promise<DirectiveListResponse> {
  const { data } = await client.get<DirectiveListResponse>('/directives', { params: filters })
  return data
}

/** POST /directives — FR-DIR-002, FR-DIR-003. Ministry HQ Officer / Ministry PS only (DirectivePolicy::create()). */
export async function issueDirective(payload: DirectiveCreateRequest): Promise<Directive> {
  const { data } = await client.post<ApiEnvelope<Directive>>('/directives', payload)
  return data.data
}

/** GET /directives/{id} */
export async function getDirective(id: string): Promise<DirectiveDetail> {
  const { data } = await client.get<ApiEnvelope<DirectiveDetail>>(`/directives/${id}`)
  return data.data
}

/** PATCH /directives/{id}/status — FR-DIR-006, FR-DIR-007. Target attache only (DirectivePolicy::transitionStatus()). */
export async function transitionDirectiveStatus(
  id: string,
  payload: DirectiveStatusTransitionRequest,
): Promise<DirectiveDetail> {
  const { data } = await client.patch<ApiEnvelope<DirectiveDetail>>(`/directives/${id}/status`, payload)
  return data.data
}

/** POST /directives/{id}/notes — FR-DIR-008, FR-DIR-011. Target attache or issuing HQ officer. */
export async function addDirectiveNote(id: string, payload: DirectiveNoteRequest): Promise<PostedDirectiveNote> {
  const { data } = await client.post<ApiEnvelope<PostedDirectiveNote>>(`/directives/${id}/notes`, payload)
  return data.data
}

/** GET /directives/summary — FR-DIR-012. Ministry HQ Director / Ministry PS only (DirectivePolicy::viewSummary()). */
export async function getDirectiveSummary(): Promise<DirectiveSummary> {
  const { data } = await client.get<ApiEnvelope<DirectiveSummary>>('/directives/summary')
  return data.data
}
