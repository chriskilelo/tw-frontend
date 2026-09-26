import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LogInquiryPage from './LogInquiryPage'
import * as inquiriesApi from '../../api/inquiries'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/inquiries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/inquiries')>()
  return {
    ...actual,
    getInquiryCategories: vi.fn(),
    logInquiry: vi.fn(),
  }
})

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

describe('LogInquiryPage', () => {
  beforeEach(() => {
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

    await screen.findByRole('option', { name: 'Buyer Seeking Supplier' })

    await userEvent.type(screen.getByLabelText('Inquirer Name'), 'Jane Doe')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Buyer Seeking Supplier')
    await userEvent.click(screen.getByRole('button', { name: 'Log inquiry' }))

    expect(inquiriesApi.logInquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        inquirer_name: 'Jane Doe',
        category: 'Buyer Seeking Supplier',
        sub_type: 'standard',
      }),
    )
  })

  it('TC-FR-INQ-022: selecting the Dispute / Complaint toggle sets sub_type to dispute_or_complaint', async () => {
    renderLogInquiryPage()

    await screen.findByRole('option', { name: 'Buyer Seeking Supplier' })

    await userEvent.type(screen.getByLabelText('Inquirer Name'), 'Jane Doe')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Buyer Seeking Supplier')

    const disputeToggle = screen.getByLabelText('Dispute / Complaint')
    expect(disputeToggle).not.toBeChecked()
    await userEvent.click(disputeToggle)
    expect(disputeToggle).toBeChecked()

    await userEvent.click(screen.getByRole('button', { name: 'Log inquiry' }))

    expect(inquiriesApi.logInquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        sub_type: 'dispute_or_complaint',
      }),
    )
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderLogInquiryPage()
    await screen.findByRole('option', { name: 'Buyer Seeking Supplier' })

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
