import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
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
})
