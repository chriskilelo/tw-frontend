import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MissionActivityPage from './MissionActivityPage'
import * as authApi from '../../api/auth'
import * as missionsApi from '../../api/missions'
import * as governanceApi from '../../api/governance'
import type { MeResponse } from '../../api/auth'

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
  return { ...actual, getMissionActivityFeed: vi.fn(), getMissionActivitySummary: vi.fn() }
})

function meResponseFor(roleName: string): MeResponse {
  return {
    user: {
      id: 'user-1',
      full_name: 'Head of Mission User',
      email: 'hom@sdt.go.ke',
      role_id: 'role-1',
      mission_id: 'mission-1',
      ministry_id: null,
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: roleName, layer: '1', scope: 'mission' },
    permissions: [],
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/mission-activity']}>
        <MissionActivityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MissionActivityPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meResponseFor('Head of Mission'))
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([
      { id: 'mission-1', name: 'London', city: 'London', active: true },
    ])
    vi.mocked(governanceApi.getMissionActivityFeed).mockReset().mockResolvedValue({
      data: [
        {
          type: 'alert',
          id: 'alert-1',
          reference: 'ALT-202608-00001',
          mission_id: 'mission-1',
          mission_name: 'London',
          ministry_id: 'ministry-1',
          ministry_name: 'State Department for Trade',
          submitting_officer: 'Purity Samanthe',
          status: 'new',
          summary: 'Opportunity in the UK market',
          date: '2026-08-10T10:00:00Z',
        },
      ],
      meta: { current_page: 1, per_page: 25, total: 1 },
    })
    vi.mocked(governanceApi.getMissionActivitySummary).mockReset().mockResolvedValue({
      current_period: {
        period_start: '2026-07-01',
        period_end: '2026-09-30',
        total: 42,
        by_type: { alert: 25, inquiry: 17 },
        by_status: { new: 30, received: 12 },
      },
      prior_period: {
        period_start: '2026-04-01',
        period_end: '2026-06-30',
        total: 89,
        by_type: { alert: 60, inquiry: 29 },
        by_status: { new: 11, closed: 78 },
      },
    })
  })

  it('TC-FR-HOM-001: renders read-only activity data for HoM user and shows no action buttons', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: /Mission Activity — London \(Read-Only\)/ })).toBeInTheDocument()
    expect(screen.getByText('Read-only')).toBeInTheDocument()

    // Summary tiles for both current and prior period, from GET /mission-activity/summary.
    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('89')).toBeInTheDocument()

    // Chronological activity feed row, from GET /mission-activity.
    expect(await screen.findByText('ALT-202608-00001')).toBeInTheDocument()
    expect(screen.getByText('Purity Samanthe')).toBeInTheDocument()

    // UI-006 / CLAUDE.md Rule 2: completely read-only, no action buttons anywhere.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: /Mission Activity/ })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
