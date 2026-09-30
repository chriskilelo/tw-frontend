import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  SignalIcon,
  UserMinusIcon,
} from '@heroicons/react/20/solid'
import type { ComplianceDashboard, ComplianceMissionRow, ReportComplianceStatus, ReportingPeriod } from '../../api/reports'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { StackedBar, ProgressRing } from '../../components/dashboard/visuals'
import { CHART_COLORS, type StackSegment } from '../../components/dashboard/chartTheme'
import { useI18n } from '../../i18n/context'
import { formatDate, formatRelativeTime, localeFor } from '../../lib/formatters'
import { ComplianceStatusBadge, ComplianceStatusIcon } from './ReportStatusBadge'
import { formatDay, formatPeriodRange } from './reportPresentation'
import { COMPLIANCE_COLORS, COMPLIANCE_STATUSES, LIVE_REFRESH_MS, markBackground } from './complianceTheme'

interface ComplianceBoardProps {
  title: string
  subtitle: string
  queryKey: readonly unknown[]
  fetchBoard: (periodLabel?: string) => Promise<ComplianceDashboard>
}

/**
 * FR-RPT-018 (and the PS console, FR-SDT-001): each mission's submission status for a
 * reporting period — Submitted On Time, Submitted Late, Draft In Progress or Not Started —
 * straight from the reports, re-polled so it moves as reports are submitted. A draft shows its
 * section progress, never its content; only a submitted report can be opened (FR-RPT-017).
 * The history grid shows the same statuses for the quarters before. `?period=` and
 * `?status=` make every view linkable.
 */
export function ComplianceBoard({ title, subtitle, queryKey, fetchBoard }: ComplianceBoardProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.reports.board
  const [searchParams, setSearchParams] = useSearchParams()
  const period = searchParams.get('period') || undefined
  const statusParam = searchParams.get('status')
  const statusFilter = COMPLIANCE_STATUSES.find((status) => status === statusParam)
  const [search, setSearch] = useState('')
  const [, setTick] = useState(0)
  const statusGroupId = useId()

  const boardQuery = useQuery({
    queryKey: [...queryKey, period ?? 'current'],
    queryFn: () => fetchBoard(period),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 15000)
    return () => window.clearInterval(timer)
  }, [])

  function setParam(key: 'period' | 'status', value: string | null) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  const board = boardQuery.data

  if (boardQuery.isError && !board) {
    return (
      <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
        <h1 className="text-h1 text-primary">{title}</h1>
        <div role="alert" className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
            <ExclamationTriangleIcon className="size-5" />
          </span>
          <p className="max-w-md text-body text-text-secondary">{copy.loadError}</p>
          <button
            type="button"
            onClick={() => void boardQuery.refetch()}
            className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light"
          >
            <ArrowPathIcon aria-hidden="true" className="size-4" />
            {copy.retry}
          </button>
        </div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7" role="status" aria-live="polite">
        <span className="sr-only">{copy.loading}</span>
        <div aria-hidden="true" className="h-16 rounded-xl bg-white motion-safe:animate-pulse" />
        <div aria-hidden="true" className="h-44 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
        <div aria-hidden="true" className="h-96 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
      </div>
    )
  }

  const summary = board.summary
  const submitted = summary.submitted_on_time + summary.submitted_late
  const counts: Record<ReportComplianceStatus, number> = {
    submitted_on_time: summary.submitted_on_time,
    submitted_late: summary.submitted_late,
    draft_in_progress: summary.draft_in_progress,
    not_started: summary.not_started,
  }
  const segments: StackSegment[] = COMPLIANCE_STATUSES.map((status) => ({
    key: status,
    label: t.reports.complianceStatus[status],
    value: counts[status],
    color: COMPLIANCE_COLORS[status],
    hatched: status === 'not_started',
  }))

  const needle = search.trim().toLowerCase()
  const missions = board.missions.filter(
    (row) =>
      (!statusFilter || row.status === statusFilter) &&
      (needle === '' || [row.mission_name, row.mission_city, row.host_country, row.attache?.full_name].some((value) => value?.toLowerCase().includes(needle))),
  )
  const periodOptions = board.available_periods.map((option) => ({ value: option.label, label: copy.periodOption(option.label, formatPeriodRange(option.start, option.end, locale)) }))
  if (!periodOptions.some((option) => option.value === board.period_label)) {
    periodOptions.push({ value: board.period_label, label: board.period_label })
  }

  return (
    <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7" data-testid="compliance-board">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-primary">{title}</h1>
          <p className="mt-1 text-body text-text-secondary">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72 max-w-full">
            <Select
              label={copy.periodLabel}
              value={board.period_label}
              onChange={(event) => setParam('period', event.target.value || null)}
              options={periodOptions}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2 pb-1.5 text-caption text-text-secondary">
            <span className="inline-flex items-center gap-1 font-semibold text-success-soft-text">
              <SignalIcon aria-hidden="true" className="size-4" />
              {copy.live}
            </span>
            <span aria-live="off">{copy.updated(formatRelativeTime(new Date(boardQuery.dataUpdatedAt || Date.now()).toISOString(), locale))}</span>
            <button
              type="button"
              onClick={() => void boardQuery.refetch()}
              aria-label={copy.refresh}
              title={copy.refresh}
              className="grid size-7 place-items-center rounded-md text-text-muted hover:bg-section-bg hover:text-primary"
            >
              <ArrowPathIcon aria-hidden="true" className={`size-4 ${boardQuery.isFetching ? 'motion-safe:animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {board.period && <PhaseBanner period={board.period} locale={locale} />}

      <div className={`grid gap-4 lg:grid-cols-12 ${boardQuery.isFetching ? 'opacity-80 transition-opacity' : 'transition-opacity'}`}>
        <section className="flex items-center gap-5 rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-4" aria-label={copy.submittedOf(submitted, summary.total)}>
          <ProgressRing value={submitted} total={Math.max(summary.total, 1)} label={copy.ringLabel(submitted, summary.total)} caption={copy.ringCaption} color={CHART_COLORS.onTrack} />
          <div className="min-w-0 space-y-1.5">
            <p className="text-h4 text-primary">{copy.submittedOf(submitted, summary.total)}</p>
            <p className="text-body-sm text-text-secondary">{copy.onTimeShare(summary.submitted_on_time)}</p>
            {summary.overdue > 0 && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-0.5 text-caption font-semibold text-danger-soft-text">
                <ClockIcon aria-hidden="true" className="size-3.5" />
                {copy.overdueCount(summary.overdue)}
              </p>
            )}
            {summary.vacant > 0 && (
              <p className="flex items-center gap-1.5 text-caption text-text-secondary">
                <UserMinusIcon aria-hidden="true" className="size-3.5" />
                {copy.vacantCount(summary.vacant)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-8" aria-labelledby={statusGroupId}>
          <h2 id={statusGroupId} className="sr-only">
            {copy.filterByStatus}
          </h2>
          <div role="group" aria-label={copy.filterByStatus} className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {COMPLIANCE_STATUSES.map((status) => {
              const active = statusFilter === status
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParam('status', active ? null : status)}
                  data-testid={`compliance-tile-${status}`}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                    active ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border hover:bg-section-bg'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-body-sm font-semibold text-text-secondary">
                    <span aria-hidden="true" className="grid size-5 place-items-center rounded text-white" style={{ background: markBackground(status) }}>
                      <ComplianceStatusIcon status={status} className="size-3.5" />
                    </span>
                    {t.reports.complianceStatus[status]}
                  </span>
                  <span className="text-h2 font-semibold text-primary">{counts[status]}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-4">
            <StackedBar segments={segments} showLegend={false} />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-white shadow-sm" aria-label={copy.columnMission}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
          <div className="relative w-full sm:w-80">
            <Input type="search" label={copy.searchLabel} placeholder={copy.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} className="w-full pl-9" />
            <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 size-4 text-text-muted" />
          </div>
          {statusFilter && (
            <button type="button" onClick={() => setParam('status', null)} className="text-body-sm font-semibold text-info-soft-text hover:underline">
              {copy.allStatuses}
            </button>
          )}
        </div>
        {board.missions.length === 0 ? (
          <p className="px-4 py-10 text-center text-body text-text-secondary">{copy.empty}</p>
        ) : missions.length === 0 ? (
          <p className="px-4 py-10 text-center text-body text-text-secondary">{copy.noMatch}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-body-sm">
              <caption className="sr-only">{title}</caption>
              <thead className="bg-section-bg">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnMission}
                  </th>
                  <th scope="col" className="hidden px-4 py-2 text-left font-semibold text-text-secondary md:table-cell">
                    {copy.columnAttache}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnStatus}
                  </th>
                  <th scope="col" className="hidden px-4 py-2 text-left font-semibold text-text-secondary sm:table-cell">
                    {copy.columnDetail}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    <span className="sr-only md:not-sr-only">{copy.columnAction}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {missions.map((row) => (
                  <MissionRow key={row.mission_id} row={row} locale={locale} deadline={board.period ? formatDay(board.period.deadline, locale) : null} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <HistoryGrid board={board} locale={locale} />
    </div>
  )
}

function PhaseBanner({ period, locale }: { period: ReportingPeriod; locale: string }) {
  const { t } = useI18n()
  const copy = t.reports.board.phaseBanner
  const deadline = formatDay(period.deadline, locale)
  const text =
    period.phase === 'open'
      ? copy.open(deadline, Math.max(0, period.days_to_deadline))
      : period.phase === 'closed'
        ? copy.closed(deadline)
        : period.phase === 'in_progress'
          ? copy.in_progress(deadline)
          : copy.upcoming(deadline)
  const tone =
    period.phase === 'closed'
      ? 'border-atrisk/40 bg-atrisk-soft text-atrisk-soft-text'
      : period.phase === 'open'
        ? 'border-success/30 bg-success-soft text-success-soft-text'
        : 'border-info/30 bg-info-soft text-info-soft-text'

  return (
    <p className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-body-sm font-medium ${tone}`} data-testid="compliance-phase">
      <CalendarDaysIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="font-semibold">
        {period.label} · {formatPeriodRange(period.start, period.end, locale)}
      </span>
      <span>{text}</span>
    </p>
  )
}

function MissionRow({ row, locale, deadline }: { row: ComplianceMissionRow; locale: string; deadline: string | null }) {
  const { t } = useI18n()
  const copy = t.reports.board
  const highlight = row.status === 'submitted_late' ? 'bg-atrisk-soft/40' : row.is_overdue ? 'bg-danger-soft/40' : 'bg-white'
  let detail: ReactNode
  if (row.submitted_at) {
    detail = <span className="text-text-primary">{copy.submittedOn(formatDate(row.submitted_at, locale))}</span>
  } else if (row.progress) {
    const { complete, started, total } = row.progress
    detail = (
      <span className="block max-w-56" title={copy.draftPrivate}>
        <span className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-section-bg" aria-hidden="true">
          <span className="h-full bg-success" style={{ width: `${total > 0 ? (complete / total) * 100 : 0}%` }} />
          <span className="h-full bg-info" style={{ width: `${total > 0 ? (started / total) * 100 : 0}%` }} />
        </span>
        <span className="mt-0.5 block text-caption text-text-secondary">{copy.progress(complete, total)}</span>
        {row.last_activity_at && <span className="block text-caption text-text-secondary">{copy.lastActivity(formatRelativeTime(row.last_activity_at, locale))}</span>}
      </span>
    )
  } else {
    detail = <span className="text-text-secondary">{deadline ? t.reports.deadline.dueOn(deadline) : '—'}</span>
  }

  return (
    <tr className={highlight} data-testid={`compliance-row-${row.mission_id}`}>
      <td className="px-4 py-3 align-top">
        <span className="font-semibold text-primary">{row.mission_name}</span>
        {(row.mission_city || row.host_country) && (
          <span className="block text-caption text-text-secondary">{[row.mission_city, row.host_country].filter(Boolean).join(', ')}</span>
        )}
      </td>
      <td className="hidden px-4 py-3 align-top md:table-cell">
        {row.attache ? (
          <span className="text-text-primary">{row.attache.full_name}</span>
        ) : (
          <span className="inline-flex items-center gap-1 italic text-text-muted">
            <UserMinusIcon aria-hidden="true" className="size-3.5" />
            {copy.vacant}
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <ComplianceStatusBadge status={row.status} />
          {row.status === 'submitted_late' && row.days_overdue !== null && (
            <span className="text-caption font-semibold text-atrisk-soft-text">{t.reports.timeliness.late(row.days_overdue)}</span>
          )}
          {row.is_overdue && row.days_overdue !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-caption font-semibold text-danger-soft-text">
              <ClockIcon aria-hidden="true" className="size-3" />
              {t.reports.timeliness.overdue(row.days_overdue)}
            </span>
          )}
        </div>
      </td>
      <td className="hidden px-4 py-3 align-top sm:table-cell">{detail}</td>
      <td className="px-4 py-3 align-top">
        {row.report_id ? (
          <Link
            to={`/reports/${row.report_id}`}
            aria-label={copy.openReportAria(row.mission_name)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-info hover:underline"
          >
            <EyeIcon aria-hidden="true" className="size-4" />
            <span className="hidden md:inline">{copy.openReport}</span>
          </Link>
        ) : (
          <span aria-hidden="true" className="text-text-muted">
            —
          </span>
        )}
      </td>
    </tr>
  )
}

/** Each mission's status over the recent quarters: an icon-marked cell per quarter, with a legend and totals. */
function HistoryGrid({ board, locale }: { board: ComplianceDashboard; locale: string }) {
  const { t } = useI18n()
  const copy = t.reports.board
  const history = board.history
  const headingId = useId()

  if (history.periods.length === 0 || history.missions.length === 0) {
    return null
  }

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5" data-testid="compliance-history">
      <h2 id={headingId} className="text-h3 text-primary">
        {copy.historyTitle}
      </h2>
      <p className="mt-0.5 text-body-sm text-text-secondary">{copy.historySubtitle}</p>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-text-secondary">
        {COMPLIANCE_STATUSES.map((status) => (
          <li key={status} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="grid size-4 place-items-center rounded text-white" style={{ background: markBackground(status) }}>
              <ComplianceStatusIcon status={status} className="size-3" />
            </span>
            {t.reports.complianceStatus[status]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-4 rounded ring-2 ring-danger ring-offset-1" />
          {t.reports.board.overdueMark}
        </li>
      </ul>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-body-sm">
          <caption className="sr-only">{copy.historyTitle}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-text-secondary">
                {copy.historyMission}
              </th>
              {history.periods.map((period) => (
                <th key={period.label} scope="col" className={`px-2 py-2 text-center font-semibold ${period.label === board.period_label ? 'text-primary' : 'text-text-secondary'}`}>
                  <span className="block whitespace-nowrap">{period.label}</span>
                  <span className="block whitespace-nowrap text-[0.6875rem] font-normal text-text-muted">{formatPeriodRange(period.start, period.end, locale)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.missions.map((mission) => (
              <tr key={mission.mission_id}>
                <th scope="row" className="sticky left-0 whitespace-nowrap border-t border-border bg-white px-3 py-1.5 text-left font-medium text-text-primary">
                  {mission.mission_name}
                </th>
                {mission.cells.map((cell) => {
                  const label = copy.historyCell(mission.mission_name, cell.label, `${t.reports.complianceStatus[cell.status]}${cell.is_overdue ? `, ${copy.overdueMark}` : ''}`)
                  const mark = (
                    <span
                      className={`grid size-8 place-items-center rounded-md text-white ${cell.is_overdue ? 'ring-2 ring-danger ring-offset-1' : ''}`}
                      style={{ background: markBackground(cell.status) }}
                    >
                      <ComplianceStatusIcon status={cell.status} className="size-4" />
                    </span>
                  )
                  return (
                    <td key={cell.label} className={`border-t border-border px-2 py-1.5 text-center ${cell.label === board.period_label ? 'bg-section-bg/60' : ''}`}>
                      {cell.report_id ? (
                        <Link to={`/reports/${cell.report_id}`} aria-label={label} title={label} className="inline-grid rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                          {mark}
                        </Link>
                      ) : (
                        <span role="img" aria-label={label} title={label} className="inline-grid">
                          {mark}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="sticky left-0 border-t-2 border-border-muted bg-white px-3 py-2 text-left font-semibold text-text-secondary">
                {copy.historyTotals}
              </th>
              {history.totals.map((total) => {
                const done = total.submitted_on_time + total.submitted_late
                const all = done + total.draft_in_progress + total.not_started
                return (
                  <td key={total.label} className="border-t-2 border-border-muted px-2 py-2 text-center font-mono text-caption font-semibold text-text-primary">
                    {done}/{all}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-caption text-text-muted">
        <InformationCircleIcon aria-hidden="true" className="size-3.5" />
        {copy.draftPrivate}
      </p>
    </section>
  )
}
