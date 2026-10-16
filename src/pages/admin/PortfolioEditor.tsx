import { useEffect, useId, useState, type ComponentType, type FormEvent, type SVGProps } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BriefcaseIcon, GlobeAltIcon, MapPinIcon, PlusIcon, TagIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { getUserPortfolio, updateUserPortfolio, type HqPortfolio } from '../../api/users'
import { Button } from '../../components/Button'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages, retryUnlessClientError } from '../../lib/apiErrors'

/** Mirrors App\Support\HqPortfolio's validation, so mistakes show before saving. */
const SECTOR_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N} &'/-]*[\p{L}\p{N}])?$/u
const COUNTRY_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .,'’()&-]*$/u
const MAX_SECTORS = 30
const MAX_COUNTRIES = 50

function squish(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function samePortfolio(a: HqPortfolio, b: HqPortfolio): boolean {
  const key = (portfolio: HqPortfolio) =>
    JSON.stringify([[...portfolio.mission_ids].sort(), portfolio.countries.map((value) => value.toLowerCase()), portfolio.sectors.map((value) => value.toLowerCase())])
  return key(a) === key(b)
}

/**
 * FR-SDT-012: configure an HQ Trade Officer's portfolio of missions, countries and sector
 * keywords, the view their HQ workspace opens on. Shown on the account page of a Ministry HQ
 * Officer to a System Administrator or the department's Ministry Administrator
 * (UserPolicy::managePortfolio()); PUT /users/{id}/portfolio replaces it as a whole and is
 * audited.
 */
export function PortfolioEditor({ userId }: { userId: string }) {
  const { t } = useI18n()
  const copy = t.admin.portfolio
  const queryClient = useQueryClient()
  const headingId = useId()

  const editorQuery = useQuery({ queryKey: ['admin', 'users', userId, 'portfolio'], queryFn: () => getUserPortfolio(userId), retry: retryUnlessClientError })
  const saved = editorQuery.data?.portfolio

  const [draft, setDraft] = useState<HqPortfolio>({ mission_ids: [], countries: [], sectors: [] })
  const [errors, setErrors] = useState<string[]>([])
  const [savedNotice, setSavedNotice] = useState(false)

  useEffect(() => {
    if (saved) {
      setDraft(saved)
    }
  }, [saved])

  const saveMutation = useMutation({
    mutationFn: (portfolio: HqPortfolio) => updateUserPortfolio(userId, portfolio),
    onMutate: () => {
      setErrors([])
      setSavedNotice(false)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['admin', 'users', userId, 'portfolio'], result)
      setDraft(result.portfolio)
      setSavedNotice(true)
    },
    onError: (error) => setErrors(apiErrorMessages(error, t.common.genericError)),
  })

  if (editorQuery.isError && !editorQuery.data) {
    return (
      <section aria-labelledby={headingId} className="mt-8 max-w-3xl rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 id={headingId} className="text-h3 text-primary">
          {copy.title}
        </h2>
        <p role="alert" className="mt-2 text-body-sm text-text-secondary">
          {apiErrorMessages(editorQuery.error, copy.loadError).join(' ')}
        </p>
      </section>
    )
  }

  if (!editorQuery.data || !saved) {
    return <div role="status" aria-label={copy.loading} className="mt-8 h-64 max-w-3xl animate-pulse rounded-xl border border-border bg-white motion-reduce:animate-none" />
  }

  const { options } = editorQuery.data
  const isDirty = !samePortfolio(draft, saved)
  const isEmpty = draft.mission_ids.length === 0 && draft.countries.length === 0 && draft.sectors.length === 0

  function toggleMission(id: string) {
    setSavedNotice(false)
    setDraft((current) => ({
      ...current,
      mission_ids: current.mission_ids.includes(id) ? current.mission_ids.filter((value) => value !== id) : [...current.mission_ids, id],
    }))
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isDirty && !saveMutation.isPending) {
      saveMutation.mutate(draft)
    }
  }

  return (
    <section aria-labelledby={headingId} className="mt-8 max-w-3xl rounded-xl border border-border bg-white shadow-sm" data-testid="portfolio-editor">
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary">
          <BriefcaseIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="text-h3 text-primary">
            {copy.title}
          </h2>
          <p className="mt-0.5 text-body-sm text-text-secondary">{copy.subtitle}</p>
        </div>
      </header>

      <form onSubmit={handleSave} className="space-y-6 px-5 py-5" noValidate>
        <fieldset>
          <legend className="flex items-center gap-1.5 text-body-sm font-semibold text-text-primary">
            <MapPinIcon aria-hidden="true" className="size-4 text-text-secondary" />
            {copy.missions}
          </legend>
          <p className="mt-0.5 text-caption text-text-secondary">{copy.missionsHint}</p>
          {options.missions.length === 0 ? (
            <p className="mt-2 text-body-sm text-text-muted">{copy.noMissions}</p>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {options.missions.map((mission) => {
                const checked = draft.mission_ids.includes(mission.id)
                return (
                  <label
                    key={mission.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-body-sm transition-colors motion-reduce:transition-none ${
                      checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-section-bg'
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleMission(mission.id)} className="mt-0.5 size-4 shrink-0 rounded border-border-muted accent-primary" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-text-primary">{mission.name}</span>
                      <span className="block text-caption text-text-secondary">
                        {mission.host_country}
                        {!mission.active && ` · ${copy.inactive}`}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>

        <TagListField
          icon={GlobeAltIcon}
          label={copy.countries}
          hint={copy.countriesHint}
          placeholder={copy.countryPlaceholder}
          values={draft.countries}
          suggestions={options.countries}
          max={MAX_COUNTRIES}
          pattern={COUNTRY_PATTERN}
          invalidMessage={copy.invalidCountry}
          onChange={(countries) => {
            setSavedNotice(false)
            setDraft((current) => ({ ...current, countries }))
          }}
        />

        <TagListField
          icon={TagIcon}
          label={copy.sectors}
          hint={copy.sectorsHint}
          placeholder={copy.sectorPlaceholder}
          values={draft.sectors}
          max={MAX_SECTORS}
          maxLength={60}
          pattern={SECTOR_PATTERN}
          invalidMessage={copy.invalidSector}
          onChange={(sectors) => {
            setSavedNotice(false)
            setDraft((current) => ({ ...current, sectors }))
          }}
        />

        <p className="rounded-lg bg-page-bg px-3.5 py-2.5 text-body-sm text-text-secondary">
          {isEmpty ? copy.emptySummary : copy.summary(draft.mission_ids.length, draft.countries.length, draft.sectors.length)}
        </p>

        {errors.length > 0 && (
          <ul role="alert" className="list-disc space-y-1 rounded-lg bg-danger-soft py-2.5 pl-8 pr-3.5 text-body-sm text-danger-soft-text">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        <p role="status" aria-live="polite" className={savedNotice ? 'rounded-lg bg-success-soft px-3.5 py-2.5 text-body-sm font-medium text-success-soft-text' : 'sr-only'}>
          {savedNotice ? copy.saved : ''}
        </p>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setDraft(saved)} disabled={!isDirty || saveMutation.isPending}>
            {copy.reset}
          </Button>
          <Button type="submit" disabled={!isDirty || saveMutation.isPending}>
            {copy.save}
          </Button>
        </div>
      </form>
    </section>
  )
}

interface TagListFieldProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  hint: string
  placeholder: string
  values: string[]
  suggestions?: string[]
  max: number
  maxLength?: number
  pattern: RegExp
  invalidMessage: string
  onChange: (values: string[]) => void
}

/** A list of short names, added one at a time (Enter or the Add button) and removed by chip. */
function TagListField({ icon: Icon, label, hint, placeholder, values, suggestions = [], max, maxLength = 100, pattern, invalidMessage, onChange }: TagListFieldProps) {
  const { t } = useI18n()
  const copy = t.admin.portfolio
  const inputId = useId()
  const listId = useId()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add() {
    const value = squish(input)
    if (value === '') {
      return
    }
    if (value.length < 2 || value.length > maxLength || !pattern.test(value)) {
      setError(invalidMessage)
      return
    }
    if (values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      setError(copy.duplicate)
      return
    }
    if (values.length >= max) {
      setError(copy.tooMany(max))
      return
    }
    onChange([...values, value])
    setInput('')
    setError(null)
  }

  return (
    <div>
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-body-sm font-semibold text-text-primary">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
        {label}
      </label>
      <p className="mt-0.5 text-caption text-text-secondary">{hint}</p>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={copy.listLabel(label)}>
          {values.map((value) => (
            <li key={value} className="inline-flex items-center gap-1 rounded-full bg-primary/5 py-0.5 pl-2.5 pr-1 text-body-sm font-medium text-primary ring-1 ring-primary/10">
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((existing) => existing !== value))}
                aria-label={copy.remove(value)}
                className="grid size-5 place-items-center rounded-full text-primary/70 hover:bg-primary/10 hover:text-primary"
              >
                <XMarkIcon aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          type="text"
          value={input}
          maxLength={maxLength}
          list={suggestions.length > 0 ? listId : undefined}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => {
            setInput(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          className={`min-w-0 flex-1 rounded border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${error ? 'border-danger' : 'border-border'}`}
        />
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions
              .filter((suggestion) => !values.some((value) => value.toLowerCase() === suggestion.toLowerCase()))
              .map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
          </datalist>
        )}
        <Button variant="secondary" onClick={add} disabled={squish(input) === ''}>
          <PlusIcon aria-hidden="true" className="size-4" />
          {copy.add}
        </Button>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-caption text-danger-soft-text">
          {error}
        </p>
      )}
    </div>
  )
}
