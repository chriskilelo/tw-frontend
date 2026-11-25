import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'

/** Room left above and below a sticky column (top-5 plus a little breathing space). */
const VIEWPORT_MARGIN = 40

/**
 * The side column of the record and form pages. From 1200 px wide it stays in view while the
 * page scrolls, but only while it fits in the window. A column taller than the window stays put
 * instead: sticky, its lower panels could not be reached until the page ended, and a pinned
 * column left an empty band above it as the page scrolled (ISS-008).
 */
export function StickyAside({ className = '', children, ...rest }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const [fitsWindow, setFitsWindow] = useState(true)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    const measure = () => setFitsWindow(element.offsetHeight + VIEWPORT_MARGIN <= window.innerHeight)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <aside ref={ref} className={`${className} ${fitsWindow ? 'min-[1200px]:sticky min-[1200px]:top-5' : ''}`.trim()} {...rest}>
      {children}
    </aside>
  )
}
