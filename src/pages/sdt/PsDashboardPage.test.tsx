import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PsDashboardPage from './PsDashboardPage'
import * as authApi from '../../api/auth'
import * as alertsApi from '../../api/alerts'
import * as sdtApi from '../../api/sdt'
import type { MeResponse } from '../../api/auth'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/auth')>()
  return { ...actual, me: vi.fn() }
})

vi.mock('../../api/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/alerts')>()
  return { ...actual, listAlerts: vi.fn() }
})

vi.mock('../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sdt')>()
  return { ...actual, getPsDashboard: vi.fn(), activateActingPs: vi.fn(), deactivateActingPs: vi.fn() }
})

function meResponseFor(roleName: string): MeResponse {
  return {
    user: {
      id: 'user-3',
      full_name: 'Head of Mission User',
      email: 'hom@sdt.go.ke',
      role_id: 'role-3',
      mission_id: 'mission-1',
      ministry_id: null,
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-3', name: roleName, layer: '1', scope: 'mission' },
    permissions: [],
  }
}

const emptyDashboard = {
  unacknowledged_alerts_count: 0,
  pending_inquiries_count: 0,
  directive_summary_this_week: { period_start: '2026-08-10', period_end: '2026-08-16', total: 0, by_status: {} },
}

function unprocessable(message: string) {
  return new AxiosError('Unprocessable', '422', undefined, undefined, {
    status: 422,
    statusText: 'Unprocessable Content',
    data: { data: null, errors: [message] },
    headers: {},
    config: { headers: new AxiosHeaders() },
  })
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/sdt/ps-dashboard']}>
        <PsDashboardPage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('PsDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(alertsApi.listAlerts).mockReset().mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 25, total: 0, last_page: 1 },
    })
    vi.mocked(sdtApi.activateActingPs).mockReset()
    vi.mocked(sdtApi.deactivateActingPs).mockReset()
  })

  it('TC-UI-006: Head of Mission sees the activity view only, not the Acting PS controls', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Head of Mission'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue({
      unacknowledged_alerts_count: 0,
      pending_inquiries_count: 0,
      directive_summary_this_week: { period_start: '2026-08-10', period_end: '2026-08-16', total: 0, by_status: {} },
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Principal Secretary Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Pending Inquiries')).toBeInTheDocument()
    expect(screen.getByText('Directive Summary')).toBeInTheDocument()
    expect(await screen.findByText('Unacknowledged Alerts')).toBeInTheDocument()

    // The Acting PS activation/deactivation controls are Ministry PS / System
    // Administrator only (MinistryPolicy::manageActingPs) — never shown to a HoM.
    expect(screen.queryByText('Acting PS')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Target user ID')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activate Acting PS' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate Acting PS' })).not.toBeInTheDocument()
  })

  it('Ministry PS sees the Acting PS activation/deactivation controls', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue({
      unacknowledged_alerts_count: 0,
      pending_inquiries_count: 2,
      directive_summary_this_week: { period_start: '2026-08-10', period_end: '2026-08-16', total: 1, by_status: { issued: 1 } },
    })

    renderPage()

    expect(await screen.findByText('Acting PS')).toBeInTheDocument()
    expect(screen.getByLabelText('Target user ID')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activate Acting PS' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deactivate Acting PS' })).toBeInTheDocument()
  })

  it('TC-FR-SDT-004-B: explains why a second Acting PS activation is refused (BR-023, ISS-012)', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue(emptyDashboard)
    vi.mocked(sdtApi.activateActingPs).mockRejectedValue(
      unprocessable('An Acting PS is already active in this department. Deactivate them before activating someone else.'),
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Target user ID'), '7d1f3c56-0b2a-4c1e-9f7d-2a6b8c9d0e1f')
    await user.click(screen.getByRole('button', { name: 'Activate Acting PS' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('An Acting PS is already active in this department.')
    expect(screen.queryByText('Acting PS activated.')).not.toBeInTheDocument()
  })

  it('TC-FR-SDT-006-B: says so when there is no Acting PS to deactivate, replacing an earlier success (ISS-012)', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue(emptyDashboard)
    vi.mocked(sdtApi.deactivateActingPs)
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(unprocessable('No Acting PS is currently active in this department.'))
    const user = userEvent.setup()
    renderPage()

    const deactivate = await screen.findByRole('button', { name: 'Deactivate Acting PS' })
    await user.click(deactivate)
    expect(await screen.findByText('Acting PS deactivated.')).toBeInTheDocument()

    await user.click(deactivate)

    expect(await screen.findByRole('alert')).toHaveTextContent('No Acting PS is currently active in this department.')
    expect(screen.queryByText('Acting PS deactivated.')).not.toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue({
      unacknowledged_alerts_count: 0,
      pending_inquiries_count: 0,
      directive_summary_this_week: { period_start: '2026-08-10', period_end: '2026-08-16', total: 0, by_status: {} },
    })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Principal Secretary Dashboard' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
