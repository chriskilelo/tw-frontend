import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveOverviewPage from './DirectiveOverviewPage'
import * as sdtApi from '../../api/sdt'
import * as directivesApi from '../../api/directives'
import * as useAuthModule from '../../hooks/useAuth'
import { I18nProvider } from '../../i18n/context'
import { directiveOverview, directiveRow, meFor } from './sdtFixtures'

vi.mock('../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sdt')>()
  return { ...actual, getDirectiveOverview: vi.fn() }
})

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return { ...actual, listDirectives: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

function renderPage(path = '/sdt/directives/overview') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/sdt/directives/overview" element={<DirectiveOverviewPage />} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const OVERDUE_ROW = directiveRow({ id: 'directive-9', description: 'Map EU deforestation rules for coffee exporters.', status: 'in_progress', due_state: 'overdue', days_until_due: -5, is_overdue: true })

describe('DirectiveOverviewPage', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry HQ Director', { id: 'director-1' }))
    vi.mocked(sdtApi.getDirectiveOverview).mockReset().mockResolvedValue(directiveOverview())
    vi.mocked(directivesApi.listDirectives)
      .mockReset()
      .mockResolvedValue({ data: [OVERDUE_ROW], meta: { current_page: 1, per_page: 10, total: 1, last_page: 1 } })
  })

  it('TC-FR-SDT-008-UI-A: opens read-only for a Director, with what needs attention now', async () => {
    renderPage()

    const tiles = await screen.findByTestId('directive-overview-tiles')
    expect(within(tiles).getByText('Open directives')).toBeInTheDocument()
    expect(within(tiles).getByText('of 15 issued')).toBeInTheDocument()
    expect(within(tiles).getByText('Awaiting closure')).toBeInTheDocument()
    expect(within(tiles).getByText('20%')).toBeInTheDocument()
    expect(screen.getByText('View only')).toBeInTheDocument()
    expect(screen.getByText(/This board is for oversight/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Accept and close|Withdraw|Acknowledge/ })).not.toBeInTheDocument()
  })

  it('TC-FR-SDT-008-UI-B: refuses a role outside the board without calling the API', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry HQ Officer'))
    renderPage()

    expect(await screen.findByText('Directive Overview not available')).toBeInTheDocument()
    expect(sdtApi.getDirectiveOverview).not.toHaveBeenCalled()
    expect(directivesApi.listDirectives).not.toHaveBeenCalled()
  })

  it('TC-FR-SDT-008-UI-C: shows the refusal when the API answers 403', async () => {
    vi.mocked(sdtApi.getDirectiveOverview).mockRejectedValue({ isAxiosError: true, response: { status: 403, data: {} } })
    renderPage()

    expect(await screen.findByText('Directive Overview not available')).toBeInTheDocument()
  })

  it('TC-FR-DIR-003-UI: opens the first busy queue, straight from the directive list with its filter', async () => {
    renderPage()

    const queue = await screen.findByTestId('directive-attention-queue')
    expect(within(queue).getByRole('tab', { name: /Overdue/ })).toHaveAttribute('aria-selected', 'true')
    expect(await within(queue).findByText('Map EU deforestation rules for coffee exporters.')).toBeInTheDocument()
    expect(directivesApi.listDirectives).toHaveBeenCalledWith(expect.objectContaining({ due: 'overdue', sort: 'target_completion_date', page: 1 }))
    expect(within(queue).getByRole('link', { name: /Open in the directive list/ })).toHaveAttribute('href', '/directives?due=overdue&sort=target_completion_date')
  })

  it('TC-FR-DIR-010-UI: switches queues, each with its own filter, and skips empty queues on arrival', async () => {
    vi.mocked(sdtApi.getDirectiveOverview).mockResolvedValue(directiveOverview({ attention: { open: 4, overdue: 0, approaching: 0, stale: 3, no_date: 1, awaiting_closure: 2 } }))
    const user = userEvent.setup({ delay: null })
    renderPage()

    const queue = await screen.findByTestId('directive-attention-queue')
    await waitFor(() => expect(directivesApi.listDirectives).toHaveBeenCalledWith(expect.objectContaining({ stale: true, sort: 'last_progress_update_at' })))

    await user.click(within(queue).getByRole('tab', { name: /Awaiting closure/ }))
    await waitFor(() => expect(directivesApi.listDirectives).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'completed' })))
    expect(screen.getByTestId('location')).toHaveTextContent('queue=awaiting_closure')
  })

  it('TC-FR-SDT-009-UI: ranks missions with a health badge and links every count to the list', async () => {
    renderPage()

    const board = await screen.findByTestId('directive-mission-board')
    const berlin = within(board).getByTestId('overview-mission-mission-berlin')
    expect(within(berlin).getByText('Needs attention')).toBeInTheDocument()
    expect(within(berlin).getByText(/Amina Attache/)).toBeInTheDocument()
    expect(within(berlin).getByRole('link', { name: 'View 2 overdue at Berlin' })).toHaveAttribute('href', '/directives?mission_id=mission-berlin&due=overdue')
    expect(within(board).getByTestId('overview-mission-mission-cairo')).toHaveTextContent('No attache posted')
  })

  it('TC-FR-DIR-011-UI-OV: shows each issuer\'s follow-through, and the viewer\'s own when they issued any', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry PS', { id: 'user-1' }))
    vi.mocked(sdtApi.getDirectiveOverview).mockResolvedValue(
      directiveOverview({ my_follow_through: { open: 6, overdue: 2, approaching: 1, stale: 1, no_date: 3, awaiting_closure: 2 } }),
    )
    renderPage()

    const mine = await screen.findByTestId('directive-overview-mine')
    expect(mine).toHaveTextContent('2 are completed and waiting for you to close them; 2 overdue; 1 without progress for 14 days.')
    expect(within(mine).getByRole('link', { name: 'Review 2 completed' })).toHaveAttribute('href', '/directives?issued_by_user_id=user-1&status=completed')

    const issuers = screen.getByTestId('directive-issuer-board')
    expect(within(issuers).getByText('You')).toBeInTheDocument()
  })

  it('TC-FR-DIR-014-UI: lists recent workflow steps, each opening its directive', async () => {
    renderPage()

    const activity = await screen.findByTestId('directive-recent-activity')
    expect(within(activity).getByText(/Amina Attache moved a directive to/)).toBeInTheDocument()
    expect(within(activity).getByRole('link', { name: 'Compile the Q2 buyer-contact list for the Berlin food fair.' })).toHaveAttribute('href', '/directives/directive-1')
  })

  it('TC-FR-DIR-012-UI-OV: filters the whole board by mission', async () => {
    const berlinId = '0199c5a0-0000-7000-8000-00000000be71'
    vi.mocked(sdtApi.getDirectiveOverview).mockResolvedValue(
      directiveOverview({
        summary: { ...directiveOverview().summary, filter_options: { missions: [{ id: berlinId, name: 'Berlin' }], issuers: [] } },
      }),
    )
    const user = userEvent.setup({ delay: null })
    renderPage()

    await screen.findByTestId('directive-overview-tiles')
    await user.selectOptions(screen.getByLabelText('Mission'), berlinId)

    await waitFor(() => expect(sdtApi.getDirectiveOverview).toHaveBeenLastCalledWith({ mission_id: berlinId }))
    await waitFor(() => expect(directivesApi.listDirectives).toHaveBeenLastCalledWith(expect.objectContaining({ mission_id: berlinId })))
    expect(screen.getByTestId('location')).toHaveTextContent(`mission_id=${berlinId}`)
  })

  it('ignores a malformed mission in the address instead of sending it', async () => {
    renderPage('/sdt/directives/overview?mission_id=not-a-uuid')

    await screen.findByTestId('directive-overview-tiles')
    expect(sdtApi.getDirectiveOverview).toHaveBeenCalledWith({})
  })

  it('links a tile to its queue on the same page', async () => {
    renderPage()

    const tiles = await screen.findByTestId('directive-overview-tiles')
    expect(within(tiles).getByRole('link', { name: /Stale/ })).toHaveAttribute('href', '/sdt/directives/overview?queue=stale#queue')
  })

  it('TC-UI-002: renders without fixed widths at 375px', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    const { container } = renderPage()

    await screen.findByTestId('directive-overview-tiles')
    expect(container.querySelectorAll('[style*="width"]:not([role="meter"] *)')).toHaveLength(0)
  })
})
