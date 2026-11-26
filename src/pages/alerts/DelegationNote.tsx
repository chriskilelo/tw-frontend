import { ChatBubbleBottomCenterTextIcon } from '@heroicons/react/20/solid'
import type { AlertDelegation } from '../../api/alerts'
import { useI18n } from '../../i18n/context'
import { formatDateTime, localeFor } from '../../lib/formatters'

/**
 * FR-ALERT-007: the note the PS (or Acting PS) left when delegating the alert. The API sends
 * the delegation only to the PS and to the people it went to, so this card never reaches the
 * submitting attache or the oversight roles. Renders nothing when there is no note.
 */
export function DelegationNote({ delegation }: { delegation: AlertDelegation | null | undefined }) {
  const { t, language } = useI18n()
  const copy = t.alerts.detail

  if (!delegation?.note) {
    return null
  }

  const author = delegation.delegated_by?.full_name ?? copy.delegationNoteUnknownAuthor
  const names = delegation.delegates.map((person) => person.full_name).join(', ')

  return (
    <figure className="rounded-xl border border-accent/40 bg-accent-soft/40 p-3.5" data-testid="delegation-note">
      <figcaption className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-secondary">
        <ChatBubbleBottomCenterTextIcon className="size-3.5 text-accent-soft-text" aria-hidden="true" />
        {copy.delegationNoteTitle}
      </figcaption>
      <blockquote className="mt-1.5 whitespace-pre-line break-words text-body-sm leading-snug text-text-primary">“{delegation.note}”</blockquote>
      <p className="mt-2 text-caption text-text-secondary">
        {delegation.delegated_at ? copy.delegationNoteBy(author, formatDateTime(delegation.delegated_at, localeFor(language))) : author}
      </p>
      {names && <p className="text-caption text-text-secondary">{copy.delegationNoteTo(names)}</p>}
    </figure>
  )
}
