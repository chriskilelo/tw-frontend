/** Up to two uppercase initials from a full name ("Purity Samanthe" -> "PS"). */
export function initials(fullName: string | null | undefined): string {
  return (fullName ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Short uppercase extension label for a file badge ("report.pdf" -> "PDF"). */
export function fileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toUpperCase().slice(0, 4) ?? ''
}

export function localeFor(language: string): string {
  return language === 'sw' ? 'sw-KE' : 'en-GB'
}

export function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole calendar days from `from` to `to` (never negative). */
export function daysBetween(from: string | Date, to: string | Date = new Date()): number {
  const start = new Date(from)
  const end = new Date(to)
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.max(0, Math.round((endDay - startDay) / DAY_MS))
}

/** "3 days ago", "yesterday", "in 2 hours", localised via Intl.RelativeTimeFormat. */
export function formatRelativeTime(value: string, locale: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['week', 7 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, unitSeconds] of units) {
    if (Math.abs(seconds) >= unitSeconds) {
      return formatter.format(Math.round(seconds / unitSeconds), unit)
    }
  }
  return formatter.format(0, 'minute')
}
