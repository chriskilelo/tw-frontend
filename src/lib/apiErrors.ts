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

/**
 * React Query retry policy that gives up at once on a 4xx (a refused permission or an invalid
 * request will not succeed on retry, and retrying only delays the explanation), and retries a
 * network or server failure up to three times.
 */
export function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  if (isAxiosError(error)) {
    const status = error.response?.status
    if (status !== undefined && status >= 400 && status < 500) {
      return false
    }
  }
  return failureCount < 3
}
