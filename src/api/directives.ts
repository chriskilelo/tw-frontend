import client, { type ApiEnvelope } from './client'

/**
 * App\Enums\DirectiveStatus. 'draft' exists on the enum but is never observable through the
 * API: issueDirective() creates the row as draft and issues it within the same transaction.
 */
export type DirectiveStatus = 'draft' | 'issued' | 'acknowledged' | 'in_progress' | 'completed' | 'cancelled' | 'closed'

/**
 * Targets UpdateDirectiveStatusRequest accepts. acknowledged/in_progress/completed are
 * performed by the target attache; cancelled/closed by the issuing officer (URD FR-DIR
 * lifecycle diagram). allowed_actions.transitions says which ones the current user may use now.
 */
export type DirectiveActionableStatus = 'acknowledged' | 'in_progress' | 'completed' | 'cancelled' | 'closed'

/**
 * FR-DIR-003 dashboard groupings, computed server-side: no_date ("No Date Set"),
 * approaching (due within 7 days), overdue ("Exceeded"), on_track, completed (completed or
 * closed) and cancelled.
 */
export type DirectiveDueState = 'no_date' | 'approaching' | 'overdue' | 'on_track' | 'completed' | 'cancelled'

/**
 * Filterable due states for GET /directives?due=. `completed` matches completed and closed
 * directives (the FR-DIR-003 "Completed" group); `cancelled` matches withdrawn ones.
 */
export type DirectiveDueFilter = 'overdue' | 'approaching' | 'no_date' | 'on_track' | 'completed' | 'cancelled'

export type DirectiveSort =
  | '-created_at'
  | 'created_at'
  | 'target_completion_date'
  | '-target_completion_date'
  | '-last_progress_update_at'
  | 'last_progress_update_at'

/** progress = written by the target attache (FR-DIR-008); follow_up = by the issuer (FR-DIR-011). */
export type DirectiveNoteKind = 'progress' | 'follow_up' | 'note'

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

/** Server-computed flags shared by the list and detail shapes. */
export interface DirectiveFlags {
  is_overdue: boolean
  /** FR-DIR-010: open with no progress update for 14+ days. */
  is_stale: boolean
  due_state: DirectiveDueState
  /** Whole days from today to the target date; negative when overdue, null when no date is set. */
  days_until_due: number | null
}

/** GET /directives list-item shape — App\Http\Resources\DirectiveResource. Directives have no
 * reference_number column (CLAUDE.md Section 6), unlike alerts and inquiries. */
export interface Directive extends DirectiveFlags {
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
  updated_at: string
}

export interface DirectiveNote {
  id: string
  content: string
  kind: DirectiveNoteKind
  authored_by: DirectiveUserRef | null
  created_at: string
}

/** POST /directives/{id}/notes returns the same shape the detail resource embeds. */
export type PostedDirectiveNote = DirectiveNote

/** One dated step in the workflow, rebuilt server-side from the audit trail. */
export interface DirectiveStatusHistoryEntry {
  status: DirectiveStatus
  at: string
  by: DirectiveUserRef | null
}

/**
 * What the CURRENT user may do right now, computed by the API from DirectivePolicy and the
 * state machine together. The UI renders controls from this rather than re-deriving policy.
 */
export interface DirectiveAllowedActions {
  transitions: DirectiveActionableStatus[]
  add_note: boolean
  revise: boolean
}

/** GET /directives/{id} shape — App\Http\Resources\DirectiveDetailResource. */
export interface DirectiveDetail extends DirectiveFlags {
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
  /** Oldest first. */
  notes: DirectiveNote[]
  /** Oldest first; the first entry is the issue step. */
  status_history: DirectiveStatusHistoryEntry[]
  allowed_actions: DirectiveAllowedActions
  created_at: string
  updated_at: string
}

export interface DirectiveListFilters {
  status?: DirectiveStatus
  mission_id?: string
  issued_by_user_id?: string
  /** Issue date range (created_at), YYYY-MM-DD. */
  date_from?: string
  date_to?: string
  due?: DirectiveDueFilter
  stale?: boolean
  /** Case-insensitive match on description and type category. */
  q?: string
  sort?: DirectiveSort
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

/** GET /directives/assignees — missions linked to the issuer's department and their attaches. */
export interface DirectiveAssigneeMission {
  id: string
  name: string
  city: string
  host_country: string
  /** Empty when no attache is currently posted there. */
  attaches: DirectiveUserRef[]
}

export interface DirectiveCreateRequest {
  mission_id: string
  target_user_id: string
  type_category?: string
  description: string
  /** YYYY-MM-DD, today or later. Omit for "No Date Set" (FR-DIR-003). */
  target_completion_date?: string
}

/**
 * PATCH /directives/{id} — issuer only, open directives only (FR-DIR-003 "revisable").
 * Send null to clear the target date. Target mission, attache and description can never change
 * (BR-018 / FR-DIR-013).
 */
export interface DirectiveReviseRequest {
  target_completion_date?: string | null
  type_category?: string | null
}

export interface DirectiveStatusTransitionRequest {
  status: DirectiveActionableStatus
  /** Required for 'completed' (the FR-DIR-007 completion summary) and 'cancelled' (the withdrawal reason). */
  note?: string
}

export interface DirectiveNoteRequest {
  content: string
}

export interface DirectiveSummaryFilters {
  date_from?: string
  date_to?: string
  mission_id?: string
  issued_by_user_id?: string
}

export interface DirectiveSummaryMissionRow {
  mission_id: string
  mission_name: string
  total: number
  completed: number
  in_progress: number
  overdue: number
  completion_rate: number
}

export interface DirectiveSummaryIssuerRow {
  user_id: string
  full_name: string
  total: number
  completed: number
  overdue: number
}

/** GET /directives/summary — FR-DIR-012. App\Services\DirectiveService::getSummary(). */
export interface DirectiveSummary {
  total: number
  /** completed + closed. */
  completed: number
  closed: number
  in_progress: number
  issued: number
  acknowledged: number
  cancelled: number
  overdue: number
  approaching: number
  no_target_date: number
  on_track: number
  stale: number
  percentages: {
    completed: number
    in_progress: number
    overdue: number
    no_target_date: number
  }
  by_mission: DirectiveSummaryMissionRow[]
  by_issuer: DirectiveSummaryIssuerRow[]
  /** Unfiltered option lists for the filter controls. */
  filter_options: {
    missions: DirectiveMissionRef[]
    issuers: DirectiveUserRef[]
  }
  filters: {
    date_from: string | null
    date_to: string | null
    mission_id: string | null
    issued_by_user_id: string | null
  }
}

/**
 * GET /master-data?category=directive_type&active=1 — FR-DIR-001. directive_type was left
 * unseeded at go-live (CLAUDE.md Section 8), so this may be empty until configured;
 * type_category stays optional either way.
 */
export async function getDirectiveTypeOptions(): Promise<DirectiveTypeOption[]> {
  const { data } = await client.get<ApiEnvelope<DirectiveTypeOption[]>>('/master-data', {
    params: { category: 'directive_type', active: 1 },
  })
  return data.data
}

/** GET /directives — FR-DIR-005, FR-DIR-009. Scoped server-side per role (DirectivePolicy). */
export async function listDirectives(filters: DirectiveListFilters = {}): Promise<DirectiveListResponse> {
  const { stale, ...rest } = filters
  const { data } = await client.get<DirectiveListResponse>('/directives', {
    params: { ...rest, ...(stale ? { stale: 1 } : {}) },
  })
  return data
}

/** GET /directives/assignees — the issue form's mission and attache pickers. */
export async function listDirectiveAssignees(): Promise<DirectiveAssigneeMission[]> {
  const { data } = await client.get<ApiEnvelope<DirectiveAssigneeMission[]>>('/directives/assignees')
  return data.data
}

/** POST /directives — FR-DIR-002. Ministry HQ Officer, Ministry PS, Acting PS. */
export async function issueDirective(payload: DirectiveCreateRequest): Promise<Directive> {
  const { data } = await client.post<ApiEnvelope<Directive>>('/directives', payload)
  return data.data
}

/** GET /directives/{id} */
export async function getDirective(id: string): Promise<DirectiveDetail> {
  const { data } = await client.get<ApiEnvelope<DirectiveDetail>>(`/directives/${id}`)
  return data.data
}

/** PATCH /directives/{id} — revise the target date or type category (issuer, open directives). */
export async function reviseDirective(id: string, payload: DirectiveReviseRequest): Promise<DirectiveDetail> {
  const { data } = await client.patch<ApiEnvelope<DirectiveDetail>>(`/directives/${id}`, payload)
  return data.data
}

/** PATCH /directives/{id}/status — FR-DIR-006, FR-DIR-007 and the issuer's withdraw/close steps. */
export async function transitionDirectiveStatus(
  id: string,
  payload: DirectiveStatusTransitionRequest,
): Promise<DirectiveDetail> {
  const { data } = await client.patch<ApiEnvelope<DirectiveDetail>>(`/directives/${id}/status`, payload)
  return data.data
}

/** POST /directives/{id}/notes — FR-DIR-008 (target attache), FR-DIR-011 (issuer). */
export async function addDirectiveNote(id: string, payload: DirectiveNoteRequest): Promise<PostedDirectiveNote> {
  const { data } = await client.post<ApiEnvelope<PostedDirectiveNote>>(`/directives/${id}/notes`, payload)
  return data.data
}

/** GET /directives/summary — FR-DIR-012. Ministry HQ Director, Ministry PS, Acting PS. */
export async function getDirectiveSummary(filters: DirectiveSummaryFilters = {}): Promise<DirectiveSummary> {
  const { data } = await client.get<ApiEnvelope<DirectiveSummary>>('/directives/summary', { params: filters })
  return data.data
}
