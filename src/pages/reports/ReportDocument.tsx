import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PrinterIcon,
  UserIcon,
} from '@heroicons/react/20/solid'
import type { PeriodicReportDetail, ReportSectionDetail } from '../../api/reports'
import { DetailSidePanel, RecordRow } from '../../components/DetailLayout'
import { useI18n } from '../../i18n/context'
import { formatDateTime, localeFor } from '../../lib/formatters'
import { ReportMarkdown } from './ReportMarkdown'
import { CompletionMark, ReportStatusBadge, ReportTimelinessBadge } from './ReportStatusBadge'
import { computeTotals, formatDay, formatNumber, formatPeriodRange, isIntegerType, isNumericType, parseNumberInput, rowsFromSection } from './reportPresentation'

/**
 * FR-RPT-015/017, FR-HOM-001 AC2: a report as a read-only document — how HQ reviewers, Heads of
 * Mission and (once submitted) its own attache see it. There are no edit controls here at all
 * (UI-006); the API refuses every write to a submitted report regardless (BR-009).
 */
export function ReportDocument({ report, justSubmitted = false }: { report: PeriodicReportDetail; justSubmitted?: boolean }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.reports.document
  const sections = [...report.sections].sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0))
  const range = formatPeriodRange(report.period_start_date, report.period_end_date, locale)
  const deadline = formatDay(report.deadline, locale)
  const accent = report.status === 'submitted' ? (report.is_late ? 'border-l-atrisk' : 'border-l-success') : report.is_overdue ? 'border-l-danger' : 'border-l-info'
  const bannerRef = useRef<HTMLDivElement>(null)

  // Straight after submitting, bring the confirmation into view and focus.
  useEffect(() => {
    if (justSubmitted) {
      bannerRef.current?.scrollIntoView?.({ block: 'start' })
      bannerRef.current?.focus()
    }
  }, [justSubmitted])

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7 print:max-w-none print:p-0">
      {justSubmitted && (
        <div
          ref={bannerRef}
          tabIndex={-1}
          role="status"
          className="mb-5 flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3 focus:outline-none print:hidden"
          data-testid="report-submitted-banner"
        >
          <CheckCircleIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="font-semibold text-success-soft-text">{copy.justSubmittedTitle}</p>
            <p className="text-body-sm text-text-secondary">
              {report.is_late ? copy.justSubmittedLate(report.days_overdue ?? 1) : copy.justSubmittedOnTime}
            </p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm print:border-0 print:shadow-none" aria-labelledby="report-title">
        <div className={`flex flex-wrap items-start justify-between gap-4 border-l-4 px-4 pb-4 pt-5 sm:px-6 ${accent}`}>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <ReportStatusBadge status={report.status} testId="report-status-badge" />
              <ReportTimelinessBadge report={report} testId="report-timeliness-badge" />
            </div>
            <h1 id="report-title" className="text-h2 leading-snug text-primary">
              {copy.title(report.reporting_period_label)}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">
              {report.mission && (
                <span className="inline-flex items-center gap-1.5">
                  <BuildingLibraryIcon aria-hidden="true" className="size-3.5 text-text-muted" />
                  {report.mission.name}
                  {report.mission.host_country ? `, ${report.mission.host_country}` : ''}
                </span>
              )}
              {report.authored_by && (
                <span className="inline-flex items-center gap-1.5">
                  <UserIcon aria-hidden="true" className="size-3.5 text-text-muted" />
                  {report.authored_by.full_name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDaysIcon aria-hidden="true" className="size-3.5 text-text-muted" />
                {range}
              </span>
              {report.submitted_at && (
                <span className="inline-flex items-center gap-1.5">
                  <PaperAirplaneIcon aria-hidden="true" className="size-3.5 text-text-muted" />
                  <time dateTime={report.submitted_at}>{formatDateTime(report.submitted_at, locale)}</time>
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg print:hidden"
          >
            <PrinterIcon aria-hidden="true" className="size-4" />
            {copy.print}
          </button>
        </div>
        <p className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-caption text-text-secondary sm:px-6 print:hidden" data-testid="report-read-only">
          <LockClosedIcon aria-hidden="true" className="size-4 shrink-0" />
          {copy.readOnly}
        </p>
      </section>

      <div className="mt-5 grid gap-5 min-[1200px]:grid-cols-[minmax(0,1fr)_300px] min-[1200px]:items-start print:block">
        <article className="flex min-w-0 flex-col gap-4" data-testid="report-document">
          {sections.map((section, index) => (
            <DocumentSection key={section.id} section={section} index={index + 1} locale={locale} />
          ))}
        </article>

        <aside className="grid min-w-0 gap-4 sm:grid-cols-2 min-[1200px]:sticky min-[1200px]:top-5 min-[1200px]:grid-cols-1 print:hidden">
          <DetailSidePanel title={copy.contents} count={sections.length}>
            <nav aria-label={copy.contents}>
              <ol className="flex flex-col gap-0.5">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#section-${section.id}`}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-body-sm text-text-secondary transition-colors hover:bg-section-bg hover:text-primary"
                    >
                      <CompletionMark state={section.completion} className="size-4" />
                      <span className="font-mono text-[0.6875rem] text-text-muted">{index + 1}</span>
                      <span className="min-w-0 truncate">{section.section_title}</span>
                      <span className="sr-only">({t.reports.completion[section.completion]})</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </DetailSidePanel>

          <DetailSidePanel title={copy.record}>
            <dl className="flex flex-col gap-2.5 text-body-sm">
              <RecordRow label={copy.mission} value={report.mission?.name ?? '—'} />
              <RecordRow label={copy.attache} value={report.authored_by?.full_name ?? '—'} />
              <RecordRow label={copy.period} value={range} />
              <RecordRow label={copy.deadline} value={deadline} />
              <RecordRow label={copy.submitted} value={report.submitted_at ? formatDateTime(report.submitted_at, locale) : t.reports.list.notSubmitted} />
              {report.submitted_by && <RecordRow label={copy.submittedBy} value={report.submitted_by.full_name} />}
              <RecordRow label={copy.started} value={formatDateTime(report.created_at, locale)} />
              {report.last_edited_at && <RecordRow label={copy.lastEdited} value={formatDateTime(report.last_edited_at, locale)} />}
              <RecordRow label={copy.template} value={copy.templateVersion(report.template_version)} />
            </dl>
            {report.is_late && report.days_overdue !== null && (
              <p className="flex gap-2 rounded-lg bg-atrisk-soft px-3 py-2 text-caption text-atrisk-soft-text">
                <ExclamationTriangleIcon aria-hidden="true" className="mt-px size-4 shrink-0" />
                {t.reports.timeliness.lateSentence(report.days_overdue, deadline)}
              </p>
            )}
            <Link to="/reports" className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-info hover:underline">
              <ArrowLeftIcon aria-hidden="true" className="size-4" />
              {copy.allReports}
            </Link>
          </DetailSidePanel>
        </aside>
      </div>
    </div>
  )
}

function DocumentSection({ section, index, locale }: { section: ReportSectionDetail; index: number; locale: string }) {
  const { t } = useI18n()
  const copy = t.reports.document
  const headingId = `section-heading-${section.id}`

  return (
    <section id={`section-${section.id}`} aria-labelledby={headingId} className="scroll-mt-5 rounded-xl border border-border bg-white p-4 shadow-sm sm:p-6 print:break-inside-avoid print:border-0 print:p-0 print:shadow-none">
      <h2 id={headingId} className="flex items-baseline gap-3 text-h3 text-primary">
        <span className="font-mono text-body-sm text-text-muted">{index}</span>
        {section.section_title}
      </h2>
      <div className="mt-3">
        {section.section_type === 'structured_table' ? (
          <ReadOnlyTable section={section} locale={locale} />
        ) : section.content && section.content.trim() !== '' ? (
          <ReportMarkdown source={section.content} headingLevel={2} />
        ) : (
          <p className="italic text-text-muted">{copy.noContent}</p>
        )}
      </div>
    </section>
  )
}

function ReadOnlyTable({ section, locale }: { section: ReportSectionDetail; locale: string }) {
  const { t } = useI18n()
  const columns = section.column_schema ?? []
  const rows = rowsFromSection(section)
  const totals = computeTotals(section.table, columns, rows)
  const labelColumns = section.table?.label_columns ?? []

  if (rows.length === 0) {
    return <p className="italic text-text-muted">{t.reports.document.noRows}</p>
  }

  function display(columnType: string, raw: string): string {
    if (raw === '' || !isNumericType(columnType)) {
      return raw
    }
    const parsed = parseNumberInput(raw, isIntegerType(columnType))
    return parsed.value === null ? raw : formatNumber(parsed.value, locale)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border text-body-sm">
        <thead className="bg-section-bg">
          <tr>
            {columns.map((column) => (
              <th key={column.name} scope="col" className={`px-3 py-2 font-semibold text-text-secondary ${isNumericType(column.type) ? 'text-right' : 'text-left'}`}>
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td
                  key={column.name}
                  className={`px-3 py-2 align-top ${isNumericType(column.type) ? 'text-right font-mono' : ''} ${labelColumns.includes(column.name) ? 'font-semibold text-primary' : 'text-text-primary'}`}
                >
                  {display(column.type, row.values[column.name] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && section.table?.total && (
          <tfoot className="border-t-2 border-border-muted bg-page-bg">
            <tr>
              {columns.map((column) => (
                <td key={column.name} className={`px-3 py-2 font-semibold text-primary ${isNumericType(column.type) ? 'text-right font-mono' : ''}`}>
                  {column.name === section.table?.total?.label_column ? section.table.total.label : column.name in totals ? formatNumber(totals[column.name], locale) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
