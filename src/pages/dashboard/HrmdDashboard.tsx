import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
  PresentationChartLineIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid'
import { getHrmdDashboard } from '../../api/sdt'
import type { PerformanceStatus } from '../../api/kpi'
import type { AuthUser, Role } from '../../api/auth'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { DashboardError, DashboardHero, DashboardSkeleton, SegmentedControl } from '../../components/dashboard/layout'
import { KpiStatusLegend, MissionStatusRows, RankedBars, StatTile } from '../../components/dashboard/visuals'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { firstName, formatNumber, greetingPart, percentOf, periodRange, periodTick, recentKpiCycles } from '../../lib/dashboardFormat'

const EMPTY_COUNTS: Record<PerformanceStatus, number> = { on_track: 0, at_risk: 0, below_target: 0, no_target: 0, no_data: 0 }

/**
 * HRM&D Officer (FR-SDT-016, FR-KPI-011): KPI performance across the department's missions,
 * read-only. The officer is fenced to the KPI engine (FR-SDT-018), so this reads only
 * GET /sdt/hrmd-dashboard, which logs every access to the audit trail.
 */
export default function HrmdDashboard({ user, role }: { user: AuthUser; role: Role }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.hrmd
  const cycles = recentKpiCycles(5)
  const [cycle, setCycle] = useState(cycles[1].label)
  const selected = cycles.find((option) => option.label === cycle) ?? cycles[1]

  const matrixQuery = useQuery({ queryKey: ['sdt', 'hrmd-dashboard', cycle], queryFn: () => getHrmdDashboard(cycle), placeholderData: keepPreviousData })

  if (matrixQuery.isLoading) {
    return <DashboardSkeleton />
  }
  if (matrixQuery.isError || !matrixQuery.data) {
    return <DashboardError onRetry={() => void matrixQuery.refetch()} />
  }

  const missions = matrixQuery.data.missions
    .map((mission) => ({
      id: mission.mission_id,
      name: mission.mission_name,
      total: mission.kpis.length,
      counts: mission.kpis.reduce((counts, kpi) => ({ ...counts, [kpi.status]: counts[kpi.status] + 1 }), { ...EMPTY_COUNTS }),
    }))
    .sort((a, b) => (a.total > 0 ? a.counts.on_track / a.total : 0) - (b.total > 0 ? b.counts.on_track / b.total : 0))

  const totals = missions.reduce(
    (sum, mission) => ({
      on_track: sum.on_track + mission.counts.on_track,
      at_risk: sum.at_risk + mission.counts.at_risk,
      below_target: sum.below_target + mission.counts.below_target,
      no_target: sum.no_target + mission.counts.no_target,
      no_data: sum.no_data + mission.counts.no_data,
    }),
    { ...EMPTY_COUNTS },
  )
  const pairs = missions.reduce((sum, mission) => sum + mission.total, 0)

  const belowByKpi = new Map<string, number>()
  matrixQuery.data.missions.forEach((mission) =>
    mission.kpis.forEach((kpi) => {
      if (kpi.status === 'below_target') {
        belowByKpi.set(kpi.name, (belowByKpi.get(kpi.name) ?? 0) + 1)
      }
    }),
  )
  const weakestKpis = [...belowByKpi.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  return (
    <>
      <DashboardHero
        title={t.dashboard.hero.greeting[greetingPart()](firstName(user.full_name))}
        subtitle={user.ministry?.name ? `${role.name} · ${user.ministry.name}` : role.name}
        actions={[{ to: '/sdt/hrmd-dashboard', label: t.dashboard.actions.attacheSummaries, icon: <UserGroupIcon />, primary: true }]}
        aside={
          <div className="w-full rounded-xl bg-white p-4 text-text-primary shadow-sm lg:w-80">
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-text-secondary">{copy.cycleLabel}</p>
            <p className="mt-1 text-h3 text-primary">{periodRange(selected, locale)}</p>
            <div className="mt-3">
              <SegmentedControl
                label={copy.cycleLabel}
                value={cycle}
                onChange={setCycle}
                options={cycles.slice(0, 4).map((option, index) => ({
                  value: option.label,
                  label: periodTick(option, locale),
                  note: index === 0 ? t.dashboard.attache.kpi.inProgress : undefined,
                }))}
              />
            </div>
          </div>
        }
      />

      <p className="flex items-start gap-2 rounded-xl border border-border bg-white px-4 py-3 text-body-sm text-text-secondary shadow-sm">
        <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        {copy.auditNote}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={copy.tiles.onTrack} value={`${percentOf(totals.on_track, pairs)}%`} icon={<CheckCircleIcon />} tone="success" footnote={copy.tiles.pairs(totals.on_track, pairs)} />
        <StatTile label={copy.tiles.atRisk} value={formatNumber(totals.at_risk, locale)} icon={<ExclamationTriangleIcon />} tone="atrisk" footnote={copy.tiles.share(percentOf(totals.at_risk, pairs))} />
        <StatTile label={copy.tiles.below} value={formatNumber(totals.below_target, locale)} icon={<XCircleIcon />} tone="danger" footnote={copy.tiles.share(percentOf(totals.below_target, pairs))} />
        <StatTile
          label={copy.tiles.noData}
          value={formatNumber(totals.no_data + totals.no_target, locale)}
          icon={<MinusCircleIcon />}
          tone="neutral"
          footnote={copy.tiles.share(percentOf(totals.no_data + totals.no_target, pairs))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DashboardCard
          className="lg:col-span-7"
          title={copy.missions.title}
          icon={<PresentationChartLineIcon />}
          tone="success"
          subtitle={copy.missions.subtitle(periodRange(selected, locale))}
          table={{
            caption: copy.missions.title,
            columns: [
              { key: 'mission', label: t.dashboard.leadership.kpi.mission },
              { key: 'on_track', label: t.kpi.status.on_track, numeric: true },
              { key: 'at_risk', label: t.kpi.status.at_risk, numeric: true },
              { key: 'below_target', label: t.kpi.status.below_target, numeric: true },
              { key: 'no_data', label: t.kpi.status.no_data, numeric: true },
            ],
            rows: missions.map((mission) => ({
              mission: mission.name,
              on_track: mission.counts.on_track,
              at_risk: mission.counts.at_risk,
              below_target: mission.counts.below_target,
              no_data: mission.counts.no_data + mission.counts.no_target,
            })),
          }}
        >
          {missions.length > 0 ? (
            <>
              <KpiStatusLegend />
              <div className="mt-4">
                <MissionStatusRows rows={missions} limit={10} />
              </div>
            </>
          ) : (
            <PanelEmpty icon={<PresentationChartLineIcon />} title={t.dashboard.common.emptyTitle} body={copy.missions.empty} />
          )}
        </DashboardCard>

        <DashboardCard className="lg:col-span-5" title={copy.weakest.title} icon={<XCircleIcon />} tone="danger" subtitle={copy.weakest.subtitle}>
          {weakestKpis.length > 0 ? (
            <RankedBars items={weakestKpis} limit={8} barClassName="bg-chart-below" />
          ) : (
            <PanelEmpty icon={<CheckCircleIcon />} title={t.dashboard.common.emptyTitle} body={copy.weakest.empty} />
          )}
        </DashboardCard>
      </div>
    </>
  )
}
