import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
} from '@heroicons/react/20/solid'
import type { DashboardAlertItem, DashboardCalendar, DashboardDirectiveItem } from '../../api/dashboard'
import { AlertStatusBadge } from '../../pages/alerts/AlertStatusBadge'
import { DirectiveStatusBadge } from '../../pages/directives/DirectiveStatusBadge'
import type { AlertStatus } from '../../api/alerts'
import type { DirectiveStatus } from '../../api/directives'
import { useI18n } from '../../i18n/context'
import { formatDate, formatRelativeTime, localeFor } from '../../lib/formatters'
import { clockIn, longDate, periodRange } from '../../lib/dashboardFormat'

const NAIROBI_TIME_ZONE = 'Africa/Nairobi'

// --- Hero ---------------------------------------------------------------------

/** Faint globe of meridians and parallels: TradeWatch reports from 17 missions worldwide. */
function GlobeMotif({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1" className={className}>
      <circle cx="100" cy="100" r="96" />
      <ellipse cx="100" cy="100" rx="40" ry="96" />
      <ellipse cx="100" cy="100" rx="72" ry="96" />
      <path d="M100 4v192M4 100h192" />
      <path d="M14 56h172M14 144h172M34 26h132M34 174h132" />
    </svg>
  )
}

function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export interface HeroAction {
  to: string
  label: string
  icon: ReactNode
  primary?: boolean
  badge?: number
}

interface DashboardHeroProps {
  title: string
  subtitle: ReactNode
  calendar?: DashboardCalendar
  /** Mission city and IANA time zone for the local clock beside Nairobi's. */
  place?: { city: string; timeZone: string } | null
  actions?: HeroAction[]
  /** Replaces the report-deadline panel (e.g. the administrators' health summary). */
  aside?: ReactNode
}

export function DashboardHero({ title, subtitle, calendar, place, actions = [], aside }: DashboardHeroProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const now = useMinuteTick()
  const copy = t.dashboard.hero
  const missionTime = place ? clockIn(place.timeZone, locale, now) : null
  const nairobiTime = clockIn(NAIROBI_TIME_ZONE, locale, now)
  const showMissionClock = place && missionTime && place.timeZone !== NAIROBI_TIME_ZONE

  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-primary text-white shadow-lg">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_140%_at_100%_0%,var(--color-primary-lightest)_0%,transparent_55%),linear-gradient(135deg,var(--color-primary)_0%,var(--color-primary-light)_100%)]"
      />
      <GlobeMotif className="absolute -right-16 -top-20 -z-10 size-80 text-white/[0.07] sm:-right-6" />
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-accent via-accent-light to-transparent" />

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-white/70">
            {longDate(now, locale)}
            {calendar && ` · ${copy.fiscalQuarter(calendar.quarter.label)}`}
          </p>
          <h1 className="mt-2 text-[1.75rem] font-bold leading-tight sm:text-[2rem]">{title}</h1>
          <p className="mt-1.5 text-body text-white/80">{subtitle}</p>

          {(showMissionClock || nairobiTime) && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={copy.clocksLabel}>
              {showMissionClock && (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-caption text-white/90 ring-1 ring-white/15">
                  <ClockIcon aria-hidden="true" className="size-3.5 text-accent" />
                  {place.city}
                  <span className="font-mono font-semibold text-white">{missionTime}</span>
                </li>
              )}
              {nairobiTime && (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-caption text-white/90 ring-1 ring-white/15">
                  <ClockIcon aria-hidden="true" className="size-3.5 text-white/70" />
                  {copy.nairobi}
                  <span className="font-mono font-semibold text-white">{nairobiTime}</span>
                </li>
              )}
            </ul>
          )}

          {actions.length > 0 && (
            <nav aria-label={copy.quickActions} className="mt-5 flex flex-wrap gap-2">
              {actions.map((action) => (
                <Link
                  key={action.to + action.label}
                  to={action.to}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-button transition-colors motion-reduce:transition-none ${
                    action.primary
                      ? 'bg-accent text-accent-text shadow-sm hover:bg-accent-light'
                      : 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20'
                  }`}
                >
                  <span aria-hidden="true" className="[&>svg]:size-4">
                    {action.icon}
                  </span>
                  {action.label}
                  {action.badge !== undefined && action.badge > 0 && (
                    <span className="rounded-full bg-white px-1.5 font-mono text-[0.6875rem] font-bold text-primary">{action.badge}</span>
                  )}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {aside ?? (calendar && <DeadlinePanel calendar={calendar} />)}
      </div>
    </section>
  )
}

function DeadlinePanel({ calendar }: { calendar: DashboardCalendar }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.hero
  const { reporting_period: period, quarter } = calendar
  const elapsedShare = Math.min(100, Math.round((quarter.days_elapsed / quarter.days_total) * 100))

  return (
    <div className="w-full rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/15 backdrop-blur-sm lg:w-80">
      <p className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.08em] text-white/70">
        <CalendarDaysIcon aria-hidden="true" className="size-4 text-accent" />
        {copy.nextDeadline}
      </p>
      <p className="mt-2 flex items-baseline gap-2">
        {period.days_remaining === 0 ? (
          <span className="text-h2 font-bold">{copy.dueToday}</span>
        ) : (
          <>
            <span className="font-mono text-[2.5rem] font-semibold leading-none">{period.days_remaining}</span>
            <span className="text-body text-white/80">{copy.daysLeft(period.days_remaining)}</span>
          </>
        )}
      </p>
      <p className="mt-1 text-body-sm text-white/75">{copy.reportsDue(period.label, formatDate(period.deadline, locale))}</p>

      <div className="mt-4">
        <div className="flex justify-between text-caption text-white/70">
          <span>{periodRange(quarter, locale)}</span>
          <span>{copy.dayOf(quarter.days_elapsed, quarter.days_total)}</span>
        </div>
        <div
          role="progressbar"
          aria-label={copy.quarterProgressLabel}
          aria-valuemin={0}
          aria-valuemax={quarter.days_total}
          aria-valuenow={quarter.days_elapsed}
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${elapsedShare}%` }} />
        </div>
      </div>
    </div>
  )
}

// --- Shell states -----------------------------------------------------------

export function DashboardSkeleton() {
  const { t } = useI18n()
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">{t.dashboard.loading}</span>
      <div aria-hidden="true" className="h-52 rounded-2xl bg-primary/90 motion-safe:animate-pulse" />
      <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-32 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
        ))}
      </div>
      <div aria-hidden="true" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-80 rounded-xl border border-border bg-white motion-safe:animate-pulse lg:col-span-2" />
        <div className="h-80 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
      </div>
    </div>
  )
}

export function DashboardError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white px-6 py-12 text-center shadow-sm">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
          <ExclamationTriangleIcon className="size-6" />
        </span>
        <h1 className="text-h2 text-primary">{t.dashboard.title}</h1>
        <p className="max-w-md text-body text-text-secondary">{t.dashboard.loadError}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-button text-white hover:bg-primary-light"
        >
          <ArrowPathIcon aria-hidden="true" className="size-4" />
          {t.dashboard.retry}
        </button>
    </div>
  )
}

// --- Rows -------------------------------------------------------------------

const INTELLIGENCE_STYLE: Record<string, { chip: string; icon: typeof NoSymbolIcon }> = {
  opportunities: { chip: 'bg-success-soft text-success-soft-text', icon: ArrowTrendingUpIcon },
  trade_barriers: { chip: 'bg-danger-soft text-danger-soft-text', icon: NoSymbolIcon },
}

export function AlertRows({ items }: { items: DashboardAlertItem[] }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)

  return (
    <ul className="-mx-2 divide-y divide-border">
      {items.map((alert) => {
        const style = INTELLIGENCE_STYLE[alert.intelligence_type] ?? { chip: 'bg-section-bg text-text-secondary', icon: ArrowTrendingUpIcon }
        const TypeIcon = style.icon
        const typeLabel = t.alerts.intelligenceType[alert.intelligence_type as keyof typeof t.alerts.intelligenceType] ?? alert.intelligence_type
        return (
          <li key={alert.id}>
            <Link to={`/alerts/${alert.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-page-bg">
              <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-lg ${style.chip}`}>
                <TypeIcon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-body-sm">
                  <span className="font-mono font-semibold text-primary">{alert.reference_number}</span>
                  <span className="text-text-secondary">· {alert.country}</span>
                </span>
                <span className="block truncate text-caption text-text-secondary">
                  {typeLabel}
                  {alert.mission_name && ` · ${alert.mission_name}`} · {formatRelativeTime(alert.created_at, locale)}
                </span>
              </span>
              <AlertStatusBadge status={alert.status as AlertStatus} />
              <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-text-muted group-hover:text-primary" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function DirectiveRows({ items, showTarget = false }: { items: DashboardDirectiveItem[]; showTarget?: boolean }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.common

  return (
    <ul className="-mx-2 divide-y divide-border">
      {items.map((directive) => (
        <li key={directive.id}>
          <Link to={`/directives/${directive.id}`} className="group flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-page-bg">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ${directive.is_overdue ? 'bg-danger-soft text-danger-soft-text' : 'bg-directive-soft text-directive-soft-text'}`}
            >
              <CalendarDaysIcon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-body-sm font-medium text-text-primary">{directive.description}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-text-secondary">
                {directive.target_completion_date ? copy.due(formatDate(directive.target_completion_date, locale)) : copy.noDueDate}
                {showTarget && directive.target_name && <span>· {directive.target_name}</span>}
                {directive.mission_name && <span>· {directive.mission_name}</span>}
                {directive.is_overdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 font-semibold text-danger-soft-text">
                    <ExclamationTriangleIcon aria-hidden="true" className="size-3" />
                    {copy.overdue}
                  </span>
                )}
                {directive.is_stale && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-atrisk-soft px-2 py-0.5 font-semibold text-atrisk-soft-text">
                    <ClockIcon aria-hidden="true" className="size-3" />
                    {copy.stale}
                  </span>
                )}
              </span>
            </span>
            <DirectiveStatusBadge status={directive.status as DirectiveStatus} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

// --- Controls ---------------------------------------------------------------

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string; note?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  // WAI-ARIA radio group: one tab stop, arrow keys move (and select) within the group.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) {
      return
    }
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-page-bg p-1">
      {options.map((option, index) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2.5 py-1 text-caption font-semibold transition-colors motion-reduce:transition-none ${
              isSelected ? 'bg-white text-primary shadow-sm ring-1 ring-border' : 'text-text-secondary hover:text-primary'
            }`}
          >
            {option.label}
            {option.note && <span className="ml-1 font-normal text-text-muted">{option.note}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline">
      {children}
      <ChevronRightIcon aria-hidden="true" className="size-4" />
    </Link>
  )
}
