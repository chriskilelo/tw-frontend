import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Navigate, Outlet, RouterProvider, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BreadcrumbProvider } from './BreadcrumbProvider'
import { Breadcrumbs } from './Breadcrumbs'
import { useBreadcrumbLabel } from '../hooks/useBreadcrumbs'
import { I18nProvider } from '../i18n/context'
import * as authApi from '../api/auth'

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>()
  return { ...actual, me: vi.fn(), updatePreferences: vi.fn() }
})

function Shell() {
  const navigate = useNavigate()
  return (
    <BreadcrumbProvider>
      <Breadcrumbs />
      <button type="button" onClick={() => navigate('/inquiries/inq-1')}>
        open inquiry
      </button>
      <Outlet />
    </BreadcrumbProvider>
  )
}

function InquiryStub() {
  useBreadcrumbLabel('INQ-202607-00007', { isCode: true })
  return <p>inquiry page</p>
}

function renderAt(initialEntries: string[]) {
  const router = createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <p>dashboard page</p> },
          { path: '/search', element: <p>search page</p> },
          { path: '/inquiries', element: <p>inquiry list</p> },
          { path: '/inquiries/:id', element: <InquiryStub /> },
          { path: '/admin/users', element: <p>accounts page</p> },
        ],
      },
    ],
    { initialEntries },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return router
}

const trail = () => within(screen.getByTestId('breadcrumbs'))

describe('Breadcrumbs', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup({ delay: null })
    vi.mocked(authApi.me).mockReset().mockRejectedValue(new Error('unauthenticated'))
  })

  it('TC-UI-003: shows Home, the module and the record, with the record as the current page', async () => {
    renderAt(['/inquiries/inq-1'])

    await screen.findByText('inquiry page')
    expect(trail().getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(trail().getByRole('link', { name: 'Inquiries' })).toHaveAttribute('href', '/inquiries')
    const current = await trail().findByText('INQ-202607-00007')
    expect(current.closest('[aria-current="page"]')).not.toBeNull()
    expect(document.title).toBe('INQ-202607-00007 · TradeWatch')
  })

  it('TC-UI-003-E: marks the trail step the user came from and keeps its list filters', async () => {
    renderAt(['/inquiries?status=closed'])
    await screen.findByText('inquiry list')

    await user.click(screen.getByRole('button', { name: 'open inquiry' }))
    await screen.findByText('inquiry page')

    const origin = trail().getByRole('link', { name: /Inquiries.*You came from here/ })
    expect(origin).toHaveAttribute('href', '/inquiries?status=closed')
    expect(screen.queryByTestId('breadcrumb-origin')).not.toBeInTheDocument()
  })

  it('TC-UI-003-F: offers a "From" chip when the previous page is outside the trail', async () => {
    renderAt(['/search?q=avocado'])
    await screen.findByText('search page')

    await user.click(screen.getByRole('button', { name: 'open inquiry' }))
    await screen.findByText('inquiry page')

    const chip = screen.getByTestId('breadcrumb-origin')
    expect(chip).toHaveAttribute('href', '/search?q=avocado')
    expect(chip).toHaveAccessibleName('Back to Search, the page you came from')
  })

  it('TC-UI-003-G: arriving from the dashboard marks the Home step', async () => {
    renderAt(['/dashboard'])
    await screen.findByText('dashboard page')

    await user.click(screen.getByRole('button', { name: 'open inquiry' }))
    await screen.findByText('inquiry page')

    expect(trail().getByRole('link', { name: /Home.*You came from here/ })).toHaveAttribute('href', '/dashboard')
  })

  it('TC-UI-003-H: a redirect is never treated as the page the user came from', async () => {
    renderAt(['/'])
    await screen.findByText('dashboard page')

    expect(screen.queryByTestId('breadcrumb-origin')).not.toBeInTheDocument()
    const current = trail().getByText('Dashboard')
    expect(current.closest('[aria-current="page"]')).not.toBeNull()
  })

  it('TC-UI-003-I: shows the section group above top-level pages that belong to one', async () => {
    renderAt(['/admin/users'])
    await screen.findByText('accounts page')

    expect(trail().getByText('Administration')).toBeInTheDocument()
    expect(trail().getByText('User Accounts').closest('[aria-current="page"]')).not.toBeNull()
  })
})
