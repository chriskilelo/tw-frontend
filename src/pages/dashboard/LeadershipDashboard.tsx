import { useState, type ReactNode } from 'react'
import {
  ArrowsRightLeftIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentChartBarIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  GlobeAltIcon,
  InboxArrowDownIcon,
  LightBulbIcon,
  PlusIcon,
  PresentationChartLineIcon,
  ScaleIcon,
} from '@heroicons/react/20/solid'
import type { LeadershipDashboard as LeadershipDashboardData } from '../../api/dashboard'
import type { AuthUser, Role } from '../../api/auth'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { ChartLegend, QuarterBarChart } from '../../components/dashboard/charts'
import { CHART_COLORS } from '../../components/dashboard/chartTheme'
import { AlertRows, CardLink, DashboardHero, DirectiveRows, SegmentedControl, type HeroAction } from '../../components/dashboard/layout'
import { FunnelSteps, KpiStatusLegend, MissionStatusRows, ProgressRing, RankedBars, StatTile } from '../../components/dashboard/visuals'
import { useI18n } from '../../i18n/context'
import { formatDate, localeFor } from '../../lib/formatters'
import { firstName, formatNumber, greetingPart, percentOf, periodRange, periodTick } from '../../lib/dashboardFormat'

interface LeadershipDashboardProps {
  data: LeadershipDashboardData
  user: AuthUser
  role: Role
  kpiCycle: string | undefined
  onKpiCycleChange: (cycle: string) => void
}

/**
 * Ministry HQ Director ('director') and Ministry PS / Acting PS ('executive'). Both read the
 * department's intelligence, compliance and KPI health; the executive view leads with the
 * alerts routed to the PS for delegation (FR-ALERT-005, FR-SDT-001).
 */
export default function LeadershipDashboard({ data, user, role, kpiCycle, onKpiCycleChange }: LeadershipDashboardProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.leadership
  const isExecutive = data.variant === 'executive'
  const [placeView, setPlaceView] = useState<'countries' | 'sectors'>('countries')

  const totals = data.alert_trend.map((point) => point.opportunities + point.trade_barriers + point.other)
  const { summary: compliance } = data.reports
  const submitted = compliance.submitted_on_time + compliance.submitted_late
  const directiveSummary = data.directives.summary
  const weakest = data.kpi.missions[0]
  const recentFunnel = data.inquiries.funnel

  const actions: HeroAction[] = isExecutive
    ? [
        { to: '/alerts', label: t.dashboard.actions.reviewAlerts, icon: <InboxArrowDownIcon />, primary: true, badge: data.alerts.awaiting_action },
        { to: '/directives/new', label: t.dashboard.actions.issueDirective, icon: <PlusIcon /> },
        { to: '/kpi/comparison', label: t.dashboard.actions.openKpis, icon: <ScaleIcon /> },
      ]
    : [
        { to: '/reports/compliance', label: t.dashboard.actions.reportCompliance, icon: <DocumentChartBarIcon />, primary: true },
        { to: '/kpi/comparison', label: t.dashboard.actions.openKpis, icon: <ScaleIcon /> },
        { to: '/alerts', label: t.dashboard.actions.reviewAlerts, icon: <BellAlertIcon /> },
      ]

  const inbox = isExecutive && (
    <DashboardCard
      key="inbox"
      className="lg:col-span-7"
      title={copy.inbox.title}
      icon={<InboxArrowDownIcon />}
      tone="accent"
      subtitle={copy.inbox.subtitle(data.alerts.awaiting_action)}
      action={data.alerts.awaiting_action > 0 ? <CardLink to="/alerts?status=new">{t.dashboard.common.viewAll}</CardLink> : undefined}
    >
      {(data.alert_inbox ?? []).length > 0 ? (
        <AlertRows items={data.alert_inbox ?? []} />
      ) : (
        <PanelEmpty icon={<CheckCircleIcon />} title={t.dashboard.common.emptyTitle} body={copy.inbox.empty} />
      )}
    </DashboardCard>
  )

  const directivesCard = (span: string) => (
    <DashboardCard
      key="directives"
      className={span}
      title={copy.directives.title}
      icon={<ClipboardDocumentCheckIcon />}
      tone="directive"
      subtitle={copy.directives.subtitle}
      action={<CardLink to="/sdt/directives/overview">{t.dashboard.common.viewAll}</CardLink>}
    >
      <dl className="mb-4 grid grid-cols-3 gap-2">
        {(
          [
            ['open', directiveSummary.issued + directiveSummary.acknowledged + directiveSummary.in_progress],
            ['completed', directiveSummary.completed],
            ['overdue', directiveSummary.overdue],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className={`rounded-lg px-3 py-2 ${key === 'overdue' && value > 0 ? 'bg-danger-soft' : 'bg-page-bg'}`}>
            <dt className={`text-caption ${key === 'overdue' && value > 0 ? 'text-danger-soft-text' : 'text-text-secondary'}`}>{copy.directives.counts[key]}</dt>
            <dd className="font-mono text-h3 font-semibold text-primary">{formatNumber(value, locale)}</dd>
          </div>
        ))}
      </dl>
      {data.directives.items.length > 0 ? (
        // Beside the inbox the list is trimmed so the two cards stay level; "View all" has the rest.
        <DirectiveRows items={isExecutive ? data.directives.items.slice(0, 3) : data.directives.items} showTarget />
      ) : (
        <PanelEmpty icon={<CheckCircleIcon />} title={t.dashboard.common.emptyTitle} body={copy.directives.empty} />
      )}
    </DashboardCard>
  )

  const funnelCard = (
    <DashboardCard
      key="funnel"
      className="lg:col-span-5"
      title={copy.funnel.title}
      icon={<FunnelIcon />}
      tone="accent"
      subtitle={copy.funnel.subtitle(percentOf(recentFunnel.closed, recentFunnel.logged))}
      table={{
        caption: copy.funnel.title,
        columns: [
          { key: 'stage', label: copy.funnel.stage },
          { key: 'count', label: t.dashboard.common.count, numeric: true },
          { key: 'share', label: t.dashboard.common.share, numeric: true },
        ],
        rows: (['logged', 'worked_on', 'resolved', 'closed'] as const).map((stage) => ({
          stage: copy.funnel.stages[stage],
          count: recentFunnel[stage],
          share: `${percentOf(recentFunnel[stage], recentFunnel.logged)}%`,
        })),
      }}
    >
      <FunnelSteps steps={(['logged', 'worked_on', 'resolved', 'closed'] as const).map((stage) => ({ key: stage, label: copy.funnel.stages[stage], value: recentFunnel[stage] }))} />
      {recentFunnel.cancelled > 0 && <p className="mt-4 text-caption text-text-secondary">{copy.funnel.cancelled(recentFunnel.cancelled)}</p>}
    </DashboardCard>
  )

  const intelligenceRow = (
    <div key="intelligence" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <DashboardCard
        className="lg:col-span-8"
        title={copy.alertTrend.title}
        icon={<LightBulbIcon />}
        tone="info"
        subtitle={copy.alertTrend.insight(totals[totals.length - 1] ?? 0, totals[totals.length - 2] ?? 0)}
        table={{
          caption: copy.alertTrend.title,
          columns: [
            { key: 'period', label: t.dashboard.common.period },
            { key: 'opportunities', label: t.alerts.intelligenceType.opportunities, numeric: true },
            { key: 'trade_barriers', label: t.alerts.intelligenceType.trade_barriers, numeric: true },
            { key: 'total', label: t.dashboard.common.total, numeric: true },
          ],
          rows: data.alert_trend.map((point, index) => ({
            period: `${point.label} (${periodRange(point, locale)})`,
            opportunities: point.opportunities,
            trade_barriers: point.trade_barriers,
            total: totals[index],
          })),
        }}
      >
        <ChartLegend
          items={[
            { label: t.alerts.intelligenceType.opportunities, color: CHART_COLORS.series3 },
            { label: t.alerts.intelligenceType.trade_barriers, color: CHART_COLORS.series2 },
            { label: t.dashboard.common.quarterInProgress, color: CHART_COLORS.context, hatched: true },
          ]}
        />
        <div className="mt-3">
          <QuarterBarChart
            stacked
            data={data.alert_trend}
            series={[
              { key: 'opportunities', label: t.alerts.intelligenceType.opportunities, color: CHART_COLORS.series3 },
              { key: 'trade_barriers', label: t.alerts.intelligenceType.trade_barriers, color: CHART_COLORS.series2 },
            ]}
          />
        </div>
      </DashboardCard>

      <DashboardCard
        className="lg:col-span-4"
        title={copy.compliance.title}
        icon={<DocumentChartBarIcon />}
        tone="success"
        subtitle={copy.compliance.subtitle(data.reports.period.label, formatDate(data.reports.period.deadline, locale))}
        action={<CardLink to="/reports/compliance">{t.dashboard.common.viewAll}</CardLink>}
      >
        <div className="flex items-center gap-4">
          <ProgressRing value={submitted} total={Math.max(data.reports.total, 1)} label={copy.compliance.ringLabel(submitted, data.reports.total)} caption={copy.compliance.ringCaption} />
          <ul className="flex-1 space-y-2 text-body-sm">
            <ComplianceCount icon={<CheckCircleIcon />} color={CHART_COLORS.onTrack} label={copy.compliance.onTime} value={compliance.submitted_on_time} />
            <ComplianceCount icon={<ExclamationTriangleIcon />} color={CHART_COLORS.atRisk} label={copy.compliance.late} value={compliance.submitted_late} />
            <ComplianceCount icon={<ClockIcon />} color={CHART_COLORS.none} label={copy.compliance.outstanding} value={compliance.not_yet_submitted} />
          </ul>
        </div>
        <p className="mt-4 text-caption font-semibold uppercase tracking-wide text-text-secondary">{copy.compliance.attention}</p>
        {data.reports.attention.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {data.reports.attention.slice(0, 10).map((row) => (
              <li
                key={row.mission_id}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-medium ${
                  row.status === 'submitted_late' ? 'bg-atrisk-soft text-atrisk-soft-text' : 'bg-section-bg text-text-secondary'
                }`}
              >
                {row.status === 'submitted_late' ? <ExclamationTriangleIcon aria-hidden="true" className="size-3" /> : <ClockIcon aria-hidden="true" className="size-3" />}
                {row.mission_name}
                <span className="sr-only">({row.status === 'submitted_late' ? copy.compliance.late : copy.compliance.outstanding})</span>
              </li>
            ))}
            {data.reports.attention.length > 10 && <li className="px-1 py-1 text-caption text-text-secondary">{copy.compliance.more(data.reports.attention.length - 10)}</li>}
          </ul>
        ) : (
          <p className="mt-2 text-body-sm text-success-soft-text">{copy.compliance.allIn}</p>
        )}
      </DashboardCard>
    </div>
  )

  const kpiRow = (
    <div key="kpi" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <DashboardCard
        className="lg:col-span-7"
        title={copy.kpi.title}
        icon={<PresentationChartLineIcon />}
        tone="success"
        subtitle={weakest && weakest.total > 0 ? copy.kpi.insight(weakest.mission_name, periodRange(data.kpi.cycle, locale)) : copy.kpi.empty}
        action={
          <SegmentedControl
            label={copy.kpi.cycleLabel}
            value={kpiCycle ?? data.kpi.cycle.label}
            onChange={onKpiCycleChange}
            options={data.kpi.options.slice(0, 3).map((option, index) => ({
              value: option.label,
              label: periodTick(option, locale),
              note: index === 0 ? t.dashboard.attache.kpi.inProgress : undefined,
            }))}
          />
        }
        table={{
          caption: copy.kpi.title,
          columns: [
            { key: 'mission', label: copy.kpi.mission },
            { key: 'on_track', label: t.kpi.status.on_track, numeric: true },
            { key: 'at_risk', label: t.kpi.status.at_risk, numeric: true },
            { key: 'below_target', label: t.kpi.status.below_target, numeric: true },
            { key: 'no_data', label: t.kpi.status.no_data, numeric: true },
          ],
          rows: data.kpi.missions.map((row) => ({
            mission: row.mission_name,
            on_track: row.counts.on_track,
            at_risk: row.counts.at_risk,
            below_target: row.counts.below_target,
            no_data: row.counts.no_data + row.counts.no_target,
          })),
        }}
      >
        <KpiStatusLegend />
        <div className="mt-4">
          <MissionStatusRows rows={data.kpi.missions.map((row) => ({ id: row.mission_id, name: row.mission_name, counts: row.counts, total: row.total }))} />
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <CardLink to="/kpi/comparison">{copy.kpi.openComparison}</CardLink>
        </div>
      </DashboardCard>

      <DashboardCard
        className="lg:col-span-5"
        title={placeView === 'countries' ? copy.places.countriesTitle : copy.places.sectorsTitle}
        icon={<GlobeAltIcon />}
        tone="info"
        subtitle={copy.places.subtitle}
        action={
          <SegmentedControl
            label={copy.places.switchLabel}
            value={placeView}
            onChange={setPlaceView}
            options={[
              { value: 'countries', label: copy.places.countries },
              { value: 'sectors', label: copy.places.sectors },
            ]}
          />
        }
      >
        {(placeView === 'countries' ? data.top_countries : data.top_sectors).length > 0 ? (
          <RankedBars
            items={(placeView === 'countries' ? data.top_countries : data.top_sectors).map((item) => ({
              ...item,
              to: placeView === 'countries' ? `/search/countries/${encodeURIComponent(item.name)}` : undefined,
            }))}
          />
        ) : (
          <PanelEmpty icon={<GlobeAltIcon />} title={t.dashboard.common.emptyTitle} body={t.dashboard.common.empty} />
        )}
      </DashboardCard>
    </div>
  )

  const historyCard = (
    <DashboardCard
      key="history"
      className="lg:col-span-7"
      title={copy.history.title}
      icon={<DocumentChartBarIcon />}
      tone="success"
      subtitle={copy.history.subtitle}
      table={{
        caption: copy.history.title,
        columns: [
          { key: 'period', label: t.dashboard.common.period },
          { key: 'on_time', label: copy.compliance.onTime, numeric: true },
          { key: 'late', label: copy.compliance.late, numeric: true },
          { key: 'missing', label: copy.compliance.outstanding, numeric: true },
        ],
        rows: data.reports.trend.map((point) => ({
          period: `${point.label} (${periodRange(point, locale)})${point.is_open ? ` · ${copy.compliance.notDue}` : ''}`,
          on_time: point.on_time,
          late: point.late,
          missing: point.missing,
        })),
      }}
    >
      <ChartLegend
        items={[
          { label: copy.compliance.onTime, color: CHART_COLORS.onTrack },
          { label: copy.compliance.late, color: CHART_COLORS.atRisk },
          { label: copy.compliance.missing, color: CHART_COLORS.below },
          { label: copy.compliance.notDue, color: '#cbd5e1' },
        ]}
      />
      <div className="mt-3">
        <QuarterBarChart
          stacked
          data={data.reports.trend.map((point) => ({ ...point, missing: point.is_open ? 0 : point.missing, not_due: point.is_open ? point.missing : 0 }))}
          partialIndex={null}
          noteFor={(datum) => (datum.is_open ? copy.compliance.openNote : undefined)}
          series={[
            { key: 'on_time', label: copy.compliance.onTime, color: CHART_COLORS.onTrack },
            { key: 'late', label: copy.compliance.late, color: CHART_COLORS.atRisk },
            { key: 'missing', label: copy.compliance.missing, color: CHART_COLORS.below },
            { key: 'not_due', label: copy.compliance.notDue, color: '#cbd5e1' },
          ]}
        />
      </div>
    </DashboardCard>
  )

  const throughputCard = (
    <DashboardCard
      key="throughput"
      className="lg:col-span-5"
      title={copy.throughput.title}
      icon={<ArrowsRightLeftIcon />}
      tone="accent"
      subtitle={copy.throughput.insight(data.inquiries.closed_this_quarter, data.inquiries.open)}
      table={{
        caption: copy.throughput.title,
        columns: [
          { key: 'period', label: t.dashboard.common.period },
          { key: 'received', label: copy.throughput.received, numeric: true },
          { key: 'closed', label: copy.throughput.closed, numeric: true },
        ],
        rows: data.inquiry_trend.map((point) => ({ period: `${point.label} (${periodRange(point, locale)})`, received: point.received, closed: point.closed })),
      }}
    >
      <ChartLegend
        items={[
          { label: copy.throughput.received, color: CHART_COLORS.series1 },
          { label: copy.throughput.closed, color: CHART_COLORS.series3 },
        ]}
      />
      <div className="mt-3">
        <QuarterBarChart
          data={data.inquiry_trend.slice(-4)}
          height={220}
          series={[
            { key: 'received', label: copy.throughput.received, color: CHART_COLORS.series1 },
            { key: 'closed', label: copy.throughput.closed, color: CHART_COLORS.series3 },
          ]}
        />
      </div>
    </DashboardCard>
  )

  const rows: ReactNode[] = isExecutive
    ? [
        <div key="top" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {inbox}
          {directivesCard('lg:col-span-5')}
        </div>,
        intelligenceRow,
        kpiRow,
        <div key="bottom" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {historyCard}
          {funnelCard}
        </div>,
      ]
    : [
        intelligenceRow,
        kpiRow,
        <div key="middle" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {directivesCard('lg:col-span-7')}
          {funnelCard}
        </div>,
        <div key="bottom" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {historyCard}
          {throughputCard}
        </div>,
      ]

  return (
    <>
      <DashboardHero
        title={t.dashboard.hero.greeting[greetingPart()](firstName(user.full_name))}
        subtitle={user.ministry?.name ? `${role.name} · ${user.ministry.name}` : role.name}
        calendar={data.calendar}
        actions={actions}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={copy.tiles.alerts}
          value={formatNumber(data.alerts.this_quarter, locale)}
          icon={<LightBulbIcon />}
          tone="info"
          to="/alerts"
          delta={{ current: data.alerts.this_quarter, previous: data.alerts.previous_quarter }}
          trend={totals}
        />
        {isExecutive ? (
          <StatTile
            label={copy.tiles.awaitingAction}
            value={formatNumber(data.alerts.awaiting_action, locale)}
            icon={<InboxArrowDownIcon />}
            tone={data.alerts.awaiting_action > 0 ? 'accent' : 'success'}
            to="/alerts?status=new"
            footnote={copy.tiles.unacknowledged(data.alerts.unacknowledged)}
          />
        ) : (
          <StatTile
            label={copy.tiles.directives}
            value={`${Math.round(directiveSummary.percentages.completed)}%`}
            icon={<ClipboardDocumentCheckIcon />}
            tone="directive"
            to="/directives/summary"
            footnote={directiveSummary.overdue > 0 ? copy.tiles.directivesOverdue(directiveSummary.overdue) : copy.tiles.directivesNote(directiveSummary.completed, directiveSummary.total)}
            footnoteTone={directiveSummary.overdue > 0 ? 'danger' : 'neutral'}
          />
        )}
        <StatTile
          label={copy.tiles.inquiriesClosed}
          value={formatNumber(data.inquiries.closed_this_quarter, locale)}
          icon={<CheckCircleIcon />}
          tone="success"
          to="/inquiries"
          delta={{ current: data.inquiries.closed_this_quarter, previous: data.inquiries.closed_previous_quarter }}
          trend={data.inquiry_trend.map((point) => point.closed)}
          trendColor={CHART_COLORS.series3}
        />
        <StatTile
          label={copy.tiles.reports}
          value={`${submitted}/${data.reports.total}`}
          icon={<DocumentChartBarIcon />}
          tone="success"
          to="/reports/compliance"
          footnote={copy.tiles.reportsNote(data.reports.period.label, data.reports.period.days_remaining)}
          footnoteTone={compliance.submitted_late > 0 ? 'atrisk' : 'neutral'}
        />
      </div>

      {rows}
    </>
  )
}

function ComplianceCount({ icon, color, label, value }: { icon: ReactNode; color: string; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-text-secondary">
        <span aria-hidden="true" className="[&>svg]:size-4" style={{ color }}>
          {icon}
        </span>
        {label}
      </span>
      <span className="font-mono font-semibold text-text-primary">{value}</span>
    </li>
  )
}
