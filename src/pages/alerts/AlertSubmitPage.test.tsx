import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AlertSubmitPage from './AlertSubmitPage'
import * as alertsApi from '../../api/alerts'
import * as authApi from '../../api/auth'
import type { MeResponse } from '../../api/auth'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/alerts')>()
  return {
    ...actual,
    getAlertIntelligenceTypeOptions: vi.fn(),
    submitAlert: vi.fn(),
    uploadAlertAttachment: vi.fn(),
  }
})

vi.mock('../../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/auth')>()
  return { ...actual, me: vi.fn(), updatePreferences: vi.fn() }
})

function attacheWithMission(): MeResponse {
  return {
    user: {
      id: 'user-1',
      full_name: 'QA Attache London',
      email: 'attache.london@tradewatch.go.ke',
      role_id: 'role-1',
      mission_id: 'mission-1',
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
      mission: { id: 'mission-1', name: 'London', host_country: 'United Kingdom' },
      ministry: { id: 'ministry-1', name: 'State Department for Trade' },
    },
    role: { id: 'role-1', name: 'Ministry Attache', layer: '2', scope: 'mission' },
    permissions: [],
  }
}

function renderSubmitPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/alerts/new']}>
          <AlertSubmitPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function waitForIntelligenceTypes() {
  await screen.findByRole('radio', { name: 'Opportunities' })
}

describe('AlertSubmitPage', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup({ delay: null })
    vi.mocked(authApi.me).mockReset().mockRejectedValue(new Error('unauthenticated'))
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

    await waitForIntelligenceTypes()

    await user.type(screen.getByLabelText(/^Country/), 'Kenya')
    await user.click(screen.getByRole('radio', { name: 'Opportunities' }))
    await user.click(screen.getByRole('button', { name: 'Submit alert' }))

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

  it('TC-FR-ALERT-002-B: sends urgency, confidence and tags chosen through the tile and tag controls', async () => {
    renderSubmitPage()
    await waitForIntelligenceTypes()

    await user.type(screen.getByLabelText(/^Country/), 'Kenya')
    await user.click(screen.getByRole('radio', { name: 'Trade Barriers' }))
    await user.click(screen.getByRole('radio', { name: 'High' }))
    await user.click(screen.getByRole('radio', { name: 'Good' }))
    await user.type(screen.getByRole('textbox', { name: /^Tags/ }), 'avocado{Enter}')
    await user.click(screen.getByRole('button', { name: 'SPS' }))
    await user.click(screen.getByRole('button', { name: 'Submit alert' }))

    expect(alertsApi.submitAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        intelligence_type: 'trade_barriers',
        urgency: 'high',
        confidence_rating: 'good',
        tags: ['avocado', 'SPS'],
      }),
    )
  })

  it('TC-FR-ALERT-002-C: keeps submit disabled until both mandatory fields (Country, Intelligence Type) are set', async () => {
    renderSubmitPage()
    await waitForIntelligenceTypes()

    const submitButton = screen.getByRole('button', { name: 'Submit alert' })
    expect(submitButton).toBeDisabled()
    expect(screen.getByText('2 required fields left')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Opportunities' }))
    expect(submitButton).toBeDisabled()
    expect(screen.getByText('1 required field left')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Country/), 'Kenya')
    expect(submitButton).toBeEnabled()
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('TC-FR-ALERT-002-D: pre-fills Country from the attache mission profile and lets them change it', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(attacheWithMission())

    renderSubmitPage()
    await waitForIntelligenceTypes()

    expect(await screen.findByTestId('alert-country-prefilled')).toHaveTextContent('United Kingdom')
    expect(screen.getByText('From your mission profile · London')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Opportunities' }))
    await user.click(screen.getByRole('button', { name: 'Submit alert' }))
    expect(alertsApi.submitAlert).toHaveBeenLastCalledWith(expect.objectContaining({ country: 'United Kingdom' }))

    await user.click(screen.getByRole('button', { name: 'Change Country' }))
    const countryInput = screen.getByLabelText(/^Country/)
    expect(countryInput).toHaveFocus()
    expect(countryInput).toHaveValue('United Kingdom')
  })

  it('TC-UI-005: lists every field in the readiness checklist, marks only the two mandatory ones, and ticks fields as they are filled', async () => {
    renderSubmitPage()
    await waitForIntelligenceTypes()

    const checklist = screen.getByTestId('alert-readiness-checklist')
    const items = within(checklist).getAllByRole('listitem')
    expect(items.map((item) => item.textContent?.replace(/\s*\*\s*/, '').trim())).toEqual([
      'Intelligence Type',
      'Country',
      'Sector',
      'Product Category',
      'Product Description',
      'Intelligence Source',
      'Urgency',
      'Confidence Rating',
      'Tags',
      'Supporting Evidence',
    ])
    expect(items.filter((item) => item.textContent?.includes('*'))).toHaveLength(2)
    expect(screen.getByRole('progressbar', { name: 'Fields completed' })).toHaveAttribute('aria-valuenow', '0')

    await user.type(screen.getByLabelText(/^Sector/), 'Agriculture')

    expect(within(checklist).getByText('Sector').closest('li')).toHaveTextContent('(Ready)')
    expect(screen.getByRole('progressbar', { name: 'Fields completed' })).toHaveAttribute('aria-valuenow', '1')
  })

  it('TC-UI-005-B: summarises the assessment and clears both ratings on demand', async () => {
    renderSubmitPage()
    await waitForIntelligenceTypes()

    expect(screen.getByText('Urgency not rated')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Medium' }))
    await user.click(screen.getByRole('radio', { name: 'Confirmed' }))
    expect(screen.getByText('Medium urgency')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText('Urgency not rated')).toBeInTheDocument()
    expect(screen.getByText('Confidence not rated')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Medium' })).not.toBeChecked()
  })

  it('TC-UI-005-C: shows a validation error when the API rejects submission with 422 (StoreAlertRequest, missing mandatory field)', async () => {
    vi.mocked(alertsApi.submitAlert).mockReset().mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: { data: null, errors: ['The intelligence type field is required.'] },
      },
    })

    renderSubmitPage()
    await waitForIntelligenceTypes()

    await user.type(screen.getByLabelText(/^Country/), 'Kenya')
    await user.click(screen.getByRole('radio', { name: 'Opportunities' }))
    await user.click(screen.getByRole('button', { name: 'Submit alert' }))

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  it('TC-UI-007: shows the format/size hint inside the attachment dropzone', async () => {
    renderSubmitPage()
    await waitForIntelligenceTypes()

    expect(screen.getByText('JPG, PNG, PDF, MP4 or LOG. Max 10 MB per file.')).toBeInTheDocument()
  })

  it('TC-UI-007: rejects a disallowed file extension before it ever reaches the network (e.g. .docx)', async () => {
    renderSubmitPage()
    await waitForIntelligenceTypes()

    // userEvent.upload() simulates the OS file picker, which respects the input's `accept`
    // attribute and silently filters out non-matching files before they're ever selected —
    // so it can't exercise this component's own JS validation, only the browser-level
    // affordance. fireEvent bypasses that simulation to test the actual code path, which
    // matters because a user can still pick a disallowed file via "All Files" in most
    // native file dialogs; the `accept` attribute is a UX hint, not the real boundary.
    const input = screen.getByLabelText('Supporting Evidence') as HTMLInputElement
    const file = new File(['x'], 'evidence.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText('One or more files are not an accepted format (JPG, PNG, PDF, MP4, LOG) and were not added.'),
    ).toBeInTheDocument()
  })

  it('TC-UI-007: rejects an oversized file before it ever reaches the network', async () => {
    renderSubmitPage()
    await waitForIntelligenceTypes()

    const input = screen.getByLabelText('Supporting Evidence') as HTMLInputElement
    const oversized = new File([new Uint8Array(11 * 1024 * 1024)], 'evidence.pdf', { type: 'application/pdf' })
    await user.upload(input, oversized)

    expect(await screen.findByText('One or more files exceed the 10MB limit and were not added.')).toBeInTheDocument()
  })

  it('TC-UI-007-B: lists accepted files with their size and lets the user remove one', async () => {
    renderSubmitPage()
    await waitForIntelligenceTypes()

    const input = screen.getByLabelText('Supporting Evidence') as HTMLInputElement
    await user.upload(input, new File(['x'.repeat(2048)], 'brief.pdf', { type: 'application/pdf' }))

    expect(screen.getByText('brief.pdf')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove brief.pdf' }))
    expect(screen.queryByText('brief.pdf')).not.toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderSubmitPage()
    await waitForIntelligenceTypes()

    // Fluid, single-column below the 1200px sidebar breakpoint; nothing is pinned to a fixed pixel width.
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
