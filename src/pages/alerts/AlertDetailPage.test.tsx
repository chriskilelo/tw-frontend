import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AlertDetailPage from './AlertDetailPage'
import * as alertsApi from '../../api/alerts'
import * as useAuthModule from '../../hooks/useAuth'
import type { AlertDetail } from '../../api/alerts'
import { I18nProvider } from '../../i18n/context'

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
    getAlertAttachmentDownloadUrl: vi.fn(),
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
      <I18nProvider>
      <MemoryRouter initialEntries={['/alerts/alert-1']}>
        <Routes>
          <Route path="/alerts/:id" element={<AlertDetailPage />} />
        </Routes>
      </MemoryRouter>
      </I18nProvider>
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

    expect(await screen.findByTestId('alert-reference-number')).toHaveTextContent('ALT-202608-00001')

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
    expect(await screen.findByTestId('alert-reference-number')).toHaveTextContent('ALT-202608-00001')

    // The content/sidebar grid only splits into two columns at 1200px; below that everything
    // stacks in one fluid column, so nothing forces horizontal overflow at 375px.
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
  it('TC-FR-ALERT-009: the assigned delegate sees the tracker waiting on them and can acknowledge', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry HQ Director', 'ps-1'))
    vi.mocked(alertsApi.acknowledgeAlert).mockReset().mockResolvedValue({ ...ALERT, status: 'acknowledged' })
    const user = userEvent.setup({ delay: null })

    renderDetailPage()

    const tracker = await screen.findByRole('list', { name: 'Alert progress' })
    expect(within(tracker).getByText('Delegated to Test PS')).toBeInTheDocument()
    expect(within(tracker).getByText('Waiting for Test PS').closest('li')).toHaveAttribute('aria-current', 'step')

    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))

    expect(alertsApi.acknowledgeAlert).toHaveBeenCalledWith('alert-1')
    expect(await screen.findByTestId('alert-status-badge')).toHaveTextContent('Acknowledged')
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument()
  })

  it('TC-FR-ALERT-006: shows tile values by name and older free-text urgency/confidence values verbatim', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry PS', 'ps-user-1'))
    vi.mocked(alertsApi.getAlert).mockReset().mockResolvedValue({
      ...ALERT,
      urgency: 'Routine',
      confidence_rating: 'good',
      product_category: 'Plastics',
      tags: ['compliance'],
    })

    renderDetailPage()

    expect(await screen.findByText('Plastics · Kenya')).toBeInTheDocument()
    expect(screen.getByText('Urgency: Routine')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Search alerts tagged compliance' })).toHaveAttribute('href', '/search?q=compliance')
    expect(screen.getAllByText('Not provided')).toHaveLength(2)
  })

  it('TC-FR-ALERT-003: downloads an attachment through a signed URL', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry PS', 'ps-user-1'))
    vi.mocked(alertsApi.getAlert).mockReset().mockResolvedValue({
      ...ALERT,
      attachments: [
        { id: 'att-1', original_filename: 'brief.pdf', file_size_bytes: 2048, mime_type: 'application/pdf', created_at: ALERT.created_at },
      ],
    })
    vi.mocked(alertsApi.getAlertAttachmentDownloadUrl).mockReset().mockResolvedValue('https://files.example/brief.pdf?signature=abc')
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const user = userEvent.setup({ delay: null })

    renderDetailPage()

    await user.click(await screen.findByRole('button', { name: 'Download brief.pdf' }))

    expect(alertsApi.getAlertAttachmentDownloadUrl).toHaveBeenCalledWith('alert-1', 'att-1')
    expect(openSpy).toHaveBeenCalledWith('https://files.example/brief.pdf?signature=abc', '_blank', 'noopener,noreferrer')
    openSpy.mockRestore()
  })

  it('TC-FR-ALERT-010: posts feedback only once the composer has text', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry PS', 'ps-user-1'))
    vi.mocked(alertsApi.postAlertFeedback).mockReset().mockResolvedValue({
      id: 'fb-1',
      alert_id: 'alert-1',
      posted_by_user_id: 'ps-user-1',
      content: 'Please follow up with KEBS.',
      created_at: ALERT.created_at,
    } as never)
    const user = userEvent.setup({ delay: null })

    renderDetailPage()

    const postButton = await screen.findByRole('button', { name: 'Post feedback' })
    expect(postButton).toBeDisabled()

    await user.type(screen.getByLabelText('Add feedback'), 'Please follow up with KEBS.')
    await user.click(postButton)

    expect(alertsApi.postAlertFeedback).toHaveBeenCalledWith('alert-1', { content: 'Please follow up with KEBS.' })
  })

  it('TC-FR-ALERT-011: the submitting attache edits the alert through the tile controls', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(meFor('Ministry Attache', 'attache-1'))
    vi.mocked(alertsApi.getAlertIntelligenceTypeOptions).mockReset().mockResolvedValue([
      { id: 'opt-1', ministry_id: null, category: 'alert_intelligence_type', value: 'opportunities', display_order: 1, active: true },
      { id: 'opt-2', ministry_id: null, category: 'alert_intelligence_type', value: 'trade_barriers', display_order: 2, active: true },
    ])
    vi.mocked(alertsApi.updateAlert).mockReset().mockResolvedValue({ ...ALERT, urgency: 'high' })
    const user = userEvent.setup({ delay: null })

    renderDetailPage()

    await user.click(await screen.findByRole('button', { name: 'Edit alert' }))
    await user.click(await screen.findByRole('radio', { name: 'Trade Barriers' }))
    await user.click(screen.getByRole('radio', { name: 'High' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(alertsApi.updateAlert).toHaveBeenCalledWith(
      'alert-1',
      expect.objectContaining({ intelligence_type: 'trade_barriers', urgency: 'high', country: 'Kenya' }),
    )
  })
})
