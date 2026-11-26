import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadershipSwitchesPage from './LeadershipSwitchesPage'
import * as authApi from '../../api/auth'
import * as ministriesApi from '../../api/ministries'
import * as sdtApi from '../../api/sdt'
import { httpError } from '../../test/httpErrors'
import { meAs, renderAdminPage } from './adminTestUtils'

vi.mock('../../api/auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/auth')>()), me: vi.fn() }))
vi.mock('../../api/ministries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/ministries')>()),
  listDepartments: vi.fn(),
}))
vi.mock('../../api/sdt', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/sdt')>()),
  getLeadershipSwitches: vi.fn(),
  activateActingPs: vi.fn(),
  deactivateActingPs: vi.fn(),
  activateDesignatedDeputy: vi.fn(),
  deactivateDesignatedDeputy: vi.fn(),
}))

const CAROL = { id: 'u-carol', full_name: 'Carol Officer', role: { name: 'Ministry HQ Officer' } }
const FRANK = { id: 'u-frank', full_name: 'Frank Director', role: { name: 'Ministry HQ Director' } }

function switches(overrides: Partial<sdtApi.LeadershipSwitches> = {}): sdtApi.LeadershipSwitches {
  return {
    ministry: { id: 'ministry-1', name: 'State Department for Trade' },
    acting_ps: { active: false, holder: null, can_manage: true, candidates: [CAROL, FRANK] },
    designated_deputy: { active: false, holder: null, can_manage: true, candidates: [CAROL] },
    ...overrides,
  }
}

function renderPage() {
  return renderAdminPage('/admin/leadership', '/admin/leadership', <LeadershipSwitchesPage />)
}

describe('LeadershipSwitchesPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockReset().mockResolvedValue(meAs('Ministry Administrator'))
    vi.mocked(sdtApi.getLeadershipSwitches).mockReset().mockResolvedValue(switches())
    vi.mocked(sdtApi.activateActingPs).mockReset().mockResolvedValue({ ministry_id: 'ministry-1', acting_ps_user_id: 'u-frank', active: true })
    vi.mocked(sdtApi.deactivateActingPs).mockReset().mockResolvedValue({ ministry_id: 'ministry-1', active: false })
    vi.mocked(sdtApi.activateDesignatedDeputy).mockReset().mockResolvedValue({ ministry_id: 'ministry-1', designated_deputy_user_id: 'u-carol', active: true })
    vi.mocked(sdtApi.deactivateDesignatedDeputy).mockReset().mockResolvedValue({ ministry_id: 'ministry-1', active: false })
    vi.mocked(ministriesApi.listDepartments).mockReset().mockResolvedValue([
      { id: 'ministry-1', name: 'State Department for Trade', active: true },
      { id: 'ministry-2', name: 'State Department for Mining', active: true },
    ])
  })

  it('TC-FR-SDT-003-K: shows both switches off with only the eligible people each may go to (K-02, K-08)', async () => {
    renderPage()

    const actingPs = await screen.findByRole('region', { name: 'Acting Principal Secretary' })
    expect(within(actingPs).getByText('Off')).toBeInTheDocument()
    expect(within(actingPs).getByText('No Acting PS. The PS is in charge.')).toBeInTheDocument()
    expect(within(actingPs).getAllByRole('radio')).toHaveLength(2)
    expect(within(actingPs).queryByRole('button', { name: /End/ })).not.toBeInTheDocument()

    const deputy = screen.getByRole('region', { name: 'Designated Deputy' })
    expect(within(deputy).getByText('No Designated Deputy. New alerts go to the PS.')).toBeInTheDocument()
    expect(within(deputy).getAllByRole('radio')).toHaveLength(1)
    expect(within(deputy).getByRole('radio', { name: /Carol Officer/ })).toBeInTheDocument()
    expect(within(deputy).getByText('Ministry HQ Officer')).toBeInTheDocument()
    expect(sdtApi.getLeadershipSwitches).toHaveBeenCalledWith(undefined)
  })

  it('TC-FR-SDT-003-L: switches the deputy on for the chosen person', async () => {
    const user = userEvent.setup()
    renderPage()

    const deputy = await screen.findByRole('region', { name: 'Designated Deputy' })
    const activate = within(deputy).getByRole('button', { name: 'Make Designated Deputy' })
    expect(activate).toBeDisabled()

    await user.click(within(deputy).getByRole('radio', { name: /Carol Officer/ }))
    await user.click(within(deputy).getByRole('button', { name: 'Make Carol Officer the Designated Deputy' }))

    expect(sdtApi.activateDesignatedDeputy).toHaveBeenCalledWith('u-carol')
    expect(await within(deputy).findByText('Carol Officer now receives new alerts.')).toBeInTheDocument()
  })

  it('TC-FR-SDT-003-M: names the holder of a switch that is on, and offers only to end it (K-08)', async () => {
    vi.mocked(sdtApi.getLeadershipSwitches).mockResolvedValue(
      switches({
        designated_deputy: {
          active: true,
          holder: { ...CAROL, status: 'active', since: '2026-11-03T09:00:00+00:00' },
          can_manage: true,
          candidates: [CAROL],
        },
      }),
    )
    const user = userEvent.setup()
    renderPage()

    const deputy = await screen.findByRole('region', { name: 'Designated Deputy' })
    expect(within(deputy).getByText('On')).toBeInTheDocument()
    expect(within(deputy).getByTestId('designated_deputy-holder')).toHaveTextContent('Carol Officer')
    expect(within(deputy).getByText('Ministry HQ Officer · Receiving new alerts since 3 Nov 2026')).toBeInTheDocument()
    expect(within(deputy).queryByRole('radio')).not.toBeInTheDocument()

    await user.click(within(deputy).getByRole('button', { name: 'End Carol Officer’s turn as deputy' }))

    expect(sdtApi.deactivateDesignatedDeputy).toHaveBeenCalledWith(undefined)
    expect(await within(deputy).findByText('The Designated Deputy is off. New alerts go to the PS again.')).toBeInTheDocument()
  })

  it('TC-FR-SDT-003-N: warns when the holder\'s account is no longer active', async () => {
    vi.mocked(sdtApi.getLeadershipSwitches).mockResolvedValue(
      switches({
        designated_deputy: {
          active: true,
          holder: { ...CAROL, status: 'deactivated', since: null },
          can_manage: true,
          candidates: [],
        },
      }),
    )
    renderPage()

    const deputy = await screen.findByRole('region', { name: 'Designated Deputy' })
    expect(within(deputy).getByRole('note')).toHaveTextContent('This account is no longer active')
  })

  it('TC-FR-SDT-004-N: explains when nobody can act for the PS', async () => {
    vi.mocked(sdtApi.getLeadershipSwitches).mockResolvedValue(
      switches({ acting_ps: { active: false, holder: null, can_manage: true, candidates: [] } }),
    )
    renderPage()

    const actingPs = await screen.findByRole('region', { name: 'Acting Principal Secretary' })
    expect(within(actingPs).getByText(/Nobody in the department can act for the PS yet/)).toBeInTheDocument()
    expect(within(actingPs).getByRole('button', { name: 'Make Acting PS' })).toBeDisabled()
  })

  it('TC-FR-SDT-004-O: makes a System Administrator choose the department, and sends it with each switch', async () => {
    vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))
    vi.mocked(sdtApi.getLeadershipSwitches).mockResolvedValue(
      switches({
        acting_ps: { active: true, holder: { ...FRANK, status: 'active', since: null }, can_manage: true, candidates: [CAROL, FRANK] },
      }),
    )
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Choose a department to see its switches.')).toBeInTheDocument()
    expect(sdtApi.getLeadershipSwitches).not.toHaveBeenCalled()

    await user.selectOptions(await screen.findByLabelText('Department'), 'ministry-2')
    const actingPs = await screen.findByRole('region', { name: 'Acting Principal Secretary' })
    expect(sdtApi.getLeadershipSwitches).toHaveBeenCalledWith('ministry-2')

    await user.click(within(actingPs).getByRole('button', { name: 'End Frank Director’s assignment' }))
    expect(sdtApi.deactivateActingPs).toHaveBeenCalledWith('ministry-2')
  })

  it('TC-FR-SDT-004-P: says so when the switches cannot be loaded', async () => {
    vi.mocked(sdtApi.getLeadershipSwitches).mockRejectedValue(httpError(500, ['Server error.']))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
