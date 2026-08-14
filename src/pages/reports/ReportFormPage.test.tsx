import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReportFormPage from './ReportFormPage'
import * as reportsApi from '../../api/reports'
import * as useAuthModule from '../../hooks/useAuth'
import type { PeriodicReport } from '../../api/reports'

vi.mock('../../api/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/reports')>()
  return {
    ...actual,
    getPeriodicReport: vi.fn(),
    updateReportSection: vi.fn(),
    submitPeriodicReport: vi.fn(),
    addReportDataRow: vi.fn(),
    removeReportDataRow: vi.fn(),
    carryForwardReport: vi.fn(),
  }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const REPORT: PeriodicReport = {
  id: 'report-1',
  reporting_period_label: 'Q1 2027',
  period_start_date: '2026-07-01',
  period_end_date: '2026-09-30',
  template_version: 1,
  status: 'draft',
  submitted_at: null,
  is_late: false,
  mission: { id: 'mission-1', name: 'London' },
  authored_by: { id: 'attache-1', full_name: 'Purity Samanthe' },
  sections: [
    {
      id: 'section-narrative-1',
      report_template_section_id: 'tpl-1',
      section_title: 'Introduction',
      section_type: 'narrative',
      section_order: 1,
      column_schema: null,
      guidance_text: 'Provide an outline, background, and objectives.',
      content: '',
      data_rows: null,
      updated_at: '2026-08-13T00:00:00Z',
    },
    {
      id: 'section-table-1',
      report_template_section_id: 'tpl-8',
      section_title: 'Asset Register',
      section_type: 'structured_table',
      section_order: 8,
      column_schema: [
        { name: 'Item Number', type: 'integer', mandatory: true },
        { name: 'Item Description', type: 'text', mandatory: true },
        { name: 'Remarks', type: 'text', mandatory: false },
      ],
      guidance_text: null,
      content: null,
      data_rows: [],
      updated_at: '2026-08-13T00:00:00Z',
    },
  ],
  created_at: '2026-08-13T00:00:00Z',
  updated_at: '2026-08-13T00:00:00Z',
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/reports/report-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ReportFormPage', () => {
  beforeEach(() => {
    vi.mocked(reportsApi.getPeriodicReport).mockReset().mockResolvedValue(REPORT)
    vi.mocked(reportsApi.updateReportSection).mockReset().mockResolvedValue(REPORT)
    vi.mocked(reportsApi.submitPeriodicReport).mockReset().mockResolvedValue({
      ...REPORT,
      status: 'submitted',
      submitted_at: '2026-08-14T00:00:00Z',
    })
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: {
        id: 'attache-1',
        full_name: 'Purity Samanthe',
        email: 'attache@sdt.go.ke',
        role_id: 'role-attache',
        mission_id: 'mission-1',
        ministry_id: 'ministry-1',
        status: 'active',
        language_preference: 'en',
        email_notification_preferences: null,
      },
      role: { id: 'role-attache', name: 'Ministry Attache', layer: '2', scope: 'mission' },
      permissions: [],
      isLoading: false,
      isAuthenticated: true,
      refetch: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-FR-RPT-006: debounces narrative section auto-save calls', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Introduction' })

    vi.useFakeTimers()

    const textarea = screen.getByRole('textbox', { name: 'Introduction' })
    fireEvent.change(textarea, { target: { value: 'D' } })
    fireEvent.change(textarea, { target: { value: 'Dr' } })
    fireEvent.change(textarea, { target: { value: 'Draft text' } })

    // Still within the 2-second debounce window — no save fired yet.
    await vi.advanceTimersByTimeAsync(1000)
    expect(reportsApi.updateReportSection).not.toHaveBeenCalled()

    // Past the debounce window since the last keystroke — exactly one save call.
    await vi.advanceTimersByTimeAsync(1500)
    expect(reportsApi.updateReportSection).toHaveBeenCalledTimes(1)
    expect(reportsApi.updateReportSection).toHaveBeenCalledWith('report-1', 'section-narrative-1', 'Draft text')
  })

  it('TC-FR-RPT-014: submit button opens a confirmation modal before POSTing', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Introduction' })

    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    expect(reportsApi.submitPeriodicReport).not.toHaveBeenCalled()
    expect(screen.getByText(/Submitting is final/)).toBeInTheDocument()

    // Headless UI's Dialog marks the rest of the page aria-hidden while open, so the
    // page's own trigger button drops out of the accessibility tree — this query now
    // resolves to the modal's confirm button alone.
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    expect(reportsApi.submitPeriodicReport).toHaveBeenCalledWith('report-1')
  })

  it('TC-UI-005: mandatory structured-table columns show an asterisk indicator', async () => {
    renderPage()
    await screen.findByText('Asset Register')

    const itemNumberHeader = screen.getByRole('columnheader', { name: /Item Number/ })
    expect(itemNumberHeader.querySelector('[aria-label="required"]')).toBeInTheDocument()

    const remarksHeader = screen.getByRole('columnheader', { name: /Remarks/ })
    expect(remarksHeader.querySelector('[aria-label="required"]')).not.toBeInTheDocument()
  })
})
