import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import IssueDirectivePage from './IssueDirectivePage'
import * as directivesApi from '../../api/directives'
import * as missionsApi from '../../api/missions'
import * as useAuthModule from '../../hooks/useAuth'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return { ...actual, issueDirective: vi.fn(), getDirectiveTypeOptions: vi.fn() }
})

vi.mock('../../api/missions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/missions')>()
  return { ...actual, listMissions: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

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
        <IssueDirectivePage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('IssueDirectivePage', () => {
  beforeEach(() => {
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([{ id: 'mission-1', name: 'London', city: 'London', active: true }])
    vi.mocked(directivesApi.getDirectiveTypeOptions).mockReset().mockResolvedValue([])
    vi.mocked(directivesApi.issueDirective).mockReset()
  })

  it('TC-UI-006: is not rendered for read-only roles', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Head of Mission'))

    renderPage()

    expect(await screen.findByText('You do not have permission to perform this action.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Issue Directive' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Target Attache User ID')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Issue directive' })).not.toBeInTheDocument()
  })

  it('TC-UI-006: is not rendered for a role other than Ministry HQ Officer / Ministry PS', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry HQ Director'))

    renderPage()

    expect(await screen.findByText('You do not have permission to perform this action.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Issue Directive' })).not.toBeInTheDocument()
  })

  it('renders the form for Ministry HQ Officer', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry HQ Officer'))

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Issue Directive' })).toBeInTheDocument()
    expect(screen.getByLabelText('Target Attache User ID')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Issue directive' })).toBeInTheDocument()
  })

  it('renders the form for Ministry PS', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry PS'))

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Issue Directive' })).toBeInTheDocument()
  })
})
