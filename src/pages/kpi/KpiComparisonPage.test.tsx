import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import KpiComparisonPage from './KpiComparisonPage'
import * as kpiApi from '../../api/kpi'
import { renderRoute } from '../reports/reportTestUtils'
import { comparisonMatrix } from './kpiFixtures'

vi.mock('../../api/kpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/kpi')>()
  return { ...actual, getKpiComparison: vi.fn(), downloadKpiReport: vi.fn(), saveBlob: vi.fn() }
})

function renderPage(path = '/kpi/comparison') {
  return renderRoute(path, '/kpi/comparison', <KpiComparisonPage />)
}

function rowOrder(): string[] {
  return screen.getAllByTestId(/^kpi-matrix-row-/).map((row) => row.getAttribute('data-testid')!.replace('kpi-matrix-row-', ''))
}

describe('KpiComparisonPage', () => {
  beforeEach(() => {
    vi.mocked(kpiApi.getKpiComparison).mockReset().mockResolvedValue(comparisonMatrix())
    vi.mocked(kpiApi.downloadKpiReport).mockReset().mockResolvedValue()
    vi.mocked(kpiApi.saveBlob).mockReset()
  })

  it('TC-FR-KPI-013-UI: shows every mission against every KPI with a status per cell and the department total', async () => {
    renderPage()

    const accra = await screen.findByTestId('kpi-matrix-row-mission-accra')
    expect(within(accra).getByText('Accra, Agreements signed: 9 of 10 (90%), On Track')).toBeInTheDocument()
    expect(within(accra).getByText('Accra, Trade briefs: 1 of 10 (10%), Below Target')).toBeInTheDocument()

    const cairo = screen.getByTestId('kpi-matrix-row-mission-cairo')
    expect(within(cairo).getByLabelText('Cairo does not track Trade briefs')).toHaveTextContent('N/A')

    expect(screen.getByText('Department total')).toBeInTheDocument()
    expect(screen.getAllByText('2/3 on track').length).toBeGreaterThan(0)
    expect(kpiApi.getKpiComparison).toHaveBeenCalledWith({ period: undefined })
  })

  it('TC-FR-KPI-013-AC1: reorders the missions when a KPI column is chosen, and reverses on a second click', async () => {
    renderPage()
    await screen.findByTestId('kpi-matrix-row-mission-accra')

    // Default: average attainment, highest first; Cairo (no score yet) last.
    expect(rowOrder()).toEqual(['mission-accra', 'mission-berlin', 'mission-cairo'])

    await userEvent.click(screen.getByRole('button', { name: /^Trade briefs/ }))
    expect(rowOrder()).toEqual(['mission-berlin', 'mission-accra', 'mission-cairo'])
    expect(screen.getByTestId('location')).toHaveTextContent('sort=kpi-briefs')
    expect(screen.getByText('Missions ranked by “Trade briefs”.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Trade briefs/ }))
    expect(rowOrder()).toEqual(['mission-accra', 'mission-berlin', 'mission-cairo'])
    expect(screen.getByTestId('location')).toHaveTextContent('dir=asc')
  })

  it('ranks by any KPI from the ranking card', async () => {
    renderPage()
    await screen.findByTestId('kpi-matrix-row-mission-accra')

    await userEvent.selectOptions(screen.getByLabelText('Rank missions by'), 'kpi-agreements')
    expect(rowOrder()).toEqual(['mission-accra', 'mission-cairo', 'mission-berlin'])
    const ranking = screen.getByRole('list', { name: 'Missions ranked by Agreements signed' })
    expect(within(ranking).getAllByRole('listitem')[0]).toHaveTextContent('Accra')
  })

  it('filters missions by name or country', async () => {
    renderPage()
    await screen.findByTestId('kpi-matrix-row-mission-accra')

    await userEvent.type(screen.getByLabelText('Find a mission'), 'germ')
    expect(rowOrder()).toEqual(['mission-berlin'])

    await userEvent.clear(screen.getByLabelText('Find a mission'))
    await userEvent.type(screen.getByLabelText('Find a mission'), 'nowhere')
    expect(screen.getByText('No mission matches your search.')).toBeInTheDocument()
  })

  it('switches the cells between attainment and actual-against-target', async () => {
    renderPage()
    const accra = await screen.findByTestId('kpi-matrix-row-mission-accra')
    const cell = within(accra).getAllByTestId('kpi-cell-kpi-agreements')[0]
    expect(cell).toHaveTextContent('90%')

    await userEvent.click(screen.getByRole('radio', { name: 'Actual vs target' }))
    expect(within(screen.getByTestId('kpi-matrix-row-mission-accra')).getAllByTestId('kpi-cell-kpi-agreements')[0]).toHaveTextContent('9of 10')
    expect(screen.getByTestId('location')).toHaveTextContent('view=values')
  })

  it('TC-FR-KPI-014: exports exactly the missions shown, in their current order', async () => {
    renderPage()
    await screen.findByTestId('kpi-matrix-row-mission-accra')
    await userEvent.click(screen.getByRole('button', { name: /^Trade briefs/ }))

    await userEvent.click(screen.getByRole('button', { name: 'Export view (CSV)' }))

    expect(kpiApi.saveBlob).toHaveBeenCalledTimes(1)
    const [blob, filename] = vi.mocked(kpiApi.saveBlob).mock.calls[0]
    expect(filename).toBe('kpi-comparison-H1-2026.csv')
    const text = await (blob as Blob).text()
    const lines = text.replace('﻿', '').split('\r\n')
    const missionLines = lines.filter((line) => /^(Accra|Berlin|Cairo),/.test(line))
    expect(missionLines.map((line) => line.split(',')[0])).toEqual(['Berlin', 'Accra', 'Cairo'])
    expect(lines.find((line) => line.startsWith('Cairo'))).toContain('Not tracked')
    expect(lines.some((line) => line.includes('Agreements signed — Attainment %'))).toBe(true)
  })

  it('TC-FR-KPI-015-UI: downloads the department performance report for the period', async () => {
    renderPage()
    await screen.findByTestId('kpi-matrix-row-mission-accra')

    await userEvent.click(screen.getByRole('button', { name: 'Performance report' }))
    expect(kpiApi.downloadKpiReport).toHaveBeenCalledWith('all', 'H1 2026')
  })

  it('changes the period and keeps it in the URL', async () => {
    renderPage()
    await screen.findByTestId('kpi-matrix-row-mission-accra')

    await userEvent.click(screen.getByRole('radio', { name: 'Quarter' }))
    await waitFor(() => expect(kpiApi.getKpiComparison).toHaveBeenLastCalledWith({ period: 'Q1 2026' }))
    expect(screen.getByTestId('location')).toHaveTextContent('period=Q1+2026')
  })

  it('explains when the role may not compare missions', async () => {
    vi.mocked(kpiApi.getKpiComparison).mockRejectedValue(
      new AxiosError('Forbidden', '403', undefined, undefined, { status: 403, statusText: '', data: {}, headers: {}, config: { headers: new AxiosHeaders() } }),
    )
    renderPage()

    expect(await screen.findByText('The comparison matrix isn’t available to your role')).toBeInTheDocument()
  })

  it('shows an empty state when there is nothing to compare', async () => {
    vi.mocked(kpiApi.getKpiComparison).mockResolvedValue(comparisonMatrix({ missions: [], kpis: [] }))
    renderPage()

    expect(await screen.findByText('Nothing to compare yet')).toBeInTheDocument()
  })
})
