import type { ReactNode } from 'react'
import { StarIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/20/solid'
import { OptionalMarker } from '../../components/FormLayout'
import type { HeroIcon } from './inquiryPresentation'

/** Wraps an input with a leading decorative icon; the input needs `pl-9`. */
export function IconInput({ icon: Icon, children }: { icon: HeroIcon; children: ReactNode }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
      {children}
    </div>
  )
}

interface HighValueToggleProps {
  id: string
  isChecked: boolean
  onChange: (isChecked: boolean) => void
  label: string
  description: string
  optionalText: string
}

/** FR-INQ-004 high-value flag, rendered as a card-sized switch (a native checkbox with role="switch"). */
export function HighValueToggle({ id, isChecked, onChange, label, description, optionalText }: HighValueToggleProps) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3.5 transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-info has-[input:focus-visible]:ring-offset-2 ${
        isChecked ? 'border-accent bg-accent-soft/40 ring-4 ring-accent/15' : 'border-border-muted bg-white hover:border-text-muted'
      }`}
    >
      <span
        className={`grid size-8.5 shrink-0 place-items-center rounded-lg ${
          isChecked ? 'bg-accent text-accent-text' : 'bg-section-bg text-text-secondary'
        }`}
      >
        {isChecked ? <StarSolidIcon className="size-4.5" aria-hidden="true" /> : <StarIcon className="size-4.5" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5 text-body-sm font-semibold text-text-primary">
          {label} <OptionalMarker text={optionalText} />
        </span>
        <span id={`${id}-description`} className="block text-caption leading-snug text-text-muted">
          {description}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={isChecked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={`${id}-description`}
        className="sr-only"
      />
      <span
        className={`relative mt-1 inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors ${
          isChecked ? 'bg-primary' : 'bg-border-muted'
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block size-4.5 rounded-full bg-white shadow transition-transform ${isChecked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </span>
    </label>
  )
}
