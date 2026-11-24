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

  it('TC-FR-MFA-001-AC2: tells an MFA role the profile is unavailable without asking for it (ISS-020)', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('MFA Principal Secretary'))
    renderPage()

    expect(screen.getByText('Search is not available for your role')).toBeInTheDocument()
    expect(screen.queryByLabelText('Country')).not.toBeInTheDocument()
    expect(searchApi.getCountryProfile).not.toHaveBeenCalled()
  })
})
