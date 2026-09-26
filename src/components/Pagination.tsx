import type { PaginationMeta } from '../api/client'
import { useI18n } from '../i18n/context'

export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

/** API convention (CLAUDE.md Section 10): default per_page is 25, list pages default their
 * initial load to 10 instead (per product decision), max is 100 — never offer more. */
export const DEFAULT_PER_PAGE = 10

export interface PaginationProps {
  meta: PaginationMeta
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  /** How many page buttons to show on each side of the current page before collapsing to an ellipsis. */
  siblingCount?: number
  className?: string
}

type PageToken = number | 'ellipsis-start' | 'ellipsis-end'

function buildPageTokens(currentPage: number, lastPage: number, siblingCount: number): PageToken[] {
  const totalNumberedSlots = siblingCount * 2 + 5 // first + last + current + 2 ellipses worth of buffer

  if (lastPage <= totalNumberedSlots) {
    return Array.from({ length: lastPage }, (_, index) => index + 1)
  }

  const leftSibling = Math.max(currentPage - siblingCount, 1)
  const rightSibling = Math.min(currentPage + siblingCount, lastPage)

  const showLeftEllipsis = leftSibling > 2
  const showRightEllipsis = rightSibling < lastPage - 1

  const tokens: PageToken[] = [1]

  if (showLeftEllipsis) {
    tokens.push('ellipsis-start')
  } else {
    for (let page = 2; page < leftSibling; page += 1) {
      tokens.push(page)
    }
  }

  for (let page = leftSibling; page <= rightSibling; page += 1) {
    if (page !== 1 && page !== lastPage) {
      tokens.push(page)
    }
  }

  if (showRightEllipsis) {
    tokens.push('ellipsis-end')
  } else {
    for (let page = rightSibling + 1; page < lastPage; page += 1) {
      tokens.push(page)
    }
  }

  tokens.push(lastPage)

  return tokens
}

/**
 * Reusable pagination control (Back / numbered pages / ellipsis / Next + a
 * "results per page" selector), driven entirely by props — it never fetches
 * data itself. Pass it a paginated response's `meta` block directly; the
 * caller owns page/per_page state and refetching (TDD-ADR-011).
 */
export function Pagination({ meta, onPageChange, onPerPageChange, siblingCount = 1, className = '' }: PaginationProps) {
  const { t } = useI18n()
  const { current_page: currentPage, last_page: lastPage, per_page: perPage, total } = meta

  if (total === 0) {
    return null
  }

  const tokens = buildPageTokens(currentPage, lastPage, siblingCount)
  const rangeStart = (currentPage - 1) * perPage + 1
  const rangeEnd = Math.min(currentPage * perPage, total)

  function goTo(page: number) {
    if (page !== currentPage && page >= 1 && page <= lastPage) {
      onPageChange(page)
    }
  }

  return (
    <nav
      aria-label={t.pagination.navLabel}
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label={t.pagination.previousPage}
          className="inline-flex h-9 items-center justify-center gap-1 rounded border border-border px-3 text-body-sm font-semibold text-text-secondary transition-colors hover:bg-section-bg disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent"
        >
          {t.common.back}
        </button>

        {tokens.map((token) =>
          typeof token === 'number' ? (
            <button
              key={token}
              type="button"
              onClick={() => goTo(token)}
              aria-current={token === currentPage ? 'page' : undefined}
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded border px-2 text-body-sm font-semibold transition-colors ${
                token === currentPage
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-text-secondary hover:bg-section-bg'
              }`}
            >
              {token}
            </button>
          ) : (
            <span key={token} aria-hidden="true" className="px-1 text-body-sm text-text-muted">
              …
            </span>
          ),
        )}

        <button
          type="button"
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === lastPage}
          aria-label={t.pagination.nextPage}
          className="inline-flex h-9 items-center justify-center gap-1 rounded border border-border px-3 text-body-sm font-semibold text-text-secondary transition-colors hover:bg-section-bg disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent"
        >
          {t.common.next}
        </button>
      </div>

      <div className="flex items-center gap-4">
        <p className="text-body-sm text-text-muted">
          {t.pagination.resultRange(rangeStart, rangeEnd, total)}
        </p>
        <label className="flex items-center gap-2">
          <span className="text-body-sm text-text-secondary">{t.pagination.resultsPerPage}</span>
          <select
            value={perPage}
            onChange={(event) => onPerPageChange(Number(event.target.value))}
            className="rounded border border-border px-2 py-1.5 text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
    </nav>
  )
}
