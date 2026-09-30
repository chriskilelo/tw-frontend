import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportFormPage from './ReportFormPage'
import * as reportsApi from '../../api/reports'
import * as useAuthModule from '../../hooks/useAuth'
import type { PeriodicReportDetail } from '../../api/reports'
import { aieSection, assetSection, authAs, axiosError, narrativeSection, renderRoute, reportDetail } from './reportTestUtils'

vi.mock('../../api/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/reports')>()
  return {
    ...actual,
    getPeriodicReport: vi.fn(),
    saveSectionContent: vi.fn(),
    saveSectionRows: vi.fn(),
    carryForwardSection: vi.fn(),
    submitPeriodicReport: vi.fn(),
    discardDraftReport: vi.fn(),
  }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

function isoDay(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function renderReport(report: PeriodicReportDetail = reportDetail({ deadline: isoDay(10), days_to_deadline: 10 })) {
  vi.mocked(reportsApi.getPeriodicReport).mockResolvedValue(report)
  return renderRoute('/reports/report-1', '/reports/:id', <ReportFormPage />, [{ path: '/reports', element: <p>Report list</p> }])
}

async function openSection(title: string) {
  const rail = screen.getByRole('navigation', { name: 'Report sections' })
  await userEvent.click(within(rail).getByRole('button', { name: new RegExp(title) }))
  return screen.findByRole('heading', { name: title, level: 2 })
}

describe('ReportFormPage — the attache editor', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry Attache', 'mission-1'))
    vi.mocked(reportsApi.saveSectionContent).mockReset().mockImplementation(async () => reportDetail())
    vi.mocked(reportsApi.saveSectionRows).mockReset().mockImplementation(async () => reportDetail())
    vi.mocked(reportsApi.carryForwardSection).mockReset()
    vi.mocked(reportsApi.submitPeriodicReport).mockReset()
    vi.mocked(reportsApi.discardDraftReport).mockReset()
    vi.mocked(reportsApi.getPeriodicReport).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-FR-RPT-004-A: shows the section with its guidance and a formatting toolbar that writes the formatting', async () => {
    renderReport()

    expect(await screen.findByRole('heading', { name: 'Introduction', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Outline, background, objectives, limitations/assumptions')).toBeInTheDocument()

    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' })
    for (const tool of ['Bold', 'Italic', 'Subheading', 'Bulleted list', 'Numbered list', 'Insert table']) {
      expect(within(toolbar).getByRole('button', { name: tool })).toBeInTheDocument()
    }

    await userEvent.click(within(toolbar).getByRole('button', { name: 'Bold' }))
    expect(screen.getByRole('textbox', { name: 'Introduction' })).toHaveValue('**bold text**')

    await userEvent.click(within(toolbar).getByRole('button', { name: 'Bulleted list' }))
    expect(screen.getByRole('textbox', { name: 'Introduction' })).toHaveValue('- **bold text**')
  })

  it('TC-FR-RPT-004-B: the preview renders formatting as elements and never interprets typed HTML', async () => {
    renderReport()
    const textarea = await screen.findByRole('textbox', { name: 'Introduction' })

    fireEvent.change(textarea, { target: { value: '**Key finding** and *context*\n\n- one\n- two\n\n<img src=x onerror=alert(1)>' } })
    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }))

    const preview = screen.getByTestId('narrative-preview')
    expect(within(preview).getByText('Key finding').tagName).toBe('STRONG')
    expect(within(preview).getByText('context').tagName).toBe('EM')
    expect(within(preview).getAllByRole('listitem')).toHaveLength(2)
    expect(preview.querySelector('img')).toBeNull()
    expect(within(preview).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  })

  it('TC-FR-RPT-006-A: auto-saves once, 1.5 seconds after the attache stops typing', async () => {
    renderReport()
    const textarea = await screen.findByRole('textbox', { name: 'Introduction' })

    vi.useFakeTimers()
    fireEvent.change(textarea, { target: { value: 'D' } })
    fireEvent.change(textarea, { target: { value: 'Draft text' } })

    await vi.advanceTimersByTimeAsync(1000)
    expect(reportsApi.saveSectionContent).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(600)
    expect(reportsApi.saveSectionContent).toHaveBeenCalledTimes(1)
    expect(reportsApi.saveSectionContent).toHaveBeenCalledWith('report-1', 'section-intro', 'Draft text')
  })

  it('TC-FR-RPT-006-B: keeps saving at least every 30 seconds while the attache types without pause', async () => {
    renderReport()
    const textarea = await screen.findByRole('textbox', { name: 'Introduction' })

    vi.useFakeTimers()
    for (let second = 1; second <= 31; second += 1) {
      fireEvent.change(textarea, { target: { value: `word ${second}` } })
      await vi.advanceTimersByTimeAsync(1000)
    }

    expect(reportsApi.saveSectionContent).toHaveBeenCalled()
  })

  it('TC-FR-RPT-005 / TC-FR-RPT-006-C: leaving a section saves it at once, and its text is there on return', async () => {
    renderReport()
    const textarea = await screen.findByRole('textbox', { name: 'Introduction' })

    fireEvent.change(textarea, { target: { value: 'Typed just now' } })
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(reportsApi.saveSectionContent).toHaveBeenCalledWith('report-1', 'section-intro', 'Typed just now')
    expect(await screen.findByRole('heading', { name: 'Asset Register', level: 2 })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByRole('textbox', { name: 'Introduction' })).toHaveValue('Typed just now')
  })

  it('TC-FR-RPT-006-D: a failed save keeps the text, says so, and can be retried', async () => {
    vi.mocked(reportsApi.saveSectionContent).mockRejectedValueOnce(new Error('Network Error'))
    renderReport()
    const textarea = await screen.findByRole('textbox', { name: 'Introduction' })

    fireEvent.change(textarea, { target: { value: 'Unsaved words' } })
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText(/Couldn't save your latest changes/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Retry now' }))

    await waitFor(() => expect(screen.getByTestId('report-save-status')).toHaveTextContent('Saved'))
    expect(reportsApi.saveSectionContent).toHaveBeenCalledTimes(2)
    expect(reportsApi.saveSectionContent).toHaveBeenLastCalledWith('report-1', 'section-intro', 'Unsaved words')
  })

  it('TC-FR-RPT-015-B: switches to the read-only report when a save is refused because it was submitted elsewhere', async () => {
    vi.mocked(reportsApi.saveSectionContent).mockRejectedValueOnce(axiosError(403))
    renderReport()
    const textarea = await screen.findByRole('textbox', { name: 'Introduction' })
    vi.mocked(reportsApi.getPeriodicReport).mockResolvedValue(
      reportDetail({ status: 'submitted', submitted_at: '2026-10-02T09:00:00Z', allowed_actions: { edit: false, submit: false, carry_forward: false, discard: false } }),
    )

    fireEvent.change(textarea, { target: { value: 'Too late' } })
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByTestId('report-read-only')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('TC-FR-RPT-013: shows each section\'s completion and updates the progress as the attache writes', async () => {
    renderReport()
    await screen.findByRole('textbox', { name: 'Introduction' })

    expect(screen.getByTestId('report-progress')).toHaveTextContent('1 of 4 sections complete')
    const rail = screen.getByRole('navigation', { name: 'Report sections' })
    expect(within(rail).getByRole('button', { name: /Introduction.*Not started/ })).toBeInTheDocument()
    expect(within(rail).getByRole('button', { name: /AIE Allocations Analysis.*Complete/ })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Introduction' }), { target: { value: 'Written' } })

    expect(screen.getByTestId('report-progress')).toHaveTextContent('2 of 4 sections complete')
    expect(within(rail).getByRole('button', { name: /Introduction.*Complete/ })).toHaveAttribute('aria-current', 'step')
  })

  it('TC-FR-RPT-010: refuses a non-numeric cell inline and saves the table only once it is valid (TC-FR-RPT-007)', async () => {
    renderReport()
    await screen.findByRole('textbox', { name: 'Introduction' })
    await openSection('Asset Register')

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Item Number, row 1' }), { target: { value: 'abc' } })

    expect(screen.getByText('Enter a number, e.g. 1250.50')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Item Number, row 1' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('report-save-status')).toHaveTextContent('Fix the highlighted values to save this table')

    await vi.advanceTimersByTimeAsync(3000)
    expect(reportsApi.saveSectionRows).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox', { name: 'Item Number, row 1' }), { target: { value: '12' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Status, row 1' }), { target: { value: 'Serviceable' } })
    await vi.advanceTimersByTimeAsync(1600)

    expect(reportsApi.saveSectionRows).toHaveBeenCalledTimes(1)
    expect(reportsApi.saveSectionRows).toHaveBeenCalledWith('report-1', 'section-assets', [
      { id: expect.any(String), row_data: { 'Item Number': 12, Status: 'Serviceable' } },
    ])
  })

  it('TC-FR-RPT-007-B: moves and removes rows, and the saved table follows the new order', async () => {
    renderReport(
      reportDetail({
        deadline: isoDay(10),
        sections: [
          assetSection({
            data_rows: [
              { id: 'asset-1', row_order: 1, row_data: { 'Item Number': 1, 'Item Description': 'Laptop', Status: 'Serviceable' } },
              { id: 'asset-2', row_order: 2, row_data: { 'Item Number': 2, 'Item Description': 'Printer', Status: 'Serviceable' } },
            ],
          }),
        ],
      }),
    )
    await screen.findByRole('heading', { name: 'Asset Register', level: 2 })

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Move row 2 up' }))
    expect(screen.getByRole('textbox', { name: 'Item Description, row 1' })).toHaveValue('Printer')

    fireEvent.click(screen.getByRole('button', { name: 'Remove row 2' }))
    await vi.advanceTimersByTimeAsync(1600)

    expect(reportsApi.saveSectionRows).toHaveBeenCalledTimes(1)
    expect(vi.mocked(reportsApi.saveSectionRows).mock.lastCall?.[2]).toEqual([
      { id: 'asset-2', row_data: { 'Item Number': 2, 'Item Description': 'Printer', Status: 'Serviceable' } },
    ])
  })

  it('TC-FR-RPT-009: the total row sums the budget lines, leaves out the bank balance, and recalculates as values change', async () => {
    renderReport()
    await screen.findByRole('textbox', { name: 'Introduction' })
    await openSection('AIE Allocations Analysis')

    expect(screen.getByText(/lines come from your department/)).toBeInTheDocument()
    expect(screen.getByTestId('total-Quarter Allocation')).toHaveTextContent('2,000.5')

    fireEvent.change(screen.getByRole('textbox', { name: 'Quarter Allocation, row 2' }), { target: { value: '1,000' } })

    expect(screen.getByTestId('total-Quarter Allocation')).toHaveTextContent('2,200')
  })

  it('TC-FR-RPT-011: carrying a table forward asks first, then replaces its rows', async () => {
    const carried = assetSection({
      data_rows: [
        { id: 'c-1', row_order: 1, row_data: { 'Item Number': 1, 'Item Description': 'Laptop', Status: 'Serviceable' } },
        { id: 'c-2', row_order: 2, row_data: { 'Item Number': 2, 'Item Description': 'Printer', Status: 'Needs Repair' } },
      ],
    })
    vi.mocked(reportsApi.carryForwardSection).mockResolvedValue(reportDetail({ sections: [narrativeSection(), carried, aieSection()] }))
    renderReport(
      reportDetail({
        deadline: isoDay(10),
        allowed_actions: { edit: true, submit: true, carry_forward: true, discard: true },
        carry_forward_source: { id: 'report-q4', reporting_period_label: 'Q4 2026', submitted_at: '2026-07-10T09:00:00Z' },
      }),
    )
    await screen.findByRole('textbox', { name: 'Introduction' })
    await openSection('Asset Register')

    await userEvent.click(screen.getByRole('button', { name: 'Copy rows from Q4 2026' }))
    const dialog = await screen.findByRole('dialog', { name: 'Copy this table from your Q4 2026 report?' })
    expect(reportsApi.carryForwardSection).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy rows' }))

    expect(reportsApi.carryForwardSection).toHaveBeenCalledWith('report-1', 'section-assets')
    expect(await screen.findByText('2 rows copied.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Item Description, row 2' })).toHaveValue('Printer')
  })

  it('TC-FR-RPT-014: submitting lists what is incomplete and the deadline, then shows the locked report', async () => {
    const submitted = reportDetail({
      status: 'submitted',
      submitted_at: '2026-10-02T09:00:00Z',
      compliance_status: 'submitted_on_time',
      allowed_actions: { edit: false, submit: false, carry_forward: false, discard: false },
    })
    vi.mocked(reportsApi.submitPeriodicReport).mockResolvedValue(submitted)
    renderReport()
    await screen.findByRole('textbox', { name: 'Introduction' })

    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    const dialog = await screen.findByRole('dialog', { name: 'Submit the Q1 2026 report' })

    expect(within(dialog).getByText('1 of 4 sections complete')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Go to Introduction' })).toBeInTheDocument()
    expect(within(dialog).getByTestId('submit-timeliness')).toHaveTextContent('records the report as on time')
    expect(within(dialog).getByText(/Once submitted, the report is locked/)).toBeInTheDocument()
    expect(reportsApi.submitPeriodicReport).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit report' }))

    expect(reportsApi.submitPeriodicReport).toHaveBeenCalledWith('report-1')
    expect(await screen.findByTestId('report-submitted-banner')).toHaveTextContent('Report submitted')
    expect(screen.getByTestId('report-status-badge')).toHaveTextContent('Submitted')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit report' })).not.toBeInTheDocument()
  })

  it('TC-FR-RPT-016: warns that a report past its deadline will be recorded as late', async () => {
    renderReport(reportDetail({ deadline: isoDay(-3), days_to_deadline: -3, is_overdue: true, days_overdue: 3 }))
    await screen.findByRole('textbox', { name: 'Introduction' })

    expect(screen.getByTestId('report-timeliness-badge')).toHaveTextContent('Overdue · 3 days')

    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByTestId('submit-timeliness')).toHaveTextContent('will be recorded as late, 3 days overdue')
  })

  it('discards a draft only after confirmation, then returns to the list', async () => {
    vi.mocked(reportsApi.discardDraftReport).mockResolvedValue()
    renderReport()
    await screen.findByRole('textbox', { name: 'Introduction' })

    await userEvent.click(screen.getByRole('button', { name: 'Discard draft' }))
    const dialog = await screen.findByRole('dialog', { name: 'Discard this draft?' })
    expect(reportsApi.discardDraftReport).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard draft' }))

    expect(reportsApi.discardDraftReport).toHaveBeenCalledWith('report-1')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/reports'))
    expect(screen.getByText('Report list')).toBeInTheDocument()
  })
})

describe('ReportFormPage — read-only readers', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry HQ Officer'))
    vi.mocked(reportsApi.getPeriodicReport).mockReset()
  })

  it('TC-FR-RPT-017 / TC-UI-006: an HQ reviewer reads the submitted report as a document with no edit controls', async () => {
    renderReport(
      reportDetail({
        status: 'submitted',
        submitted_at: '2026-10-18T09:00:00Z',
        is_late: true,
        days_overdue: 3,
        compliance_status: 'submitted_late',
        submitted_by: { id: 'attache-1', full_name: 'Purity Samanthe' },
        allowed_actions: { edit: false, submit: false, carry_forward: false, discard: false },
        sections: [narrativeSection({ content: '**Key** finding for London.', completion: 'complete' }), aieSection({ completion: 'complete' })],
      }),
    )

    expect(await screen.findByRole('heading', { name: 'Q1 2026 quarterly report', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('report-timeliness-badge')).toHaveTextContent('Late · 3 days')
    expect(screen.getByText('Key').tagName).toBe('STRONG')
    expect(screen.getByTestId('report-read-only')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print or save as PDF' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Contents' })).toBeInTheDocument()
    expect(screen.getByText(/Submitted 3 days after the/)).toBeInTheDocument()

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit report' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Discard draft' })).not.toBeInTheDocument()
  })

  it.each([
    [403, "You can't open this report"],
    [404, 'Report not found'],
  ])('explains a %s instead of showing a report', async (status, title) => {
    vi.mocked(reportsApi.getPeriodicReport).mockRejectedValue(axiosError(status))
    renderRoute('/reports/report-1', '/reports/:id', <ReportFormPage />)

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All reports' })).toHaveAttribute('href', '/reports')
  })

  it('offers a retry when the report cannot be loaded', async () => {
    vi.mocked(reportsApi.getPeriodicReport).mockRejectedValue(axiosError(500, ['Server error.']))
    renderRoute('/reports/report-1', '/reports/:id', <ReportFormPage />)

    expect(await screen.findByText('Server error.')).toBeInTheDocument()
    vi.mocked(reportsApi.getPeriodicReport).mockResolvedValue(
      reportDetail({ status: 'submitted', allowed_actions: { edit: false, submit: false, carry_forward: false, discard: false } }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByTestId('report-document')).toBeInTheDocument()
  })
})
