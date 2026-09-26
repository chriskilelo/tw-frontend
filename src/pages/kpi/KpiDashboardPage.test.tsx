import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KpiDashboardPage from './KpiDashboardPage'
import * as kpiApi from '../../api/kpi'
import * as missionsApi from '../../api/missions'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/kpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/kpi')>()
  return { ...actual, getKpiComparison: vi.fn(), listKpiActuals: vi.fn() }
})

vi.mock('../../api/missions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/missions')>()
  return { ...actual, listMissions: vi.fn() }
})

const MISSION = { id: 'mission-1', name: 'London', city: 'London', active: true }

const COMPARISON = {
  cycle_label: 'Q1 2027',
  missions: [
    {
      mission_id: 'mission-1',
      mission_name: 'London',
      kpis: [
        { kpi_definition_id: 'kpi-1', name: 'Inquiries Resolved', target: 10, actual: 12, status: 'on_track' as const },
        { kpi_definition_id: 'kpi-2', name: 'Trade Shows Attended', target: 10, actual: 8, status: 'at_risk' as const },
        { kpi_definition_id: 'kpi-3', name: 'Reports Submitted', target: 10, actual: 2, status: 'below_target' as const },
      ],
    },
  ],
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/kpi/dashboard']}>
        <KpiDashboardPage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('KpiDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(kpiApi.getKpiComparison).mockReset().mockResolvedValue(COMPARISON)
    vi.mocked(kpiApi.listKpiActuals).mockReset().mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 100, total: 0, last_page: 1 },
    })
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([MISSION])
  })

  it('TC-FR-KPI-008: renders actuals with the correct colour badge for each performance state', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'KPI Dashboard' })).toBeInTheDocument()
    expect(await screen.findByText('Inquiries Resolved')).toBeInTheDocument()
    expect(screen.getByText('Trade Shows Attended')).toBeInTheDocument()
    expect(screen.getByText('Reports Submitted')).toBeInTheDocument()

    const onTrackBadge = screen.getByTestId('kpi-status-kpi-1')
    const atRiskBadge = screen.getByTestId('kpi-status-kpi-2')
    const belowTargetBadge = screen.getByTestId('kpi-status-kpi-3')

    expect(onTrackBadge).toHaveTextContent('On Track')
    expect(onTrackBadge.className).toContain('bg-success-soft')

    expect(atRiskBadge).toHaveTextContent('At Risk')
    expect(atRiskBadge.className).toContain('bg-atrisk-soft')

    expect(belowTargetBadge).toHaveTextContent('Below Target')
    expect(belowTargetBadge.className).toContain('bg-danger-soft')
  })

  it('TC-CLAUDE-RULE-10: on-track status uses the success token (#0F7A3D), at-risk uses --color-at-risk (#F59E0B), never the brand accent (#FCA311)', async () => {
    renderPage()

    const onTrackBadge = await screen.findByTestId('kpi-status-kpi-1')
    const atRiskBadge = screen.getByTestId('kpi-status-kpi-2')

    // `bg-success-soft`/`text-success-soft-text` resolve to --color-success (#0F7A3D, tokens.css).
    expect(onTrackBadge.className).toContain('bg-success-soft')
    expect(onTrackBadge.className).not.toContain('bg-accent')

    // `bg-atrisk-soft`/`text-atrisk-soft-text` resolve to --color-at-risk (#F59E0B, tokens.css) —
    // a distinct Tailwind colour token from `accent` (--color-accent, #FCA311, tokens.css).
    expect(atRiskBadge.className).toContain('bg-atrisk-soft')
    expect(atRiskBadge.className).not.toContain('bg-accent')
  })
})
