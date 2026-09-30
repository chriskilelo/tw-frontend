import { useId, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { BellAlertIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { reviseDirective, type DirectiveDetail } from '../../api/directives'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { FORM_INPUT_CLASS, FieldError, FieldLabel } from '../../components/FormLayout'
import { apiErrorMessages } from '../../lib/apiErrors'
import { localeFor } from '../../lib/formatters'
import { useI18n } from '../../i18n/context'
import { DIRECTIVE_TEXT_MAX, formatCalendarDate, localDateString } from './directivePresentation'

interface TransitionNoteModalProps {
  open: boolean
  onClose: () => void
  title: string
  body: string
  label: string
  placeholder: string
  submitLabel: string
  cancelLabel: string
  /** Completion summary (FR-DIR-007) and withdrawal reason are mandatory; a closing note is not. */
  isRequired: boolean
  isDestructive?: boolean
  isPending: boolean
  errorMessages: string[] | null
  onSubmit: (note: string) => void
}

/**
 * A status change that carries text: completing (summary), withdrawing (reason) and closing
 * (optional note). Mounted only while open so each opening starts with an empty field.
 */
export function TransitionNoteModal(props: TransitionNoteModalProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title} className="max-w-lg">
      {props.open && <TransitionNoteForm {...props} />}
    </Modal>
  )
}

function TransitionNoteForm({
  onClose,
  body,
  label,
  placeholder,
  submitLabel,
  cancelLabel,
  isRequired,
  isDestructive = false,
  isPending,
  errorMessages,
  onSubmit,
}: TransitionNoteModalProps) {
  const { t } = useI18n()
  const copy = t.directives.detail
  const fieldId = useId()
  const [note, setNote] = useState('')
  const trimmed = note.trim()
  const canSubmit = !isPending && (!isRequired || trimmed !== '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSubmit) {
      onSubmit(trimmed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p
        className={`flex gap-2.5 rounded-lg px-3.5 py-3 text-body-sm ${
          isDestructive ? 'bg-danger-soft text-danger-soft-text' : 'bg-info-soft text-info-soft-text'
        }`}
      >
        {isDestructive ? (
          <ExclamationCircleIcon className="mt-px size-4.5 shrink-0" aria-hidden="true" />
        ) : (
          <InformationCircleIcon className="mt-px size-4.5 shrink-0" aria-hidden="true" />
        )}
        {body}
      </p>
      <FieldLabel
        htmlFor={fieldId}
        label={label}
        isRequired={isRequired}
        optionalText={isRequired ? undefined : copy.optional}
        trailing={
          <span className="ml-auto font-mono text-[0.6875rem] font-normal text-text-muted">
            {copy.characterCount(note.length, DIRECTIVE_TEXT_MAX)}
          </span>
        }
      >
        <textarea
          id={fieldId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={5}
          required={isRequired}
          maxLength={DIRECTIVE_TEXT_MAX}
          placeholder={placeholder}
          className={`${FORM_INPUT_CLASS} resize-y`}
        />
      </FieldLabel>
      {errorMessages && (
        <p role="alert" className="text-body-sm text-danger-soft-text">
          {errorMessages.join(' ')}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button type="submit" variant={isDestructive ? 'danger' : 'primary'} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

interface ReviseTargetDateModalProps {
  open: boolean
  onClose: () => void
  directive: DirectiveDetail
  onRevised: (updated: DirectiveDetail) => void
}

/** FR-DIR-003: the target completion date is optional and revisable by the issuer while open. */
export function ReviseTargetDateModal({ open, onClose, directive, onRevised }: ReviseTargetDateModalProps) {
  const { t } = useI18n()
  return (
    <Modal open={open} onClose={onClose} title={t.directives.detail.revise.title} className="max-w-lg">
      {open && <ReviseTargetDateForm onClose={onClose} directive={directive} onRevised={onRevised} />}
    </Modal>
  )
}

function ReviseTargetDateForm({ onClose, directive, onRevised }: Omit<ReviseTargetDateModalProps, 'open'>) {
  const { t, language } = useI18n()
  const copy = t.directives.detail.revise
  const locale = localeFor(language)
  const fieldId = useId()
  const todayString = localDateString()
  const currentDate = directive.target_completion_date?.slice(0, 10) ?? ''

  const [date, setDate] = useState(currentDate)
  const [isNoDate, setIsNoDate] = useState(currentDate === '')

  const mutation = useMutation({
    mutationFn: () => reviseDirective(directive.id, { target_completion_date: isNoDate ? null : date }),
    onSuccess: onRevised,
  })

  const nextDate = isNoDate ? '' : date
  const isUnchanged = nextDate === currentDate
  const isMissing = !isNoDate && date === ''
  const isInPast = !isNoDate && date !== '' && date < todayString
  const canSubmit = !mutation.isPending && !isUnchanged && !isMissing && !isInPast
  const dateError = isInPast ? copy.dateInPast : undefined

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSubmit) {
      mutation.mutate()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-body-sm text-text-secondary">
        {currentDate ? copy.current(formatCalendarDate(currentDate, locale)) : copy.currentNone}
      </p>
      <FieldLabel htmlFor={fieldId} label={copy.dateLabel}>
        <input
          id={fieldId}
          type="date"
          min={todayString}
          value={date}
          disabled={isNoDate}
          onChange={(event) => setDate(event.target.value)}
          aria-invalid={Boolean(dateError)}
          aria-describedby={dateError ? `${fieldId}-error` : undefined}
          className={`${FORM_INPUT_CLASS} disabled:bg-section-bg disabled:text-text-muted`}
        />
        {dateError && <FieldError id={`${fieldId}-error`} message={dateError} />}
      </FieldLabel>
      <label className="flex cursor-pointer items-start gap-2.5 text-body-sm text-text-primary">
        <input
          type="checkbox"
          checked={isNoDate}
          onChange={(event) => setIsNoDate(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-border-muted accent-primary"
        />
        <span>
          <span className="block font-semibold">{copy.noDate}</span>
          <span className="block text-caption text-text-muted">{copy.noDateHint}</span>
        </span>
      </label>
      <p className="flex gap-2 rounded-lg bg-info-soft px-3.5 py-2.5 text-caption leading-snug text-info-soft-text">
        <BellAlertIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
        {copy.helper}
      </p>
      {mutation.isError && (
        <p role="alert" className="text-body-sm text-danger-soft-text">
          {apiErrorMessages(mutation.error, t.common.genericError).join(' ')}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <Button variant="ghost" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {copy.submit}
        </Button>
      </div>
    </form>
  )
}
