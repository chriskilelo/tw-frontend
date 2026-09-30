import { useLocation } from 'react-router-dom'

/** Test helper: renders the current location so page tests can assert on navigation. */
export function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}
