import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  MinusCircleIcon,
  QueueListIcon,
  UserGroupIcon,
} from '@heroicons/react/20/solid'
import type { DirectiveActivityEntry, DirectiveIssuerBoardRow, DirectiveMissionBoardRow, DirectiveMissionHealth } from '../../../api/sdt'
import { Badge, type BadgeVariant } from '../../../components/Badge'
import { DashboardCard, PanelEmpty } from '../../../components/dashboard/DashboardCard'
import { Meter } from '../../../components/dashboard/visuals'
import { DirectiveStatusBadge } from '../../directives/DirectiveStatusBadge'
import { useI18n } from '../../../i18n/context'
import { formatRelativeTime, initials, localeFor } from '../../../lib/formatters'
import { formatNumber } from '../../../lib/dashboardFormat'
import { directiveListLink } from './overviewState'

const HEALTH_STYLE: Record<DirectiveMissionHealth, { variant: BadgeVariant; icon: ReactNode }> = {
  attention: { variant: 'danger', icon: <ExclamationTriangleIcon aria-hidden="true" className="size-3.5" /> },
  watch: { variant: 'atrisk', icon: <ClockIcon aria-hidden="true" className="size-3.5" /> },
  on_track: { variant: 'success', icon: <CheckCircleIcon aria-hidden="true" className="size-3.5" /> },
  idle: { variant: 'neutral', icon: <MinusCircleIcon aria-hidden="true" className="size-3.5" /> },
}

/** Rule 9: the mission's health as colour, icon and text together. */
function HealthBadge({ health }: { health: DirectiveMissionHealth }) {
  const { t } = useI18n()
  const style = HEALTH_STYLE[health]
  return <Badge variant={style.variant} icon={style.icon} label={t.sdt.directiveOverview.missions.health[health]} />
}

/** A count that opens the matching directive list, or a quiet zero. */
function CountLink({ value, to, label, tone }: { value: number; to: string; label: string; tone: 'danger' | 'atrisk' | 'directive' | 'neutral' }) {
  const { language } = useI18n()
  const locale = localeFor(language)
  if (value === 0) {
    return <span className="font-mono text-text-muted">0</span>
  }
  const toneClass = {
    danger: 'text-danger-soft-text',
    atrisk: 'text-atrisk-soft-text',
    directive: 'text-directive-soft-text',
    neutral: 'text-text-primary',
  }[tone]
  return (
    <Link to={to} aria-label={label} className={`font-mono font-semibold hover:underline ${toneClass}`}>
      {formatNumber(value, locale)}
    </Link>
  )
}

const HEAD = 'px-3 py-2 text-left font-semibold text-text-secondary'
const HEAD_NUMBER = 'px-3 py-2 text-right font-semibold text-text-secondary'

/**
 * FR-SDT-008/009 and FR-DIR-012: every mission posted to the department, worst first, with
 * its open, overdue, stale and awaiting-closure directives and its completion rate. Each
 * number opens the directive list with that filter.
 */
export function MissionBoard({ rows, issuerId, className = '' }: { rows: DirectiveMissionBoardRow[]; issuerId?: string; className?: string }) {
  const { t, language } = useI18n()
  const copy = t.sdt.directiveOverview.missions
  const locale = localeFor(language)

  return (
    <DashboardCard title={copy.title} icon={<GlobeAltIcon />} tone="info" subtitle={copy.subtitle} className={className}>
      {rows.length === 0 ? (
        <PanelEmpty icon={<GlobeAltIcon />} title={copy.emptyTitle} body={copy.emptyBody} />
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-border" data-testid="directive-mission-board">
          <table className="w-full min-w-[44rem] text-body-sm">
            <caption className="sr-only">{copy.caption}</caption>
            <thead className="bg-section-bg">
              <tr>
                <th scope="col" className={HEAD}>
                  {copy.columnMission}
                </th>
                <th scope="col" className={HEAD}>
                  {copy.columnHealth}
                </th>
                <th scope="col" className={HEAD_NUMBER}>
                  {copy.columnOpen}
                </th>
                <th scope="col" className={HEAD_NUMBER}>
                  {copy.columnOverdue}
                </th>
                <th scope="col" className={HEAD_NUMBER}>
                  {copy.columnStale}
                </th>
                <th scope="col" className={HEAD_NUMBER}>
                  {copy.columnAwaitingClosure}
                </th>
                <th scope="col" className={`${HEAD} min-w-36`}>
                  {copy.columnCompletion}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const base = { missionId: row.mission_id, issuerId }
                return (
                  <tr key={row.mission_id} className="bg-white" data-testid={`overview-mission-${row.mission_id}`}>
                    <th scope="row" className="px-3 py-2.5 text-left align-top font-medium">
                      <Link to={directiveListLink(base)} className="text-primary hover:underline">
                        {row.mission_name}
                      </Link>
                      <span className="block text-caption font-normal text-text-secondary">
                        {[row.host_country, row.attache?.full_name ?? copy.noAttache].filter(Boolean).join(' · ')}
                        {!row.active && ` · ${copy.inactive}`}
                      </span>
                      <span className="block text-caption font-normal text-text-muted">
                        {row.last_progress_at ? copy.lastProgress(formatRelativeTime(row.last_progress_at, locale)) : copy.noProgress}
                      </span>
                    </th>
                    <td className="px-3 py-2.5 align-top">
                      <HealthBadge health={row.health} />
                    </td>
                    <td className="px-3 py-2.5 text-right align-top font-mono text-text-primary">{formatNumber(row.open, locale)}</td>
                    <td className="px-3 py-2.5 text-right align-top">
                      <CountLink value={row.overdue} tone="danger" to={directiveListLink(base, { due: 'overdue' })} label={copy.viewOverdue(row.mission_name, row.overdue)} />
                    </td>
                    <td className="px-3 py-2.5 text-right align-top">
                      <CountLink value={row.stale} tone="atrisk" to={directiveListLink(base, { stale: '1' })} label={copy.viewStale(row.mission_name, row.stale)} />
                    </td>
                    <td className="px-3 py-2.5 text-right align-top">
                      <CountLink
                        value={row.awaiting_closure}
                        tone="directive"
                        to={directiveListLink(base, { status: 'completed' })}
                        label={copy.viewAwaitingClosure(row.mission_name, row.awaiting_closure)}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {row.total === 0 ? (
                        <span className="text-caption text-text-muted">{copy.noDirectives}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Meter value={row.completion_rate} max={100} colorClass="bg-success" label={copy.completionLabel(row.mission_name)} />
                          <span className="w-12 shrink-0 text-right font-mono text-caption text-text-primary">{formatNumber(row.completion_rate, locale, 1)}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  )
}

/**
 * Who has directives waiting on them: per issuing officer, what is open, overdue, stale, or
 * completed and waiting for them to accept and close it (the URD lifecycle's review step).
 */
export function IssuerBoard({ rows, viewerId, missionId, className = '' }: { rows: DirectiveIssuerBoardRow[]; viewerId?: string; missionId?: string; className?: string }) {
  const { t } = useI18n()
  const copy = t.sdt.directiveOverview.issuers

  return (
    <DashboardCard title={copy.title} icon={<UserGroupIcon />} tone="directive" subtitle={copy.subtitle} className={className}>
      {rows.length === 0 ? (
        <PanelEmpty icon={<UserGroupIcon />} title={copy.emptyTitle} body={copy.emptyBody} />
      ) : (
        <ul className="divide-y divide-border" data-testid="directive-issuer-board">
          {rows.map((row) => {
            const name = row.full_name ?? copy.unknown
            const base = { missionId, issuerId: row.user_id }
            return (
              <li key={row.user_id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`overview-issuer-${row.user_id}`}>
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-directive-soft text-caption font-bold text-directive-soft-text">
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={directiveListLink(base)} className="font-semibold text-primary hover:underline">
                    {name}
                  </Link>
                  {row.user_id === viewerId && <span className="ml-1.5 rounded-full bg-section-bg px-2 text-caption text-text-secondary">{copy.you}</span>}
                  <p className="text-caption text-text-secondary">{copy.summary(row.total, row.open)}</p>
                </div>
                <dl className="flex gap-4 text-right text-caption">
                  <div>
                    <dt className="text-text-muted">{copy.awaitingClosure}</dt>
                    <dd>
                      <CountLink value={row.awaiting_closure} tone="directive" to={directiveListLink(base, { status: 'completed' })} label={copy.viewAwaitingClosure(name, row.awaiting_closure)} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">{copy.overdue}</dt>
                    <dd>
                      <CountLink value={row.overdue} tone="danger" to={directiveListLink(base, { due: 'overdue' })} label={copy.viewOverdue(name, row.overdue)} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">{copy.stale}</dt>
                    <dd>
                      <CountLink value={row.stale} tone="atrisk" to={directiveListLink(base, { stale: '1' })} label={copy.viewStale(name, row.stale)} />
                    </dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </DashboardCard>
  )
}

/** The department's latest directive workflow steps (from the audit trail), newest first. */
export function RecentActivity({ entries, className = '' }: { entries: DirectiveActivityEntry[]; className?: string }) {
  const { t, language } = useI18n()
  const copy = t.sdt.directiveOverview.activity
  const locale = localeFor(language)

  return (
    <DashboardCard title={copy.title} icon={<QueueListIcon />} tone="neutral" subtitle={copy.subtitle} className={className}>
      {entries.length === 0 ? (
        <PanelEmpty icon={<QueueListIcon />} title={copy.emptyTitle} body={copy.emptyBody} />
      ) : (
        <ol className="space-y-0" data-testid="directive-recent-activity">
          {entries.map((entry, index) => (
            <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < entries.length - 1 && <span aria-hidden="true" className="absolute left-[0.6875rem] top-6 h-[calc(100%-1rem)] w-px bg-border" />}
              <span aria-hidden="true" className="relative mt-1 size-[1.375rem] shrink-0 rounded-full border-4 border-white bg-directive shadow-sm ring-1 ring-border" />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm text-text-primary">
                  {entry.status === 'issued' ? copy.issued(entry.by?.full_name ?? copy.someone) : copy.moved(entry.by?.full_name ?? copy.someone)}{' '}
                  <DirectiveStatusBadge status={entry.status} />
                </p>
                <Link to={`/directives/${entry.directive_id}`} className="mt-0.5 line-clamp-2 text-body-sm font-medium text-primary hover:underline">
                  {entry.description}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-text-secondary">
                  {entry.mission && <span>{entry.mission.name}</span>}
                  <time dateTime={entry.at}>{formatRelativeTime(entry.at, locale)}</time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  )
}
