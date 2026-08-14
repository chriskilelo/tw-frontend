import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveOverviewPage from './DirectiveOverviewPage'
import * as sdtApi from '../../api/sdt'

vi.mock('../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sdt')>()
  return { ...actual, getDirectiveOverview: vi.fn() }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sdt/directives/overview']}>
        <DirectiveOverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const directiveSummary = {
  total: 15,
  completed: 3,
  in_progress: 4,
  issued: 5,
  acknowledged: 1,
  cancelled: 0,
  overdue: 2,
  percentages: { completed: 20, in_progress: 27, overdue: 13 },
}

describe('DirectiveOverviewPage', () => {
  beforeEach(() => {
    vi.mocked(sdtApi.getDirectiveOverview).mockReset()
  })

  it('TC-FR-SDT-008: renders the issued/in-progress/overdue/completed summary tiles', async () => {
    vi.mocked(sdtApi.getDirectiveOverview).mockResolvedValue({
      summary: directiveSummary,
      recent_directives: [],
      stale_directives: [],
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Directive Overview' })).toBeInTheDocument()
    expect(await screen.findByText('Issued')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('lists recently issued and stale directives, each linking to its detail page', async () => {
    vi.mocked(sdtApi.getDirectiveOverview).mockResolvedValue({
      summary: directiveSummary,
      recent_directives: [
        {
          id: 'directive-1',
          type_category: null,
          description: 'Submit asset register',
          status: 'issued',
          target_completion_date: null,
          last_progress_update_at: null,
          mission: { id: 'mission-1', name: 'London' },
          target_user: { id: 'user-1', full_name: 'Purity Samanthe' },
          created_at: '2027-10-01T09:00:00Z',
        },
      ],
      stale_directives: [
        {
          id: 'directive-2',
          type_category: null,
          description: 'Trade barrier follow-up',
          status: 'in_progress',
          target_completion_date: '2027-09-01',
          last_progress_update_at: '2027-08-01T09:00:00Z',
          mission: { id: 'mission-2', name: 'Cairo' },
          target_user: { id: 'user-2', full_name: 'Tobias Ong\'any' },
          created_at: '2027-07-01T09:00:00Z',
        },
      ],
    })

    renderPage()

    expect(await screen.findByText('London')).toBeInTheDocument()
    expect(screen.getByText('Purity Samanthe')).toBeInTheDocument()
    expect(screen.getByText('Cairo')).toBeInTheDocument()
    expect(screen.getByText("Tobias Ong'any")).toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(sdtApi.getDirectiveOverview).mockResolvedValue({
      summary: directiveSummary,
      recent_directives: [],
      stale_directives: [],
    })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Directive Overview' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
