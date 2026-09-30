import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveOverviewPage from './DirectiveOverviewPage'
import * as sdtApi from '../../api/sdt'
import type { Directive, DirectiveSummary } from '../../api/directives'
import { I18nProvider } from '../../i18n/context'

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
      <I18nProvider>
      <MemoryRouter initialEntries={['/sdt/directives/overview']}>
        <DirectiveOverviewPage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const directiveSummary: DirectiveSummary = {
  total: 15,
  completed: 3,
  closed: 1,
  in_progress: 4,
  issued: 5,
  acknowledged: 1,
  cancelled: 0,
  overdue: 2,
  approaching: 1,
  no_target_date: 6,
  on_track: 3,
  stale: 1,
  percentages: { completed: 20, in_progress: 26.7, overdue: 13.3, no_target_date: 40 },
  by_mission: [],
  by_issuer: [],
  filter_options: { missions: [], issuers: [] },
  filters: { date_from: null, date_to: null, mission_id: null, issued_by_user_id: null },
}

function directiveRow(overrides: Partial<Directive> & Pick<Directive, 'id' | 'description'>): Directive {
  return {
    type_category: null,
    status: 'issued',
    target_completion_date: null,
    last_progress_update_at: null,
    mission: { id: 'mission-1', name: 'London' },
    target_user: { id: 'user-1', full_name: 'Purity Samanthe' },
    issued_by: { id: 'officer-1', full_name: 'Jane Wanjiru' },
    created_at: '2027-10-01T09:00:00Z',
    updated_at: '2027-10-01T09:00:00Z',
    is_overdue: false,
    is_stale: false,
    due_state: 'no_date',
    days_until_due: null,
    ...overrides,
  }
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

  it('TC-FR-SDT-008-A: summary tiles drill down to the matching directive list', async () => {
    vi.mocked(sdtApi.getDirectiveOverview).mockResolvedValue({ summary: directiveSummary, recent_directives: [], stale_directives: [] })

    renderPage()

    expect(await screen.findByRole('link', { name: /Issued/ })).toHaveAttribute('href', '/directives?status=issued')
    expect(screen.getByRole('link', { name: /In Progress/ })).toHaveAttribute('href', '/directives?status=in_progress')
    expect(screen.getByRole('link', { name: /Overdue/ })).toHaveAttribute('href', '/directives?due=overdue')
    expect(screen.getByRole('link', { name: /Completed/ })).toHaveAttribute('href', '/directives?status=completed')
    expect(screen.getByRole('link', { name: 'View summary' })).toHaveAttribute('href', '/directives/summary')
  })

  it('TC-FR-DIR-010: lists recent and stale directives with due and stale badges, each linking to its detail page', async () => {
    vi.mocked(sdtApi.getDirectiveOverview).mockResolvedValue({
      summary: directiveSummary,
      recent_directives: [
        directiveRow({ id: 'directive-1', description: 'Submit asset register', due_state: 'approaching', target_completion_date: '2027-10-05', days_until_due: 3 }),
      ],
      stale_directives: [
        directiveRow({
          id: 'directive-2',
          description: 'Trade barrier follow-up',
          status: 'in_progress',
          target_completion_date: '2027-09-01',
          last_progress_update_at: '2027-08-01T09:00:00Z',
          mission: { id: 'mission-2', name: 'Cairo' },
          target_user: { id: 'user-2', full_name: "Tobias Ong'any" },
          is_overdue: true,
          is_stale: true,
          due_state: 'overdue',
          days_until_due: -30,
        }),
      ],
    })

    renderPage()

    const recentRow = await screen.findByTestId('overview-recent-directive-1')
    expect(within(recentRow).getByRole('link', { name: 'Submit asset register' })).toHaveAttribute('href', '/directives/directive-1')
    expect(within(recentRow).getByText('London')).toBeInTheDocument()
    expect(within(recentRow).getByText('Purity Samanthe')).toBeInTheDocument()
    expect(within(recentRow).getByText('Due in 3 days')).toBeInTheDocument()

    const staleRow = screen.getByTestId('overview-stale-directive-2')
    expect(within(staleRow).getByRole('link', { name: 'Trade barrier follow-up' })).toHaveAttribute('href', '/directives/directive-2')
    expect(within(staleRow).getByText('Cairo')).toBeInTheDocument()
    expect(within(staleRow).getByText("Tobias Ong'any")).toBeInTheDocument()
    expect(within(staleRow).getByText('Stale')).toBeInTheDocument()
    expect(within(staleRow).getByText('30 days overdue')).toBeInTheDocument()
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
