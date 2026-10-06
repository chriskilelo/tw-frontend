import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MfaAwarenessPage from './MfaAwarenessPage'
import * as governanceApi from '../../api/governance'
import { useAuth } from '../../hooks/useAuth'
import { authAs, axiosError, renderRoute } from '../reports/reportTestUtils'
import { BERLIN_ID, LOG, LONDON_ID, TRADE, mfaSummary, nationalOverview } from './governanceFixtures'

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

vi.mock('../../api/governance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/governance')>()
  return { ...actual, getMfaAwarenessSummary: vi.fn(), getSubmissionLog: vi.fn(), getNationalOverview: vi.fn() }
})

function renderPage(path = '/mfa-awareness') {
  return renderRoute(path, '/mfa-awareness', <MfaAwarenessPage />)
}

describe('MfaAwarenessPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authAs('MFA HQ Officer'))
    vi.mocked(governanceApi.getMfaAwarenessSummary).mockReset().mockResolvedValue(mfaSummary())
    vi.mocked(governanceApi.getSubmissionLog).mockReset().mockResolvedValue({ data: LOG, meta: { current_page: 1, per_page: 10, total: 2, last_page: 1 } })
    vi.mocked(governanceApi.getNationalOverview).mockReset().mockResolvedValue(nationalOverview())
  })

  it('TC-FR-MFA-001: shows submission counts by mission, department and type, stating it is totals only', async () => {
    renderPage()

    const table = await screen.findByTestId('mfa-missions-table')
    const london = within(table).getByRole('row', { name: /London/ })
    expect(within(london).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(expect.arrayContaining(['2', '1', '4']))
    expect(within(london).getByRole('link', { name: 'View the summary for London' })).toHaveAttribute('href', `/mfa-awareness/missions/${LONDON_ID}`)

    expect(screen.getByTestId('aggregate-note')).toHaveTextContent(/never the content of an alert, inquiry or report/)
    expect(screen.getByText('Totals only')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'By department' })).toBeInTheDocument()
    expect(screen.getByText('of 2 active missions')).toBeInTheDocument()
  })

  it('narrows the counts to a department and a quarter, keeping both in the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('mfa-missions-table')

    await user.selectOptions(screen.getByLabelText('Department'), TRADE.id)
    await waitFor(() => expect(governanceApi.getMfaAwarenessSummary).toHaveBeenLastCalledWith({ ministry_id: TRADE.id, period: undefined }))

    await user.selectOptions(screen.getByLabelText('Period'), 'Q1 2026')
    await waitFor(() => expect(governanceApi.getMfaAwarenessSummary).toHaveBeenLastCalledWith({ ministry_id: TRADE.id, period: 'Q1 2026' }))
    expect(screen.getByTestId('location')).toHaveTextContent('period=Q1+2026')
  })

  it('carries the department filter into a mission\'s drill-down link', async () => {
    vi.mocked(governanceApi.getMfaAwarenessSummary).mockResolvedValue(mfaSummary({ scope: { ministry_id: TRADE.id, period: null } }))
    renderPage(`/mfa-awareness?ministry_id=${TRADE.id}`)

    expect(await screen.findByRole('link', { name: 'View the summary for Berlin' })).toHaveAttribute('href', `/mfa-awareness/missions/${BERLIN_ID}?ministry_id=${TRADE.id}`)
    expect(governanceApi.getMfaAwarenessSummary).toHaveBeenCalledWith({ ministry_id: TRADE.id, period: undefined })
  })

  it('TC-FR-MFA-001-AC2: lists submissions by type, date, mission and department only', async () => {
    const user = userEvent.setup()
    renderPage('/mfa-awareness?view=log')

    const table = await screen.findByTestId('mfa-log-table')
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Date', 'Type', 'Mission', 'Department'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByText('Inquiry')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Mission'), BERLIN_ID)
    await user.click(screen.getByRole('button', { name: 'Alerts' }))
    await waitFor(() => expect(governanceApi.getSubmissionLog).toHaveBeenLastCalledWith(expect.objectContaining({ mission_id: BERLIN_ID, type: 'alert' })))
  })

  it('TC-FR-MFA-003: offers the national comparison to the MFA Principal Secretary only', async () => {
    renderPage()
    await screen.findByTestId('mfa-missions-table')
    expect(screen.queryByRole('link', { name: 'National comparison' })).not.toBeInTheDocument()
  })

  it('TC-FR-MFA-003: compares every mission and department for the Principal Secretary', async () => {
    vi.mocked(useAuth).mockReturnValue(authAs('MFA Principal Secretary'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('link', { name: 'National comparison' }))

    const missions = await screen.findByTestId('national-missions-table')
    const london = within(missions).getByRole('row', { name: /London/ })
    expect(within(london).getByText('Up 2')).toBeInTheDocument()
    expect(within(within(missions).getByRole('row', { name: /Berlin/ })).getByText('No change')).toBeInTheDocument()
    expect(within(screen.getByTestId('national-departments-table')).getByRole('row', { name: /Trade/ })).toHaveTextContent('Up 2')
    expect(screen.getByText(/still running/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Quarter to compare'), 'Q1 2026')
    await waitFor(() => expect(governanceApi.getNationalOverview).toHaveBeenLastCalledWith('Q1 2026'))
  })

  it('ranks the national comparison by activity by default, or by change or name on request', async () => {
    vi.mocked(useAuth).mockReturnValue(authAs('MFA Principal Secretary'))
    const user = userEvent.setup()
    renderPage('/mfa-awareness?view=national')

    const table = await screen.findByTestId('national-missions-table')
    const firstMission = () => within(table).getAllByRole('row')[1].querySelector('th')?.textContent ?? ''
    expect(firstMission()).toMatch(/^London/)

    await user.click(screen.getByRole('radio', { name: 'A–Z' }))
    expect(firstMission()).toMatch(/^Berlin/)

    await user.click(screen.getByRole('radio', { name: 'Biggest change' }))
    expect(firstMission()).toMatch(/^London/)
  })

  it('explains the API\'s refusal when an MFA HQ Officer opens the national comparison by its address', async () => {
    vi.mocked(governanceApi.getNationalOverview).mockRejectedValue(axiosError(403))
    renderPage('/mfa-awareness?view=national')

    expect(await screen.findByText('Not available for your role')).toBeInTheDocument()
    expect(screen.getByText('The national comparison is for the MFA Principal Secretary.')).toBeInTheDocument()
  })

  it('TC-FR-MFA-001-RBAC: explains a refusal for a role outside the view', async () => {
    vi.mocked(useAuth).mockReturnValue(authAs('Head of Mission', 'mission-1'))
    vi.mocked(governanceApi.getMfaAwarenessSummary).mockRejectedValue(axiosError(403))
    renderPage()

    expect(await screen.findByText('Not available for your role')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'MFA awareness views' })).not.toBeInTheDocument()
    expect(governanceApi.getSubmissionLog).not.toHaveBeenCalled()
  })

  it('presents no control that changes a record', async () => {
    renderPage()
    await screen.findByTestId('mfa-missions-table')

    for (const name of [/^submit/i, /^edit/i, /^approve/i, /^reject/i, /^delete/i, /^export/i, /^new\b/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
  })
})
