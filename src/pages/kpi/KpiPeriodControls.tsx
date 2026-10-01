import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDaysIcon, CheckBadgeIcon, ClockIcon, PauseCircleIcon } from '@heroicons/react/20/solid'
import type { KpiPeriodInfo, KpiPeriodOptions, KpiPeriodQuery, KpiPeriodRef } from '../../api/kpi'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { SegmentedControl } from '../../components/dashboard/layout'
import { useI18n } from '../../i18n/context'
import { periodRange } from '../../lib/dashboardFormat'
import { formatDay } from './kpiPresentation'

type PeriodMode = 'half' | 'quarter' | 'range'

interface KpiPeriodPickerProps {
  options: KpiPeriodOptions
  period: KpiPeriodInfo
  onChange: (query: KpiPeriodQuery) => void
  /** Hides the custom range mode (the downloadable report takes a quarter or half-year). */
  allowRange?: boolean
}

/**
 * FR-KPI-009: the current half-year (the default view, FR-KPI-016), a quarter, or a custom
 * range of whole quarters. Every choice is written to the URL by the caller, so a view can be
 * shared and survives a reload.
 */
export function KpiPeriodPicker({ options, period, onChange, allowRange = true }: KpiPeriodPickerProps) {
  const { t, language } = useI18n()
  const copy = t.kpi.period
  const [mode, setMode] = useState<PeriodMode>(period.type)
  const [from, setFrom] = useState(period.type === 'range' ? period.start : '')
  const [to, setTo] = useState(period.type === 'range' ? period.end : '')
  const [rangeError, setRangeError] = useState<string | null>(null)

  useEffect(() => {
    setMode(period.type)
    if (period.type === 'range') {
      setFrom(period.start)
      setTo(period.end)
    }
  }, [period.type, period.start, period.end])

  function optionLabel(option: KpiPeriodRef): string {
    const status = option.phase === 'in_progress' ? copy.inProgress : option.phase === 'upcoming' ? copy.upcoming : null
    return copy.option(option.label, periodRange(option, language === 'sw' ? 'sw-KE' : 'en-GB'), status)
  }

  function selectMode(next: PeriodMode) {
    setMode(next)
    setRangeError(null)
    if (next === 'half' && period.type !== 'half') {
      onChange({ period: options.default })
    } else if (next === 'quarter' && period.type !== 'quarter') {
      onChange({ period: options.quarters[1]?.label ?? options.quarters[0]?.label })
    }
  }

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!from || !to || from > to) {
      setRangeError(copy.rangeInvalid)
      return
    }
    if (to > options.range.latest_end) {
      setRangeError(copy.rangeFuture(formatDay(options.range.latest_end, language === 'sw' ? 'sw-KE' : 'en-GB')))
      return
    }
    setRangeError(null)
    onChange({ from, to })
  }

  const modes: PeriodMode[] = allowRange ? ['half', 'quarter', 'range'] : ['half', 'quarter']
  const list = mode === 'quarter' ? options.quarters : options.halves
  const selectOptions = list.map((option) => ({ value: option.label, label: optionLabel(option) }))
  if (mode !== 'range' && !selectOptions.some((option) => option.value === period.label) && period.type === mode) {
    selectOptions.unshift({ value: period.label, label: period.label })
  }

  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="kpi-period-picker">
      <div className="flex flex-col gap-1">
        <span className="text-body-sm font-semibold text-text-secondary">{copy.label}</span>
        <SegmentedControl<PeriodMode> label={copy.label} value={mode} onChange={selectMode} options={modes.map((value) => ({ value, label: copy.modes[value] }))} />
      </div>

      {mode !== 'range' ? (
        <div className="w-full min-w-0 sm:w-72">
          <Select
            label={mode === 'quarter' ? copy.quarterLabel : copy.halfLabel}
            value={period.type === mode ? period.label : ''}
            placeholder={period.type === mode ? undefined : copy.choose}
            onChange={(event) => event.target.value && onChange({ period: event.target.value })}
            options={selectOptions}
            className="w-full"
          />
        </div>
      ) : (
        <form onSubmit={applyRange} className="flex flex-wrap items-end gap-2" noValidate>
          <Input type="date" label={copy.from} value={from} max={to || options.range.latest_end} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" label={copy.to} value={to} min={from || undefined} max={options.range.latest_end} onChange={(event) => setTo(event.target.value)} />
          <button type="submit" className="inline-flex h-10.5 items-center rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
            {copy.apply}
          </button>
          <p className="basis-full text-caption text-text-secondary">{copy.rangeHint(options.range.max_quarters)}</p>
          {rangeError && (
            <p role="alert" className="basis-full text-caption font-semibold text-danger-soft-text">
              {rangeError}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

/**
 * States how final the figures are and what the statuses are measured against: the share of
 * each target expected by now, which grows as each quarter passes its reporting deadline (the
 * 15th of the following month).
 */
export function KpiPeriodBanner({ period }: { period: KpiPeriodInfo }) {
  const { t, language } = useI18n()
  const locale = language === 'sw' ? 'sw-KE' : 'en-GB'
  const copy = t.kpi.period.banner
  const nextUnsettled = period.quarters.find((quarter) => !quarter.settled)
  const share = Math.round(period.progress * 100)

  let tone: string
  let Icon = CheckBadgeIcon
  let text: string

  if (period.is_final) {
    tone = 'border-success/30 bg-success-soft text-success-soft-text'
    text = copy.final
  } else if (period.phase === 'upcoming') {
    tone = 'border-border bg-section-bg text-text-secondary'
    Icon = CalendarDaysIcon
    text = copy.upcoming(formatDay(period.start, locale))
  } else if (period.settled_quarters === 0) {
    tone = 'border-info/30 bg-info-soft text-info-soft-text'
    Icon = PauseCircleIcon
    text = copy.tooEarly(nextUnsettled ? formatDay(nextUnsettled.deadline, locale) : '')
  } else {
    tone = 'border-info/30 bg-info-soft text-info-soft-text'
    Icon = ClockIcon
    text = copy.partial(period.settled_quarters, period.quarter_count, share, nextUnsettled ? formatDay(nextUnsettled.deadline, locale) : '')
  }

  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-4 py-2.5 text-body-sm font-medium ${tone}`} data-testid="kpi-period-banner">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="font-semibold">
        {period.label} · {periodRange(period, locale)}
      </span>
      <span>{text}</span>
    </p>
  )
}
