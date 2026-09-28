import { type FormEvent, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BellAlertIcon,
  ChatBubbleLeftRightIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  FunnelIcon,
  GlobeAltIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { search, type SearchResultType } from '../../api/search'
import { Button } from '../../components/Button'
import { DetailSidePanel, EmptyState } from '../../components/DetailLayout'
import { FORM_INPUT_CLASS } from '../../components/FormLayout'
import { Pagination } from '../../components/Pagination'
import { useClientPagination } from '../../hooks/useClientPagination'
import { useI18n } from '../../i18n/context'
import { SearchResultCard } from './SearchResultCard'

type TypeFilter = SearchResultType | 'all'
type SortOrder = 'relevance' | 'newest'

const RESULT_TYPES: SearchResultType[] = ['alert', 'inquiry', 'periodic_report']
const MAX_COUNTRY_SHORTCUTS = 6

const SELECT_CLASS =
  'h-10 rounded-lg border border-border-muted bg-white px-3 text-body-sm text-text-primary hover:border-text-muted focus:border-info focus:outline-none focus:ring-4 focus:ring-info-soft'

function isResultType(value: string | null): value is SearchResultType {
  return RESULT_TYPES.includes(value as SearchResultType)
}

function countryProfilePath(country: string): string {
  return `/search/countries/${encodeURIComponent(country)}`
}

/**
 * FR-SEARCH-001 to 003. GET /api/v1/search?q={query} merges alerts, inquiries and periodic
 * reports ranked by ts_rank (App\Services\SearchService). The page keeps that single
 * relevance-ranked list (FR-SEARCH-002 AC1) and filters it client-side by record type and
 * mission. The query and every filter live in the URL, so a search can be shared or revisited.
 * The sidebar is the only entry point to the country profile (FR-SEARCH-004).
 */
export default function SearchResultsPage() {
  const { t } = useI18n()
  const copy = t.search.results
  const [searchParams, setSearchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()
  const typeParam = searchParams.get('type')
  const typeFilter: TypeFilter = isResultType(typeParam) ? typeParam : 'all'
  const missionFilter = searchParams.get('mission') ?? ''
  const sortOrder: SortOrder = searchParams.get('sort') === 'newest' ? 'newest' : 'relevance'

  const searchQuery = useQuery({
    queryKey: ['search', query],
    queryFn: () => search(query),
    enabled: query.length > 0,
  })

  const results = useMemo(() => searchQuery.data ?? [], [searchQuery.data])

  const typeCounts = useMemo(() => {
    const inMission = missionFilter ? results.filter((result) => result.mission_id === missionFilter) : results
    const counts: Record<TypeFilter, number> = { all: inMission.length, alert: 0, inquiry: 0, periodic_report: 0 }
    inMission.forEach((result) => {
      counts[result.type] += 1
    })
    return counts
  }, [results, missionFilter])

  const missionOptions = useMemo(() => {
    const missions = new Map<string, { name: string; count: number }>()
    results.forEach((result) => {
      if (!result.mission_id) {
        return
      }
      const entry = missions.get(result.mission_id) ?? { name: result.mission ?? result.mission_id, count: 0 }
      if (typeFilter === 'all' || result.type === typeFilter) {
        entry.count += 1
      }
      missions.set(result.mission_id, entry)
    })
    return [...missions.entries()]
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [results, typeFilter])

  const countryShortcuts = useMemo(() => {
    const countries = new Map<string, number>()
    results.forEach((result) => {
      if (result.type === 'alert' && result.country) {
        countries.set(result.country, (countries.get(result.country) ?? 0) + 1)
      }
    })
    return [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_COUNTRY_SHORTCUTS)
  }, [results])

  const visibleResults = useMemo(() => {
    const filtered = results.filter(
      (result) =>
        (typeFilter === 'all' || result.type === typeFilter) && (!missionFilter || result.mission_id === missionFilter),
    )
    if (sortOrder === 'newest') {
      return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    return filtered
  }, [results, typeFilter, missionFilter, sortOrder])

  const resultsPage = useClientPagination(visibleResults)

  function submitQuery(nextQuery: string) {
    const trimmed = nextQuery.trim()
    const nextParams = new URLSearchParams()
    if (trimmed) {
      nextParams.set('q', trimmed)
      if (sortOrder === 'newest') {
        nextParams.set('sort', 'newest')
      }
    }
    setSearchParams(nextParams)
  }

  function updateFilters(changes: Record<string, string | null>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace: true },
    )
  }

  const typeLabels: Record<TypeFilter, string> = {
    all: copy.typeAll,
    alert: copy.groupAlerts,
    inquiry: copy.groupInquiries,
    periodic_report: copy.groupReports,
  }
  const isFiltered = typeFilter !== 'all' || missionFilter !== ''

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <section className="rounded-2xl border border-border bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6" aria-labelledby="search-heading">
        <div className="flex items-start gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white" aria-hidden="true">
            <MagnifyingGlassIcon className="size-5.5" />
          </span>
          <div className="min-w-0">
            <h1 id="search-heading" className="text-h1 text-primary">
              {copy.title}
            </h1>
            <p className="text-body-sm text-text-secondary">{copy.subtitle}</p>
          </div>
        </div>
        {/* Keyed on the URL query so the box resets when back/forward changes the search. */}
        <SearchForm key={query} initialValue={query} onSubmit={submitQuery} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18.5rem] lg:items-start">
        <div className="min-w-0">
          {query.length === 0 ? (
            <SearchIntro />
          ) : searchQuery.isLoading ? (
            <ResultsSkeleton label={copy.searching} />
          ) : searchQuery.isError ? (
            <p role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm font-semibold text-danger-soft-text">
              <ExclamationCircleIcon className="size-5 shrink-0" aria-hidden="true" />
              {t.common.genericError}
            </p>
          ) : results.length === 0 ? (
            <EmptyState icon={<DocumentMagnifyingGlassIcon className="size-5" />} title={copy.emptyTitle(query)} body={copy.emptyBody} />
          ) : (
            <section aria-labelledby="search-results-heading">
              <h2 id="search-results-heading" className="sr-only">
                {copy.resultsHeading}
              </h2>
              <p className="text-body text-text-secondary" aria-live="polite">
                {copy.resultsSummary(visibleResults.length, query)}
              </p>

              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div role="group" aria-label={copy.typeFilterLabel} className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1 shadow-sm">
                  {(['all', ...RESULT_TYPES] as TypeFilter[]).map((type) => {
                    const isActive = type === typeFilter
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => updateFilters({ type: type === 'all' ? null : type })}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-body-sm font-semibold transition-colors ${
                          isActive ? 'bg-primary text-white' : 'text-text-secondary hover:bg-section-bg hover:text-primary'
                        }`}
                      >
                        {typeLabels[type]}
                        <span
                          className={`rounded-full px-1.5 font-mono text-[0.6875rem] font-medium ${
                            isActive ? 'bg-white/20 text-white' : 'bg-section-bg text-text-secondary'
                          }`}
                        >
                          {typeCounts[type]}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
                    <span className="sr-only">{copy.missionFilterLabel}</span>
                    <FunnelIcon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                    <select
                      value={missionFilter}
                      onChange={(event) => updateFilters({ mission: event.target.value || null })}
                      className={`${SELECT_CLASS} min-w-0 flex-1 md:max-w-52`}
                    >
                      <option value="">{copy.allMissions}</option>
                      {missionOptions.map((mission) => (
                        <option key={mission.id} value={mission.id}>
                          {mission.name} ({mission.count})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center">
                    <span className="sr-only">{copy.sortLabel}</span>
                    <select
                      value={sortOrder}
                      onChange={(event) => updateFilters({ sort: event.target.value === 'newest' ? 'newest' : null })}
                      className={SELECT_CLASS}
                    >
                      <option value="relevance">{copy.sortRelevance}</option>
                      <option value="newest">{copy.sortNewest}</option>
                    </select>
                  </label>
                </div>
              </div>

              {visibleResults.length === 0 ? (
                <div className="mt-4 flex flex-col items-start gap-3">
                  <EmptyState icon={<FunnelIcon className="size-5" />} title={copy.filteredEmptyTitle} body={copy.filteredEmptyBody} />
                  {isFiltered && (
                    <Button variant="secondary" onClick={() => updateFilters({ type: null, mission: null })}>
                      {copy.clearFilters}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <ol className="mt-4 flex flex-col gap-3">
                    {resultsPage.pageItems.map((result) => (
                      <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
                    ))}
                  </ol>
                  <Pagination
                    meta={resultsPage.meta}
                    onPageChange={resultsPage.setPage}
                    onPerPageChange={resultsPage.setPerPage}
                    className="mt-4"
                  />
                </>
              )}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <CountryPanel shortcuts={countryShortcuts} />
          <DetailSidePanel title={copy.tipsTitle}>
            <ul className="flex flex-col gap-2.5 text-body-sm text-text-secondary">
              {[copy.tipWordForms, copy.tipAllWords, copy.tipScope].map((tip) => (
                <li key={tip} className="flex gap-2">
                  <LightBulbIcon className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
                  {tip}
                </li>
              ))}
            </ul>
          </DetailSidePanel>
        </aside>
      </div>
    </div>
  )
}

function SearchForm({ initialValue, onSubmit }: { initialValue: string; onSubmit: (query: string) => void }) {
  const { t } = useI18n()
  const copy = t.search.results
  const [inputValue, setInputValue] = useState(initialValue)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(inputValue)
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="mt-5 flex flex-col gap-2.5 sm:flex-row">
      <label htmlFor="search-query" className="sr-only">
        {t.common.search}
      </label>
      <div className="relative min-w-0 flex-1">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          id="search-query"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={copy.placeholder}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className={`${FORM_INPUT_CLASS} h-12 rounded-xl pl-11 pr-11 [&::-webkit-search-cancel-button]:appearance-none`}
        />
        {inputValue && (
          <button
            type="button"
            aria-label={copy.clearButton}
            onClick={() => setInputValue('')}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-text-muted hover:bg-section-bg hover:text-primary"
          >
            <XMarkIcon className="size-4.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <Button type="submit" className="h-12 rounded-xl px-6">
        <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
        {copy.submitButton}
      </Button>
    </form>
  )
}

const INTRO_CARDS: { type: SearchResultType; icon: typeof BellAlertIcon; tile: string }[] = [
  { type: 'alert', icon: BellAlertIcon, tile: 'bg-accent-soft text-accent-soft-text' },
  { type: 'inquiry', icon: ChatBubbleLeftRightIcon, tile: 'bg-info-soft text-info-soft-text' },
  { type: 'periodic_report', icon: DocumentTextIcon, tile: 'bg-section-bg text-text-secondary' },
]

/** Shown before the first search: what each record type is searched on. */
function SearchIntro() {
  const { t } = useI18n()
  const copy = t.search.results
  const groupLabels: Record<SearchResultType, string> = {
    alert: copy.groupAlerts,
    inquiry: copy.groupInquiries,
    periodic_report: copy.groupReports,
  }
  return (
    <section aria-labelledby="search-intro-heading">
      <h2 id="search-intro-heading" className="text-h2 text-primary">
        {copy.introTitle}
      </h2>
      <p className="mt-1 text-body-sm text-text-secondary">{copy.introBody}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {INTRO_CARDS.map(({ type, icon: Icon, tile }) => {
          const isIndexed = type !== 'periodic_report'
          return (
            <li
              key={type}
              className={`flex flex-col gap-3 rounded-xl p-4 ${
                isIndexed ? 'border border-border bg-white shadow-sm' : 'border-[1.5px] border-dashed border-border-muted bg-page-bg'
              }`}
            >
              <span className={`grid size-9 place-items-center rounded-lg ${tile}`} aria-hidden="true">
                <Icon className="size-5" />
              </span>
              <span>
                <strong className="block text-h4 text-primary">{groupLabels[type]}</strong>
                <span className={`text-body-sm ${isIndexed ? 'text-text-secondary' : 'italic text-text-muted'}`}>
                  {copy.searchedFields[type]}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ResultsSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        {label}
      </p>
      <div className="h-5 w-48 animate-pulse rounded bg-section-bg" aria-hidden="true" />
      <ul className="mt-4 flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <li key={index} className="flex gap-3.5 rounded-xl border border-border bg-white p-5 shadow-sm">
            <span className="hidden size-10 shrink-0 animate-pulse rounded-lg bg-section-bg sm:block" />
            <span className="flex flex-1 flex-col gap-2.5">
              <span className="h-3.5 w-40 animate-pulse rounded bg-section-bg" />
              <span className="h-4.5 w-3/5 animate-pulse rounded bg-section-bg" />
              <span className="h-3.5 w-full animate-pulse rounded bg-section-bg" />
              <span className="h-3.5 w-4/5 animate-pulse rounded bg-section-bg" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** FR-SEARCH-004 entry point: a free-text country box plus one-click links to countries in the current alert hits. */
function CountryPanel({ shortcuts }: { shortcuts: [string, number][] }) {
  const { t } = useI18n()
  const copy = t.search.results
  const navigate = useNavigate()
  const [country, setCountry] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = country.trim()
    if (trimmed) {
      navigate(countryProfilePath(trimmed))
    }
  }

  return (
    <DetailSidePanel title={copy.countryTitle}>
      <p className="flex gap-2 text-body-sm text-text-secondary">
        <GlobeAltIcon className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
        {copy.countryBody}
      </p>

      {shortcuts.length > 0 && (
        <div>
          <p className="mb-1.5 text-caption font-semibold uppercase tracking-wider text-text-secondary">{copy.countriesInResults}</p>
          <ul className="flex flex-wrap gap-1.5">
            {shortcuts.map(([name, count]) => (
              <li key={name}>
                <Link
                  to={countryProfilePath(name)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-caption font-semibold text-primary hover:border-border-muted hover:bg-section-bg"
                >
                  {name}
                  <span className="font-mono text-[0.6875rem] font-medium text-text-secondary">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="country-profile-input" className="text-body-sm font-semibold text-text-secondary">
          {copy.countryLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="country-profile-input"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder={copy.countryPlaceholder}
            className={`${FORM_INPUT_CLASS} min-w-0 flex-1`}
          />
          <Button type="submit" variant="secondary" disabled={country.trim().length === 0} className="shrink-0 rounded-lg">
            {copy.countryButton}
          </Button>
        </div>
      </form>
    </DetailSidePanel>
  )
}
