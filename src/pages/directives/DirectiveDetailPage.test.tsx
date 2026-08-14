import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveDetailPage from './DirectiveDetailPage'
import * as directivesApi from '../../api/directives'
import * as useAuthModule from '../../hooks/useAuth'
import type { DirectiveDetail } from '../../api/directives'

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return {
    ...actual,
    getDirective: vi.fn(),
    transitionDirectiveStatus: vi.fn(),
    addDirectiveNote: vi.fn(),
  }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const DIRECTIVE: DirectiveDetail = {
  id: 'directive-1',
  type_category: 'Trade Show Follow-Up',
  description: 'Submit the outstanding exhibitor report from the Q1 trade show.',
  status: 'in_progress',
  target_completion_date: '2026-09-01',
  completion_summary: null,
  last_progress_update_at: '2026-08-10T00:00:00Z',
  mission: { id: 'mission-1', name: 'London' },
  target_user: { id: 'attache-1', full_name: 'Purity Samanthe' },
  issued_by: { id: 'hq-officer-1', full_name: 'Test HQ Officer' },
  notes: [],
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-10T00:00:00Z',
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/directives/directive-1']}>
        <Routes>
          <Route path="/directives/:id" element={<DirectiveDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DirectiveDetailPage', () => {
  beforeEach(() => {
    vi.mocked(directivesApi.getDirective).mockReset().mockResolvedValue(DIRECTIVE)
    vi.mocked(directivesApi.transitionDirectiveStatus).mockReset()
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: {
        id: 'attache-1',
        full_name: 'Purity Samanthe',
        email: 'attache@sdt.go.ke',
        role_id: 'role-attache',
        mission_id: 'mission-1',
        ministry_id: 'ministry-1',
        status: 'active',
        language_preference: 'en',
        email_notification_preferences: null,
      },
      role: { id: 'role-attache', name: 'Ministry Attache', layer: '2', scope: 'mission' },
      permissions: [],
      isLoading: false,
      isAuthenticated: true,
      refetch: vi.fn(),
    })
  })

  it('TC-FR-DIR-007: the Complete action requires a completion summary before it can be submitted', async () => {
    vi.mocked(directivesApi.transitionDirectiveStatus).mockResolvedValue({
      ...DIRECTIVE,
      status: 'completed',
      completion_summary: 'Report submitted and filed.',
    })

    renderPage()
    await screen.findByText(DIRECTIVE.description.slice(0, 60))

    await userEvent.click(screen.getByRole('button', { name: 'Complete' }))

    const submitButton = screen.getByRole('button', { name: 'Complete directive' })
    expect(submitButton).toBeDisabled()

    await userEvent.click(submitButton)
    expect(directivesApi.transitionDirectiveStatus).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Completion Summary (required)'), 'Report submitted and filed.')
    expect(submitButton).toBeEnabled()

    await userEvent.click(submitButton)
    expect(directivesApi.transitionDirectiveStatus).toHaveBeenCalledWith('directive-1', {
      status: 'completed',
      note: 'Report submitted and filed.',
    })
  })

  it('TC-FR-DIR-006: shows Acknowledge/Mark In Progress/Cancel actions for the target attache per the directive status', async () => {
    vi.mocked(directivesApi.getDirective).mockResolvedValue({ ...DIRECTIVE, status: 'issued' })

    renderPage()
    await screen.findByText(DIRECTIVE.description.slice(0, 60))

    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel directive' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark In Progress' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument()
  })

  it('TC-FR-DIR-008: adds a progress note and renders it in the notes thread', async () => {
    vi.mocked(directivesApi.addDirectiveNote).mockResolvedValue({
      id: 'note-1',
      content: 'Asset register 60% complete.',
      authored_by_user_id: 'attache-1',
      created_at: '2026-08-11T00:00:00Z',
    })
    vi.mocked(directivesApi.getDirective).mockResolvedValueOnce(DIRECTIVE).mockResolvedValueOnce({
      ...DIRECTIVE,
      notes: [
        {
          id: 'note-1',
          content: 'Asset register 60% complete.',
          authored_by: { id: 'attache-1', full_name: 'Purity Samanthe' },
          created_at: '2026-08-11T00:00:00Z',
        },
      ],
    })

    renderPage()
    await screen.findByText(DIRECTIVE.description.slice(0, 60))
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Add a follow-up note…'), 'Asset register 60% complete.')
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }))

    expect(directivesApi.addDirectiveNote).toHaveBeenCalledWith('directive-1', { content: 'Asset register 60% complete.' })
    expect(await screen.findByText('Asset register 60% complete.')).toBeInTheDocument()
  })
})
