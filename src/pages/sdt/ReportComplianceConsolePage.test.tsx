import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import ReportComplianceConsolePage from './ReportComplianceConsolePage'
import * as sdtApi from '../../api/sdt'
import * as useAuthModule from '../../hooks/useAuth'
import { authAs, renderRoute } from '../reports/reportTestUtils'
import { COMPLIANCE_BOARD } from '../reports/complianceFixtures'

vi.mock('../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sdt')>()
  return { ...actual, getSdtReportCompliance: vi.fn() }
})

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

describe('ReportComplianceConsolePage', () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(authAs('Ministry PS'))
    vi.mocked(sdtApi.getSdtReportCompliance).mockReset().mockResolvedValue(COMPLIANCE_BOARD)
  })

  it('TC-FR-SDT-001-RPT: gives the PS console the compliance board from the SDT endpoint', async () => {
    renderRoute('/sdt/reports/compliance', '/sdt/reports/compliance', <ReportComplianceConsolePage />)

    expect(await screen.findByRole('heading', { name: 'Report Compliance Console', level: 1 })).toBeInTheDocument()
    expect(sdtApi.getSdtReportCompliance).toHaveBeenCalledWith(undefined)
    expect(screen.getAllByTestId(/^compliance-row-/)).toHaveLength(4)
    expect(within(screen.getByTestId('compliance-row-m-berlin')).getByRole('link', { name: 'Open the Berlin report' })).toHaveAttribute(
      'href',
      '/reports/report-berlin',
    )
  })

  it('tints a late submission amber and a still-missing overdue report red (Rule 10: late is at-risk, not the brand accent)', async () => {
    renderRoute('/sdt/reports/compliance', '/sdt/reports/compliance', <ReportComplianceConsolePage />)

    expect(await screen.findByTestId('compliance-row-m-accra')).toHaveClass('bg-atrisk-soft/40')
    expect(screen.getByTestId('compliance-row-m-lusaka')).toHaveClass('bg-danger-soft/40')
    expect(screen.getByTestId('compliance-row-m-berlin')).toHaveClass('bg-white')
  })
})
