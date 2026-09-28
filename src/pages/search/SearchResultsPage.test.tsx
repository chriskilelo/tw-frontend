import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SearchResultsPage from './SearchResultsPage'
import * as searchApi from '../../api/search'
import type { SearchResult } from '../../api/search'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/search')>()
  return { ...actual, search: vi.fn() }
})

const ALERT_RESULT: SearchResult = {
  type: 'alert',
  id: 'alert-1',
  reference_number: 'ALT-202608-00001',
  summary: 'United Kingdom — opportunities',
  mission: 'London',
  mission_id: 'mission-1',
  date: '2026-08-01T10:00:00Z',
  snippet: 'Opportunity in the <b>trade</b> sector',
  rank: 0.8,
  link: '/alerts/alert-1',
  status: 'assigned',
  country: 'United Kingdom',
  intelligence_type: 'opportunities',
  sector: 'Horticulture',
}

const INQUIRY_RESULT: SearchResult = {
  type: 'inquiry',
  id: 'inquiry-1',
  reference_number: 'INQ-202608-00001',
  summary: 'Buyer Seeking Supplier — Acme Ltd',
  mission: 'Dubai',
  mission_id: 'mission-2',
  date: '2026-08-09T10:00:00Z',
  snippet: 'Acme is seeking a <b>trade</b> partner',
  rank: 0.2,
  link: '/inquiries/inquiry-1',
  status: 'in_progress',
  sub_type: 'dispute_or_complaint',
}

function renderPage(initialEntry = '/search?q=trade') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/search/countries/:country" element={<p>Country profile page</p>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function resultReferences(): string[] {
  return screen.getAllByTestId('search-result').map((card) => within(card).getByText(/^(ALT|INQ)-/).textContent ?? '')
}

describe('SearchResultsPage', () => {
  beforeEach(() => {
    vi.mocked(searchApi.search).mockReset()
  })

  it('TC-FR-SEARCH-002: keeps results in one list ranked by relevance across record types', async () => {
    vi.mocked(searchApi.search).mockResolvedValue([ALERT_RESULT, INQUIRY_RESULT])

    renderPage()

    expect(await screen.findByText('2 results for “trade”')).toBeInTheDocument()
    expect(resultReferences()).toEqual(['ALT-202608-00001', 'INQ-202608-00001'])
  })

  it('TC-FR-SEARCH-003: each result shows its type, title, mission, date and highlighted snippet, and opens the record', async () => {
    vi.mocked(searchApi.search).mockResolvedValue([ALERT_RESULT, INQUIRY_RESULT])

    renderPage()

    const [alertCard, inquiryCard] = await screen.findAllByTestId('search-result')

    // Type badge and status badge each pair colour with an icon and a text label (Rule 9).
    expect(within(alertCard).getByText('Alert')).toBeInTheDocument()
    expect(within(alertCard).getByText('Assigned')).toBeInTheDocument()
    expect(within(alertCard).getByText('London')).toBeInTheDocument()
    expect(within(alertCard).getByText('1 Aug 2026')).toBeInTheDocument()
    expect(within(alertCard).getByText('Horticulture')).toBeInTheDocument()
    expect(within(alertCard).getByText('trade').tagName).toBe('MARK')

    // The alert title is built from its country and translated intelligence type.
    expect(within(alertCard).getByRole('link', { name: 'United Kingdom · Opportunities' })).toHaveAttribute('href', '/alerts/alert-1')

    expect(within(inquiryCard).getByText('Inquiry')).toBeInTheDocument()
    expect(within(inquiryCard).getByText('Dispute / Complaint')).toBeInTheDocument()
    expect(within(inquiryCard).getByRole('link', { name: 'Buyer Seeking Supplier — Acme Ltd' })).toHaveAttribute(
      'href',
      '/inquiries/inquiry-1',
    )
  })

  it('TC-FR-SEARCH-002-B: filters by record type and mission, and sorts newest first', async () => {
    vi.mocked(searchApi.search).mockResolvedValue([ALERT_RESULT, INQUIRY_RESULT])
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Inquiries/ }))
    expect(screen.getByRole('button', { name: /Inquiries/ })).toHaveAttribute('aria-pressed', 'true')
    expect(resultReferences()).toEqual(['INQ-202608-00001'])

    await user.click(screen.getByRole('button', { name: /All/ }))
    await user.selectOptions(screen.getByLabelText('Mission'), 'mission-1')
    expect(resultReferences()).toEqual(['ALT-202608-00001'])

    await user.selectOptions(screen.getByLabelText('Mission'), '')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'newest')
    expect(resultReferences()).toEqual(['INQ-202608-00001', 'ALT-202608-00001'])
  })

  it('TC-FR-SEARCH-002-C: explains when the filters hide every result and offers to clear them', async () => {
    vi.mocked(searchApi.search).mockResolvedValue([ALERT_RESULT])
    const user = userEvent.setup()

    renderPage('/search?q=trade&type=inquiry')

    expect(await screen.findByText('No results match these filters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(resultReferences()).toEqual(['ALT-202608-00001'])
  })

  it('TC-FR-SEARCH-001-B: shows an empty state naming the query when nothing matches', async () => {
    vi.mocked(searchApi.search).mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('No results for “trade”')).toBeInTheDocument()
  })

  it('TC-FR-SEARCH-001-C: shows what can be searched instead of searching when no query is present', () => {
    renderPage('/search')

    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What you can search' })).toBeInTheDocument()
    expect(screen.getByText('Report text is not searchable yet.')).toBeInTheDocument()
    expect(searchApi.search).not.toHaveBeenCalled()
  })

  it('TC-FR-SEARCH-001-D: submitting the search box runs the search', async () => {
    vi.mocked(searchApi.search).mockResolvedValue([ALERT_RESULT])
    const user = userEvent.setup()

    renderPage('/search')

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), '  avocado  ')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('1 result for “avocado”')).toBeInTheDocument()
    expect(searchApi.search).toHaveBeenCalledWith('avocado')
  })

  it('shows an error message when the search request fails', async () => {
    vi.mocked(searchApi.search).mockRejectedValue(new Error('Network error'))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  })

  it('TC-FR-SEARCH-004: links to the country profile from alert results and from the country box', async () => {
    vi.mocked(searchApi.search).mockResolvedValue([ALERT_RESULT, INQUIRY_RESULT])
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByRole('link', { name: /United Kingdom\s*1/ })).toHaveAttribute(
      'href',
      '/search/countries/United%20Kingdom',
    )

    await user.type(screen.getByLabelText('Country'), 'Germany')
    await user.click(screen.getByRole('button', { name: 'Open profile' }))

    expect(await screen.findByText('Country profile page')).toBeInTheDocument()
  })
})
