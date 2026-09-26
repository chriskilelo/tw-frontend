import { isAxiosError } from 'axios'
import type { ApiErrorEnvelope } from '../api/client'

/**
 * The backend's flat `errors: string[]` envelope (CLAUDE.md Session 17 note), falling back
 * to a generic message for network failures or unexpected shapes. Used where a rule
 * violation has a specific, user-actionable explanation (e.g. "submit a PS approval request").
 */
export function apiErrorMessages(error: unknown, fallback: string): string[] {
  if (isAxiosError<ApiErrorEnvelope>(error)) {
    const errors = error.response?.data?.errors
    if (Array.isArray(errors) && errors.length > 0) {
      return errors
    }
  }
  return [fallback]
}
