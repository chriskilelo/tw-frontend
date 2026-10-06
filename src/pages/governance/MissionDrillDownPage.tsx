import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowRightIcon, BuildingOffice2Icon, ClockIcon, InformationCircleIcon, NoSymbolIcon, TableCellsIcon } from '@heroicons/react/20/solid'
import { getMissionDrillDown } from '../../api/governance'
import { PanelEmpty } from '../../components/dashboard/DashboardCard'
import { useBreadcrumbLabel } from '../../hooks/useBreadcrumbs'
import { useI18n } from '../../i18n/context'
import { formatDate, formatRelativeTime, localeFor } from '../../lib/formatters'
import { ActivityTrendCard, DepartmentFilter, GovernanceUnavailable, QuarterSummary, SummarySkeleton, TypeBadge, ViewOnlyPill } from './governanceUi'
import { retryUnlessRefused, useQuarterLabel } from './governanceTheme'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * FR-MFA-002: one mission's summary metrics for the MFA HQ Officer and MFA Principal Secretary,
 * the same figures FR-HOM-002 gives the mission's own Head of Mission — this quarter against
 * last by type and status, and the quarterly trend — optionally for one department. The
 * departments show only whether a post is filled, and the latest submissions only their type,
 * date and department (FR-MFA-001 AC2). Read-only throughout.
 */
export default function MissionDrillDownPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.governance.mfaAwareness.drillDown
  const quarterLabel = useQuarterLabel()
  const { missionId = '' } = useParams<{ missionId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawMinistry = searchParams.get('ministry_id')
  const ministryId = rawMinistry && UUID_PATTERN.test(rawMinistry) ? rawMinistry : undefined

  const drillDownQuery = useQuery({
    queryKey: ['mfa-awareness', 'mission', missionId, ministryId ?? null],
    queryFn: () => getMissionDrillDown(missionId, ministryId),
    enabled: missionId !== '',
    retry: retryUnlessRefused,
    placeholderData: keepPreviousData,
  })

  const drillDown = drillDownQuery.data
  useBreadcrumbLabel(drillDown?.mission.name)

  if (drillDownQuery.isError && !drillDown) {
    return (
      <PageShell>
        <h1 className="text-h1 text-primary">{t.breadcrumbs.pages.missionSummary}</h1>
        <GovernanceUnavailable error={drillDownQuery.error} forbiddenBody={t.governance.unavailable.mfaBody} onRetry={() => void drillDownQuery.refetch()} />
      </PageShell>
    )
  }

  if (!drillDown) {
    return (
      <PageShell>
        <span className="block h-9 w-64 animate-pulse rounded bg-section-bg motion-reduce:animate-none" />
        <SummarySkeleton label={t.common.loading} />
      </PageShell>
    )
  }

  function selectDepartment(id: string | null) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (id) {
          next.set('ministry_id', id)
        } else {
          next.delete('ministry_id')
        }
        return next
      },
      { replace: true },
    )
  }

  const logLink = `/mfa-awareness?view=log&mission_id=${drillDown.mission.id}${ministryId ? `&ministry_id=${ministryId}` : ''}`

  return (
    <PageShell>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-primary">{drillDown.mission.name}</h1>
            <ViewOnlyPill label={t.governance.totalsOnly} />
            {!drillDown.mission.active && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-section-bg px-3 py-1 text-caption font-semibold text-text-secondary ring-1 ring-border">
                <NoSymbolIcon aria-hidden="true" className="size-3.5" />
                {copy.inactive}
              </span>
            )}
          </div>
          <p className="mt-1 text-body text-text-secondary">{copy.subtitle(drillDown.mission.host_country)}</p>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-caption font-semibold text-text-secondary shadow-sm ring-1 ring-border">
          <ClockIcon aria-hidden="true" className="size-4" />
          {drillDown.last_activity_at ? t.governance.missionActivity.lastActivity(formatRelativeTime(drillDown.last_activity_at, locale)) : t.governance.missionActivity.noActivityYet}
        </p>
      </header>

      <p className="flex items-start gap-2 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-body-sm text-info-soft-text">
        <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t.governance.mfaAwareness.aggregateNote}
      </p>

      <section aria-labelledby="drill-departments-heading" className="space-y-3">
        <h2 id="drill-departments-heading" className="text-h4 text-primary">
          {t.governance.departments.title}
        </h2>
        <DepartmentFilter departments={drillDown.departments} selectedId={ministryId ?? null} onSelect={selectDepartment} />
      </section>

      <section aria-labelledby="drill-summary-heading" className={`space-y-3 ${drillDownQuery.isFetching ? 'opacity-80 transition-opacity' : 'transition-opacity'}`}>
        <div>
          <h2 id="drill-summary-heading" className="text-h3 text-primary">
            {t.governance.summary.title}
          </h2>
          <p className="text-body-sm text-text-secondary">{t.governance.summary.subtitle(quarterLabel(drillDown.current_period), quarterLabel(drillDown.prior_period))}</p>
        </div>
        <QuarterSummary current={drillDown.current_period} prior={drillDown.prior_period} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ActivityTrendCard className="lg:col-span-7" points={drillDown.trend} />

        <section aria-labelledby="drill-recent-heading" className="flex min-w-0 flex-col rounded-xl border border-border bg-white shadow-sm lg:col-span-5">
          <header className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-section-bg text-text-secondary [&>svg]:size-5">
              <TableCellsIcon />
            </span>
            <div className="min-w-0">
              <h2 id="drill-recent-heading" className="text-h3 text-primary">
                {copy.recentTitle}
              </h2>
              <p className="mt-0.5 text-body-sm text-text-secondary">{copy.recentSubtitle}</p>
            </div>
          </header>
          <div className="flex-1 p-4 sm:p-5">
            {drillDown.recent.length === 0 ? (
              <PanelEmpty icon={<TableCellsIcon />} title={t.dashboard.common.emptyTitle} body={copy.recentEmpty} />
            ) : (
              <ul className="divide-y divide-border" data-testid="drill-recent">
                {drillDown.recent.map((entry, index) => (
                  <li key={`${entry.date}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <TypeBadge type={entry.type} />
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-body-sm text-text-primary">
                        <BuildingOffice2Icon aria-hidden="true" className="size-3.5 shrink-0 text-text-muted" />
                        <span className="truncate">{entry.ministry.name}</span>
                      </span>
                    </span>
                    <time dateTime={entry.date} className="whitespace-nowrap text-caption text-text-secondary">
                      {formatDate(entry.date, locale)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <footer className="border-t border-border px-4 py-3 sm:px-5">
            <Link to={logLink} className="inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline">
              {copy.viewLog}
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </footer>
        </section>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-310 space-y-6 px-4 py-6 sm:px-7">{children}</div>
}
