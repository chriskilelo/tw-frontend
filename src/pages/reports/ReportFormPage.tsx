import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addReportDataRow,
  carryForwardReport,
  createDraftReport,
  getPeriodicReport,
  removeReportDataRow,
  submitPeriodicReport,
  updateReportSection,
  type PeriodicReport,
  type ReportDataRow,
  type ReportSectionDetail,
} from '../../api/reports'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Modal } from '../../components/Modal'
import { ReportStatusBadge, ReportLateBadge } from './ReportStatusBadge'
import en from '../../i18n/en'

const AUTOSAVE_DEBOUNCE_MS = 2000

function RequiredMark() {
  return (
    <span aria-label={en.reports.form.requiredIndicator} className="text-danger">
      *
    </span>
  )
}

/**
 * FR-RPT-003 to 007, 011, 014 (Periodic Report Engine). Route handles both /reports/new
 * (no :id — collects the three fields StoreDraftReportRequest requires, then creates the
 * draft) and /reports/:id (the core editing screen).
 *
 * A Ministry Attache cannot call GET /report-templates directly (ReportPolicy::
 * manageTemplate() is System-Administrator-only, Session 25) — the sections embedded in
 * GET /periodic-reports/{id} already carry everything the active template defines
 * (title/type/column_schema/guidance_text) because ReportService::createDraftReport()
 * instantiates one report_sections row per active template section at draft-creation
 * time. That embedded list is used here instead of a separate template call.
 */
export default function ReportFormPage() {
  const { id } = useParams<{ id?: string }>()

  if (!id) {
    return <CreateDraftReportForm />
  }

  return <ReportEditor reportId={id} />
}

function CreateDraftReportForm() {
  const navigate = useNavigate()
  const [periodLabel, setPeriodLabel] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createDraftReport({
        reporting_period_label: periodLabel,
        period_start_date: periodStart,
        period_end_date: periodEnd,
      }),
    onSuccess: (report) => navigate(`/reports/${report.id}`, { replace: true }),
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="p-6">
      <Link to="/reports" className="text-body-sm font-semibold text-accent-soft-text hover:underline">
        ← {en.reports.form.backToList}
      </Link>

      <h1 className="mt-2 text-h1 text-primary">{en.reports.form.newTitle}</h1>

      <form onSubmit={handleSubmit} data-testid="report-form" className="mt-6 flex max-w-md flex-col gap-4">
        <Input
          label={
            <>
              {en.reports.form.periodLabelLabel} <RequiredMark />
            </>
          }
          required
          aria-required="true"
          placeholder="Q1 2027"
          value={periodLabel}
          onChange={(event) => setPeriodLabel(event.target.value)}
        />
        <Input
          type="date"
          label={
            <>
              {en.reports.form.periodStartLabel} <RequiredMark />
            </>
          }
          required
          aria-required="true"
          value={periodStart}
          onChange={(event) => setPeriodStart(event.target.value)}
        />
        <Input
          type="date"
          label={
            <>
              {en.reports.form.periodEndLabel} <RequiredMark />
            </>
          }
          required
          aria-required="true"
          value={periodEnd}
          onChange={(event) => setPeriodEnd(event.target.value)}
        />

        {mutation.isError && <p className="text-body-sm text-danger-soft-text">{en.common.genericError}</p>}

        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {en.reports.form.createButton}
        </Button>
      </form>
    </div>
  )
}

function ReportEditor({ reportId }: { reportId: string }) {
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)

  const queryKey = ['periodic-report', reportId]

  const reportQuery = useQuery({
    queryKey,
    queryFn: () => getPeriodicReport(reportId),
  })

  function applyUpdate(updated: PeriodicReport) {
    queryClient.setQueryData(queryKey, updated)
  }

  const submitMutation = useMutation({
    mutationFn: () => submitPeriodicReport(reportId),
    onSuccess: (updated) => {
      applyUpdate(updated)
      queryClient.invalidateQueries({ queryKey: ['periodic-reports'] })
      setConfirmSubmitOpen(false)
    },
  })

  if (reportQuery.isLoading || !reportQuery.data) {
    return (
      <div className="p-6">
        <p className="text-body text-text-muted">{en.common.loading}</p>
      </div>
    )
  }

  const report = reportQuery.data
  const sections = [...(report.sections ?? [])].sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0))

  // Mirrors ReportPolicy::isEditableByOwningAttache() (Session 25): the submitting
  // attache's own mission, and only while the report is still a draft (BR-009).
  const canEdit = role?.name === 'Ministry Attache' && user?.mission_id === report.mission?.id && report.status === 'draft'

  return (
    <div className="p-6" data-testid="report-form">
      <Link to="/reports" className="text-body-sm font-semibold text-accent-soft-text hover:underline">
        ← {en.reports.form.backToList}
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 text-primary">{report.reporting_period_label}</h1>
        <div className="flex items-center gap-2">
          <ReportStatusBadge status={report.status} testId="report-status-badge" />
          {report.is_late && <ReportLateBadge />}
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="text-caption text-text-muted">{en.reports.form.missionLabel}</dt>
          <dd className="text-body-sm text-text-primary">{report.mission?.name ?? '—'}</dd>
        </div>
        {report.submitted_at && (
          <div>
            <dt className="text-caption text-text-muted">{en.reports.form.submittedAtLabel}</dt>
            <dd className="text-body-sm text-text-primary">{new Date(report.submitted_at).toLocaleString()}</dd>
          </div>
        )}
      </dl>

      <div className="mt-8 flex flex-col gap-8">
        {sections.map((section) =>
          section.section_type === 'structured_table' ? (
            <StructuredTableSection
              key={section.id}
              report={report}
              section={section}
              canEdit={canEdit}
              onUpdated={applyUpdate}
            />
          ) : (
            <NarrativeSection key={section.id} report={report} section={section} canEdit={canEdit} onUpdated={applyUpdate} />
          ),
        )}
      </div>

      {canEdit && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setConfirmSubmitOpen(true)}>
            {en.reports.form.submitButton}
          </Button>
        </div>
      )}

      <Modal open={confirmSubmitOpen} onClose={() => setConfirmSubmitOpen(false)} title={en.reports.form.submitModalTitle}>
        <p className="text-body text-text-secondary">{en.reports.form.submitModalBody}</p>
        <div className="mt-4 flex gap-3">
          <Button variant="primary" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
            {en.reports.form.submitConfirmButton}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmSubmitOpen(false)}>
            {en.common.cancel}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') {
    return null
  }
  return (
    <span className="text-caption text-text-muted" role="status">
      {state === 'saving' ? en.reports.form.savingIndicator : en.reports.form.savedIndicator}
    </span>
  )
}

/**
 * FR-RPT-005/006: narrative section content, auto-saved 2 seconds after the user stops
 * typing (debounced the same way AlertListPage/InquiryListPage debounce search input).
 * Guidance text (UI helper, UI-005/FR-RPT-004) renders alongside the textarea on tablet+
 * and above it on mobile — CLAUDE.md's five-viewport breakpoints, `sm:` being the first
 * ("Mobile Landscape / Small Tablet") breakpoint above the unprefixed mobile base.
 */
function NarrativeSection({
  report,
  section,
  canEdit,
  onUpdated,
}: {
  report: PeriodicReport
  section: ReportSectionDetail
  canEdit: boolean
  onUpdated: (updated: PeriodicReport) => void
}) {
  const [content, setContent] = useState(section.content ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const lastSavedRef = useRef(section.content ?? '')

  const mutation = useMutation({
    mutationFn: (value: string) => updateReportSection(report.id, section.id, value),
    onSuccess: (updated, value) => {
      lastSavedRef.current = value
      setSaveState('saved')
      onUpdated(updated)
    },
  })

  useEffect(() => {
    if (!canEdit || content === lastSavedRef.current) {
      return
    }

    setSaveState('saving')
    const handle = setTimeout(() => mutation.mutate(content), AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, canEdit])

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_260px]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 text-primary">{section.section_title}</h2>
          <SaveIndicator state={saveState} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="sr-only">{section.section_title}</span>
          <textarea
            value={content}
            disabled={!canEdit}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-section-bg"
          />
        </label>
        <p className="text-caption text-text-muted">{en.reports.form.charCountLabel.replace('{count}', String(content.length))}</p>
      </div>
      {section.guidance_text && (
        <aside className="rounded border border-border bg-section-bg p-3 text-body-sm text-text-secondary sm:mt-9">
          {section.guidance_text}
        </aside>
      )}
    </section>
  )
}

/**
 * FR-RPT-007/008/011: structured_table section (AIE Allocations, Asset Register, etc.).
 * Add/remove rows call their own endpoints immediately (no separate "save" step — rows
 * are persisted as soon as they're added, matching StoreReportDataRowRequest/DELETE
 * having no draft concept of their own). Reorder is local-only: no PATCH-style reorder
 * endpoint exists on the backend (ReportService::reorderDataRow() has no controller
 * route, Session 25 note) — the move buttons only change on-screen order for this
 * viewing session, per en.reports.form.reorderHint below.
 */
function StructuredTableSection({
  report,
  section,
  canEdit,
  onUpdated,
}: {
  report: PeriodicReport
  section: ReportSectionDetail
  canEdit: boolean
  onUpdated: (updated: PeriodicReport) => void
}) {
  const columns = section.column_schema ?? []
  const serverRows = [...(section.data_rows ?? [])].sort((a, b) => a.row_order - b.row_order)
  const rowIdsKey = serverRows.map((row) => row.id).join(',')

  const [order, setOrder] = useState<string[]>(serverRows.map((row) => row.id))
  useEffect(() => {
    setOrder(serverRows.map((row) => row.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowIdsKey])

  const [newRow, setNewRow] = useState<Record<string, string>>({})
  const [rowError, setRowError] = useState<string | null>(null)

  const addRowMutation = useMutation({
    mutationFn: (rowData: Record<string, string>) => addReportDataRow(report.id, section.id, rowData),
    onSuccess: (updated) => {
      onUpdated(updated)
      setNewRow({})
      setRowError(null)
    },
    onError: () => setRowError(en.common.genericError),
  })

  const removeRowMutation = useMutation({
    mutationFn: (rowId: string) => removeReportDataRow(report.id, rowId),
    onSuccess: (updated) => onUpdated(updated),
  })

  const carryForwardMutation = useMutation({
    mutationFn: () => carryForwardReport(report.id),
    onSuccess: (updated) => onUpdated(updated),
  })

  function handleAddRow() {
    const missing = columns.filter((column) => column.mandatory && !(newRow[column.name] ?? '').trim())
    if (missing.length > 0) {
      setRowError(`${en.reports.form.requiredIndicator}: ${missing.map((column) => column.name).join(', ')}`)
      return
    }
    setRowError(null)
    addRowMutation.mutate(newRow)
  }

  function moveRow(rowId: string, direction: -1 | 1) {
    setOrder((current) => {
      const index = current.indexOf(rowId)
      const swapWith = index + direction
      if (index === -1 || swapWith < 0 || swapWith >= current.length) {
        return current
      }
      const next = [...current]
      ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
      return next
    })
  }

  const orderedRows = order
    .map((rowId) => serverRows.find((row) => row.id === rowId))
    .filter((row): row is ReportDataRow => Boolean(row))

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 text-primary">{section.section_title}</h2>
        {canEdit && (
          <Button variant="secondary" disabled={carryForwardMutation.isPending} onClick={() => carryForwardMutation.mutate()}>
            {en.reports.form.carryForwardButton}
          </Button>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded border border-border">
        <table className="min-w-full divide-y divide-border text-body-sm">
          <thead className="bg-section-bg">
            <tr>
              {columns.map((column) => (
                <th key={column.name} scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">
                  {column.name} {column.mandatory && <RequiredMark />}
                </th>
              ))}
              {canEdit && <th scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {orderedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-4 text-center text-text-muted">
                  {en.reports.form.noRows}
                </td>
              </tr>
            )}
            {orderedRows.map((row, index) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.name} className="px-3 py-2 text-text-primary">
                    {row.row_data[column.name] ?? ''}
                  </td>
                ))}
                {canEdit && (
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={en.reports.form.moveRowUpButton}
                        disabled={index === 0}
                        onClick={() => moveRow(row.id, -1)}
                        className="rounded px-1 text-text-secondary hover:bg-section-bg disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={en.reports.form.moveRowDownButton}
                        disabled={index === orderedRows.length - 1}
                        onClick={() => moveRow(row.id, 1)}
                        className="rounded px-1 text-text-secondary hover:bg-section-bg disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={en.reports.form.removeRowButton}
                        disabled={removeRowMutation.isPending}
                        onClick={() => removeRowMutation.mutate(row.id)}
                        className="rounded px-1 text-danger-soft-text hover:bg-danger-soft"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {canEdit && (
            <tfoot>
              <tr>
                {columns.map((column) => (
                  <td key={column.name} className="px-3 py-2">
                    <label className="flex flex-col gap-1">
                      <span className="sr-only">
                        {column.name}
                        {column.mandatory ? ` (${en.reports.form.requiredIndicator})` : ''}
                      </span>
                      <input
                        type={column.type === 'integer' || column.type === 'numeric' ? 'number' : 'text'}
                        aria-required={column.mandatory ? 'true' : undefined}
                        value={newRow[column.name] ?? ''}
                        onChange={(event) => setNewRow((current) => ({ ...current, [column.name]: event.target.value }))}
                        className="w-full rounded border border-border px-2 py-1 text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </label>
                  </td>
                ))}
                <td className="px-3 py-2">
                  <Button variant="secondary" disabled={addRowMutation.isPending} onClick={handleAddRow}>
                    {en.reports.form.addRowButton}
                  </Button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rowError && <p className="mt-1 text-caption text-danger-soft-text">{rowError}</p>}
      {canEdit && orderedRows.length > 1 && <p className="mt-1 text-caption text-text-muted">{en.reports.form.reorderHint}</p>}
    </section>
  )
}
