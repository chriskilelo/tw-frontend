import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { apiErrorMessages, retryUnlessClientError } from './apiErrors'

function httpError(status: number, errors?: string[]): AxiosError {
  return new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: errors ? { data: null, errors } : {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  })
}

describe('apiErrors', () => {
  it('gives up at once on a client error, which a retry cannot fix', () => {
    expect(retryUnlessClientError(0, httpError(403))).toBe(false)
    expect(retryUnlessClientError(0, httpError(404))).toBe(false)
    expect(retryUnlessClientError(0, httpError(422))).toBe(false)
  })

  it('retries a server or network failure up to three times', () => {
    expect(retryUnlessClientError(0, httpError(500))).toBe(true)
    expect(retryUnlessClientError(2, httpError(503))).toBe(true)
    expect(retryUnlessClientError(3, httpError(500))).toBe(false)
    expect(retryUnlessClientError(0, new Error('Network Error'))).toBe(true)
  })

  it('reads the server’s messages, falling back when there are none', () => {
    expect(apiErrorMessages(httpError(422, ['Too far ahead.']), 'Fallback')).toEqual(['Too far ahead.'])
    expect(apiErrorMessages(httpError(500), 'Fallback')).toEqual(['Fallback'])
  })
})
