import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  ExclamationCircleIcon,
  EyeIcon,
  InformationCircleIcon,
  LockClosedIcon,
  PencilSquareIcon,
  PlayIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid'
import { createDraftReport, getReportPeriods, type ReportingPeriod } from '../../api/reports'
import { Button } from '../../components/Button'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'
import { localeFor } from '../../lib/formatters'
import { ReportStatusBadge, ReportTimelinessBadge } from './ReportStatusBadge'
import { formatDay, formatPeriodRange } from './reportPresentation'

const PHASE_STYLE: Record<ReportingPeriod['phase'], string> = {
  upcoming: 'bg-section-bg text-text-secondary',
  in_progress: 'bg-info-soft text-info-soft-text',
  open: 'bg-success-soft text-success-soft-text',
  closed: 'bg-section-bg text-text-secondary',
}

/**
 * /reports/new — FR-RPT-003: the attache chooses the quarter a report covers from the recent
 * reporting quarters, each showing its deadline and the mission's own report for it. A quarter
 * that already has a report opens that report instead of starting a duplicate (AC2, BR-007);
 * `?period=Q1 2026` (from a reminder or the dashboard) highlights one.
 */
export default function StartReportPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.reports.start
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const requested = searchParams.get('period')
  const selectedRef = useRef<HTMLElement>(null)

  const periodsQuery = useQuery({ queryKey: ['report-periods'], queryFn: getReportPeriods })

  const createMutation = useMutation({
    mutationFn: (label: string) => createDraftReport(label),
    onSuccess: (report) => {
      queryClient.setQueryData(['periodic-report', report.id], report)
      void queryClient.invalidateQueries({ queryKey: ['periodic-reports'] })
      void queryClient.invalidateQueries({ queryKey: ['report-periods'] })
      navigate(`/reports/${report.id}`, { replace: true })
    },
    onError: (error) => {
      const existing = isAxiosError<{ data?: { existing_report?: { id: string } } }>(error) ? error.response?.data?.data?.existing_report : undefined
      if (existing?.id) {
        navigate(`/reports/${existing.id}`, { replace: true })
      }
    },
  })

  const data = periodsQuery.data

  useEffect(() => {
    if (data && requested) {
      selectedRef.current?.scrollIntoView?.({ block: 'center' })
    }
  }, [data, requested])

  if (periodsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-3.5 py-3 text-body-sm text-danger-soft-text">
          <ExclamationCircleIcon aria-hidden="true" className="size-4.5 shrink-0" />
          <span className="min-w-0 flex-1">{copy.loadError}</span>
          <Button variant="secondary" onClick={() => void periodsQuery.refetch()}>
            <ArrowPathIcon aria-hidden="true" className="size-4" />
            {copy.retry}
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7" role="status" aria-live="polite">
        <span className="sr-only">{copy.loading}</span>
        <div aria-hidden="true" className="h-24 rounded-2xl bg-white motion-safe:animate-pulse" />
        <div aria-hidden="true" className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-48 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const missionName = data.missions[0]?.name ?? ''

  if (!data.can_create) {
    return (
      <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
        <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:p-6" data-testid="start-report-unavailable">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-section-bg text-primary">
            <LockClosedIcon className="size-5" />
          </span>
          <div>
            <h1 className="text-h3 text-primary">{copy.cannotCreateTitle}</h1>
            <p className="mt-1 text-body text-text-secondary">{copy.cannotCreateBody}</p>
            <Link to="/reports" className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-semibold text-info hover:underline">
              <ArrowLeftIcon aria-hidden="true" className="size-4" />
              {copy.backToList}
            </Link>
          </div>
        </section>
      </div>
    )
  }

  // The quarter to act on next: the one open for submission while it is still owed, else the
  // quarter in progress.
  const current = data.periods.find((period) => period.label === data.current.label)
  const suggested = current && current.report?.status !== 'submitted' ? current.label : data.periods.find((period) => period.phase === 'in_progress')?.label
  const createError =
    createMutation.isError && !(isAxiosError(createMutation.error) && createMutation.error.response?.status === 422 && (createMutation.error.response.data as { data?: { existing_report?: unknown } })?.data?.existing_report)
      ? apiErrorMessages(createMutation.error, copy.createError)
      : null

  return (
    <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7">
      <header className="min-w-0">
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        {missionName && <p className="mt-1 text-body text-text-secondary">{copy.subtitle(missionName)}</p>}
      </header>

      <p className="flex gap-2.5 rounded-xl border border-info/20 bg-info-soft/50 px-4 py-3 text-body-sm text-text-secondary">
        <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
        {copy.rule}
      </p>

      {createError && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3.5 py-3 text-body-sm text-danger-soft-text">
          <ExclamationCircleIcon aria-hidden="true" className="size-4 shrink-0" />
          {createError.join(' ')}
        </p>
      )}

      <section aria-label={copy.periodsLabel}>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.periods.map((period) => {
            const isSelected = requested === period.label
            const isSuggested = period.label === suggested
            const report = period.report ?? null
            const owed = !report && period.phase === 'closed'
            return (
              <li key={period.label}>
                <article
                  ref={isSelected ? selectedRef : undefined}
                  aria-labelledby={`period-${period.label.replace(' ', '-')}`}
                  data-testid={`period-card-${period.label}`}
                  className={`flex h-full flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm transition-shadow ${
                    isSelected ? 'border-accent ring-4 ring-accent-soft' : isSuggested ? 'border-info' : 'border-border'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 id={`period-${period.label.replace(' ', '-')}`} className="text-h3 text-primary">
                        {period.label}
                      </h2>
                      <p className="flex items-center gap-1.5 text-body-sm text-text-secondary">
                        <CalendarDaysIcon aria-hidden="true" className="size-3.5 text-text-muted" />
                        {formatPeriodRange(period.start, period.end, locale)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold ${PHASE_STYLE[period.phase]}`}>
                      {isSuggested && <SparklesIcon aria-hidden="true" className="size-3.5" />}
                      {isSuggested ? copy.suggested : t.reports.phase[period.phase]}
                    </span>
                  </div>

                  <p className={`flex items-center gap-1.5 text-body-sm ${owed ? 'font-semibold text-danger-soft-text' : 'text-text-secondary'}`}>
                    <ClockIcon aria-hidden="true" className="size-4 shrink-0" />
                    {t.reports.deadline.dueOn(formatDay(period.deadline, locale))}
                    {period.days_to_deadline >= 0 ? ` · ${t.reports.deadline.dueIn(period.days_to_deadline)}` : owed ? ` · ${t.reports.deadline.passed(-period.days_to_deadline)}` : ''}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {report ? (
                      <>
                        <ReportStatusBadge status={report.status} />
                        <ReportTimelinessBadge
                          report={{
                            status: report.status,
                            is_late: report.is_late,
                            is_overdue: report.status === 'draft' && period.days_to_deadline < 0,
                            days_overdue: report.days_overdue,
                          }}
                        />
                      </>
                    ) : (
                      <span className="text-body-sm italic text-text-muted">{copy.state.none}</span>
                    )}
                  </div>

                  <div className="mt-auto pt-1">
                    {report ? (
                      <Link
                        to={`/reports/${report.id}`}
                        className={`inline-flex h-10 items-center justify-center gap-2 rounded px-4 text-button transition-colors ${
                          report.status === 'draft' ? 'bg-accent text-accent-text hover:bg-accent-light' : 'border border-border bg-white text-primary hover:bg-section-bg'
                        }`}
                      >
                        {report.status === 'draft' ? <PencilSquareIcon aria-hidden="true" className="size-4" /> : <EyeIcon aria-hidden="true" className="size-4" />}
                        {report.status === 'draft' ? copy.action.continue : copy.action.view}
                      </Link>
                    ) : (
                      <Button
                        variant={isSuggested || isSelected ? 'primary' : 'secondary'}
                        aria-label={copy.startAria(period.label)}
                        disabled={createMutation.isPending}
                        onClick={() => createMutation.mutate(period.label)}
                      >
                        <PlayIcon aria-hidden="true" className="size-4" />
                        {createMutation.isPending && createMutation.variables === period.label ? copy.starting : copy.action.start}
                        <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </section>

      <Link to="/reports" className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-info hover:underline">
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {copy.backToList}
      </Link>
    </div>
  )
}
