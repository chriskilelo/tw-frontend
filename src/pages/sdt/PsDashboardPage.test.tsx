import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
  return {
    ...actual,
    getPsDashboard: vi.fn(),
    getLeadershipSwitches: vi.fn(),
    activateActingPs: vi.fn(),
    deactivateActingPs: vi.fn(),
    activateDesignatedDeputy: vi.fn(),
  }
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
  pending_inquiries: [],
  directive_summary_this_week: { period_start: '2026-08-10', period_end: '2026-08-16', total: 0, by_status: {}, directives: [] },
}

const FRANK = { id: 'u-frank', full_name: 'Frank Director', role: { name: 'Ministry HQ Director' } }
const CAROL = { id: 'u-carol', full_name: 'Carol Officer', role: { name: 'Ministry HQ Officer' } }

function leadership(overrides: Partial<sdtApi.LeadershipSwitches> = {}): sdtApi.LeadershipSwitches {
  return {
    ministry: { id: 'trade', name: 'Trade' },
    acting_ps: { active: false, holder: null, can_manage: true, candidates: [CAROL, FRANK] },
    designated_deputy: { active: false, holder: null, can_manage: true, candidates: [CAROL] },
    ...overrides,
  }
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
    vi.mocked(sdtApi.activateDesignatedDeputy).mockReset()
    vi.mocked(sdtApi.getLeadershipSwitches).mockReset().mockResolvedValue(leadership())
  })

  it('TC-UI-006: Head of Mission sees the activity view only, not the Acting PS controls', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Head of Mission'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue({
      unacknowledged_alerts_count: 0,
      pending_inquiries_count: 0,
      pending_inquiries: [],
      directive_summary_this_week: { period_start: '2026-08-10', period_end: '2026-08-16', total: 0, by_status: {}, directives: [] },
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Principal Secretary Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Pending Inquiries' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Directive Summary' })).toBeInTheDocument()
    expect(await screen.findByText('Unacknowledged Alerts')).toBeInTheDocument()

    // The leadership switches are for the PS and the Acting PS only — never shown to a HoM.
    expect(screen.queryByRole('region', { name: 'Acting Principal Secretary' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Designated Deputy' })).not.toBeInTheDocument()
    expect(sdtApi.getLeadershipSwitches).not.toHaveBeenCalled()
  })

  it('TC-FR-SDT-004-K: a Ministry PS sees both leadership switches and chooses people by name, never by ID (K-02, K-05)', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue({
      unacknowledged_alerts_count: 0,
      pending_inquiries_count: 2,
      pending_inquiries: [],
      directive_summary_this_week: { period_start: '2026-08-10', period_end: '2026-08-16', total: 1, by_status: { issued: 1 }, directives: [] },
    })

    renderPage()

    const actingPs = await screen.findByRole('region', { name: 'Acting Principal Secretary' })
    expect(within(actingPs).getByText('Off')).toBeInTheDocument()
    expect(within(actingPs).getByRole('radio', { name: /Frank Director/ })).toBeInTheDocument()
    expect(within(actingPs).getByRole('button', { name: 'Make Acting PS' })).toBeDisabled()
    expect(screen.getByRole('region', { name: 'Designated Deputy' })).toBeInTheDocument()
    expect(screen.queryByText(/user ID/i)).not.toBeInTheDocument()
  })

  it('TC-FR-SDT-004-L: activates the chosen person and confirms by name', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue(emptyDashboard)
    vi.mocked(sdtApi.activateActingPs).mockResolvedValue({ ministry_id: 'trade', acting_ps_user_id: 'u-frank', active: true })
    const user = userEvent.setup()
    renderPage()

    const actingPs = await screen.findByRole('region', { name: 'Acting Principal Secretary' })
    await user.click(within(actingPs).getByRole('radio', { name: /Frank Director/ }))
    await user.click(within(actingPs).getByRole('button', { name: 'Make Frank Director Acting PS' }))

    expect(sdtApi.activateActingPs).toHaveBeenCalledWith('u-frank')
    expect(await within(actingPs).findByText('Frank Director is now Acting PS.')).toBeInTheDocument()
    expect(sdtApi.getLeadershipSwitches).toHaveBeenCalledTimes(2)
  })

  it('TC-FR-SDT-004-M: shows an Acting PS its own switch read-only, and the deputy switch it may use (K-08)', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Acting PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue(emptyDashboard)
    vi.mocked(sdtApi.getLeadershipSwitches).mockResolvedValue(
      leadership({
        acting_ps: {
          active: true,
          holder: { ...FRANK, status: 'active', since: '2026-11-03T09:00:00+00:00' },
          can_manage: false,
          candidates: [],
        },
      }),
    )
    renderPage()

    const actingPs = await screen.findByRole('region', { name: 'Acting Principal Secretary' })
    expect(within(actingPs).getByText('On')).toBeInTheDocument()
    expect(within(actingPs).getByText('Frank Director')).toBeInTheDocument()
    expect(within(actingPs).getByText('Ministry HQ Director · Acting PS since 3 Nov 2026')).toBeInTheDocument()
    expect(within(actingPs).queryByRole('button')).not.toBeInTheDocument()
    expect(within(actingPs).getByText(/only the PS or the Ministry Administrator can change it/)).toBeInTheDocument()

    const deputy = screen.getByRole('region', { name: 'Designated Deputy' })
    expect(within(deputy).getByRole('radio', { name: /Carol Officer/ })).toBeInTheDocument()
  })

  it('TC-FR-SDT-001-B: lists pending inquiries and this week\'s directives with country and status (ISS-014)', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue({
      unacknowledged_alerts_count: 0,
      pending_inquiries_count: 1,
      pending_inquiries: [
        {
          id: 'inquiry-1',
          reference_number: 'INQ-202611-00004',
          category: 'Buyer Seeking Supplier',
          status: 'pending_external_response',
          mission: { id: 'mission-berlin', name: 'Berlin', host_country: 'Germany' },
          created_at: '2026-11-20T09:00:00Z',
        },
      ],
      directive_summary_this_week: {
        period_start: '2026-11-23',
        period_end: '2026-11-29',
        total: 1,
        by_status: { in_progress: 1 },
        directives: [
          {
            id: 'directive-1',
            description: 'Brief HQ on the Berlin fair.',
            status: 'in_progress',
            mission: { id: 'mission-berlin', name: 'Berlin', host_country: 'Germany' },
            target_completion_date: null,
            created_at: '2026-11-24T09:00:00Z',
          },
        ],
      },
    })
    renderPage()

    const inquiries = await screen.findByRole('region', { name: 'Pending Inquiries' })
    expect(await within(inquiries).findByText('INQ-202611-00004')).toBeInTheDocument()
    expect(within(inquiries).getByText('Berlin · Germany')).toBeInTheDocument()
    expect(within(inquiries).getByText('Pending External Response')).toBeInTheDocument()

    const directives = screen.getByRole('region', { name: 'Directive Summary' })
    expect(within(directives).getByText('Brief HQ on the Berlin fair.')).toBeInTheDocument()
    expect(within(directives).getAllByText('In Progress').length).toBeGreaterThan(0)
    expect(within(directives).queryByText('in_progress')).not.toBeInTheDocument()
    expect(screen.queryByText(/endpoint/)).not.toBeInTheDocument()
  })

  it('TC-FR-SDT-004-B: explains why a second Acting PS activation is refused (BR-023, ISS-012)', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue(emptyDashboard)
    vi.mocked(sdtApi.activateActingPs).mockRejectedValue(
      unprocessable('An Acting PS is already active in this department. Deactivate them before activating someone else.'),
    )
    const user = userEvent.setup()
    renderPage()

    const actingPs = await screen.findByRole('region', { name: 'Acting Principal Secretary' })
    await user.click(within(actingPs).getByRole('radio', { name: /Carol Officer/ }))
    await user.click(within(actingPs).getByRole('button', { name: 'Make Carol Officer Acting PS' }))

    expect(await within(actingPs).findByRole('alert')).toHaveTextContent('An Acting PS is already active in this department.')
    expect(within(actingPs).queryByText('Carol Officer is now Acting PS.')).not.toBeInTheDocument()
  })

  it('TC-FR-SDT-006-B: ends the assignment by name, and shows the server\'s reason when it cannot (ISS-012, K-08)', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue(emptyDashboard)
    vi.mocked(sdtApi.getLeadershipSwitches).mockResolvedValue(
      leadership({
        acting_ps: { active: true, holder: { ...FRANK, status: 'active', since: null }, can_manage: true, candidates: [CAROL, FRANK] },
      }),
    )
    vi.mocked(sdtApi.deactivateActingPs)
      .mockRejectedValueOnce(unprocessable('No Acting PS is currently active in this department.'))
      .mockResolvedValueOnce({ ministry_id: 'trade', active: false })
    const user = userEvent.setup()
    renderPage()

    const actingPs = await screen.findByRole('region', { name: 'Acting Principal Secretary' })
    const end = within(actingPs).getByRole('button', { name: 'End Frank Director’s assignment' })
    await user.click(end)
    expect(await within(actingPs).findByRole('alert')).toHaveTextContent('No Acting PS is currently active in this department.')

    await user.click(end)
    expect(await within(actingPs).findByText('The Acting PS assignment has ended. The PS is in charge again.')).toBeInTheDocument()
    expect(within(actingPs).queryByRole('alert')).not.toBeInTheDocument()
    expect(sdtApi.deactivateActingPs).toHaveBeenLastCalledWith(undefined)
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Ministry PS'))
    vi.mocked(sdtApi.getPsDashboard).mockReset().mockResolvedValue({
      unacknowledged_alerts_count: 0,
      pending_inquiries_count: 0,
      pending_inquiries: [],
      directive_summary_this_week: { period_start: '2026-08-10', period_end: '2026-08-16', total: 0, by_status: {}, directives: [] },
    })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Principal Secretary Dashboard' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
