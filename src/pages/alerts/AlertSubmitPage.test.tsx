import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AlertSubmitPage from './AlertSubmitPage'
import * as alertsApi from '../../api/alerts'

vi.mock('../../api/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/alerts')>()
  return {
    ...actual,
    getAlertIntelligenceTypeOptions: vi.fn(),
    submitAlert: vi.fn(),
    uploadAlertAttachment: vi.fn(),
  }
})

function renderSubmitPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/alerts/new']}>
        <AlertSubmitPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AlertSubmitPage', () => {
  beforeEach(() => {
    vi.mocked(alertsApi.getAlertIntelligenceTypeOptions).mockReset().mockResolvedValue([
      { id: 'opt-1', ministry_id: null, category: 'alert_intelligence_type', value: 'opportunities', display_order: 1, active: true },
      { id: 'opt-2', ministry_id: null, category: 'alert_intelligence_type', value: 'trade_barriers', display_order: 2, active: true },
    ])
    vi.mocked(alertsApi.submitAlert).mockReset().mockResolvedValue({
      id: 'alert-1',
      reference_number: 'ALT-202608-00001',
      country: 'Kenya',
      sector: null,
      product_category: null,
      intelligence_type: 'opportunities',
      urgency: null,
      status: 'new',
      assigned_to_user_id: null,
      created_at: '2026-08-13T00:00:00Z',
    })
    vi.mocked(alertsApi.uploadAlertAttachment).mockReset()
  })

  it('TC-FR-ALERT-002: renders, and submitting a filled form calls alerts.submitAlert', async () => {
    renderSubmitPage()

    expect(screen.getByRole('heading', { name: 'Submit Intelligence Alert' })).toBeInTheDocument()

    await screen.findByRole('option', { name: 'Opportunities' })

    await userEvent.type(screen.getByLabelText('Country'), 'Kenya')
    await userEvent.selectOptions(screen.getByLabelText('Intelligence Type'), 'opportunities')
    await userEvent.click(screen.getByRole('button', { name: 'Submit alert' }))

    expect(alertsApi.submitAlert).toHaveBeenCalledWith({
      country: 'Kenya',
      intelligence_type: 'opportunities',
      sector: undefined,
      product_category: undefined,
      product_description: undefined,
      intelligence_source: undefined,
      urgency: undefined,
      confidence_rating: undefined,
      tags: undefined,
    })
  })

  it('TC-UI-005: shows a validation error when the API rejects submission with 422 (StoreAlertRequest, missing mandatory field)', async () => {
    vi.mocked(alertsApi.submitAlert).mockReset().mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: { data: null, errors: ['The intelligence type field is required.'] },
      },
    })

    renderSubmitPage()

    await screen.findByRole('option', { name: 'Opportunities' })

    await userEvent.type(screen.getByLabelText('Country'), 'Kenya')
    await userEvent.selectOptions(screen.getByLabelText('Intelligence Type'), 'opportunities')
    await userEvent.click(screen.getByRole('button', { name: 'Submit alert' }))

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderSubmitPage()
    await screen.findByRole('option', { name: 'Opportunities' })

    // The form is a single-column flex layout capped by max-w-2xl, not a fixed pixel width.
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
