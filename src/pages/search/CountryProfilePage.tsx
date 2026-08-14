import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCountryProfile } from '../../api/search'
import type { AlertStatus } from '../../api/alerts'
import { Table, type TableColumn } from '../../components/Table'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { AlertStatusBadge } from '../alerts/AlertStatusBadge'
import type { CountryProfileAlert } from '../../api/search'
import en from '../../i18n/en'

/**
 * FR-SEARCH-004. App\Services\SearchService::countryProfile() aggregates
 * alerts only — neither inquiries nor periodic_reports carries a `country`
 * column (CLAUDE.md Section 6, Session 15 note), so "open inquiries" and
 * "recent report summaries" have no backend data source yet. Both sections
 * render an explicit unavailable notice rather than silently omitting them
 * or fabricating a mission-level proxy.
 */
export default function CountryProfilePage() {
  const { country: routeCountry } = useParams<{ country: string }>()
  const navigate = useNavigate()
  const country = routeCountry ?? ''
  const [inputValue, setInputValue] = useState(country)

  const profileQuery = useQuery({
    queryKey: ['country-profile', country],
    queryFn: () => getCountryProfile(country),
    enabled: country.trim().length > 0,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = inputValue.trim()
    if (trimmed) {
      navigate(`/search/countries/${encodeURIComponent(trimmed)}`)
    }
  }

  const columns: TableColumn<CountryProfileAlert>[] = [
    {
      key: 'reference_number',
      header: en.search.countryProfile.columnReference,
      render: (row) => <span className="font-mono">{row.reference_number}</span>,
    },
    {
      key: 'intelligence_type',
      header: en.search.countryProfile.columnIntelligenceType,
      render: (row) => row.intelligence_type,
    },
    { key: 'sector', header: en.search.countryProfile.columnSector, render: (row) => row.sector ?? '—' },
    {
      key: 'status',
      header: en.search.countryProfile.columnStatus,
      render: (row) => <AlertStatusBadge status={row.status as AlertStatus} />,
    },
    { key: 'mission', header: en.search.countryProfile.columnMission, render: (row) => row.mission ?? '—' },
    {
      key: 'created_at',
      header: en.search.countryProfile.columnDate,
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
  ]

  return (
    <div className="p-6">
      <Link to="/search" className="text-body-sm font-semibold text-accent-soft-text hover:underline">
        ← {en.search.countryProfile.backToSearch}
      </Link>

      <h1 className="mt-2 text-h1 text-primary">
        {en.search.countryProfile.title.replace('{country}', country || '…')}
      </h1>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          label={en.search.countryProfile.countryLabel}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className="sm:w-64"
        />
        <Button type="submit">{en.search.results.submitButton}</Button>
      </form>

      {profileQuery.isLoading && <p className="mt-6 text-body text-text-muted">{en.common.loading}</p>}

      {profileQuery.data && (
        <>
          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <p className="text-body-sm text-text-muted">{en.search.countryProfile.totalAlertsLabel}</p>
              <p className="mt-1 font-mono text-h1 text-primary">{profileQuery.data.total_alerts}</p>
            </div>
            <BreakdownCard
              title={en.search.countryProfile.byIntelligenceTypeTitle}
              breakdown={profileQuery.data.by_intelligence_type}
            />
            <BreakdownCard title={en.search.countryProfile.bySectorTitle} breakdown={profileQuery.data.by_sector} />
          </section>

          <section className="mt-8">
            <h2 className="text-h3 text-primary">{en.search.countryProfile.recentAlertsTitle}</h2>
            <div className="mt-3">
              <Table
                columns={columns}
                data={profileQuery.data.recent_alerts}
                rowKey={(row) => row.id}
                emptyMessage={en.search.countryProfile.empty}
                onRowClick={(row) => navigate(`/alerts/${row.id}`)}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-h3 text-primary">{en.search.countryProfile.openInquiriesTitle}</h2>
            <p className="mt-2 rounded border border-border bg-section-bg p-3 text-body-sm text-text-muted">
              {en.search.countryProfile.openInquiriesUnavailable}
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-h3 text-primary">{en.search.countryProfile.recentReportsTitle}</h2>
            <p className="mt-2 rounded border border-border bg-section-bg p-3 text-body-sm text-text-muted">
              {en.search.countryProfile.recentReportsUnavailable}
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function BreakdownCard({ title, breakdown }: { title: string; breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown)
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-body-sm text-text-muted">{title}</p>
      <dl className="mt-2 space-y-1 text-body-sm">
        {entries.length === 0 ? (
          <p className="text-text-muted">—</p>
        ) : (
          entries.map(([key, count]) => (
            <div key={key} className="flex justify-between">
              <dt className="text-text-secondary">{key}</dt>
              <dd className="font-mono text-text-primary">{count}</dd>
            </div>
          ))
        )}
      </dl>
    </div>
  )
}
