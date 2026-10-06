import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MissionDrillDownPage from './MissionDrillDownPage'
import * as governanceApi from '../../api/governance'
import { useAuth } from '../../hooks/useAuth'
import { authAs, axiosError, renderRoute } from '../reports/reportTestUtils'
import { AGRICULTURE, LONDON_ID, drillDown } from './governanceFixtures'

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

vi.mock('../../api/governance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/governance')>()
  return { ...actual, getMissionDrillDown: vi.fn() }
})

function renderPage(missionId = LONDON_ID, query = '') {
  return renderRoute(`/mfa-awareness/missions/${missionId}${query}`, '/mfa-awareness/missions/:missionId', <MissionDrillDownPage />)
}

describe('MissionDrillDownPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authAs('MFA HQ Officer'))
    vi.mocked(governanceApi.getMissionDrillDown).mockReset().mockResolvedValue(drillDown())
  })

  it('TC-FR-MFA-002: shows the mission\'s quarter summary by type and status, as its Head of Mission sees it', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'London' })).toBeInTheDocument()
    expect(screen.getByText(/United Kingdom · summary metrics/)).toBeInTheDocument()
    expect(within(screen.getByTestId('summary-inquiry')).getByText('In Progress')).toBeInTheDocument()
    expect(within(screen.getByTestId('summary-periodic_report')).getByText('Submitted on time')).toBeInTheDocument()
    expect(governanceApi.getMissionDrillDown).toHaveBeenCalledWith(LONDON_ID, undefined)
  })

  it('TC-FR-MFA-001-AC2: shows whether each post is filled, never the attache, and submissions as metadata only', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'London' })

    expect(screen.getAllByText('Attaché posted')).toHaveLength(2)
    expect(screen.queryByText(/Purity Samanthe|Joseph Kamau/)).not.toBeInTheDocument()

    const recent = screen.getByTestId('drill-recent')
    expect(within(recent).getByText('Inquiry')).toBeInTheDocument()
    expect(within(recent).getByText('State Department for Trade')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See all in the submission log' })).toHaveAttribute('href', `/mfa-awareness?view=log&mission_id=${LONDON_ID}`)
  })

  it('narrows the summary to one department', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /State Department for Agriculture/ }))

    await waitFor(() => expect(governanceApi.getMissionDrillDown).toHaveBeenLastCalledWith(LONDON_ID, AGRICULTURE.id))
    expect(screen.getByRole('link', { name: 'See all in the submission log' })).toHaveAttribute('href', `/mfa-awareness?view=log&mission_id=${LONDON_ID}&ministry_id=${AGRICULTURE.id}`)
  })

  it('says when a mission does not exist', async () => {
    vi.mocked(governanceApi.getMissionDrillDown).mockRejectedValue(axiosError(404))
    renderPage('0198f5a2-0000-7000-8000-000000000000')

    expect(await screen.findByText('Mission not found')).toBeInTheDocument()
  })

  it('TC-FR-MFA-002-RBAC: explains the API\'s refusal for a role outside the view', async () => {
    vi.mocked(useAuth).mockReturnValue(authAs('Ministry Attache', 'mission-1'))
    vi.mocked(governanceApi.getMissionDrillDown).mockRejectedValue(axiosError(403))
    renderPage()

    expect(await screen.findByText('Not available for your role')).toBeInTheDocument()
    expect(screen.queryByTestId('drill-recent')).not.toBeInTheDocument()
  })
})
