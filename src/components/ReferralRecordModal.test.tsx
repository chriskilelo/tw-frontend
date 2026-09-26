import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReferralRecordModal } from './ReferralRecordModal'
import * as referralsApi from '../api/referrals'
import { I18nProvider } from '../i18n/context'

vi.mock('../api/referrals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/referrals')>()
  return {
    ...actual,
    getReferralOrganisations: vi.fn(),
    recordReferral: vi.fn(),
    uploadReferralAttachment: vi.fn(),
  }
})

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <ReferralRecordModal inquiryId="inquiry-1" open onClose={vi.fn()} onRecorded={vi.fn()} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('ReferralRecordModal', () => {
  beforeEach(() => {
    vi.mocked(referralsApi.getReferralOrganisations).mockReset().mockResolvedValue([
      { id: 'org-1', ministry_id: 'ministry-1', name: 'KenInvest', active: true },
    ])
    vi.mocked(referralsApi.recordReferral).mockReset()
    vi.mocked(referralsApi.uploadReferralAttachment).mockReset()
  })

  it('TC-UI-007: shows the format/size hint next to the attachment control (previously had none at all)', async () => {
    renderModal()
    await screen.findByRole('option', { name: 'KenInvest' })

    expect(screen.getByText('Max 10MB. JPG, PNG, PDF, MP4, or LOG files only.')).toBeInTheDocument()
  })

  it('TC-UI-007: rejects a disallowed file extension before it ever reaches the network (e.g. .docx)', async () => {
    renderModal()
    await screen.findByRole('option', { name: 'KenInvest' })

    const input = screen.getByLabelText('Attachment') as HTMLInputElement
    const file = new File(['x'], 'evidence.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText('That file is not an accepted format (JPG, PNG, PDF, MP4, LOG) and was not added.'),
    ).toBeInTheDocument()
  })

  it('TC-UI-007: rejects an oversized file before it ever reaches the network', async () => {
    renderModal()
    await screen.findByRole('option', { name: 'KenInvest' })

    const input = screen.getByLabelText('Attachment') as HTMLInputElement
    const oversized = new File([new Uint8Array(11 * 1024 * 1024)], 'evidence.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [oversized] } })

    expect(await screen.findByText('That file exceeds the 10MB limit and was not added.')).toBeInTheDocument()
  })

  it('accepts a valid file with no error shown', async () => {
    renderModal()
    await screen.findByRole('option', { name: 'KenInvest' })

    const input = screen.getByLabelText('Attachment') as HTMLInputElement
    const file = new File(['x'], 'evidence.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.queryByText('That file exceeds the 10MB limit and was not added.')).not.toBeInTheDocument()
    expect(
      screen.queryByText('That file is not an accepted format (JPG, PNG, PDF, MP4, LOG) and was not added.'),
    ).not.toBeInTheDocument()
  })
})
