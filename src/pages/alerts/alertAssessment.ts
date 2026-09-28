import { ClockIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import type { TileTone } from '../../components/choiceTileTones'

// Urgency tiers and the confidence scale are not yet defined by SDT (CLAUDE.md Section 8,
// Alert Field Schema); the backend stores both as free-text strings, so these fixed values
// are a UI working baseline until a configured list exists.
export const URGENCY_VALUES = ['low', 'medium', 'high'] as const
export const CONFIDENCE_VALUES = ['low', 'fair', 'good', 'confirmed'] as const

export type UrgencyValue = (typeof URGENCY_VALUES)[number]
export type ConfidenceValue = (typeof CONFIDENCE_VALUES)[number]

export const URGENCY_TONES: Record<UrgencyValue, TileTone> = {
  low: {
    selected: 'border-text-muted bg-page-bg ring-4 ring-text-muted/15',
    indicator: 'border-text-muted bg-text-muted',
    icon: 'bg-section-bg text-text-secondary',
  },
  medium: {
    selected: 'border-info bg-info-soft/40 ring-4 ring-info/10',
    indicator: 'border-info bg-info',
    icon: 'bg-info-soft text-info',
  },
  high: {
    selected: 'border-atrisk bg-atrisk-soft/40 ring-4 ring-atrisk/15',
    indicator: 'border-atrisk bg-atrisk',
    icon: 'bg-atrisk-soft text-atrisk-soft-text',
  },
}

export const URGENCY_ICONS: Record<UrgencyValue, typeof ClockIcon> = {
  low: InformationCircleIcon,
  medium: ClockIcon,
  high: ExclamationTriangleIcon,
}

// Alerts created before the tile controls existed (and the demo dataset) carry these
// free-text values; they are mapped only to pick a tone/icon/bar count, never rewritten.
const LEGACY_URGENCY: Record<string, UrgencyValue> = {
  routine: 'low',
  'time-sensitive': 'medium',
  urgent: 'high',
}

const LEGACY_CONFIDENCE_LEVEL: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

export function isUrgencyValue(value: string): value is UrgencyValue {
  return (URGENCY_VALUES as readonly string[]).includes(value)
}

export function isConfidenceValue(value: string): value is ConfidenceValue {
  return (CONFIDENCE_VALUES as readonly string[]).includes(value)
}

/** The urgency tier a stored value belongs to, for styling only; null when it can't be placed. */
export function urgencyTier(value: string): UrgencyValue | null {
  const normalised = value.trim().toLowerCase()
  if (isUrgencyValue(normalised)) {
    return normalised
  }
  return LEGACY_URGENCY[normalised] ?? null
}

/** Number of signal bars (1-4) a stored confidence value represents; null when it can't be placed. */
export function confidenceLevel(value: string): number | null {
  const normalised = value.trim().toLowerCase()
  if (isConfidenceValue(normalised)) {
    return CONFIDENCE_VALUES.indexOf(normalised) + 1
  }
  return LEGACY_CONFIDENCE_LEVEL[normalised] ?? null
}
