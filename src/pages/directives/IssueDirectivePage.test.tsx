import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import IssueDirectivePage from './IssueDirectivePage'
import * as directivesApi from '../../api/directives'
import * as useAuthModule from '../../hooks/useAuth'
import type { Directive, DirectiveAssigneeMission } from '../../api/directives'
import { I18nProvider } from '../../i18n/context'
import { addDays, formatCalendarDate, localDateString } from './directivePresentation'

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return { ...actual, issueDirective: vi.fn(), getDirectiveTypeOptions: vi.fn(), listDirectiveAssignees: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const ASSIGNEES: DirectiveAssigneeMission[] = [
  { id: 'mission-berlin', name: 'Berlin', city: 'Berlin', host_country: 'Germany', attaches: [] },
  {
    id: 'mission-london',
    name: 'London',
    city: 'London',
    host_country: 'United Kingdom',
    attaches: [{ id: 'attache-london', full_name: 'Purity Samanthe' }],
  },
  {
    id: 'mission-dubai',
    name: 'Dubai',
    city: 'Dubai',
    host_country: 'United Arab Emirates',
    attaches: [
      { id: 'attache-dubai-1', full_name: 'Alfred Abuko' },
      { id: 'attache-dubai-2', full_name: 'Grace Wanjiru' },
    ],
  },
]

const ISSUED: Directive = {
  id: 'directive-new',
  type_category: null,
  description: 'Prepare a market brief.',
  status: 'issued',
  target_completion_date: null,
  last_progress_update_at: '2026-09-30T08:00:00Z',
  mission: { id: 'mission-london', name: 'London' },
  target_user: { id: 'attache-london', full_name: 'Purity Samanthe' },
  issued_by: { id: 'user-1', full_name: 'Test User' },
  is_overdue: false,
  is_stale: false,
  due_state: 'no_date',
  days_until_due: null,
  created_at: '2026-09-30T08:00:00Z',
  updated_at: '2026-09-30T08:00:00Z',
}

function meFor(roleName: string) {
  return {
    user: {
      id: 'user-1',
      full_name: 'Test User',
      email: 'user@sdt.go.ke',
      role_id: 'role-1',
      mission_id: null,
      ministry_id: 'ministry-1',
      status: 'active' as const,
      language_preference: 'en' as const,
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: roleName, layer: '3' as const, scope: 'ministry' as const },
    permissions: [],
    isLoading: false,
    isAuthenticated: true,
    refetch: vi.fn(),
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/directives/new']}>
          <Routes>
            <Route path="/directives/new" element={<IssueDirectivePage />} />
            <Route path="/directives/:id" element={<p>Directive detail page</p>} />
            <Route path="/directives" element={<p>Directive list page</p>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const user = userEvent.setup()

async function waitForMissions() {
  await screen.findByRole('radio', { name: 'London' })
}

async function fillRequired() {
  await waitForMissions()
  await user.click(screen.getByRole('radio', { name: 'London' }))
  await user.type(screen.getByLabelText(/^Description/), 'Prepare a market brief.')
}

describe('IssueDirectivePage', () => {
  beforeEach(() => {
    vi.mocked(directivesApi.listDirectiveAssignees).mockReset().mockResolvedValue(ASSIGNEES)
    vi.mocked(directivesApi.getDirectiveTypeOptions).mockReset().mockResolvedValue([])
    vi.mocked(directivesApi.issueDirective).mockReset().mockResolvedValue(ISSUED)
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry HQ Officer'))
  })

  it('TC-UI-006: is not rendered for read-only roles', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Head of Mission'))

    renderPage()

    expect(await screen.findByText('You do not have permission to perform this action.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Issue Directive' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'London' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Issue directive' })).not.toBeInTheDocument()
    expect(directivesApi.listDirectiveAssignees).not.toHaveBeenCalled()
  })

  it('TC-UI-006: is not rendered for a role other than Ministry HQ Officer / Ministry PS / Acting PS', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry HQ Director'))

    renderPage()

    expect(await screen.findByText('You do not have permission to perform this action.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Issue Directive' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'You cannot issue directives' })).toBeInTheDocument()
  })

  it('TC-FR-DIR-002-A: is not rendered for a Ministry Attache', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry Attache'))

    renderPage()

    expect(await screen.findByRole('heading', { name: 'You cannot issue directives' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to directives/ })).toHaveAttribute('href', '/directives')
  })

  it('renders the form for Ministry HQ Officer', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Issue Directive' })).toBeInTheDocument()
    await waitForMissions()
    expect(screen.getByRole('button', { name: /Issue directive/ })).toBeInTheDocument()
  })

  it('renders the form for Ministry PS', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry PS'))

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Issue Directive' })).toBeInTheDocument()
  })

  it('TC-FR-DIR-002-B: renders the form for an Acting PS (carries the PS permission set)', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Acting PS'))

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Issue Directive' })).toBeInTheDocument()
  })

  it('TC-FR-DIR-002-C: lists assignee missions and disables a mission with no posted attache', async () => {
    renderPage()
    await waitForMissions()

    const berlin = screen.getByRole('radio', { name: 'Berlin' })
    expect(berlin).toBeDisabled()
    expect(screen.getByText('No attache posted')).toBeInTheDocument()
    expect(screen.getByText(/Missions without a posted attache cannot receive directives/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'London' })).toBeEnabled()
    expect(screen.getByText('Choose a mission first to see the attaches posted there.')).toBeInTheDocument()
  })

  it('TC-FR-DIR-002-D: auto-selects the only attache at a mission and makes the issuer choose between several', async () => {
    renderPage()
    await waitForMissions()

    await user.click(screen.getByRole('radio', { name: 'London' }))
    expect(screen.getByRole('radio', { name: 'Purity Samanthe' })).toBeChecked()
    expect(screen.getByText('The only attache posted at this mission has been selected for you.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Dubai' }))
    expect(screen.queryByRole('radio', { name: 'Purity Samanthe' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Alfred Abuko' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Grace Wanjiru' })).not.toBeChecked()
    // Target attache and description are both still missing.
    expect(screen.getByText('2 required fields missing')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Grace Wanjiru' }))
    expect(screen.getByRole('radio', { name: 'Grace Wanjiru' })).toBeChecked()
    expect(screen.getByText('1 required field missing')).toBeInTheDocument()
  })

  it('TC-FR-DIR-002-E: searches missions by name, city, country or attache when the list is long', async () => {
    vi.mocked(directivesApi.listDirectiveAssignees).mockResolvedValue([
      ...ASSIGNEES,
      ...['Accra', 'Cairo', 'Jakarta', 'Beijing'].map((name) => ({
        id: `mission-${name}`,
        name,
        city: name,
        host_country: 'Elsewhere',
        attaches: [{ id: `attache-${name}`, full_name: `${name} Attache` }],
      })),
    ])

    renderPage()
    await waitForMissions()

    await user.type(screen.getByRole('searchbox', { name: 'Search missions' }), 'wanjiru')
    const options = screen.getByTestId('directive-mission-options')
    expect(within(options).getByRole('radio', { name: 'Dubai' })).toBeInTheDocument()
    expect(within(options).queryByRole('radio', { name: 'London' })).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: 'Search missions' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search missions' }), 'zzz')
    expect(screen.getByText('No missions match your search.')).toBeInTheDocument()
  })

  it('TC-FR-DIR-001-A: offers configured type categories as tiles, defaulting to "No category"', async () => {
    vi.mocked(directivesApi.getDirectiveTypeOptions).mockResolvedValue([
      { id: 'type-1', value: 'Market Research', display_order: 1 },
      { id: 'type-2', value: 'Trade Show Follow-Up', display_order: 2 },
    ])

    renderPage()

    expect(await screen.findByRole('radio', { name: 'Market Research' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'No category' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Trade Show Follow-Up' })).not.toBeChecked()
    expect(screen.queryByText(/No directive categories are configured yet/)).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-001-B: explains that the directive will be uncategorised when no categories are configured', async () => {
    renderPage()

    expect(await screen.findByText(/No directive categories are configured yet/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'No category' })).toBeChecked()
  })

  it('TC-FR-DIR-003-A: defaults to "No date set" and computes preset target dates from today', async () => {
    renderPage()
    await waitForMissions()

    expect(screen.getByRole('radio', { name: 'No date set' })).toBeChecked()
    expect(screen.getByText(/reminded 7 days and 3 days before the target date/)).toBeInTheDocument()

    const inOneWeek = formatCalendarDate(addDays(localDateString(), 7), 'en-GB')
    await user.click(screen.getByRole('radio', { name: '1 week' }))
    expect(screen.getByRole('radio', { name: '1 week' })).toBeChecked()
    expect(within(screen.getByTestId('directive-review')).getByText(inOneWeek)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '2 weeks' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '30 days' })).toBeInTheDocument()
  })

  it('TC-FR-DIR-003-B: a custom date must be chosen and cannot be earlier than today', async () => {
    renderPage()
    await fillRequired()

    await user.click(screen.getByRole('radio', { name: 'Custom date' }))
    const dateInput = screen.getByLabelText(/^Custom target date/)
    expect(dateInput).toHaveAttribute('min', localDateString())
    expect(screen.getByText('Choose a date, or pick “No date set”.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Issue directive/ })).toBeDisabled()

    await user.type(dateInput, addDays(localDateString(), -1))
    expect(screen.getByText('The target date cannot be in the past.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Issue directive/ })).toBeDisabled()
  })

  it('TC-FR-DIR-002-F: keeps the issue button disabled until a recipient and description are provided', async () => {
    renderPage()
    await waitForMissions()

    const submit = screen.getByRole('button', { name: /Issue directive/ })
    expect(submit).toBeDisabled()
    expect(screen.getByText('3 required fields missing')).toBeInTheDocument()

    const description = screen.getByLabelText(/^Description/)
    expect(description).toHaveAttribute('maxLength', '5000')
    await user.click(description)
    await user.tab()
    expect(screen.getByText('Describe the task before issuing the directive.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'London' }))
    await user.type(description, '   ')
    expect(submit).toBeDisabled()

    await user.type(description, 'Prepare a market brief.')
    expect(submit).toBeEnabled()
    expect(screen.getByText('Ready to issue')).toBeInTheDocument()
  })

  it('TC-FR-DIR-002-G: issues the directive with the chosen recipient, category and date, then opens it', async () => {
    vi.mocked(directivesApi.getDirectiveTypeOptions).mockResolvedValue([{ id: 'type-1', value: 'Market Research', display_order: 1 }])

    renderPage()
    await fillRequired()
    await user.click(screen.getByRole('radio', { name: 'Market Research' }))
    await user.click(screen.getByRole('radio', { name: '2 weeks' }))
    await user.click(screen.getByRole('button', { name: /Issue directive/ }))

    expect(directivesApi.issueDirective).toHaveBeenCalledWith({
      mission_id: 'mission-london',
      target_user_id: 'attache-london',
      type_category: 'Market Research',
      description: 'Prepare a market brief.',
      target_completion_date: addDays(localDateString(), 14),
    })
    expect(await screen.findByText('Directive detail page')).toBeInTheDocument()
  })

  it('TC-FR-DIR-003-C: omits the category and target date when "No category" and "No date set" are kept', async () => {
    renderPage()
    await fillRequired()
    await user.click(screen.getByRole('button', { name: /Issue directive/ }))

    expect(directivesApi.issueDirective).toHaveBeenCalledWith({
      mission_id: 'mission-london',
      target_user_id: 'attache-london',
      type_category: undefined,
      description: 'Prepare a market brief.',
      target_completion_date: undefined,
    })
  })

  it('TC-FR-DIR-002-H: maps 422 validation messages onto the matching fields', async () => {
    vi.mocked(directivesApi.issueDirective).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          data: null,
          errors: [
            'The target attache must be an active attache posted at the selected mission.',
            'The target completion date must be today or later.',
            'Something unrelated went wrong.',
          ],
        },
      },
    })

    renderPage()
    await fillRequired()
    await user.click(screen.getByRole('button', { name: /Issue directive/ }))

    expect(await screen.findByText('The directive could not be issued.')).toBeInTheDocument()
    expect(screen.getByText('The target attache must be an active attache posted at the selected mission.')).toBeInTheDocument()
    expect(screen.getByText('The target completion date must be today or later.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Something unrelated went wrong.')
    expect(screen.getByRole('alert')).toHaveTextContent('Correct the highlighted fields and try again.')
    expect(screen.queryByText('Directive detail page')).not.toBeInTheDocument()

    // Picking a different attache clears that field's server error.
    await user.click(screen.getByRole('radio', { name: 'Dubai' }))
    expect(screen.queryByText('The target attache must be an active attache posted at the selected mission.')).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-002-I: shows a general error when the request fails without validation messages', async () => {
    vi.mocked(directivesApi.issueDirective).mockRejectedValue(new Error('Network Error'))

    renderPage()
    await fillRequired()
    await user.click(screen.getByRole('button', { name: /Issue directive/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  })
})
