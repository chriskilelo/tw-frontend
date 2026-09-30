import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ArrowLeftIcon, ArrowPathIcon, ExclamationCircleIcon, MagnifyingGlassIcon, ShieldExclamationIcon } from '@heroicons/react/20/solid'
import { getPeriodicReport, type PeriodicReportDetail } from '../../api/reports'
import { Button } from '../../components/Button'
import { useBreadcrumbLabel } from '../../hooks/useBreadcrumbs'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'
import { ReportDocument } from './ReportDocument'
import { ReportEditor } from './ReportEditor'
import StartReportPage from './StartReportPage'

function errorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

/**
 * /reports/:id — FR-RPT-004 to 017. The API decides what this user may do
 * (`allowed_actions`, from ReportPolicy): the owning attache gets the editor for a draft;
 * everyone else — and everyone once the report is submitted — gets the read-only document.
 * /reports/new (no id) is the period picker.
 */
export default function ReportFormPage() {
  const { id } = useParams<{ id?: string }>()

  if (!id) {
    return <StartReportPage />
  }

  return <ReportPage key={id} reportId={id} />
}

function ReportPage({ reportId }: { reportId: string }) {
  const { t } = useI18n()
  const copy = t.reports.document
  const queryClient = useQueryClient()
  const queryKey = ['periodic-report', reportId]
  const [justSubmitted, setJustSubmitted] = useState(false)

  const reportQuery = useQuery({
    queryKey,
    queryFn: () => getPeriodicReport(reportId),
    retry: (failureCount, error) => ![403, 404].includes(errorStatus(error) ?? 0) && failureCount < 2,
  })

  const report = reportQuery.data
  useBreadcrumbLabel(report ? [report.reporting_period_label, report.mission?.name].filter(Boolean).join(' · ') : null)

  function store(updated: PeriodicReportDetail) {
    queryClient.setQueryData(queryKey, updated)
  }

  if (reportQuery.isError) {
    const status = errorStatus(reportQuery.error)
    if (status === 403 || status === 404) {
      return (
        <ReportUnavailable
          icon={status === 403 ? <ShieldExclamationIcon className="size-5" aria-hidden="true" /> : <MagnifyingGlassIcon className="size-5" aria-hidden="true" />}
          title={status === 403 ? copy.forbiddenTitle : copy.notFoundTitle}
          body={status === 403 ? copy.forbiddenBody : copy.notFoundBody}
        />
      )
    }
    return (
      <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-3.5 py-3 text-body-sm text-danger-soft-text">
          <ExclamationCircleIcon className="size-4.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{apiErrorMessages(reportQuery.error, copy.loadError).join(' ')}</span>
          <Button variant="secondary" onClick={() => void reportQuery.refetch()}>
            <ArrowPathIcon className="size-4" aria-hidden="true" />
            {copy.retry}
          </Button>
        </div>
      </div>
    )
  }

  if (!report) {
    return <ReportSkeleton label={copy.loading} />
  }

  if (report.allowed_actions.edit) {
    return (
      <ReportEditor
        key={report.id}
        report={report}
        onUpdated={store}
        onSubmitted={(updated) => {
          store(updated)
          setJustSubmitted(true)
        }}
        onLocked={() => void queryClient.invalidateQueries({ queryKey })}
      />
    )
  }

  return <ReportDocument report={report} justSubmitted={justSubmitted} />
}

function ReportUnavailable({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  const { t } = useI18n()
  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <section role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:p-6" data-testid="report-unavailable">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-section-bg text-primary">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-h3 text-primary">{title}</h1>
          <p className="mt-1 text-body text-text-secondary">{body}</p>
          <Link to="/reports" className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-semibold text-info hover:underline">
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {t.reports.document.allReports}
          </Link>
        </div>
      </section>
    </div>
  )
}

function ReportSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7" role="status" aria-live="polite" data-testid="report-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="h-44 rounded-2xl border border-border bg-white motion-safe:animate-pulse" />
      <div aria-hidden="true" className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden h-96 rounded-xl border border-border bg-white motion-safe:animate-pulse lg:block" />
        <div className="h-96 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
      </div>
    </div>
  )
}
