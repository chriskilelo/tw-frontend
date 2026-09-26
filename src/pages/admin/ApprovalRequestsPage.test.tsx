import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApprovalRequestsPage from './ApprovalRequestsPage'
import * as authApi from '../../api/auth'
import * as approvalsApi from '../../api/approvals'
import * as usersApi from '../../api/users'
import type { ApprovalRequest } from '../../api/approvals'
import { managedUser, meAs, renderAdminPage } from './adminTestUtils'

vi.mock('../../api/auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/auth')>()), me: vi.fn() }))
vi.mock('../../api/approvals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/approvals')>()),
  listApprovalRequests: vi.fn(),
  approveApprovalRequest: vi.fn(),
  rejectApprovalRequest: vi.fn(),
  cancelApprovalRequest: vi.fn(),
  requestPsSuccession: vi.fn(),
}))
vi.mock('../../api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/users')>()),
  listUsers: vi.fn(),
}))

const pendingPromotion: ApprovalRequest = {
  id: 'request-1',
  type: 'ps_promotion',
  status: 'pending',
  ministry: { id: 'ministry-1', name: 'State Department for Trade' },
  requested_by: { id: 'admin-1', full_name: 'Admin Person' },
  subject_user: { id: 'officer-1', full_name: 'Jane Officer' },
  payload: null,
  decided_by: null,
  decided_at: null,
  decision_reason: null,
  created_at: '2026-09-20T08:00:00Z',
}

describe('ApprovalRequestsPage', () => {
  beforeEach(() => {
    vi.mocked(approvalsApi.listApprovalRequests)
      .mockReset()
      .mockResolvedValue({ data: [pendingPromotion], meta: { current_page: 1, per_page: 10, total: 1, last_page: 1 } })
    vi.mocked(approvalsApi.rejectApprovalRequest).mockReset().mockResolvedValue({ ...pendingPromotion, status: 'rejected' })
    vi.mocked(usersApi.listUsers)
      .mockReset()
      .mockResolvedValue({
        data: [
          managedUser({ id: 'ps-1', full_name: 'Sitting Principal Secretary', roleName: 'Ministry PS' }),
          managedUser({ id: 'officer-1', full_name: 'Jane Officer' }),
        ],
      })
  })

  it('TC-FR-AUTH-022: a System Administrator must give a reason to reject a pending request', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))

    renderAdminPage('/admin/approvals', '/admin/approvals', <ApprovalRequestsPage />)

    const row = (await screen.findByText('Jane Officer')).closest('tr') as HTMLElement
    expect(within(row).getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'Reject' }))

    // The dialog's own Reject button stays disabled until a reason is entered.
    await screen.findByLabelText('Reason for rejection')
    const dialogReject = screen.getAllByRole('button', { name: 'Reject' }).at(-1) as HTMLElement
    expect(dialogReject).toBeDisabled()

    await user.type(screen.getByLabelText('Reason for rejection'), 'Not the nominated candidate.')
    await user.click(dialogReject)

    expect(approvalsApi.rejectApprovalRequest).toHaveBeenCalledWith('request-1', 'Not the nominated candidate.')
    expect(screen.queryByTestId('ps-request-form')).not.toBeInTheDocument()
  })

  it('TC-FR-AUTH-023: a Ministry Administrator requests a succession naming the sitting PS', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(meAs('Ministry Administrator'))
    vi.mocked(approvalsApi.requestPsSuccession).mockResolvedValue({ ...pendingPromotion, type: 'ps_succession' })

    renderAdminPage('/admin/approvals', '/admin/approvals', <ApprovalRequestsPage />)

    const form = await screen.findByTestId('ps-request-form')
    const row = (await screen.findByText('Jane Officer', { selector: 'td' })).closest('tr') as HTMLElement
    expect(within(row).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Cancel request' })).toBeInTheDocument()

    await user.selectOptions(within(form).getByLabelText('Request type'), 'ps_succession')
    expect(await within(form).findByDisplayValue('Sitting Principal Secretary')).toBeInTheDocument()
    await user.selectOptions(within(form).getByLabelText('Department account'), 'officer-1')
    await user.click(within(form).getByRole('button', { name: 'Submit for approval' }))

    expect(approvalsApi.requestPsSuccession).toHaveBeenCalledWith({ outgoing_user_id: 'ps-1', incoming_user_id: 'officer-1' })
    expect(await within(form).findByText('Request submitted for approval.')).toBeInTheDocument()
  })
})
