import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HqWorkspacePage from './HqWorkspacePage'
import * as sdtApi from '../../api/sdt'
import * as alertsApi from '../../api/alerts'
import * as inquiriesApi from '../../api/inquiries'
import * as directivesApi from '../../api/directives'
import * as useAuthModule from '../../hooks/useAuth'
import type { AlertDetail } from '../../api/alerts'
import type { InquiryDetail } from '../../api/inquiries'
import { I18nProvider } from '../../i18n/context'
import { meFor, workspaceAlert, workspaceDirective, workspaceInquiry, workspaceOverview, workspacePage, workspaceReport } from './sdtFixtures'

vi.mock('../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sdt')>()
  return {
    ...actual,
    getHqWorkspace: vi.fn(),
    listHqWorkspaceAlerts: vi.fn(),
    listHqWorkspaceInquiries: vi.fn(),
    listHqWorkspaceDirectives: vi.fn(),
    listHqWorkspaceReports: vi.fn(),
  }
})

vi.mock('../../api/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/alerts')>()
  return { ...actual, getAlert: vi.fn(), acknowledgeAlert: vi.fn(), postAlertFeedback: vi.fn() }
})

vi.mock('../../api/inquiries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/inquiries')>()
  return { ...actual, getInquiry: vi.fn() }
})

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return { ...actual, transitionDirectiveStatus: vi.fn(), addDirectiveNote: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

function renderPage(path = '/sdt/hq-workspace') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/sdt/hq-workspace" element={<HqWorkspacePage />} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const ALERT_DETAIL: AlertDetail = {
  id: 'alert-1',
  reference_number: 'ALT-202610-00012',
  country: 'Germany',
  sector: 'coffee',
  product_category: null,
  product_description: 'German roasters are looking for new specialty coffee suppliers.',
  intelligence_type: 'opportunities',
  intelligence_source: 'Trade fair contacts',
  urgency: 'high',
  confidence_rating: 'good',
  tags: null,
  status: 'assigned',
  mission: { id: 'mission-berlin', name: 'Berlin' },
  submitted_by: { id: 'attache-1', full_name: 'Amina Attache' },
  assigned_to: { id: 'user-1', full_name: 'Carol Officer' },
  attachments: [],
  feedback: [{ id: 'fb-1', content: 'Thanks, following up.', posted_by: { id: 'ps-1', full_name: 'Esther PS' }, created_at: '2026-10-14T10:00:00Z' }],
  versions: [],
  allowed_actions: { edit: false, delegate: false, acknowledge: true, post_feedback: true },
  created_at: '2026-10-14T09:00:00Z',
  updated_at: '2026-10-14T09:00:00Z',
}

const INQUIRY_DETAIL: InquiryDetail = {
  id: 'inquiry-1',
  reference_number: 'INQ-202610-00007',
  category: 'Buyer Seeking Supplier',
  sub_type: 'standard',
  inquirer_name: 'Hans Becker',
  inquirer_organisation: 'Becker Kaffee GmbH',
  inquirer_email: 'hans@becker.example',
  inquirer_phone: '+49 30 1234',
  product_or_sector: 'Coffee',
  description: 'A roaster wants 40 tonnes of AA grade a year.',
  date_received: '2026-10-01T00:00:00.000000Z',
  status: 'in_progress',
  high_value_flag: true,
  high_value_justification: null,
  resolution_summary: null,
  closed_at: null,
  mission: { id: 'mission-berlin', name: 'Berlin' },
  logged_by: { id: 'attache-1', full_name: 'Amina Attache' },
  notes: [{ id: 'note-1', content: 'Sent the exporter list.', authored_by: { id: 'attache-1', full_name: 'Amina Attache' }, created_at: '2026-10-12T09:00:00Z' }],
  events: [{ id: 'event-1', event_type: 'hq_notified', note: 'Large buyer, worth a call.', logged_by: { id: 'attache-1', full_name: 'Amina Attache' }, created_at: '2026-10-13T08:00:00Z' }],
  referrals: [],
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-13T08:00:00Z',
}

describe('HqWorkspacePage', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry HQ Officer'))
    vi.mocked(sdtApi.getHqWorkspace).mockReset().mockResolvedValue(workspaceOverview())
    vi.mocked(sdtApi.listHqWorkspaceAlerts).mockReset().mockResolvedValue(workspacePage([workspaceAlert()]))
    vi.mocked(sdtApi.listHqWorkspaceInquiries).mockReset().mockResolvedValue(workspacePage([workspaceInquiry()]))
    vi.mocked(sdtApi.listHqWorkspaceDirectives).mockReset().mockResolvedValue(workspacePage([workspaceDirective()]))
    vi.mocked(sdtApi.listHqWorkspaceReports).mockReset().mockResolvedValue(workspacePage([workspaceReport()]))
    vi.mocked(alertsApi.getAlert).mockReset().mockResolvedValue(ALERT_DETAIL)
    vi.mocked(alertsApi.acknowledgeAlert).mockReset().mockResolvedValue({ ...ALERT_DETAIL, status: 'acknowledged' })
    vi.mocked(alertsApi.postAlertFeedback).mockReset()
    vi.mocked(inquiriesApi.getInquiry).mockReset().mockResolvedValue(INQUIRY_DETAIL)
    vi.mocked(directivesApi.transitionDirectiveStatus).mockReset()
    vi.mocked(directivesApi.addDirectiveNote).mockReset()
  })

  it('TC-FR-SDT-012-UI-A: opens on the portfolio, with its counts, tiles and section badges', async () => {
    renderPage()

    const portfolio = await screen.findByTestId('hq-workspace-portfolio')
    expect(within(portfolio).getByText('Berlin')).toBeInTheDocument()
    expect(within(portfolio).getByText('Ghana')).toBeInTheDocument()
    expect(within(portfolio).getByText('tea')).toBeInTheDocument()
    expect(within(portfolio).getByRole('radio', { name: 'My portfolio' })).toHaveAttribute('aria-checked', 'true')

    const tiles = screen.getByTestId('hq-workspace-tiles')
    expect(within(tiles).getByText('Alerts awaiting you')).toBeInTheDocument()
    expect(within(tiles).getByText('1 awaiting your closure · 1 overdue')).toBeInTheDocument()
    expect(within(tiles).getByText('Q1 2026: 2 filed, 1 late')).toBeInTheDocument()

    expect(screen.getByTestId('hq-workspace-tab-alerts')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('hq-workspace-tab-directives')).toHaveTextContent('2')
    expect(sdtApi.getHqWorkspace).toHaveBeenCalledWith({ scope: undefined, mission_id: undefined })
    expect(sdtApi.listHqWorkspaceAlerts).toHaveBeenCalledWith(expect.objectContaining({ queue: 'awaiting', page: 1 }))
  })

  it('sizes the portfolio headings\' icons to their text (an unsized SVG stretches across the row)', async () => {
    renderPage()

    const portfolio = await screen.findByTestId('hq-workspace-portfolio')
    for (const heading of ['Missions', 'Countries', 'Sectors']) {
      const term = within(portfolio).getByText(heading, { selector: 'dt' })
      expect(term.querySelector('svg')).toHaveClass('size-3.5')
    }
  })

  it('TC-FR-SDT-012-UI-B: widens to the whole department, and the URL keeps the choice', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()

    await user.click(await screen.findByRole('radio', { name: 'Whole department' }))

    await waitFor(() => expect(sdtApi.getHqWorkspace).toHaveBeenCalledWith({ scope: 'department', mission_id: undefined }))
    expect(sdtApi.listHqWorkspaceAlerts).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'department' }))
    expect(screen.getByTestId('location')).toHaveTextContent('scope=department')
  })

  it('TC-FR-SDT-012-UI-C: explains a missing portfolio and offers no scope switch', async () => {
    vi.mocked(sdtApi.getHqWorkspace).mockResolvedValue(
      workspaceOverview({ scope: 'department', portfolio: { configured: false, missions: [], countries: [], sectors: [], covers_missions: false } }),
    )
    renderPage()

    expect(await screen.findByText(/No portfolio has been set up for you yet/)).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'My portfolio' })).not.toBeInTheDocument()
  })

  it('TC-UI-006-HQW: tells any other role the workspace is not theirs, without calling the API', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry PS'))
    renderPage()

    expect(await screen.findByText('The HQ workspace is for HQ trade officers')).toBeInTheDocument()
    expect(sdtApi.getHqWorkspace).not.toHaveBeenCalled()
    expect(sdtApi.listHqWorkspaceAlerts).not.toHaveBeenCalled()
  })

  it('TC-FR-SDT-012-UI-D: shows the refusal when the API answers 403', async () => {
    vi.mocked(sdtApi.getHqWorkspace).mockRejectedValue({ isAxiosError: true, response: { status: 403, data: {} } })
    renderPage()

    expect(await screen.findByText('The HQ workspace is for HQ trade officers')).toBeInTheDocument()
  })

  it('TC-FR-SDT-013-UI-A: acknowledges an assigned alert in place and offers nothing on an alert that is not theirs', async () => {
    vi.mocked(sdtApi.listHqWorkspaceAlerts).mockResolvedValue(
      workspacePage([
        workspaceAlert(),
        workspaceAlert({ id: 'alert-2', reference_number: 'ALT-202610-00013', assigned_to_me: false, assigned_to: { id: 'user-2', full_name: 'David Officer' }, actions: { acknowledge: false, feedback: false } }),
      ]),
    )
    const user = userEvent.setup({ delay: null })
    renderPage()

    const mine = await screen.findByTestId('workspace-alert-alert-1')
    const theirs = screen.getByTestId('workspace-alert-alert-2')
    expect(within(theirs).queryByRole('button', { name: /Acknowledge/ })).not.toBeInTheDocument()
    expect(within(theirs).getByText('Assigned to David Officer')).toBeInTheDocument()

    await user.click(within(mine).getByRole('button', { name: 'Acknowledge alert ALT-202610-00012' }))

    expect(alertsApi.acknowledgeAlert).toHaveBeenCalledWith('alert-1')
    expect(await screen.findByText('Alert ALT-202610-00012 acknowledged. The submitting attache has been notified.')).toBeInTheDocument()
  })

  it('TC-FR-SDT-013-UI-B: reviews an alert in place and posts feedback to the thread', async () => {
    vi.mocked(alertsApi.postAlertFeedback).mockResolvedValue({ id: 'fb-2', content: 'Call the roaster.', posted_by_user_id: 'user-1', created_at: '2026-10-15T09:00:00Z' } as never)
    const user = userEvent.setup({ delay: null })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Review alert ALT-202610-00012' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Thanks, following up.')).toBeInTheDocument()
    expect(within(dialog).getByText('Trade fair contacts')).toBeInTheDocument()

    const post = within(dialog).getByRole('button', { name: 'Post feedback' })
    expect(post).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Your feedback/), 'Call the roaster.')
    await user.click(post)

    expect(alertsApi.postAlertFeedback).toHaveBeenCalledWith('alert-1', { content: 'Call the roaster.' })
  })

  it('TC-FR-SDT-013-UI-C: lists the inquiries flagged for HQ and reviews one read-only', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage('/sdt/hq-workspace?tab=inquiries')

    const card = await screen.findByTestId('workspace-inquiry-inquiry-1')
    expect(within(card).getByText(/Amina Attache notified HQ/)).toBeInTheDocument()
    expect(within(card).getByText(/Large buyer, worth a call/)).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Review inquiry INQ-202610-00007' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/The attache at Berlin runs this inquiry/)).toBeInTheDocument()
    expect(within(dialog).getByText('Sent the exporter list.')).toBeInTheDocument()
    expect(within(dialog).queryByText('hans@becker.example')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Close inquiry|Log event/ })).not.toBeInTheDocument()
  })

  it('TC-FR-SDT-014-UI-A: issues directives from the workspace, pre-filled from a record', async () => {
    renderPage()

    expect(await screen.findByRole('link', { name: 'Issue directive' })).toHaveAttribute('href', '/directives/new?from=hq-workspace')
    expect(await screen.findByRole('link', { name: 'Issue a directive to Berlin about ALT-202610-00012' })).toHaveAttribute(
      'href',
      '/directives/new?from=hq-workspace&mission_id=mission-berlin&context=ALT-202610-00012',
    )
  })

  it('TC-FR-SDT-014-UI-B: accepts and closes a completed directive in place', async () => {
    vi.mocked(directivesApi.transitionDirectiveStatus).mockResolvedValue({} as never)
    const user = userEvent.setup({ delay: null })
    renderPage('/sdt/hq-workspace?tab=directives')

    const card = await screen.findByTestId('workspace-directive-directive-1')
    expect(within(card).getByText('Awaiting your closure')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Withdraw/ })).not.toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: /Accept and close directive/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Accept and close' }))

    expect(directivesApi.transitionDirectiveStatus).toHaveBeenCalledWith('directive-1', { status: 'closed' })
    expect(await screen.findByText('Directive closed. The attache has been notified.')).toBeInTheDocument()
  })

  it('TC-FR-DIR-011-UI: requires text for a follow-up and a reason to withdraw', async () => {
    vi.mocked(sdtApi.listHqWorkspaceDirectives).mockResolvedValue(
      workspacePage([workspaceDirective({ status: 'in_progress', due_state: 'overdue', attention: ['overdue'], allowed_actions: { transitions: ['cancelled'], add_note: true, revise: true } })]),
    )
    vi.mocked(directivesApi.addDirectiveNote).mockResolvedValue({} as never)
    const user = userEvent.setup({ delay: null })
    renderPage('/sdt/hq-workspace?tab=directives')

    const card = await screen.findByTestId('workspace-directive-directive-1')
    await user.click(within(card).getByRole('button', { name: /Follow up on directive/ }))
    let dialog = await screen.findByRole('dialog')
    const send = within(dialog).getByRole('button', { name: 'Send follow-up' })
    expect(send).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Follow-up note/), 'Any update on the buyer list?')
    await user.click(send)
    expect(directivesApi.addDirectiveNote).toHaveBeenCalledWith('directive-1', { content: 'Any update on the buyer list?' })

    await user.click(within(card).getByRole('button', { name: /Withdraw directive/ }))
    dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Withdraw directive' })).toBeDisabled()
  })

  it('TC-FR-SDT-015-UI-A: lists submitted reports read-only, with their timeliness', async () => {
    renderPage('/sdt/hq-workspace?tab=reports')

    const card = await screen.findByTestId('workspace-report-report-1')
    expect(within(card).getByText('Berlin · Q1 2026')).toBeInTheDocument()
    expect(within(card).getByText(/Late/)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Read the Q1 2026 report from Berlin' })).toHaveAttribute('href', '/reports/report-1')
  })

  it('explains a sectors-only portfolio on the reports section', async () => {
    vi.mocked(sdtApi.getHqWorkspace).mockResolvedValue(
      workspaceOverview({ portfolio: { configured: true, missions: [], countries: [], sectors: ['tea'], covers_missions: false } }),
    )
    vi.mocked(sdtApi.listHqWorkspaceReports).mockResolvedValue(workspacePage([]))
    renderPage('/sdt/hq-workspace?tab=reports')

    expect(await screen.findByText(/Your portfolio names sectors only/)).toBeInTheDocument()
  })

  it('moves between sections with the arrow keys and clears the previous section\'s filters', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage('/sdt/hq-workspace?queue=feed&q=coffee')

    const alertsTab = await screen.findByTestId('hq-workspace-tab-alerts')
    alertsTab.focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByTestId('hq-workspace-tab-inquiries')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('hq-workspace-tab-inquiries')).toHaveFocus()
    expect(screen.getByTestId('location')).toHaveTextContent('/sdt/hq-workspace?tab=inquiries')
  })

  it('offers a way out of a filter the API refused', async () => {
    vi.mocked(sdtApi.getHqWorkspace).mockRejectedValue({ isAxiosError: true, response: { status: 422, data: { errors: ['The selected mission id is invalid.'] } } })
    const user = userEvent.setup({ delay: null })
    renderPage('/sdt/hq-workspace?mission=11111111-1111-4111-8111-111111111111')

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/sdt\/hq-workspace$/)
  })

  it('TC-UI-002: renders without fixed widths at 375px', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    const { container } = renderPage()

    expect(await screen.findByRole('heading', { name: 'HQ Workspace' })).toBeInTheDocument()
    await screen.findByTestId('workspace-alert-alert-1')
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
