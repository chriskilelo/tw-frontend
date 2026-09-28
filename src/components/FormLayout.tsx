import type { ReactNode } from 'react'
import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/20/solid'

/** Shared building blocks for the sectioned create forms (alert submit, inquiry log). */

export const FORM_INPUT_CLASS =
  'w-full rounded-lg border border-border-muted bg-white px-3 py-2 text-body text-text-primary placeholder:text-text-muted hover:border-text-muted focus:border-info focus:outline-none focus:ring-4 focus:ring-info-soft aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger-soft'

export function RequiredMarker() {
  return (
    <span className="ml-0.5 font-bold text-danger" aria-hidden="true">
      *
    </span>
  )
}

export function OptionalMarker({ text }: { text: string }) {
  return <span className="text-caption font-normal text-text-muted">{text}</span>
}

interface FieldLabelProps {
  htmlFor: string
  label: string
  isRequired?: boolean
  optionalText?: string
  trailing?: ReactNode
  className?: string
  children: ReactNode
}

export function FieldLabel({ htmlFor, label, isRequired = false, optionalText, trailing, className = '', children }: FieldLabelProps) {
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1.5 text-body-sm font-semibold text-text-secondary">
        <span>
          {label}
          {isRequired && <RequiredMarker />}
        </span>
        {optionalText && <OptionalMarker text={optionalText} />}
        {trailing}
      </label>
      {children}
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-caption font-semibold text-danger-soft-text">
      <ExclamationCircleIcon className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

interface FormSectionProps {
  id: string
  icon: ReactNode
  title: string
  subtitle: string
  children: ReactNode
}

export function FormSection({ id, icon, title, subtitle, children }: FormSectionProps) {
  const headingId = `${id}-heading`
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-5 rounded-xl border border-border bg-white shadow-sm">
      <div className="flex items-start gap-3.5 px-4 pt-4 sm:px-5.5 sm:pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-section-bg text-primary">{icon}</span>
        <div>
          <h2 id={headingId} className="text-h3 text-primary">
            {title}
          </h2>
          <p className="text-body-sm text-text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="grid gap-x-5 gap-y-4.5 p-4 sm:grid-cols-2 sm:p-5.5">{children}</div>
    </section>
  )
}

export function FormSidePanel({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-white p-4.5 shadow-sm ${className}`}>
      <h3 className="text-h4 text-primary">{title}</h3>
      {children}
    </section>
  )
}

export interface FormSectionNavItem<Key extends string> {
  key: Key
  label: string
  isDone: boolean
}

interface FormSectionNavProps<Key extends string> {
  label: string
  sections: FormSectionNavItem<Key>[]
  onSelect: (key: Key) => void
}

/** Jump links across the form's sections; the first incomplete section is marked current. */
export function FormSectionNav<Key extends string>({ label, sections, onSelect }: FormSectionNavProps<Key>) {
  const currentKey = sections.find((section) => !section.isDone)?.key
  return (
    <nav aria-label={label} className="flex gap-1 rounded-xl border border-border bg-white p-1.5 shadow-sm">
      {sections.map((section, index) => {
        const isCurrent = section.key === currentKey
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect(section.key)}
            aria-current={isCurrent ? 'step' : undefined}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-body-sm font-semibold sm:justify-start ${
              isCurrent ? 'bg-section-bg text-primary' : section.isDone ? 'text-success' : 'text-text-muted'
            }`}
          >
            <span
              className={`grid size-5.5 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[0.6875rem] ${
                section.isDone
                  ? 'border-success bg-success text-white'
                  : isCurrent
                    ? 'border-primary text-primary'
                    : 'border-border-muted'
              }`}
            >
              {section.isDone ? <CheckIcon className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className="sr-only md:not-sr-only md:truncate">{section.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export interface ReadinessField {
  key: string
  label: string
  isRequired: boolean
  isDone: boolean
}

interface FormReadinessPanelProps {
  title: string
  progressLabel: string
  requiredNote: string
  doneText: string
  fields: ReadinessField[]
  testId?: string
  className?: string
}

export function FormReadinessPanel({ title, progressLabel, requiredNote, doneText, fields, testId, className = '' }: FormReadinessPanelProps) {
  const completedCount = fields.filter((field) => field.isDone).length
  return (
    <FormSidePanel title={title} className={className}>
      <div className="flex justify-between text-caption text-text-muted">
        <span>{progressLabel}</span>
        <span className="font-mono font-medium text-text-primary">
          {completedCount} / {fields.length}
        </span>
      </div>
      <div
        className="mb-3.5 mt-1 h-1.5 overflow-hidden rounded-full bg-section-bg"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={fields.length}
        aria-valuenow={completedCount}
      >
        {/* scaleX rather than width so the bar never sets an inline width (TC-UI-002). */}
        <span
          className="block h-full origin-left bg-success transition-transform duration-300"
          style={{ transform: `scaleX(${completedCount / fields.length})` }}
        />
      </div>
      <ul className="flex flex-col gap-2" data-testid={testId}>
        {fields.map((field) => (
          <li
            key={field.key}
            className={`flex items-start gap-2 text-body-sm ${field.isDone ? 'text-text-primary' : 'text-text-secondary'}`}
          >
            <span
              className={`mt-px grid size-4.5 shrink-0 place-items-center rounded-full border-[1.5px] ${
                field.isDone ? 'border-success bg-success text-white' : 'border-border-muted'
              }`}
              aria-hidden="true"
            >
              {field.isDone && <CheckIcon className="size-3" />}
            </span>
            <span>
              {field.label}
              {field.isRequired && <RequiredMarker />}
              <span className="sr-only">{field.isDone ? ` (${doneText})` : ''}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-border pt-2.5 text-caption text-text-muted">
        <span className="text-danger" aria-hidden="true">
          *
        </span>{' '}
        {requiredNote}
      </p>
    </FormSidePanel>
  )
}

interface FormSubmitBarProps {
  isReady: boolean
  statusLabel: string
  statusNote: string
  children: ReactNode
}

/** Sticky footer carrying the form's readiness status and its actions. */
export function FormSubmitBar({ isReady, statusLabel, statusNote, children }: FormSubmitBarProps) {
  const StatusIcon = isReady ? CheckIcon : ExclamationCircleIcon
  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <p className="flex items-center gap-2 text-body-sm text-text-secondary" aria-live="polite">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold ${
            isReady ? 'bg-success-soft text-success-soft-text' : 'bg-atrisk-soft text-atrisk-soft-text'
          }`}
        >
          <StatusIcon className="size-3.5" aria-hidden="true" />
          {statusLabel}
        </span>
        <span className="hidden sm:inline">{statusNote}</span>
      </p>
      <div className="flex w-full gap-2.5 sm:w-auto">{children}</div>
    </div>
  )
}

interface TimelineStepProps {
  badge: ReactNode
  title: string
  note: string
  isHighlighted?: boolean
  isLast?: boolean
}

/** One row of a vertical, connected step list (routing, workflow previews). */
export function TimelineStep({ badge, title, note, isHighlighted = false, isLast = false }: TimelineStepProps) {
  return (
    <li className="relative grid grid-cols-[28px_1fr] gap-2.5 pb-3.5 last:pb-0">
      {!isLast && <span className="absolute bottom-0 left-3.25 top-7 w-0.5 bg-border" aria-hidden="true" />}
      <span
        className={`grid size-7 place-items-center rounded-full text-[0.6875rem] font-bold ${
          isHighlighted ? 'bg-accent text-accent-text' : 'bg-section-bg text-primary'
        }`}
        aria-hidden="true"
      >
        {badge}
      </span>
      <span>
        <span className="block text-body-sm font-semibold leading-tight text-text-primary">{title}</span>
        {note && <span className="block text-caption text-text-muted">{note}</span>}
      </span>
    </li>
  )
}
