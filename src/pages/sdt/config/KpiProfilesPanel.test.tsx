import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KpiProfilesPanel } from './KpiProfilesPanel'
import * as kpiApi from '../../../api/kpi'
import * as missionsApi from '../../../api/missions'
import type { KpiDefinition } from '../../../api/sdt'
import { renderRoute } from '../../reports/reportTestUtils'

vi.mock('../../../api/kpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/kpi')>()
  return { ...actual, listKpiProfiles: vi.fn(), createKpiProfile: vi.fn(), assignKpiProfile: vi.fn() }
})

vi.mock('../../../api/missions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/missions')>()
  return { ...actual, listMissions: vi.fn() }
})

const MINISTRY = 'ministry-sdt'

function definition(id: string, name: string): KpiDefinition {
  return { id, ministry_id: MINISTRY, name, description: null, unit: null, calculation_method: 'manual', data_source: null, reporting_frequency: 'quarterly', active: true, created_at: '', updated_at: '' }
}

const DEFINITIONS = [definition('kpi-agreements', 'Agreements signed'), definition('kpi-briefs', 'Trade briefs')]

function posting(id: string, name: string) {
  return { id, name, city: name, active: true, mission_ministry_links: [{ ministry_id: MINISTRY, active_attache_user_id: null }] }
}

function renderPanel() {
  return renderRoute('/sdt/config/kpi-settings', '/sdt/config/kpi-settings', <KpiProfilesPanel definitions={DEFINITIONS} ministryId={MINISTRY} />)
}

describe('KpiProfilesPanel', () => {
  beforeEach(() => {
    vi.mocked(kpiApi.listKpiProfiles).mockReset().mockResolvedValue([
      { id: 'profile-std', ministry_id: MINISTRY, name: 'Standard Mission', kpi_definitions: [{ id: 'kpi-briefs', name: 'Trade briefs' }], assigned_missions: [{ id: 'mission-accra', name: 'Accra' }], created_at: '', updated_at: '' },
      { id: 'profile-high', ministry_id: MINISTRY, name: 'High-Volume Mission', kpi_definitions: [{ id: 'kpi-agreements', name: 'Agreements signed' }], assigned_missions: [], created_at: '', updated_at: '' },
    ])
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([posting('mission-accra', 'Accra'), posting('mission-london', 'London')])
    vi.mocked(kpiApi.createKpiProfile).mockReset().mockResolvedValue({} as kpiApi.KpiProfile)
    vi.mocked(kpiApi.assignKpiProfile).mockReset().mockResolvedValue({} as kpiApi.KpiProfile)
  })

  it('TC-FR-KPI-002-UI: lists each profile with its KPIs and missions, and creates a new one', async () => {
    renderPanel()

    const profiles = await screen.findByTestId('kpi-profiles')
    expect(within(profiles).getByText('Standard Mission')).toBeInTheDocument()
    expect(within(profiles).getByText('Accra')).toBeInTheDocument()
    expect(within(profiles).getByText('No missions assigned yet')).toBeInTheDocument()

    const create = screen.getByRole('button', { name: 'Create profile' })
    expect(create).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Profile name/), 'Gateway Mission')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Agreements signed' }))
    await userEvent.click(create)

    await waitFor(() => expect(kpiApi.createKpiProfile).toHaveBeenCalledWith({ ministry_id: MINISTRY, name: 'Gateway Mission', kpi_definition_ids: ['kpi-agreements'] }))
  })

  it('TC-FR-KPI-003-ADMIN: assigns missions to a profile, warning when one moves from another profile', async () => {
    renderPanel()
    await screen.findByTestId('kpi-profiles')

    const highVolume = screen.getByText('High-Volume Mission').closest('li')!
    await userEvent.click(within(highVolume).getByRole('button', { name: 'Assign missions' }))

    expect(await screen.findByText('On the Standard Mission profile')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /Accra/ }))
    expect(screen.getByText('Moves here from the Standard Mission profile')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /London/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save 2 missions' }))

    await waitFor(() => expect(kpiApi.assignKpiProfile).toHaveBeenCalledWith('profile-high', ['mission-accra', 'mission-london']))
  })
})
