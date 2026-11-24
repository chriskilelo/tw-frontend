import axios, { type AxiosError } from 'axios'
import { BACKGROUND_REQUEST_HEADER, isUserIdleSinceLastRequest, recordActiveRequest } from '../lib/userActivity'

/**
 * Every TradeWatch response uses the { data, meta, errors } envelope (CLAUDE.md Section 10).
 * `errors` is a flat array of message strings, not field-keyed objects — confirmed against
 * the actual backend implementation in Session 17's FormRequest::failedValidation() override.
 */
/**
 * Matches the real shape every paginated controller returns
 * (AlertController, InquiryController, DirectiveController,
 * PeriodicReportController, KpiActualController, Admin\UserController,
 * Admin\AuditLogController) — `last_page` is present on every one of them,
 * even though the abbreviated PaginationMeta schema in the OpenAPI excerpt
 * (14_TW_API_Specification.md) omits it.
 */
export interface PaginationMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export interface ApiEnvelope<T> {
  data: T
  meta?: PaginationMeta
}

export interface ApiErrorEnvelope {
  data: null
  errors: string[]
}

type ForbiddenToastHandler = (message: string) => void

let forbiddenToastHandler: ForbiddenToastHandler | null = null

/** Registered by the app shell (Session 20's toast/notification system) to surface 403s. */
export function setForbiddenToastHandler(handler: ForbiddenToastHandler | null): void {
  forbiddenToastHandler = handler
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  // Laravel Sanctum SPA cookie session (TDD-ADR-002): send the XSRF-TOKEN cookie back
  // as the X-XSRF-TOKEN header even when the frontend/backend run on different ports.
  withXSRFToken: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Sanctum SPA mode requires a CSRF cookie to exist before the first
 * state-changing request; `withXSRFToken` above only re-sends a cookie that
 * already exists, it never fetches one. GET /sanctum/csrf-cookie lives
 * outside the /api/v1 prefix, so this bypasses `client`'s baseURL. Called
 * from login(), forgotPassword() and resetPassword() (api/auth.ts) — the
 * writes a signed-out browser makes before any XSRF-TOKEN cookie can exist.
 */
export async function ensureCsrfCookie(): Promise<void> {
  const root = (import.meta.env.VITE_API_URL as string).replace(/\/api\/v1\/?$/, '')
  await axios.get(`${root}/sanctum/csrf-cookie`, { withCredentials: true })
}

/** Options for API calls that may run on a timer (FR-AUTH-010, lib/userActivity.ts). */
export interface BackgroundRequestOptions {
  background?: boolean
}

/** Headers for a timed request; the interceptor below decides whether it stays background. */
export function backgroundHeaders(options?: BackgroundRequestOptions): Record<string, string> | undefined {
  return options?.background ? { [BACKGROUND_REQUEST_HEADER]: '1' } : undefined
}

client.interceptors.request.use((config) => {
  if (config.headers.has(BACKGROUND_REQUEST_HEADER) && !isUserIdleSinceLastRequest()) {
    config.headers.delete(BACKGROUND_REQUEST_HEADER)
  }
  if (!config.headers.has(BACKGROUND_REQUEST_HEADER)) {
    recordActiveRequest()
  }
  return config
})

/** Set by EnforceIdleTimeout (tw-backend) when it ends a session for inactivity. */
const SESSION_ENDED_HEADER = 'x-session-ended'

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorEnvelope>) => {
    const status = error.response?.status

    if (status === 401) {
      if (window.location.pathname !== '/login') {
        const endedForInactivity = error.response?.headers?.[SESSION_ENDED_HEADER] === 'idle'
        window.location.assign(endedForInactivity ? '/login?signedOut=idle' : '/login')
      }
    } else if (status === 403) {
      const message = error.response?.data?.errors?.[0] ?? 'You do not have permission to perform this action.'
      forbiddenToastHandler?.(message)
    }

    return Promise.reject(error)
  },
)

export default client
