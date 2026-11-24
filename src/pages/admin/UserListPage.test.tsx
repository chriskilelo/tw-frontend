import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import UserListPage from './UserListPage'
import * as authApi from '../../api/auth'
import * as usersApi from '../../api/users'
import * as ministriesApi from '../../api/ministries'
import { managedUser, meAs, renderAdminPage } from './adminTestUtils'

vi.mock('../../api/auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/auth')>()), me: vi.fn() }))
vi.mock('../../api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/users')>()),
  listUsers: vi.fn(),
  deactivateUser: vi.fn(),
  reactivateUser: vi.fn(),
}))
vi.mock('../../api/ministries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/ministries')>()),
  listDepartments: vi.fn(),
}))

const accounts = [
  managedUser({ id: 'officer-1', full_name: 'Jane Officer' }),
  managedUser({ id: 'admin-2', full_name: 'Fellow Administrator', roleName: 'Ministry Administrator' }),
]

describe('UserListPage', () => {
  beforeEach(() => {
    vi.mocked(usersApi.listUsers).mockReset().mockResolvedValue({ data: accounts, meta: { current_page: 1, per_page: 10, total: 2, last_page: 1 } })
    vi.mocked(ministriesApi.listDepartments).mockReset().mockResolvedValue([{ id: 'ministry-1', name: 'State Department for Trade', active: true }])
  })

  it('TC-FR-AUTH-021: a Ministry Administrator sees its own department, without department filter or admin-row actions', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meAs('Ministry Administrator'))

    renderAdminPage('/admin/users', '/admin/users', <UserListPage />)

    expect(await screen.findByText('Accounts in State Department for Trade')).toBeInTheDocument()
    const officerRow = (await screen.findByText('Jane Officer')).closest('tr') as HTMLElement
    expect(within(officerRow).getByRole('button', { name: 'Edit' })).toBeInTheDocument()

    const adminRow = screen.getByText('Fellow Administrator').closest('tr') as HTMLElement
    expect(within(adminRow).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument()
    expect(ministriesApi.listDepartments).not.toHaveBeenCalled()
  })

  it('TC-FR-AUTH-021-B: a System Administrator can filter by department', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))

    renderAdminPage('/admin/users', '/admin/users', <UserListPage />)

    expect(await screen.findByText('Accounts across every department')).toBeInTheDocument()
    expect(await screen.findByLabelText('Department')).toBeInTheDocument()
    const adminRow = (await screen.findByText('Fellow Administrator')).closest('tr') as HTMLElement
    expect(within(adminRow).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('TC-FR-AUTH-005-C: a deactivated account stays listed and can be reactivated', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))
    const deactivated = managedUser({ id: 'officer-2', full_name: 'Paul Former', status: 'deactivated' })
    vi.mocked(usersApi.listUsers).mockResolvedValue({ data: [deactivated], meta: { current_page: 1, per_page: 10, total: 1, last_page: 1 } })
    vi.mocked(usersApi.reactivateUser).mockReset().mockResolvedValue({ ...deactivated, status: 'active' })

    renderAdminPage('/admin/users', '/admin/users', <UserListPage />)

    const row = (await screen.findByText('Paul Former')).closest('tr') as HTMLElement
    expect(within(row).getByText('Deactivated')).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'Reactivate' }))

    expect(usersApi.reactivateUser).toHaveBeenCalledWith('officer-2')
    expect(await screen.findByRole('status')).toHaveTextContent('Paul Former can sign in again.')
  })

  it('TC-FR-AUTH-004-C: deactivating asks first, confirms the result, and shows a refusal in the API’s words', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))
    vi.mocked(usersApi.deactivateUser)
      .mockReset()
      .mockResolvedValueOnce(managedUser({ id: 'officer-1', full_name: 'Jane Officer', status: 'deactivated' }))
      .mockRejectedValueOnce(
        new AxiosError('Unprocessable', '422', undefined, undefined, {
          status: 422,
          statusText: 'Unprocessable',
          headers: {},
          config: { headers: new AxiosHeaders() },
          data: { data: null, errors: ['The platform must keep at least one active System Administrator.'] },
        }),
      )

    renderAdminPage('/admin/users', '/admin/users', <UserListPage />)
    const row = (await screen.findByText('Jane Officer')).closest('tr') as HTMLElement

    await user.click(within(row).getByRole('button', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Deactivate Jane Officer? They will be signed out and unable to sign in.')
    expect(usersApi.deactivateUser).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Jane Officer has been deactivated and signed out.')
    expect(usersApi.deactivateUser).toHaveBeenCalledWith('officer-1')

    await user.click(within(row).getByRole('button', { name: 'Deactivate' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The platform must keep at least one active System Administrator.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('TC-FR-AUTH-021-N: a Ministry Administrator is not offered Deactivate on a Principal Secretary (BR-027)', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meAs('Ministry Administrator'))
    vi.mocked(usersApi.listUsers).mockResolvedValue({
      data: [managedUser({ id: 'ps-1', full_name: 'Dr. Principal', roleName: 'Ministry PS' })],
      meta: { current_page: 1, per_page: 10, total: 1, last_page: 1 },
    })

    renderAdminPage('/admin/users', '/admin/users', <UserListPage />)

    const row = (await screen.findByText('Dr. Principal')).closest('tr') as HTMLElement
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })
})
