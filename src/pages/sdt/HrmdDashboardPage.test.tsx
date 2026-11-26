import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HrmdDashboardPage from './HrmdDashboardPage'
import * as sdtApi from '../../api/sdt'
import { getCurrentQuarter } from '../../api/kpi'
import { comparisonMatrix } from '../kpi/kpiFixtures'
import { httpError } from '../../test/httpErrors'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/sdt', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/sdt')>()),
  getHrmdDashboard: vi.fn(),
  getHrmdAttacheSummary: vi.fn(),
  listHrmdAttaches: vi.fn(),
}))

const ATTACHES: sdtApi.HrmdAttache[] = [
  { id: 'u-brian', full_name: 'Brian Attache', mission: { id: 'mission-accra', name: 'Accra', host_country: 'Ghana' }, posted: true },
  { id: 'u-amina', full_name: 'Amina Attache', mission: { id: 'mission-berlin', name: 'Berlin', host_country: 'Germany' }, posted: true },
  { id: 'u-zawadi', full_name: 'Zawadi Junior', mission: { id: 'mission-berlin', name: 'Berlin', host_country: 'Germany' }, posted: false },
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter>
          <HrmdDashboardPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('HrmdDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(sdtApi.getHrmdDashboard).mockReset().mockResolvedValue(comparisonMatrix())
    vi.mocked(sdtApi.listHrmdAttaches).mockReset().mockResolvedValue(ATTACHES)
    vi.mocked(sdtApi.getHrmdAttacheSummary).mockReset().mockResolvedValue({
      attache: { id: 'u-amina', full_name: 'Amina Attache', mission: { id: 'mission-berlin', name: 'Berlin' } },
      cycle_label: 'H1 2026',
      kpis: comparisonMatrix().missions[1].kpis,
    })
  })

  it('TC-FR-SDT-017-K: chooses the attaché by name, grouped by mission, with no user ID field (K-02)', async () => {
    const user = userEvent.setup()
    renderPage()

    const picker = await screen.findByRole('group', { name: 'Attaché' })
    expect(await within(picker).findAllByRole('radio')).toHaveLength(3)
    expect(within(picker).getAllByText('Holds the post')).toHaveLength(2)
    expect(screen.queryByText(/user ID/i)).not.toBeInTheDocument()

    const viewSummary = screen.getByRole('button', { name: 'View summary' })
    expect(viewSummary).toBeDisabled()

    await user.click(within(picker).getByRole('radio', { name: /Amina Attache/ }))
    await user.selectOptions(screen.getByLabelText('Period'), 'H1 2026')
    await user.click(viewSummary)

    expect(sdtApi.getHrmdAttacheSummary).toHaveBeenCalledWith('u-amina', 'H1 2026')
    expect(await screen.findByTestId('hrmd-summary-heading')).toHaveTextContent('Amina Attache · Berlin · H1 2026')
  })

  it('TC-FR-SDT-017-O: opens the posted attaché\'s summary from their mission row', async () => {
    const user = userEvent.setup()
    renderPage()

    const row = (await within(await screen.findByRole('table')).findByText('Berlin')).closest('tr') as HTMLTableRowElement
    expect(within(row).getByText('Amina Attache')).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'View Amina Attache’s summary' }))

    expect(sdtApi.getHrmdAttacheSummary).toHaveBeenCalledWith('u-amina', getCurrentQuarter().label)
    expect(await screen.findByTestId('hrmd-summary-heading')).toHaveFocus()
    expect(screen.getByRole('radio', { name: /Amina Attache/ })).toBeChecked()
  })

  it('TC-FR-SDT-017-P: marks a mission with no attaché, and shows why a summary failed', async () => {
    vi.mocked(sdtApi.listHrmdAttaches).mockResolvedValue(ATTACHES.slice(0, 1))
    vi.mocked(sdtApi.getHrmdAttacheSummary).mockRejectedValue(httpError(404, ['Not found.']))
    const user = userEvent.setup()
    renderPage()

    const table = await screen.findByRole('table')
    const cairo = (await within(table).findByText('Cairo')).closest('tr') as HTMLTableRowElement
    expect(await within(cairo).findByText('No attaché posted')).toBeInTheDocument()

    const accra = within(table).getByText('Accra').closest('tr') as HTMLTableRowElement
    await user.click(within(accra).getByRole('button', { name: 'View Brian Attache’s summary' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found.')
  })

  it('TC-FR-SDT-017-Q: says so when no attaché is posted anywhere yet', async () => {
    vi.mocked(sdtApi.listHrmdAttaches).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No attachés are posted at your department’s missions yet.')).toBeInTheDocument()
  })
})
