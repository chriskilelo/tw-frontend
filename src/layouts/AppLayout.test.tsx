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

  it.each([
    ['Ministry Attache', true, false],
    ['Ministry HQ Officer', true, false],
    ['Ministry HQ Director', true, true],
    ['Ministry PS', true, true],
    ['Acting PS', true, true],
  ])('TC-FR-DIR-012-NAV: %s sees Directives=%s and Directive Summary=%s in the sidebar', async (roleName, hasDirectives, hasSummary) => {
    vi.mocked(authApi.me).mockResolvedValue(meResponseFor(roleName))

    renderAppLayoutAt('/dashboard')
    // The sidebar falls back to Dashboard/Search until GET /me resolves; the user menu
    // appears only once it has, so wait for that before asserting role-specific links.
    expect(await screen.findByText('Test User')).toBeInTheDocument()

    const directivesLink = screen.queryByRole('link', { name: 'Directives' })
    const summaryLink = screen.queryByRole('link', { name: 'Directive Summary' })
    expect(Boolean(directivesLink)).toBe(hasDirectives)
    expect(Boolean(summaryLink)).toBe(hasSummary)
    if (directivesLink) {
      expect(directivesLink).toHaveAttribute('href', '/directives')
    }
    if (summaryLink) {
      expect(summaryLink).toHaveAttribute('href', '/directives/summary')
    }
  })

  it.each([
    'Head of Mission',
    'Deputy Head of Mission',
    'MFA HQ Officer',
    'MFA Principal Secretary',
    'HRM&D Officer',
    'Ministry Administrator',
    'System Administrator',
    'Designated Deputy',
  ])('TC-FR-DIR-005-NAV: %s gets no directive navigation', async (roleName) => {
    vi.mocked(authApi.me).mockResolvedValue(meResponseFor(roleName))

    renderAppLayoutAt('/dashboard')
    expect(await screen.findByText('Test User')).toBeInTheDocument()

    expect(screen.queryByRole('link', { name: 'Directives' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Directive Summary' })).not.toBeInTheDocument()
  })

  it.each([
    ['Ministry Attache', true, false],
    ['Ministry HQ Officer', true, false],
    ['Ministry Publishing Authority', true, false],
    ['Head of Mission', true, false],
    ['Deputy Head of Mission', true, false],
    ['Ministry HQ Director', true, true],
    ['Ministry PS', true, true],
    ['Acting PS', true, true],
    ['MFA HQ Officer', false, false],
    ['HRM&D Officer', false, false],
    ['System Administrator', false, false],
  ])('TC-FR-RPT-017-NAV: %s sees Reports=%s and Report Compliance=%s in the sidebar', async (roleName, hasReports, hasCompliance) => {
    vi.mocked(authApi.me).mockResolvedValue(meResponseFor(roleName))

    renderAppLayoutAt('/dashboard')
    expect(await screen.findByText('Test User')).toBeInTheDocument()

    expect(Boolean(screen.queryByRole('link', { name: 'Reports' }))).toBe(hasReports)
    expect(Boolean(screen.queryByRole('link', { name: 'Report Compliance' }))).toBe(hasCompliance)
  })

  it.each([
    ['Ministry Attache', true, false, false, true],
    ['Ministry HQ Officer', false, false, false, true],
    ['Ministry HQ Director', true, true, true, false],
    ['Ministry PS', true, true, true, false],
    ['Acting PS', true, true, true, false],
    ['HRM&D Officer', true, false, false, false],
    ['Head of Mission', false, false, false, false],
    ['MFA HQ Officer', false, false, false, false],
    ['System Administrator', false, false, false, false],
  ])(
    'TC-FR-KPI-NAV: %s sees KPI Dashboard=%s, Comparison=%s, Set Targets=%s, Record Actuals=%s',
    async (roleName, hasDashboard, hasComparison, hasTargets, hasEntry) => {
      vi.mocked(authApi.me).mockResolvedValue(meResponseFor(roleName))

      renderAppLayoutAt('/dashboard')
      expect(await screen.findByText('Test User')).toBeInTheDocument()

      expect(Boolean(screen.queryByRole('link', { name: 'KPI Dashboard' }))).toBe(hasDashboard)
      expect(Boolean(screen.queryByRole('link', { name: 'KPI Comparison' }))).toBe(hasComparison)
      expect(Boolean(screen.queryByRole('link', { name: 'Set KPI Targets' }))).toBe(hasTargets)
      expect(Boolean(screen.queryByRole('link', { name: 'Record KPI Actuals' }))).toBe(hasEntry)
    },
  )

  it.each([
    ['Head of Mission', true, false, true],
    ['Deputy Head of Mission', true, false, true],
    ['MFA HQ Officer', false, true, false],
    ['MFA Principal Secretary', false, true, false],
    ['Ministry Attache', false, false, true],
    ['Ministry PS', false, false, true],
    ['HRM&D Officer', false, false, false],
    ['System Administrator', false, false, true],
  ])(
    'TC-FR-HOM-001-NAV / TC-FR-MFA-001-NAV: %s sees Mission Activity=%s, MFA Awareness=%s, Search=%s',
    async (roleName, hasMissionActivity, hasMfaAwareness, hasSearch) => {
      vi.mocked(authApi.me).mockResolvedValue(meResponseFor(roleName))

      renderAppLayoutAt('/dashboard')
      expect(await screen.findByText('Test User')).toBeInTheDocument()

      expect(Boolean(screen.queryByRole('link', { name: 'Mission Activity' }))).toBe(hasMissionActivity)
      expect(Boolean(screen.queryByRole('link', { name: 'MFA Awareness' }))).toBe(hasMfaAwareness)
      expect(Boolean(screen.queryByRole('link', { name: 'Search' }))).toBe(hasSearch)
    },
  )

  it('TC-FR-AUTH-020: a Ministry Administrator sees only administration navigation', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meResponseFor('Ministry Administrator'))

    renderAppLayoutAt('/admin/users')
    expect(await screen.findByText('User Accounts Content')).toBeInTheDocument()

    expect(await screen.findByRole('link', { name: 'User Accounts' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'PS Approvals' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leadership Switches' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Audit Log' })).toBeInTheDocument()

    // The dashboard is the administration dashboard (GET /admin/dashboard), not an
    // operational view. BR-025: no operational sections and no search.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
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
