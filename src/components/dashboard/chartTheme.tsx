import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, MinusCircleIcon, XCircleIcon } from '@heroicons/react/20/solid'
import type { PerformanceStatus } from '../../api/kpi'

/**
 * Hex mirror of the --chart-* tokens in src/styles/tokens.css (the documented source):
 * SVG presentation attributes do not resolve CSS custom properties in every browser, so
 * Recharts marks take literal values. Keep the two in step.
 */
export const CHART_COLORS = {
  series1: '#2a78d6',
  series2: '#e2622c',
  series3: '#119a6c',
  context: '#94a3b8',
  grid: '#e5e7eb',
  axis: '#6b7280',
  onTrack: '#0f7a3d',
  atRisk: '#d97706',
  below: '#b91c1c',
  /** KPI "pending" (too early to judge) and other work in progress. */
  pending: '#2563eb',
  none: '#6b7280',
} as const

/**
 * Ordered stages (workflow steps, age bands, recency) read light -> dark on one blue ramp:
 * ordinal data takes a single sequential hue, not categorical colours. The two lightest
 * steps sit under 3:1, so every use writes each step's count in a legend beside the mark.
 */
export const ORDINAL_RAMP = ['#cbd5e1', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'] as const

export interface StackSegment {
  key: string
  label: string
  value: number
  color: string
  icon?: ReactNode
  hatched?: boolean
}

export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return
    }
    const media = window.matchMedia(query)
    const update = () => setReduced(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return reduced
}

/** A CSS background that previews a hatched (partial) series in legends. */
export function hatchBackground(color: string): string {
  return `repeating-linear-gradient(135deg, ${color} 0 2px, ${color}40 2px 5px)`
}

/**
 * FR-KPI-008 statuses as chart marks: green -> amber -> red, never adjacent red/green, then
 * blue for "pending" (too early to judge) and a hatched gray for the unmeasured.
 */
export function kpiStatusSegments(counts: Record<PerformanceStatus, number>, labels: Record<PerformanceStatus, string>): StackSegment[] {
  return [
    { key: 'on_track', label: labels.on_track, value: counts.on_track, color: CHART_COLORS.onTrack, icon: <CheckCircleIcon /> },
    { key: 'at_risk', label: labels.at_risk, value: counts.at_risk, color: CHART_COLORS.atRisk, icon: <ExclamationTriangleIcon /> },
    { key: 'below_target', label: labels.below_target, value: counts.below_target, color: CHART_COLORS.below, icon: <XCircleIcon /> },
    { key: 'pending', label: labels.pending, value: counts.pending ?? 0, color: CHART_COLORS.pending, icon: <ClockIcon /> },
    {
      key: 'no_data',
      label: labels.no_data,
      value: counts.no_data + counts.no_target,
      color: CHART_COLORS.none,
      icon: <MinusCircleIcon />,
      hatched: true,
    },
  ]
}
