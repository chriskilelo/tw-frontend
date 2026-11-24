import { QueryClient } from '@tanstack/react-query'
import { retryUnlessClientError } from './apiErrors'

/**
 * The app's React Query client. A 4xx is never retried: a refused or invalid request will not
 * succeed on a second try, and React Query's default (three retries with back-off, about seven
 * seconds) left blocked pages blank while it waited (ISS-018). Network and server failures are
 * still retried.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: retryUnlessClientError,
      },
    },
  })
}
