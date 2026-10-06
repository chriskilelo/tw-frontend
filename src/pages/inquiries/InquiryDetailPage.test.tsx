import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    getInquiryCategories: vi.fn(),
    transitionInquiryStatus: vi.fn(),
    addInquiryNote: vi.fn(),
    closeInquiry: vi.fn(),
    logInquiryEvent: vi.fn(),
    updateInquiry: vi.fn(),
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
  inquirer_organisation: 'Greenfield Produce Ltd',
  inquirer_email: 'jane@greenfield.example',
  inquirer_phone: null,
  product_or_sector: 'Avocados',
  description: 'Looking for a Kenyan avocado exporter.',
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
  referrals: [],
  created_at: '2026-08-13T08:00:00Z',
  updated_at: '2026-08-13T08:00:00Z',
}

type RoleName = 'Ministry Attache' | 'Head of Mission' | 'Ministry HQ Officer'

function signInAs(roleName: RoleName, missionId: string | null = 'mission-1') {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: {
      id: 'user-1',
      full_name: 'Signed-in User',
      email: 'user@sdt.go.ke',
      role_id: 'role-1',
      mission_id: missionId,
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: roleName, layer: '2', scope: 'mission' },
    permissions: [],
    isLoading: false,
    isAuthenticated: true,
    refetch: vi.fn(),
  })
}

function renderPage(inquiry: InquiryDetail = INQUIRY) {
  vi.mocked(inquiriesApi.getInquiry).mockResolvedValue(inquiry)
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
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup({ delay: null })
    vi.mocked(inquiriesApi.getInquiry).mockReset()
    vi.mocked(inquiriesApi.getInquiryCategories).mockReset().mockResolvedValue([
      { id: 'cat-1', value: 'Buyer Seeking Supplier', display_order: 1 },
      { id: 'cat-2', value: 'Disputes/Complaints', display_order: 6 },
    ])
    vi.mocked(inquiriesApi.transitionInquiryStatus).mockReset().mockResolvedValue({ ...INQUIRY, status: 'received' })
    vi.mocked(inquiriesApi.closeInquiry).mockReset()
    vi.mocked(inquiriesApi.logInquiryEvent).mockReset()
    vi.mocked(inquiriesApi.updateInquiry).mockReset()
    signInAs('Head of Mission')
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()
    expect(await screen.findByTestId('inquiry-reference-number')).toHaveTextContent('INQ-202608-00001')

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })

  it('TC-UI-006: a read-only role sees the record but no workflow or write controls', async () => {
    renderPage()
    await screen.findByTestId('inquiry-reference-number')

    expect(screen.getByText('View only')).toBeInTheDocument()
    expect(screen.queryByTestId('inquiry-next-step')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit inquiry/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('inquiry-log-event')).not.toBeInTheDocument()
    expect(screen.getByText('Only the London attache can update this inquiry.')).toBeInTheDocument()
  })

  it('TC-FR-HOM-001-SCOPE: explains a refused inquiry and leads a Head of Mission back to Mission Activity', async () => {
    vi.mocked(inquiriesApi.getInquiry).mockRejectedValue({ isAxiosError: true, response: { status: 403, data: { message: 'This action is unauthorized.' } } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
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

    expect(await screen.findByRole('heading', { name: 'You don’t have access to this inquiry' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mission activity' })).toHaveAttribute('href', '/mission-activity')
  })

  it('TC-FR-INQ-006: the owning attache moves a draft inquiry to received from the next-step bar', async () => {
    signInAs('Ministry Attache')
    renderPage()

    const nextStep = await screen.findByTestId('inquiry-next-step')
    await user.click(within(nextStep).getByRole('button', { name: /Mark received/ }))

    expect(inquiriesApi.transitionInquiryStatus).toHaveBeenCalledWith('inquiry-1', { status: 'received' })
  })

  it('TC-FR-INQ-006-B: cancelling asks for confirmation before changing the status', async () => {
    signInAs('Ministry Attache')
    vi.mocked(inquiriesApi.transitionInquiryStatus).mockResolvedValue({ ...INQUIRY, status: 'cancelled' })
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Cancel inquiry/ }))
    expect(inquiriesApi.transitionInquiryStatus).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: 'Yes, cancel it' }))
    expect(inquiriesApi.transitionInquiryStatus).toHaveBeenCalledWith('inquiry-1', { status: 'cancelled' })
  })

  it('TC-FR-INQ-012: closing a resolved inquiry requires a resolution summary', async () => {
    signInAs('Ministry Attache')
    vi.mocked(inquiriesApi.closeInquiry).mockResolvedValue({ ...INQUIRY, status: 'closed', resolution_summary: 'Shared three exporters.' })
    renderPage({ ...INQUIRY, status: 'resolved' })

    await user.click(await screen.findByRole('button', { name: /Close inquiry/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /Close inquiry/ })).toBeDisabled()

    await user.type(within(dialog).getByLabelText(/Resolution Summary/), 'Shared three exporters.')
    await user.click(within(dialog).getByRole('button', { name: /Close inquiry/ }))

    expect(inquiriesApi.closeInquiry).toHaveBeenCalledWith('inquiry-1', { resolution_summary: 'Shared three exporters.' })
  })

  it('TC-FR-INQ-008: the owning attache logs an operational event with a note', async () => {
    signInAs('Ministry Attache')
    vi.mocked(inquiriesApi.logInquiryEvent).mockResolvedValue({ ...INQUIRY, status: 'in_progress' })
    renderPage({ ...INQUIRY, status: 'in_progress' })

    const composer = await screen.findByTestId('inquiry-log-event')
    await user.click(within(composer).getByRole('radio', { name: /Feedback Received/ }))
    await user.type(within(composer).getByLabelText('Note'), 'Buyer confirmed interest.')
    await user.click(within(composer).getByRole('button', { name: 'Log event' }))

    expect(inquiriesApi.logInquiryEvent).toHaveBeenCalledWith('inquiry-1', {
      event_type: 'feedback_received',
      note: 'Buyer confirmed interest.',
    })
  })

  it('TC-FR-INQ-004: the owning attache edits the inquiry and flags it as high value', async () => {
    signInAs('Ministry Attache')
    vi.mocked(inquiriesApi.updateInquiry).mockResolvedValue({ ...INQUIRY, high_value_flag: true })
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Edit inquiry/ }))
    const form = await screen.findByTestId('inquiry-edit-form')
    await user.click(within(form).getByRole('switch', { name: /High-value inquiry/ }))
    await user.type(within(form).getByLabelText(/Why is it high value/), 'Forty tonnes a month')
    await user.click(within(form).getByRole('button', { name: 'Save changes' }))

    expect(inquiriesApi.updateInquiry).toHaveBeenCalledWith(
      'inquiry-1',
      expect.objectContaining({
        inquirer_name: 'Jane Doe',
        high_value_flag: true,
        high_value_justification: 'Forty tonnes a month',
        inquirer_phone: null,
      }),
    )
  })

  it('TC-FR-REF-006: shows the persisted referral history and puts it on the activity timeline', async () => {
    renderPage({
      ...INQUIRY,
      status: 'in_progress',
      referrals: [
        {
          id: 'referral-1',
          referral_organisation: { id: 'org-1', name: 'Kenya Investment Authority (KenInvest)' },
          contact_person: 'Amina Otieno',
          referral_date: '2026-08-15',
          referral_method: 'email',
          reference_number: 'KI-2231',
          remarks: 'Introduced the buyer to KenInvest.',
          created_by: { id: 'attache-1', full_name: 'Purity Samanthe' },
          attachments: [{ id: 'att-1', original_filename: 'introduction.pdf', file_size_bytes: 20480, mime_type: 'application/pdf' }],
          created_at: '2026-08-15T09:00:00Z',
        },
      ],
    })

    const referrals = await screen.findByTestId('inquiry-referrals')
    expect(within(referrals).getByText('Kenya Investment Authority (KenInvest)')).toBeInTheDocument()
    expect(within(referrals).getByText('KI-2231')).toBeInTheDocument()
    expect(within(referrals).getByText('introduction.pdf')).toBeInTheDocument()

    const activity = screen.getByTestId('inquiry-activity')
    expect(within(activity).getByText('Referred to Kenya Investment Authority (KenInvest)')).toBeInTheDocument()
  })

  it('TC-FR-INQ-007: the activity filter separates status changes from operational events', async () => {
    renderPage({
      ...INQUIRY,
      status: 'received',
      events: [
        { id: 'e-1', event_type: 'status_changed', note: 'Status changed to received.', logged_by: null, created_at: '2026-08-14T08:00:00Z' },
        { id: 'e-2', event_type: 'hq_notified', note: 'HQ briefed.', logged_by: null, created_at: '2026-08-14T09:00:00Z' },
      ],
    })

    const activity = await screen.findByTestId('inquiry-activity')
    expect(within(activity).getByText('HQ Notified')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Status/ }))
    const filtered = screen.getByTestId('inquiry-activity')
    expect(within(filtered).queryByText('HQ Notified')).not.toBeInTheDocument()
    expect(within(filtered).getByText('Moved to')).toBeInTheDocument()
  })

  it('TC-FR-INQ-012-B: a closed inquiry shows its resolution and no further actions', async () => {
    signInAs('Ministry Attache')
    renderPage({
      ...INQUIRY,
      status: 'closed',
      resolution_summary: 'Shared three vetted exporters.',
      closed_at: '2026-08-20T10:00:00Z',
    })

    expect(await screen.findByTestId('inquiry-resolution')).toHaveTextContent('Shared three vetted exporters.')
    expect(screen.queryByTestId('inquiry-next-step')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit inquiry/ })).not.toBeInTheDocument()
  })
})
