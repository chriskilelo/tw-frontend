import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ForgotPasswordPage from './ForgotPasswordPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ForgotPasswordPage', () => {
  it('TC-UI-002: renders without overflow at 375px viewport', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()

    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument()
    // Shares AuthLayout's responsive w-full/max-w-sm card shell (see LoginPage.test.tsx).
    expect(container.querySelector('.max-w-sm.w-full')).not.toBeNull()
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
