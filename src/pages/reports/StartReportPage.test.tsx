import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StartReportPage from './StartReportPage'
import * as reportsApi from '../../api/reports'
import * as useAuthModule from '../../hooks/useAuth'
import type { ReportPeriods } from '../../api/reports'
import { authAs, axiosError, renderRoute, reportDetail } from './reportTestUtils'

vi.mock('../../api/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/reports')>()
  return { ...actual, getReportPeriods: vi.fn(), createDraftReport: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const PERIODS: ReportPeriods = {
  current: { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', phase: 'open', days_to_deadline: 10 },
  periods: [
    { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', deadline: '2027-01-15', phase: 'in_progress', days_to_deadline: 102, report: null },
    { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', phase: 'open', days_to_deadline: 10, report: null },
    {
      label: 'Q4 2026',
      start: '2026-04-01',
      end: '2026-06-30',
      deadline: '2026-07-15',
      phase: 'closed',
      days_to_deadline: -82,
      report: { id: 'report-q4', status: 'draft', is_late: false, submitted_at: null, days_overdue: 82 },
    },
    {
      label: 'Q3 2026',
      start: '2026-01-01',
      end: '2026-03-31',
      deadline: '2026-04-15',
      phase: 'closed',
      days_to_deadline: -173,
      report: { id: 'report-q3', status: 'submitted', is_late: true, submitted_at: '2026-04-20T09:00:00Z', days_overdue: 5 },
    },
  ],
  missions: [{ id: 'mission-1', name: 'London' }],
  can_create: true,
}

function renderPage(path = '/reports/new') {
  return renderRoute(path, '/reports/new', <StartReportPage />, [{ path: '/reports/:id', element: <p>Report page</p> }])
}

describe('StartReportPage', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry Attache', 'mission-1'))
    vi.mocked(reportsApi.getReportPeriods).mockReset().mockResolvedValue(PERIODS)
    vi.mocked(reportsApi.createDraftReport).mockReset()
  })

  it('TC-FR-RPT-003-A: lists the recent quarters with their deadline and the mission\'s own report for each', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Start a periodic report', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Choose the quarter this report covers for London.')).toBeInTheDocument()

    const open = screen.getByTestId('period-card-Q1 2026')
    expect(within(open).getByText('Due next')).toBeInTheDocument()
    expect(within(open).getByText(/Due 15 Oct 2026 · 10 days left/)).toBeInTheDocument()
    expect(within(open).getByRole('button', { name: 'Start the Q1 2026 report' })).toBeInTheDocument()

    const draft = screen.getByTestId('period-card-Q4 2026')
    expect(within(draft).getByRole('link', { name: 'Continue draft' })).toHaveAttribute('href', '/reports/report-q4')
    expect(within(draft).getByText('Overdue · 82 days')).toBeInTheDocument()

    const submitted = screen.getByTestId('period-card-Q3 2026')
    expect(within(submitted).getByRole('link', { name: 'View report' })).toHaveAttribute('href', '/reports/report-q3')
    expect(within(submitted).getByText('Late · 5 days')).toBeInTheDocument()
  })

  it('TC-FR-RPT-003-B: starting a quarter creates the draft and opens it', async () => {
    vi.mocked(reportsApi.createDraftReport).mockResolvedValue(reportDetail({ id: 'report-new' }))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Start the Q1 2026 report' }))

    expect(reportsApi.createDraftReport).toHaveBeenCalledWith('Q1 2026')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/reports/report-new'))
  })

  it('TC-FR-RPT-003-C: opens the existing report instead of creating a duplicate (BR-007)', async () => {
    vi.mocked(reportsApi.createDraftReport).mockRejectedValue(
      axiosError(422, ['Your mission already has a report for Q2 2026.'], { existing_report: { id: 'report-existing', status: 'draft' } }),
    )
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Start the Q2 2026 report' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/reports/report-existing'))
  })

  it('shows why a report could not be started', async () => {
    vi.mocked(reportsApi.createDraftReport).mockRejectedValue(axiosError(422, ['No active report template is configured for this ministry.']))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Start the Q1 2026 report' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No active report template is configured for this ministry.')
  })

  it('highlights the quarter a reminder or the dashboard linked to', async () => {
    renderPage('/reports/new?period=Q2%202026')

    const card = await screen.findByTestId('period-card-Q2 2026')
    expect(card.className).toContain('ring-accent-soft')
  })

  it('TC-UI-006: tells a role that does not write reports where to read them instead', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))
    vi.mocked(reportsApi.getReportPeriods).mockResolvedValue({ ...PERIODS, can_create: false, periods: PERIODS.periods.map(({ report: _report, ...period }) => period) })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Only a mission attache starts reports' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Start the/ })).not.toBeInTheDocument()
  })
})
