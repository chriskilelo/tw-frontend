import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import ResetPasswordPage, { type ResetPasswordMode } from './ResetPasswordPage'
import * as authApi from '../../api/auth'

vi.mock('../../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/auth')>()
  return { ...actual, resetPassword: vi.fn() }
})

const LINK_QUERY = '?token=abc&email=attache%40sdt.go.ke'

function renderPage(mode: ResetPasswordMode = 'reset', query = LINK_QUERY) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const path = mode === 'activate' ? '/activate' : '/reset-password'
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`${path}${query}`]}>
        <ResetPasswordPage mode={mode} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function rejectWith422(message: string) {
  const headers = new AxiosHeaders()
  vi.mocked(authApi.resetPassword).mockRejectedValue(
    new AxiosError('Unprocessable', 'ERR_BAD_REQUEST', { headers }, null, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: {},
      config: { headers },
      data: { data: null, errors: [message] },
    }),
  )
}

async function choosePassword(passwordLabel: string, confirmLabel: string) {
  await userEvent.type(screen.getByLabelText(passwordLabel), 'NewPassword1')
  await userEvent.type(screen.getByLabelText(confirmLabel), 'NewPassword1')
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.resetPassword).mockReset()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()

    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
    expect(container.querySelector('.max-w-md.w-full')).not.toBeNull()
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })

  it('TC-FR-AUTH-011: sends the emailed token and email with the new password', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ message: 'Your password has been reset.' })

    renderPage()
    await choosePassword('New password', 'Confirm new password')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(vi.mocked(authApi.resetPassword).mock.calls[0][0]).toEqual({
      token: 'abc',
      email: 'attache@sdt.go.ke',
      password: 'NewPassword1',
      password_confirmation: 'NewPassword1',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been reset. You may now sign in.')
  })

  it('TC-FR-AUTH-011-E: a refused reset link offers a new one', async () => {
    rejectWith422('This password reset token is invalid.')

    renderPage()
    await choosePassword('New password', 'Confirm new password')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This password reset token is invalid.')
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password')
  })

  it('TC-FR-AUTH-011-F: an incomplete reset link says so instead of showing the form', () => {
    renderPage('reset', '?email=attache%40sdt.go.ke')

    expect(screen.getByRole('alert')).toHaveTextContent('This link is incomplete.')
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password')
  })

  it('TC-FR-AUTH-002: the activation link sets the first password with activation wording', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ message: 'Your password has been reset.' })

    renderPage('activate')

    expect(screen.getByRole('heading', { name: 'Activate your account' })).toBeInTheDocument()
    expect(screen.getByText('Choose a password to finish setting up your TradeWatch account.')).toBeInTheDocument()

    await choosePassword('Password', 'Confirm password')
    await userEvent.click(screen.getByRole('button', { name: 'Activate account' }))

    expect(vi.mocked(authApi.resetPassword).mock.calls[0][0]).toMatchObject({ token: 'abc', email: 'attache@sdt.go.ke' })
    expect(await screen.findByRole('status')).toHaveTextContent('Your account is active. You may now sign in.')
  })

  it('TC-FR-AUTH-002-C: an expired activation link points the user to their administrator', async () => {
    rejectWith422('This password reset token is invalid.')

    renderPage('activate')
    await choosePassword('Password', 'Confirm password')
    await userEvent.click(screen.getByRole('button', { name: 'Activate account' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This activation link is invalid or has expired.')
    expect(alert).not.toHaveTextContent('password reset token')
    expect(screen.queryByRole('link', { name: 'Ask for a new link' })).not.toBeInTheDocument()
  })

  it('TC-FR-AUTH-002-D: an incomplete activation link says so instead of showing the form', () => {
    renderPage('activate', '?token=abc')

    expect(screen.getByRole('alert')).toHaveTextContent('This activation link is incomplete.')
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })
})
