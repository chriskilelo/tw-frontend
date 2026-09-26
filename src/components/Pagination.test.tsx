import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { Pagination } from './Pagination'
import { I18nProvider } from '../i18n/context'
import type { PaginationMeta } from '../api/client'

function meta(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  return { current_page: 1, per_page: 10, total: 100, last_page: 10, ...overrides }
}

function renderPagination(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>,
  )
}

describe('Pagination', () => {
  it('renders nothing when there are no results', () => {
    const { container } = renderPagination(
      <Pagination meta={meta({ total: 0, last_page: 1 })} onPageChange={vi.fn()} onPerPageChange={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('marks the current page with aria-current and disables Back on the first page', () => {
    renderPagination(<Pagination meta={meta({ current_page: 1 })} onPageChange={vi.fn()} onPerPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  })

  it('disables Next on the last page', () => {
    renderPagination(<Pagination meta={meta({ current_page: 10 })} onPageChange={vi.fn()} onPerPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
  })

  it('shows every page with no ellipsis when the range is short', () => {
    renderPagination(
      <Pagination meta={meta({ current_page: 2, last_page: 4, total: 40 })} onPageChange={vi.fn()} onPerPageChange={vi.fn()} />,
    )
    for (const page of [1, 2, 3, 4]) {
      expect(screen.getByRole('button', { name: String(page) })).toBeInTheDocument()
    }
    expect(screen.queryByText('…')).not.toBeInTheDocument()
  })

  it('collapses a long range with a single ellipsis near the start', () => {
    renderPagination(
      <Pagination meta={meta({ current_page: 2, last_page: 20, total: 200 })} onPageChange={vi.fn()} onPerPageChange={vi.fn()} />,
    )
    expect(screen.getAllByText('…')).toHaveLength(1)
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument()
  })

  it('collapses a long range with ellipses on both sides when current page is in the middle', () => {
    renderPagination(
      <Pagination meta={meta({ current_page: 10, last_page: 20, total: 200 })} onPageChange={vi.fn()} onPerPageChange={vi.fn()} />,
    )
    expect(screen.getAllByText('…')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument()
  })

  it('calls onPageChange with the target page when a page button is clicked', async () => {
    const onPageChange = vi.fn()
    renderPagination(
      <Pagination meta={meta({ current_page: 1, last_page: 4, total: 40 })} onPageChange={onPageChange} onPerPageChange={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('calls onPageChange with current+1 when Next is clicked', async () => {
    const onPageChange = vi.fn()
    renderPagination(
      <Pagination meta={meta({ current_page: 2, last_page: 4, total: 40 })} onPageChange={onPageChange} onPerPageChange={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('calls onPerPageChange when the results-per-page selector changes', async () => {
    const onPerPageChange = vi.fn()
    renderPagination(<Pagination meta={meta()} onPageChange={vi.fn()} onPerPageChange={onPerPageChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Result per page'), '50')
    expect(onPerPageChange).toHaveBeenCalledWith(50)
  })

  it('renders the ellipsis as aria-hidden and not focusable', () => {
    renderPagination(
      <Pagination meta={meta({ current_page: 10, last_page: 20, total: 200 })} onPageChange={vi.fn()} onPerPageChange={vi.fn()} />,
    )
    const ellipses = screen.getAllByText('…')
    for (const ellipsis of ellipses) {
      expect(ellipsis).toHaveAttribute('aria-hidden', 'true')
      expect(ellipsis.tagName).not.toBe('BUTTON')
    }
  })

  it('shows the result range summary', () => {
    renderPagination(
      <Pagination meta={meta({ current_page: 3, per_page: 10, total: 25, last_page: 3 })} onPageChange={vi.fn()} onPerPageChange={vi.fn()} />,
    )
    expect(screen.getByText('21–25 of 25')).toBeInTheDocument()
  })
})
