import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProfilePage from './ProfilePage'
import { I18nProvider } from '../i18n/context'
import * as authApi from '../api/auth'
import type { MeResponse } from '../api/auth'

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>()
  return {
    ...actual,
    me: vi.fn(),
    updatePreferences: vi.fn(),
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
  }
})

function meResponse(overrides: Partial<MeResponse['user']> = {}): MeResponse {
  return {
    user: {
      id: 'user-1',
      full_name: 'QA Attache London',
      email: 'attache.london@tradewatch.go.ke',
      role_id: 'role-1',
      mission_id: 'mission-1',
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
      mission: { id: 'mission-1', name: 'London' },
      ministry: { id: 'ministry-1', name: 'State Department for Trade' },
      avatar_url: null,
      ...overrides,
    },
    role: { id: 'role-1', name: 'Ministry Attache', layer: '2', scope: 'mission' },
    permissions: [],
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockReset()
    vi.mocked(authApi.updatePreferences).mockReset()
    vi.mocked(authApi.uploadAvatar).mockReset()
    vi.mocked(authApi.deleteAvatar).mockReset()
  })

  it('TC-FR-AUTH-019: renders account information including mission and ministry', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponse())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeInTheDocument()
    expect(screen.getAllByText('QA Attache London').length).toBeGreaterThan(0)
    expect(screen.getByText('attache.london@tradewatch.go.ke')).toBeInTheDocument()
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText('State Department for Trade')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('TC-FR-AUTH-019: shows only "Change Image" (no "Remove Image") when no photo is set', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponse({ avatar_url: null }))
    renderPage()

    expect(await screen.findByRole('button', { name: 'Change Image' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Image' })).not.toBeInTheDocument()
  })

  it('TC-FR-AUTH-019: shows "Remove Image" once a photo is set, and removing it calls DELETE /me/avatar', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponse({ avatar_url: 'https://example.test/avatar.jpg' }))
    vi.mocked(authApi.deleteAvatar).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    const removeButton = await screen.findByRole('button', { name: 'Remove Image' })
    await user.click(removeButton)

    await waitFor(() => expect(authApi.deleteAvatar).toHaveBeenCalledTimes(1))
  })

  it('TC-FR-AUTH-019: selecting a file uploads it via POST /me/avatar', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponse())
    vi.mocked(authApi.uploadAvatar).mockResolvedValue(meResponse({ avatar_url: 'https://example.test/new.jpg' }).user)
    renderPage()

    await screen.findByRole('heading', { name: 'My Profile' })

    const file = new File(['fake-image-bytes'], 'me.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText('Change Image', { selector: 'input' }) as HTMLInputElement

    await userEvent.upload(input, file)

    await waitFor(() => expect(authApi.uploadAvatar).toHaveBeenCalled())
    expect(vi.mocked(authApi.uploadAvatar).mock.calls[0][0]).toBe(file)
  })

  it('TC-FR-AUTH-019-B: a refused upload message clears once the photo is removed (ISS-003)', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponse({ avatar_url: 'https://example.test/avatar.jpg' }))
    vi.mocked(authApi.uploadAvatar).mockRejectedValue(new Error('422'))
    vi.mocked(authApi.deleteAvatar).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: 'My Profile' })
    const input = screen.getByLabelText('Change Image', { selector: 'input' }) as HTMLInputElement
    await userEvent.upload(input, new File(['bytes'], 'big.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByText(/Could not upload that image/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove Image' }))

    await waitFor(() => expect(authApi.deleteAvatar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText(/Could not upload that image/)).not.toBeInTheDocument())
  })

  it('TC-FR-AUTH-019-C: says so when the photo cannot be removed', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponse({ avatar_url: 'https://example.test/avatar.jpg' }))
    vi.mocked(authApi.deleteAvatar).mockRejectedValue(new Error('500'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove Image' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The photo couldn’t be removed. Please try again.')
  })

  it('TC-FR-NOTIF-006-B: confirms "Saved." once an email preference is stored (ISS-002)', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponse())
    vi.mocked(authApi.updatePreferences).mockResolvedValue(
      meResponse({ email_notification_preferences: { alert_routed: false } }).user,
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('checkbox', { name: 'An alert is routed to me' }))

    await waitFor(() =>
      expect(authApi.updatePreferences).toHaveBeenCalledWith({ email_notification_preferences: { alert_routed: false } }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
  })

  it('TC-FR-NOTIF-006-C: a failed save says so and never claims "Saved."', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponse())
    vi.mocked(authApi.updatePreferences).mockRejectedValue(new Error('500'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('checkbox', { name: 'A directive is issued to me' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Please try again.')
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument()
  })

  it('TC-FR-I18N-001-D: shows the role name in Kiswahili (ISS-005)', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponse({ language_preference: 'sw' }))
    renderPage()

    expect((await screen.findAllByText('Mwambata wa Wizara')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Ministry Attache')).not.toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(authApi.me).mockResolvedValue(meResponse())

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
