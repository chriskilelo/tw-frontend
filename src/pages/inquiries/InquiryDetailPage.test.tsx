import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InquiryDetailPage from './InquiryDetailPage'
import * as inquiriesApi from '../../api/inquiries'
import * as useAuthModule from '../../hooks/useAuth'
import type { InquiryDetail } from '../../api/inquiries'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/inquiries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/inquiries')>()
  return {
    ...actual,
    getInquiry: vi.fn(),
    transitionInquiryStatus: vi.fn(),
    addInquiryNote: vi.fn(),
    closeInquiry: vi.fn(),
  }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const INQUIRY: InquiryDetail = {
  id: 'inquiry-1',
  reference_number: 'INQ-202608-00001',
  category: 'Buyer Seeking Supplier',
  sub_type: 'standard',
  inquirer_name: 'Jane Doe',
  inquirer_organisation: null,
  inquirer_email: null,
  inquirer_phone: null,
  product_or_sector: null,
  description: null,
  date_received: '2026-08-13',
  status: 'draft',
  high_value_flag: false,
  high_value_justification: null,
  resolution_summary: null,
  closed_at: null,
  mission: { id: 'mission-1', name: 'London' },
  logged_by: { id: 'attache-1', full_name: 'Purity Samanthe' },
  notes: [],
  events: [],
  created_at: '2026-08-13T00:00:00Z',
  updated_at: '2026-08-13T00:00:00Z',
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/inquiries/inquiry-1']}>
        <Routes>
          <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
        </Routes>
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('InquiryDetailPage', () => {
  beforeEach(() => {
    vi.mocked(inquiriesApi.getInquiry).mockReset().mockResolvedValue(INQUIRY)
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: {
        id: 'hom-1',
        full_name: 'Test HoM',
        email: 'hom@sdt.go.ke',
        role_id: 'role-1',
        mission_id: 'mission-1',
        ministry_id: null,
        status: 'active',
        language_preference: 'en',
        email_notification_preferences: null,
      },
      role: { id: 'role-1', name: 'Head of Mission', layer: '1', scope: 'mission' },
      permissions: [],
      isLoading: false,
      isAuthenticated: true,
      refetch: vi.fn(),
    })
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()
    expect(await screen.findByText('INQ-202608-00001')).toBeInTheDocument()

    // The detail panel is a single-column grid below the lg breakpoint (grid-cols-1
    // lg:grid-cols-3), so nothing forces horizontal overflow at 375px.
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
