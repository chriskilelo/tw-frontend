import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveSettingsConfigPage from './DirectiveSettingsConfigPage'
import * as sdtApi from '../../../api/sdt'
import * as useAuthModule from '../../../hooks/useAuth'
import { I18nProvider } from '../../../i18n/context'

vi.mock('../../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/sdt')>()
  return { ...actual, listDirectiveSettings: vi.fn(), createDirectiveSetting: vi.fn(), updateDirectiveSetting: vi.fn() }
})

vi.mock('../../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const ENTRIES: sdtApi.DirectiveSettingEntry[] = [
  { id: 'type-1', ministry_id: 'ministry-1', category: 'directive_type', value: 'Market brief', display_order: 1, active: true },
  { id: 'type-2', ministry_id: 'ministry-1', category: 'directive_type', value: 'Trade mission', display_order: 2, active: false },
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter>
          <DirectiveSettingsConfigPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('DirectiveSettingsConfigPage', () => {
  beforeEach(() => {
    vi.mocked(sdtApi.listDirectiveSettings).mockReset().mockResolvedValue(ENTRIES)
    vi.mocked(sdtApi.createDirectiveSetting).mockReset().mockResolvedValue(ENTRIES[0])
    vi.mocked(sdtApi.updateDirectiveSetting).mockReset().mockResolvedValue(ENTRIES[0])
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: { id: 'admin-1', full_name: 'Admin', ministry_id: null },
      role: { id: 'role-1', name: 'System Administrator', layer: '1', scope: 'platform' },
      permissions: [],
      isLoading: false,
      isAuthenticated: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>)
  })

  it('TC-FR-DIR-001-A: lists active and inactive directive types with a text status', async () => {
    renderPage()

    const activeRow = (await screen.findByText('Market brief')).closest('tr') as HTMLElement
    expect(within(activeRow).getByText('Active')).toBeInTheDocument()
    const inactiveRow = screen.getByText('Trade mission').closest('tr') as HTMLElement
    expect(within(inactiveRow).getByText('Inactive')).toBeInTheDocument()
  })

  it('TC-FR-DIR-001-B: adds a type to the department the existing entries share', async () => {
    renderPage()
    await screen.findByText('Market brief')

    await userEvent.type(screen.getByLabelText(/^Value/), '  Investment follow-up ')
    await userEvent.click(screen.getByRole('button', { name: 'Add directive type' }))

    await waitFor(() =>
      expect(sdtApi.createDirectiveSetting).toHaveBeenCalledWith({ ministry_id: 'ministry-1', value: 'Investment follow-up', display_order: undefined }),
    )
  })

  it('TC-FR-DIR-001-C: renames and reorders a type', async () => {
    renderPage()
    await screen.findByText('Market brief')

    await userEvent.click(screen.getByRole('button', { name: 'Edit: Market brief' }))
    const nameInput = screen.getByLabelText('New name for Market brief')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Market intelligence brief')
    const orderInput = screen.getByLabelText('Display order for Market brief')
    await userEvent.clear(orderInput)
    await userEvent.type(orderInput, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(sdtApi.updateDirectiveSetting).toHaveBeenCalledWith('type-1', { value: 'Market intelligence brief', display_order: 5 }))
  })

  it('TC-FR-DIR-001-D: deactivates an active type and reactivates an inactive one', async () => {
    renderPage()
    await screen.findByText('Market brief')

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate: Market brief' }))
    await waitFor(() => expect(sdtApi.updateDirectiveSetting).toHaveBeenCalledWith('type-1', { active: false }))

    await userEvent.click(screen.getByRole('button', { name: 'Activate: Trade mission' }))
    await waitFor(() => expect(sdtApi.updateDirectiveSetting).toHaveBeenCalledWith('type-2', { active: true }))
  })

  it('TC-FR-DIR-001-E: reports a failed change instead of failing silently', async () => {
    vi.mocked(sdtApi.updateDirectiveSetting).mockRejectedValue(new Error('403'))
    renderPage()
    await screen.findByText('Market brief')

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate: Market brief' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The change could not be saved.')
  })
})
