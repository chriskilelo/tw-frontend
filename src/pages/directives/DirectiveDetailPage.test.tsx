import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveDetailPage from './DirectiveDetailPage'
import * as directivesApi from '../../api/directives'
import * as useAuthModule from '../../hooks/useAuth'
import type { DirectiveDetail } from '../../api/directives'
import { BreadcrumbContext, type BreadcrumbContextValue } from '../../hooks/useBreadcrumbs'
import { I18nProvider } from '../../i18n/context'
import { addDays, localDateString } from './directivePresentation'

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return {
    ...actual,
    getDirective: vi.fn(),
    transitionDirectiveStatus: vi.fn(),
    addDirectiveNote: vi.fn(),
    reviseDirective: vi.fn(),
  }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const ATTACHE = { id: 'attache-1', full_name: 'Purity Samanthe' }
const ISSUER = { id: 'hq-officer-1', full_name: 'Test HQ Officer' }

const DIRECTIVE: DirectiveDetail = {
  id: 'directive-1',
  type_category: 'Trade Show Follow-Up',
  description: 'Submit the outstanding exhibitor report from the Q1 trade show.',
  status: 'in_progress',
  target_completion_date: '2026-09-01',
  completion_summary: null,
  last_progress_update_at: '2026-08-10T00:00:00Z',
  mission: { id: 'mission-1', name: 'London' },
  target_user: ATTACHE,
  issued_by: ISSUER,
  notes: [],
  status_history: [
    { status: 'issued', at: '2026-08-01T00:00:00Z', by: ISSUER },
    { status: 'in_progress', at: '2026-08-03T00:00:00Z', by: ATTACHE },
  ],
  allowed_actions: { transitions: ['completed'], add_note: true, revise: false },
  is_overdue: false,
  is_stale: false,
  due_state: 'on_track',
  days_until_due: 12,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-10T00:00:00Z',
}

function directive(overrides: Partial<DirectiveDetail> = {}): DirectiveDetail {
  return { ...DIRECTIVE, ...overrides }
}

function meFor(userRef: { id: string; full_name: string }, roleName: string) {
  return {
    user: {
      id: userRef.id,
      full_name: userRef.full_name,
      email: 'someone@sdt.go.ke',
      role_id: `role-${roleName}`,
      mission_id: roleName === 'Ministry Attache' ? 'mission-1' : null,
      ministry_id: 'ministry-1',
      status: 'active' as const,
      language_preference: 'en' as const,
      email_notification_preferences: null,
    },
    role: { id: `role-${roleName}`, name: roleName, layer: '2' as const, scope: 'ministry' as const },
    permissions: [],
    isLoading: false,
    isAuthenticated: true,
    refetch: vi.fn(),
  }
}

function renderPage(breadcrumbs?: BreadcrumbContextValue) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BreadcrumbContext.Provider value={breadcrumbs ?? null}>
          <MemoryRouter initialEntries={['/directives/directive-1']}>
            <Routes>
              <Route path="/directives/:id" element={<DirectiveDetailPage />} />
            </Routes>
          </MemoryRouter>
        </BreadcrumbContext.Provider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const user = userEvent.setup()

async function waitForDirective(description = DIRECTIVE.description) {
  await screen.findByRole('heading', { name: description })
}

function axiosError(status: number) {
  return { isAxiosError: true, response: { status, data: { data: null, errors: ['Denied.'] } } }
}

describe('DirectiveDetailPage', () => {
  beforeEach(() => {
    vi.mocked(directivesApi.getDirective).mockReset().mockResolvedValue(DIRECTIVE)
    vi.mocked(directivesApi.transitionDirectiveStatus).mockReset()
    vi.mocked(directivesApi.addDirectiveNote).mockReset()
    vi.mocked(directivesApi.reviseDirective).mockReset()
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor(ATTACHE, 'Ministry Attache'))
  })

  it('TC-FR-DIR-007: the Complete action requires a completion summary before it can be submitted', async () => {
    const completed = directive({
      status: 'completed',
      due_state: 'completed',
      completion_summary: 'Report submitted and filed.',
      allowed_actions: { transitions: [], add_note: true, revise: false },
    })
    vi.mocked(directivesApi.transitionDirectiveStatus).mockResolvedValue(completed)
    vi.mocked(directivesApi.getDirective).mockResolvedValueOnce(DIRECTIVE).mockResolvedValue(completed)

    renderPage()
    await waitForDirective()

    await user.click(screen.getByRole('button', { name: 'Mark completed' }))

    const dialog = await screen.findByRole('dialog')
    const submitButton = within(dialog).getByRole('button', { name: 'Complete directive' })
    expect(submitButton).toBeDisabled()

    await user.click(submitButton)
    expect(directivesApi.transitionDirectiveStatus).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText(/^Completion summary/), '   ')
    expect(submitButton).toBeDisabled()

    await user.type(within(dialog).getByLabelText(/^Completion summary/), 'Report submitted and filed.')
    expect(submitButton).toBeEnabled()

    await user.click(submitButton)
    expect(directivesApi.transitionDirectiveStatus).toHaveBeenCalledWith('directive-1', {
      status: 'completed',
      note: 'Report submitted and filed.',
    })
    expect(await screen.findByTestId('directive-completion')).toHaveTextContent('Report submitted and filed.')
  })

  it('TC-FR-DIR-006: shows only the actions allowed_actions grants the target attache for the directive status', async () => {
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({
        status: 'issued',
        status_history: [{ status: 'issued', at: '2026-08-01T00:00:00Z', by: ISSUER }],
        allowed_actions: { transitions: ['acknowledged', 'in_progress'], add_note: true, revise: false },
      }),
    )

    renderPage()
    await waitForDirective()

    const actionBar = screen.getByTestId('directive-next-step')
    expect(within(actionBar).getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument()
    // FR-DIR-006 AC1: Issued can move straight to In Progress.
    expect(within(actionBar).getByRole('button', { name: 'Start work' })).toBeInTheDocument()
    // Withdrawing is the issuer's action, never the attache's.
    expect(within(actionBar).queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
    expect(within(actionBar).queryByRole('button', { name: 'Mark completed' })).not.toBeInTheDocument()
    expect(within(actionBar).queryByRole('button', { name: 'Accept and close' })).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-006-B: acknowledging needs no note and sends the transition straight away', async () => {
    const issued = directive({
      status: 'issued',
      allowed_actions: { transitions: ['acknowledged', 'in_progress'], add_note: true, revise: false },
    })
    vi.mocked(directivesApi.getDirective).mockResolvedValue(issued)
    vi.mocked(directivesApi.transitionDirectiveStatus).mockResolvedValue({ ...issued, status: 'acknowledged' })

    renderPage()
    await waitForDirective()
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))

    expect(directivesApi.transitionDirectiveStatus).toHaveBeenCalledWith('directive-1', { status: 'acknowledged' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-006-C: shows a transition error returned by the API', async () => {
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({ status: 'issued', allowed_actions: { transitions: ['acknowledged'], add_note: true, revise: false } }),
    )
    vi.mocked(directivesApi.transitionDirectiveStatus).mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { data: null, errors: ['Cannot transition directive from cancelled to acknowledged.'] } },
    })

    renderPage()
    await waitForDirective()
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot transition directive from cancelled to acknowledged.')
  })

  it('TC-FR-DIR-013-A: the issuer withdraws a directive only with a reason', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor(ISSUER, 'Ministry HQ Officer'))
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({ allowed_actions: { transitions: ['cancelled'], add_note: true, revise: true } }),
    )
    vi.mocked(directivesApi.transitionDirectiveStatus).mockResolvedValue(
      directive({ status: 'cancelled', due_state: 'cancelled', allowed_actions: { transitions: [], add_note: true, revise: false } }),
    )

    renderPage()
    await waitForDirective()

    expect(screen.queryByRole('button', { name: 'Mark completed' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Withdraw' }))

    const dialog = await screen.findByRole('dialog')
    const submit = within(dialog).getByRole('button', { name: 'Withdraw directive' })
    expect(submit).toBeDisabled()

    await user.type(within(dialog).getByLabelText(/^Reason for withdrawal/), 'Superseded by a ministry-wide directive.')
    await user.click(submit)

    expect(directivesApi.transitionDirectiveStatus).toHaveBeenCalledWith('directive-1', {
      status: 'cancelled',
      note: 'Superseded by a ministry-wide directive.',
    })
  })

  it('TC-FR-DIR-007-B: the issuer accepts and closes a completed directive with an optional note', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor(ISSUER, 'Ministry HQ Officer'))
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({
        status: 'completed',
        due_state: 'completed',
        completion_summary: 'Exhibitor report filed with the Director of External Trade.',
        status_history: [
          { status: 'issued', at: '2026-08-01T00:00:00Z', by: ISSUER },
          { status: 'in_progress', at: '2026-08-03T00:00:00Z', by: ATTACHE },
          { status: 'completed', at: '2026-08-09T00:00:00Z', by: ATTACHE },
        ],
        allowed_actions: { transitions: ['closed'], add_note: true, revise: false },
      }),
    )
    vi.mocked(directivesApi.transitionDirectiveStatus).mockResolvedValue(directive({ status: 'closed', due_state: 'completed' }))

    renderPage()
    await waitForDirective()

    const completion = screen.getByTestId('directive-completion')
    expect(completion).toHaveTextContent('Exhibitor report filed with the Director of External Trade.')
    expect(completion).toHaveTextContent('Awaiting review by the issuing officer')

    await user.click(within(screen.getByTestId('directive-next-step')).getByRole('button', { name: /Accept and close/ }))
    const dialog = await screen.findByRole('dialog')
    const submit = within(dialog).getByRole('button', { name: 'Accept and close' })
    expect(submit).toBeEnabled()

    await user.click(submit)
    expect(directivesApi.transitionDirectiveStatus).toHaveBeenCalledWith('directive-1', { status: 'closed' })
  })

  it('TC-FR-DIR-003-D: the issuer revises the target date, or clears it to "No date set"', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor(ISSUER, 'Ministry HQ Officer'))
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({ allowed_actions: { transitions: ['cancelled'], add_note: true, revise: true } }),
    )
    vi.mocked(directivesApi.reviseDirective).mockResolvedValue(directive({ target_completion_date: null, due_state: 'no_date', days_until_due: null }))

    renderPage()
    await waitForDirective()

    await user.click(screen.getByRole('button', { name: 'Revise target completion date' }))
    let dialog = await screen.findByRole('dialog')
    const dateInput = within(dialog).getByLabelText('New target date')
    expect(dateInput).toHaveValue('2026-09-01')
    expect(dateInput).toHaveAttribute('min', localDateString())
    // Unchanged date: nothing to save.
    expect(within(dialog).getByRole('button', { name: 'Save target date' })).toBeDisabled()

    const newDate = addDays(localDateString(), 10)
    await user.clear(dateInput)
    await user.type(dateInput, newDate)
    await user.click(within(dialog).getByRole('button', { name: 'Save target date' }))
    expect(directivesApi.reviseDirective).toHaveBeenCalledWith('directive-1', { target_completion_date: newDate })

    await user.click(screen.getByRole('button', { name: 'Revise target completion date' }))
    dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('checkbox', { name: /^No date set/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Save target date' }))
    expect(directivesApi.reviseDirective).toHaveBeenLastCalledWith('directive-1', { target_completion_date: null })
  })

  it('TC-FR-DIR-013-B: hides Revise when allowed_actions.revise is false', async () => {
    renderPage()
    await waitForDirective()

    expect(screen.queryByRole('button', { name: 'Revise target completion date' })).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-008: adds a progress note and renders it in the notes thread', async () => {
    vi.mocked(directivesApi.addDirectiveNote).mockResolvedValue({
      id: 'note-1',
      content: 'Asset register 60% complete.',
      kind: 'progress',
      authored_by: ATTACHE,
      created_at: '2026-08-11T00:00:00Z',
    })
    vi.mocked(directivesApi.getDirective).mockResolvedValueOnce(DIRECTIVE).mockResolvedValueOnce({
      ...DIRECTIVE,
      notes: [
        {
          id: 'note-1',
          content: 'Asset register 60% complete.',
          kind: 'progress',
          authored_by: ATTACHE,
          created_at: '2026-08-11T00:00:00Z',
        },
      ],
    })

    renderPage()
    await waitForDirective()
    await user.click(screen.getByRole('button', { name: /^Notes/ }))
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()

    expect(screen.getByText(/Posting an update also resets the stale clock/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Add progress note'), 'Asset register 60% complete.')
    await user.click(screen.getByRole('button', { name: 'Post note' }))

    expect(directivesApi.addDirectiveNote).toHaveBeenCalledWith('directive-1', { content: 'Asset register 60% complete.' })
    expect(await screen.findByText('Asset register 60% complete.')).toBeInTheDocument()
    expect(screen.getByLabelText('Add progress note')).toHaveValue('')
  })

  it('TC-FR-DIR-011: the issuer composes follow-up notes, and the composer is hidden when add_note is false', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor(ISSUER, 'Ministry HQ Officer'))
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({ allowed_actions: { transitions: ['cancelled'], add_note: true, revise: true } }),
    )

    const { unmount } = renderPage()
    await waitForDirective()

    expect(screen.getByLabelText('Add follow-up note')).toBeInTheDocument()
    expect(screen.getByText('The target attache is notified.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Post note' })).toBeDisabled()
    unmount()

    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({ allowed_actions: { transitions: [], add_note: false, revise: false } }),
    )
    renderPage()
    await waitForDirective()
    expect(screen.queryByTestId('directive-note-composer')).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-009: leadership sees a read-only view with no workflow controls', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor({ id: 'ps-1', full_name: 'Principal Secretary' }, 'Ministry PS'))
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({ allowed_actions: { transitions: [], add_note: false, revise: false } }),
    )

    renderPage()
    await waitForDirective()

    expect(screen.getByText('View only')).toBeInTheDocument()
    expect(screen.getByTestId('directive-read-only')).toHaveTextContent(
      'You can follow this directive, but only its target attache and the officer who issued it can act on it.',
    )
    expect(screen.queryByTestId('directive-next-step')).not.toBeInTheDocument()
    expect(screen.queryByTestId('directive-note-composer')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revise target completion date' })).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-005-A: shows the status, due and stale badges from the server-computed flags', async () => {
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({ is_overdue: true, is_stale: true, due_state: 'overdue', days_until_due: -3 }),
    )

    renderPage()
    await waitForDirective()

    const badges = screen.getByTestId('directive-badges')
    expect(within(badges).getByText('In Progress')).toBeInTheDocument()
    expect(within(badges).getByText('3 days overdue')).toBeInTheDocument()
    expect(within(badges).getByText('Stale')).toBeInTheDocument()
    expect(within(badges).getByText('Trade Show Follow-Up')).toBeInTheDocument()
    expect(screen.getByText(/No progress update in the last 14 days/)).toBeInTheDocument()
  })

  it('TC-FR-DIR-005-B: names the directive in the breadcrumb trail', async () => {
    const setLabel = vi.fn()

    renderPage({ labels: {}, previous: null, setLabel })
    await waitForDirective()

    // Long descriptions are cut at a word boundary so the trail stays on one line.
    expect(setLabel).toHaveBeenCalledWith('/directives/directive-1', {
      text: 'Submit the outstanding exhibitor report from…',
      isCode: false,
    })
  })

  it('TC-FR-DIR-006-D: renders a dated workflow stepper and a merged, filterable activity timeline', async () => {
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({
        status_history: [
          { status: 'issued', at: '2026-08-01T00:00:00Z', by: ISSUER },
          { status: 'acknowledged', at: '2026-08-02T00:00:00Z', by: ATTACHE },
          { status: 'in_progress', at: '2026-08-03T00:00:00Z', by: ATTACHE },
        ],
        notes: [
          { id: 'note-1', content: 'Drafting the report.', kind: 'progress', authored_by: ATTACHE, created_at: '2026-08-04T00:00:00Z' },
          { id: 'note-2', content: 'Please include buyer contacts.', kind: 'follow_up', authored_by: ISSUER, created_at: '2026-08-05T00:00:00Z' },
        ],
      }),
    )

    renderPage()
    await waitForDirective()

    const stepper = screen.getByRole('list', { name: 'Directive progress' })
    const steps = within(stepper).getAllByRole('listitem')
    expect(steps).toHaveLength(5)
    expect(steps[2]).toHaveAttribute('aria-current', 'step')
    expect(steps[2]).toHaveTextContent('Work under way')
    expect(steps[4]).toHaveTextContent('Not yet')

    const activity = screen.getByTestId('directive-activity')
    expect(within(activity).getAllByRole('listitem')).toHaveLength(5)
    expect(within(activity).getByText('Progress update')).toBeInTheDocument()
    expect(within(activity).getByText('Follow-up')).toBeInTheDocument()
    // Newest first: the issuer's follow-up is on top.
    expect(within(activity).getAllByRole('listitem')[0]).toHaveTextContent('Please include buyer contacts.')

    await user.click(screen.getByRole('button', { name: /^Status changes/ }))
    const statusOnly = within(screen.getByTestId('directive-activity')).getAllByRole('listitem')
    expect(statusOnly).toHaveLength(3)
    statusOnly.forEach((item) => expect(item).toHaveAttribute('data-kind', 'status'))
    expect(screen.getByRole('button', { name: /^Status changes/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /^Notes/ }))
    expect(within(screen.getByTestId('directive-activity')).getAllByRole('listitem')).toHaveLength(2)
  })

  it('TC-FR-DIR-006-E: shows a withdrawn directive as a terminal branch with its withdrawal details', async () => {
    vi.mocked(directivesApi.getDirective).mockResolvedValue(
      directive({
        status: 'cancelled',
        due_state: 'cancelled',
        days_until_due: null,
        status_history: [
          { status: 'issued', at: '2026-08-01T00:00:00Z', by: ISSUER },
          { status: 'cancelled', at: '2026-08-05T00:00:00Z', by: ISSUER },
        ],
        allowed_actions: { transitions: [], add_note: false, revise: false },
      }),
    )

    renderPage()
    await waitForDirective()

    expect(screen.getByText(/^Withdrawn on .* by Test HQ Officer\. No further work is expected\.$/)).toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: 'Directive progress' })).getAllByRole('listitem')
    expect(steps[1]).toHaveTextContent('Not reached')
    expect(steps.some((step) => step.getAttribute('aria-current') === 'step')).toBe(false)
    expect(screen.getByTestId('directive-read-only')).toHaveTextContent('This directive is finished and kept for the record')
    expect(screen.queryByTestId('directive-next-step')).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-009-B: shows an access notice when the API returns 403', async () => {
    vi.mocked(directivesApi.getDirective).mockRejectedValue(axiosError(403))

    renderPage()

    expect(await screen.findByRole('heading', { name: 'You don’t have access to this directive' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /All directives/ })).toHaveAttribute('href', '/directives')
    expect(directivesApi.getDirective).toHaveBeenCalledTimes(1)
  })

  it('TC-FR-DIR-009-C: shows a not-found notice when the API returns 404', async () => {
    vi.mocked(directivesApi.getDirective).mockRejectedValue(axiosError(404))

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Directive not found' })).toBeInTheDocument()
    expect(screen.getByTestId('directive-unavailable')).toBeInTheDocument()
  })

  it('TC-FR-DIR-009-D: shows a loading state while the directive is fetched', async () => {
    vi.mocked(directivesApi.getDirective).mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(await screen.findByTestId('directive-loading')).toHaveTextContent('Loading directive…')
  })
})
