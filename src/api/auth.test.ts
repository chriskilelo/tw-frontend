import { beforeEach, describe, expect, it, vi } from 'vitest'
import client, { ensureCsrfCookie } from './client'
import { forgotPassword, login, resetPassword } from './auth'

vi.mock('./client', () => ({
  default: { post: vi.fn() },
  ensureCsrfCookie: vi.fn(),
}))

const calls: string[] = []

beforeEach(() => {
  calls.length = 0
  vi.mocked(ensureCsrfCookie).mockReset().mockImplementation(async () => {
    calls.push('csrf-cookie')
  })
  vi.mocked(client.post).mockReset().mockImplementation(async (url: string) => {
    calls.push(`POST ${url}`)
    return { data: { data: { message: 'ok', user: {} } } }
  })
})

// A fresh browser has no XSRF-TOKEN cookie yet, so every write made before
// sign-in must fetch one first or Sanctum answers 419 (UAT ISS-017).
describe('unauthenticated auth requests fetch the CSRF cookie first', () => {
  it('TC-FR-AUTH-007: login', async () => {
    await login({ email: 'attache@sdt.go.ke', password: 'Secret123' })

    expect(calls).toEqual(['csrf-cookie', 'POST /login'])
  })

  it('TC-FR-AUTH-011: forgot password', async () => {
    await forgotPassword({ email: 'attache@sdt.go.ke' })

    expect(calls).toEqual(['csrf-cookie', 'POST /password/forgot'])
  })

  it('TC-FR-AUTH-011-B: choose a new password', async () => {
    await resetPassword({
      token: 'abc',
      email: 'attache@sdt.go.ke',
      password: 'NewPassword1',
      password_confirmation: 'NewPassword1',
    })

    expect(calls).toEqual(['csrf-cookie', 'POST /password/reset'])
  })
})
