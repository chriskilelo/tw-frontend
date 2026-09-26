import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { search, type SearchResult, type SearchResultType } from '../../api/search'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { SearchSnippet } from '../../components/SearchSnippet'
import { SearchResultTypeBadge } from './SearchResultTypeBadge'
import { useI18n } from '../../i18n/context'

const GROUP_ORDER: SearchResultType[] = ['alert', 'inquiry', 'periodic_report']

/**
 * FR-SEARCH-001 to 003. GET /api/v1/search?q={query} merges alerts,
 * inquiries, and periodic reports ranked by ts_rank (App\Services\SearchService);
 * this page re-groups that flat, rank-ordered list by `type` for display,
 * preserving each group's internal relevance order.
 */
export default function SearchResultsPage() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const [inputValue, setInputValue] = useState(query)

  const searchQuery = useQuery({
    queryKey: ['search', query],
    queryFn: () => search(query),
    enabled: query.trim().length > 0,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = inputValue.trim()
    setSearchParams(trimmed ? { q: trimmed } : {})
  }

  const results = searchQuery.data ?? []
  const grouped = GROUP_ORDER.map((type) => ({
    type,
    items: results.filter((result) => result.type === type),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.search.results.title}</h1>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          label={t.common.search}
          placeholder={t.search.results.placeholder}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className="sm:w-96"
        />
        <Button type="submit">{t.search.results.submitButton}</Button>
      </form>

      <div className="mt-6">
        {query.trim().length === 0 ? (
          <p className="text-body text-text-muted">{t.search.results.prompt}</p>
        ) : searchQuery.isLoading ? (
          <p className="text-body text-text-muted">{t.common.loading}</p>
        ) : grouped.length === 0 ? (
          <p className="text-body text-text-muted">{t.search.results.empty}</p>
        ) : (
          <div className="flex flex-col gap-8">
            {grouped.map((group) => (
              <SearchResultGroup key={group.type} type={group.type} items={group.items} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SearchResultGroup({ type, items }: { type: SearchResultType; items: SearchResult[] }) {
  const { t } = useI18n()
  const GROUP_TITLE: Record<SearchResultType, string> = {
    alert: t.search.results.groupAlerts,
    inquiry: t.search.results.groupInquiries,
    periodic_report: t.search.results.groupReports,
  }
  return (
    <section>
      <div className="flex items-center gap-2">
        <SearchResultTypeBadge type={type} />
        <h2 className="text-h3 text-primary">{GROUP_TITLE[type]}</h2>
        <span className="text-caption text-text-muted">
          {t.search.results.resultsCountLabel.replace('{count}', String(items.length))}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {items.map((result) => (
          <li key={`${result.type}-${result.id}`}>
            <Link
              to={result.link}
              className="block rounded-lg border border-border bg-white p-4 shadow-sm hover:bg-section-bg"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-body-sm text-text-primary">{result.reference_number}</span>
                {result.mission && <span className="text-caption text-text-muted">{result.mission}</span>}
              </div>
              <p className="mt-2 text-body text-text-primary">{result.summary}</p>
              {result.snippet && (
                <p className="mt-1 text-body-sm text-text-muted">
                  <SearchSnippet snippet={result.snippet} />
                </p>
              )}
              <p className="mt-1 text-caption text-text-muted">{new Date(result.date).toLocaleString()}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
