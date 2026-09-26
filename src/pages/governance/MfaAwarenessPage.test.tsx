import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MfaAwarenessPage from './MfaAwarenessPage'
import * as authApi from '../../api/auth'
import * as missionsApi from '../../api/missions'
import * as governanceApi from '../../api/governance'
import type { MeResponse } from '../../api/auth'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/auth')>()
  return { ...actual, me: vi.fn() }
})

vi.mock('../../api/missions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/missions')>()
  return { ...actual, listMissions: vi.fn() }
})

vi.mock('../../api/governance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/governance')>()
  return {
    ...actual,
    getMfaAwarenessSummary: vi.fn(),
    getMissionDrillDown: vi.fn(),
    getNationalOverview: vi.fn(),
  }
})

function meResponseFor(roleName: string): MeResponse {
  return {
    user: {
      id: 'user-2',
      full_name: 'MFA HQ Officer User',
      email: 'mfa@mfa.go.ke',
      role_id: 'role-2',
      mission_id: null,
      ministry_id: null,
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-2', name: roleName, layer: '1', scope: 'platform' },
    permissions: [],
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/mfa-awareness']}>
        <MfaAwarenessPage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('MfaAwarenessPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('MFA HQ Officer'))
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([
      { id: 'mission-1', name: 'London', city: 'London', active: true },
      { id: 'mission-2', name: 'Berlin', city: 'Berlin', active: true },
    ])
    vi.mocked(governanceApi.getMfaAwarenessSummary).mockReset().mockResolvedValue({
      total: 20,
      by_type: { alert: 13, inquiry: 7 },
      by_mission: { London: 9, Berlin: 3 },
      by_ministry: { 'State Department for Trade': 20 },
      by_period: { 'Q1 2027': 33 },
    })
    vi.mocked(governanceApi.getMissionDrillDown).mockReset()
    vi.mocked(governanceApi.getNationalOverview).mockReset()
  })

  it('TC-FR-MFA-001: renders aggregate counts for MFA HQ Officer, read-only, no national overview tab', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'MFA Awareness' })).toBeInTheDocument()
    expect(screen.getByText('Read-only')).toBeInTheDocument()

    // Aggregate total from GET /mfa-awareness.
    expect(await screen.findByText('20')).toBeInTheDocument()
    // By-mission breakdown table, driven by GET /missions + the by_mission counts.
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()

    // MFA HQ Officer (not MFA Principal Secretary) never sees the national overview tab.
    expect(screen.queryByRole('button', { name: 'National Overview' })).not.toBeInTheDocument()
    expect(governanceApi.getNationalOverview).not.toHaveBeenCalled()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'MFA Awareness' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
