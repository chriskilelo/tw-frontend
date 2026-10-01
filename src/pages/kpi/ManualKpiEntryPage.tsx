import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, LockClosedIcon, PencilSquareIcon, PresentationChartLineIcon, SignalIcon } from '@heroicons/react/20/solid'
import { getKpiActualEntry, recordKpiActual, type KpiActualEntry, type KpiEntryRow } from '../../api/kpi'
import { Select } from '../../components/Select'
import { PanelEmpty } from '../../components/dashboard/DashboardCard'
import { useI18n } from '../../i18n/context'
import { retryUnlessClientError } from '../../lib/apiErrors'
import { formatDateTime, localeFor } from '../../lib/formatters'
import { periodRange } from '../../lib/dashboardFormat'
import { dataSourceLabel, formatKpiValue } from './kpiPresentation'

/**
 * FR-KPI-006, FR-KPI-007. Ministry Attache (own mission) and Ministry HQ Officer (any posting)
 * record the quarterly value of each KPI the engine cannot count itself; KPIs counted live from
 * engine data are listed read-only beside them. Values can be recorded for the running quarter
 * and the four before it; saving again corrects a value in place.
 */
export default function ManualKpiEntryPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.manualEntry
  const [params, setParams] = useSearchParams()
  const missionParam = params.get('mission') || undefined
  const quarterParam = params.get('quarter') || undefined

  const entryQuery = useQuery({
    queryKey: ['kpi', 'actual-entry', missionParam ?? 'default', quarterParam ?? 'default'],
    queryFn: () => getKpiActualEntry({ mission_id: missionParam, period_label: quarterParam }),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })

  function updateParams(changes: Record<string, string | null>) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace: true },
    )
  }

  const error = entryQuery.error
  if (isAxiosError(error) && error.response?.status === 403) {
    return (
      <PageShell>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <PanelEmpty icon={<LockClosedIcon />} title={copy.notAvailableTitle} body={copy.notAvailableBody} />
        </div>
      </PageShell>
    )
  }

  const data = entryQuery.data
  if (entryQuery.isError && !data) {
    return (
      <PageShell>
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
          <ExclamationTriangleIcon aria-hidden="true" className="size-6 text-danger-soft-text" />
          <p className="text-body text-text-secondary">{copy.loadError}</p>
          <button type="button" onClick={() => void entryQuery.refetch()} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
            <ArrowPathIcon aria-hidden="true" className="size-4" />
            {copy.retry}
          </button>
        </div>
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <div role="status" aria-live="polite" className="space-y-4">
          <span className="sr-only">{copy.loading}</span>
          <div aria-hidden="true" className="h-24 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
          <div aria-hidden="true" className="h-80 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
        </div>
      </PageShell>
    )
  }

  const recordable = data.kpis.filter((kpi) => kpi.recordable)
  const live = data.kpis.filter((kpi) => !kpi.recordable)

  return (
    <PageShell
      action={
        <Link to={`/kpi/dashboard`} className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
          <PresentationChartLineIcon aria-hidden="true" className="size-4" />
          {copy.openDashboard}
        </Link>
      }
    >
      <section aria-label={copy.filtersLabel} className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        {data.missions_available.length > 1 ? (
          <div className="w-full sm:w-72">
            <Select
              label={copy.missionLabel}
              value={data.mission.id}
              onChange={(event) => updateParams({ mission: event.target.value })}
              options={data.missions_available.map((mission) => ({ value: mission.id, label: mission.name }))}
              className="w-full"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">{copy.missionLabel}</span>
            <span className="inline-flex h-10.5 items-center rounded border border-border bg-section-bg px-3 text-body text-text-primary">{data.mission.name}</span>
          </div>
        )}
        <div className="w-full sm:w-72">
          <Select
            label={copy.quarterLabel}
            value={data.quarter.label}
            onChange={(event) => updateParams({ quarter: event.target.value })}
            options={data.quarters.map((quarter) => ({
              value: quarter.label,
              label: `${quarter.label} · ${periodRange(quarter, locale)}${quarter.phase === 'in_progress' ? ` (${copy.inProgress})` : ''}`,
            }))}
            className="w-full"
          />
        </div>
        <p className="basis-full text-caption text-text-secondary">{copy.windowNote}</p>
      </section>

      <section aria-labelledby="manual-entry-heading" className="rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border p-4">
          <h2 id="manual-entry-heading" className="text-h3 text-primary">
            {copy.recordedTitle}
          </h2>
          <p className="text-body-sm text-text-secondary">{copy.recordedSubtitle(data.quarter.label, data.mission.name)}</p>
        </div>
        {recordable.length === 0 ? (
          <p className="px-4 py-8 text-center text-body text-text-secondary">{copy.noRecordable}</p>
        ) : (
          <ul className="divide-y divide-border">
            {recordable.map((kpi) => (
              <EntryRow key={`${kpi.id}-${data.quarter.label}-${data.mission.id}`} kpi={kpi} data={data} locale={locale} />
            ))}
          </ul>
        )}
      </section>

      {live.length > 0 && (
        <section aria-labelledby="manual-entry-live" className="rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border p-4">
            <h2 id="manual-entry-live" className="text-h3 text-primary">
              {copy.liveTitle}
            </h2>
            <p className="text-body-sm text-text-secondary">{copy.liveSubtitle}</p>
          </div>
          <ul className="divide-y divide-border">
            {live.map((kpi) => (
              <li key={kpi.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-body-sm font-semibold text-text-primary">{kpi.name}</span>
                  <span className="mt-0.5 inline-flex items-center gap-1 text-caption text-info-soft-text">
                    <SignalIcon aria-hidden="true" className="size-3.5" />
                    {t.kpi.source.liveHelp(dataSourceLabel(kpi.data_source, t.kpi.dataSource))}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-h4 font-semibold text-primary">{formatKpiValue(kpi.value, locale)}</span>
                  {kpi.quarter_target !== null && <span className="text-caption text-text-secondary">{copy.quarterTarget(formatKpiValue(kpi.quarter_target, locale))}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  )
}

function PageShell({ action, children }: { action?: ReactNode; children: ReactNode }) {
  const { t } = useI18n()
  const copy = t.kpi.manualEntry
  return (
    <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7" data-testid="manual-kpi-entry-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-primary">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-body text-text-secondary">{copy.subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

function EntryRow({ kpi, data, locale }: { kpi: KpiEntryRow; data: KpiActualEntry; locale: string }) {
  const { t } = useI18n()
  const copy = t.kpi.manualEntry
  const queryClient = useQueryClient()
  const [value, setValue] = useState(kpi.value === null ? '' : String(kpi.value))
  const [touched, setTouched] = useState(false)
  const inputId = `actual-${kpi.id}`
  const parsed = Number(value)
  const invalid = value.trim() === '' || !Number.isFinite(parsed) || parsed < 0
  const unchanged = !invalid && kpi.value !== null && parsed === kpi.value

  const mutation = useMutation({
    mutationFn: () => recordKpiActual({ kpi_definition_id: kpi.id, mission_id: data.mission.id, period_label: data.quarter.label, actual_value: parsed }),
    onSuccess: () => {
      setTouched(false)
      void queryClient.invalidateQueries({ queryKey: ['kpi'] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched(true)
    if (!invalid && !unchanged) {
      mutation.mutate()
    }
  }

  const serverError = isAxiosError(mutation.error) ? (mutation.error.response?.data as { errors?: string[] } | undefined)?.errors?.[0] : undefined

  return (
    <li className="px-4 py-3" data-testid={`manual-entry-${kpi.id}`}>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" noValidate>
        <div className="min-w-0">
          <label htmlFor={inputId} className="block text-body-sm font-semibold text-text-primary">
            {kpi.name}
          </label>
          <p className="mt-0.5 text-caption text-text-secondary">
            {kpi.quarter_target !== null ? copy.quarterTarget(formatKpiValue(kpi.quarter_target, locale)) : copy.noTarget}
            {kpi.entered_by && kpi.updated_at && ` · ${copy.lastEntered(kpi.entered_by.full_name, formatDateTime(kpi.updated_at, locale))}`}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <span className="flex flex-col gap-1">
            <input
              id={inputId}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={value}
              aria-invalid={touched && invalid ? true : undefined}
              aria-describedby={touched && invalid ? `${inputId}-error` : undefined}
              onChange={(event) => {
                setValue(event.target.value)
                mutation.reset()
              }}
              className={`h-10 w-32 rounded border px-3 text-right font-mono text-body focus:outline-none focus:ring-2 focus:ring-accent ${touched && invalid ? 'border-danger' : 'border-border'}`}
            />
            {touched && invalid && (
              <span id={`${inputId}-error`} className="text-caption font-semibold text-danger-soft-text">
                {copy.invalidValue}
              </span>
            )}
          </span>
          <button
            type="submit"
            disabled={mutation.isPending || unchanged}
            className="inline-flex h-10 items-center gap-1.5 rounded bg-primary px-4 text-button text-white hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PencilSquareIcon aria-hidden="true" className="size-4" />
            {mutation.isPending ? copy.saving : kpi.value === null ? copy.record : copy.update}
          </button>
        </div>
        {mutation.isSuccess && (
          <p role="status" className="inline-flex items-center gap-1 text-caption font-semibold text-success-soft-text md:col-span-2">
            <CheckCircleIcon aria-hidden="true" className="size-3.5" />
            {copy.saved}
          </p>
        )}
        {mutation.isError && (
          <p role="alert" className="text-caption font-semibold text-danger-soft-text md:col-span-2">
            {serverError ?? copy.saveFailed}
          </p>
        )}
      </form>
    </li>
  )
}
