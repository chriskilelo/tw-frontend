import { useId, useMemo, useState, type ReactNode } from 'react'
import { ArrowUpIcon, CheckIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { Avatar, getInitials } from './Avatar'
import { useI18n } from '../i18n/context'

export type PersonTagTone = 'success' | 'info' | 'neutral'

export interface PersonTag {
  label: string
  tone: PersonTagTone
  icon?: ReactNode
}

/** One person the picker offers. The id is sent to the API; nobody ever sees or types it. */
export interface PersonOption {
  id: string
  name: string
  /** Secondary line: role, mission, or both. */
  detail: string
  /** Optional heading the person is listed under (e.g. their mission). Rows sharing a group must be adjacent. */
  group?: string
  tags?: PersonTag[]
}

interface PeoplePickerProps {
  label: string
  description?: string
  people: PersonOption[]
  /** single: radio buttons, one person. multiple: checkboxes, in the order chosen. */
  mode: 'single' | 'multiple'
  value: string[]
  onChange: (ids: string[]) => void
  /** Shown when nobody is eligible at all. */
  emptyMessage: string
  /** multiple mode: the first person chosen carries this label (e.g. "Lead"). */
  leadLabel?: string
  isLoading?: boolean
  disabled?: boolean
  testId?: string
}

const TAG_CLASSES: Record<PersonTagTone, string> = {
  success: 'bg-success-soft text-success-soft-text',
  info: 'bg-info-soft text-info-soft-text',
  neutral: 'bg-section-bg text-text-secondary',
}

function matches(person: PersonOption, query: string): boolean {
  const haystack = `${person.name} ${person.detail} ${person.group ?? ''} ${(person.tags ?? []).map((tag) => tag.label).join(' ')}`
  return haystack.toLocaleLowerCase().includes(query)
}

/**
 * K-02: choose people by name instead of typing user IDs. A searchable list of native radio
 * buttons or checkboxes (not a dropdown), so it works inside dialogs and on phones and every
 * row is reachable by keyboard and screen reader. The list shows only the people the API says
 * are eligible; the server checks the same rule again when the form is submitted.
 */
export function PeoplePicker({
  label,
  description,
  people,
  mode,
  value,
  onChange,
  emptyMessage,
  leadLabel,
  isLoading = false,
  disabled = false,
  testId,
}: PeoplePickerProps) {
  const { t } = useI18n()
  const copy = t.peoplePicker
  const baseId = useId()
  const listId = `${baseId}-list`
  const descriptionId = `${baseId}-description`
  const [query, setQuery] = useState('')

  const normalisedQuery = query.trim().toLocaleLowerCase()
  const visible = useMemo(
    () => (normalisedQuery === '' ? people : people.filter((person) => matches(person, normalisedQuery))),
    [people, normalisedQuery],
  )
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])
  const selected = value.map((id) => byId.get(id)).filter((person): person is PersonOption => person !== undefined)

  function toggle(id: string) {
    if (mode === 'single') {
      onChange([id])
      return
    }
    onChange(value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id])
  }

  function makeLead(id: string) {
    onChange([id, ...value.filter((existing) => existing !== id)])
  }

  const showSearch = people.length > 5

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" data-testid={testId} aria-describedby={description ? descriptionId : undefined}>
      <legend className="text-body-sm font-semibold text-text-secondary">{label}</legend>
      {description && (
        <p id={descriptionId} className="-mt-1 text-caption leading-snug text-text-muted">
          {description}
        </p>
      )}

      {mode === 'multiple' && selected.length > 0 && (
        <div aria-label={copy.selected} role="group" className="flex flex-wrap gap-2">
          {selected.map((person, index) => {
            const isLead = index === 0 && leadLabel !== undefined
            return (
              <span
                key={person.id}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-1 pr-1.5 text-caption font-semibold ${
                  isLead ? 'border-accent bg-accent-soft text-accent-soft-text' : 'border-border bg-white text-text-primary'
                }`}
              >
                <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] text-white">
                  {getInitials(person.name)}
                </span>
                <span className="truncate">{person.name}</span>
                {isLead && <span className="rounded-full bg-accent px-1.5 py-px text-[10px] uppercase tracking-wide text-accent-text">{leadLabel}</span>}
                {!isLead && leadLabel !== undefined && (
                  <button
                    type="button"
                    onClick={() => makeLead(person.id)}
                    disabled={disabled}
                    aria-label={copy.makeLead(person.name)}
                    title={copy.makeLead(person.name)}
                    className="grid size-5 place-items-center rounded-full text-text-muted hover:bg-section-bg hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
                  >
                    <ArrowUpIcon className="size-3.5" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggle(person.id)}
                  disabled={disabled}
                  aria-label={copy.remove(person.name)}
                  title={copy.remove(person.name)}
                  className="grid size-5 place-items-center rounded-full text-text-muted hover:bg-section-bg hover:text-danger-soft-text focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
                >
                  <XMarkIcon className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        {showSearch && (
          <div className="flex items-center gap-2 border-b border-border-muted px-3">
            <MagnifyingGlassIcon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchLabel(label)}
              aria-controls={listId}
              disabled={disabled || isLoading}
              className="w-full min-w-0 bg-transparent py-2.5 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        )}

        <div id={listId} className="relative max-h-72 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <ul aria-label={copy.loading} className="divide-y divide-border-muted">
              {[0, 1, 2].map((row) => (
                <li key={row} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="size-8 animate-pulse rounded-md bg-section-bg" />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <span className="h-3 w-2/5 animate-pulse rounded bg-section-bg" />
                    <span className="h-2.5 w-1/4 animate-pulse rounded bg-section-bg" />
                  </span>
                </li>
              ))}
            </ul>
          ) : people.length === 0 ? (
            <p className="px-4 py-6 text-center text-body-sm text-text-muted">{emptyMessage}</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-body-sm text-text-muted">{copy.noMatches}</p>
          ) : (
            <PeopleRows
              people={visible}
              mode={mode}
              value={value}
              name={`${baseId}-person`}
              disabled={disabled}
              leadLabel={leadLabel}
              onToggle={toggle}
            />
          )}
        </div>

        {showSearch && !isLoading && people.length > 0 && (
          <p aria-live="polite" className="border-t border-border-muted bg-section-bg/60 px-3 py-1.5 text-caption text-text-secondary">
            {copy.showing(visible.length, people.length)}
          </p>
        )}
      </div>
    </fieldset>
  )
}

function PeopleRows({
  people,
  mode,
  value,
  name,
  disabled,
  leadLabel,
  onToggle,
}: {
  people: PersonOption[]
  mode: 'single' | 'multiple'
  value: string[]
  name: string
  disabled: boolean
  leadLabel?: string
  onToggle: (id: string) => void
}) {
  return (
    <ul className="divide-y divide-border-muted">
      {people.map((person, index) => {
        const isSelected = value.includes(person.id)
        const isLead = mode === 'multiple' && leadLabel !== undefined && value[0] === person.id
        const startsGroup = person.group !== undefined && person.group !== people[index - 1]?.group
        return (
          <li key={person.id}>
            {startsGroup && (
              <p className="sticky top-0 z-[1] border-b border-border-muted bg-section-bg px-3 py-1 text-caption font-semibold uppercase tracking-wide text-text-secondary">
                {person.group}
              </p>
            )}
            <label
              className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors has-[input:focus-visible]:bg-info-soft/60 has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-info ${
                isSelected ? 'bg-info-soft/50' : 'hover:bg-section-bg/70'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type={mode === 'single' ? 'radio' : 'checkbox'}
                name={name}
                value={person.id}
                checked={isSelected}
                onChange={() => onToggle(person.id)}
                disabled={disabled}
                className="sr-only"
              />
              <Avatar initials={getInitials(person.name)} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-body-sm font-semibold text-text-primary">{person.name}</span>
                  {isLead && <span className="sr-only">({leadLabel})</span>}
                  {(person.tags ?? []).map((tag) => (
                    <span key={tag.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-semibold ${TAG_CLASSES[tag.tone]}`}>
                      {tag.icon ?? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
                      {tag.label}
                    </span>
                  ))}
                </span>
                <span className="truncate text-caption text-text-muted">{person.detail}</span>
              </span>
              <span
                aria-hidden="true"
                className={`grid size-5 shrink-0 place-items-center border-[1.5px] transition-colors ${mode === 'single' ? 'rounded-full' : 'rounded-md'} ${
                  isSelected ? 'border-info bg-info text-white' : 'border-border-muted bg-white'
                }`}
              >
                {isSelected && <CheckIcon className="size-3.5" />}
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}
