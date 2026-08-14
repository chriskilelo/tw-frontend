import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SearchResultsPage from './SearchResultsPage'
import * as searchApi from '../../api/search'

vi.mock('../../api/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/search')>()
  return { ...actual, search: vi.fn() }
})

function renderPage(initialEntry = '/search?q=trade') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <SearchResultsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SearchResultsPage', () => {
  beforeEach(() => {
    vi.mocked(searchApi.search).mockReset()
  })

  it('TC-FR-SEARCH-001: renders results grouped by type for a valid query', async () => {
    vi.mocked(searchApi.search).mockResolvedValue([
      {
        type: 'alert',
        id: 'alert-1',
        reference_number: 'ALT-202608-00001',
        summary: 'United Kingdom — Opportunities',
        mission: 'London',
        mission_id: 'mission-1',
        date: '2026-08-10T10:00:00Z',
        snippet: 'Opportunity in the <b>trade</b> sector',
        rank: 0.8,
        link: '/alerts/alert-1',
      },
      {
        type: 'inquiry',
        id: 'inquiry-1',
        reference_number: 'INQ-202608-00001',
        summary: 'Buyer Seeking Supplier — Acme Ltd',
        mission: 'Dubai',
        mission_id: 'mission-2',
        date: '2026-08-09T10:00:00Z',
        snippet: 'Acme is seeking a <b>trade</b> partner',
        rank: 0.6,
        link: '/inquiries/inquiry-1',
      },
    ])

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Search' })).toBeInTheDocument()

    // Grouped by type: an "Alerts" group and an "Inquiries" group, each with its
    // own type badge (colour + icon + label, CLAUDE.md Rule 9) and result count.
    const alertsGroup = (await screen.findByRole('heading', { name: 'Alerts' })).closest('section') as HTMLElement
    expect(within(alertsGroup).getByText('ALT-202608-00001')).toBeInTheDocument()
    expect(within(alertsGroup).getByText('Alert')).toBeInTheDocument()

    const inquiriesGroup = screen.getByRole('heading', { name: 'Inquiries' }).closest('section') as HTMLElement
    expect(within(inquiriesGroup).getByText('INQ-202608-00001')).toBeInTheDocument()
    expect(within(inquiriesGroup).getByText('Inquiry')).toBeInTheDocument()

    // Each result links to its own detail page.
    expect(within(alertsGroup).getByRole('link', { name: /ALT-202608-00001/ })).toHaveAttribute(
      'href',
      '/alerts/alert-1',
    )
    expect(within(inquiriesGroup).getByRole('link', { name: /INQ-202608-00001/ })).toHaveAttribute(
      'href',
      '/inquiries/inquiry-1',
    )
  })

  it('TC-FR-SEARCH-001-B: shows an empty message when no results are returned', async () => {
    vi.mocked(searchApi.search).mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('No results found.')).toBeInTheDocument()
  })

  it('TC-FR-SEARCH-001-C: shows a prompt instead of searching when no query is present', () => {
    renderPage('/search')

    expect(screen.getByText('Enter a search term above to get started.')).toBeInTheDocument()
    expect(searchApi.search).not.toHaveBeenCalled()
  })
})
