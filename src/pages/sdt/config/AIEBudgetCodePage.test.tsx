import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AIEBudgetCodePage from './AIEBudgetCodePage'
import * as sdtApi from '../../../api/sdt'
import { I18nProvider } from '../../../i18n/context'

vi.mock('../../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/sdt')>()
  return { ...actual, getAieBudgetCodes: vi.fn(), createAieBudgetCode: vi.fn(), updateAieBudgetCode: vi.fn() }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/sdt/config/aie-budget-codes']}>
        <AIEBudgetCodePage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('AIEBudgetCodePage', () => {
  beforeEach(() => {
    vi.mocked(sdtApi.getAieBudgetCodes).mockReset()
    vi.mocked(sdtApi.createAieBudgetCode).mockReset()
    vi.mocked(sdtApi.updateAieBudgetCode).mockReset()
  })

  it('TC-FR-SDT-022: lists existing AIE budget codes with their active status', async () => {
    vi.mocked(sdtApi.getAieBudgetCodes).mockResolvedValue([
      {
        id: 'entry-1',
        ministry_id: 'ministry-1',
        category: 'aie_budget_code',
        value: '2210505 — Trade Shows and Exhibitions',
        display_order: 1,
        active: true,
      },
    ])

    renderPage()

    expect(await screen.findByRole('heading', { name: 'AIE Budget Code Configuration' })).toBeInTheDocument()
    expect(await screen.findByText('2210505 — Trade Shows and Exhibitions')).toBeInTheDocument()
    // Both the "Active" column header and the row's Active badge render the same text.
    expect(screen.getAllByText('Active')).toHaveLength(2)
  })

  it('TC-FR-SDT-022: adds a new budget code, reusing the existing rows’ ministry_id', async () => {
    const user = userEvent.setup()
    vi.mocked(sdtApi.getAieBudgetCodes).mockResolvedValue([
      {
        id: 'entry-1',
        ministry_id: 'ministry-1',
        category: 'aie_budget_code',
        value: '2210505 — Trade Shows and Exhibitions',
        display_order: 1,
        active: true,
      },
    ])
    vi.mocked(sdtApi.createAieBudgetCode).mockResolvedValue({
      id: 'entry-2',
      ministry_id: 'ministry-1',
      category: 'aie_budget_code',
      value: '2210600 — Payment of Rents',
      display_order: 2,
      active: true,
    })

    renderPage()

    await screen.findByText('2210505 — Trade Shows and Exhibitions')

    await user.type(screen.getByLabelText('Budget Code — Head Description'), '2210600 — Payment of Rents')
    await user.click(screen.getByRole('button', { name: 'Add budget code' }))

    await waitFor(() =>
      expect(sdtApi.createAieBudgetCode).toHaveBeenCalledWith({
        ministry_id: 'ministry-1',
        value: '2210600 — Payment of Rents',
        display_order: undefined,
      }),
    )
  })

  it('deactivates a budget code via the row action', async () => {
    const user = userEvent.setup()
    vi.mocked(sdtApi.getAieBudgetCodes).mockResolvedValue([
      {
        id: 'entry-1',
        ministry_id: 'ministry-1',
        category: 'aie_budget_code',
        value: '2210505 — Trade Shows and Exhibitions',
        display_order: 1,
        active: true,
      },
    ])
    vi.mocked(sdtApi.updateAieBudgetCode).mockResolvedValue({
      id: 'entry-1',
      ministry_id: 'ministry-1',
      category: 'aie_budget_code',
      value: '2210505 — Trade Shows and Exhibitions',
      display_order: 1,
      active: false,
    })

    renderPage()

    await screen.findByText('2210505 — Trade Shows and Exhibitions')
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(sdtApi.updateAieBudgetCode).toHaveBeenCalledWith('entry-1', { active: false }))
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(sdtApi.getAieBudgetCodes).mockResolvedValue([])

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'AIE Budget Code Configuration' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
