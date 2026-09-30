import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveSummaryPage from './DirectiveSummaryPage'
import * as directivesApi from '../../api/directives'
import * as useAuthModule from '../../hooks/useAuth'
import type { DirectiveSummary } from '../../api/directives'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return { ...actual, getDirectiveSummary: vi.fn() }
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
      mission_id: null,
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: roleName, layer: '3', scope: 'ministry' },
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

function renderPage(initialEntry = '/directives/summary') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/directives/summary" element={<DirectiveSummaryPage />} />
            <Route path="/directives" element={<p>Directive list</p>} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function summaryFixture(overrides: Partial<DirectiveSummary> = {}): DirectiveSummary {
  return {
    total: 20,
    completed: 8,
    closed: 3,
    in_progress: 5,
    issued: 2,
    acknowledged: 1,
    cancelled: 4,
    overdue: 3,
    approaching: 1,
    no_target_date: 2,
    on_track: 2,
    stale: 2,
    percentages: { completed: 40, in_progress: 25, overdue: 15, no_target_date: 10 },
    by_mission: [
      { mission_id: 'mission-london', mission_name: 'London', total: 12, completed: 6, in_progress: 3, overdue: 2, completion_rate: 50 },
      { mission_id: 'mission-dubai', mission_name: 'Dubai', total: 8, completed: 2, in_progress: 2, overdue: 1, completion_rate: 25 },
    ],
    by_issuer: [
      { user_id: 'officer-1', full_name: 'Jane Wanjiru', total: 14, completed: 6, overdue: 3 },
      { user_id: 'officer-2', full_name: 'Paul Otieno', total: 6, completed: 2, overdue: 0 },
    ],
    filter_options: {
      missions: [
        { id: 'mission-dubai', name: 'Dubai' },
        { id: 'mission-london', name: 'London' },
      ],
      issuers: [
        { id: 'officer-1', full_name: 'Jane Wanjiru' },
        { id: 'officer-2', full_name: 'Paul Otieno' },
      ],
    },
    filters: { date_from: null, date_to: null, mission_id: null, issued_by_user_id: null },
    ...overrides,
  }
}

function hrefOf(name: string | RegExp): string | null {
  return screen.getByRole('link', { name }).getAttribute('href')
}

describe('DirectiveSummaryPage', () => {
  beforeEach(() => {
    vi.mocked(directivesApi.getDirectiveSummary).mockReset().mockResolvedValue(summaryFixture())
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Director'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-FR-DIR-012-A: renders the six summary tiles, each drilling down to the directive list', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Directive Summary' })).toBeInTheDocument()
    const totalTile = await screen.findByRole('link', { name: /Total issued/ })
    expect(totalTile).toHaveTextContent('20')
    expect(totalTile).toHaveTextContent('8 still open')
    expect(totalTile).toHaveAttribute('href', '/directives')

    expect(screen.getByRole('link', { name: /% Completed/ })).toHaveTextContent('40%')
    expect(screen.getByRole('link', { name: /% Completed/ })).toHaveTextContent('8 of 20 · 3 closed')
    expect(hrefOf(/% Completed/)).toBe('/directives?due=completed')
    expect(screen.getByRole('link', { name: /% In progress/ })).toHaveTextContent('25%')
    expect(hrefOf(/% In progress/)).toBe('/directives?status=in_progress')
    expect(screen.getByRole('link', { name: /% Overdue/ })).toHaveTextContent('15%')
    expect(hrefOf(/% Overdue/)).toBe('/directives?due=overdue')
    expect(screen.getByRole('link', { name: /% No date set/ })).toHaveTextContent('10%')
    expect(hrefOf(/% No date set/)).toBe('/directives?due=no_date')
    expect(screen.getByRole('link', { name: /^Stale/ })).toHaveTextContent('2')
    expect(hrefOf(/^Stale/)).toBe('/directives?stale=1')

    expect(directivesApi.getDirectiveSummary).toHaveBeenCalledWith({})
  })

  it('TC-FR-DIR-012-B: URL filters are passed to the API and carried into every drill-down link', async () => {
    renderPage('/directives/summary?period=custom&date_from=2026-07-01&date_to=2026-08-31&mission_id=mission-london&issued_by_user_id=officer-1')

    await screen.findByRole('link', { name: /Total issued/ })
    expect(directivesApi.getDirectiveSummary).toHaveBeenCalledWith({
      date_from: '2026-07-01',
      date_to: '2026-08-31',
      mission_id: 'mission-london',
      issued_by_user_id: 'officer-1',
    })

    expect(screen.getByLabelText('Mission')).toHaveValue('mission-london')
    expect(screen.getByLabelText('Issuing officer')).toHaveValue('officer-1')
    expect(screen.getByLabelText('From')).toHaveValue('2026-07-01')
    expect(screen.getByLabelText('To')).toHaveValue('2026-08-31')

    const overdueHref = new URL(hrefOf(/% Overdue/) ?? '', 'http://localhost')
    expect(overdueHref.pathname).toBe('/directives')
    expect(Object.fromEntries(overdueHref.searchParams)).toEqual({
      mission_id: 'mission-london',
      issued_by_user_id: 'officer-1',
      date_from: '2026-07-01',
      date_to: '2026-08-31',
      due: 'overdue',
    })
  })

  it('TC-FR-DIR-012-C: period presets resolve to fiscal-calendar issue dates', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0))

    renderPage('/directives/summary?period=this_fy')
    await screen.findByRole('link', { name: /Total issued/ })
    expect(directivesApi.getDirectiveSummary).toHaveBeenLastCalledWith({ date_from: '2026-07-01', date_to: '2027-06-30' })
    expect(screen.getByRole('radio', { name: 'This financial year' })).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(screen.getByRole('radio', { name: 'Last quarter' }))
    await waitFor(() =>
      expect(directivesApi.getDirectiveSummary).toHaveBeenLastCalledWith({ date_from: '2026-04-01', date_to: '2026-06-30' }),
    )
    expect(screen.getByTestId('location')).toHaveTextContent('/directives/summary?period=last_quarter')

    await userEvent.click(screen.getByRole('radio', { name: 'This quarter' }))
    await waitFor(() =>
      expect(directivesApi.getDirectiveSummary).toHaveBeenLastCalledWith({ date_from: '2026-07-01', date_to: '2026-09-30' }),
    )

    await userEvent.click(screen.getByRole('radio', { name: 'All time' }))
    await waitFor(() => expect(directivesApi.getDirectiveSummary).toHaveBeenLastCalledWith({}))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/directives\/summary$/)
  })

  it('TC-FR-DIR-012-D: choosing a mission or issuing officer refetches with that filter', async () => {
    renderPage()
    await screen.findByRole('link', { name: /Total issued/ })

    await userEvent.selectOptions(screen.getByLabelText('Mission'), 'mission-dubai')
    await waitFor(() => expect(directivesApi.getDirectiveSummary).toHaveBeenLastCalledWith({ mission_id: 'mission-dubai' }))

    await userEvent.selectOptions(screen.getByLabelText('Issuing officer'), 'officer-2')
    await waitFor(() =>
      expect(directivesApi.getDirectiveSummary).toHaveBeenLastCalledWith({ mission_id: 'mission-dubai', issued_by_user_id: 'officer-2' }),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(directivesApi.getDirectiveSummary).toHaveBeenLastCalledWith({}))
  })

  it('TC-FR-DIR-003: groups directives by target date with a link per group', async () => {
    renderPage()
    const card = (await screen.findByRole('heading', { name: 'Target-date status' })).closest('section') as HTMLElement

    expect(within(card).getByRole('link', { name: 'View 8 completed directives' })).toHaveAttribute('href', '/directives?due=completed')
    expect(within(card).getByRole('link', { name: 'View 2 on track directives' })).toHaveAttribute('href', '/directives?due=on_track')
    expect(within(card).getByRole('link', { name: 'View 1 approaching directives' })).toHaveAttribute('href', '/directives?due=approaching')
    expect(within(card).getByRole('link', { name: 'View 3 exceeded directives' })).toHaveAttribute('href', '/directives?due=overdue')
    expect(within(card).getByRole('link', { name: 'View 2 no date set directives' })).toHaveAttribute('href', '/directives?due=no_date')

    // The table view repeats the same numbers as text (WCAG 1.1.1).
    await userEvent.click(within(card).getByRole('button', { name: /table/i }))
    const table = within(card).getByRole('table', { name: 'Directives by target-date group' })
    expect(within(table).getByRole('rowheader', { name: 'Exceeded' }).closest('tr')).toHaveTextContent('3')
  })

  it('TC-FR-DIR-012-E: status distribution splits completed from closed and links each status', async () => {
    renderPage()
    const card = (await screen.findByRole('heading', { name: 'Status distribution' })).closest('section') as HTMLElement

    // summary.completed (8) counts completed + closed (3): the Completed step shows 5.
    expect(within(card).getByRole('link', { name: 'View 5 completed directives' })).toHaveAttribute('href', '/directives?status=completed')
    expect(within(card).getByRole('link', { name: 'View 3 closed directives' })).toHaveAttribute('href', '/directives?status=closed')
    expect(within(card).getByRole('link', { name: 'View 4 cancelled directives' })).toHaveAttribute('href', '/directives?status=cancelled')
    expect(within(card).getByRole('link', { name: 'View 2 issued directives' })).toHaveAttribute('href', '/directives?status=issued')
  })

  it('TC-FR-DIR-012-F: by-mission rows list lowest completion first and drill down to that mission', async () => {
    renderPage('/directives/summary?period=custom&date_from=2026-07-01')
    const table = await screen.findByRole('table', { name: 'Directives by mission' })

    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Dubai')
    expect(rows[1]).toHaveTextContent('London')

    expect(within(rows[0]).getByRole('link', { name: 'Dubai' })).toHaveAttribute(
      'href',
      '/directives?date_from=2026-07-01&mission_id=mission-dubai',
    )
    expect(within(rows[1]).getByRole('link', { name: '2' })).toHaveAttribute(
      'href',
      '/directives?date_from=2026-07-01&mission_id=mission-london&due=overdue',
    )
    expect(within(rows[0]).getByRole('meter', { name: 'Dubai completion rate' })).toHaveAttribute('aria-valuenow', '25')
  })

  it('TC-FR-DIR-012-G: by-issuer rows drill down to the officer’s directives', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: 'Directives by issuing officer' })

    expect(within(table).getByRole('link', { name: 'Jane Wanjiru' })).toHaveAttribute('href', '/directives?issued_by_user_id=officer-1')
    expect(within(table).getByRole('link', { name: '3' })).toHaveAttribute('href', '/directives?issued_by_user_id=officer-1&due=overdue')
    const paulRow = within(table).getByRole('rowheader', { name: 'Paul Otieno' }).closest('tr') as HTMLElement
    expect(within(paulRow).queryByRole('link', { name: '0' })).not.toBeInTheDocument()
  })

  it.each(['Ministry PS', 'Acting PS'])('TC-FR-DIR-012-H: %s may view the summary', async (roleName) => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs(roleName))
    renderPage()

    expect(await screen.findByRole('link', { name: /Total issued/ })).toBeInTheDocument()
    expect(directivesApi.getDirectiveSummary).toHaveBeenCalled()
  })

  it.each(['Ministry HQ Officer', 'Ministry Attache', 'Head of Mission', 'System Administrator'])(
    'TC-FR-DIR-012-I: %s sees a not-available notice and the API is never called',
    async (roleName) => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs(roleName))
      renderPage()

      expect(await screen.findByText('Summary not available')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open directive list' })).toHaveAttribute('href', '/directives')
      expect(directivesApi.getDirectiveSummary).not.toHaveBeenCalled()
    },
  )

  it('TC-FR-DIR-012-J: shows an empty state when no directives match', async () => {
    vi.mocked(directivesApi.getDirectiveSummary).mockResolvedValue(
      summaryFixture({
        total: 0,
        completed: 0,
        closed: 0,
        in_progress: 0,
        issued: 0,
        acknowledged: 0,
        cancelled: 0,
        overdue: 0,
        approaching: 0,
        no_target_date: 0,
        on_track: 0,
        stale: 0,
        percentages: { completed: 0, in_progress: 0, overdue: 0, no_target_date: 0 },
        by_mission: [],
        by_issuer: [],
      }),
    )
    renderPage()

    expect(await screen.findByText('No directives in this view')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Target-date status' })).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-012-K: offers a retry when the summary fails to load', async () => {
    vi.mocked(directivesApi.getDirectiveSummary).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(summaryFixture())
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('The directive summary could not be loaded.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: /Total issued/ })).toBeInTheDocument()
  })

  it('TC-UI-002: renders without fixed-width overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()
    expect(await screen.findByRole('link', { name: /Total issued/ })).toBeInTheDocument()

    // Proportional bar widths are percentages (a small min-width keeps thin segments visible);
    // nothing is sized to a fixed pixel width.
    const fixedWidths = Array.from(container.querySelectorAll<HTMLElement>('[style*="width"]')).filter((element) =>
      /(^|;)\s*width:\s*\d+(\.\d+)?px/.test(element.getAttribute('style') ?? ''),
    )
    expect(fixedWidths).toHaveLength(0)
  })
})
