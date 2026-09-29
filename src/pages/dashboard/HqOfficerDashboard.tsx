import {
  ArrowsRightLeftIcon,
  BellAlertIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  PlusIcon,
  ShareIcon,
  TagIcon,
} from '@heroicons/react/20/solid'
import type { HqOfficerDashboard as HqOfficerDashboardData } from '../../api/dashboard'
import type { AuthUser, Role } from '../../api/auth'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { ChartLegend, QuarterBarChart } from '../../components/dashboard/charts'
import { CHART_COLORS, ORDINAL_RAMP } from '../../components/dashboard/chartTheme'
import { AlertRows, CardLink, DashboardHero, DirectiveRows } from '../../components/dashboard/layout'
import { RankedBars, StatTile } from '../../components/dashboard/visuals'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { firstName, formatNumber, greetingPart, periodRange } from '../../lib/dashboardFormat'

/** Ministry HQ Officer: the alerts delegated to them, the inquiry queue and their directives. */
export default function HqOfficerDashboard({ data, user, role }: { data: HqOfficerDashboardData; user: AuthUser; role: Role }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.hqOfficer
  const trend = data.inquiry_trend
  const current = trend[trend.length - 1]
  const previous = trend[trend.length - 2]
  const oldest = data.inquiries.age.find((bucket) => bucket.key === 'over_90_days')?.count ?? 0
  const maxAge = Math.max(1, ...data.inquiries.age.map((bucket) => bucket.count))

  return (
    <>
      <DashboardHero
        title={t.dashboard.hero.greeting[greetingPart()](firstName(user.full_name))}
        subtitle={user.ministry?.name ? `${role.name} · ${user.ministry.name}` : role.name}
        calendar={data.calendar}
        actions={[
          { to: '/directives/new', label: t.dashboard.actions.issueDirective, icon: <PlusIcon />, primary: true },
          { to: '/sdt/hq-workspace', label: t.dashboard.actions.hqWorkspace, icon: <BuildingOfficeIcon /> },
          { to: '/inquiries', label: t.dashboard.actions.inquiryQueue, icon: <ChatBubbleLeftRightIcon /> },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={copy.tiles.alertsAwaiting}
          value={formatNumber(data.alerts.awaiting_me, locale)}
          icon={<BellAlertIcon />}
          tone={data.alerts.awaiting_me > 0 ? 'accent' : 'success'}
          to="/alerts"
          footnote={copy.tiles.alertsAcknowledged(data.alerts.acknowledged_by_me)}
        />
        <StatTile
          label={copy.tiles.openInquiries}
          value={formatNumber(data.inquiries.open, locale)}
          icon={<ChatBubbleLeftRightIcon />}
          tone="info"
          to="/inquiries"
          footnote={copy.tiles.receivedThisQuarter(data.inquiries.received_this_quarter)}
          trend={trend.map((point) => point.received)}
        />
        <StatTile
          label={copy.tiles.closedThisQuarter}
          value={formatNumber(data.inquiries.closed_this_quarter, locale)}
          icon={<CheckCircleIcon />}
          tone="success"
          to="/inquiries"
          delta={current && previous ? { current: current.closed, previous: previous.closed } : undefined}
          trend={trend.map((point) => point.closed)}
          trendColor={CHART_COLORS.series3}
        />
        <StatTile
          label={copy.tiles.directivesOpen}
          value={formatNumber(data.directives.issued_open, locale)}
          icon={<ClipboardDocumentCheckIcon />}
          tone="directive"
          to="/directives"
          footnote={data.directives.needs_follow_up > 0 ? copy.tiles.followUp(data.directives.needs_follow_up) : copy.tiles.onSchedule}
          footnoteTone={data.directives.needs_follow_up > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DashboardCard
          className="lg:col-span-8"
          title={copy.throughput.title}
          icon={<ArrowsRightLeftIcon />}
          tone="info"
          subtitle={copy.throughput.insight(current?.received ?? 0, current?.closed ?? 0)}
          table={{
            caption: copy.throughput.title,
            columns: [
              { key: 'period', label: t.dashboard.common.period },
              { key: 'received', label: copy.throughput.received, numeric: true },
              { key: 'closed', label: copy.throughput.closed, numeric: true },
            ],
            rows: trend.map((point) => ({ period: `${point.label} (${periodRange(point, locale)})`, received: point.received, closed: point.closed })),
          }}
        >
          <ChartLegend
            items={[
              { label: copy.throughput.received, color: CHART_COLORS.series1 },
              { label: copy.throughput.closed, color: CHART_COLORS.series3 },
              { label: t.dashboard.common.quarterInProgress, color: CHART_COLORS.context, hatched: true },
            ]}
          />
          <div className="mt-3">
            <QuarterBarChart
              data={trend}
              series={[
                { key: 'received', label: copy.throughput.received, color: CHART_COLORS.series1 },
                { key: 'closed', label: copy.throughput.closed, color: CHART_COLORS.series3 },
              ]}
            />
          </div>
        </DashboardCard>

        <DashboardCard className="lg:col-span-4" title={copy.age.title} icon={<ClockIcon />} tone="atrisk" subtitle={copy.age.insight(oldest, data.inquiries.open)}>
          {/* Age bands are ordered, so they read on the ordinal ramp: older is darker. */}
          <ol className="flex h-52 items-end gap-3">
            {data.inquiries.age.map((bucket, index) => (
              <li key={bucket.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="font-mono text-body font-semibold text-text-primary">{formatNumber(bucket.count, locale)}</span>
                <span
                  aria-hidden="true"
                  className="w-full max-w-14 rounded-t-md"
                  style={
                    bucket.count > 0
                      ? { height: `${(bucket.count / maxAge) * 100}%`, background: ORDINAL_RAMP[index + 1] }
                      : { height: 2, background: 'var(--chart-grid)' }
                  }
                />
                <span className="flex min-h-8 items-start justify-center text-center text-caption leading-tight text-text-secondary">{copy.age.buckets[bucket.key as keyof typeof copy.age.buckets]}</span>
              </li>
            ))}
          </ol>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DashboardCard
          className="lg:col-span-7"
          title={copy.alerts.title}
          icon={<BellAlertIcon />}
          tone="accent"
          subtitle={copy.alerts.subtitle}
          action={data.alerts.awaiting_me > 0 ? <CardLink to="/sdt/hq-workspace">{t.dashboard.common.viewAll}</CardLink> : undefined}
        >
          {data.alerts.items.length > 0 ? (
            <AlertRows items={data.alerts.items} />
          ) : (
            <PanelEmpty icon={<CheckCircleIcon />} title={t.dashboard.common.emptyTitle} body={copy.alerts.empty} />
          )}
        </DashboardCard>

        <DashboardCard
          className="lg:col-span-5"
          title={copy.directives.title}
          icon={<ClipboardDocumentCheckIcon />}
          tone="directive"
          subtitle={copy.directives.subtitle}
          action={data.directives.issued_open > 0 ? <CardLink to="/directives">{t.dashboard.common.viewAll}</CardLink> : undefined}
        >
          {data.directives.items.length > 0 ? (
            <DirectiveRows items={data.directives.items} showTarget />
          ) : (
            <PanelEmpty icon={<CheckCircleIcon />} title={t.dashboard.common.emptyTitle} body={copy.directives.empty} />
          )}
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardCard title={copy.categories.title} icon={<TagIcon />} tone="info" subtitle={copy.categories.subtitle}>
          {data.inquiries.categories.length > 0 ? (
            <RankedBars items={data.inquiries.categories} />
          ) : (
            <PanelEmpty icon={<CheckCircleIcon />} title={t.dashboard.common.emptyTitle} body={copy.categories.empty} />
          )}
        </DashboardCard>
        <DashboardCard title={copy.referrals.title} icon={<ShareIcon />} tone="success" subtitle={copy.referrals.subtitle}>
          {data.referrals.length > 0 ? (
            <RankedBars items={data.referrals} barClassName="bg-chart-3" />
          ) : (
            <PanelEmpty icon={<ShareIcon />} title={t.dashboard.common.emptyTitle} body={copy.referrals.empty} />
          )}
        </DashboardCard>
      </div>
    </>
  )
}
