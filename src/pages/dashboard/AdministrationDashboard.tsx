import { useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRightEndOnRectangleIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  ListBulletIcon,
  MoonIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  UserPlusIcon,
  UsersIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid'
import { getAdministrationDashboard, type DepartmentHealth, type HealthCheck, type HealthStatus } from '../../api/dashboard'
import { listDepartments } from '../../api/ministries'
import type { AuthUser, Role } from '../../api/auth'
import { isSystemAdministrator } from '../../hooks/useAuth'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { ChartLegend, WeeklyActivityChart } from '../../components/dashboard/charts'
import { CHART_COLORS, ORDINAL_RAMP } from '../../components/dashboard/chartTheme'
import { CardLink, DashboardError, DashboardHero, DashboardSkeleton } from '../../components/dashboard/layout'
import { Meter, ProgressRing, RankedBars, StackedBar, StatTile } from '../../components/dashboard/visuals'
import { Select } from '../../components/Select'
import { useI18n } from '../../i18n/context'
import { formatRelativeTime, localeFor } from '../../lib/formatters'
import { firstName, formatBytes, formatNumber, greetingPart, percentOf, weekTick } from '../../lib/dashboardFormat'

const HEALTH_STYLE: Record<HealthStatus, { icon: typeof CheckCircleIcon; color: string; chip: string }> = {
  pass: { icon: CheckCircleIcon, color: CHART_COLORS.onTrack, chip: 'bg-success-soft text-success-soft-text' },
  warn: { icon: ExclamationTriangleIcon, color: CHART_COLORS.atRisk, chip: 'bg-atrisk-soft text-atrisk-soft-text' },
  fail: { icon: XCircleIcon, color: CHART_COLORS.below, chip: 'bg-danger-soft text-danger-soft-text' },
}

/**
 * System Administrator (every department, optionally narrowed to one) and Ministry
 * Administrator (its own department only, ADR-006). Everything here is administrative —
 * accounts, seats, approvals and configuration — never an operational record (BR-025).
 */
export default function AdministrationDashboard({ user, role }: { user: AuthUser; role: Role }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.dashboard.admin
  const isPlatformAdministrator = isSystemAdministrator(role.name)
  const [ministryId, setMinistryId] = useState('')

  const departmentsQuery = useQuery({ queryKey: ['ministries'], queryFn: listDepartments, enabled: isPlatformAdministrator })
  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard', ministryId],
    queryFn: () => getAdministrationDashboard(ministryId || undefined),
    placeholderData: keepPreviousData,
  })

  if (dashboardQuery.isLoading) {
    return <DashboardSkeleton />
  }
  if (dashboardQuery.isError || !dashboardQuery.data) {
    return <DashboardError onRetry={() => void dashboardQuery.refetch()} />
  }

  const data = dashboardQuery.data
  const { accounts } = data
  const active = accounts.by_status.active
  const passing = data.health_checks.filter((check) => check.status === 'pass').length
  const attention = data.health_checks.filter((check) => check.status !== 'pass')
  const recentWeek = accounts.sign_in_recency.find((bucket) => bucket.key === 'last_7_days')?.count ?? 0
  const scopeName = data.scope.ministry?.name ?? copy.allDepartments

  /** "approval_request.rejected" -> "PS approval request rejected"; unknown codes stay as they are. */
  function describeAction(action: string): string {
    const verbAt = action.lastIndexOf('.')
    const entity = (copy.activity.entities as Record<string, string>)[action.slice(0, verbAt)]
    const verb = (copy.activity.verbs as Record<string, string>)[action.slice(verbAt + 1)]
    return entity && verb ? copy.activity.describe(entity, verb) : action
  }

  return (
    <>
      <DashboardHero
        title={t.dashboard.hero.greeting[greetingPart()](firstName(user.full_name))}
        subtitle={`${role.name} · ${isPlatformAdministrator ? copy.platformScope : scopeName}`}
        actions={[
          { to: '/admin/users/new', label: t.dashboard.actions.newAccount, icon: <UserPlusIcon />, primary: true },
          { to: '/admin/approvals', label: t.dashboard.actions.reviewApprovals, icon: <CheckBadgeIcon />, badge: data.approvals.pending },
          { to: '/admin/audit-log', label: t.dashboard.actions.auditLog, icon: <ListBulletIcon /> },
        ]}
        aside={
          <div className="flex w-full items-center gap-4 rounded-xl bg-white p-4 text-text-primary shadow-sm lg:w-80">
            <ProgressRing
              value={passing}
              total={Math.max(data.health_checks.length, 1)}
              size={96}
              color={attention.some((check) => check.status === 'fail') ? CHART_COLORS.atRisk : CHART_COLORS.onTrack}
              label={copy.health.passing(passing, data.health_checks.length)}
            />
            <div className="min-w-0">
              <p className="text-caption font-semibold uppercase tracking-[0.08em] text-text-secondary">{copy.health.title}</p>
              <p className="mt-1 text-h4 text-primary">{copy.health.passing(passing, data.health_checks.length)}</p>
              <p className="mt-1 text-caption text-text-secondary">{attention.length === 0 ? copy.health.allClear : copy.health.needAttention(attention.length)}</p>
            </div>
          </div>
        }
      />

      {isPlatformAdministrator && (
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
          <div className="w-full sm:w-72">
            <Select
              label={copy.scopeLabel}
              value={ministryId}
              onChange={(event) => setMinistryId(event.target.value)}
              placeholder={copy.allDepartments}
              options={(departmentsQuery.data ?? []).map((department) => ({ value: department.id, label: department.name }))}
            />
          </div>
          <p className="text-body-sm text-text-secondary" aria-live="polite">
            {dashboardQuery.isFetching ? t.dashboard.refreshing : copy.showing(scopeName)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={copy.tiles.activeAccounts}
          value={formatNumber(active, locale)}
          icon={<UsersIcon />}
          tone="info"
          to="/admin/users"
          footnote={copy.tiles.ofAccounts(accounts.total)}
        />
        <StatTile
          label={copy.tiles.signedInWeek}
          value={formatNumber(recentWeek, locale)}
          icon={<ArrowRightEndOnRectangleIcon />}
          tone="success"
          footnote={copy.tiles.shareOfActive(percentOf(recentWeek, active))}
          trend={data.sign_in_activity.map((week) => week.active_users)}
        />
        <StatTile
          label={copy.tiles.dormant}
          value={formatNumber(accounts.dormant, locale)}
          icon={<MoonIcon />}
          tone={accounts.dormant > 0 ? 'atrisk' : 'success'}
          footnote={copy.tiles.dormantNote(accounts.never_signed_in)}
          footnoteTone={accounts.dormant > 0 ? 'atrisk' : 'neutral'}
        />
        <StatTile
          label={copy.tiles.pendingApprovals}
          value={formatNumber(data.approvals.pending, locale)}
          icon={<CheckBadgeIcon />}
          tone={data.approvals.pending > 0 ? 'accent' : 'success'}
          to="/admin/approvals"
          footnote={data.approvals.overdue > 0 ? copy.tiles.overdue(data.approvals.overdue) : copy.tiles.noneWaiting}
          footnoteTone={data.approvals.overdue > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <DashboardCard
        title={copy.health.checksTitle}
        icon={<HeartIcon />}
        tone={attention.length > 0 ? 'atrisk' : 'success'}
        subtitle={attention.length === 0 ? copy.health.allClear : copy.health.checksSubtitle(passing, data.health_checks.length)}
      >
        <HealthCheckList checks={data.health_checks} />
      </DashboardCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DashboardCard
          className="lg:col-span-7"
          title={copy.signIns.title}
          icon={<ArrowRightEndOnRectangleIcon />}
          tone="info"
          subtitle={copy.signIns.insight(
            data.sign_in_activity[data.sign_in_activity.length - 1]?.active_users ?? 0,
            data.sign_in_activity.reduce((sum, week) => sum + week.failed_attempts, 0),
          )}
          table={{
            caption: copy.signIns.title,
            columns: [
              { key: 'week', label: copy.signIns.week },
              { key: 'active', label: copy.signIns.active, numeric: true },
              { key: 'failed', label: copy.signIns.failed, numeric: true },
            ],
            rows: data.sign_in_activity.map((week) => ({ week: copy.signIns.weekOf(weekTick(week.week_start, locale)), active: week.active_users, failed: week.failed_attempts })),
          }}
        >
          <ChartLegend
            items={[
              { label: copy.signIns.active, color: CHART_COLORS.series1 },
              { label: copy.signIns.failed, color: CHART_COLORS.series2 },
            ]}
          />
          <div className="mt-3">
            <WeeklyActivityChart data={data.sign_in_activity} />
          </div>
        </DashboardCard>

        <DashboardCard className="lg:col-span-5" title={copy.recency.title} icon={<ClockIcon />} tone="info" subtitle={copy.recency.subtitle(active)}>
          <StackedBar
            height="h-4"
            legendColumns={2}
            segments={accounts.sign_in_recency.map((bucket, index) => ({
              key: bucket.key,
              label: copy.recency.keys[bucket.key],
              value: bucket.count,
              color: bucket.key === 'never' ? CHART_COLORS.none : ORDINAL_RAMP[4 - index],
              hatched: bucket.key === 'never',
            }))}
          />
          <p className="mt-5 border-t border-border pt-4 text-caption font-semibold uppercase tracking-wide text-text-secondary">{copy.recency.statusTitle}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            {(['active', 'activation_pending', 'locked', 'deactivated'] as const).map((status) => (
              <PlatformFigure
                key={status}
                label={t.admin.userStatus[status]}
                value={formatNumber(accounts.by_status[status], locale)}
                alert={status === 'locked' && accounts.by_status.locked > 0}
              />
            ))}
          </dl>
          {accounts.close_to_locking > 0 && <p className="mt-3 text-caption text-atrisk-soft-text">{copy.recency.closeToLocking(accounts.close_to_locking)}</p>}
        </DashboardCard>
      </div>

      <DashboardCard
        title={copy.departments.title}
        icon={<BuildingOffice2Icon />}
        tone="primary"
        subtitle={copy.departments.subtitle}
        action={<CardLink to="/admin/leadership">{copy.departments.manageLeadership}</CardLink>}
      >
        <div className={`grid grid-cols-1 gap-4 ${data.departments.length > 1 ? 'md:grid-cols-2 xl:grid-cols-3' : ''}`}>
          {data.departments.map((department) => (
            <DepartmentCard key={department.id} department={department} wide={data.departments.length === 1} />
          ))}
        </div>
      </DashboardCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCard title={copy.roles.title} icon={<UserGroupIcon />} tone="directive" subtitle={copy.roles.subtitle}>
          <RankedBars items={accounts.by_role.map((row) => ({ name: row.role, count: row.count }))} limit={6} barClassName="bg-chart-1" />
        </DashboardCard>
        <DashboardCard
          title={copy.approvals.title}
          icon={<CheckBadgeIcon />}
          tone="accent"
          subtitle={data.approvals.median_decision_hours === null ? copy.approvals.noHistory : copy.approvals.median(data.approvals.median_decision_hours)}
          action={<CardLink to="/admin/approvals">{t.dashboard.common.viewAll}</CardLink>}
        >
          {data.approvals.items.length > 0 ? (
            <ul className="-mx-2 divide-y divide-border">
              {data.approvals.items.map((item) => (
                <li key={item.id}>
                  <Link to={`/admin/approvals/${item.id}`} className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-page-bg">
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-text">
                      <CheckBadgeIcon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm font-semibold text-text-primary">
                        {t.admin.approvals.type[item.type as keyof typeof t.admin.approvals.type] ?? item.type}
                        {item.subject && ` · ${item.subject}`}
                      </span>
                      <span className="block text-caption text-text-secondary">
                        {[item.ministry_name, item.requested_by && copy.approvals.requestedBy(item.requested_by), formatRelativeTime(item.created_at, locale)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty icon={<CheckCircleIcon />} title={t.dashboard.common.emptyTitle} body={copy.approvals.empty} />
          )}
        </DashboardCard>

        <DashboardCard title={copy.activity.title} icon={<ListBulletIcon />} tone="neutral" subtitle={copy.activity.subtitle} action={<CardLink to="/admin/audit-log">{t.dashboard.common.viewAll}</CardLink>}>
          {data.recent_activity.length > 0 ? (
            <ol className="space-y-3">
              {data.recent_activity.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                  <span className="min-w-0">
                    <span className="block text-body-sm font-semibold text-text-primary">{describeAction(entry.action)}</span>
                    <span className="block text-caption text-text-secondary">
                      {copy.activity.by(entry.actor ?? copy.activity.system)} · {formatRelativeTime(entry.created_at, locale)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <PanelEmpty icon={<ListBulletIcon />} title={t.dashboard.common.emptyTitle} body={copy.activity.empty} />
          )}
        </DashboardCard>
      </div>

      {data.platform && (
        <DashboardCard title={copy.platform.title} icon={<ServerStackIcon />} tone="primary" subtitle={copy.platform.subtitle}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="flex items-center gap-2 text-body-sm font-semibold text-text-primary">
                <CircleStackIcon aria-hidden="true" className="size-4 text-text-secondary" />
                {copy.platform.storage}
              </p>
              <p className="mt-2 font-mono text-h2 font-semibold text-primary">{formatBytes(data.platform.storage.used_bytes, locale)}</p>
              <div className="mt-2">
                <Meter value={data.platform.storage.used_bytes} max={data.platform.storage.capacity_bytes} label={copy.platform.storage} />
              </div>
              <p className="mt-1.5 text-caption text-text-secondary">
                {copy.platform.storageOf(formatBytes(data.platform.storage.capacity_bytes, locale), formatNumber(data.platform.storage.files, locale))}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-2 text-body-sm font-semibold text-text-primary">
                <ServerStackIcon aria-hidden="true" className="size-4 text-text-secondary" />
                {copy.platform.queue}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <PlatformFigure label={copy.platform.pending} value={formatNumber(data.platform.queue.pending, locale)} />
                <PlatformFigure label={copy.platform.failed} value={formatNumber(data.platform.queue.failed, locale)} alert={data.platform.queue.failed > 0} />
              </dl>
            </div>
            <div>
              <p className="flex items-center gap-2 text-body-sm font-semibold text-text-primary">
                <ShieldCheckIcon aria-hidden="true" className="size-4 text-text-secondary" />
                {copy.platform.records}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                {(['alerts', 'inquiries', 'directives', 'periodic_reports'] as const).map((key) => (
                  <PlatformFigure key={key} label={copy.platform.recordTypes[key]} value={formatNumber(data.platform?.records[key] ?? 0, locale)} />
                ))}
              </dl>
            </div>
          </div>
        </DashboardCard>
      )}
    </>
  )
}

function PlatformFigure({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${alert ? 'bg-danger-soft' : 'bg-page-bg'}`}>
      <dt className={`text-caption ${alert ? 'text-danger-soft-text' : 'text-text-secondary'}`}>{label}</dt>
      <dd className="font-mono text-h3 font-semibold text-primary">{value}</dd>
    </div>
  )
}

function HealthCheckList({ checks }: { checks: HealthCheck[] }) {
  const { t } = useI18n()
  const copy = t.dashboard.admin.health
  const ordered = [...checks].sort((a, b) => ['fail', 'warn', 'pass'].indexOf(a.status) - ['fail', 'warn', 'pass'].indexOf(b.status))

  return (
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {ordered.map((check) => {
        const style = HEALTH_STYLE[check.status]
        const Icon = style.icon
        const detail = check.key === 'configuration_gaps'
          ? (check.detail ?? []).map((key) => t.dashboard.admin.departments.lists[key as keyof typeof t.dashboard.admin.departments.lists] ?? key).join(', ')
          : (check.detail ?? [])[0] ?? ''
        return (
          <li key={check.key} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
            <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" style={{ color: style.color }} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-body-sm font-semibold text-text-primary">{copy.checks[check.key].title}</span>
                <span className={`rounded-full px-2 py-0.5 text-caption font-semibold ${style.chip}`}>{copy.status[check.status]}</span>
              </span>
              <span className="mt-0.5 block text-caption text-text-secondary">{copy.checks[check.key].body(check.value, detail)}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function DepartmentCard({ department, wide = false }: { department: DepartmentHealth; wide?: boolean }) {
  const { t } = useI18n()
  const copy = t.dashboard.admin.departments
  const lists = Object.entries(department.configuration)
  const configured = lists.filter(([, count]) => count > 0).length
  const { filled, limit } = department.ministry_administrators
  const overLimit = filled > limit

  const seats = (
    <div className="flex flex-col gap-3">
      <SeatRow label={copy.ps}>
        {department.principal_secretary ? (
          <span className="inline-flex items-center gap-1.5 text-text-primary">
            <CheckCircleIcon aria-hidden="true" className="size-4 text-success" />
            {department.principal_secretary.full_name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-atrisk-soft-text">
            <ExclamationTriangleIcon aria-hidden="true" className="size-4" />
            {copy.vacant}
          </span>
        )}
      </SeatRow>

      <SeatRow label={copy.administrators}>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="flex gap-1">
            {Array.from({ length: Math.max(limit, filled) }, (_, index) => (
              <span
                key={index}
                className={`size-2.5 rounded-full ${index < filled ? (index >= limit ? 'bg-chart-below' : 'bg-primary') : 'border border-border-muted bg-white'}`}
              />
            ))}
          </span>
          <span className={overLimit ? 'font-semibold text-danger-soft-text' : 'text-text-primary'}>{overLimit ? copy.overLimit(filled, limit) : copy.seatsOf(filled, limit)}</span>
        </span>
      </SeatRow>

      <SeatRow label={copy.switches}>
        <span className="flex flex-wrap justify-end gap-1.5">
          <SwitchChip label={copy.actingPs} on={department.acting_ps !== null} title={department.acting_ps?.full_name} />
          <SwitchChip label={copy.designatedDeputy} on={department.designated_deputy_active} />
        </span>
      </SeatRow>

      <SeatRow label={copy.posts}>
        <span className={department.attache_posts.vacant > 0 ? 'text-atrisk-soft-text' : 'text-text-primary'}>
          {copy.postsFilled(department.attache_posts.total - department.attache_posts.vacant, department.attache_posts.total)}
        </span>
      </SeatRow>
    </div>
  )

  const configuration = (
    <div className={wide ? 'border-t border-border pt-3 md:border-t-0 md:pt-0' : ''}>
      <p className="flex items-center justify-between text-caption text-text-secondary">
        <span className={wide ? 'font-semibold uppercase tracking-wide' : ''}>{copy.configuration}</span>
        <span className="font-semibold text-text-primary">{copy.configured(configured, lists.length)}</span>
      </p>
      <div className="mt-1.5">
        <Meter value={configured} max={lists.length} colorClass={configured === lists.length ? 'bg-chart-on-track' : 'bg-chart-at-risk'} label={copy.configuration} />
      </div>
      {wide ? (
        <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {lists.map(([key, count]) => (
            <li key={key} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-body-sm ring-1 ring-border">
              <span className="flex min-w-0 items-center gap-2">
                {count > 0 ? (
                  <CheckCircleIcon aria-hidden="true" className="size-4 shrink-0 text-success" />
                ) : (
                  <ExclamationTriangleIcon aria-hidden="true" className="size-4 shrink-0" style={{ color: CHART_COLORS.atRisk }} />
                )}
                <span className="truncate text-text-primary">{copy.lists[key as keyof typeof copy.lists]}</span>
              </span>
              <span className={`shrink-0 font-mono text-caption font-semibold ${count > 0 ? 'text-text-secondary' : 'text-atrisk-soft-text'}`}>
                {count > 0 ? count : copy.notSetUp}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        configured < lists.length && (
          <p className="mt-1.5 text-caption text-text-secondary">
            {copy.missingLists(
              lists
                .filter(([, count]) => count === 0)
                .map(([key]) => copy.lists[key as keyof typeof copy.lists])
                .join(', '),
            )}
          </p>
        )
      )}
    </div>
  )

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-page-bg p-4">
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-h4 text-primary">{department.name}</h3>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-caption text-text-secondary ring-1 ring-border">{copy.accounts(department.active_accounts)}</span>
      </header>
      {wide ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
          {seats}
          {configuration}
        </div>
      ) : (
        <>
          {seats}
          {configuration}
        </>
      )}
    </article>
  )
}

function SeatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-body-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

function SwitchChip({ label, on, title }: { label: string; on: boolean; title?: string }) {
  const { t } = useI18n()
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${on ? 'bg-info-soft text-info-soft-text' : 'bg-white text-text-secondary ring-1 ring-border'}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${on ? 'bg-info' : 'bg-border-muted'}`} />
      {label}: {on ? t.dashboard.admin.departments.on : t.dashboard.admin.departments.off}
    </span>
  )
}
