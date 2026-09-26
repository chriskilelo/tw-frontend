import { useId, type ReactNode } from 'react'
import { CheckIcon } from '@heroicons/react/20/solid'
import type { TileTone } from './alertAssessment'

interface ChoiceTileProps {
  name: string
  value: string
  isChecked: boolean
  onSelect: (value: string) => void
  isRequired?: boolean
  tone: TileTone
  icon: ReactNode
  iconSize?: 'default' | 'large'
  title: string
  description?: string
  footer?: ReactNode
}

/** A radio option rendered as a selectable card (alert submit and edit forms). */
export function ChoiceTile({
  name,
  value,
  isChecked,
  onSelect,
  isRequired = false,
  tone,
  icon,
  iconSize = 'default',
  title,
  description,
  footer,
}: ChoiceTileProps) {
  const inputId = useId()
  const titleId = `${inputId}-title`
  const descriptionId = `${inputId}-description`
  return (
    <label
      htmlFor={inputId}
      className={`relative flex cursor-pointer flex-col gap-1.5 rounded-xl border-[1.5px] bg-white p-3.5 pr-9 transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-info has-[input:focus-visible]:ring-offset-2 ${
        isChecked ? tone.selected : 'border-border-muted hover:border-text-muted'
      }`}
    >
      <input
        id={inputId}
        type="radio"
        name={name}
        value={value}
        checked={isChecked}
        required={isRequired}
        onChange={() => onSelect(value)}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="sr-only"
      />
      <span className="flex items-center gap-2.5">
        <span className={`grid shrink-0 place-items-center rounded-lg ${iconSize === 'large' ? 'size-8.5' : 'size-7'} ${tone.icon}`}>
          {icon}
        </span>
        <span id={titleId} className="text-body-sm font-semibold text-text-primary">
          {title}
        </span>
      </span>
      {description && (
        <span id={descriptionId} className="text-caption leading-snug text-text-muted">
          {description}
        </span>
      )}
      {footer}
      <span
        className={`absolute right-3 top-3 grid size-4 place-items-center rounded-full border-[1.5px] ${
          isChecked ? `${tone.indicator} text-white` : 'border-border-muted bg-white'
        }`}
        aria-hidden="true"
      >
        {isChecked && <CheckIcon className="size-3" />}
      </span>
    </label>
  )
}

/** Signal-strength glyph for the confidence scale: `level` of 4 bars filled. */
export function SignalStrength({ level }: { level: number }) {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={`w-1 rounded-[1px] ${bar <= level ? 'bg-primary-lightest' : 'bg-border-muted'}`}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </span>
  )
}
