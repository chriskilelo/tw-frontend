/** Shared, framework-free helpers for the directive issue and detail pages. */

/** StoreDirectiveRequest / StoreDirectiveNoteRequest / UpdateDirectiveStatusRequest: max 5000 characters. */
export const DIRECTIVE_TEXT_MAX = 5000

/** StoreDirectiveRequest: type_category max 100 characters. */
export const DIRECTIVE_TYPE_MAX = 100

/** Today (or `date`) as a local YYYY-MM-DD string, the format the API's date fields expect. */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** A YYYY-MM-DD string `days` calendar days after `from` (local time, DST-safe). */
export function addDays(from: string, days: number): string {
  const date = parseDateOnly(from)
  date.setDate(date.getDate() + days)
  return localDateString(date)
}

/**
 * Formats a date-only value ("2026-10-12") as a local calendar date. Parsing it with
 * `new Date("2026-10-12")` would read it as UTC midnight and show the previous day west of
 * Greenwich, so the parts are read directly.
 */
export function formatCalendarDate(value: string, locale: string): string {
  return parseDateOnly(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Cuts `text` at a word boundary near `max` characters, adding an ellipsis when shortened. */
export function truncateText(text: string, max: number): string {
  const singleLine = text.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= max) {
    return singleLine
  }
  const cut = singleLine.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
