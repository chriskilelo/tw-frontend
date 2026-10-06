import {
  BellAlertIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  FunnelIcon,
  MapPinIcon,
  PlusIcon,
  PresentationChartLineIcon,
} from '@heroicons/react/20/solid'
import { Link } from 'react-router-dom'
import type { AttacheDashboard as AttacheDashboardData } from '../../api/dashboard'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { ChartLegend, QuarterBarChart } from '../../components/dashboard/charts'
import { CHART_COLORS, ORDINAL_RAMP } from '../../components/dashboard/chartTheme'
import { CardLink, DashboardHero, DirectiveRows, SegmentedControl } from '../../components/dashboard/layout'
import { BulletLegend, KpiBulletList, ProgressRing, StackedBar, StatTile } from '../../components/dashboard/visuals'
import type { AuthUser, Role } from '../../api/auth'
import { useI18n } from '../../i18n/context'
import { formatDate, localeFor } from '../../lib/formatters'
import { firstName, formatNumber, greetingPart, periodRange, periodTick } from '../../lib/dashboardFormat'

interface AttacheDashboardProps {
  data: AttacheDashboardData
  user: AuthUser
  role: Role
  kpiCycle: string | undefined
  onKpiCycleChange: (cycle: string) => void
}

/**
 * Ministry Attache: what the mission owes HQ this quarter and how it is performing
 * (BR-001: own mission only). The KPI panel is the FR-KPI-010 self-service view.
 */
export default function AttacheDashboard({ data, user, role, kpiCycle, onKpiCycleChange }: AttacheDashboardProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.attache
  const greeting = t.dashboard.hero.greeting[greetingPart()](firstName(user.full_name))

  if (!data.mission || !data.activity_trend || !data.alerts || !data.inquiries || !data.directives || !data.report || !data.kpi) {
    return (
      <>
        <DashboardHero title={greeting} subtitle={role.name} calendar={data.calendar} />
        <PanelEmpty icon={<MapPinIcon />} title={copy.noMission.title} body={copy.noMission.body} />
      </>
    )
  }

  const { mission, activity_trend: trend, alerts, inquiries, directives, report, kpi } = data
  const reportLink = report.id ? `/reports/${report.id}` : `/reports/new?period=${encodeURIComponent(report.period.label)}`
  const reportActionLabel = report.status === 'submitted' ? t.dashboard.actions.viewReport : report.status === 'draft' ? t.dashboard.actions.openReport : t.dashboard.actions.startReport
  const onTrack = kpi.kpis.filter((row) => row.status === 'on_track').length
  const currentCycleLabel = kpi.options[0]?.label

  return (
    <>
      <DashboardHero
        title={greeting}
        subtitle={copy.subtitle(role.name, mission.name, mission.host_country)}
        calendar={data.calendar}
        place={{ city: mission.city, timeZone: mission.time_zone }}
        actions={[
          { to: '/alerts/new', label: t.dashboard.actions.submitAlert, icon: <PlusIcon />, primary: true },
          { to: '/inquiries/new', label: t.dashboard.actions.logInquiry, icon: <ChatBubbleLeftRightIcon /> },
          { to: reportLink, label: reportActionLabel, icon: <DocumentTextIcon /> },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={copy.tiles.alerts}
          value={formatNumber(alerts.this_quarter, locale)}
          icon={<BellAlertIcon />}
          tone="info"
          to="/alerts"
          delta={{ current: alerts.this_quarter, previous: alerts.previous_quarter }}
          trend={trend.map((point) => point.alerts)}
          trendColor={CHART_COLORS.series1}
        />
        <StatTile
          label={copy.tiles.inquiries}
          value={formatNumber(inquiries.open, locale)}
          icon={<ChatBubbleLeftRightIcon />}
          tone="accent"
          to="/inquiries"
          footnote={copy.tiles.highValue(inquiries.high_value_open)}
          trend={trend.map((point) => point.inquiries)}
          trendColor={CHART_COLORS.series2}
        />
        <StatTile
          label={copy.tiles.directives}
          value={formatNumber(directives.open, locale)}
          icon={<ClipboardDocumentCheckIcon />}
          tone="directive"
          to="/directives"
          footnote={directives.overdue > 0 ? copy.tiles.directivesOverdue(directives.overdue) : copy.tiles.directivesClear}
          footnoteTone={directives.overdue > 0 ? 'danger' : 'success'}
        />
        <StatTile
          label={copy.tiles.report(report.period.label)}
          value={
            report.status === 'submitted' ? (
              <span className="inline-flex items-center gap-2 font-sans text-h2 font-bold">
                <CheckCircleIcon aria-hidden="true" className="size-6 text-success" />
                {copy.tiles.reportSubmitted}
              </span>
            ) : (
              `${report.sections_drafted}/${report.sections_total}`
            )
          }
          icon={<DocumentTextIcon />}
          tone="success"
          to={reportLink}
          footnote={
            report.status === 'submitted'
              ? report.is_late
                ? copy.tiles.reportSubmittedLate
                : copy.tiles.reportSubmittedOn(formatDate(report.submitted_at ?? report.period.deadline, locale))
              : report.status === 'draft'
                ? copy.tiles.reportDraft
                : copy.tiles.reportNotStarted
          }
          footnoteTone={report.status === 'submitted' ? (report.is_late ? 'atrisk' : 'success') : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DashboardCard
          className="lg:col-span-8"
          title={copy.activity.title}
          icon={<ChartBarIcon />}
          tone="info"
          subtitle={copy.activity.insight(
            trend.reduce((sum, point) => sum + point.alerts, 0),
            trend.reduce((sum, point) => sum + point.inquiries, 0),
          )}
          table={{
            caption: copy.activity.title,
            columns: [
              { key: 'period', label: t.dashboard.common.period },
              { key: 'alerts', label: copy.activity.alerts, numeric: true },
              { key: 'inquiries', label: copy.activity.inquiries, numeric: true },
            ],
            rows: trend.map((point) => ({ period: `${point.label} (${periodRange(point, locale)})`, alerts: point.alerts, inquiries: point.inquiries })),
          }}
        >
          <ChartLegend
            items={[
              { label: copy.activity.alerts, color: CHART_COLORS.series1 },
              { label: copy.activity.inquiries, color: CHART_COLORS.series2 },
              { label: t.dashboard.common.quarterInProgress, color: CHART_COLORS.context, hatched: true },
            ]}
          />
          <div className="mt-3">
            <QuarterBarChart
              data={trend}
              series={[
                { key: 'alerts', label: copy.activity.alerts, color: CHART_COLORS.series1 },
                { key: 'inquiries', label: copy.activity.inquiries, color: CHART_COLORS.series2 },
              ]}
            />
          </div>
        </DashboardCard>

        <DashboardCard className="lg:col-span-4" title={copy.report.title} icon={<DocumentTextIcon />} tone="success" subtitle={copy.report.subtitle(report.period.label, periodRange(report.period, locale))}>
          <div className="flex h-full flex-col items-center gap-4 text-center">
            <ProgressRing
              value={report.status === 'submitted' ? report.sections_total : report.sections_drafted}
              total={Math.max(report.sections_total, 1)}
              label={copy.report.ringLabel(report.sections_drafted, report.sections_total)}
              caption={copy.report.ringCaption}
            />
            <p className="text-body-sm text-text-secondary">
              {report.status === 'submitted' ? copy.report.submitted : copy.report.dueIn(report.period.days_remaining, formatDate(report.period.deadline, locale))}
            </p>
            <p className="text-caption text-text-muted">{copy.report.optionalNote}</p>
            <Link
              to={reportLink}
              className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-button text-white transition-colors hover:bg-primary-light"
            >
              <DocumentTextIcon aria-hidden="true" className="size-4" />
              {reportActionLabel}
            </Link>
          </div>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCard
          title={copy.directives.title}
          icon={<ClipboardDocumentCheckIcon />}
          tone="directive"
          subtitle={copy.directives.subtitle(directives.open)}
          action={directives.open > 0 ? <CardLink to="/directives">{t.dashboard.common.viewAll}</CardLink> : undefined}
        >
          {directives.items.length > 0 ? (
            <DirectiveRows items={directives.items} />
          ) : (
            <PanelEmpty icon={<CheckCircleIcon />} title={copy.directives.emptyTitle} body={copy.directives.empty} />
          )}
        </DashboardCard>

        <DashboardCard title={copy.pipeline.title} icon={<FunnelIcon />} tone="accent" subtitle={copy.pipeline.subtitle(inquiries.open)}>
          <StackedBar
            segments={(['draft', 'received', 'in_progress', 'pending_external_response', 'resolved'] as const).map((status, index) => ({
              key: status,
              label: t.inquiries.status[status],
              value: inquiries.pipeline[status],
              color: ORDINAL_RAMP[index],
            }))}
          />
          <p className="mt-4 rounded-lg bg-page-bg px-3 py-2 text-caption text-text-secondary">{copy.pipeline.closedNote(inquiries.closed_this_quarter)}</p>
        </DashboardCard>

        <DashboardCard
          title={copy.outcomes.title}
          icon={<CheckBadgeIcon />}
          tone="info"
          subtitle={copy.outcomes.subtitle(alerts.outcomes.acknowledged, alerts.outcomes.new + alerts.outcomes.assigned + alerts.outcomes.acknowledged)}
        >
          <StackedBar
            segments={(['new', 'assigned', 'acknowledged'] as const).map((status, index) => ({
              key: status,
              label: t.alerts.status[status],
              value: alerts.outcomes[status],
              color: ORDINAL_RAMP[index + 1],
            }))}
          />
          <p className="mt-4 rounded-lg bg-page-bg px-3 py-2 text-caption text-text-secondary">{copy.outcomes.explainer}</p>
        </DashboardCard>
      </div>

      <DashboardCard
        title={copy.kpi.title}
        icon={<PresentationChartLineIcon />}
        tone="success"
        subtitle={kpi.kpis.length > 0 ? copy.kpi.insight(onTrack, kpi.kpis.length, periodRange(kpi.cycle, locale)) : copy.kpi.empty}
        action={
          <SegmentedControl
            label={copy.kpi.cycleLabel}
            value={kpiCycle ?? kpi.cycle.label}
            onChange={onKpiCycleChange}
            options={kpi.options.slice(0, 3).map((option) => ({
              value: option.label,
              label: periodTick(option, locale),
              note: option.label === currentCycleLabel ? copy.kpi.inProgress : undefined,
            }))}
          />
        }
        table={{
          caption: copy.kpi.title,
          columns: [
            { key: 'name', label: copy.kpi.kpiColumn },
            { key: 'target', label: copy.kpi.legendTarget, numeric: true },
            { key: 'actual', label: copy.kpi.legendActual, numeric: true },
            { key: 'previous', label: copy.kpi.legendPrevious, numeric: true },
            { key: 'status', label: copy.kpi.statusColumn },
          ],
          rows: kpi.kpis.map((row) => ({
            name: row.name,
            target: row.target ?? '—',
            actual: row.actual ?? '—',
            previous: row.previous_actual ?? '—',
            status: t.kpi.status[row.status],
          })),
        }}
      >
        {kpi.kpis.length > 0 ? (
          <>
            <BulletLegend />
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
              <KpiBulletList rows={kpi.kpis.slice(0, Math.ceil(kpi.kpis.length / 2))} previousLabel={periodRange(kpi.previous_cycle, locale)} />
              <KpiBulletList rows={kpi.kpis.slice(Math.ceil(kpi.kpis.length / 2))} previousLabel={periodRange(kpi.previous_cycle, locale)} />
            </div>
          </>
        ) : (
          <PanelEmpty icon={<PresentationChartLineIcon />} title={copy.kpi.emptyTitle} body={copy.kpi.empty} />
        )}
      </DashboardCard>
    </>
  )
}
