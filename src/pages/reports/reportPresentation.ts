import type {
  CellValue,
  ReportColumnSchema,
  ReportDataRow,
  ReportRowPayload,
  ReportSectionDetail,
  ReportTableConfig,
  SectionCompletion,
} from '../../api/reports'

/** Longest narrative section and table cell the API accepts (ReportService). */
export const SECTION_CONTENT_MAX = 50000
export const CELL_TEXT_MAX = 2000
export const DEFAULT_MAX_ROWS = 200

/**
 * Date-only values ("2026-10-15") are calendar days, not instants: format them in UTC so no
 * timezone can move them to the day before.
 */
export function formatDay(value: string, locale: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { ...options, timeZone: 'UTC' })
}

/** "Jul – Sep 2026" for a quarter. */
export function formatPeriodRange(start: string, end: string, locale: string): string {
  const from = formatDay(start, locale, { month: 'short' })
  const to = formatDay(end, locale, { month: 'short', year: 'numeric' })
  return `${from} – ${to}`
}

// --- Numbers (FR-RPT-010) ------------------------------------------------------

const INTEGER_TYPES = ['integer']
const DECIMAL_TYPES = ['numeric', 'number', 'decimal', 'currency']

export function isNumericType(type: string): boolean {
  const normalised = type.toLowerCase()
  return INTEGER_TYPES.includes(normalised) || DECIMAL_TYPES.includes(normalised)
}

export function isIntegerType(type: string): boolean {
  return INTEGER_TYPES.includes(type.toLowerCase())
}

export type CellErrorCode = 'number' | 'integer' | 'option' | 'tooLong'

/**
 * What a user typed into a number cell. Thousands separators (commas and spaces) are
 * accepted and dropped — they are display formatting, never stored. Up to 15 digits, and up
 * to 4 decimal places for a decimal column, as the API accepts.
 */
export function parseNumberInput(raw: string, integer: boolean): { value: number | null; error: CellErrorCode | null } {
  const compact = raw.replace(/[\s,]/g, '')
  if (compact === '') {
    return { value: null, error: null }
  }
  const pattern = integer ? /^-?\d{1,15}$/ : /^-?\d{1,15}(\.\d{1,4})?$/
  if (pattern.test(compact)) {
    return { value: Number(compact), error: null }
  }
  return { value: null, error: integer && /^-?\d{1,15}\.\d+$/.test(compact) ? 'integer' : 'number' }
}

/** Locale thousands separators for display (FR-RPT-010). */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value)
}

// --- Table rows -------------------------------------------------------------------

/** A row as the editor holds it: every cell as the text the user sees and types. */
export interface EditableRow {
  id: string
  values: Record<string, string>
}

export interface CellError {
  rowIndex: number
  column: string
  code: CellErrorCode
}

/** A UUID for a new row, so the row keeps one id from its first save onwards. */
export function newRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

function cellText(value: CellValue | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

export function rowsFromSection(section: ReportSectionDetail): EditableRow[] {
  return [...(section.data_rows ?? [])]
    .sort((a, b) => a.row_order - b.row_order)
    .map((row: ReportDataRow) => ({
      id: row.id,
      values: Object.fromEntries(Object.entries(row.row_data ?? {}).map(([key, value]) => [key, cellText(value)])),
    }))
}

export function validateCell(column: ReportColumnSchema, raw: string): CellErrorCode | null {
  const text = raw.trim()
  if (text === '') {
    return null
  }
  if (isNumericType(column.type)) {
    return parseNumberInput(text, isIntegerType(column.type)).error
  }
  if (column.type.toLowerCase() === 'selection' && column.options && column.options.length > 0) {
    return column.options.includes(text) ? null : 'option'
  }
  return text.length > CELL_TEXT_MAX ? 'tooLong' : null
}

export function validateRows(columns: ReportColumnSchema[], rows: EditableRow[]): CellError[] {
  const errors: CellError[] = []
  rows.forEach((row, rowIndex) => {
    for (const column of columns) {
      const code = validateCell(column, row.values[column.name] ?? '')
      if (code) {
        errors.push({ rowIndex, column: column.name, code })
      }
    }
  })
  return errors
}

/** The rows as the API stores them: numbers as numbers, blanks left out. Assumes valid rows. */
export function rowsPayload(columns: ReportColumnSchema[], rows: EditableRow[]): ReportRowPayload[] {
  return rows.map((row) => {
    const rowData: Record<string, CellValue> = {}
    for (const column of columns) {
      const text = (row.values[column.name] ?? '').trim()
      if (text === '') {
        continue
      }
      rowData[column.name] = isNumericType(column.type) ? parseNumberInput(text, isIntegerType(column.type)).value : text
    }
    return { id: row.id, row_data: rowData }
  })
}

/** A row standing in for the computed total ("TOTAL (auto-calculated row)"): never summed. */
export function isTotalPlaceholder(table: ReportTableConfig | null, values: Record<string, string>): boolean {
  const total = table?.total
  if (!total) {
    return false
  }
  return (values[total.label_column] ?? '').trim().toUpperCase().startsWith(total.label.toUpperCase())
}

/**
 * FR-RPT-009: the sums of the designated numeric columns over the budget lines — rows standing
 * in for the total and rows the configuration excludes (e.g. "Bank Account Balance") are not
 * summed. Invalid cells count as nothing until corrected.
 */
export function computeTotals(table: ReportTableConfig | null, columns: ReportColumnSchema[], rows: EditableRow[]): Record<string, number> | null {
  const total = table?.total
  if (!total) {
    return null
  }
  const excluded = total.exclude_labels.map((label) => label.trim().toUpperCase())
  const summed = rows.filter((row) => {
    if (isTotalPlaceholder(table, row.values)) {
      return false
    }
    return !excluded.includes((row.values[total.label_column] ?? '').trim().toUpperCase())
  })
  return Object.fromEntries(
    total.sum_columns.map((name) => {
      const column = columns.find((candidate) => candidate.name === name)
      const integer = column ? isIntegerType(column.type) : false
      const sum = summed.reduce((acc, row) => acc + (parseNumberInput(row.values[name] ?? '', integer).value ?? 0), 0)
      return [name, Math.round(sum * 10000) / 10000]
    }),
  )
}

// --- Completion (FR-RPT-013) --------------------------------------------------------

/** Mirrors ReportService::sectionCompletion(): shown live while the attache types. */
export function narrativeCompletion(content: string): SectionCompletion {
  return content.trim() === '' ? 'empty' : 'complete'
}

export function tableCompletion(columns: ReportColumnSchema[], table: ReportTableConfig | null, rows: EditableRow[]): SectionCompletion {
  const labelColumns = table?.label_columns ?? []
  const valueColumns = columns.map((column) => column.name).filter((name) => !labelColumns.includes(name))
  const mandatory = columns.filter((column) => column.mandatory).map((column) => column.name)
  const counted = rows.filter((row) => !isTotalPlaceholder(table, row.values))
  const filled = (row: EditableRow, name: string) => (row.values[name] ?? '').trim() !== ''

  if (!counted.some((row) => valueColumns.some((name) => filled(row, name)))) {
    return 'empty'
  }
  return counted.every((row) => mandatory.every((name) => filled(row, name))) ? 'complete' : 'started'
}

export function wordCount(text: string): number {
  const words = text.replace(/[*_#|>`-]+/g, ' ').trim()
  return words === '' ? 0 : words.split(/\s+/).length
}
