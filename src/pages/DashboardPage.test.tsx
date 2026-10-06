import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from './DashboardPage'
import { I18nProvider } from '../i18n/context'
import * as authApi from '../api/auth'
import * as dashboardApi from '../api/dashboard'
import * as governanceApi from '../api/governance'
import * as sdtApi from '../api/sdt'
import * as missionsApi from '../api/missions'
import * as ministriesApi from '../api/ministries'
import type { MeResponse } from '../api/auth'
import { feedEnvelope, mfaSummary, missionSummary, nationalOverview } from './governance/governanceFixtures'
import type {
  AdministrationDashboard,
  AttacheDashboard,
  DashboardCalendar,
  GeneralDashboard,
  LeadershipDashboard,
} from '../api/dashboard'

vi.mock('../api/auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/auth')>()), me: vi.fn() }))
vi.mock('../api/dashboard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/dashboard')>()),
  getDashboard: vi.fn(),
  getAdministrationDashboard: vi.fn(),
}))
vi.mock('../api/governance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/governance')>()),
  getMissionActivitySummary: vi.fn(),
  getMissionActivityFeed: vi.fn(),
  getMfaAwarenessSummary: vi.fn(),
  getNationalOverview: vi.fn(),
}))
vi.mock('../api/sdt', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/sdt')>()), getHrmdDashboard: vi.fn() }))
vi.mock('../api/missions', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/missions')>()), listMissions: vi.fn() }))
vi.mock('../api/ministries', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/ministries')>()), listDepartments: vi.fn() }))

const calendar: DashboardCalendar = {
  today: '2026-09-29',
  quarter: { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', days_elapsed: 91, days_total: 92 },
  reporting_period: { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', days_remaining: 16 },
}

const quarters = [
  { label: 'Q3 2026', start: '2026-01-01', end: '2026-03-31' },
  { label: 'Q4 2026', start: '2026-04-01', end: '2026-06-30' },
  { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30' },
]

const kpiCycles = [
  { label: 'H1 2026', start: '2026-07-01', end: '2026-12-31' },
  { label: 'H2 2026', start: '2026-01-01', end: '2026-06-30' },
  { label: 'H1 2025', start: '2025-07-01', end: '2025-12-31' },
]

function me(roleName: string, extra: Partial<MeResponse['user']> = {}): MeResponse {
  return {
    user: {
      id: 'user-1',
      full_name: 'Purity Samanthe',
      email: 'purity.samanthe@tradewatch.go.ke',
      role_id: 'role-1',
      mission_id: 'mission-1',
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
      mission: { id: 'mission-1', name: 'London', host_country: 'United Kingdom', city: 'London', time_zone: 'Europe/London' },
      ministry: { id: 'ministry-1', name: 'State Department for Trade' },
      ...extra,
    },
    role: { id: 'role-1', name: roleName, layer: '2', scope: 'ministry' },
    permissions: [],
  }
}

const attacheDashboard: AttacheDashboard = {
  view: 'attache',
  calendar,
  mission: { id: 'mission-1', name: 'London', city: 'London', host_country: 'United Kingdom', time_zone: 'Europe/London' },
  activity_trend: quarters.map((quarter, index) => ({ ...quarter, alerts: [4, 3, 1][index], inquiries: [2, 2, 1][index] })),
  alerts: { this_quarter: 1, previous_quarter: 3, outcomes: { new: 4, assigned: 3, acknowledged: 3 } },
  inquiries: { open: 2, high_value_open: 1, closed_this_quarter: 0, pipeline: { draft: 0, received: 1, in_progress: 1, pending_external_response: 0, resolved: 0 } },
  directives: {
    open: 1,
    overdue: 1,
    items: [
      {
        id: 'directive-1',
        description: 'Brief HQ on the avocado market',
        status: 'issued',
        mission_name: 'London',
        target_name: 'Purity Samanthe',
        target_completion_date: '2026-09-01',
        is_overdue: true,
        is_stale: false,
      },
    ],
  },
  report: { period: calendar.reporting_period, id: 'report-1', status: 'draft', is_late: false, submitted_at: null, sections_total: 12, sections_drafted: 7 },
  kpi: {
    cycle: kpiCycles[1],
    previous_cycle: kpiCycles[2],
    options: kpiCycles,
    kpis: [{ kpi_definition_id: 'kpi-1', name: 'Number of trade briefs submitted', target: 10, actual: 11, status: 'on_track', previous_actual: 4 }],
  },
}

const leadershipDashboard: LeadershipDashboard = {
  view: 'leadership',
  variant: 'executive',
  calendar,
  alerts: { this_quarter: 18, previous_quarter: 41, awaiting_action: 5, unacknowledged: 12 },
  alert_trend: quarters.map((quarter) => ({ ...quarter, opportunities: 10, trade_barriers: 8, other: 0 })),
  inquiries: { open: 45, high_value_open: 8, closed_this_quarter: 3, closed_previous_quarter: 24, funnel: { logged: 95, worked_on: 88, resolved: 68, closed: 68, cancelled: 1 } },
  inquiry_trend: quarters.map((quarter) => ({ ...quarter, received: 20, closed: 18 })),
  reports: {
    period: calendar.reporting_period,
    summary: { submitted_on_time: 12, submitted_late: 2, draft_in_progress: 2, not_started: 1, not_yet_submitted: 3, overdue: 0, vacant: 0, total: 17 },
    total: 17,
    attention: [
      { mission_id: 'mission-2', mission_name: 'Berlin', status: 'not_started', submitted_at: null, report_id: null, is_overdue: false, days_overdue: null },
      { mission_id: 'mission-3', mission_name: 'Accra', status: 'submitted_late', submitted_at: '2026-07-18T09:00:00Z', report_id: 'report-accra', is_overdue: false, days_overdue: 3 },
    ],
    trend: quarters.map((quarter, index) => ({ ...quarter, is_open: index === 2, on_time: 15, late: 2, missing: 0 })),
  },
  directives: {
    summary: {
      total: 22,
      completed: 17,
      closed: 5,
      in_progress: 4,
      issued: 0,
      acknowledged: 0,
      cancelled: 1,
      overdue: 4,
      approaching: 0,
      no_target_date: 0,
      on_track: 0,
      stale: 1,
      percentages: { completed: 77.3, in_progress: 18.2, overdue: 18.2, no_target_date: 0 },
      by_mission: [],
      by_issuer: [],
      filter_options: { missions: [], issuers: [] },
      filters: { date_from: null, date_to: null, mission_id: null, issued_by_user_id: null },
    },
    needs_attention: 0,
    items: [],
  },
  kpi: { cycle: kpiCycles[1], options: kpiCycles, missions: [{ mission_id: 'mission-3', mission_name: 'Lusaka', counts: { on_track: 1, at_risk: 1, below_target: 9, pending: 0, no_target: 0, no_data: 0 }, total: 11 }] },
  top_countries: [{ name: 'United Kingdom', count: 11 }],
  top_sectors: [{ name: 'coffee', count: 9 }],
  alert_inbox: [
    { id: 'alert-1', reference_number: 'ALT-202609-00001', country: 'United Kingdom', intelligence_type: 'trade_barriers', urgency: null, status: 'new', mission_name: 'London', created_at: '2026-09-26T09:00:00Z' },
  ],
}

const generalDashboard: GeneralDashboard = {
  view: 'general',
  calendar,
  assigned_alerts: { count: 0, items: [] },
  notifications: { unread: 1, items: [{ id: 'notification-1', message: 'A new alert was routed to you.', link: '/alerts/alert-1', created_at: '2026-09-28T09:00:00Z' }] },
}

const administrationDashboard: AdministrationDashboard = {
  scope: { type: 'department', ministry: { id: 'ministry-1', name: 'State Department for Trade' } },
  accounts: {
    total: 90,
    by_status: { activation_pending: 0, active: 90, locked: 0, deactivated: 0 },
    sign_in_recency: [
      { key: 'last_7_days', count: 9 },
      { key: 'last_30_days', count: 0 },
      { key: 'last_90_days', count: 53 },
      { key: 'older', count: 0 },
      { key: 'never', count: 28 },
    ],
    dormant: 53,
    never_signed_in: 28,
    stale_invitations: 0,
    close_to_locking: 0,
    by_role: [{ role: 'Ministry Attache', count: 74 }],
  },
  sign_in_activity: [{ week_start: '2026-09-21', active_users: 6, failed_attempts: 2 }],
  departments: [
    {
      id: 'ministry-1',
      name: 'State Department for Trade',
      active: true,
      active_accounts: 90,
      ministry_administrators: { filled: 4, limit: 3 },
      principal_secretary: { id: 'user-9', full_name: 'QA Ministry PS' },
      acting_ps: null,
      designated_deputy_active: true,
      attache_posts: { total: 17, vacant: 0 },
      configuration: {
        inquiry_categories: 6,
        alert_intelligence_types: 2,
        directive_types: 0,
        aie_budget_codes: 14,
        referral_organisations: 7,
        kpi_definitions: 11,
        report_template_sections: 12,
      },
    },
  ],
  approvals: { pending: 0, overdue: 0, decided_last_90_days: 0, median_decision_hours: null, items: [] },
  health_checks: [
    { key: 'ministry_administrators', status: 'fail', value: 1, detail: ['over_limit'] },
    { key: 'configuration_gaps', status: 'warn', value: 1, detail: ['directive_types'] },
    { key: 'locked_accounts', status: 'pass', value: 0 },
  ],
  recent_activity: [{ id: 'log-1', action: 'approval_request.rejected', actor: 'QA System Administrator', entity_type: 'ApprovalRequest', created_at: '2026-09-26T09:00:00Z' }],
  platform: null,
}

function renderDashboard(roleName: string, extra: Partial<MeResponse['user']> = {}) {
  vi.mocked(authApi.me).mockReset().mockResolvedValue(me(roleName, extra))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <DashboardPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.mocked(dashboardApi.getDashboard).mockReset()
    vi.mocked(dashboardApi.getAdministrationDashboard).mockReset()
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([])
    vi.mocked(ministriesApi.listDepartments).mockReset().mockResolvedValue([])
  })

  it('TC-FR-KPI-010: shows an attache their own mission KPIs against target, with the previous cycle', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue(attacheDashboard)
    renderDashboard('Ministry Attache')

    expect(await screen.findByRole('heading', { level: 1, name: /Purity/ })).toBeInTheDocument()
    expect(screen.getByText('Number of trade briefs submitted')).toBeInTheDocument()
    expect(screen.getByText(/\/ target 10/)).toHaveTextContent('11 / target 10')
    expect(screen.getByText(/Up 7 on Jul – Dec 2025/)).toBeInTheDocument()
    expect(screen.getByText('1 of 1 KPIs on track for Jan – Jun 2026.')).toBeInTheDocument()
  })

  it('TC-FR-KPI-009: switching the KPI cycle refetches the dashboard for that cycle', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue(attacheDashboard)
    renderDashboard('Ministry Attache')

    const cycles = await screen.findByRole('radiogroup', { name: 'Performance cycle' })
    await userEvent.click(within(cycles).getByRole('radio', { name: /Jul–Dec ’25/ }))

    await waitFor(() => expect(dashboardApi.getDashboard).toHaveBeenLastCalledWith('H1 2025'))
  })

  it('TC-UI-003-A: every chart can be read as a data table instead', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue(attacheDashboard)
    renderDashboard('Ministry Attache')

    const activity = (await screen.findByRole('heading', { name: 'Your mission’s activity' })).closest('section') as HTMLElement
    const toggle = within(activity).getByRole('button', { name: 'Table view' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(toggle)

    expect(within(activity).getByRole('button', { name: 'Chart view' })).toHaveAttribute('aria-pressed', 'true')
    const table = within(activity).getByRole('table')
    expect(within(table).getByRole('rowheader', { name: /Q1 2026 \(Jul – Sept 2026\)/ })).toBeInTheDocument()
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Period', 'Alerts submitted', 'Inquiries received'])
  })

  it('TC-UI-003-B: the KPI cycle picker is a radio group that moves with the arrow keys', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue(attacheDashboard)
    renderDashboard('Ministry Attache')

    const cycles = await screen.findByRole('radiogroup', { name: 'Performance cycle' })
    const selected = within(cycles).getByRole('radio', { checked: true })
    expect(selected).toHaveAttribute('tabindex', '0')
    within(cycles)
      .getAllByRole('radio', { checked: false })
      .forEach((radio) => expect(radio).toHaveAttribute('tabindex', '-1'))

    selected.focus()
    await userEvent.keyboard('{ArrowRight}')

    await waitFor(() => expect(dashboardApi.getDashboard).toHaveBeenLastCalledWith('H1 2025'))
  })

  it('TC-UI-003-C: statuses pair colour with a text label, and the overdue directive says so in words', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue(attacheDashboard)
    renderDashboard('Ministry Attache')

    expect(await screen.findByText('On Track')).toBeInTheDocument()
    const directives = screen.getByRole('heading', { name: 'Directives waiting on you' }).closest('section') as HTMLElement
    expect(within(directives).getByText('Overdue')).toBeInTheDocument()
    expect(within(directives).getByRole('link', { name: /Brief HQ on the avocado market/ })).toHaveAttribute('href', '/directives/directive-1')
  })

  it('TC-FR-SDT-001: gives the PS the routed-alert inbox and a Review alerts action with the waiting count', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue(leadershipDashboard)
    renderDashboard('Ministry PS', { mission_id: null, mission: null })

    expect(await screen.findByRole('heading', { name: 'Alerts awaiting your action' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ALT-202609-00001/ })).toHaveAttribute('href', '/alerts/alert-1')
    expect(screen.getByRole('link', { name: /Review alerts/ })).toHaveTextContent('5')
    expect(screen.getByText('Lusaka has the fewest KPIs on track for Jan – Jun 2026.')).toBeInTheDocument()
  })

  it('TC-FR-RPT-018-DASH: the compliance card counts the four report states and links each mission to follow up', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue({ ...leadershipDashboard, variant: 'director', alert_inbox: undefined })
    renderDashboard('Ministry HQ Director', { mission_id: null, mission: null })

    const card = (await screen.findByRole('heading', { name: 'Report compliance' })).closest('section') as HTMLElement
    expect(within(card).getByText('Draft in progress')).toBeInTheDocument()
    expect(within(card).getByText('Not started')).toBeInTheDocument()

    const berlin = within(card).getByRole('link', { name: /Berlin/ })
    expect(berlin.getAttribute('href')).toMatch(/^\/reports\/compliance\?period=.+&status=not_started$/)
    expect(within(card).getByRole('link', { name: /Accra/ })).toHaveAttribute('href', '/reports/report-accra')
  })

  it('gives the Ministry HQ Director the department view without the PS inbox', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue({ ...leadershipDashboard, variant: 'director', alert_inbox: undefined })
    renderDashboard('Ministry HQ Director', { mission_id: null, mission: null })

    expect(await screen.findByRole('heading', { name: 'Market intelligence' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Alerts awaiting your action' })).not.toBeInTheDocument()
    expect(screen.getByText('Directive completion')).toBeInTheDocument()
  })

  it('TC-UI-006: gives a Head of Mission a view-only dashboard with no write actions', async () => {
    vi.mocked(governanceApi.getMissionActivitySummary).mockResolvedValue(missionSummary())
    vi.mocked(governanceApi.getMissionActivityFeed).mockResolvedValue(feedEnvelope())
    renderDashboard('Head of Mission')

    expect(await screen.findByText('View only')).toBeInTheDocument()
    expect(screen.getByText('Alerts · New')).toBeInTheDocument()
    expect(screen.getByText('United Kingdom · Trade Barriers')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alert' })).toHaveAttribute('href', '/alerts/alert-1')
    expect(screen.queryByText('Directives this quarter')).not.toBeInTheDocument()
    for (const write of [/Submit alert/, /Log inquiry/, /Issue directive/, /New account/]) {
      expect(screen.queryByRole('link', { name: write })).not.toBeInTheDocument()
    }
  })

  it('TC-FR-MFA-001: shows the MFA Principal Secretary totals only, with each mission’s momentum', async () => {
    vi.mocked(governanceApi.getMfaAwarenessSummary).mockResolvedValue(mfaSummary())
    vi.mocked(governanceApi.getNationalOverview).mockResolvedValue(nationalOverview())
    renderDashboard('MFA Principal Secretary', { mission_id: null, ministry_id: null, mission: null, ministry: null })

    expect(await screen.findByText(/This view shows totals only/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mission momentum' })).toBeInTheDocument()
    expect(await screen.findByText(/Rising/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Search/ })).not.toBeInTheDocument()
    expect(governanceApi.getMfaAwarenessSummary).toHaveBeenCalledWith()
  })

  it('TC-FR-SDT-016: shows the HRM&D Officer KPI status across missions for the chosen cycle', async () => {
    const hrmdCell = { applicable: true, expected: 2, attainment: null, variance: null, performance: null, target_source: 'mission' as const, quarters_reported: 2, quarters: [] }
    vi.mocked(sdtApi.getHrmdDashboard).mockResolvedValue({
      cycle_label: 'H2 2026',
      missions: [
        {
          mission_id: 'mission-1',
          mission_name: 'London',
          kpis: [
            { ...hrmdCell, kpi_definition_id: 'kpi-1', name: 'Trade briefs', target: 2, actual: 2, status: 'on_track' },
            { ...hrmdCell, kpi_definition_id: 'kpi-2', name: 'Forums attended', target: 2, actual: 0, status: 'below_target' },
          ],
        },
      ],
    })
    renderDashboard('HRM&D Officer', { mission_id: null, mission: null })

    expect(await screen.findByText('50%')).toBeInTheDocument()
    expect(screen.getByText(/recorded in the audit trail/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'KPIs most often below target' })).toBeInTheDocument()
    expect(sdtApi.getHrmdDashboard).toHaveBeenCalledWith(expect.stringMatching(/^H[12] \d{4}$/))
  })

  it('TC-FR-AUTH-020: gives a Ministry Administrator the department administration view, never platform capacity', async () => {
    vi.mocked(dashboardApi.getAdministrationDashboard).mockResolvedValue(administrationDashboard)
    renderDashboard('Ministry Administrator', { mission_id: null, mission: null })

    expect(await screen.findByText('Ministry Administrator seats')).toBeInTheDocument()
    expect(screen.getByText('1 department holds more than the limit of three.')).toBeInTheDocument()
    expect(screen.getByText('PS approval request rejected')).toBeInTheDocument()
    expect(screen.getByText('4 of 3, over the limit')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Platform capacity' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument()
  })

  it('lets a System Administrator narrow the administration view to one department', async () => {
    vi.mocked(dashboardApi.getAdministrationDashboard).mockResolvedValue({
      ...administrationDashboard,
      scope: { type: 'platform', ministry: null },
      platform: { system_administrators: 1, storage: { used_bytes: 0, capacity_bytes: 2_000_000_000_000, files: 0 }, queue: { pending: 0, failed: 0 }, records: { alerts: 362, inquiries: 221, directives: 22, periodic_reports: 147 } },
    })
    vi.mocked(ministriesApi.listDepartments).mockResolvedValue([{ id: 'ministry-1', name: 'State Department for Trade', active: true }])
    renderDashboard('System Administrator', { mission_id: null, ministry_id: null, mission: null, ministry: null })

    expect(await screen.findByRole('heading', { name: 'Platform capacity' })).toBeInTheDocument()
    await screen.findByRole('option', { name: 'State Department for Trade' })
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'ministry-1')

    await waitFor(() => expect(dashboardApi.getAdministrationDashboard).toHaveBeenLastCalledWith('ministry-1'))
  })

  it('offers other roles search, their routed alerts and unread notifications', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue(generalDashboard)
    renderDashboard('Designated Deputy', { mission_id: null, mission: null })

    expect(await screen.findByRole('search')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /A new alert was routed to you/ })).toHaveAttribute('href', '/alerts/alert-1')
    expect(screen.getByText('No alerts are waiting on you.')).toBeInTheDocument()
  })

  it('offers a retry when the dashboard cannot be loaded', async () => {
    vi.mocked(dashboardApi.getDashboard).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(generalDashboard)
    renderDashboard('Designated Deputy', { mission_id: null, mission: null })

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('search')).toBeInTheDocument()
  })

  it('TC-UI-002: stacks the stat tiles in one column on phones', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue(attacheDashboard)
    renderDashboard('Ministry Attache')

    const tile = (await screen.findByText('Alerts this quarter')).closest('a') as HTMLElement
    const grid = tile.parentElement as HTMLElement
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('lg:grid-cols-4')
  })
})
