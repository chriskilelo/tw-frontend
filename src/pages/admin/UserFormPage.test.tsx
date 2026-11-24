import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import UserFormPage from './UserFormPage'
import * as authApi from '../../api/auth'
import * as usersApi from '../../api/users'
import * as missionsApi from '../../api/missions'
import * as ministriesApi from '../../api/ministries'
import { managedUser, meAs, renderAdminPage } from './adminTestUtils'

vi.mock('../../api/auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/auth')>()), me: vi.fn() }))
vi.mock('../../api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/users')>()),
  listRoles: vi.fn(),
  createUser: vi.fn(),
  getUser: vi.fn(),
  deactivateUser: vi.fn(),
  reactivateUser: vi.fn(),
}))
vi.mock('../../api/missions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/missions')>()),
  listMissions: vi.fn(),
}))
vi.mock('../../api/ministries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/ministries')>()),
  listDepartments: vi.fn(),
}))

describe('UserFormPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue(meAs('Ministry Administrator'))
    vi.mocked(usersApi.listRoles).mockReset().mockResolvedValue([
      { id: 'role-attache', name: 'Ministry Attache', layer: '2', scope: 'mission', display_title: null },
      { id: 'role-officer', name: 'Ministry HQ Officer', layer: '2', scope: 'ministry', display_title: null },
    ])
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([{ id: 'mission-1', name: 'London', city: 'London', active: true }])
    vi.mocked(usersApi.createUser).mockReset()
  })

  it('TC-FR-AUTH-021: a Ministry Administrator gets no department field and a PS-approval hint; mission roles ask for a mission', async () => {
    const user = userEvent.setup()
    renderAdminPage('/admin/users/new', '/admin/users/new', <UserFormPage />)

    expect(await screen.findByText(/appointed through a PS approval request/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Mission')).not.toBeInTheDocument()

    await screen.findByRole('option', { name: 'Ministry Attache' })
    await user.selectOptions(screen.getByLabelText('Role'), 'role-attache')
    expect(screen.getByLabelText('Mission')).toBeInTheDocument()
  })

  it('TC-FR-AUTH-021-B: shows the backend’s rule violation when a save is refused', async () => {
    const user = userEvent.setup()
    vi.mocked(usersApi.createUser).mockRejectedValue(
      new AxiosError('Unprocessable', '422', undefined, undefined, {
        status: 422,
        statusText: 'Unprocessable',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { data: null, errors: ['A Ministry Administrator cannot assign this role.'] },
      }),
    )

    renderAdminPage('/admin/users/new', '/admin/users/new', <UserFormPage />)
    await screen.findByRole('option', { name: 'Ministry HQ Officer' })

    await user.type(screen.getByLabelText('Full name'), 'New Officer')
    await user.type(screen.getByLabelText('Email'), 'new.officer@sdt.go.ke')
    await user.selectOptions(screen.getByLabelText('Role'), 'role-officer')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A Ministry Administrator cannot assign this role.')
    expect(usersApi.createUser).toHaveBeenCalledWith(expect.objectContaining({ role_id: 'role-officer', mission_id: null }))
    expect(vi.mocked(usersApi.createUser).mock.calls[0][0]).not.toHaveProperty('ministry_id')
  })

  it('TC-FR-AUTH-001-D: no Department field for the Head or Deputy Head of Mission, whose accounts belong to no department', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))
    vi.mocked(usersApi.listRoles).mockResolvedValue([
      { id: 'role-hom', name: 'Head of Mission', layer: '1', scope: 'mission', display_title: null },
      { id: 'role-dhom', name: 'Deputy Head of Mission', layer: '1', scope: 'mission', display_title: null },
      { id: 'role-attache', name: 'Ministry Attache', layer: '2', scope: 'mission', display_title: null },
    ])
    vi.mocked(ministriesApi.listDepartments).mockResolvedValue([{ id: 'ministry-1', name: 'State Department for Trade', active: true }])

    renderAdminPage('/admin/users/new', '/admin/users/new', <UserFormPage />)
    await screen.findByRole('option', { name: 'Head of Mission' })

    for (const roleId of ['role-hom', 'role-dhom']) {
      await user.selectOptions(screen.getByLabelText('Role'), roleId)
      expect(screen.getByLabelText('Mission')).toBeInTheDocument()
      expect(screen.queryByLabelText('Department')).not.toBeInTheDocument()
    }

    await user.selectOptions(screen.getByLabelText('Role'), 'role-attache')
    expect(screen.getByLabelText('Department')).toBeInTheDocument()
  })

  describe('account status (ISS-021)', () => {
    function editPage() {
      return renderAdminPage('/admin/users/user-1', '/admin/users/:id', <UserFormPage />)
    }

    it('TC-FR-AUTH-005-B: reactivates a deactivated account from its page, keeping unsaved edits', async () => {
      const user = userEvent.setup()
      vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))
      const deactivated = managedUser({ status: 'deactivated', last_login_at: null })
      vi.mocked(usersApi.getUser).mockReset().mockResolvedValueOnce(deactivated).mockResolvedValue({ ...deactivated, status: 'active' })
      vi.mocked(usersApi.reactivateUser).mockReset().mockResolvedValue({ ...deactivated, status: 'active' })

      editPage()
      const card = await screen.findByTestId('account-status')
      expect(within(card).getByText('Deactivated')).toBeInTheDocument()
      expect(card).toHaveTextContent('Cannot sign in. Reactivating restores access with the same password.')
      expect(card).toHaveTextContent('Never signed in')

      const fullName = screen.getByLabelText('Full name')
      await user.clear(fullName)
      await user.type(fullName, 'Jane Renamed')
      await user.click(within(card).getByRole('button', { name: 'Reactivate' }))

      expect(await within(card).findByRole('status')).toHaveTextContent('Jane Officer can sign in again.')
      expect(within(card).getByText('Active')).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
      expect(usersApi.reactivateUser).toHaveBeenCalledWith('user-1')
      expect(screen.getByLabelText('Full name')).toHaveValue('Jane Renamed')
    })

    it('TC-FR-AUTH-009-D: a locked account explains how to unlock it and offers Deactivate', async () => {
      vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))
      vi.mocked(usersApi.getUser).mockReset().mockResolvedValue(managedUser({ status: 'locked', last_login_at: '2026-11-03T11:20:00Z' }))

      editPage()
      const card = await screen.findByTestId('account-status')
      expect(within(card).getByText('Locked')).toBeInTheDocument()
      expect(card).toHaveTextContent('deactivate the account and then reactivate it')
      expect(card).toHaveTextContent(/Last signed in .*2026/)
      expect(within(card).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    })

    it('TC-FR-AUTH-004-D: a System Administrator’s own account explains why it cannot be deactivated', async () => {
      vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))
      vi.mocked(usersApi.getUser).mockReset().mockResolvedValue(managedUser({ id: 'admin-1', full_name: 'Admin Person', roleName: 'System Administrator' }))

      renderAdminPage('/admin/users/admin-1', '/admin/users/:id', <UserFormPage />)
      const card = await screen.findByTestId('account-status')

      expect(card).toHaveTextContent('This is your own account, so you cannot deactivate it.')
      expect(within(card).queryByRole('button')).not.toBeInTheDocument()
    })

    it('TC-FR-AUTH-021-O: a Ministry Administrator is sent to PS approvals for a Principal Secretary', async () => {
      vi.mocked(usersApi.getUser).mockReset().mockResolvedValue(managedUser({ full_name: 'Dr. Principal', roleName: 'Ministry PS' }))

      editPage()
      const card = await screen.findByTestId('account-status')

      expect(card).toHaveTextContent('A Principal Secretary is deactivated or reinstated through a PS approval request.')
      expect(within(card).getByRole('link', { name: 'Open PS approvals' })).toHaveAttribute('href', '/admin/approvals')
      expect(within(card).queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
