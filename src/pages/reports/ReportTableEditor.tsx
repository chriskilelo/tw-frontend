import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowDownIcon, ArrowUpIcon, DocumentDuplicateIcon, InformationCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/20/solid'
import type { ReportColumnSchema, ReportSectionDetail } from '../../api/reports'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import {
  DEFAULT_MAX_ROWS,
  computeTotals,
  formatNumber,
  isIntegerType,
  isNumericType,
  isTotalPlaceholder,
  newRowId,
  parseNumberInput,
  tableCompletion,
  validateRows,
  type CellErrorCode,
  type EditableRow,
} from './reportPresentation'

interface CarryForwardOption {
  sourceLabel: string
  pending: boolean
  error: string | null
  onConfirm: () => Promise<boolean>
}

interface ReportTableEditorProps {
  section: ReportSectionDetail
  rows: EditableRow[]
  onChange: (rows: EditableRow[]) => void
  labelledBy: string
  carryForward: CarryForwardOption | null
}

function typeHintKey(column: ReportColumnSchema): 'integer' | 'number' | 'selection' | 'text' | 'date' {
  const type = column.type.toLowerCase()
  if (isIntegerType(type)) {
    return 'integer'
  }
  if (isNumericType(type)) {
    return 'number'
  }
  return type === 'selection' || type === 'date' ? type : 'text'
}

/**
 * FR-RPT-007 to 011: a structured table section as an editable grid. Cells are typed by the
 * column schema (numbers validated as they are typed and shown with thousands separators,
 * FR-RPT-010; option lists as selects), rows can be added, moved and removed — every change is
 * saved with the rest of the table by the report's auto-save — and a configured total row
 * recalculates as values change (FR-RPT-009). Pre-populated budget lines arrive filled in
 * (FR-RPT-008), and the previous submitted report's rows can be copied in (FR-RPT-011).
 */
export function ReportTableEditor({ section, rows, onChange, labelledBy, carryForward }: ReportTableEditorProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.reports.table
  const columns = section.column_schema ?? []
  const table = section.table
  const maxRows = table?.max_rows ?? DEFAULT_MAX_ROWS
  const errors = validateRows(columns, rows)
  const errorAt = new Map(errors.map((error) => [`${error.rowIndex}:${error.column}`, error.code]))
  const totals = computeTotals(table, columns, rows)
  const [confirmCarry, setConfirmCarry] = useState(false)
  const [focusRowId, setFocusRowId] = useState<string | null>(null)
  const firstCellRefs = useRef(new Map<string, HTMLElement>())
  const noteId = useId()
  const errorSummaryId = useId()

  useEffect(() => {
    if (focusRowId) {
      firstCellRefs.current.get(focusRowId)?.focus()
      setFocusRowId(null)
    }
  }, [focusRowId])

  function setCell(rowIndex: number, column: string, value: string) {
    onChange(rows.map((row, index) => (index === rowIndex ? { ...row, values: { ...row.values, [column]: value } } : row)))
  }

  function addRow() {
    const row: EditableRow = { id: newRowId(), values: {} }
    onChange([...rows, row])
    setFocusRowId(row.id)
  }

  function moveRow(rowIndex: number, direction: -1 | 1) {
    const target = rowIndex + direction
    if (target < 0 || target >= rows.length) {
      return
    }
    const next = [...rows]
    ;[next[rowIndex], next[target]] = [next[target], next[rowIndex]]
    onChange(next)
  }

  function removeRow(rowIndex: number) {
    onChange(rows.filter((_, index) => index !== rowIndex))
  }

  const excludedLabels = table?.total?.exclude_labels.join(', ') ?? ''
  const hasValues = tableCompletion(columns, table, rows) !== 'empty'

  return (
    <div className="flex flex-col gap-3">
      <div id={noteId} className="flex flex-col gap-1.5">
        {table?.prepopulated && (
          <p className="flex gap-2 rounded-lg bg-info-soft/60 px-3 py-2 text-body-sm text-text-secondary">
            <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
            {copy.prepopulatedNote}
          </p>
        )}
        {columns.some((column) => column.mandatory) && <p className="text-caption text-text-secondary">{copy.mandatoryNote}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-sm text-text-secondary" aria-live="polite">
          <span className="font-mono font-semibold text-text-primary">{copy.rowCount(rows.length, maxRows)}</span>
          {rows.length >= maxRows && <span className="ml-2 text-atrisk-soft-text">{copy.full}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {carryForward && (
            <Button variant="secondary" onClick={() => setConfirmCarry(true)} disabled={carryForward.pending}>
              <DocumentDuplicateIcon aria-hidden="true" className="size-4" />
              {copy.carryForward(carryForward.sourceLabel)}
            </Button>
          )}
          <Button variant="secondary" onClick={addRow} disabled={rows.length >= maxRows}>
            <PlusIcon aria-hidden="true" className="size-4" />
            {copy.addRow}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table aria-labelledby={labelledBy} aria-describedby={noteId} className="min-w-full divide-y divide-border text-body-sm">
          <thead className="bg-section-bg">
            <tr>
              <th scope="col" className="w-10 px-3 py-2 text-left font-semibold text-text-secondary">
                {copy.rowNumber}
              </th>
              {columns.map((column) => (
                <th key={column.name} scope="col" className="min-w-36 px-3 py-2 text-left align-bottom font-semibold text-text-secondary">
                  <span className="flex items-center gap-1">
                    {column.name}
                    {column.mandatory && (
                      <span aria-label={copy.required} className="text-danger">
                        *
                      </span>
                    )}
                  </span>
                  <span className="block text-[0.6875rem] font-normal text-text-secondary">{copy.typeHint[typeHintKey(column)]}</span>
                </th>
              ))}
              <th scope="col" className="w-28 px-3 py-2">
                <span className="sr-only">{t.common.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-6 text-center text-text-muted">
                  {copy.empty}
                </td>
              </tr>
            )}
            {rows.map((row, rowIndex) => {
              const placeholderRow = isTotalPlaceholder(table, row.values)
              return (
                <tr key={row.id} className={placeholderRow ? 'bg-section-bg/60' : 'bg-white'} data-testid={`table-row-${rowIndex + 1}`}>
                  <td className="px-3 py-1.5 font-mono text-caption text-text-secondary">{rowIndex + 1}</td>
                  {columns.map((column, columnIndex) => (
                    <td key={column.name} className="px-2 py-1.5 align-top">
                      <CellInput
                        column={column}
                        value={row.values[column.name] ?? ''}
                        label={copy.cellLabel(column.name, rowIndex + 1)}
                        error={errorAt.get(`${rowIndex}:${column.name}`) ?? null}
                        emphasise={table?.label_columns.includes(column.name) ?? false}
                        locale={locale}
                        onChange={(value) => setCell(rowIndex, column.name, value)}
                        inputRef={
                          columnIndex === 0
                            ? (element) => {
                                if (element) {
                                  firstCellRefs.current.set(row.id, element)
                                } else {
                                  firstCellRefs.current.delete(row.id)
                                }
                              }
                            : undefined
                        }
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2 py-1.5 align-top">
                    <div className="flex items-center gap-0.5" role="group" aria-label={copy.rowActions(rowIndex + 1)}>
                      <IconButton label={copy.moveUp(rowIndex + 1)} disabled={rowIndex === 0} onClick={() => moveRow(rowIndex, -1)}>
                        <ArrowUpIcon />
                      </IconButton>
                      <IconButton label={copy.moveDown(rowIndex + 1)} disabled={rowIndex === rows.length - 1} onClick={() => moveRow(rowIndex, 1)}>
                        <ArrowDownIcon />
                      </IconButton>
                      <IconButton label={copy.removeRow(rowIndex + 1)} onClick={() => removeRow(rowIndex)} tone="danger">
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {totals && table?.total && (
            <tfoot className="border-t-2 border-border-muted bg-page-bg">
              <tr data-testid="table-total-row">
                <th scope="row" colSpan={1} className="px-3 py-2 text-left font-semibold text-primary">
                  <span className="sr-only">{copy.total}</span>
                </th>
                {columns.map((column) => (
                  <td key={column.name} className="px-3 py-2 font-semibold text-primary">
                    {column.name === table.total?.label_column
                      ? table.total.label
                      : column.name in totals
                        ? <span className="font-mono" data-testid={`total-${column.name}`}>{formatNumber(totals[column.name], locale)}</span>
                        : null}
                  </td>
                ))}
                <td className="px-3 py-2 text-caption font-normal text-text-muted">{copy.totalNote(excludedLabels)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {errors.length > 0 && (
        <p id={errorSummaryId} role="status" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-body-sm text-danger-soft-text">
          <InformationCircleIcon aria-hidden="true" className="size-4 shrink-0" />
          {copy.invalidSummary(errors.length)}
        </p>
      )}

      {carryForward && (
        <Modal open={confirmCarry} onClose={() => setConfirmCarry(false)} title={copy.carryForwardTitle(carryForward.sourceLabel)}>
          <p className="text-body text-text-secondary">{hasValues ? copy.carryForwardBody : copy.carryForwardEmptyBody}</p>
          {carryForward.error && (
            <p role="alert" className="mt-3 text-body-sm text-danger-soft-text">
              {carryForward.error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmCarry(false)}>
              {t.common.cancel}
            </Button>
            <Button
              disabled={carryForward.pending}
              onClick={async () => {
                if (await carryForward.onConfirm()) {
                  setConfirmCarry(false)
                }
              }}
            >
              <DocumentDuplicateIcon aria-hidden="true" className="size-4" />
              {carryForward.pending ? copy.carryingForward : copy.carryForwardConfirm}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function IconButton({ label, onClick, disabled = false, tone = 'default', children }: { label: string; onClick: () => void; disabled?: boolean; tone?: 'default' | 'danger'; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 [&>svg]:size-4 ${
        tone === 'danger' ? 'text-text-muted hover:bg-danger-soft hover:text-danger-soft-text' : 'text-text-muted hover:bg-section-bg hover:text-primary'
      }`}
    >
      {children}
    </button>
  )
}

interface CellInputProps {
  column: ReportColumnSchema
  value: string
  label: string
  error: CellErrorCode | null
  emphasise: boolean
  locale: string
  onChange: (value: string) => void
  inputRef?: (element: HTMLElement | null) => void
}

function CellInput({ column, value, label, error, emphasise, locale, onChange, inputRef }: CellInputProps) {
  const { t } = useI18n()
  const errorId = useId()
  const [focused, setFocused] = useState(false)
  const type = column.type.toLowerCase()
  const numeric = isNumericType(type)
  const base = `w-full rounded-md border px-2 py-1.5 text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${
    error ? 'border-danger bg-danger-soft/40' : 'border-border bg-white'
  } ${emphasise ? 'font-semibold text-primary' : ''}`
  const describedBy = error ? errorId : undefined
  const options = column.options ?? []

  let control
  if (type === 'selection' && options.length > 0) {
    control = (
      <select
        ref={inputRef}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={column.mandatory ? true : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={base}
      >
        <option value="">{t.reports.table.selectPlaceholder}</option>
        {!options.includes(value) && value !== '' && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  } else {
    const parsed = numeric ? parseNumberInput(value, isIntegerType(type)) : null
    const shown = numeric && !focused && parsed?.value !== null && parsed?.value !== undefined && !error ? formatNumber(parsed.value, locale) : value
    control = (
      <input
        ref={inputRef}
        type={type === 'date' ? 'date' : 'text'}
        inputMode={numeric ? (isIntegerType(type) ? 'numeric' : 'decimal') : undefined}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={column.mandatory ? true : undefined}
        value={shown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        className={`${base} ${numeric ? 'text-right font-mono' : ''}`}
      />
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {control}
      {error && (
        <span id={errorId} className="text-[0.6875rem] font-medium text-danger-soft-text">
          {t.reports.table.errors[error]}
        </span>
      )}
    </div>
  )
}
