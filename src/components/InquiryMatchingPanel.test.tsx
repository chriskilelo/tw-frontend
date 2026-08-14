import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InquiryMatchingPanel } from './InquiryMatchingPanel'
import * as inquiriesApi from '../api/inquiries'
import * as useAuthModule from '../hooks/useAuth'
import type { InquiryDetail } from '../api/inquiries'

vi.mock('../api/inquiries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/inquiries')>()
  return { ...actual, findInquiryMatches: vi.fn(), linkInquiry: vi.fn() }
})

vi.mock('../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const SOURCE_INQUIRY: InquiryDetail = {
  id: 'inquiry-1',
  reference_number: 'INQ-202608-00001',
  category: 'Buyer Seeking Supplier',
  sub_type: 'standard',
  inquirer_name: 'Jane Doe',
  inquirer_organisation: null,
  inquirer_email: null,
  inquirer_phone: null,
  product_or_sector: 'Coffee',
  description: 'Seeking a coffee supplier',
  date_received: '2026-08-13',
  status: 'received',
  high_value_flag: false,
  high_value_justification: null,
  resolution_summary: null,
  closed_at: null,
  linked_inquiry: null,
  mission: { id: 'mission-1', name: 'London' },
  logged_by: { id: 'attache-1', full_name: 'Purity Samanthe' },
  notes: [],
  events: [],
  created_at: '2026-08-13T00:00:00Z',
  updated_at: '2026-08-13T00:00:00Z',
}

function mockAuth(roleName: string) {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: {
      id: 'user-1',
      full_name: 'Test User',
      email: 'user@sdt.go.ke',
      role_id: 'role-1',
      mission_id: null,
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: roleName, layer: '2', scope: 'ministry' },
    permissions: [],
    isLoading: false,
    isAuthenticated: true,
    refetch: vi.fn(),
  })
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <InquiryMatchingPanel inquiry={SOURCE_INQUIRY} onLinked={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('InquiryMatchingPanel', () => {
  beforeEach(() => {
    vi.mocked(inquiriesApi.findInquiryMatches).mockReset()
    vi.mocked(inquiriesApi.linkInquiry).mockReset()
  })

  it('TC-FR-INQ-019-A: renders potential cross-mission matches with a relevance indicator and link action for Ministry HQ Officer', async () => {
    mockAuth('Ministry HQ Officer')
    vi.mocked(inquiriesApi.findInquiryMatches).mockResolvedValue([
      {
        id: 'inquiry-2',
        reference_number: 'INQ-202608-00002',
        category: 'Buyer Seeking Supplier',
        sub_type: 'standard',
        inquirer_name: 'Jane Doe',
        product_or_sector: 'Coffee',
        status: 'received',
        high_value_flag: false,
        date_received: '2026-08-10',
        mission: { id: 'mission-2', name: 'Dubai' },
        created_at: '2026-08-10T00:00:00Z',
      },
    ])

    renderPanel()

    expect(await screen.findByText('INQ-202608-00002')).toBeInTheDocument()
    expect(screen.getByText('Dubai')).toBeInTheDocument()
    expect(screen.getByText(/Relevance:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link to this inquiry' })).toBeInTheDocument()
    expect(inquiriesApi.findInquiryMatches).toHaveBeenCalledWith('inquiry-1')
  })

  it('TC-FR-INQ-019-B: renders nothing for Ministry Attache and never calls the matching endpoint', () => {
    mockAuth('Ministry Attache')

    const { container } = renderPanel()

    expect(container).toBeEmptyDOMElement()
    expect(inquiriesApi.findInquiryMatches).not.toHaveBeenCalled()
  })
})
