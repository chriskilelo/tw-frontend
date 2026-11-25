import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KpiSettingsConfigPage from './KpiSettingsConfigPage'
import * as sdtApi from '../../../api/sdt'
import * as kpiApi from '../../../api/kpi'
import * as missionsApi from '../../../api/missions'
import * as useAuthModule from '../../../hooks/useAuth'
import type { KpiDefinition } from '../../../api/sdt'
import { authAs, renderRoute } from '../../reports/reportTestUtils'
import { httpError } from '../../../test/httpErrors'

vi.mock('../../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/sdt')>()
  return { ...actual, getKpiSettings: vi.fn(), createKpiSetting: vi.fn(), updateKpiSetting: vi.fn() }
})
vi.mock('../../../api/kpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/kpi')>()
  return { ...actual, listKpiProfiles: vi.fn() }
})
vi.mock('../../../api/missions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/missions')>()
  return { ...actual, listMissions: vi.fn() }
})
vi.mock('../../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

function definition(overrides: Partial<KpiDefinition>): KpiDefinition {
  return {
    id: 'kpi-1',
    ministry_id: 'ministry-1',
    name: 'KPI',
    description: null,
    unit: null,
    calculation_method: 'manual',
    data_source: null,
    source: 'recorded',
    reporting_frequency: 'quarterly',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const ALERTS = definition({ id: 'kpi-alerts', name: 'Market intelligence reports', calculation_method: 'auto', data_source: 'alerts.count_submitted', source: 'live' })
const FORUMS = definition({ id: 'kpi-forums', name: 'Trade forums', calculation_method: 'auto', data_source: 'Periodic Report Engine (Section 2 data)' })
const AGREEMENTS = definition({ id: 'kpi-agreements', name: 'Agreements signed' })

/** The definitions table row for a KPI (the profiles panel lists the same names). */
function rowFor(name: string): HTMLElement {
  const row = screen.getAllByRole('row').find((candidate) => within(candidate).queryByText(name) !== null)
  if (!row) {
    throw new Error(`No row for ${name}`)
  }
  return row
}

/** The row being edited: the one holding the Save button. */
function editingRow(): HTMLElement {
  const row = screen.getByRole('button', { name: 'Save' }).closest('tr')
  if (!row) {
    throw new Error('No row is being edited')
  }
  return row
}

describe('KpiSettingsConfigPage', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry Administrator'))
    vi.mocked(sdtApi.getKpiSettings).mockReset().mockResolvedValue([ALERTS, FORUMS, AGREEMENTS])
    vi.mocked(sdtApi.updateKpiSetting).mockReset().mockResolvedValue(AGREEMENTS)
    vi.mocked(kpiApi.listKpiProfiles).mockReset().mockResolvedValue([])
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([])
  })

  it('TC-FR-SDT-021-UI-A: shows each KPI’s method in words and the data it counts (ISS-026)', async () => {
    renderRoute('/sdt/config/kpi-settings', '/sdt/config/kpi-settings', <KpiSettingsConfigPage />)

    await screen.findAllByText('Market intelligence reports')
    const live = rowFor('Market intelligence reports')
    expect(live).toHaveTextContent('Auto')
    expect(live).toHaveTextContent('Intelligence alerts submitted')
    expect(live).toHaveTextContent('Counted live')
    expect(live).toHaveTextContent('Quarterly')

    const forums = rowFor('Trade forums')
    expect(forums).toHaveTextContent('Periodic Report Engine (Section 2 data)')
    expect(forums).toHaveTextContent('Recorded by hand')

    const manual = rowFor('Agreements signed')
    expect(manual).toHaveTextContent('Manual')
    expect(manual).toHaveTextContent('Recorded by hand')
    expect(manual).not.toHaveTextContent('auto')
  })

  it('TC-FR-SDT-021-UI-B: an edit can make a manual KPI count live data', async () => {
    const user = userEvent.setup()
    renderRoute('/sdt/config/kpi-settings', '/sdt/config/kpi-settings', <KpiSettingsConfigPage />)

    await screen.findAllByText('Agreements signed')
    await user.click(within(rowFor('Agreements signed')).getByRole('button', { name: 'Edit' }))
    await user.selectOptions(within(editingRow()).getByRole('combobox', { name: 'Calculation Method' }), 'auto')
    await user.selectOptions(within(editingRow()).getByRole('combobox', { name: 'Data Source' }), 'inquiries.count_disputes_closed')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(sdtApi.updateKpiSetting).toHaveBeenCalledWith('kpi-agreements', {
        name: 'Agreements signed',
        reporting_frequency: 'quarterly',
        calculation_method: 'auto',
        data_source: 'inquiries.count_disputes_closed',
      }),
    )
  })

  it('TC-FR-SDT-021-UI-C: editing a KPI with a described source keeps that description', async () => {
    const user = userEvent.setup()
    renderRoute('/sdt/config/kpi-settings', '/sdt/config/kpi-settings', <KpiSettingsConfigPage />)

    await screen.findAllByText('Trade forums')
    await user.click(within(rowFor('Trade forums')).getByRole('button', { name: 'Edit' }))

    expect(within(editingRow()).getByRole('combobox', { name: 'Data Source' })).toHaveValue('other')
    expect(within(editingRow()).getByRole('textbox', { name: 'Describe the data source' })).toHaveValue('Periodic Report Engine (Section 2 data)')
    expect(within(editingRow()).getByRole('textbox', { name: 'Name' })).toHaveValue('Trade forums')
  })

  it('shows the server’s reason when an edit is refused', async () => {
    vi.mocked(sdtApi.updateKpiSetting).mockRejectedValue(httpError(422, ['The data source field is required when calculation method is auto.']))
    const user = userEvent.setup()
    renderRoute('/sdt/config/kpi-settings', '/sdt/config/kpi-settings', <KpiSettingsConfigPage />)

    await screen.findAllByText('Agreements signed')
    await user.click(within(rowFor('Agreements signed')).getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The data source field is required when calculation method is auto.')
  })
})
