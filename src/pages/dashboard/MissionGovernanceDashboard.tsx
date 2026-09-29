import { useQuery } from '@tanstack/react-query'
import {
  ChartBarIcon,
  EyeIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  QueueListIcon,
  Squares2X2Icon,
} from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'
import { getMissionActivityFeed, getMissionActivitySummary } from '../../api/governance'
import type { AuthUser, Role } from '../../api/auth'
import { DashboardCard, PanelEmpty, type IconTone } from '../../components/dashboard/DashboardCard'
import { ChartLegend, ComparisonBarChart } from '../../components/dashboard/charts'
import { CHART_COLORS } from '../../components/dashboard/chartTheme'
import { CardLink, DashboardError, DashboardHero, DashboardSkeleton } from '../../components/dashboard/layout'
import { DeltaPill, RankedBars, StatTile } from '../../components/dashboard/visuals'
import { useI18n } from '../../i18n/context'
import { formatRelativeTime, localeFor } from '../../lib/formatters'
import { firstName, fiscalQuarterLabel, formatNumber, greetingPart, periodRange } from '../../lib/dashboardFormat'
import { GOVERNANCE_TYPES, useGovernanceStatusLabel, useReadableSummary } from './governanceLabels'


/**
 * Head of Mission / Deputy Head of Mission (FR-HOM-001 to 003): their own mission's activity,
 * this quarter against the last. Structurally read-only (BR-020), so the view has no write
 * actions at all.
 */
export default function MissionGovernanceDashboard({ user, role }: { user: AuthUser; role: Role }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.governance
  const statusLabel = useGovernanceStatusLabel()
  const readableSummary = useReadableSummary()

  const summaryQuery = useQuery({ queryKey: ['mission-activity', 'summary'], queryFn: getMissionActivitySummary })
  const feedQuery = useQuery({ queryKey: ['mission-activity', 'feed', 'dashboard'], queryFn: () => getMissionActivityFeed({ per_page: 8 }) })

  if (summaryQuery.isLoading) {
    return <DashboardSkeleton />
  }
  if (summaryQuery.isError || !summaryQuery.data) {
    return <DashboardError onRetry={() => void summaryQuery.refetch()} />
  }

  const { current_period: current, prior_period: prior } = summaryQuery.data
  const currentRef = { label: fiscalQuarterLabel(current.period_start), start: current.period_start, end: current.period_end }
  const priorRef = { label: fiscalQuarterLabel(prior.period_start), start: prior.period_start, end: prior.period_end }
  const comparison = GOVERNANCE_TYPES.map(({ type }) => ({ name: copy.types[type], current: current.by_type[type] ?? 0, prior: prior.by_type[type] ?? 0 }))
  const feed = feedQuery.data?.data ?? []

  return (
    <>
      <DashboardHero
        title={t.dashboard.hero.greeting[greetingPart()](firstName(user.full_name))}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {user.mission?.name ? `${role.name} · ${user.mission.name}` : role.name}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-caption font-semibold text-white ring-1 ring-white/20">
              <EyeIcon aria-hidden="true" className="size-3.5" />
              {t.dashboard.common.viewOnly}
            </span>
          </span>
        }
        place={user.mission?.city && user.mission.time_zone ? { city: user.mission.city, timeZone: user.mission.time_zone } : null}
        actions={[
          { to: '/mission-activity', label: t.dashboard.actions.missionActivity, icon: <QueueListIcon />, primary: true },
          { to: '/search', label: t.dashboard.actions.search, icon: <MagnifyingGlassIcon /> },
        ]}
        aside={
          <div className="w-full rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/15 lg:w-80">
            <p className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.08em] text-white/70">
              <GlobeAltIcon aria-hidden="true" className="size-4 text-accent" />
              {copy.quarterAtGlance}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-[2.5rem] font-semibold leading-none">{formatNumber(current.total, locale)}</span>
              <span className="text-body text-white/80">{copy.records(current.total)}</span>
            </p>
            <p className="mt-1 text-body-sm text-white/75">
              {periodRange(currentRef, locale)} · {copy.priorTotal(prior.total, periodRange(priorRef, locale))}
            </p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GOVERNANCE_TYPES.map(({ type, icon, tone }) => (
          <StatTile
            key={type}
            label={copy.tileLabel(copy.types[type])}
            value={formatNumber(current.by_type[type] ?? 0, locale)}
            icon={icon}
            tone={tone}
            to="/mission-activity"
            delta={{ current: current.by_type[type] ?? 0, previous: prior.by_type[type] ?? 0 }}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DashboardCard
          className="lg:col-span-7"
          title={copy.comparison.title}
          icon={<ChartBarIcon />}
          tone="info"
          subtitle={copy.comparison.subtitle(periodRange(currentRef, locale), periodRange(priorRef, locale))}
          table={{
            caption: copy.comparison.title,
            columns: [
              { key: 'name', label: copy.comparison.type },
              { key: 'current', label: copy.comparison.current, numeric: true },
              { key: 'prior', label: copy.comparison.prior, numeric: true },
            ],
            rows: comparison,
          }}
        >
          <ChartLegend
            items={[
              { label: copy.comparison.current, color: CHART_COLORS.series1 },
              { label: copy.comparison.prior, color: CHART_COLORS.context },
            ]}
          />
          <div className="mt-3">
            <ComparisonBarChart data={comparison} currentLabel={copy.comparison.current} priorLabel={copy.comparison.prior} />
          </div>
          <div className="mt-2">
            <DeltaPill current={current.total} previous={prior.total} />
          </div>
        </DashboardCard>

        <DashboardCard className="lg:col-span-5" title={copy.status.title} icon={<Squares2X2Icon />} tone="neutral" subtitle={copy.status.subtitle}>
          {Object.keys(current.by_status).length > 0 ? (
            <RankedBars
              items={Object.entries(current.by_status)
                .map(([status, count]) => ({ name: statusLabel(status), count }))
                .sort((a, b) => b.count - a.count)}
            />
          ) : (
            <PanelEmpty icon={<Squares2X2Icon />} title={t.dashboard.common.emptyTitle} body={copy.status.empty} />
          )}
        </DashboardCard>
      </div>

      <DashboardCard title={copy.feed.title} icon={<QueueListIcon />} tone="primary" subtitle={copy.feed.subtitle} action={<CardLink to="/mission-activity">{t.dashboard.common.viewAll}</CardLink>}>
        {feed.length > 0 ? (
          <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[1.1rem] before:top-2 before:w-px before:bg-border">
            {feed.map((item) => {
              const typeStyle = GOVERNANCE_TYPES.find((entry) => entry.type === item.type) ?? GOVERNANCE_TYPES[0]
              return (
                <li key={`${item.type}-${item.id}`} className="relative flex gap-3">
                  <span className="relative z-10 [&>span]:ring-4 [&>span]:ring-white">
                    <GovernanceTypeChip icon={typeStyle.icon} tone={typeStyle.tone} />
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
                      <span className="font-semibold text-primary">{copy.types[item.type]}</span>
                      <span className="font-mono text-caption text-text-secondary">{item.reference}</span>
                      {item.status && <span className="rounded-full bg-section-bg px-2 py-0.5 text-caption font-medium text-text-secondary">{statusLabel(item.status)}</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-body-sm text-text-primary">{readableSummary(item.summary)}</p>
                    <p className="mt-1 text-caption text-text-secondary">
                      {item.submitting_officer && `${copy.feed.by(item.submitting_officer)} · `}
                      {formatRelativeTime(item.date, locale)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <PanelEmpty icon={<QueueListIcon />} title={t.dashboard.common.emptyTitle} body={copy.feed.empty} />
        )}
      </DashboardCard>
    </>
  )
}

function GovernanceTypeChip({ icon, tone }: { icon: ReactNode; tone: IconTone }) {
  const toneClass: Record<IconTone, string> = {
    info: 'bg-info-soft text-info-soft-text',
    accent: 'bg-accent-soft text-accent-soft-text',
    directive: 'bg-directive-soft text-directive-soft-text',
    success: 'bg-success-soft text-success-soft-text',
    danger: 'bg-danger-soft text-danger-soft-text',
    atrisk: 'bg-atrisk-soft text-atrisk-soft-text',
    neutral: 'bg-section-bg text-text-secondary',
    primary: 'bg-primary text-white',
  }
  return (
    <span aria-hidden="true" className={`grid size-9 place-items-center rounded-full [&>svg]:size-4 ${toneClass[tone]}`}>
      {icon}
    </span>
  )
}
