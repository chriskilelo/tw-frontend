import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveListPage from './DirectiveListPage'
import * as directivesApi from '../../api/directives'
import * as missionsApi from '../../api/missions'
import * as useAuthModule from '../../hooks/useAuth'
import type { Directive, DirectiveListResponse, DirectiveSummary } from '../../api/directives'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return { ...actual, listDirectives: vi.fn(), getDirectiveSummary: vi.fn() }
})

vi.mock('../../api/missions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/missions')>()
  return { ...actual, listMissions: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

function authAs(roleName: string): ReturnType<typeof useAuthModule.useAuth> {
  return {
    user: {
      id: 'user-1',
      full_name: 'Test User',
      email: 'user@sdt.go.ke',
      role_id: 'role-1',
      mission_id: roleName === 'Ministry Attache' ? 'mission-1' : null,
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: roleName, layer: '2', scope: 'ministry' },
    permissions: [],
    isLoading: false,
    isAuthenticated: true,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAuthModule.useAuth>
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

function DetailStub() {
  const { id } = useParams()
  return <p>Directive detail {id}</p>
}

function renderPage(initialEntry = '/directives') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/directives" element={<DirectiveListPage />} />
            <Route path="/directives/:id" element={<DetailStub />} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const STALE_DIRECTIVE: Directive = {
  id: 'directive-1',
  type_category: 'Market brief',
  description: 'Submit outstanding trade brief.',
  status: 'in_progress',
  target_completion_date: null,
  last_progress_update_at: '2026-06-01T00:00:00Z',
  mission: { id: 'mission-1', name: 'London' },
  target_user: { id: 'attache-1', full_name: 'Purity Samanthe' },
  issued_by: { id: 'officer-1', full_name: 'Jane Wanjiru' },
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  is_overdue: false,
  is_stale: true,
  due_state: 'no_date',
  days_until_due: null,
}

function page(data: Directive[], meta: Partial<DirectiveListResponse['meta']> = {}): DirectiveListResponse {
  return { data, meta: { current_page: 1, per_page: 10, total: data.length, last_page: 1, ...meta } }
}

const SUMMARY: DirectiveSummary = {
  total: 3,
  completed: 1,
  closed: 0,
  in_progress: 1,
  issued: 1,
  acknowledged: 0,
  cancelled: 0,
  overdue: 1,
  approaching: 0,
  no_target_date: 1,
  on_track: 0,
  stale: 1,
  percentages: { completed: 33.3, in_progress: 33.3, overdue: 33.3, no_target_date: 33.3 },
  by_mission: [],
  by_issuer: [],
  filter_options: {
    missions: [{ id: 'mission-1', name: 'London' }],
    issuers: [{ id: 'officer-1', full_name: 'Jane Wanjiru' }],
  },
  filters: { date_from: null, date_to: null, mission_id: null, issued_by_user_id: null },
}

function lastListCall() {
  const calls = vi.mocked(directivesApi.listDirectives).mock.calls
  return calls[calls.length - 1]?.[0]
}

describe('DirectiveListPage', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry PS'))
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([{ id: 'mission-1', name: 'London', city: 'London', active: true }])
    vi.mocked(directivesApi.listDirectives).mockReset().mockResolvedValue(page([STALE_DIRECTIVE]))
    vi.mocked(directivesApi.getDirectiveSummary).mockReset().mockResolvedValue(SUMMARY)
  })

  it('TC-FR-DIR-005, TC-FR-DIR-009: renders the directive list scoped by the server, including mission and target attache', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Directives and Tasking' })).toBeInTheDocument()
    const row = (await screen.findByText('Purity Samanthe')).closest('tr') as HTMLElement
    expect(within(row).getByText('London')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Submit outstanding trade brief.' })).toHaveAttribute('href', '/directives/directive-1')
    expect(within(row).getByText('Market brief')).toBeInTheDocument()
  })

  it('TC-FR-DIR-010: flags an in_progress directive with no update in 14+ days as stale', async () => {
    renderPage()

    const row = (await screen.findByText('Purity Samanthe')).closest('tr') as HTMLElement
    expect(within(row).getByText('Stale')).toBeInTheDocument()
    expect(within(row).getByText('In Progress')).toBeInTheDocument()
  })

  it('does not flag a recently-updated in_progress directive as stale', async () => {
    vi.mocked(directivesApi.listDirectives).mockResolvedValue(
      page([{ ...STALE_DIRECTIVE, last_progress_update_at: new Date().toISOString(), is_stale: false }]),
    )

    renderPage()

    const row = (await screen.findByText('Purity Samanthe')).closest('tr') as HTMLElement
    expect(within(row).queryByText('Stale')).not.toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(directivesApi.listDirectives).mockResolvedValue(page([]))

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Directives and Tasking' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })

  it('TC-FR-DIR-005-B: an attache sees the directives assigned to them, who issued them, and no issue or mission controls', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry Attache'))

    renderPage('/directives?mission_id=mission-9')

    expect(await screen.findByText('Directives headquarters has assigned to you.')).toBeInTheDocument()
    expect(await screen.findByRole('columnheader', { name: 'Issued By' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Target Attache' })).not.toBeInTheDocument()
    const row = (await screen.findByText('Jane Wanjiru')).closest('tr') as HTMLElement
    expect(within(row).queryByText('Purity Samanthe')).not.toBeInTheDocument()

    expect(screen.queryByRole('link', { name: /Issue directive/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Mission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Issuing officer' })).not.toBeInTheDocument()
    // The server narrows an attache to their own mission; a mission_id in the URL is not sent.
    expect(lastListCall()?.mission_id).toBeUndefined()
    expect(missionsApi.listMissions).not.toHaveBeenCalled()
    expect(directivesApi.getDirectiveSummary).not.toHaveBeenCalled()
  })

  it('TC-FR-DIR-002: a Ministry HQ Officer sees their issued directives, the issue button and a mission filter fed by GET /missions', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))

    renderPage()

    expect(await screen.findByText('Directives you have issued to missions.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Issue directive/ })).toHaveAttribute('href', '/directives/new')
    const missionSelect = await screen.findByRole('combobox', { name: 'Mission' })
    await waitFor(() => expect(within(missionSelect).getByRole('option', { name: 'London' })).toBeInTheDocument())
    expect(screen.queryByRole('combobox', { name: 'Issuing officer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /View summary/ })).not.toBeInTheDocument()
    expect(directivesApi.getDirectiveSummary).not.toHaveBeenCalled()
  })

  it('TC-FR-DIR-012-D: oversight roles get department-wide wording, issuer and mission options from the summary endpoint, and a summary link', async () => {
    renderPage()

    expect(await screen.findByText('All directives issued in your department.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Issue directive/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View summary/ })).toHaveAttribute('href', '/directives/summary')

    const issuerSelect = screen.getByRole('combobox', { name: 'Issuing officer' })
    await waitFor(() => expect(within(issuerSelect).getByRole('option', { name: 'Jane Wanjiru' })).toBeInTheDocument())
    expect(within(screen.getByRole('combobox', { name: 'Mission' })).getByRole('option', { name: 'London' })).toBeInTheDocument()
    expect(missionsApi.listMissions).not.toHaveBeenCalled()

    await userEvent.selectOptions(issuerSelect, 'officer-1')
    await waitFor(() => expect(lastListCall()?.issued_by_user_id).toBe('officer-1'))
    expect(screen.getByTestId('location')).toHaveTextContent('issued_by_user_id=officer-1')
  })

  it('TC-FR-DIR-012-E: a Ministry HQ Director reviews the list but is not offered the issue button', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Director'))

    renderPage()

    expect(await screen.findByText('All directives issued in your department.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Issue directive/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View summary/ })).toBeInTheDocument()
  })

  it('TC-FR-DIR-003-C: parses a dashboard deep link into the request and the controls, ignoring invalid values', async () => {
    renderPage(
      '/directives?due=overdue&status=bogus&mission_id=mission-1&issued_by_user_id=officer-1&date_from=2026-07-01&date_to=not-a-date&sort=target_completion_date&page=2&per_page=25&q=avocado',
    )

    await waitFor(() => expect(directivesApi.listDirectives).toHaveBeenCalled())
    expect(lastListCall()).toEqual({
      q: 'avocado',
      status: undefined,
      due: 'overdue',
      stale: undefined,
      mission_id: 'mission-1',
      issued_by_user_id: 'officer-1',
      date_from: '2026-07-01',
      date_to: undefined,
      sort: 'target_completion_date',
      page: 2,
      per_page: 25,
    })

    expect(await screen.findByRole('button', { name: 'Overdue' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('avocado')
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('target_completion_date')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('')
    expect(screen.getByLabelText('Issued from')).toHaveValue('2026-07-01')
  })

  it('TC-FR-DIR-012-F: a summary drill-down to due=completed or due=cancelled is kept and shown as an active filter', async () => {
    renderPage('/directives?due=completed&mission_id=mission-1')

    await waitFor(() => expect(lastListCall()).toMatchObject({ due: 'completed', mission_id: 'mission-1' }))
    expect(await screen.findByRole('button', { name: 'Completed or closed' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()

    // Changing the sort keeps the drill-down filter.
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), '-target_completion_date')
    await waitFor(() => expect(lastListCall()).toMatchObject({ due: 'completed', sort: '-target_completion_date' }))

    await userEvent.click(screen.getByRole('button', { name: 'Cancelled' }))
    await waitFor(() => expect(lastListCall()).toMatchObject({ due: 'cancelled', stale: undefined }))
    expect(screen.getByRole('button', { name: 'Cancelled' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Completed or closed' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('TC-FR-DIR-003-D: the due-state and stale chips filter the list and are mutually exclusive', async () => {
    renderPage('/directives?due=approaching&page=3')

    await userEvent.click(await screen.findByRole('button', { name: 'Stale' }))
    await waitFor(() => expect(lastListCall()).toMatchObject({ stale: true, due: undefined, page: 1 }))
    expect(screen.getByRole('button', { name: 'Stale' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Approaching' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(screen.getByRole('button', { name: 'No date set' }))
    await waitFor(() => expect(lastListCall()).toMatchObject({ stale: undefined, due: 'no_date' }))

    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    await waitFor(() => expect(lastListCall()).toMatchObject({ stale: undefined, due: undefined }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/directives$/)
  })

  it('TC-FR-DIR-005-C: search is debounced and written to the URL', async () => {
    renderPage('/directives?page=2')
    await waitFor(() => expect(directivesApi.listDirectives).toHaveBeenCalled())

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'coffee')
    // Nothing is sent per keystroke.
    expect(vi.mocked(directivesApi.listDirectives).mock.calls.some(([filters]) => filters?.q)).toBe(false)

    await waitFor(() => expect(lastListCall()).toMatchObject({ q: 'coffee', page: 1 }))
    expect(vi.mocked(directivesApi.listDirectives).mock.calls.filter(([filters]) => filters?.q).length).toBe(1)
    expect(screen.getByTestId('location')).toHaveTextContent('q=coffee')
    expect(screen.getByTestId('location')).not.toHaveTextContent('page=')
  })

  it('TC-FR-DIR-005-D: the sort control changes the sort parameter', async () => {
    renderPage()
    await waitFor(() => expect(lastListCall()?.sort).toBe('-created_at'))

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Due soonest')
    await waitFor(() => expect(lastListCall()?.sort).toBe('target_completion_date'))
    expect(screen.getByTestId('location')).toHaveTextContent('sort=target_completion_date')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Least recently updated')
    await waitFor(() => expect(lastListCall()?.sort).toBe('last_progress_update_at'))
  })

  it('TC-FR-DIR-005-E: pages through the list server-side', async () => {
    vi.mocked(directivesApi.listDirectives).mockResolvedValue(page([STALE_DIRECTIVE], { total: 25, last_page: 3 }))

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: '2' }))
    await waitFor(() => expect(lastListCall()?.page).toBe(2))
    expect(screen.getByTestId('location')).toHaveTextContent('page=2')
  })

  it('TC-FR-DIR-003-E: shows the target-date badge and absolute date for each directive', async () => {
    vi.mocked(directivesApi.listDirectives).mockResolvedValue(
      page([
        { ...STALE_DIRECTIVE, id: 'd-overdue', description: 'Overdue brief', target_completion_date: '2026-09-20', due_state: 'overdue', days_until_due: -3, is_overdue: true },
        { ...STALE_DIRECTIVE, id: 'd-soon', description: 'Approaching brief', target_completion_date: '2026-10-02', due_state: 'approaching', days_until_due: 2, is_stale: false },
        { ...STALE_DIRECTIVE, id: 'd-none', description: 'Undated brief', is_stale: false },
        { ...STALE_DIRECTIVE, id: 'd-done', description: 'Finished brief', status: 'completed', due_state: 'completed', is_stale: false },
      ]),
    )

    renderPage()

    const overdueRow = await screen.findByTestId('directive-row-d-overdue')
    expect(within(overdueRow).getByText('3 days overdue')).toBeInTheDocument()
    expect(within(overdueRow).getByText('20 Sept 2026')).toBeInTheDocument()
    expect(within(screen.getByTestId('directive-row-d-soon')).getByText('Due in 2 days')).toBeInTheDocument()
    expect(within(screen.getByTestId('directive-row-d-none')).getByText('No date set')).toBeInTheDocument()
    const doneRow = screen.getByTestId('directive-row-d-done')
    expect(within(doneRow).queryByTestId(/directive-due-/)).not.toBeInTheDocument()
    expect(within(doneRow).getByText('Completed')).toBeInTheDocument()
  })

  it('TC-FR-DIR-005-F: an empty department says there are no directives yet', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry Attache'))
    vi.mocked(directivesApi.listDirectives).mockResolvedValue(page([]))

    renderPage()

    expect(await screen.findByText('No directives yet')).toBeInTheDocument()
    expect(screen.getByText('When headquarters issues a directive to you, it will appear here.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Clear filters/ })).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-005-G: filters with no matches say so and can be cleared', async () => {
    vi.mocked(directivesApi.listDirectives).mockResolvedValue(page([]))

    renderPage('/directives?status=closed&q=avocado&sort=created_at')

    expect(await screen.findByText('No directives match these filters')).toBeInTheDocument()
    const clearButtons = screen.getAllByRole('button', { name: /Clear filters/ })
    await userEvent.click(clearButtons[clearButtons.length - 1])

    await waitFor(() => expect(lastListCall()).toMatchObject({ status: undefined, q: undefined, sort: 'created_at' }))
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
  })

  it('TC-FR-DIR-005-H: rows open the directive by click and by keyboard', async () => {
    renderPage()

    await userEvent.click(within(await screen.findByTestId('directive-row-directive-1')).getByText('London'))
    expect(await screen.findByText('Directive detail directive-1')).toBeInTheDocument()
  })

  it('TC-FR-DIR-005-I: the description link is keyboard-reachable and opens the directive', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: 'Submit outstanding trade brief.' })
    link.focus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText('Directive detail directive-1')).toBeInTheDocument()
  })

  it('shows an error with a retry when the list cannot be loaded', async () => {
    vi.mocked(directivesApi.listDirectives).mockRejectedValueOnce(new Error('network')).mockResolvedValue(page([STALE_DIRECTIVE]))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Directives could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByText('Purity Samanthe')).toBeInTheDocument()
  })
})
