import type { ComponentType, SVGProps } from 'react'
import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  ScaleIcon,
  ShoppingCartIcon,
  TagIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import type { InquirySubType } from '../../api/inquiries'
import { NEUTRAL_TONE, type TileTone } from '../../components/choiceTileTones'

export type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>

export const DISPUTES_CATEGORY = 'Disputes/Complaints'
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Icons for SDT's six configured categories (CLAUDE.md Section 8); any other
// configured value falls back to a generic tag icon.
const CATEGORY_ICONS: Record<string, HeroIcon> = {
  'Buyer Seeking Supplier': ShoppingCartIcon,
  'Investor Seeking Partner': UserGroupIcon,
  'General Market Question': QuestionMarkCircleIcon,
  'Investor Seeking Buyer': BuildingStorefrontIcon,
  'Investor Seeking Investment Opportunities': BanknotesIcon,
  [DISPUTES_CATEGORY]: ScaleIcon,
}

export function categoryIcon(category: string): HeroIcon {
  return CATEGORY_ICONS[category] ?? TagIcon
}

export const SUB_TYPE_ICONS: Record<InquirySubType, HeroIcon> = {
  standard: DocumentTextIcon,
  dispute_or_complaint: ExclamationTriangleIcon,
}

export const SUB_TYPE_TONES: Record<InquirySubType, TileTone> = {
  standard: NEUTRAL_TONE,
  dispute_or_complaint: {
    selected: 'border-danger bg-danger-soft/40 ring-4 ring-danger/10',
    indicator: 'border-danger bg-danger',
    icon: 'bg-danger-soft text-danger-soft-text',
  },
}

/** YYYY-MM-DD in the viewer's own time zone (toISOString() would use UTC). */
export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
