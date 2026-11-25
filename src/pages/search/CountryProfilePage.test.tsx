import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CountryProfilePage from './CountryProfilePage'
import * as searchApi from '../../api/search'
import * as useAuthModule from '../../hooks/useAuth'
import { I18nProvider } from '../../i18n/context'
import { authAs } from '../reports/reportTestUtils'

vi.mock('../../api/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/search')>()
  return { ...actual, getCountryProfile: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/search/countries/Germany']}>
          <Routes>
            <Route path="/search/countries/:country" element={<CountryProfilePage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('CountryProfilePage', () => {
  beforeEach(() => {
    vi.mocked(searchApi.getCountryProfile).mockReset().mockResolvedValue({
      country: 'Germany',
      total_alerts: 4,
      by_intelligence_type: { opportunities: 3, trade_barriers: 1 },
      by_sector: { Horticulture: 4 },
      recent_alerts: [],
    })
  })

  it('TC-FR-SEARCH-004: shows the country’s alert totals', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))
    renderPage()

    expect(await screen.findByText('Total Alerts')).toBeInTheDocument()
    expect(searchApi.getCountryProfile).toHaveBeenCalledWith('Germany')
  })

  it('TC-FR-SEARCH-004-B: names intelligence types and uses plain wording (ISS-013)', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))
    vi.mocked(searchApi.getCountryProfile).mockResolvedValue({
      country: 'Germany',
      total_alerts: 1,
      by_intelligence_type: { trade_barriers: 1 },
      by_sector: {},
      recent_alerts: [
        { id: 'alert-1', reference_number: 'ALT-202611-00009', intelligence_type: 'trade_barriers', sector: null, urgency: null, status: 'new', mission: 'Berlin', submitted_by: null, created_at: '2026-11-02T09:00:00Z' },
      ],
    })
    renderPage()

    expect((await screen.findAllByText('Trade Barriers')).length).toBe(2)
    expect(screen.queryByText('trade_barriers')).not.toBeInTheDocument()
    expect(screen.queryByText(/endpoint|backend|FR-SEARCH/)).not.toBeInTheDocument()
  })

  it('TC-FR-MFA-001-AC2: tells an MFA role the profile is unavailable without asking for it (ISS-020)', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('MFA Principal Secretary'))
    renderPage()

    expect(screen.getByText('Search is not available for your role')).toBeInTheDocument()
    expect(screen.queryByLabelText('Country')).not.toBeInTheDocument()
    expect(searchApi.getCountryProfile).not.toHaveBeenCalled()
  })
})
