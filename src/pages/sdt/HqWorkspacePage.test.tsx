import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import HqWorkspacePage from './HqWorkspacePage'
import * as sdtApi from '../../api/sdt'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/sdt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sdt')>()
  return { ...actual, getHqWorkspace: vi.fn() }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/sdt/hq-workspace']}>
        <HqWorkspacePage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('HqWorkspacePage', () => {
  beforeEach(() => {
    vi.mocked(sdtApi.getHqWorkspace).mockReset().mockResolvedValue({
      assigned_alerts: [],
      assigned_inquiries: [],
      pending_directives: [],
    })
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'HQ Workspace' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
