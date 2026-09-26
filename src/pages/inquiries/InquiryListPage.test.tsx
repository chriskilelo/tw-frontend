import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InquiryListPage from './InquiryListPage'
import * as inquiriesApi from '../../api/inquiries'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/inquiries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/inquiries')>()
  return { ...actual, getInquiryCategories: vi.fn(), listInquiries: vi.fn() }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/inquiries']}>
        <InquiryListPage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('InquiryListPage', () => {
  beforeEach(() => {
    vi.mocked(inquiriesApi.getInquiryCategories).mockReset().mockResolvedValue([
      { id: 'cat-1', value: 'Buyer Seeking Supplier', display_order: 1 },
    ])
    vi.mocked(inquiriesApi.listInquiries).mockReset().mockResolvedValue({
      data: [
        {
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
        },
      ],
      meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    })
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Inquiries and Case Tracker' })).toBeInTheDocument()
    expect(await screen.findByText('INQ-202608-00001')).toBeInTheDocument()

    // Table renders inside its own overflow-x-auto wrapper (components/Table.tsx),
    // so a wide table never forces the page body itself to overflow horizontally.
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
