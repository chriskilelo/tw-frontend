import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ComplianceDashboardPage from './ComplianceDashboardPage'
import * as reportsApi from '../../api/reports'

vi.mock('../../api/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/reports')>()
  return { ...actual, getReportComplianceDashboard: vi.fn() }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/reports/compliance']}>
        <ComplianceDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ComplianceDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(reportsApi.getReportComplianceDashboard).mockReset()
  })

  it('TC-FR-RPT-018: renders on-time/late/pending mission rows and the matching summary counts', async () => {
    vi.mocked(reportsApi.getReportComplianceDashboard).mockResolvedValue({
      period_label: 'Q1 2027',
      missions: [
        { mission_id: 'mission-1', mission_name: 'London', status: 'submitted_on_time', submitted_at: '2027-10-05T09:00:00Z' },
        { mission_id: 'mission-2', mission_name: 'Cairo', status: 'submitted_late', submitted_at: '2027-10-16T09:00:00Z' },
        { mission_id: 'mission-3', mission_name: 'Accra', status: 'not_yet_submitted', submitted_at: null },
      ],
      summary: { submitted_on_time: 1, submitted_late: 1, not_yet_submitted: 1 },
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Report Compliance Dashboard' })).toBeInTheDocument()
    expect(await screen.findByText('London')).toBeInTheDocument()
    expect(screen.getByText('Cairo')).toBeInTheDocument()
    expect(screen.getByText('Accra')).toBeInTheDocument()
    expect(screen.getByText('On Time')).toBeInTheDocument()
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Submitted On Time')).toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(reportsApi.getReportComplianceDashboard).mockResolvedValue({
      period_label: 'Q1 2027',
      missions: [],
      summary: { submitted_on_time: 0, submitted_late: 0, not_yet_submitted: 0 },
    })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Report Compliance Dashboard' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
