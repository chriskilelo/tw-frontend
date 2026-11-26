import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckBadgeIcon, DocumentChartBarIcon } from '@heroicons/react/20/solid'
import { getHrmdDashboard, getHrmdAttacheSummary, listHrmdAttaches, type HrmdAttache } from '../../api/sdt'
import { getCurrentQuarter, type ComparisonMissionRow } from '../../api/kpi'
import { KpiStatusBadge } from '../kpi/KpiStatusBadge'
import { Table, type TableColumn } from '../../components/Table'
import { Badge } from '../../components/Badge'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { Pagination } from '../../components/Pagination'
import { PeoplePicker } from '../../components/PeoplePicker'
import { useClientPagination } from '../../hooks/useClientPagination'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'
import { periodRange, recentKpiCycles, recentQuarters } from '../../lib/dashboardFormat'
import { localeFor } from '../../lib/formatters'

interface DrillDownRequest {
  userId: string
  periodLabel: string
}

/**
 * FR-SDT-016, FR-SDT-017, FR-KPI-011. HRM&D Officer only (KpiPolicy::viewHrmdDashboard()/
 * generateAttacheSummary()); every access is audit-logged server-side
 * (App\Services\KpiService::hrmdDashboard()/attachePerformanceSummary()). Read-only per
 * UI-006 — this page has no mutation of any kind, so there is nothing to gate beyond
 * relying on the backend policy to reject anyone else.
 *
 * K-02: the attache summary is chosen by name, from GET /sdt/hrmd-dashboard/attaches (the
 * department's attaches posted at a mission, grouped by mission), and the period from the
 * recent half-years and quarters. Each mission row also opens its posted attache's summary.
 */
export default function HrmdDashboardPage() {
  const { t, language } = useI18n()
  const [cycleLabel, setCycleLabel] = useState(() => getCurrentQuarter().label)

  const dashboardQuery = useQuery({
    queryKey: ['sdt', 'hrmd-dashboard', cycleLabel],
    queryFn: () => getHrmdDashboard(cycleLabel),
    enabled: cycleLabel.trim() !== '',
  })

  const [drillDownUserIds, setDrillDownUserIds] = useState<string[]>([])
  const [drillDownPeriodLabel, setDrillDownPeriodLabel] = useState(() => getCurrentQuarter().label)
  const [activeDrillDown, setActiveDrillDown] = useState<DrillDownRequest | null>(null)
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null)
  // A row's Summary button moves focus to the summary once it has loaded (or at once, when
  // that summary is already on screen).
  const [summaryFocusRequest, setSummaryFocusRequest] = useState(0)
  const focusSummaryWhenReady = useRef(false)

  const attachesQuery = useQuery({ queryKey: ['sdt', 'hrmd-dashboard', 'attaches'], queryFn: listHrmdAttaches })
  const attaches = useMemo(() => attachesQuery.data ?? [], [attachesQuery.data])
  const postedByMission = useMemo(() => {
    const byMission = new Map<string, HrmdAttache>()
    for (const attache of attaches) {
      if (attache.posted || !byMission.has(attache.mission.id)) {
        byMission.set(attache.mission.id, attache)
      }
    }
    return byMission
  }, [attaches])

  const periodOptions = useMemo(() => {
    const locale = localeFor(language)
    const periods = [...recentKpiCycles(3), ...recentQuarters(6).reverse()]
    const options = periods.map((period) => ({ value: period.label, label: `${period.label} · ${periodRange(period, locale)}` }))
    return options.some((option) => option.value === drillDownPeriodLabel)
      ? options
      : [{ value: drillDownPeriodLabel, label: drillDownPeriodLabel }, ...options]
  }, [language, drillDownPeriodLabel])

  const summaryQuery = useQuery({
    queryKey: ['sdt', 'hrmd-dashboard', 'summary', activeDrillDown?.userId, activeDrillDown?.periodLabel],
    queryFn: () => getHrmdAttacheSummary(activeDrillDown!.userId, activeDrillDown!.periodLabel),
    enabled: activeDrillDown !== null,
  })

  function openSummary(userId: string, periodLabel: string) {
    setDrillDownUserIds([userId])
    setDrillDownPeriodLabel(periodLabel)
    setActiveDrillDown({ userId, periodLabel })
    focusSummaryWhenReady.current = true
    setSummaryFocusRequest((count) => count + 1)
  }

  useEffect(() => {
    if (summaryQuery.data && focusSummaryWhenReady.current) {
      focusSummaryWhenReady.current = false
      summaryHeadingRef.current?.focus()
      summaryHeadingRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }
  }, [summaryQuery.data, summaryFocusRequest])

  function handleDrillDownSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const userId = drillDownUserIds[0]
    if (!userId || drillDownPeriodLabel.trim() === '') {
      return
    }
    setActiveDrillDown({ userId, periodLabel: drillDownPeriodLabel })
  }

  const missions = dashboardQuery.data?.missions ?? []
  const kpiColumns = missions[0]?.kpis ?? []
  const missionsPage = useClientPagination(missions)

  const columns: TableColumn<ComparisonMissionRow>[] = [
    { key: 'mission_name', header: t.sdt.hrmdDashboard.columnMission, render: (row) => row.mission_name },
    {
      key: 'attache',
      header: t.sdt.hrmdDashboard.columnAttache,
      render: (row) => {
        const attache = postedByMission.get(row.mission_id)
        if (!attache) {
          return <span className="text-caption text-text-muted">{t.sdt.hrmdDashboard.noAttache}</span>
        }
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="text-body-sm text-text-primary">{attache.full_name}</span>
            <button
              type="button"
              onClick={() => openSummary(attache.id, cycleLabel)}
              aria-label={t.sdt.hrmdDashboard.rowSummaryLabel(attache.full_name)}
              className="inline-flex items-center gap-1 text-caption font-semibold text-info-soft-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
            >
              <DocumentChartBarIcon className="size-3.5" aria-hidden="true" />
              {t.sdt.hrmdDashboard.rowSummaryButton}
            </button>
          </div>
        )
      },
    },
    ...kpiColumns.map(
      (kpiColumn): TableColumn<ComparisonMissionRow> => ({
        key: kpiColumn.kpi_definition_id,
        header: kpiColumn.name,
        render: (row) => {
          const cell = row.kpis.find((kpi) => kpi.kpi_definition_id === kpiColumn.kpi_definition_id)
          if (!cell) {
            return '—'
          }
          return (
            <div className="flex flex-col items-start gap-1">
              <span className="font-mono text-body-sm">{cell.actual ?? '—'}</span>
              <KpiStatusBadge status={cell.status} />
            </div>
          )
        },
      }),
    ),
  ]

  return (
    <div className="p-6" data-testid="hrmd-dashboard-page">
      <h1 className="text-h1 text-primary">{t.sdt.hrmdDashboard.title}</h1>
      <Badge variant="neutral" label={t.common.readOnly} className="mt-2" />

      <div className="mt-4">
        <Input
          label={t.sdt.hrmdDashboard.cycleLabelLabel}
          value={cycleLabel}
          onChange={(event) => setCycleLabel(event.target.value)}
          className="sm:w-40"
        />
      </div>

      <div className="mt-6">
        <Table
          columns={columns}
          data={missionsPage.pageItems}
          rowKey={(row) => row.mission_id}
          emptyMessage={t.sdt.hrmdDashboard.empty}
        />
        <Pagination
          meta={missionsPage.meta}
          onPageChange={missionsPage.setPage}
          onPerPageChange={missionsPage.setPerPage}
          className="mt-4"
        />
      </div>

      <section className="mt-8 max-w-3xl rounded-xl border border-border bg-white p-5 shadow-sm" aria-labelledby="hrmd-drill-down-title">
        <h2 id="hrmd-drill-down-title" className="text-h3 text-primary">
          {t.sdt.hrmdDashboard.drillDownTitle}
        </h2>
        <p className="mt-1 text-body-sm text-text-secondary">{t.sdt.hrmdDashboard.drillDownIntro}</p>
        <form onSubmit={handleDrillDownSubmit} className="mt-4 flex flex-col gap-4">
          {attachesQuery.isError ? (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-body-sm text-danger-soft-text">
              {apiErrorMessages(attachesQuery.error, t.sdt.hrmdDashboard.attacheLoadError)[0]}
            </p>
          ) : (
            <PeoplePicker
              label={t.sdt.hrmdDashboard.attachePickerLabel}
              mode="single"
              value={drillDownUserIds}
              onChange={setDrillDownUserIds}
              isLoading={attachesQuery.isPending}
              emptyMessage={t.sdt.hrmdDashboard.attacheNoneEligible}
              testId="hrmd-attache-picker"
              people={attaches.map((attache) => ({
                id: attache.id,
                name: attache.full_name,
                // The mission is the group heading; the row adds its country.
                detail: attache.mission.host_country,
                group: attache.mission.name,
                tags: attache.posted
                  ? [{ label: t.sdt.hrmdDashboard.postedTag, tone: 'success' as const, icon: <CheckBadgeIcon className="size-3" aria-hidden="true" /> }]
                  : [],
              }))}
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-80">
              <Select
                label={t.sdt.hrmdDashboard.periodLabelLabel}
                value={drillDownPeriodLabel}
                onChange={(event) => setDrillDownPeriodLabel(event.target.value)}
                options={periodOptions}
              />
            </div>
            <Button type="submit" disabled={drillDownUserIds.length === 0}>
              {t.sdt.hrmdDashboard.viewSummaryButton}
            </Button>
          </div>
        </form>

        {activeDrillDown && (
          <div className="mt-6 border-t border-border-muted pt-5" aria-live="polite">
            {summaryQuery.isError ? (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-body-sm text-danger-soft-text">
                {apiErrorMessages(summaryQuery.error, t.sdt.hrmdDashboard.summaryUnavailable)[0]}
              </p>
            ) : summaryQuery.data ? (
              <>
                <h3 ref={summaryHeadingRef} tabIndex={-1} className="text-body font-semibold text-text-primary focus:outline-none" data-testid="hrmd-summary-heading">
                  {t.sdt.hrmdDashboard.summaryHeading(summaryQuery.data.attache.full_name, summaryQuery.data.attache.mission.name, activeDrillDown.periodLabel)}
                </h3>
                {summaryQuery.data.kpis.length === 0 ? (
                  <p className="mt-2 text-body-sm text-text-muted">{t.sdt.hrmdDashboard.empty}</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {summaryQuery.data.kpis.map((kpi) => (
                      <div key={kpi.kpi_definition_id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-body-sm font-semibold text-text-primary">{kpi.name}</span>
                          <KpiStatusBadge status={kpi.status} />
                        </div>
                        <p className="mt-1 text-caption text-text-muted">
                          {t.kpi.legend.actual}: {kpi.actual ?? '—'} · {t.kpi.legend.target}: {kpi.target ?? '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-body text-text-muted">{t.common.loading}</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
