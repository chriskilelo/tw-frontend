import client, { ensureCsrfCookie, type ApiEnvelope } from './client'
import type { LanguagePreference } from '../i18n'

export interface Role {
  id: string
  name: string
  layer: string
  scope: 'platform' | 'ministry' | 'mission'
}

export interface AuthUser {
  id: string
  full_name: string
  email: string
  role_id: string
  mission_id: string | null
  ministry_id: string | null
  status: 'activation_pending' | 'active' | 'locked' | 'deactivated'
  language_preference: LanguagePreference
  email_notification_preferences: Record<string, boolean> | null
}

export interface MeResponse {
  user: AuthUser
  role: Role
  permissions: string[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: AuthUser
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  email: string
  password: string
  password_confirmation: string
}

export interface UpdatePreferencesRequest {
  language_preference?: LanguagePreference
  email_notification_preferences?: Record<string, boolean>
}

/** POST /login — FR-AUTH-007 */
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  await ensureCsrfCookie()
  const { data } = await client.post<ApiEnvelope<LoginResponse>>('/login', payload)
  return data.data
}

/** POST /logout — FR-AUTH-010 */
export async function logout(): Promise<void> {
  await client.post('/logout')
}

/** GET /me — FR-AUTH-007 */
export async function me(): Promise<MeResponse> {
  const { data } = await client.get<ApiEnvelope<MeResponse>>('/me')
  return data.data
}

/** PATCH /me/preferences — FR-I18N-002, FR-NOTIF-006 */
export async function updatePreferences(payload: UpdatePreferencesRequest): Promise<AuthUser> {
  const { data } = await client.patch<ApiEnvelope<{ user: AuthUser }>>('/me/preferences', payload)
  return data.data.user
}

/** POST /password/forgot — FR-AUTH-011 */
export async function forgotPassword(payload: ForgotPasswordRequest): Promise<{ message: string }> {
  const { data } = await client.post<ApiEnvelope<{ message: string }>>('/password/forgot', payload)
  return data.data
}

/** POST /password/reset — FR-AUTH-011 */
export async function resetPassword(payload: ResetPasswordRequest): Promise<{ message: string }> {
  const { data } = await client.post<ApiEnvelope<{ message: string }>>('/password/reset', payload)
  return data.data
}
