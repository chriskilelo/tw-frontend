import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AlertListPage from './AlertListPage'
import * as alertsApi from '../../api/alerts'
import * as searchApi from '../../api/search'
import type { SearchResult } from '../../api/search'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/alerts')>()
  return { ...actual, listAlerts: vi.fn() }
})

vi.mock('../../api/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/search')>()
  return { ...actual, search: vi.fn() }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/alerts']}>
        <AlertListPage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('AlertListPage', () => {
  beforeEach(() => {
    vi.mocked(alertsApi.listAlerts).mockReset().mockResolvedValue({
      data: [
        {
          id: 'alert-1',
          reference_number: 'ALT-202608-00001',
          country: 'Kenya',
          sector: null,
          product_category: null,
          intelligence_type: 'opportunities',
          urgency: null,
          status: 'new',
          assigned_to_user_id: null,
          created_at: '2026-08-13T00:00:00Z',
        },
      ],
      meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    })
    vi.mocked(searchApi.search).mockReset()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Intelligence Alerts' })).toBeInTheDocument()

    // The Table is hidden below the sm breakpoint (hidden sm:block) in favour of a
    // card list (sm:hidden), so nothing forces horizontal overflow at 375px.
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })

  it('TC-LEG-001: search results render only the fields the SearchResult contract permits, never leaked personal data', async () => {
    // Simulates a hypothetical backend regression that leaks personal/case data (an
    // inquirer's name, email, and free-text case notes) into a search hit. The
    // SearchResult type has no fields for any of this — this proves the rendered
    // page only ever projects the allow-listed fields, regardless of what the API
    // response object actually contains, so such a leak would never reach the DOM.
    const leaky = {
      type: 'alert',
      id: 'alert-9',
      reference_number: 'ALT-202608-00099',
      summary: 'Opportunity in the German market',
      mission: 'Berlin',
      mission_id: 'mission-9',
      date: '2026-08-12T00:00:00Z',
      snippet: 'German <b>opportunity</b> for textiles',
      rank: 0.9,
      link: '/alerts/alert-9',
      inquirer_name: 'Jane Confidential Doe',
      inquirer_email: 'jane.doe@example.com',
      inquirer_phone: '+254700000000',
      resolution_summary: 'Internal case notes not meant for this view',
    } as unknown as SearchResult
    vi.mocked(searchApi.search).mockResolvedValue([leaky])

    renderPage()

    await userEvent.type(screen.getByLabelText('Search'), 'opportunity')

    expect(await screen.findByText('ALT-202608-00099')).toBeInTheDocument()
    expect(screen.getByText('Opportunity in the German market')).toBeInTheDocument()

    expect(screen.queryByText('Jane Confidential Doe')).not.toBeInTheDocument()
    expect(screen.queryByText('jane.doe@example.com')).not.toBeInTheDocument()
    expect(screen.queryByText('+254700000000')).not.toBeInTheDocument()
    expect(screen.queryByText('Internal case notes not meant for this view')).not.toBeInTheDocument()
  })
})
