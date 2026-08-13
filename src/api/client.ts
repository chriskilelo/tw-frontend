import axios, { type AxiosError } from 'axios'

/**
 * Every TradeWatch response uses the { data, meta, errors } envelope (CLAUDE.md Section 10).
 * `errors` is a flat array of message strings, not field-keyed objects — confirmed against
 * the actual backend implementation in Session 17's FormRequest::failedValidation() override.
 */
export interface ApiEnvelope<T> {
  data: T
  meta?: {
    current_page: number
    per_page: number
    total: number
  }
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
 * from login() (api/auth.ts) — the first mutation of an unauthenticated
 * session, before any XSRF-TOKEN cookie can exist yet.
 */
export async function ensureCsrfCookie(): Promise<void> {
  const root = (import.meta.env.VITE_API_URL as string).replace(/\/api\/v1\/?$/, '')
  await axios.get(`${root}/sanctum/csrf-cookie`, { withCredentials: true })
}

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorEnvelope>) => {
    const status = error.response?.status

    if (status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    } else if (status === 403) {
      const message = error.response?.data?.errors?.[0] ?? 'You do not have permission to perform this action.'
      forbiddenToastHandler?.(message)
    }

    return Promise.reject(error)
  },
)

export default client
