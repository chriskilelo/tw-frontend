import client, { type ApiEnvelope } from './client'
import type { NamedRef } from './auth'

/** App\Http\Resources\UserResource — account administration (FR-AUTH-001, FR-AUTH-021). */
export interface ManagedUser {
  id: string
  full_name: string
  email: string
  status: 'activation_pending' | 'active' | 'locked' | 'deactivated'
  role?: { id: string; name: string; display_title: string | null }
  mission?: NamedRef | null
  ministry?: NamedRef | null
  home_ministry?: NamedRef | null
  language_preference: string
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface UserListFilters {
  page?: number
  per_page?: number
  role?: string
  mission?: string
  status?: string
  /** System Administrator only; a Ministry Administrator is always pinned to its own department. */
  ministry?: string
}

export interface UserCreateRequest {
  full_name: string
  email: string
  role_id: string
  mission_id?: string | null
  ministry_id?: string | null
  home_ministry_id?: string | null
}

export type UserUpdateRequest = Partial<UserCreateRequest>

/** GET /users — System Administrator (all) or Ministry Administrator (own department). */
export async function listUsers(filters: UserListFilters = {}): Promise<ApiEnvelope<ManagedUser[]>> {
  const { data } = await client.get<ApiEnvelope<ManagedUser[]>>('/users', { params: filters })
  return data
}

export async function getUser(id: string): Promise<ManagedUser> {
  const { data } = await client.get<ApiEnvelope<ManagedUser>>(`/users/${id}`)
  return data.data
}

export async function createUser(payload: UserCreateRequest): Promise<ManagedUser> {
  const { data } = await client.post<ApiEnvelope<ManagedUser>>('/users', payload)
  return data.data
}

export async function updateUser(id: string, payload: UserUpdateRequest): Promise<ManagedUser> {
  const { data } = await client.patch<ApiEnvelope<ManagedUser>>(`/users/${id}`, payload)
  return data.data
}

export async function deactivateUser(id: string): Promise<ManagedUser> {
  const { data } = await client.post<ApiEnvelope<ManagedUser>>(`/users/${id}/deactivate`)
  return data.data
}

export async function reactivateUser(id: string): Promise<ManagedUser> {
  const { data } = await client.post<ApiEnvelope<ManagedUser>>(`/users/${id}/reactivate`)
  return data.data
}

export async function resendActivation(id: string): Promise<void> {
  await client.post(`/users/${id}/resend-activation`)
}

/** GET /roles row — the role picker (FR-AUTH-021). A Ministry Administrator gets only the roles it may assign. */
export interface AssignableRole {
  id: string
  name: string
  layer: string
  scope: 'platform' | 'ministry' | 'mission'
  display_title: string | null
}

export async function listRoles(): Promise<AssignableRole[]> {
  const { data } = await client.get<ApiEnvelope<AssignableRole[]>>('/roles')
  return data.data
}
