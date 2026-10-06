import { useQuery } from '@tanstack/react-query'
import {
  ArrowTrendingUpIcon,
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  MapPinIcon,
  RectangleStackIcon,
  TableCellsIcon,
  TrophyIcon,
} from '@heroicons/react/20/solid'
import { getMfaAwarenessSummary, getNationalOverview, type NationalOverviewMission } from '../../api/governance'
import type { AuthUser, Role } from '../../api/auth'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { ChartLegend, QuarterBarChart } from '../../components/dashboard/charts'
import { CHART_COLORS } from '../../components/dashboard/chartTheme'
import { DashboardError, DashboardHero, DashboardSkeleton } from '../../components/dashboard/layout'
import { RankedBars, StatTile } from '../../components/dashboard/visuals'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { firstName, formatNumber, greetingPart, periodRange } from '../../lib/dashboardFormat'
import { GOVERNANCE_TYPES } from './governanceLabels'

/**
 * MFA HQ Officer / MFA Principal Secretary (FR-MFA-001 to 003): cross-mission awareness from
 * aggregate counts only — never record content. The Principal Secretary also sees each
 * mission's momentum from the national overview.
 */
export default function MfaDashboard({ user, role }: { user: AuthUser; role: Role }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.mfa
  const isPrincipalSecretary = role.name === 'MFA Principal Secretary'

  const summaryQuery = useQuery({ queryKey: ['mfa-awareness', 'summary', null, null], queryFn: () => getMfaAwarenessSummary() })
  const overviewQuery = useQuery({ queryKey: ['mfa-awareness', 'national-overview', null], queryFn: () => getNationalOverview(), enabled: isPrincipalSecretary })

  if (summaryQuery.isLoading) {
    return <DashboardSkeleton />
  }
  if (summaryQuery.isError || !summaryQuery.data) {
    return <DashboardError onRetry={() => void summaryQuery.refetch()} />
  }

  const summary = summaryQuery.data
  // by_period: the last eight fiscal quarters, the one in progress last.
  const quarters = summary.by_period.map((point) => ({ label: point.label, start: point.start, end: point.end, records: point.total }))
  const thisQuarter = quarters.at(-1)?.records ?? 0
  const lastQuarter = quarters.at(-2)?.records ?? 0
  const missionEntries = summary.by_mission
    .filter((mission) => mission.total > 0)
    .map((mission): [string, number] => [mission.mission_name, mission.total])
    .sort((a, b) => b[1] - a[1])
  const [topMission] = missionEntries
  const activeMissionCount = summary.by_mission.filter((mission) => mission.active).length
  const departments = summary.by_ministry.filter((ministry) => ministry.total > 0).map((ministry): [string, number] => [ministry.ministry_name, ministry.total])

  return (
    <>
      <DashboardHero
        title={t.dashboard.hero.greeting[greetingPart()](firstName(user.full_name))}
        subtitle={`${role.name} · ${copy.scope}`}
        actions={[
          { to: '/mfa-awareness', label: t.dashboard.actions.mfaAwareness, icon: <GlobeAltIcon />, primary: true },
          { to: '/mfa-awareness?view=log', label: t.governance.mfaAwareness.views.log, icon: <TableCellsIcon /> },
        ]}
        aside={
          <div className="w-full rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/15 lg:w-80">
            <p className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.08em] text-white/70">
              <GlobeAltIcon aria-hidden="true" className="size-4 text-accent" />
              {copy.network}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-[2.5rem] font-semibold leading-none">{missionEntries.length}</span>
              <span className="text-body text-white/80">{copy.missionsReporting(missionEntries.length)}</span>
            </p>
            <p className="mt-1 text-body-sm text-white/75">{copy.recordsToDate(formatNumber(summary.total, locale))}</p>
          </div>
        }
      />

      <p className="flex items-start gap-2 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-body-sm text-info-soft-text">
        <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {copy.aggregateNote}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={copy.tiles.thisQuarter}
          value={formatNumber(thisQuarter, locale)}
          icon={<RectangleStackIcon />}
          tone="info"
          delta={{ current: thisQuarter, previous: lastQuarter }}
          trend={quarters.map((quarter) => quarter.records)}
        />
        <StatTile
          label={copy.tiles.missions}
          value={formatNumber(missionEntries.length, locale)}
          icon={<MapPinIcon />}
          tone="accent"
          footnote={activeMissionCount > 0 ? copy.tiles.ofMissions(activeMissionCount) : undefined}
        />
        <StatTile
          label={copy.tiles.topMission}
          value={<span className="font-sans text-h2 font-bold">{topMission?.[0] ?? '—'}</span>}
          icon={<TrophyIcon />}
          tone="success"
          footnote={topMission ? copy.tiles.topMissionNote(formatNumber(topMission[1], locale)) : undefined}
        />
        <StatTile
          label={copy.tiles.departments}
          value={formatNumber(departments.length, locale)}
          icon={<BuildingOffice2Icon />}
          tone="directive"
          footnote={departments.length === 1 ? departments[0][0] : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DashboardCard
          className="lg:col-span-8"
          title={copy.trend.title}
          icon={<ChartBarIcon />}
          tone="info"
          subtitle={copy.trend.insight(formatNumber(quarters.reduce((sum, quarter) => sum + quarter.records, 0), locale))}
          table={{
            caption: copy.trend.title,
            columns: [
              { key: 'period', label: t.dashboard.common.period },
              { key: 'records', label: copy.trend.series, numeric: true },
            ],
            rows: quarters.map((quarter) => ({ period: `${quarter.label} (${periodRange(quarter, locale)})`, records: quarter.records })),
          }}
        >
          <ChartLegend
            items={[
              { label: copy.trend.series, color: CHART_COLORS.series1 },
              { label: t.dashboard.common.quarterInProgress, color: CHART_COLORS.series1, hatched: true },
            ]}
          />
          <div className="mt-3">
            <QuarterBarChart data={quarters} series={[{ key: 'records', label: copy.trend.series, color: CHART_COLORS.series1 }]} />
          </div>
        </DashboardCard>

        <DashboardCard className="lg:col-span-4" title={copy.byType.title} icon={<RectangleStackIcon />} tone="neutral" subtitle={copy.byType.subtitle}>
          <RankedBars
            items={GOVERNANCE_TYPES.map(({ type }) => ({ name: t.dashboard.governance.types[type], count: summary.by_type[type] ?? 0 })).sort((a, b) => b.count - a.count)}
          />
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DashboardCard className="lg:col-span-7" title={copy.byMission.title} icon={<MapPinIcon />} tone="accent" subtitle={copy.byMission.subtitle}>
          {missionEntries.length > 0 ? (
            <RankedBars limit={8} items={missionEntries.map(([name, count]) => ({ name, count }))} barClassName="bg-chart-2" />
          ) : (
            <PanelEmpty icon={<MapPinIcon />} title={t.dashboard.common.emptyTitle} body={t.dashboard.common.empty} />
          )}
        </DashboardCard>

        {isPrincipalSecretary ? (
          <DashboardCard className="lg:col-span-5" title={copy.momentum.title} icon={<ArrowTrendingUpIcon />} tone="success" subtitle={copy.momentum.subtitle}>
            {overviewQuery.data && overviewQuery.data.missions.length > 0 ? (
              <MomentumList missions={overviewQuery.data.missions} />
            ) : (
              <PanelEmpty icon={<ArrowTrendingUpIcon />} title={t.dashboard.common.emptyTitle} body={t.dashboard.common.empty} />
            )}
          </DashboardCard>
        ) : (
          <DashboardCard className="lg:col-span-5" title={copy.byDepartment.title} icon={<BuildingLibraryIcon />} tone="directive" subtitle={copy.byDepartment.subtitle}>
            <RankedBars items={departments.map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)} barClassName="bg-chart-3" />
          </DashboardCard>
        )}
      </div>
    </>
  )
}

/**
 * One dumbbell per mission: the hollow dot is last quarter, the filled dot this quarter,
 * joined by a line; sorted by the size of the change. Numbers are written beside each.
 */
function MomentumList({ missions }: { missions: NationalOverviewMission[] }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.mfa.momentum
  const rows = missions
    .map((mission) => ({ name: mission.mission_name, current: mission.current.total, prior: mission.prior.total }))
    .sort((a, b) => Math.abs(b.current - b.prior) - Math.abs(a.current - a.prior))
    .slice(0, 8)
  const max = Math.max(1, ...rows.flatMap((row) => [row.current, row.prior]))

  return (
    <>
      <ChartLegend
        items={[
          { label: copy.prior, color: CHART_COLORS.context },
          { label: copy.current, color: CHART_COLORS.series1 },
        ]}
      />
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const change = row.current - row.prior
          const left = (Math.min(row.current, row.prior) / max) * 100
          const width = (Math.abs(change) / max) * 100
          return (
            <li key={row.name} className="grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-3">
              <span className="truncate text-body-sm font-medium text-text-primary">{row.name}</span>
              <span aria-hidden="true" className="relative h-4">
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                <span className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-text-muted/60" style={{ left: `${left}%`, width: `${width}%` }} />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
                  style={{ left: `${(row.prior / max) * 100}%`, borderColor: CHART_COLORS.context }}
                />
                <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${(row.current / max) * 100}%`, background: CHART_COLORS.series1 }} />
              </span>
              <span className="w-24 text-right text-caption text-text-secondary">
                <span className="font-mono">{formatNumber(row.prior, locale)}</span> → <span className="font-mono font-semibold text-text-primary">{formatNumber(row.current, locale)}</span>
                <span className="sr-only">. {change === 0 ? copy.flat : change > 0 ? copy.rising : copy.falling}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}
