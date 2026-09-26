import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectiveListPage from './DirectiveListPage'
import * as directivesApi from '../../api/directives'
import * as missionsApi from '../../api/missions'
import type { Directive } from '../../api/directives'
import { I18nProvider } from '../../i18n/context'

vi.mock('../../api/directives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/directives')>()
  return { ...actual, listDirectives: vi.fn() }
})

vi.mock('../../api/missions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/missions')>()
  return { ...actual, listMissions: vi.fn() }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <MemoryRouter initialEntries={['/directives']}>
        <DirectiveListPage />
      </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const STALE_DIRECTIVE: Directive = {
  id: 'directive-1',
  type_category: null,
  description: 'Submit outstanding trade brief.',
  status: 'in_progress',
  target_completion_date: null,
  last_progress_update_at: '2026-06-01T00:00:00Z',
  mission: { id: 'mission-1', name: 'London' },
  target_user: { id: 'attache-1', full_name: 'Purity Samanthe' },
  created_at: '2026-05-01T00:00:00Z',
}

describe('DirectiveListPage', () => {
  beforeEach(() => {
    vi.mocked(missionsApi.listMissions).mockReset().mockResolvedValue([{ id: 'mission-1', name: 'London', city: 'London', active: true }])
    vi.mocked(directivesApi.listDirectives).mockReset()
  })

  it('TC-FR-DIR-005, TC-FR-DIR-009: renders the directive list scoped by the server, including mission and target attache', async () => {
    vi.mocked(directivesApi.listDirectives).mockResolvedValue({
      data: [STALE_DIRECTIVE],
      meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Directives and Tasking' })).toBeInTheDocument()
    const row = (await screen.findByText('Purity Samanthe')).closest('tr') as HTMLElement
    expect(within(row).getByText('London')).toBeInTheDocument()
  })

  it('TC-FR-DIR-010: flags an in_progress directive with no update in 14+ days as stale', async () => {
    vi.mocked(directivesApi.listDirectives).mockResolvedValue({
      data: [STALE_DIRECTIVE],
      meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    })

    renderPage()

    const row = (await screen.findByText('Purity Samanthe')).closest('tr') as HTMLElement
    expect(within(row).getByText('Stale')).toBeInTheDocument()
  })

  it('does not flag a recently-updated in_progress directive as stale', async () => {
    vi.mocked(directivesApi.listDirectives).mockResolvedValue({
      data: [{ ...STALE_DIRECTIVE, last_progress_update_at: new Date().toISOString() }],
      meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    })

    renderPage()

    const row = (await screen.findByText('Purity Samanthe')).closest('tr') as HTMLElement
    expect(within(row).queryByText('Stale')).not.toBeInTheDocument()
  })

  it('TC-UI-002: renders without overflow at 375px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    vi.mocked(directivesApi.listDirectives).mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 25, total: 0, last_page: 1 },
    })

    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Directives and Tasking' })).toBeInTheDocument()

    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
