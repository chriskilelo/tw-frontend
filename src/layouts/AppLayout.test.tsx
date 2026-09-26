import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from './AppLayout'
import * as authApi from '../api/auth'
import * as notificationsApi from '../api/notifications'
import type { MeResponse } from '../api/auth'

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>()
  return { ...actual, me: vi.fn(), updatePreferences: vi.fn() }
})

vi.mock('../api/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/notifications')>()
  return { ...actual, listNotifications: vi.fn(), markAllNotificationsRead: vi.fn() }
})

function meResponseFor(roleName: string): MeResponse {
  return {
    user: {
      id: 'user-1',
      full_name: 'Test User',
      email: 'user@sdt.go.ke',
      role_id: 'role-1',
      mission_id: null,
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: roleName, layer: '2', scope: 'mission' },
    permissions: [],
  }
}

function renderAppLayoutAt(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <div>Dashboard Content</div> },
          { path: '/alerts', element: <div>Alerts Content</div> },
          { path: '/mission-activity', element: <div>Mission Activity Content</div> },
          { path: '/admin/users', element: <div>User Accounts Content</div> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockReset()
    vi.mocked(notificationsApi.listNotifications).mockReset().mockResolvedValue([])
  })

  it('TC-UI-004: renders NotificationBell and LanguageToggle regardless of route', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponseFor('Ministry Attache'))

    renderAppLayoutAt('/dashboard')
    expect(await screen.findByText('Dashboard Content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kiswahili' })).toBeInTheDocument()

    renderAppLayoutAt('/alerts')
    expect(await screen.findByText('Alerts Content')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Notifications' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'English' }).length).toBeGreaterThan(0)
  })

  it('TC-UI-006: Head of Mission sees navigation without write-action nav sections', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponseFor('Head of Mission'))

    renderAppLayoutAt('/mission-activity')
    expect(await screen.findByText('Mission Activity Content')).toBeInTheDocument()

    expect(await screen.findByRole('link', { name: 'Mission Activity' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()

    // Read-only role: no write-action nav sections (Alerts/Inquiries). The create-record
    // buttons themselves live on AlertListPage/InquiryListPage now, not the sidebar, so
    // their own role gating (canCreate) is exercised there, not here.
    expect(screen.queryByRole('link', { name: 'Alerts' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Inquiries' })).not.toBeInTheDocument()
  })

  it('TC-FR-I18N-002: clicking the language toggle switches displayed strings', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponseFor('Ministry Attache'))
    vi.mocked(authApi.updatePreferences).mockResolvedValue({} as never)

    renderAppLayoutAt('/dashboard')
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Kiswahili' }))

    expect(await screen.findByRole('link', { name: 'Dashibodi' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(authApi.updatePreferences).toHaveBeenCalledWith({ language_preference: 'sw' })
  })

  it('TC-FR-AUTH-020: a Ministry Administrator sees only administration navigation', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponseFor('Ministry Administrator'))

    renderAppLayoutAt('/admin/users')
    expect(await screen.findByText('User Accounts Content')).toBeInTheDocument()

    expect(await screen.findByRole('link', { name: 'User Accounts' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'PS Approvals' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leadership Switches' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Audit Log' })).toBeInTheDocument()

    // BR-025: no operational sections, not even the dashboard or search.
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Alerts' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Departments' })).not.toBeInTheDocument()
  })

  it('TC-FR-AUTH-025: the user menu shows the role display title and department, falling back to the role name', async () => {
    const response = meResponseFor('Ministry Administrator')
    response.role.display_title = 'Department Keeper'
    response.user.ministry = { id: 'ministry-1', name: 'State Department for Trade' }
    vi.mocked(authApi.me).mockResolvedValue(response)

    renderAppLayoutAt('/admin/users')
    expect(await screen.findByText('Department Keeper')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Test User/ }))
    expect(await screen.findByTestId('user-menu-title')).toHaveTextContent('Department Keeper · State Department for Trade')
  })
})
