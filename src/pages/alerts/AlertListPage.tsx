import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listAlerts, type Alert, type AlertIntelligenceType, type AlertStatus } from '../../api/alerts'
import { search, type SearchResult } from '../../api/search'
import { useAuth, isReadOnlyRole } from '../../hooks/useAuth'
import { Table, type TableColumn } from '../../components/Table'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { SearchSnippet } from '../../components/SearchSnippet'
import { Pagination, DEFAULT_PER_PAGE } from '../../components/Pagination'
import { AlertStatusBadge } from './AlertStatusBadge'
import { useI18n } from '../../i18n/context'

const SEARCH_DEBOUNCE_MS = 300

const STATUS_OPTIONS: AlertStatus[] = ['new', 'assigned', 'acknowledged']
const INTELLIGENCE_TYPE_OPTIONS: AlertIntelligenceType[] = ['opportunities', 'trade_barriers']

/** FR-ALERT-006, FR-ALERT-014. Filterable/searchable table of alerts, card list below the sm (481px) breakpoint. */
export default function AlertListPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { role } = useAuth()
  const canCreate = !isReadOnlyRole(role?.name) && role?.name === 'Ministry Attache'
  const [status, setStatus] = useState<AlertStatus | ''>('')
  const [intelligenceType, setIntelligenceType] = useState<AlertIntelligenceType | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [status, intelligenceType, perPage])

  const isSearching = debouncedQuery.length > 0

  const listQuery = useQuery({
    queryKey: ['alerts', { status, intelligenceType, page, perPage }],
    queryFn: () =>
      listAlerts({
        status: status || undefined,
        intelligence_type: intelligenceType || undefined,
        page,
        per_page: perPage,
      }),
    enabled: !isSearching,
  })

  const searchQuery = useQuery({
    queryKey: ['alerts', 'search', debouncedQuery],
    queryFn: () => search(debouncedQuery),
    enabled: isSearching,
  })

  const alerts = listQuery.data?.data ?? []
  const searchResults = (searchQuery.data ?? []).filter((result) => result.type === 'alert')

  function goToAlert(id: string) {
    navigate(`/alerts/${id}`)
  }

  const columns: TableColumn<Alert>[] = [
    {
      key: 'reference_number',
      header: t.alerts.list.columnReference,
      render: (row) => <span className="font-mono">{row.reference_number}</span>,
    },
    { key: 'country', header: t.alerts.list.columnCountry, render: (row) => row.country },
    {
      key: 'intelligence_type',
      header: t.alerts.list.columnIntelligenceType,
      render: (row) => t.alerts.intelligenceType[row.intelligence_type],
    },
    {
      key: 'status',
      header: t.alerts.list.columnStatus,
      render: (row) => <AlertStatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      header: t.alerts.list.columnSubmittedAt,
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 text-primary">{t.alerts.list.title}</h1>
        {canCreate && (
          <Link to="/alerts/new">
            <Button variant="primary">{t.alerts.list.newAlertButton}</Button>
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">{t.alerts.list.filterStatus}</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as AlertStatus | '')}
              className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">{t.alerts.list.allStatuses}</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t.alerts.status[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">
              {t.alerts.list.filterIntelligenceType}
            </span>
            <select
              value={intelligenceType}
              onChange={(event) => setIntelligenceType(event.target.value as AlertIntelligenceType | '')}
              className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">{t.alerts.list.allIntelligenceTypes}</option>
              {INTELLIGENCE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t.alerts.intelligenceType[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Input
          label={t.common.search}
          placeholder={t.alerts.list.searchPlaceholder}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="sm:w-64"
        />
      </div>

      <div className="mt-6">
        {isSearching ? (
          <SearchResultsList results={searchResults} onSelect={goToAlert} />
        ) : (
          <>
            {/* Table (>=481px). Table.tsx has no built-in responsive collapse, so the
                card list below is a parallel rendering, not a CSS-only transform of it. */}
            <div className="hidden sm:block">
              <Table
                columns={columns}
                data={alerts}
                rowKey={(row) => row.id}
                emptyMessage={t.alerts.list.empty}
                onRowClick={(row) => goToAlert(row.id)}
              />
            </div>
            <div className="sm:hidden">
              <AlertCardList alerts={alerts} onSelect={goToAlert} />
            </div>
            {listQuery.data?.meta && (
              <Pagination
                meta={listQuery.data.meta}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
                className="mt-4"
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AlertCardList({ alerts, onSelect }: { alerts: Alert[]; onSelect: (id: string) => void }) {
  const { t } = useI18n()
  if (alerts.length === 0) {
    return <p className="py-6 text-center text-body text-text-muted">{t.alerts.list.empty}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <li key={alert.id}>
          <button
            type="button"
            onClick={() => onSelect(alert.id)}
            className="w-full rounded-lg border border-border bg-white p-4 text-left shadow-sm hover:bg-section-bg"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-body-sm text-text-primary">{alert.reference_number}</span>
              <AlertStatusBadge status={alert.status} />
            </div>
            <p className="mt-2 text-body text-text-primary">{alert.country}</p>
            <p className="text-body-sm text-text-muted">{t.alerts.intelligenceType[alert.intelligence_type]}</p>
            <p className="mt-1 text-caption text-text-muted">{new Date(alert.created_at).toLocaleString()}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}

function SearchResultsList({ results, onSelect }: { results: SearchResult[]; onSelect: (id: string) => void }) {
  const { t } = useI18n()
  if (results.length === 0) {
    return <p className="py-6 text-center text-body text-text-muted">{t.alerts.list.empty}</p>
  }

  return (
    <div>
      <h2 className="text-h3 text-primary">{t.alerts.list.searchResultsTitle}</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {results.map((result) => (
          <li key={result.id}>
            <button
              type="button"
              onClick={() => onSelect(result.id)}
              className="w-full rounded-lg border border-border bg-white p-4 text-left shadow-sm hover:bg-section-bg"
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
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
