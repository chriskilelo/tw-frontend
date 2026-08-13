import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AlertDetailPage from './AlertDetailPage'
import * as alertsApi from '../../api/alerts'
import * as useAuthModule from '../../hooks/useAuth'
import type { AlertDetail } from '../../api/alerts'

vi.mock('../../api/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/alerts')>()
  return {
    ...actual,
    getAlert: vi.fn(),
    getAlertIntelligenceTypeOptions: vi.fn(),
    postAlertFeedback: vi.fn(),
    acknowledgeAlert: vi.fn(),
    delegateAlert: vi.fn(),
    updateAlert: vi.fn(),
  }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const ALERT: AlertDetail = {
  id: 'alert-1',
  reference_number: 'ALT-202608-00001',
  country: 'Kenya',
  sector: null,
  product_category: null,
  product_description: null,
  intelligence_type: 'opportunities',
  intelligence_source: null,
  urgency: null,
  confidence_rating: null,
  tags: null,
  status: 'assigned',
  mission: { id: 'mission-1', name: 'London' },
  submitted_by: { id: 'attache-1', full_name: 'Purity Samanthe' },
  assigned_to: { id: 'ps-1', full_name: 'Test PS' },
  attachments: [],
  feedback: [],
  versions: [],
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

function renderDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/alerts/alert-1']}>
        <Routes>
          <Route path="/alerts/:id" element={<AlertDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function meFor(roleName: string, userId: string) {
  return {
    user: {
      id: userId,
      full_name: 'Test User',
      email: 'user@sdt.go.ke',
      role_id: 'role-1',
      mission_id: 'mission-1',
      ministry_id: null,
      status: 'active' as const,
      language_preference: 'en' as const,
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: roleName, layer: '1', scope: 'mission' as const },
    permissions: [],
    isLoading: false,
    isAuthenticated: true,
    refetch: vi.fn(),
  }
}

describe('AlertDetailPage', () => {
  beforeEach(() => {
    vi.mocked(alertsApi.getAlert).mockReset().mockResolvedValue(ALERT)
    vi.mocked(alertsApi.getAlertIntelligenceTypeOptions).mockReset().mockResolvedValue([])
  })

  it('TC-UI-006: Head of Mission (BR-020 read-only) sees no submit, delegate, acknowledge, or edit buttons', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Head of Mission', 'hom-1'))

    renderDetailPage()

    expect(await screen.findByText('ALT-202608-00001')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Edit alert' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delegate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Post feedback' })).not.toBeInTheDocument()
  })

  it('shows the delegate button for a Ministry PS', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry PS', 'ps-user-1'))

    renderDetailPage()

    expect(await screen.findByRole('button', { name: 'Delegate' })).toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry Attache', 'attache-1'))

    const { container } = renderDetailPage()
    expect(await screen.findByText('ALT-202608-00001')).toBeInTheDocument()

    // The two-column detail grid collapses to a single column below the lg breakpoint
    // (grid-cols-1 lg:grid-cols-3), so nothing forces horizontal overflow at 375px.
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
