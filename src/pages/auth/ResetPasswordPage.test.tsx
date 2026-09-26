import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ResetPasswordPage from './ResetPasswordPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/reset-password?token=abc&email=attache%40sdt.go.ke']}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ResetPasswordPage', () => {
  it('TC-UI-002: renders without overflow at 375px viewport', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { container } = renderPage()

    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
    expect(container.querySelector('.max-w-md.w-full')).not.toBeNull()
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
