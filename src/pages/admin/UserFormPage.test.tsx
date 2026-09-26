import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import UserFormPage from './UserFormPage'
import * as authApi from '../../api/auth'
import * as usersApi from '../../api/users'
import * as missionsApi from '../../api/missions'
import { meAs, renderAdminPage } from './adminTestUtils'

vi.mock('../../api/auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/auth')>()), me: vi.fn() }))
vi.mock('../../api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/users')>()),
  listRoles: vi.fn(),
  createUser: vi.fn(),
  getUser: vi.fn(),
}))
vi.mock('../../api/missions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/missions')>()),
  listMissions: vi.fn(),
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
})
