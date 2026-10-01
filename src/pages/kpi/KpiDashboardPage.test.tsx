import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import KpiDashboardPage from './KpiDashboardPage'
import * as kpiApi from '../../api/kpi'
import { renderRoute } from '../reports/reportTestUtils'
import { counts, departmentDashboard, kpiRow, missionDashboard, PERIOD_H2_2026_FINAL } from './kpiFixtures'

vi.mock('../../api/kpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/kpi')>()
  return { ...actual, getKpiDashboard: vi.fn(), downloadKpiReport: vi.fn() }
})

function renderPage(path = '/kpi/dashboard') {
  return renderRoute(path, '/kpi/dashboard', <KpiDashboardPage />)
}

function httpError(status: number, errors: string[] = []): AxiosError {
  return new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: { data: null, errors },
    headers: {},
    config: { headers: new AxiosHeaders() },
  })
}

describe('KpiDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(kpiApi.getKpiDashboard).mockReset().mockResolvedValue(missionDashboard())
    vi.mocked(kpiApi.downloadKpiReport).mockReset().mockResolvedValue()
  })

  it('TC-FR-KPI-008-UI: shows each KPI’s actual against its target with an icon-and-label status', async () => {
    renderPage('/kpi/dashboard?mission=mission-london')

    const agreements = await screen.findByTestId('kpi-card-kpi-1')
    expect(within(agreements).getByText('Agreements signed')).toBeInTheDocument()
    expect(within(agreements).getByText('of 10')).toBeInTheDocument()
    expect(within(agreements).getByText('60% of target')).toBeInTheDocument()
    expect(within(agreements).getByText('Expected by now: 5')).toBeInTheDocument()
    expect(within(agreements).getByTestId('kpi-status-kpi-1')).toHaveTextContent('On Track')
    expect(within(agreements).getByRole('img', { name: 'Agreements signed: 6 against a target of 10, On Track' })).toBeInTheDocument()
    expect(within(agreements).getByText('+2 (+50%) vs H2 2026')).toBeInTheDocument()

    const alerts = screen.getByTestId('kpi-card-kpi-2')
    expect(within(alerts).getByText('Live')).toBeInTheDocument()
    expect(within(alerts).getByTestId('kpi-status-kpi-2')).toHaveTextContent('Below Target')

    expect(screen.getByTestId('kpi-period-banner')).toHaveTextContent('1 of 2 quarters settled')
    expect(kpiApi.getKpiDashboard).toHaveBeenCalledWith({ period: undefined, mission_id: 'mission-london' })
  })

  it('TC-FR-KPI-010-UI: puts what needs attention first and lets the reader filter by status', async () => {
    renderPage('/kpi/dashboard?mission=mission-london')

    await screen.findByTestId('kpi-card-kpi-2')
    const cards = screen.getAllByTestId(/^kpi-card-/)
    expect(cards.map((card) => card.getAttribute('data-testid'))).toEqual(['kpi-card-kpi-2', 'kpi-card-kpi-1'])

    await userEvent.click(screen.getByTestId('kpi-status-tile-below_target'))
    expect(screen.getByTestId('location')).toHaveTextContent('status=below_target')
    expect(screen.queryByTestId('kpi-card-kpi-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('kpi-card-kpi-2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show all statuses' }))
    expect(screen.getByTestId('kpi-card-kpi-1')).toBeInTheDocument()
  })

  it('TC-FR-KPI-009-UI: changes the period by half-year, quarter or a custom range written to the URL', async () => {
    renderPage('/kpi/dashboard?mission=mission-london')
    await screen.findByTestId('kpi-card-kpi-1')

    await userEvent.selectOptions(screen.getByLabelText('Half-year'), 'H2 2026')
    await waitFor(() => expect(kpiApi.getKpiDashboard).toHaveBeenLastCalledWith({ period: 'H2 2026', mission_id: 'mission-london' }))

    await userEvent.click(screen.getByRole('radio', { name: 'Custom range' }))
    await userEvent.type(screen.getByLabelText('From'), '2026-06-01')
    await userEvent.type(screen.getByLabelText('To'), '2025-07-01')
    await userEvent.click(screen.getByRole('button', { name: 'Apply range' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a start date on or before the end date.')

    await userEvent.clear(screen.getByLabelText('To'))
    await userEvent.type(screen.getByLabelText('To'), '2026-09-30')
    await userEvent.click(screen.getByRole('button', { name: 'Apply range' }))
    await waitFor(() => expect(kpiApi.getKpiDashboard).toHaveBeenLastCalledWith({ from: '2026-06-01', to: '2026-09-30', mission_id: 'mission-london' }))
    expect(screen.getByTestId('location')).toHaveTextContent('from=2026-06-01&to=2026-09-30')
  })

  it('TC-FR-KPI-016-UI: shows the department view with totals and the missions to watch', async () => {
    vi.mocked(kpiApi.getKpiDashboard).mockResolvedValue(departmentDashboard())
    renderPage()

    const total = await screen.findByTestId('kpi-total-kpi-1')
    expect(total).toHaveTextContent('14 of 20 across 2 of 2 missions with a target')
    expect(total).toHaveTextContent('1 of 2 missions on track')

    await userEvent.click(screen.getByRole('button', { name: 'View Dubai' }))
    expect(screen.getByTestId('location')).toHaveTextContent('mission=mission-dubai')
    await waitFor(() => expect(kpiApi.getKpiDashboard).toHaveBeenLastCalledWith({ period: undefined, mission_id: 'mission-dubai' }))
  })

  it('TC-FR-KPI-010-B: gives an attache their own mission only, read-only', async () => {
    vi.mocked(kpiApi.getKpiDashboard).mockResolvedValue(
      missionDashboard({
        missions_available: [{ id: 'mission-london', name: 'London', city: 'London', host_country: 'United Kingdom' }],
        can: { choose_mission: false, set_targets: false, compare: false, download_report: false, record_actuals: true },
      }),
    )
    renderPage()

    await screen.findByTestId('kpi-card-kpi-1')
    expect(screen.queryByLabelText('Mission', { selector: 'select' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Set targets' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Compare missions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download report' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Record actuals' })).toHaveAttribute('href', '/kpi/manual-entry')
  })

  it('TC-FR-KPI-012-UI: shows each quarter’s report compliance and links a submitted report', async () => {
    renderPage('/kpi/dashboard?mission=mission-london')

    const q1 = await screen.findByTestId('kpi-compliance-Q1-2026')
    expect(q1).toHaveTextContent('Submitted on time')
    expect(within(q1).getByRole('link', { name: 'Open report' })).toHaveAttribute('href', '/reports/report-q1')
    expect(screen.getByTestId('kpi-compliance-Q2-2026')).toHaveTextContent('Not due yet')
  })

  it('opens a KPI’s quarterly detail with its trend and quarter table', async () => {
    renderPage('/kpi/dashboard?mission=mission-london')
    await screen.findByTestId('kpi-card-kpi-1')

    await userEvent.click(screen.getByRole('button', { name: 'Details for Agreements signed' }))

    const detail = await screen.findByTestId('kpi-detail')
    expect(within(detail).getByText('Last eight quarters')).toBeInTheDocument()
    expect(within(detail).getByText('Settled')).toBeInTheDocument()
    expect(within(detail).getByText('Settle after 15 Jan 2027')).toBeInTheDocument()

    await userEvent.click(within(detail).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('kpi-detail')).not.toBeInTheDocument())
  })

  it('TC-FR-KPI-015-UI: downloads the performance report for the mission and period, but not for a custom range', async () => {
    renderPage('/kpi/dashboard?mission=mission-london')
    await screen.findByTestId('kpi-card-kpi-1')

    await userEvent.click(screen.getByRole('button', { name: 'Download report' }))
    expect(kpiApi.downloadKpiReport).toHaveBeenCalledWith('mission-london', 'H1 2026')
  })

  it('disables the report download for a custom range', async () => {
    vi.mocked(kpiApi.getKpiDashboard).mockResolvedValue(missionDashboard({ period: { ...PERIOD_H2_2026_FINAL, type: 'range', label: 'Q3 2026 – Q4 2026' } }))
    renderPage('/kpi/dashboard?from=2026-01-01&to=2026-06-30')

    await screen.findByTestId('kpi-card-kpi-1')
    expect(screen.getByRole('button', { name: 'Download report' })).toBeDisabled()
  })

  it('states when a period is final, and shows a pending KPI as too early to judge', async () => {
    vi.mocked(kpiApi.getKpiDashboard).mockResolvedValue(
      missionDashboard({ period: PERIOD_H2_2026_FINAL, summary: { counts: counts({ pending: 1 }), total: 1, judged: 0, score: null }, kpis: [kpiRow({ status: 'pending', performance: null })] }),
    )
    renderPage()

    expect(await screen.findByTestId('kpi-period-banner')).toHaveTextContent('Final')
    expect(screen.getByTestId('kpi-status-kpi-1')).toHaveTextContent('Pending')
    expect(screen.getByText('Nothing can be judged yet for this period.')).toBeInTheDocument()
  })

  it('explains when the role may not use the dashboard', async () => {
    vi.mocked(kpiApi.getKpiDashboard).mockRejectedValue(httpError(403))
    renderPage()

    expect(await screen.findByText('The KPI dashboard isn’t available to your role')).toBeInTheDocument()
  })

  it('shows the server’s reason for a rejected period and offers to reset the view', async () => {
    vi.mocked(kpiApi.getKpiDashboard).mockRejectedValue(httpError(422, ['A custom range cannot extend beyond the current quarter.']))
    renderPage('/kpi/dashboard?from=2026-01-01&to=2030-01-01')

    expect(await screen.findByText('A custom range cannot extend beyond the current quarter.')).toBeInTheDocument()
    vi.mocked(kpiApi.getKpiDashboard).mockResolvedValue(missionDashboard())
    await userEvent.click(screen.getByRole('button', { name: 'Reset the view' }))
    expect(await screen.findByTestId('kpi-card-kpi-1')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/kpi\/dashboard$/)
  })

  it('shows an empty state when no KPIs apply', async () => {
    vi.mocked(kpiApi.getKpiDashboard).mockResolvedValue(missionDashboard({ kpis: [], summary: { counts: counts(), total: 0, judged: 0, score: null } }))
    renderPage()

    expect(await screen.findByText('No KPIs to show')).toBeInTheDocument()
  })
})
