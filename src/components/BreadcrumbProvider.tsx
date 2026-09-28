import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { BreadcrumbContext, type BreadcrumbLabel, type VisitedLocation } from '../hooks/useBreadcrumbs'

interface VisitState {
  current: VisitedLocation
  previous: VisitedLocation | null
}

/**
 * Remembers the page the user arrived from, and the record names pages register with
 * useBreadcrumbLabel(). Only a change of page counts as arriving from somewhere: a new
 * query string (list filters, pagination) updates the remembered URL without moving
 * "previous", and a redirect (REPLACE navigation) never becomes the page you came from.
 */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const [labels, setLabels] = useState<Record<string, BreadcrumbLabel>>({})
  const [visit, setVisit] = useState<VisitState>(() => ({
    current: { pathname: location.pathname, search: location.search },
    previous: null,
  }))

  if (visit.current.pathname !== location.pathname || visit.current.search !== location.search) {
    const hasChangedPage = visit.current.pathname !== location.pathname
    setVisit({
      current: { pathname: location.pathname, search: location.search },
      previous: hasChangedPage && navigationType !== 'REPLACE' ? visit.current : visit.previous,
    })
  }

  const setLabel = useCallback((pathname: string, label: BreadcrumbLabel) => {
    setLabels((current) =>
      current[pathname]?.text === label.text && current[pathname]?.isCode === label.isCode ? current : { ...current, [pathname]: label },
    )
  }, [])

  const value = useMemo(() => ({ labels, previous: visit.previous, setLabel }), [labels, visit.previous, setLabel])

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>
}
