import type { ReactNode } from 'react'

export type BadgeVariant = 'accent' | 'atrisk' | 'success' | 'danger' | 'info' | 'directive' | 'neutral'

export interface BadgeProps {
  variant?: BadgeVariant
  label: string
  icon?: ReactNode
  className?: string
  testId?: string
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  accent: 'bg-accent-soft text-accent-soft-text',
  atrisk: 'bg-atrisk-soft text-atrisk-soft-text',
  success: 'bg-success-soft text-success-soft-text',
  danger: 'bg-danger-soft text-danger-soft-text',
  info: 'bg-info-soft text-info-soft-text',
  directive: 'bg-directive-soft text-directive-soft-text',
  neutral: 'bg-section-bg text-text-secondary',
}

/**
 * CLAUDE.md Section 4 Rule 9 / Design Tokens "Rules to enforce: color" #5: every status
 * badge pairs colour with an icon and a text label — colour alone is never sufficient
 * (WCAG 1.4.1). Callers pass a contextual `icon`; a plain dot is the fallback so this
 * invariant holds even if a caller forgets to supply one.
 */
export function Badge({ variant = 'neutral', label, icon, className = '', testId }: BadgeProps) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {icon ?? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  )
}
