import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveSummaryPage from './DirectiveSummaryPage'
import * as directivesApi from '../../api/directives'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return { ...actual, getDirectiveSummary: vi.fn() }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/directives/summary']}>
        <DirectiveSummaryPage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('DirectiveSummaryPage', () => {
  beforeEach(() => {
    vi.mocked(directivesApi.getDirectiveSummary).mockReset()
  })

  it('TC-FR-DIR-012: renders the completed/in-progress/overdue/cancelled summary tiles', async () => {
    vi.mocked(directivesApi.getDirectiveSummary).mockResolvedValue({
      total: 12,
      completed: 5,
      in_progress: 3,
      issued: 2,
      acknowledged: 1,
      cancelled: 1,
      overdue: 4,
      percentages: { completed: 42, in_progress: 25, overdue: 33 },
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Directive Summary' })).toBeInTheDocument()
    expect(await screen.findByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(directivesApi.getDirectiveSummary).mockResolvedValue({
      total: 0,
      completed: 0,
      in_progress: 0,
      issued: 0,
      acknowledged: 0,
      cancelled: 0,
      overdue: 0,
      percentages: { completed: 0, in_progress: 0, overdue: 0 },
    })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Directive Summary' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
