import { createContext, useContext, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export interface BreadcrumbLabel {
  text: string
  isCode: boolean
}

export interface VisitedLocation {
  pathname: string
  search: string
}

export interface BreadcrumbContextValue {
  labels: Record<string, BreadcrumbLabel>
  previous: VisitedLocation | null
  setLabel: (pathname: string, label: BreadcrumbLabel) => void
}

export const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null)

export function useBreadcrumbContext(): BreadcrumbContextValue | null {
  return useContext(BreadcrumbContext)
}

/**
 * Names the current record in the breadcrumb trail (e.g. its reference number) instead of
 * the generic page label. `isCode` renders it in the monospace reference style. A no-op
 * outside the app shell, so pages still render on their own in tests.
 */
export function useBreadcrumbLabel(label: string | null | undefined, options: { isCode?: boolean } = {}): void {
  const context = useContext(BreadcrumbContext)
  const { pathname } = useLocation()
  const setLabel = context?.setLabel
  const isCode = options.isCode ?? false

  useEffect(() => {
    if (setLabel && label) {
      setLabel(pathname, { text: label, isCode })
    }
  }, [setLabel, pathname, label, isCode])
}
