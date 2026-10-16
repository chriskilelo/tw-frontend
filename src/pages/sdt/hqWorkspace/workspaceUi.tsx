import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useI18n } from '../../../i18n/context'

const SEARCH_DEBOUNCE_MS = 300

/** Toggle chips for a section's queue or status; one is always selected. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string; count?: number; icon?: ReactNode }[]
  value: T
  onChange: (value: T) => void
}) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
      <span id={labelId} className="mr-1 text-body-sm font-semibold text-text-secondary">
        {label}
      </span>
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-body-sm font-semibold transition-colors motion-reduce:transition-none [&_svg]:size-4 ${
              isActive ? 'border-primary bg-primary text-white' : 'border-border bg-white text-text-secondary hover:bg-section-bg hover:text-primary'
            }`}
          >
            {option.icon && (
              <span aria-hidden="true" className="contents">
                {option.icon}
              </span>
            )}
            {option.label}
            {option.count !== undefined && (
              <span
                className={`min-w-5 rounded-full px-1.5 text-center font-mono text-[0.6875rem] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-section-bg text-text-secondary'
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A search box that writes to the URL after a short pause, so typing does not fire a request
 * per keystroke. Escape or the clear button empties it.
 */
export function SearchField({ label, placeholder, value, onSearch }: { label: string; placeholder: string; value: string; onSearch: (value: string) => void }) {
  const { t } = useI18n()
  const inputId = useId()
  const [draft, setDraft] = useState(value)
  const lastSent = useRef(value)
  const onSearchRef = useRef(onSearch)

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value
      setDraft(value)
    }
  }, [value])

  useEffect(() => {
    const next = draft.trim()
    if (next === lastSent.current) {
      return
    }
    const timer = window.setTimeout(() => {
      lastSent.current = next
      onSearchRef.current(next)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [draft])

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={inputId} className="text-body-sm font-semibold text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          id={inputId}
          type="search"
          value={draft}
          maxLength={100}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && draft !== '') {
              event.preventDefault()
              setDraft('')
            }
          }}
          className="w-full rounded border border-border py-2 pl-9 pr-9 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
        />
        {draft !== '' && (
          <button
            type="button"
            onClick={() => setDraft('')}
            aria-label={t.sdt.hqWorkspace.filters.clearSearch}
            className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-text-muted hover:bg-section-bg hover:text-primary"
          >
            <XMarkIcon aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export function ListSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="space-y-2.5">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-white motion-reduce:animate-none" />
      ))}
    </div>
  )
}

export function SectionEmpty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-success-soft text-success-soft-text [&>svg]:size-5">
        {icon}
      </span>
      <p className="text-h4 text-primary">{title}</p>
      <p className="max-w-md text-body-sm text-text-secondary">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Marks a personal item that lies outside the officer's portfolio (it is never hidden). */
export function OutsidePortfolioPill() {
  const { t } = useI18n()
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-muted px-2 py-0.5 text-caption font-semibold text-text-secondary">
      <span aria-hidden="true" className="size-1.5 rounded-full border border-current" />
      {t.sdt.hqWorkspace.portfolio.outside}
    </span>
  )
}

/**
 * A polite status line for the outcome of an action taken on a row (acknowledged, closed,
 * sent), announced to screen readers; pair it with useActionNotice(), which dismisses it.
 */
export function ActionNotice({ message }: { message: string | null }) {
  return (
    <p role="status" aria-live="polite" className={message ? 'rounded-lg bg-success-soft px-3.5 py-2.5 text-body-sm font-medium text-success-soft-text' : 'sr-only'}>
      {message ?? ''}
    </p>
  )
}
