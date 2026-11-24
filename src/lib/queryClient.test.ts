import { describe, expect, it } from 'vitest'
import { createQueryClient } from './queryClient'
import { httpError } from '../test/httpErrors'

describe('createQueryClient', () => {
  it('ISS-018: never retries a refusal, so a blocked page explains itself at once', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry

    expect(typeof retry).toBe('function')
    const shouldRetry = retry as (failureCount: number, error: unknown) => boolean
    expect(shouldRetry(0, httpError(403))).toBe(false)
    expect(shouldRetry(0, httpError(404))).toBe(false)
    expect(shouldRetry(0, httpError(500))).toBe(true)
  })

  it('keeps data fresh for 30 seconds', () => {
    expect(createQueryClient().getDefaultOptions().queries?.staleTime).toBe(30_000)
  })
})
