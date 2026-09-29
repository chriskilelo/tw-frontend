import type { PeriodRef } from '../api/dashboard'

/**
 * Formatting for the dashboards. Fiscal labels follow the house convention (CLAUDE.md
 * Section 8: "Q1 2026" is Jul-Sep 2026, "Q3 2026" is Jan-Mar 2026), which does not read in
 * chronological order on an axis, so charts label periods by their months instead and keep
 * the official label for tooltips and tables.
 */

function parseDate(value: string): Date {
  // Date-only strings are parsed as UTC midnight; read them back in UTC so a timezone west
  // of Greenwich never shifts "2026-07-01" into June.
  return new Date(`${value.slice(0, 10)}T00:00:00Z`)
}

function monthName(value: string, locale: string): string {
  return parseDate(value).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })
}

function year(value: string): number {
  return parseDate(value).getUTCFullYear()
}

/** Axis tick for a quarter: "Jul–Sep '26". */
export function periodTick(period: PeriodRef, locale: string): string {
  return `${monthName(period.start, locale)}–${monthName(period.end, locale)} ’${String(year(period.end)).slice(2)}`
}

/** Full range for tooltips and tables: "Jul – Sep 2026", or "Nov 2025 – Apr 2026" across years. */
export function periodRange(period: PeriodRef, locale: string): string {
  const startYear = year(period.start)
  const endYear = year(period.end)
  const start = startYear === endYear ? monthName(period.start, locale) : `${monthName(period.start, locale)} ${startYear}`
  return `${start} – ${monthName(period.end, locale)} ${endYear}`
}

export function formatNumber(value: number, locale: string, maximumFractionDigits = 0): string {
  return value.toLocaleString(locale, { maximumFractionDigits })
}

export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

/** "Good morning" / "afternoon" / "evening" key for the hero greeting. */
export function greetingPart(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours()
  if (hour < 12) {
    return 'morning'
  }
  return hour < 17 ? 'afternoon' : 'evening'
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? ''
}

/** Wall-clock time in an IANA time zone ("14:05"), or null if the zone is unknown. */
export function clockIn(timeZone: string, locale: string, date: Date = new Date()): string | null {
  try {
    return date.toLocaleTimeString(locale, { timeZone, hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}

/** Long date for the hero eyebrow: "Tuesday, 29 September 2026". */
export function longDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatBytes(bytes: number, locale: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  return `${value.toLocaleString(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`
}

/** Monday date of an ISO week start for the sign-in activity axis: "7 Sep". */
export function weekTick(weekStart: string, locale: string): string {
  return parseDate(weekStart).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Fiscal label for a quarter start date: July starts "Q1 {year}", January "Q3 {year}". */
export function fiscalQuarterLabel(start: string): string {
  const date = parseDate(start)
  const quarter = { 7: 1, 10: 2, 1: 3, 4: 4 }[date.getUTCMonth() + 1] ?? 0
  return `Q${quarter} ${date.getUTCFullYear()}`
}

/**
 * The last `count` fiscal quarters, oldest first, ending with the one containing `today`.
 * Fiscal quarters start in Jan/Apr/Jul/Oct, the same months as calendar quarters.
 */
export function recentQuarters(count: number, today: Date = new Date()): PeriodRef[] {
  const startMonth = Math.floor(today.getMonth() / 3) * 3
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index
    const start = new Date(Date.UTC(today.getFullYear(), startMonth - offset * 3, 1))
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0))
    const startIso = start.toISOString().slice(0, 10)
    return { label: fiscalQuarterLabel(startIso), start: startIso, end: end.toISOString().slice(0, 10) }
  })
}

/**
 * Half-yearly KPI cycles (CLAUDE.md Section 8), newest first: the cycle in progress, then
 * the ones before it. "H1 2026" is Jul-Dec 2026 and "H2 2026" is Jan-Jun 2026.
 */
export function recentKpiCycles(count: number, today: Date = new Date()): PeriodRef[] {
  const isFirstHalf = today.getMonth() >= 6
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(Date.UTC(today.getFullYear(), (isFirstHalf ? 6 : 0) - index * 6, 1))
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 6, 0))
    const label = `${start.getUTCMonth() === 6 ? 'H1' : 'H2'} ${start.getUTCFullYear()}`
    return { label, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  })
}
