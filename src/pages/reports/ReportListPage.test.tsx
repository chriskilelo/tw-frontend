import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReportListPage from './ReportListPage'
import * as reportsApi from '../../api/reports'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/reports')>()
  return { ...actual, listPeriodicReports: vi.fn() }
})

function renderPage(initialEntry = '/reports') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ReportListPage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('ReportListPage', () => {
  beforeEach(() => {
    vi.mocked(reportsApi.listPeriodicReports).mockReset()
  })

  it('TC-FR-RPT-017: renders submitted and draft reports with their mission and status', async () => {
    vi.mocked(reportsApi.listPeriodicReports).mockResolvedValue({
      data: [
        {
          id: 'report-1',
          reporting_period_label: 'Q1 2027',
          period_start_date: '2027-07-01',
          period_end_date: '2027-09-30',
          template_version: 1,
          status: 'submitted',
          submitted_at: '2027-10-05T09:00:00Z',
          is_late: false,
          mission: { id: 'mission-1', name: 'London' },
          created_at: '2027-07-01T00:00:00Z',
          updated_at: '2027-10-05T09:00:00Z',
        },
      ],
      meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Periodic Reports' })).toBeInTheDocument()
    const row = (await screen.findByText('London')).closest('tr') as HTMLElement
    expect(within(row).getByText('Q1 2027')).toBeInTheDocument()
    expect(within(row).getByText('Submitted')).toBeInTheDocument()
  })

  it('TC-FR-RPT-016: flags a late-submitted report with the Late badge', async () => {
    vi.mocked(reportsApi.listPeriodicReports).mockResolvedValue({
      data: [
        {
          id: 'report-2',
          reporting_period_label: 'Q1 2027',
          period_start_date: '2027-07-01',
          period_end_date: '2027-09-30',
          template_version: 1,
          status: 'submitted',
          submitted_at: '2027-10-16T09:00:00Z',
          is_late: true,
          mission: { id: 'mission-2', name: 'Cairo' },
          created_at: '2027-07-01T00:00:00Z',
          updated_at: '2027-10-16T09:00:00Z',
        },
      ],
      meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    })

    renderPage()

    expect(await screen.findByText('Late')).toBeInTheDocument()
  })

  it('pre-filters by mission_id/period when arriving from the compliance console review link (Session 31)', async () => {
    vi.mocked(reportsApi.listPeriodicReports).mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 25, total: 0, last_page: 1 },
    })

    renderPage('/reports?mission_id=mission-1&period=Q1%202027')

    await screen.findByRole('heading', { name: 'Periodic Reports' })

    expect(reportsApi.listPeriodicReports).toHaveBeenCalledWith({
      status: undefined,
      mission_id: 'mission-1',
      reporting_period_label: 'Q1 2027',
      page: 1,
      per_page: 10,
    })
    expect(screen.getByText('Filtered from the compliance console.')).toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(reportsApi.listPeriodicReports).mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 25, total: 0, last_page: 1 },
    })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Periodic Reports' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
