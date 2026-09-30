import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportListPage from './ReportListPage'
import * as reportsApi from '../../api/reports'
import * as useAuthModule from '../../hooks/useAuth'
import type { PeriodicReport, PeriodicReportListResponse, ReportPeriods } from '../../api/reports'
import { authAs, renderRoute, reportRow } from './reportTestUtils'

vi.mock('../../api/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/reports')>()
  return { ...actual, listPeriodicReports: vi.fn(), getReportPeriods: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const PERIODS: ReportPeriods = {
  current: { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', phase: 'open', days_to_deadline: 10 },
  periods: [
    { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', deadline: '2027-01-15', phase: 'in_progress', days_to_deadline: 102 },
    { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', phase: 'open', days_to_deadline: 10 },
  ],
  missions: [
    { id: 'mission-1', name: 'London' },
    { id: 'mission-2', name: 'Berlin' },
  ],
  can_create: false,
}

const LATE: PeriodicReport = reportRow({
  id: 'report-late',
  reporting_period_label: 'Q4 2026',
  period_start_date: '2026-04-01',
  period_end_date: '2026-06-30',
  status: 'submitted',
  submitted_at: '2026-07-18T09:00:00Z',
  is_late: true,
  days_overdue: 3,
  deadline: '2026-07-15',
  compliance_status: 'submitted_late',
})

const ON_TIME: PeriodicReport = reportRow({
  id: 'report-on-time',
  mission: { id: 'mission-2', name: 'Berlin', city: 'Berlin', host_country: 'Germany' },
  status: 'submitted',
  submitted_at: '2026-10-10T09:00:00Z',
  compliance_status: 'submitted_on_time',
})

function page(data: PeriodicReport[]): PeriodicReportListResponse {
  return { data, meta: { current_page: 1, per_page: 10, total: data.length, last_page: 1 } }
}

function renderPage(path = '/reports') {
  return renderRoute(path, '/reports', <ReportListPage />, [{ path: '/reports/:id', element: <p>Report page</p> }])
}

describe('ReportListPage', () => {
  beforeEach(() => {
    vi.mocked(reportsApi.listPeriodicReports).mockReset().mockResolvedValue(page([ON_TIME, LATE]))
    vi.mocked(reportsApi.getReportPeriods).mockReset().mockResolvedValue(PERIODS)
  })

  it('TC-FR-RPT-017-A: shows an HQ reviewer every mission\'s submitted reports, with timeliness, and no start action', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))
    renderPage()

    const lateRow = await screen.findByTestId('report-row-report-late')
    expect(within(lateRow).getByText('Q4 2026')).toBeInTheDocument()
    expect(within(lateRow).getByText('London')).toBeInTheDocument()
    expect(within(lateRow).getByText('Late · 3 days')).toBeInTheDocument()
    expect(within(screen.getByTestId('report-row-report-on-time')).getByText('On time')).toBeInTheDocument()

    expect(screen.queryByRole('link', { name: 'Start a report' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Compliance dashboard' })).not.toBeInTheDocument()
  })

  it('TC-FR-RPT-017-B: filters by mission, period and timeliness through the URL', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Director'))
    renderPage()
    await screen.findByTestId('report-row-report-late')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mission' }), 'mission-2')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Reporting period' }), 'Q1 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Late' }))

    await waitFor(() =>
      expect(reportsApi.listPeriodicReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ mission_id: 'mission-2', period: 'Q1 2026', timeliness: 'late', page: 1 }),
      ),
    )
    expect(screen.getByTestId('location')).toHaveTextContent('mission_id=mission-2')
    expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Compliance dashboard' })).toHaveAttribute('href', '/reports/compliance')
  })

  it('applies a deep-linked filter from the compliance dashboard or a reminder', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry PS'))
    renderPage('/reports?mission_id=mission-1&period=Q4%202026&timeliness=late')

    await screen.findByTestId('report-row-report-late')
    expect(reportsApi.listPeriodicReports).toHaveBeenCalledWith(expect.objectContaining({ mission_id: 'mission-1', period: 'Q4 2026', timeliness: 'late' }))
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('TC-FR-RPT-013-B: shows an attache their mission\'s drafts with progress, and the quarter they owe next', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry Attache', 'mission-1'))
    vi.mocked(reportsApi.getReportPeriods).mockResolvedValue({
      ...PERIODS,
      can_create: true,
      missions: [{ id: 'mission-1', name: 'London' }],
      periods: [
        { ...PERIODS.periods[0], report: null },
        { ...PERIODS.periods[1], report: { id: 'report-1', status: 'draft', is_late: false, submitted_at: null, days_overdue: null } },
      ],
    })
    vi.mocked(reportsApi.listPeriodicReports).mockResolvedValue(page([reportRow({ progress: { total: 12, complete: 7, started: 2, empty: 3 } })]))
    renderPage()

    const callout = await screen.findByTestId('current-report-callout')
    expect(within(callout).getByRole('heading', { name: 'Your Q1 2026 report' })).toBeInTheDocument()
    expect(within(callout).getByRole('link', { name: 'Continue draft' })).toHaveAttribute('href', '/reports/report-1')

    const row = await screen.findByTestId('report-row-report-1')
    expect(within(row).getByText('7 of 12 sections complete')).toBeInTheDocument()
    expect(within(row).getByText('Draft')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a report' })).toHaveAttribute('href', '/reports/new')
    expect(screen.getByRole('button', { name: 'Overdue drafts' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Mission' })).not.toBeInTheDocument()
  })

  it('opens a report from its row', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))
    renderPage()

    await userEvent.click(await screen.findByTestId('report-row-report-late'))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/reports/report-late'))
  })

  it('explains an empty list, and a filtered one that matches nothing', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))
    vi.mocked(reportsApi.listPeriodicReports).mockResolvedValue(page([]))
    renderPage()

    expect(await screen.findByText('No submitted reports yet')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Late' }))
    expect(await screen.findByText('No reports match these filters')).toBeInTheDocument()
  })

  it('offers a retry when the list cannot be loaded', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))
    vi.mocked(reportsApi.listPeriodicReports).mockRejectedValueOnce(new Error('offline'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("The reports couldn't be loaded.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByTestId('report-row-report-late')).toBeInTheDocument()
  })

  it('TC-UI-002: renders at a 375px viewport without fixed-width content', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))
    vi.mocked(reportsApi.listPeriodicReports).mockResolvedValue(page([]))

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Periodic Reports' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
