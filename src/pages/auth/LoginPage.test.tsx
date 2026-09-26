import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './LoginPage'
import * as authApi from '../../api/auth'

vi.mock('../../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/auth')>()
  return { ...actual, login: vi.fn() }
})

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset()
  })

  it('TC-FR-AUTH-007: renders, and submitting typed credentials calls auth.login', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      user: {
        id: '1',
        full_name: 'Test Attache',
        email: 'attache@sdt.go.ke',
        role_id: 'role-1',
        mission_id: null,
        ministry_id: 'ministry-1',
        status: 'active',
        language_preference: 'en',
        email_notification_preferences: null,
      },
    })

    renderLoginPage()

    expect(screen.getByRole('heading', { name: 'Sign in to TradeWatch' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Email address'), 'attache@sdt.go.ke')
    await userEvent.type(screen.getByLabelText('Password'), 'Sup3rSecret!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(vi.mocked(authApi.login).mock.calls[0][0]).toEqual({
      email: 'attache@sdt.go.ke',
      password: 'Sup3rSecret!',
    })
  })

  it('TC-UI-002: renders without overflow at 375px viewport', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderLoginPage()

    // The logo+card column is responsive (w-full, capped by max-w-md) rather than a fixed pixel
    // width, so it never forces horizontal overflow at the 320-375px mobile viewport
    // class (CLAUDE.md Section 2 / NFR-RESP-001, tailwind.config.ts's `sm` breakpoint).
    expect(container.querySelector('.max-w-md.w-full')).not.toBeNull()
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
