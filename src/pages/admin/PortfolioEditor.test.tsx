import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PortfolioEditor } from './PortfolioEditor'
import * as usersApi from '../../api/users'
import type { HqPortfolioEditor } from '../../api/users'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/users')>()
  return { ...actual, getUserPortfolio: vi.fn(), updateUserPortfolio: vi.fn() }
})

const EDITOR: HqPortfolioEditor = {
  user: { id: 'officer-1', full_name: 'Carol Officer' },
  portfolio: { mission_ids: ['mission-berlin'], countries: [], sectors: ['tea'] },
  options: {
    missions: [
      { id: 'mission-accra', name: 'Accra', city: 'Accra', host_country: 'Ghana', active: true },
      { id: 'mission-berlin', name: 'Berlin', city: 'Berlin', host_country: 'Germany', active: true },
    ],
    countries: ['Germany', 'Ghana'],
  },
}

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <PortfolioEditor userId="officer-1" />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('PortfolioEditor', () => {
  beforeEach(() => {
    vi.mocked(usersApi.getUserPortfolio).mockReset().mockResolvedValue(EDITOR)
    vi.mocked(usersApi.updateUserPortfolio).mockReset()
  })

  it('TC-FR-SDT-012-PA-UI: shows the stored portfolio and saves the whole of it', async () => {
    vi.mocked(usersApi.updateUserPortfolio).mockImplementation(async (_id, portfolio) => ({ ...EDITOR, portfolio }))
    const user = userEvent.setup({ delay: null })
    renderEditor()

    const berlin = await screen.findByRole('checkbox', { name: /Berlin/ })
    expect(berlin).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Accra/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Save portfolio' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Accra/ }))
    await user.type(screen.getByLabelText('Countries'), '  Ghana {Enter}')
    await user.type(screen.getByLabelText('Sectors'), 'cut   flowers')
    await user.click(within(screen.getByLabelText('Sectors').parentElement as HTMLElement).getByRole('button', { name: 'Add' }))

    expect(screen.getByText('The workspace will open on 2 missions, 1 country and 2 sectors.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save portfolio' }))

    expect(usersApi.updateUserPortfolio).toHaveBeenCalledWith('officer-1', {
      mission_ids: ['mission-berlin', 'mission-accra'],
      countries: ['Ghana'],
      sectors: ['tea', 'cut flowers'],
    })
    expect(await screen.findByText(/Portfolio saved/)).toBeInTheDocument()
  })

  it('sizes each field\'s icon to its label (an unsized SVG stretches across the row)', async () => {
    renderEditor()

    await screen.findByRole('checkbox', { name: /Berlin/ })
    for (const label of ['Countries', 'Sectors']) {
      expect(screen.getByText(label, { selector: 'label' }).querySelector('svg')).toHaveClass('size-4')
    }
  })

  it('refuses a malformed or repeated keyword before it reaches the API', async () => {
    const user = userEvent.setup({ delay: null })
    renderEditor()

    const sectors = await screen.findByLabelText('Sectors')
    await user.type(sectors, 'tea|coffee{Enter}')
    expect(screen.getByText(/Use 2 to 60 characters/)).toBeInTheDocument()

    await user.clear(sectors)
    await user.type(sectors, 'TEA{Enter}')
    expect(screen.getByText('That is already in the portfolio.')).toBeInTheDocument()
    expect(usersApi.updateUserPortfolio).not.toHaveBeenCalled()
  })

  it('removes an entry and can undo every unsaved change', async () => {
    const user = userEvent.setup({ delay: null })
    renderEditor()

    await user.click(await screen.findByRole('button', { name: 'Remove tea' }))
    expect(screen.queryByRole('button', { name: 'Remove tea' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo changes' }))
    expect(screen.getByRole('button', { name: 'Remove tea' })).toBeInTheDocument()
  })

  it('lists the API\'s reasons when it refuses the portfolio', async () => {
    vi.mocked(usersApi.updateUserPortfolio).mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { data: null, errors: ['Every portfolio mission must be posted to the officer’s department.'] } },
    })
    const user = userEvent.setup({ delay: null })
    renderEditor()

    await user.click(await screen.findByRole('checkbox', { name: /Accra/ }))
    await user.click(screen.getByRole('button', { name: 'Save portfolio' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Every portfolio mission must be posted'))
  })
})
