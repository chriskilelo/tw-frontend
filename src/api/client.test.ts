import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import client, { backgroundHeaders } from './client'
import {
  BACKGROUND_REQUEST_HEADER,
  resetUserActivityForTests,
  startTrackingUserActivity,
} from '../lib/userActivity'

const sentHeaders: boolean[] = []

function fakeAdapter(config: InternalAxiosRequestConfig) {
  sentHeaders.push(config.headers.has(BACKGROUND_REQUEST_HEADER))
  return Promise.resolve({ data: { data: null }, status: 200, statusText: 'OK', headers: {}, config })
}

function poll() {
  return client.get('/notifications', { headers: backgroundHeaders({ background: true }) })
}

function at(isoTime: string) {
  vi.setSystemTime(new Date(isoTime))
}

let stopTracking: () => void

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  resetUserActivityForTests()
  sentHeaders.length = 0
  client.defaults.adapter = fakeAdapter
  stopTracking = startTrackingUserActivity()
})

afterEach(() => {
  stopTracking()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// FR-AUTH-010 / UAT ISS-001: a timed request only counts as activity when someone has
// used the page since the last request that did.
describe('background requests', () => {
  it('TC-FR-AUTH-010-G: stay background while nobody touches the page', async () => {
    at('2026-11-24T09:00:00Z')
    await client.get('/me')

    at('2026-11-24T09:01:00Z')
    await poll()
    at('2026-11-24T09:02:00Z')
    await poll()

    expect(sentHeaders).toEqual([false, true, true])
  })

  it('TC-FR-AUTH-010-H: count as activity once after the user interacts, then go quiet again', async () => {
    at('2026-11-24T09:00:00Z')
    await client.get('/me')

    at('2026-11-24T09:00:30Z')
    window.dispatchEvent(new Event('keydown'))

    at('2026-11-24T09:01:00Z')
    await poll()
    at('2026-11-24T09:02:00Z')
    await poll()

    expect(sentHeaders).toEqual([false, false, true])
  })

  it('TC-FR-AUTH-010-I: ordinary requests never carry the background header', async () => {
    await client.get('/alerts')
    await client.post('/alerts', {})

    expect(sentHeaders).toEqual([false, false])
  })
})

describe('session ended for inactivity', () => {
  function rejectWith401(headers: Record<string, string>) {
    client.defaults.adapter = (config) =>
      Promise.reject(
        new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
          status: 401,
          statusText: 'Unauthorized',
          headers,
          config: { headers: new AxiosHeaders() },
          data: { data: null, errors: ['Signed out'] },
        }),
      )
  }

  it('TC-FR-AUTH-010-J: sends the user to sign-in with the idle notice', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { pathname: '/dashboard', assign })
    rejectWith401({ 'x-session-ended': 'idle' })

    await expect(client.get('/me')).rejects.toBeInstanceOf(AxiosError)

    expect(assign).toHaveBeenCalledWith('/login?signedOut=idle')
  })

  it('TC-FR-AUTH-010-K: any other 401 goes to sign-in without it', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { pathname: '/dashboard', assign })
    rejectWith401({})

    await expect(client.get('/me')).rejects.toBeInstanceOf(AxiosError)

    expect(assign).toHaveBeenCalledWith('/login')
  })
})
