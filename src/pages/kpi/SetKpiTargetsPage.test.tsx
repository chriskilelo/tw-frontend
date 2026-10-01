import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import SetKpiTargetsPage from './SetKpiTargetsPage'
import * as kpiApi from '../../api/kpi'
import { renderRoute } from '../reports/reportTestUtils'
import { targetCell, targetPlan } from './kpiFixtures'

vi.mock('../../api/kpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/kpi')>()
  return { ...actual, getKpiTargetPlan: vi.fn(), saveKpiTargets: vi.fn(), getKpiTargetHistory: vi.fn() }
})

function renderPage(path = '/kpi/targets') {
  return renderRoute(path, '/kpi/targets', <SetKpiTargetsPage />)
}

function httpError(status: number, errors: string[] = []): AxiosError {
  return new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: { data: null, errors },
    headers: {},
    config: { headers: new AxiosHeaders() },
  })
}

describe('SetKpiTargetsPage', () => {
  beforeEach(() => {
    vi.mocked(kpiApi.getKpiTargetPlan).mockReset().mockResolvedValue(targetPlan())
    vi.mocked(kpiApi.saveKpiTargets).mockReset()
    vi.mocked(kpiApi.getKpiTargetHistory).mockReset()
  })

  it('TC-FR-KPI-005-UI: lays out each mission’s target for the KPI with last cycle’s result alongside', async () => {
    renderPage()

    const london = await screen.findByTestId('kpi-target-row-mission-london')
    expect(within(london).getByLabelText('Target for London, Agreements signed')).toHaveValue(6)
    expect(within(london).getByText('Mission target')).toBeInTheDocument()
    expect(within(london).getByText('5 of 4')).toBeInTheDocument()
    expect(within(london).getByRole('button', { name: 'Target history for London' })).toHaveTextContent('2 versions')

    const dubai = screen.getByTestId('kpi-target-row-mission-dubai')
    expect(within(dubai).getByLabelText('Target for Dubai, Agreements signed')).toHaveValue(null)
    expect(within(dubai).getByText('Not set')).toBeInTheDocument()
    expect(within(dubai).getByText('No attache posted')).toBeInTheDocument()

    expect(screen.getByText('1 of 4 targets set')).toBeInTheDocument()
    expect(screen.getByText('3 still to set.')).toBeInTheDocument()
  })

  it('TC-FR-KPI-004-UI: saves only the changed targets, with an optional reason, as one batch', async () => {
    vi.mocked(kpiApi.saveKpiTargets).mockResolvedValue({ saved: 2, unchanged: 0, plan: targetPlan({ summary: { required: 4, set: 2, missing: 2, overrides: 2, from_profile: 0, missions_complete: 0 } }) })
    renderPage()
    await screen.findByTestId('kpi-target-row-mission-london')

    const london = screen.getByLabelText('Target for London, Agreements signed')
    await userEvent.clear(london)
    await userEvent.type(london, '8')
    await userEvent.type(screen.getByLabelText('Target for Dubai, Agreements signed'), '3')
    expect(screen.getByText('2 changes')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-target-row-mission-london')).getByText('+100% vs last cycle (4)')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Reason for the change (optional)'), 'Trade fair season')
    await userEvent.click(screen.getByTestId('kpi-targets-save'))

    await waitFor(() =>
      expect(kpiApi.saveKpiTargets).toHaveBeenCalledWith({
        performance_cycle_label: 'H1 2026',
        note: 'Trade fair season',
        targets: [
          { kpi_definition_id: 'kpi-agreements', mission_id: 'mission-london', target_value: 8 },
          { kpi_definition_id: 'kpi-agreements', mission_id: 'mission-dubai', target_value: 3 },
        ],
      }),
    )
    expect(await screen.findByTestId('kpi-targets-saved')).toHaveTextContent('2 targets saved. The dashboard and comparison now use them.')
    expect(screen.queryByTestId('kpi-targets-save')).not.toBeInTheDocument()
  })

  it('validates each target before it can be saved', async () => {
    renderPage()
    await screen.findByTestId('kpi-target-row-mission-dubai')

    await userEvent.type(screen.getByLabelText('Target for Dubai, Agreements signed'), '0')
    expect(screen.getByText('A target must be more than zero.')).toBeInTheDocument()
    expect(screen.getByText('1 value to fix')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-targets-save')).toBeDisabled()
  })

  it('does not count retyping the current target as a change', async () => {
    renderPage()
    await screen.findByTestId('kpi-target-row-mission-london')

    const london = screen.getByLabelText('Target for London, Agreements signed')
    await userEvent.clear(london)
    await userEvent.type(london, '6')
    expect(screen.queryByTestId('kpi-targets-save')).not.toBeInTheDocument()
  })

  it('fills missions without a target, or copies last cycle’s targets, as unsaved changes', async () => {
    renderPage('/kpi/targets?kpi=kpi-alerts')
    await screen.findByTestId('kpi-target-row-mission-london')

    await userEvent.click(screen.getByRole('button', { name: 'Copy targets from H2 2026' }))
    expect(screen.getByLabelText('Target for London, Alerts submitted')).toHaveValue(10)
    expect(screen.getByLabelText('Target for Dubai, Alerts submitted')).toHaveValue(4)

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await userEvent.type(screen.getByLabelText('Value'), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Fill missions without a target' }))
    expect(screen.getByLabelText('Target for London, Alerts submitted')).toHaveValue(7)
    expect(screen.getByText('2 changes')).toBeInTheDocument()
  })

  it('TC-FR-KPI-004-C: shows an ended cycle read-only', async () => {
    vi.mocked(kpiApi.getKpiTargetPlan).mockResolvedValue(
      targetPlan({ cycle: { label: 'H2 2026', type: 'half', start: '2026-01-01', end: '2026-06-30', phase: 'complete', editable: false, reason: 'ended' } }),
    )
    renderPage('/kpi/targets?cycle=H2+2026')

    expect(await screen.findByTestId('kpi-cycle-locked')).toHaveTextContent('H2 2026 has ended.')
    expect(screen.queryByLabelText('Target for London, Agreements signed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fill missions without a target' })).not.toBeInTheDocument()
  })

  it('asks before switching cycle with unsaved changes', async () => {
    renderPage()
    await screen.findByTestId('kpi-target-row-mission-dubai')
    await userEvent.type(screen.getByLabelText('Target for Dubai, Agreements signed'), '3')

    await userEvent.click(screen.getByRole('radio', { name: /H2 2027/ }))
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument()
    expect(kpiApi.getKpiTargetPlan).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Discard and switch' }))
    await waitFor(() => expect(kpiApi.getKpiTargetPlan).toHaveBeenLastCalledWith('H2 2027'))
    expect(screen.getByTestId('location')).toHaveTextContent('cycle=H2+2027')
  })

  it('TC-FR-KPI-003-UI: sets a KPI profile’s default, which its missions follow unless they have their own', async () => {
    vi.mocked(kpiApi.saveKpiTargets).mockResolvedValue({ saved: 1, unchanged: 0, plan: targetPlan() })
    const plan = targetPlan({
      profiles: [{ id: 'profile-high', name: 'High-Volume Mission', kpi_ids: ['kpi-agreements'], mission_ids: ['mission-london', 'mission-dubai'], defaults: {} }],
    })
    plan.missions[1].targets['kpi-agreements'] = targetCell({ value: 10, source: 'profile', profile_default: { value: 10, profile: { id: 'profile-high', name: 'High-Volume Mission' } } })
    vi.mocked(kpiApi.getKpiTargetPlan).mockResolvedValue(plan)
    renderPage()

    const dubai = await screen.findByTestId('kpi-target-row-mission-dubai')
    expect(within(dubai).getByText('Profile default')).toBeInTheDocument()
    expect(within(dubai).getByText('Follows the profile default (10). Enter a value to override it.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /Profile defaults/ }))
    await userEvent.type(screen.getByLabelText('Default target for the High-Volume Mission profile, Agreements signed'), '12')
    await userEvent.click(screen.getByTestId('kpi-targets-save'))

    await waitFor(() =>
      expect(kpiApi.saveKpiTargets).toHaveBeenCalledWith({
        performance_cycle_label: 'H1 2026',
        note: undefined,
        targets: [{ kpi_definition_id: 'kpi-agreements', kpi_profile_id: 'profile-high', target_value: 12 }],
      }),
    )
  })

  it('explains profile defaults when no profile exists yet', async () => {
    renderPage('/kpi/targets?mode=profiles')

    expect(await screen.findByText('No KPI profiles yet')).toBeInTheDocument()
  })

  it('marks a mission that does not track the KPI under its profile', async () => {
    const plan = targetPlan()
    plan.missions[1].profiles = [{ id: 'profile-std', name: 'Standard' }]
    plan.missions[1].targets['kpi-agreements'] = targetCell({ applicable: false })
    vi.mocked(kpiApi.getKpiTargetPlan).mockResolvedValue(plan)
    renderPage()

    expect(await screen.findByText('Not tracked: not in the Standard profile.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Target for Dubai, Agreements signed')).not.toBeInTheDocument()
  })

  it('TC-FR-KPI-004-D: shows every version of a target, marking the one in force', async () => {
    vi.mocked(kpiApi.getKpiTargetHistory).mockResolvedValue([
      { id: 'v2', cycle_label: 'H1 2026', cycle_start_date: '2026-07-01', value: 6, note: 'Mid-cycle revision', set_by: { id: 'u', full_name: 'Director One' }, set_at: '2026-08-01T09:00:00Z', in_force: true },
      { id: 'v1', cycle_label: 'H1 2026', cycle_start_date: '2026-07-01', value: 5, note: null, set_by: { id: 'u', full_name: 'Director One' }, set_at: '2026-07-02T09:00:00Z', in_force: false },
    ])
    renderPage()
    await screen.findByTestId('kpi-target-row-mission-london')

    await userEvent.click(screen.getByRole('button', { name: 'Target history for London' }))

    const history = await screen.findByTestId('kpi-target-history')
    expect(kpiApi.getKpiTargetHistory).toHaveBeenCalledWith({ kpi_definition_id: 'kpi-agreements', mission_id: 'mission-london', kpi_profile_id: undefined })
    expect(within(history).getByText('In force')).toBeInTheDocument()
    expect(within(history).getByText('Superseded')).toBeInTheDocument()
    expect(within(history).getByText('“Mid-cycle revision”')).toBeInTheDocument()
  })

  it('shows the server’s reason when a save is refused, keeping the changes', async () => {
    vi.mocked(kpiApi.saveKpiTargets).mockRejectedValue(httpError(422, ['H1 2026 has ended; its targets are kept as the historical record and can no longer be changed.']))
    renderPage()
    await screen.findByTestId('kpi-target-row-mission-dubai')

    await userEvent.type(screen.getByLabelText('Target for Dubai, Agreements signed'), '3')
    await userEvent.click(screen.getByTestId('kpi-targets-save'))

    expect(await screen.findByRole('alert')).toHaveTextContent('can no longer be changed')
    expect(screen.getByLabelText('Target for Dubai, Agreements signed')).toHaveValue(3)
  })

  it('explains when the role may not set targets', async () => {
    vi.mocked(kpiApi.getKpiTargetPlan).mockRejectedValue(httpError(403))
    renderPage()

    expect(await screen.findByText('Setting targets isn’t available to your role')).toBeInTheDocument()
  })
})
