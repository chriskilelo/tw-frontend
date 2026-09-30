import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/20/solid'
import { getDirectiveOverview } from '../../api/sdt'
import type { Directive } from '../../api/directives'
import { Table, type TableColumn } from '../../components/Table'
import { Pagination } from '../../components/Pagination'
import { StatTile } from '../../components/dashboard/visuals'
import { CardLink } from '../../components/dashboard/layout'
import { useClientPagination } from '../../hooks/useClientPagination'
import { DirectiveDueBadge, DirectiveStaleBadge, DirectiveStatusBadge } from '../directives/DirectiveStatusBadge'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { formatNumber } from '../../lib/dashboardFormat'

/** Date-only values ("2026-10-12") are calendar days, not instants: format them in UTC. */
function formatDay(value: string, locale: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/**
 * FR-SDT-008: PS-level directive overview — App\Http\Controllers\Api\Sdt\DirectivesController::overview(),
 * gated server-side by MinistryPolicy::viewPsDashboard() (Ministry PS and Acting PS only).
 * The tiles are the department's all-time counts (DirectiveService::getSummary() without
 * filters) and link into the directive list; the filterable breakdown lives on
 * /directives/summary. Due and stale flags come from the API rows, never recomputed here.
 * Each row opens its directive through the description link (a row that is itself a button
 * would nest one interactive control inside another).
 */
export default function DirectiveOverviewPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.sdt.directiveOverview

  const overviewQuery = useQuery({ queryKey: ['sdt', 'directives', 'overview'], queryFn: getDirectiveOverview })
  const overview = overviewQuery.data
  const recentPage = useClientPagination(overview?.recent_directives ?? [])
  const stalePage = useClientPagination(overview?.stale_directives ?? [])

  const columns: TableColumn<Directive>[] = [
    {
      key: 'description',
      header: t.directives.list.columnDirective,
      render: (row) => (
        <Link to={`/directives/${row.id}`} title={row.description} className="line-clamp-2 min-w-40 max-w-sm font-semibold text-primary hover:underline">
          {row.description}
        </Link>
      ),
    },
    { key: 'mission', header: copy.columnMission, render: (row) => row.mission?.name ?? '—' },
    { key: 'target_user', header: copy.columnTargetAttache, render: (row) => row.target_user?.full_name ?? '—' },
    {
      key: 'status',
      header: copy.columnStatus,
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <DirectiveStatusBadge status={row.status} />
          {row.is_stale && <DirectiveStaleBadge />}
        </span>
      ),
    },
    {
      key: 'target_completion_date',
      header: copy.columnDueDate,
      render: (row) => (
        <span className="flex flex-col items-start gap-1">
          <DirectiveDueBadge dueState={row.due_state} daysUntilDue={row.days_until_due} />
          {row.target_completion_date && (
            <span className="whitespace-nowrap text-caption text-text-muted">{formatDay(row.target_completion_date, locale)}</span>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-310 space-y-6 px-4 py-6 sm:px-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        <CardLink to="/directives/summary">{t.directives.list.summaryLink}</CardLink>
      </header>

      {overviewQuery.isError && (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-8 text-center shadow-sm">
          <p className="max-w-md text-body text-text-secondary">{t.directives.list.loadError}</p>
          <button
            type="button"
            onClick={() => void overviewQuery.refetch()}
            className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light"
          >
            <ArrowPathIcon aria-hidden="true" className="size-4" />
            {t.directives.list.retry}
          </button>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={copy.tileIssued}
            value={formatNumber(overview.summary.issued, locale)}
            icon={<PaperAirplaneIcon />}
            tone="info"
            to="/directives?status=issued"
          />
          <StatTile
            label={copy.tileInProgress}
            value={formatNumber(overview.summary.in_progress, locale)}
            icon={<ArrowPathIcon />}
            tone="directive"
            to="/directives?status=in_progress"
          />
          <StatTile
            label={copy.tileOverdue}
            value={formatNumber(overview.summary.overdue, locale)}
            icon={<ExclamationTriangleIcon />}
            tone="danger"
            to="/directives?due=overdue"
          />
          <StatTile
            label={copy.tileCompleted}
            value={formatNumber(overview.summary.completed, locale)}
            icon={<CheckCircleIcon />}
            tone="success"
            to="/directives?status=completed"
          />
        </div>
      )}

      <section>
        <h2 className="text-h2 text-primary">{copy.recentTitle}</h2>
        <div className="mt-3">
          <Table
            columns={columns}
            data={recentPage.pageItems}
            rowKey={(row) => row.id}
            emptyMessage={copy.recentEmpty}
            getRowTestId={(row) => `overview-recent-${row.id}`}
          />
          <Pagination meta={recentPage.meta} onPageChange={recentPage.setPage} onPerPageChange={recentPage.setPerPage} className="mt-4" />
        </div>
      </section>

      <section>
        <h2 className="text-h2 text-primary">{copy.staleTitle}</h2>
        <div className="mt-3">
          <Table
            columns={columns}
            data={stalePage.pageItems}
            rowKey={(row) => row.id}
            emptyMessage={copy.staleEmpty}
            getRowTestId={(row) => `overview-stale-${row.id}`}
          />
          <Pagination meta={stalePage.meta} onPageChange={stalePage.setPage} onPerPageChange={stalePage.setPerPage} className="mt-4" />
        </div>
      </section>
    </div>
  )
}
