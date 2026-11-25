import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import AlertFieldsConfigPage from './AlertFieldsConfigPage'
import * as sdtApi from '../../../api/sdt'
import * as useAuthModule from '../../../hooks/useAuth'
import { authAs, renderRoute } from '../../reports/reportTestUtils'

vi.mock('../../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/sdt')>()
  return { ...actual, getAlertFieldSettings: vi.fn(), createAlertFieldSetting: vi.fn(), updateAlertFieldSetting: vi.fn() }
})
vi.mock('../../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

describe('AlertFieldsConfigPage', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry Administrator'))
    vi.mocked(sdtApi.getAlertFieldSettings).mockReset().mockResolvedValue([
      { id: 'opt-1', ministry_id: 'ministry-1', category: 'alert_intelligence_type', value: 'opportunities', display_order: 1, active: true },
      { id: 'opt-2', ministry_id: 'ministry-1', category: 'alert_intelligence_type', value: 'trade_barriers', display_order: 2, active: true },
    ])
  })

  it('TC-FR-SDT-019-B: names each intelligence type, with its stored value as a note (ISS-027)', async () => {
    renderRoute('/sdt/config/alert-fields', '/sdt/config/alert-fields', <AlertFieldsConfigPage />)

    expect(await screen.findByText('Trade Barriers')).toBeInTheDocument()
    expect(screen.getByText('Opportunities')).toBeInTheDocument()
    expect(screen.getByText('Stored as trade_barriers')).toBeInTheDocument()
    expect(screen.queryByText('trade_barriers', { exact: true })).not.toBeInTheDocument()
  })
})
