import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowPathIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CloudArrowUpIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/20/solid'
import {
  carryForwardSection,
  discardDraftReport,
  submitPeriodicReport,
  type PeriodicReportDetail,
  type ReportSectionDetail,
  type SectionCompletion,
} from '../../api/reports'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Select } from '../../components/Select'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'
import { formatDate, formatRelativeTime, localeFor } from '../../lib/formatters'
import { NarrativeEditor } from './NarrativeEditor'
import { ReportTableEditor } from './ReportTableEditor'
import { CompletionMark, ReportStatusBadge, ReportTimelinessBadge } from './ReportStatusBadge'
import { formatDay, formatPeriodRange, narrativeCompletion, tableCompletion } from './reportPresentation'
import { useReportDraft, type SaveState } from './useReportDraft'

interface ReportEditorProps {
  report: PeriodicReportDetail
  onUpdated: (updated: PeriodicReportDetail) => void
  onSubmitted: (updated: PeriodicReportDetail) => void
  onLocked: () => void
}

/**
 * FR-RPT-004 to 014: the attache's workspace for a draft report. One section at a time, chosen
 * from a rail that shows each section's completion (FR-RPT-005, FR-RPT-013); every change is
 * auto-saved, and moving to another section saves the one being left at once (FR-RPT-006).
 * Submitting reviews what is incomplete and whether the report will be late, then locks it
 * (FR-RPT-014 to 016, BR-009). Only rendered when the API grants this user `edit`.
 */
export function ReportEditor({ report, onUpdated, onSubmitted, onLocked }: ReportEditorProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.reports.editor
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sections = useMemo(() => [...report.sections].sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0)), [report.sections])
  const draft = useReportDraft(report, onUpdated, onLocked)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isSubmitOpen, setSubmitOpen] = useState(false)
  const [isDiscardOpen, setDiscardOpen] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<string[] | null>(null)
  const [isFlushing, setFlushing] = useState(false)
  const [carry, setCarry] = useState<{ pending: boolean; error: string | null }>({ pending: false, error: null })
  const [notice, setNotice] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const shouldFocusHeading = useRef(false)
  const baseId = useId()

  const active = sections[Math.min(activeIndex, sections.length - 1)]
  const headingId = `${baseId}-section-heading`
  const guidanceId = `${baseId}-guidance`

  const completion: Record<string, SectionCompletion> = Object.fromEntries(
    sections.map((section) => {
      const value = draft.values[section.id]
      if (!value) {
        return [section.id, section.completion]
      }
      return [section.id, value.kind === 'narrative' ? narrativeCompletion(value.content) : tableCompletion(section.column_schema ?? [], section.table, value.rows)]
    }),
  )
  const completeCount = sections.filter((section) => completion[section.id] === 'complete').length
  const incomplete = sections.map((section, index) => ({ section, index })).filter(({ section }) => completion[section.id] !== 'complete')

  // The server's count, so "late" here always matches how the API will judge the submission.
  const daysLeft = report.days_to_deadline
  const deadlineText = formatDay(report.deadline, locale)

  useEffect(() => {
    if (shouldFocusHeading.current) {
      headingRef.current?.focus()
      shouldFocusHeading.current = false
    }
  }, [activeIndex])

  function goTo(index: number) {
    if (index === activeIndex || index < 0 || index >= sections.length) {
      return
    }
    // FR-RPT-006 AC2: leaving a section saves it immediately.
    void draft.flush(active.id)
    shouldFocusHeading.current = true
    setNotice(null)
    setCarry({ pending: false, error: null })
    setActiveIndex(index)
  }

  const submitMutation = useMutation({
    mutationFn: () => submitPeriodicReport(report.id),
    onSuccess: (updated) => {
      setSubmitOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['periodic-reports'] })
      void queryClient.invalidateQueries({ queryKey: ['report-periods'] })
      onSubmitted(updated)
    },
    onError: (error) => setSubmitErrors(apiErrorMessages(error, t.common.genericError)),
  })

  async function submit() {
    setSubmitErrors(null)
    setFlushing(true)
    const saved = await draft.flush()
    setFlushing(false)
    if (!saved) {
      setSubmitErrors([copy.submitModal.saveFailed])
      return
    }
    submitMutation.mutate()
  }

  const discardMutation = useMutation({
    mutationFn: () => discardDraftReport(report.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['periodic-report', report.id] })
      void queryClient.invalidateQueries({ queryKey: ['periodic-reports'] })
      void queryClient.invalidateQueries({ queryKey: ['report-periods'] })
      navigate('/reports', { replace: true })
    },
  })

  async function carryForward(section: ReportSectionDetail): Promise<boolean> {
    setCarry({ pending: true, error: null })
    // Let any save of this table land first, so it cannot overwrite the copied rows.
    await draft.flush(section.id)
    try {
      const updated = await carryForwardSection(report.id, section.id)
      onUpdated(updated)
      const fresh = updated.sections.find((candidate) => candidate.id === section.id)
      if (fresh) {
        draft.resetSection(fresh)
      }
      setCarry({ pending: false, error: null })
      setNotice(t.reports.table.carriedForward(fresh?.data_rows?.length ?? 0))
      return true
    } catch (error) {
      setCarry({ pending: false, error: apiErrorMessages(error, t.reports.table.carryForwardError).join(' ') })
      return false
    }
  }

  const value = draft.values[active.id]
  const activeState = completion[active.id]

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7" data-testid="report-form">
      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm" aria-labelledby="report-title">
        <div className={`flex flex-wrap items-start justify-between gap-4 border-l-4 px-4 pb-4 pt-5 sm:px-6 ${report.is_overdue ? 'border-l-danger' : 'border-l-info'}`}>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <ReportStatusBadge status={report.status} testId="report-status-badge" />
              <ReportTimelinessBadge report={report} testId="report-timeliness-badge" />
              {!report.is_overdue && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-section-bg px-2.5 py-1 text-caption font-semibold text-text-secondary">
                  <ClockIcon aria-hidden="true" className="size-3.5" />
                  {t.reports.deadline.dueOn(deadlineText)} · {t.reports.deadline.dueIn(Math.max(0, daysLeft))}
                </span>
              )}
            </div>
            <h1 id="report-title" className="text-h2 leading-snug text-primary">
              {t.reports.document.title(report.reporting_period_label)}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">
              {report.mission && (
                <span className="inline-flex items-center gap-1.5">
                  <BuildingLibraryIcon aria-hidden="true" className="size-3.5 text-text-muted" />
                  {report.mission.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDaysIcon aria-hidden="true" className="size-3.5 text-text-muted" />
                {formatPeriodRange(report.period_start_date, report.period_end_date, locale)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PencilSquareIcon aria-hidden="true" className="size-3.5 text-text-muted" />
                {copy.startedOn(formatDate(report.created_at, locale))}
              </span>
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <SaveIndicator state={draft.overall} locale={locale} onRetry={() => void draft.flush()} />
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {report.allowed_actions.discard && (
                <button
                  type="button"
                  onClick={() => {
                    discardMutation.reset()
                    setDiscardOpen(true)
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded px-3 text-button text-danger-soft-text transition-colors hover:bg-danger-soft"
                >
                  <TrashIcon aria-hidden="true" className="size-4" />
                  {copy.discard}
                </button>
              )}
              {report.allowed_actions.submit && (
                <Button
                  onClick={() => {
                    setSubmitErrors(null)
                    submitMutation.reset()
                    setSubmitOpen(true)
                  }}
                >
                  <PaperAirplaneIcon aria-hidden="true" className="size-4" />
                  {copy.submit}
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-border px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3 text-body-sm">
            <span className="font-semibold text-text-primary" data-testid="report-progress">
              {copy.progress(completeCount, sections.length)}
            </span>
            <span className="font-mono text-caption text-text-secondary">{sections.length > 0 ? Math.round((completeCount / sections.length) * 100) : 0}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={copy.progress(completeCount, sections.length)}
            aria-valuemin={0}
            aria-valuemax={sections.length}
            aria-valuenow={completeCount}
            className="mt-2 flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
          >
            {sections.map((section) => (
              <span
                key={section.id}
                className={`h-full flex-1 ${completion[section.id] === 'complete' ? 'bg-success' : completion[section.id] === 'started' ? 'bg-info' : 'bg-section-bg'}`}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <nav aria-label={copy.sectionsLabel} className="hidden lg:sticky lg:top-5 lg:block">
          <ol className="flex flex-col gap-0.5 rounded-xl border border-border bg-white p-2 shadow-sm">
            {sections.map((section, index) => {
              const isActive = index === activeIndex
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-body-sm transition-colors ${
                      isActive ? 'bg-primary text-white' : 'text-text-secondary hover:bg-section-bg hover:text-primary'
                    }`}
                  >
                    <CompletionMark state={completion[section.id]} className="size-5" />
                    <span className={`font-mono text-[0.6875rem] ${isActive ? 'text-white/70' : 'text-text-muted'}`}>{index + 1}</span>
                    <span className="min-w-0 flex-1 leading-snug">{section.section_title}</span>
                    <span className="sr-only">({t.reports.completion[completion[section.id]]})</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="lg:hidden">
            <Select
              label={copy.sectionPicker}
              value={String(activeIndex)}
              onChange={(event) => goTo(Number(event.target.value))}
              options={sections.map((section, index) => ({
                value: String(index),
                label: `${index + 1}. ${section.section_title ?? ''} — ${t.reports.completion[completion[section.id]]}`,
              }))}
              className="w-full"
            />
          </div>

          <section aria-labelledby={headingId} className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-6" data-testid="report-section-editor">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption font-semibold uppercase tracking-wider text-text-muted">{copy.sectionPosition(activeIndex + 1, sections.length)}</p>
                <h2 id={headingId} ref={headingRef} tabIndex={-1} className="mt-0.5 text-h2 text-primary focus:outline-none">
                  {active.section_title}
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${
                  activeState === 'complete' ? 'bg-success-soft text-success-soft-text' : activeState === 'started' ? 'bg-info-soft text-info-soft-text' : 'bg-section-bg text-text-secondary'
                }`}
                data-testid="section-completion"
              >
                <CompletionMark state={activeState} className="size-4" />
                {t.reports.completion[activeState]}
              </span>
            </div>

            {active.guidance_text && (
              <aside id={guidanceId} className="mt-4 flex gap-2.5 rounded-lg border-l-[3px] border-info bg-info-soft/40 px-3.5 py-2.5 text-body-sm text-text-secondary">
                <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
                <span>
                  <strong className="block text-caption font-semibold uppercase tracking-wider text-info-soft-text">{copy.guidance}</strong>
                  {active.guidance_text}
                </span>
              </aside>
            )}

            {notice && (
              <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-body-sm text-success-soft-text">
                <CheckCircleIcon aria-hidden="true" className="size-4 shrink-0" />
                {notice}
              </p>
            )}

            <div className="mt-4">
              {value?.kind === 'table' ? (
                <ReportTableEditor
                  key={active.id}
                  section={active}
                  rows={value.rows}
                  onChange={(rows) => draft.setRows(active.id, rows)}
                  labelledBy={headingId}
                  carryForward={
                    report.allowed_actions.carry_forward && report.carry_forward_source
                      ? {
                          sourceLabel: report.carry_forward_source.reporting_period_label,
                          pending: carry.pending,
                          error: carry.error,
                          onConfirm: () => carryForward(active),
                        }
                      : null
                  }
                />
              ) : (
                <NarrativeEditor
                  key={active.id}
                  value={value?.kind === 'narrative' ? value.content : ''}
                  onChange={(content) => draft.setNarrative(active.id, content)}
                  labelledBy={headingId}
                  describedBy={active.guidance_text ? guidanceId : undefined}
                />
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <Button variant="secondary" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0}>
                <ChevronLeftIcon aria-hidden="true" className="size-4" />
                {copy.previous}
              </Button>
              <Button variant="secondary" onClick={() => goTo(activeIndex + 1)} disabled={activeIndex === sections.length - 1}>
                {copy.next}
                <ChevronRightIcon aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Modal open={isSubmitOpen} onClose={() => setSubmitOpen(false)} title={copy.submitModal.title(report.reporting_period_label)} className="max-w-lg">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-body-sm font-semibold text-text-primary">{copy.submitModal.summary(completeCount, sections.length)}</p>
            {incomplete.length === 0 ? (
              <p className="mt-1 flex items-center gap-1.5 text-body-sm text-success-soft-text">
                <CheckCircleIcon aria-hidden="true" className="size-4" />
                {copy.submitModal.allComplete}
              </p>
            ) : (
              <div className="mt-2 rounded-lg border border-border bg-page-bg p-3">
                <p className="text-caption font-semibold uppercase tracking-wider text-text-secondary">{copy.submitModal.incompleteTitle}</p>
                <ul className="mt-1.5 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                  {incomplete.map(({ section, index }) => (
                    <li key={section.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitOpen(false)
                          goTo(index)
                        }}
                        aria-label={copy.submitModal.jumpTo(section.section_title ?? '')}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-body-sm text-text-secondary hover:bg-white hover:text-primary"
                      >
                        <CompletionMark state={completion[section.id]} className="size-4" />
                        <span className="min-w-0 flex-1 truncate">{section.section_title}</span>
                        <span className="text-caption text-text-muted">{t.reports.completion[completion[section.id]]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-caption text-text-secondary">{copy.submitModal.incompleteNote}</p>
              </div>
            )}
          </div>

          <p
            className={`flex gap-2 rounded-lg px-3 py-2.5 text-body-sm ${daysLeft >= 0 ? 'bg-success-soft text-success-soft-text' : 'bg-atrisk-soft text-atrisk-soft-text'}`}
            data-testid="submit-timeliness"
          >
            {daysLeft >= 0 ? <ClockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <ExclamationTriangleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
            {daysLeft >= 0 ? copy.submitModal.onTime(deadlineText) : copy.submitModal.late(-daysLeft, deadlineText)}
          </p>

          <p className="flex gap-2 text-body-sm text-text-secondary">
            <LockClosedIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {copy.submitModal.final}
          </p>

          {submitErrors && (
            <p role="alert" className="flex gap-2 rounded-lg bg-danger-soft px-3 py-2 text-body-sm text-danger-soft-text">
              <ExclamationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {submitErrors.join(' ')}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setSubmitOpen(false)}>
              {copy.submitModal.cancel}
            </Button>
            <Button onClick={() => void submit()} disabled={isFlushing || submitMutation.isPending}>
              <PaperAirplaneIcon aria-hidden="true" className="size-4" />
              {isFlushing || submitMutation.isPending ? copy.submitModal.submitting : copy.submitModal.confirm}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={isDiscardOpen} onClose={() => setDiscardOpen(false)} title={copy.discardTitle}>
        <p className="text-body text-text-secondary">{copy.discardBody(report.reporting_period_label)}</p>
        {discardMutation.isError && (
          <p role="alert" className="mt-3 text-body-sm text-danger-soft-text">
            {apiErrorMessages(discardMutation.error, copy.discardError).join(' ')}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setDiscardOpen(false)}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" onClick={() => discardMutation.mutate()} disabled={discardMutation.isPending}>
            <TrashIcon aria-hidden="true" className="size-4" />
            {discardMutation.isPending ? copy.discarding : copy.discardConfirm}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

/** The whole report's save state, announced politely (UI-005). */
function SaveIndicator({ state, locale, onRetry }: { state: SaveState; locale: string; onRetry: () => void }) {
  const { t } = useI18n()
  const copy = t.reports.editor.save
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 30000)
    return () => window.clearInterval(timer)
  }, [])

  let tone = 'text-text-secondary'
  let icon = <CloudArrowUpIcon aria-hidden="true" className="size-4" />
  let text: string = state.savedAt ? copy.savedAt(formatRelativeTime(new Date(state.savedAt).toISOString(), locale)) : copy.saved

  switch (state.status) {
    case 'saving':
      icon = <ArrowPathIcon aria-hidden="true" className="size-4 motion-safe:animate-spin" />
      text = copy.saving
      break
    case 'pending':
      icon = <span aria-hidden="true" className="size-2 rounded-full bg-atrisk" />
      text = copy.unsaved
      break
    case 'invalid':
      tone = 'text-atrisk-soft-text'
      icon = <ExclamationTriangleIcon aria-hidden="true" className="size-4" />
      text = copy.invalid
      break
    case 'error':
      tone = 'text-danger-soft-text'
      icon = <ExclamationCircleIcon aria-hidden="true" className="size-4" />
      text = [copy.error, ...state.errors].join(' · ')
      break
    case 'locked':
      tone = 'text-info-soft-text'
      icon = <LockClosedIcon aria-hidden="true" className="size-4" />
      text = copy.submittedElsewhere
      break
    default:
      tone = 'text-success-soft-text'
      icon = <CheckCircleIcon aria-hidden="true" className="size-4" />
  }

  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <p role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 text-body-sm font-medium ${tone}`} data-testid="report-save-status">
        {icon}
        {text}
        {state.status === 'error' && state.willRetry && <span className="font-normal text-text-secondary">· {copy.retrying}</span>}
      </p>
      {state.status === 'error' && (
        <button type="button" onClick={onRetry} className="text-body-sm font-semibold text-info hover:underline">
          {copy.retry}
        </button>
      )}
    </div>
  )
}
