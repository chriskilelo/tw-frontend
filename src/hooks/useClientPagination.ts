import { useEffect, useMemo, useState } from 'react'
import type { PaginationMeta } from '../api/client'
import { DEFAULT_PER_PAGE } from '../components/Pagination'

/**
 * Client-side pagination for pages whose data source returns a full array with no
 * server-side page/per_page/meta (dashboard aggregations, SDT config lists, etc.) —
 * everything genuinely backed by a paginated list endpoint (Alert/Inquiry/Directive/
 * PeriodicReport/KpiActual) drives <Pagination> from the real response `meta` instead.
 * Slices `items` to the current page and synthesizes a PaginationMeta so the same
 * <Pagination> component works in both cases.
 */
export function useClientPagination<T>(items: T[], defaultPerPage = DEFAULT_PER_PAGE) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(defaultPerPage)

  const lastPage = Math.max(1, Math.ceil(items.length / perPage))

  useEffect(() => {
    if (page > lastPage) {
      setPage(lastPage)
    }
  }, [page, lastPage])

  useEffect(() => {
    setPage(1)
  }, [items.length])

  const currentPage = Math.min(page, lastPage)

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * perPage, currentPage * perPage),
    [items, currentPage, perPage],
  )

  const meta: PaginationMeta = {
    current_page: currentPage,
    per_page: perPage,
    total: items.length,
    last_page: lastPage,
  }

  return { pageItems, meta, page: currentPage, perPage, setPage, setPerPage }
}
