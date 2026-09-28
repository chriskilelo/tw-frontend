import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LogInquiryPage from './LogInquiryPage'
import * as inquiriesApi from '../../api/inquiries'
import * as authApi from '../../api/auth'
import type { MeResponse } from '../../api/auth'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/inquiries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/inquiries')>()
  return {
    ...actual,
    getInquiryCategories: vi.fn(),
    logInquiry: vi.fn(),
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

function renderLogInquiryPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/inquiries/new']}>
          <LogInquiryPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function waitForCategories() {
  await screen.findByRole('radio', { name: 'Buyer Seeking Supplier' })
}

describe('LogInquiryPage', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup({ delay: null })
    vi.mocked(authApi.me).mockReset().mockRejectedValue(new Error('unauthenticated'))
    vi.mocked(inquiriesApi.getInquiryCategories).mockReset().mockResolvedValue([
      { id: 'cat-1', value: 'Buyer Seeking Supplier', display_order: 1 },
      { id: 'cat-2', value: 'Disputes/Complaints', display_order: 6 },
    ])
    vi.mocked(inquiriesApi.logInquiry).mockReset().mockResolvedValue({
      id: 'inquiry-1',
      reference_number: 'INQ-202608-00001',
      category: 'Buyer Seeking Supplier',
      sub_type: 'standard',
      inquirer_name: 'Jane Doe',
      product_or_sector: null,
      status: 'draft',
      high_value_flag: false,
      date_received: '2026-08-13',
      created_at: '2026-08-13T00:00:00Z',
    })
  })

  it('TC-FR-INQ-002: renders and submitting a filled form calls inquiries.logInquiry', async () => {
    renderLogInquiryPage()

    expect(screen.getByRole('heading', { name: 'Log Inquiry' })).toBeInTheDocument()
    await waitForCategories()

    await user.type(screen.getByLabelText(/^Inquirer Name/), 'Jane Doe')
    await user.click(screen.getByRole('radio', { name: 'Buyer Seeking Supplier' }))
    await user.click(screen.getByRole('button', { name: 'Log inquiry' }))

    expect(inquiriesApi.logInquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        inquirer_name: 'Jane Doe',
        category: 'Buyer Seeking Supplier',
        sub_type: 'standard',
      }),
    )
  })

  it('TC-FR-INQ-002-B: the log button stays disabled until every required field is complete', async () => {
    renderLogInquiryPage()
    await waitForCategories()

    const logButton = screen.getByRole('button', { name: 'Log inquiry' })
    expect(logButton).toBeDisabled()
    expect(screen.getByText('2 required fields left')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Buyer Seeking Supplier' }))
    expect(logButton).toBeDisabled()

    await user.type(screen.getByLabelText(/^Inquirer Name/), 'Jane Doe')
    expect(logButton).toBeEnabled()
    expect(screen.getByRole('progressbar', { name: 'Fields completed' })).toHaveAttribute('aria-valuenow', '3')
  })

  it('TC-FR-INQ-022: selecting the Dispute / Complaint toggle sets sub_type to dispute_or_complaint', async () => {
    renderLogInquiryPage()
    await waitForCategories()

    await user.type(screen.getByLabelText(/^Inquirer Name/), 'Jane Doe')
    await user.click(screen.getByRole('radio', { name: 'Buyer Seeking Supplier' }))

    const disputeToggle = screen.getByRole('radio', { name: 'Dispute / Complaint' })
    expect(disputeToggle).not.toBeChecked()
    await user.click(disputeToggle)
    expect(disputeToggle).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Log inquiry' }))

    expect(inquiriesApi.logInquiry).toHaveBeenCalledWith(expect.objectContaining({ sub_type: 'dispute_or_complaint' }))
  })

  it('TC-FR-INQ-022-B: choosing the Disputes/Complaints category offers to switch the type', async () => {
    renderLogInquiryPage()
    await waitForCategories()

    await user.click(screen.getByRole('radio', { name: 'Disputes/Complaints' }))
    await user.click(screen.getByRole('button', { name: 'Switch type' }))

    expect(screen.getByRole('radio', { name: 'Dispute / Complaint' })).toBeChecked()
    expect(screen.queryByRole('button', { name: 'Switch type' })).not.toBeInTheDocument()
  })

  it('TC-FR-INQ-004: flagging the inquiry as high value sends the flag and justification', async () => {
    renderLogInquiryPage()
    await waitForCategories()

    await user.type(screen.getByLabelText(/^Inquirer Name/), 'Jane Doe')
    await user.click(screen.getByRole('radio', { name: 'Buyer Seeking Supplier' }))

    expect(screen.queryByLabelText(/^Why is it high value/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: /High-value inquiry/ }))
    await user.type(screen.getByLabelText(/^Why is it high value/), '40 tonnes a month')
    await user.click(screen.getByRole('button', { name: 'Log inquiry' }))

    expect(inquiriesApi.logInquiry).toHaveBeenCalledWith(
      expect.objectContaining({ high_value_flag: true, high_value_justification: '40 tonnes a month' }),
    )
  })

  it('TC-FR-INQ-002-C: an invalid email blocks logging and is flagged on the field', async () => {
    renderLogInquiryPage()
    await waitForCategories()

    await user.type(screen.getByLabelText(/^Inquirer Name/), 'Jane Doe')
    await user.click(screen.getByRole('radio', { name: 'Buyer Seeking Supplier' }))
    const emailInput = screen.getByLabelText(/^Email/)
    await user.type(emailInput, 'jane@')
    await user.tab()

    expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/Enter a valid email address/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log inquiry' })).toBeDisabled()

    await user.type(emailInput, 'example.com')
    expect(emailInput).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getByRole('button', { name: 'Log inquiry' })).toBeEnabled()
  })

  it('TC-FR-INQ-002-D: a future date received blocks logging', async () => {
    renderLogInquiryPage()
    await waitForCategories()

    await user.type(screen.getByLabelText(/^Inquirer Name/), 'Jane Doe')
    await user.click(screen.getByRole('radio', { name: 'Buyer Seeking Supplier' }))
    fireEvent.change(screen.getByLabelText(/^Date Received/), { target: { value: '2999-01-01' } })

    expect(screen.getByText('The date received cannot be in the future.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log inquiry' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('button', { name: 'Log inquiry' })).toBeEnabled()
  })

  it('TC-FR-INQ-003: shows the system-derived mission, country and logger read-only', async () => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(attacheWithMission())
    renderLogInquiryPage()

    expect(await screen.findByText('London')).toBeInTheDocument()
    expect(screen.getByText('United Kingdom')).toBeInTheDocument()
    expect(screen.getByText('QA Attache London · Ministry Attache')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Country/ })).not.toBeInTheDocument()
  })

  it('TC-FR-INQ-002-E: the preview card reflects the inquiry as it is filled in', async () => {
    renderLogInquiryPage()
    await waitForCategories()

    await user.type(screen.getByLabelText(/^Inquirer Name/), 'Jane Doe')
    await user.click(screen.getByRole('radio', { name: 'Buyer Seeking Supplier' }))

    const preview = screen.getByTestId('inquiry-preview')
    expect(within(preview).getByText('Jane Doe')).toBeInTheDocument()
    expect(within(preview).getByText('Buyer Seeking Supplier')).toBeInTheDocument()
    expect(within(preview).getByText('Draft')).toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderLogInquiryPage()
    await waitForCategories()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
