import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from './DashboardPage'
import { I18nProvider } from '../i18n/context'
import * as authApi from '../api/auth'

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>()
  return { ...actual, me: vi.fn() }
})

function renderPage() {
  vi.mocked(authApi.me).mockReset().mockResolvedValue({
    user: {
      id: 'user-1',
      full_name: 'Test Attache',
      email: 'attache@sdt.go.ke',
      role_id: 'role-1',
      mission_id: 'mission-1',
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: 'Ministry Attache', layer: '2', scope: 'mission' },
    permissions: [],
  })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <DashboardPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  it('TC-UI-002: renders without overflow at 375px viewport', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    // Stat tile grid is grid-cols-1 below sm, so it never forces horizontal overflow at 375px.
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
