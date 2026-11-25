import { Link } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentTextIcon,
  MinusCircleIcon,
  PencilSquareIcon,
} from '@heroicons/react/20/solid'
import type { KpiComplianceQuarter, KpiComplianceStatus, KpiMissionHealth } from '../../api/kpi'
import { DashboardCard } from '../../components/dashboard/DashboardCard'
import { ScrollRegion } from '../../components/ScrollRegion'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { periodRange } from '../../lib/dashboardFormat'
import { formatDay } from './kpiPresentation'

const COMPLIANCE_TONE: Record<KpiComplianceStatus, string> = {
  submitted_on_time: 'bg-success-soft text-success-soft-text',
  submitted_late: 'bg-atrisk-soft text-atrisk-soft-text',
  draft_in_progress: 'bg-info-soft text-info-soft-text',
  not_started: 'bg-section-bg text-text-secondary',
  not_due: 'bg-white text-text-muted',
}

/** Every status pairs its colour with an icon and a word (CLAUDE.md Section 4 Rule 9). */
const COMPLIANCE_ICON: Record<KpiComplianceStatus, ComponentType<SVGProps<SVGSVGElement>>> = {
  submitted_on_time: CheckCircleIcon,
  submitted_late: ClockIcon,
  draft_in_progress: PencilSquareIcon,
  not_started: MinusCircleIcon,
  not_due: CalendarIcon,
}

const DUE_STATUSES: Exclude<KpiComplianceStatus, 'not_due'>[] = ['submitted_on_time', 'submitted_late', 'draft_in_progress', 'not_started']

/** The roles that may open the full compliance board (ReportPolicy::viewCompliance). */
const COMPLIANCE_BOARD_ROLES = ['Ministry PS', 'Acting PS', 'Ministry HQ Director']

/** FR-KPI-012: one mission's report status per quarter of the period. */
export function ComplianceStrip({ quarters }: { quarters: KpiComplianceQuarter[] }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.dashboard.compliance

  return (
    <DashboardCard title={copy.title} subtitle={copy.subtitle} icon={<ClipboardDocumentCheckIcon />} tone="success">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quarters.map((quarter) => {
          const Icon = COMPLIANCE_ICON[quarter.status]
          return (
            <li key={quarter.label} className={`rounded-lg p-3 ring-1 ring-border ${COMPLIANCE_TONE[quarter.status]}`} data-testid={`kpi-compliance-${quarter.label.replace(' ', '-')}`}>
              <p className="text-body-sm font-semibold">
                {quarter.label} <span className="font-normal">· {periodRange(quarter, locale)}</span>
              </p>
              <p className="mt-1 flex items-center gap-1 text-caption font-semibold">
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                {copy.status[quarter.status]}
              </p>
              <p className="mt-0.5 text-caption">
                {quarter.submitted_at ? copy.submittedOn(formatDay(quarter.submitted_at, locale)) : copy.dueOn(formatDay(quarter.deadline, locale))}
                {quarter.is_overdue && !quarter.submitted_at && <span className="ml-1 font-semibold text-danger-soft-text">· {copy.overdue}</span>}
              </p>
              {quarter.report_id && (
                <Link to={`/reports/${quarter.report_id}`} className="mt-2 inline-flex items-center gap-1 text-caption font-semibold text-info-soft-text hover:underline">
                  <DocumentTextIcon aria-hidden="true" className="size-3.5" />
                  {copy.open}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </DashboardCard>
  )
}

/**
 * FR-KPI-012 (ISS-019): every mission's report status per quarter of the period, for the
 * department view. Totals count every quarter that is due or already has a report (an early
 * submission counts before its deadline). A submitted report opens from its cell
 * for anyone who may read it (the API sends no link to HRM&D).
 */
export function ComplianceBoard({ missions }: { missions: KpiMissionHealth[] }) {
  const { t } = useI18n()
  const { role } = useAuth()
  const copy = t.kpi.dashboard.compliance
  const rows = [...missions].sort((first, second) => first.mission_name.localeCompare(second.mission_name))
  const quarters = rows[0]?.compliance ?? []
  const totals = Object.fromEntries(DUE_STATUSES.map((status) => [status, 0])) as Record<(typeof DUE_STATUSES)[number], number>
  rows.forEach((mission) =>
    mission.compliance.forEach((quarter) => {
      if (quarter.status !== 'not_due') {
        totals[quarter.status] += 1
      }
    }),
  )
  const anyDue = DUE_STATUSES.some((status) => totals[status] > 0)

  return (
    <DashboardCard title={copy.title} subtitle={copy.boardSubtitle} icon={<ClipboardDocumentCheckIcon />} tone="success">
      {anyDue ? (
        <p className="flex flex-wrap items-center gap-2" data-testid="kpi-compliance-totals">
          <span className="text-caption font-semibold text-text-secondary">{copy.totalsLabel}</span>
          {DUE_STATUSES.map((status) => (
            <StatusPill key={status} status={status} label={copy.totals[status](totals[status])} />
          ))}
        </p>
      ) : (
        <p className="text-body-sm text-text-secondary">{copy.noneDue}</p>
      )}

      <ScrollRegion label={copy.title} className="relative mt-3">
        <table aria-label={copy.title} className="min-w-full text-body-sm">
          <thead>
            <tr className="border-b border-border text-left text-caption font-semibold text-text-secondary">
              <th scope="col" className="py-2 pr-4 font-semibold">
                {copy.missionColumn}
              </th>
              {quarters.map((quarter) => (
                <th key={quarter.label} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                  {quarter.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((mission) => (
              <tr key={mission.mission_id}>
                <th scope="row" className="whitespace-nowrap py-2 pr-4 text-left font-semibold text-text-primary">
                  {mission.mission_name}
                </th>
                {mission.compliance.map((quarter) => (
                  <td key={quarter.label} className="px-3 py-2">
                    <ComplianceCell quarter={quarter} missionName={mission.mission_name} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>

      {COMPLIANCE_BOARD_ROLES.includes(role?.name ?? '') && (
        <Link to="/reports/compliance" className="mt-3 inline-flex items-center gap-1 text-body-sm font-semibold text-info-soft-text hover:underline">
          {copy.openBoard}
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      )}
    </DashboardCard>
  )
}

function ComplianceCell({ quarter, missionName }: { quarter: KpiComplianceQuarter; missionName: string }) {
  const { t } = useI18n()
  const copy = t.kpi.dashboard.compliance
  const label = copy.statusShort[quarter.status]
  const pill = <StatusPill status={quarter.status} label={label} />

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {quarter.report_id ? (
        <Link to={`/reports/${quarter.report_id}`} aria-label={copy.openReportLabel(quarter.label, missionName, label)} className="rounded-full hover:underline">
          {pill}
        </Link>
      ) : (
        pill
      )}
      {quarter.is_overdue && !quarter.submitted_at && <span className="text-caption font-semibold text-danger-soft-text">{copy.overdueShort}</span>}
    </span>
  )
}

function StatusPill({ status, label }: { status: KpiComplianceStatus; label: string }) {
  const Icon = COMPLIANCE_ICON[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ring-1 ring-border ${COMPLIANCE_TONE[status]}`}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
