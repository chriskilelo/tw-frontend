import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BookOpenIcon, BuildingOffice2Icon, DocumentTextIcon, InformationCircleIcon, MagnifyingGlassIcon, UserIcon } from '@heroicons/react/20/solid'
import {
  listHqWorkspaceReports,
  type HqWorkspaceOverview,
  type HqWorkspaceReport,
  type HqWorkspaceReportFilters,
  type HqWorkspaceScope,
} from '../../../api/sdt'
import { Pagination, DEFAULT_PER_PAGE } from '../../../components/Pagination'
import { Select } from '../../../components/Select'
import { ReportTimelinessBadge } from '../../reports/ReportStatusBadge'
import { formatPeriodRange } from '../../reports/reportPresentation'
import { useI18n } from '../../../i18n/context'
import { retryUnlessClientError } from '../../../lib/apiErrors'
import { formatDate, localeFor } from '../../../lib/formatters'
import { ListSkeleton, OutsidePortfolioPill, SearchField, SectionEmpty } from './workspaceUi'
import { oneOf, type WorkspaceParams } from './workspaceState'
import { WorkspaceSectionError } from './WorkspaceSectionError'

const TIMELINESS = ['on_time', 'late'] as const
const SORTS = ['-submitted_at', 'submitted_at'] as const
const QUARTER_PATTERN = /^Q[1-4] \d{4}$/

/**
 * FR-SDT-015 (with FR-RPT-017): submitted quarterly reports from the missions in the
 * officer's portfolio (or the whole department), opened read-only on the report page. Drafts
 * never appear: an HQ officer sees submitted reports only (PeriodicReport::visibleTo()).
 */
export default function WorkspaceReports({ workspace, overview, scope }: { workspace: WorkspaceParams; overview?: HqWorkspaceOverview; scope: HqWorkspaceScope }) {
  const { t } = useI18n()
  const copy = t.sdt.hqWorkspace.reports
  const { params, update } = workspace
  const rawPeriod = params.get('period')
  const period = rawPeriod && QUARTER_PATTERN.test(rawPeriod) ? rawPeriod : undefined
  const timeliness = oneOf(params.get('timeliness'), TIMELINESS)
  const sort = oneOf(params.get('sort'), SORTS) ?? '-submitted_at'
  const hasFilters = Boolean(params.q || period || timeliness)
  const sectorsOnly = scope === 'portfolio' && overview?.portfolio.configured === true && !overview.portfolio.covers_missions

  const filters: HqWorkspaceReportFilters = {
    scope: params.scope,
    mission_id: params.missionId,
    period,
    timeliness,
    q: params.q || undefined,
    sort,
    page: params.page,
    per_page: params.perPage,
  }

  const listQuery = useQuery({
    queryKey: ['sdt', 'hq-workspace', 'reports', filters],
    queryFn: () => listHqWorkspaceReports(filters),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })

  const periodOptions = [...(overview?.filter_options.periods ?? [])]
  if (period && !periodOptions.includes(period)) {
    periodOptions.push(period)
  }
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-4">
      <div role="group" aria-label={t.sdt.hqWorkspace.filters.label} className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_11rem_10rem_11rem]">
          <SearchField label={t.sdt.hqWorkspace.filters.search} placeholder={copy.searchPlaceholder} value={params.q} onSearch={(value) => update({ q: value || null })} />
          <Select
            label={copy.periodLabel}
            value={period ?? ''}
            placeholder={copy.allPeriods}
            onChange={(event) => update({ period: event.target.value || null })}
            options={periodOptions.map((value) => ({ value, label: value }))}
          />
          <Select
            label={copy.timelinessLabel}
            value={timeliness ?? ''}
            placeholder={copy.timeliness.all}
            onChange={(event) => update({ timeliness: event.target.value || null })}
            options={TIMELINESS.map((value) => ({ value, label: copy.timeliness[value] }))}
          />
          <Select
            label={t.sdt.hqWorkspace.filters.sort}
            value={sort}
            onChange={(event) => update({ sort: event.target.value === '-submitted_at' ? null : event.target.value })}
            options={SORTS.map((value) => ({ value, label: copy.sort[value] }))}
          />
        </div>
        <p className="flex items-start gap-1.5 text-caption text-text-secondary">
          <InformationCircleIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {copy.readOnly}
        </p>
      </div>

      {sectorsOnly && (
        <p className="flex items-start gap-2 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-body-sm text-info-soft-text">
          <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t.sdt.hqWorkspace.portfolio.sectorsOnlyReports}
        </p>
      )}

      {listQuery.isError && !listQuery.data ? (
        <WorkspaceSectionError error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : !listQuery.data ? (
        <ListSkeleton label={t.sdt.hqWorkspace.loading} rows={3} />
      ) : rows.length === 0 ? (
        <SectionEmpty
          icon={hasFilters ? <MagnifyingGlassIcon /> : <DocumentTextIcon />}
          title={hasFilters ? t.sdt.hqWorkspace.noMatchTitle : copy.emptyTitle}
          body={hasFilters ? t.sdt.hqWorkspace.noMatchBody : copy.emptyBody}
          action={
            hasFilters ? (
              <button type="button" onClick={() => update({ q: null, period: null, timeliness: null })} className="text-body-sm font-semibold text-info-soft-text hover:underline">
                {t.sdt.hqWorkspace.filters.clear}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className={listQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <p aria-live="polite" className="mb-2 text-body-sm text-text-secondary">
            {t.sdt.hqWorkspace.filters.resultCount(meta?.total ?? rows.length)}
          </p>
          <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2" data-testid="workspace-report-list">
            {rows.map((report) => (
              <li key={report.id}>
                <ReportCard report={report} />
              </li>
            ))}
          </ul>
          {meta && (
            <Pagination
              meta={meta}
              onPageChange={(page) => update({ page: page > 1 ? String(page) : null }, false)}
              onPerPageChange={(perPage) => update({ per_page: perPage === DEFAULT_PER_PAGE ? null : String(perPage) })}
              className="mt-4"
            />
          )}
        </div>
      )}
    </div>
  )
}

function ReportCard({ report }: { report: HqWorkspaceReport }) {
  const { t, language } = useI18n()
  const copy = t.sdt.hqWorkspace.reports
  const locale = localeFor(language)
  const missionName = report.mission?.name ?? '—'

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:shadow-md motion-reduce:transition-none" data-testid={`workspace-report-${report.id}`}>
      <div className="flex flex-1 gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-success-soft text-success-soft-text">
          <DocumentTextIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-body font-semibold text-primary">{copy.title(missionName, report.reporting_period_label)}</h3>
            {report.in_portfolio === false && <OutsidePortfolioPill />}
          </div>
          {report.period_start_date && report.period_end_date && (
            <p className="text-caption text-text-secondary">{formatPeriodRange(report.period_start_date, report.period_end_date, locale)}</p>
          )}
          <div className="mt-1.5">
            <ReportTimelinessBadge report={{ status: 'submitted', is_late: report.is_late, is_overdue: false, days_overdue: 0 }} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-secondary">
            {report.mission?.host_country && (
              <span className="inline-flex items-center gap-1">
                <BuildingOffice2Icon aria-hidden="true" className="size-3.5" />
                {report.mission.host_country}
              </span>
            )}
            {report.authored_by && (
              <span className="inline-flex items-center gap-1">
                <UserIcon aria-hidden="true" className="size-3.5" />
                {report.authored_by.full_name}
              </span>
            )}
            {report.submitted_at && <span>{copy.submitted(formatDate(report.submitted_at, locale))}</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end border-t border-border pt-3">
        <Link
          to={`/reports/${report.id}`}
          aria-label={copy.readAria(missionName, report.reporting_period_label)}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-border bg-white px-3 text-body-sm font-semibold text-primary hover:bg-section-bg"
        >
          <BookOpenIcon aria-hidden="true" className="size-4" />
          {copy.read}
        </Link>
      </div>
    </article>
  )
}
