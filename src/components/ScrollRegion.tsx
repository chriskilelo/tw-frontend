import type { ReactNode } from 'react'

/**
 * A horizontally scrollable wrapper for a wide table whose rows hold nothing focusable: it
 * takes focus itself, under a name, so a keyboard user can scroll it too (WCAG 2.1.1; axe
 * scrollable-region-focusable).
 */
export function ScrollRegion({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={`overflow-x-auto ${className}`}>
      {children}
    </div>
  )
}
