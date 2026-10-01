import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import ManualKpiEntryPage from './ManualKpiEntryPage'
import * as kpiApi from '../../api/kpi'
import { renderRoute } from '../reports/reportTestUtils'
import { actualEntry } from './kpiFixtures'

vi.mock('../../api/kpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/kpi')>()
  return { ...actual, getKpiActualEntry: vi.fn(), recordKpiActual: vi.fn() }
})

function renderPage(path = '/kpi/manual-entry') {
  return renderRoute(path, '/kpi/manual-entry', <ManualKpiEntryPage />)
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

describe('ManualKpiEntryPage', () => {
  beforeEach(() => {
    vi.mocked(kpiApi.getKpiActualEntry).mockReset().mockResolvedValue(actualEntry())
    vi.mocked(kpiApi.recordKpiActual).mockReset().mockResolvedValue({} as kpiApi.KpiActual)
  })

  it('TC-FR-KPI-007-UI: lists the KPIs to record, with the live ones read-only beside them', async () => {
    renderPage()

    const agreements = await screen.findByTestId('manual-entry-kpi-agreements')
    expect(within(agreements).getByLabelText('Agreements signed')).toHaveValue(2)
    expect(within(agreements).getByText(/Quarter target 3/)).toBeInTheDocument()
    expect(within(agreements).getByText(/last entered by Officer One/)).toBeInTheDocument()
    expect(within(agreements).getByRole('button', { name: 'Update' })).toBeDisabled()

    expect(screen.getByRole('heading', { name: 'Calculated automatically' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Alerts submitted')).not.toBeInTheDocument()
    expect(screen.getByText('Calculated automatically from live data (intelligence alerts submitted).')).toBeInTheDocument()
  })

  it('records a value for the chosen mission and quarter', async () => {
    renderPage()
    const briefs = await screen.findByTestId('manual-entry-kpi-briefs')

    await userEvent.type(within(briefs).getByLabelText('Trade briefs'), '4')
    await userEvent.click(within(briefs).getByRole('button', { name: 'Record' }))

    await waitFor(() =>
      expect(kpiApi.recordKpiActual).toHaveBeenCalledWith({ kpi_definition_id: 'kpi-briefs', mission_id: 'mission-london', period_label: 'Q1 2026', actual_value: 4 }),
    )
    expect(await within(briefs).findByText('Saved.')).toBeInTheDocument()
  })

  it('refuses an empty or negative value before sending it', async () => {
    renderPage()
    const briefs = await screen.findByTestId('manual-entry-kpi-briefs')

    await userEvent.click(within(briefs).getByRole('button', { name: 'Record' }))
    expect(within(briefs).getByText('Enter a number of zero or more.')).toBeInTheDocument()
    expect(kpiApi.recordKpiActual).not.toHaveBeenCalled()
  })

  it('shows the server’s reason when a value is refused', async () => {
    vi.mocked(kpiApi.recordKpiActual).mockRejectedValue(httpError(422, ['Q1 2025 is closed for entry.']))
    renderPage()
    const briefs = await screen.findByTestId('manual-entry-kpi-briefs')

    await userEvent.type(within(briefs).getByLabelText('Trade briefs'), '4')
    await userEvent.click(within(briefs).getByRole('button', { name: 'Record' }))

    expect(await within(briefs).findByRole('alert')).toHaveTextContent('Q1 2025 is closed for entry.')
  })

  it('lets an HQ officer choose the mission and quarter, kept in the URL', async () => {
    vi.mocked(kpiApi.getKpiActualEntry).mockResolvedValue(
      actualEntry({
        missions_available: [
          { id: 'mission-london', name: 'London', city: 'London', host_country: 'United Kingdom' },
          { id: 'mission-dubai', name: 'Dubai', city: 'Dubai', host_country: 'United Arab Emirates' },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId('manual-entry-kpi-agreements')

    await userEvent.selectOptions(screen.getByLabelText('Mission'), 'mission-dubai')
    await waitFor(() => expect(kpiApi.getKpiActualEntry).toHaveBeenLastCalledWith({ mission_id: 'mission-dubai', period_label: undefined }))

    await userEvent.selectOptions(screen.getByLabelText('Quarter'), 'Q2 2026')
    await waitFor(() => expect(kpiApi.getKpiActualEntry).toHaveBeenLastCalledWith({ mission_id: 'mission-dubai', period_label: 'Q2 2026' }))
    expect(screen.getByTestId('location')).toHaveTextContent('quarter=Q2+2026')
  })

  it('explains when the role may not record actuals', async () => {
    vi.mocked(kpiApi.getKpiActualEntry).mockRejectedValue(httpError(403))
    renderPage()

    expect(await screen.findByText('Recording actuals isn’t available to your role')).toBeInTheDocument()
  })
})
