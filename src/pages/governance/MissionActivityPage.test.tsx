import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MissionActivityPage from './MissionActivityPage'
import * as governanceApi from '../../api/governance'
import { useAuth } from '../../hooks/useAuth'
import { authAs, axiosError, renderRoute } from '../reports/reportTestUtils'
import { AGRICULTURE, FEED, feedEnvelope, missionSummary } from './governanceFixtures'

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

vi.mock('../../api/governance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/governance')>()
  return { ...actual, getMissionActivityFeed: vi.fn(), getMissionActivitySummary: vi.fn() }
})

function renderPage(path = '/mission-activity') {
  return renderRoute(path, '/mission-activity', <MissionActivityPage />)
}

describe('MissionActivityPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authAs('Head of Mission', 'mission-1'))
    vi.mocked(governanceApi.getMissionActivitySummary).mockReset().mockResolvedValue(missionSummary())
    vi.mocked(governanceApi.getMissionActivityFeed).mockReset().mockResolvedValue(feedEnvelope())
  })

  it('TC-FR-HOM-001: shows the mission\'s submissions from every department, each with type, status, officer and department', async () => {
    renderPage()

    expect(await screen.findByTestId('mission-activity-subtitle')).toHaveTextContent('London · United Kingdom')
    const feed = await screen.findByTestId('mission-activity-feed')

    const alert = within(feed).getByTestId('activity-item-alert-1')
    expect(within(alert).getByText('ALT-202610-00003')).toBeInTheDocument()
    expect(within(alert).getByText('New')).toBeInTheDocument()
    expect(within(alert).getByText('United Kingdom · Trade Barriers')).toBeInTheDocument()
    expect(within(alert).getByText(/Submitted by Joseph Kamau/)).toBeInTheDocument()
    expect(within(alert).getByText(AGRICULTURE.name)).toBeInTheDocument()

    const report = within(feed).getByTestId('activity-item-report-1')
    expect(within(report).getByText('Submitted late')).toBeInTheDocument()
    expect(within(report).getByText(/Quarterly report for Q4 2026/)).toBeInTheDocument()
  })

  it('TC-FR-HOM-001-AC2: opens every item\'s full record from the feed', async () => {
    renderPage()
    await screen.findByTestId('mission-activity-feed')

    expect(screen.getByRole('link', { name: 'Open alert ALT-202610-00003' })).toHaveAttribute('href', '/alerts/alert-1')
    expect(screen.getByRole('link', { name: 'Open inquiry INQ-202610-00007' })).toHaveAttribute('href', '/inquiries/inquiry-1')
    expect(screen.getByRole('link', { name: 'Open quarterly report Q4 2026' })).toHaveAttribute('href', '/reports/report-1')
  })

  it('TC-FR-HOM-001-AC4: presents no create, edit, approve or reject control', async () => {
    renderPage()
    await screen.findByTestId('mission-activity-feed')

    expect(screen.getByText('View only')).toBeInTheDocument()
    for (const name of [/^submit/i, /^edit/i, /^approve/i, /^reject/i, /^delete/i, /^log inquiry/i, /^new\b/i, /^delegate/i, /^acknowledge/i, /^post feedback/i, /^issue/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
  })

  it('shows an inquiry by its organisation, flagging a high-value one', async () => {
    renderPage()
    const inquiry = await screen.findByTestId('activity-item-inquiry-1')

    expect(within(inquiry).getByText('Buyer Seeking Supplier · Acme Imports')).toBeInTheDocument()
    expect(within(inquiry).getByText('High value')).toBeInTheDocument()
  })

  it('TC-FR-HOM-002: counts this quarter by type and status against last quarter', async () => {
    renderPage()

    const alerts = await screen.findByTestId('summary-alert')
    expect(within(alerts).getByText('2')).toBeInTheDocument()
    expect(within(alerts).getByText('1 last quarter')).toBeInTheDocument()
    expect(within(alerts).getByText('New')).toBeInTheDocument()
    expect(within(alerts).getByText('Acknowledged')).toBeInTheDocument()

    expect(within(screen.getByTestId('summary-periodic_report')).getByText('Submitted on time')).toBeInTheDocument()
    expect(screen.getByText(/Q2 2026 · Oct – Dec 2026 · in progress, compared with Q1 2026/)).toBeInTheDocument()
  })

  it('TC-FR-HOM-001-AC3: filters the summary and the feed to one department', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /State Department for Agriculture/ }))

    await waitFor(() => expect(governanceApi.getMissionActivitySummary).toHaveBeenLastCalledWith(AGRICULTURE.id))
    expect(governanceApi.getMissionActivityFeed).toHaveBeenLastCalledWith(expect.objectContaining({ ministry_id: AGRICULTURE.id }))
    expect(screen.getByTestId('location')).toHaveTextContent(`ministry_id=${AGRICULTURE.id}`)
    expect(screen.getByRole('button', { name: /State Department for Agriculture/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the feed at a status chosen in the quarter summary', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Show the 1 alerts with status New in the feed' }))

    await waitFor(() =>
      expect(governanceApi.getMissionActivityFeed).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'alert', status: 'new', period: 'Q2 2026' })),
    )
    expect(screen.getByLabelText('Status')).toHaveValue('new')
  })

  it('filters by record type, then by that type\'s statuses, and clears back to everything', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('mission-activity-feed')

    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Inquiries' }))
    await waitFor(() => expect(governanceApi.getMissionActivityFeed).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'inquiry' })))

    await user.selectOptions(screen.getByLabelText('Status'), 'pending_external_response')
    await waitFor(() =>
      expect(governanceApi.getMissionActivityFeed).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'inquiry', status: 'pending_external_response' })),
    )

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(governanceApi.getMissionActivityFeed).toHaveBeenLastCalledWith(expect.objectContaining({ type: undefined, status: undefined, period: undefined })))
  })

  it('reads its filters from the URL and ignores values the API would refuse', async () => {
    renderPage('/mission-activity?type=inquiry&status=received&period=Q2%202026&sort=date&ministry_id=not-a-uuid')

    await screen.findByTestId('mission-activity-feed')
    expect(governanceApi.getMissionActivityFeed).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'inquiry', status: 'received', period: 'Q2 2026', sort: 'date', ministry_id: undefined }),
    )
    expect(governanceApi.getMissionActivitySummary).toHaveBeenCalledWith(undefined)
  })

  it('asks the server for the next page', async () => {
    vi.mocked(governanceApi.getMissionActivityFeed).mockResolvedValue(feedEnvelope(FEED, 23))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('mission-activity-feed')

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => expect(governanceApi.getMissionActivityFeed).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
  })

  it('explains an empty mission, and an empty filtered view with a way back', async () => {
    vi.mocked(governanceApi.getMissionActivityFeed).mockResolvedValue(feedEnvelope([]))
    const { unmount } = renderPage()
    expect(await screen.findByText('No submissions yet')).toBeInTheDocument()
    unmount()

    renderPage('/mission-activity?type=alert')
    expect(await screen.findByText('No submissions match these filters')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0)
  })

  it('explains a refusal from the API instead of rendering an empty view (TC-FR-HOM-001-RBAC)', async () => {
    vi.mocked(useAuth).mockReturnValue(authAs('Ministry Attache', 'mission-1'))
    vi.mocked(governanceApi.getMissionActivitySummary).mockRejectedValue(axiosError(403))
    vi.mocked(governanceApi.getMissionActivityFeed).mockRejectedValue(axiosError(403))
    renderPage()

    expect(await screen.findByText('Not available for your role')).toBeInTheDocument()
    expect(screen.getByText(/for the Head of Mission and the Deputy Head of Mission/)).toBeInTheDocument()
    expect(screen.queryByTestId('mission-activity-feed')).not.toBeInTheDocument()
  })

  it('offers a retry when the activity fails to load', async () => {
    vi.mocked(governanceApi.getMissionActivitySummary).mockRejectedValueOnce(new Error('Network Error')).mockRejectedValueOnce(new Error('Network Error')).mockRejectedValueOnce(new Error('Network Error'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('mission-activity-subtitle')).toBeInTheDocument()
  })
})
