import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComplianceDashboardPage from './ComplianceDashboardPage'
import * as reportsApi from '../../api/reports'
import * as useAuthModule from '../../hooks/useAuth'
import { authAs, renderRoute } from './reportTestUtils'
import { COMPLIANCE_BOARD } from './complianceFixtures'

vi.mock('../../api/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/reports')>()
  return { ...actual, getReportComplianceDashboard: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

function renderPage(path = '/reports/compliance') {
  return renderRoute(path, '/reports/compliance', <ComplianceDashboardPage />)
}

describe('ComplianceDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Director'))
    vi.mocked(reportsApi.getReportComplianceDashboard).mockReset().mockResolvedValue(COMPLIANCE_BOARD)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-FR-RPT-018-A: shows every mission in one of the four states, with the detail each state needs', async () => {
    renderPage()

    const berlin = await screen.findByTestId('compliance-row-m-berlin')
    expect(within(berlin).getByText('Submitted on time')).toBeInTheDocument()
    expect(within(berlin).getByText('Submitted 2 Oct 2026')).toBeInTheDocument()
    expect(within(berlin).getByRole('link', { name: 'Open the Berlin report' })).toHaveAttribute('href', '/reports/report-berlin')

    const accra = screen.getByTestId('compliance-row-m-accra')
    expect(within(accra).getByText('Submitted late')).toBeInTheDocument()
    expect(within(accra).getByText('Late · 3 days')).toBeInTheDocument()

    const london = screen.getByTestId('compliance-row-m-london')
    expect(within(london).getByText('Draft in progress')).toBeInTheDocument()
    expect(within(london).getByText('7 of 12 sections complete')).toBeInTheDocument()
    expect(within(london).queryByRole('link')).not.toBeInTheDocument()

    const lusaka = screen.getByTestId('compliance-row-m-lusaka')
    expect(within(lusaka).getByText('Not started')).toBeInTheDocument()
    expect(within(lusaka).getByText('Post vacant')).toBeInTheDocument()
    expect(within(lusaka).getByText('Overdue · 2 days')).toBeInTheDocument()
  })

  it('TC-FR-RPT-018-B: summarises the period and filters the missions by state', async () => {
    renderPage()
    await screen.findByTestId('compliance-row-m-berlin')

    expect(screen.getByRole('img', { name: '2 of 4 missions have submitted' })).toBeInTheDocument()
    expect(screen.getByText('1 mission overdue')).toBeInTheDocument()
    expect(screen.getByText('1 vacant post')).toBeInTheDocument()
    expect(screen.getByTestId('compliance-phase')).toHaveTextContent('The submission window is open: 10 days to the 15 Oct 2026 deadline.')

    const draftTile = screen.getByTestId('compliance-tile-draft_in_progress')
    expect(draftTile).toHaveTextContent('1')
    await userEvent.click(draftTile)

    expect(draftTile).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('location')).toHaveTextContent('status=draft_in_progress')
    expect(screen.getByTestId('compliance-row-m-london')).toBeInTheDocument()
    expect(screen.queryByTestId('compliance-row-m-berlin')).not.toBeInTheDocument()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a mission' }), 'zzz')
    expect(screen.getByText('No missions match this filter.')).toBeInTheDocument()
  })

  it('switches the reporting period', async () => {
    renderPage()
    await screen.findByTestId('compliance-row-m-berlin')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Reporting period' }), 'Q4 2026')

    await waitFor(() => expect(reportsApi.getReportComplianceDashboard).toHaveBeenLastCalledWith('Q4 2026'))
    expect(screen.getByTestId('location')).toHaveTextContent('period=Q4+2026')
  })

  it('opens the period a dashboard link names', async () => {
    renderPage('/reports/compliance?period=Q4%202026&status=submitted_late')

    await screen.findByTestId('compliance-row-m-accra')
    expect(reportsApi.getReportComplianceDashboard).toHaveBeenCalledWith('Q4 2026')
    expect(screen.queryByTestId('compliance-row-m-berlin')).not.toBeInTheDocument()
  })

  it('TC-FR-RPT-018-C: refreshes on its own, so submissions appear without a reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderPage()
    await screen.findByTestId('compliance-row-m-london')

    vi.mocked(reportsApi.getReportComplianceDashboard).mockResolvedValue({
      ...COMPLIANCE_BOARD,
      missions: COMPLIANCE_BOARD.missions.map((row) =>
        row.mission_id === 'm-london' ? { ...row, status: 'submitted_on_time', progress: null, report_id: 'report-london', submitted_at: '2026-10-03T09:00:00Z' } : row,
      ),
    })
    await vi.advanceTimersByTimeAsync(31000)

    await waitFor(() => expect(within(screen.getByTestId('compliance-row-m-london')).getByText('Submitted on time')).toBeInTheDocument())
    expect(reportsApi.getReportComplianceDashboard).toHaveBeenCalledTimes(2)
  })

  it('TC-FR-RPT-018-D: shows each mission quarter by quarter, linking submitted quarters to their report', async () => {
    renderPage()
    const history = await screen.findByTestId('compliance-history')

    expect(within(history).getByRole('link', { name: 'Berlin, Q4 2026: Submitted late' })).toHaveAttribute('href', '/reports/report-berlin-q4')
    expect(within(history).getByRole('img', { name: 'Lusaka, Q4 2026: Not started, overdue' })).toBeInTheDocument()
    expect(within(history).getAllByText('1/2')).toHaveLength(2)
  })

  it('offers a retry when compliance cannot be loaded', async () => {
    vi.mocked(reportsApi.getReportComplianceDashboard).mockRejectedValueOnce(new Error('offline'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("The compliance data couldn't be loaded.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByTestId('compliance-row-m-berlin')).toBeInTheDocument()
  })

  it('TC-UI-002: keeps wide tables scrollable inside their card at 375px', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    renderPage()
    await screen.findByTestId('compliance-row-m-berlin')

    for (const table of screen.getAllByRole('table')) {
      expect(table.parentElement).toHaveClass('overflow-x-auto')
    }
  })
})
