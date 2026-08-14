import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listDirectives, type Directive, type DirectiveStatus } from '../../api/directives'
import { listMissions } from '../../api/missions'
import { useAuth, isReadOnlyRole } from '../../hooks/useAuth'
import { Table, type TableColumn } from '../../components/Table'
import { Button } from '../../components/Button'
import { DirectiveStatusBadge, DirectiveStaleBadge } from './DirectiveStatusBadge'
import en from '../../i18n/en'

const STATUS_OPTIONS: DirectiveStatus[] = ['issued', 'acknowledged', 'in_progress', 'completed', 'cancelled']

/** FR-DIR-010: 14-day stale threshold (App\Services\DirectiveService::STALE_THRESHOLD_DAYS). */
const STALE_THRESHOLD_DAYS = 14

function isStale(row: Directive): boolean {
  if (row.status !== 'in_progress' || !row.last_progress_update_at) {
    return false
  }
  const staleBefore = Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  return new Date(row.last_progress_update_at).getTime() < staleBefore
}

/** Mirrors App\Services\DirectiveService::isOverdue(): a set target_completion_date in the
 * past, on a directive that hasn't reached a terminal status. GET /directives has no
 * server-side overdue filter (only status/mission_id/date_from/date_to), so this is computed
 * client-side over the fetched page, the same way the stale indicator is. */
function isOverdue(row: Directive): boolean {
  if (!row.target_completion_date) {
    return false
  }
  return new Date(row.target_completion_date).getTime() < Date.now() && !['completed', 'cancelled', 'closed'].includes(row.status)
}

/** FR-DIR-005, FR-DIR-009. DirectiveController::index() already scopes rows server-side per
 * role (Ministry Attache: own as target; Ministry HQ Officer: own issued; PS/HQ Director/
 * Acting PS/System Administrator: all) — this page renders whatever the server returns. */
export default function DirectiveListPage() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const readOnly = isReadOnlyRole(role?.name)
  const canIssue = !readOnly && (role?.name === 'Ministry HQ Officer' || role?.name === 'Ministry PS')

  const [status, setStatus] = useState<DirectiveStatus | ''>('')
  const [missionId, setMissionId] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const missionsQuery = useQuery({ queryKey: ['missions'], queryFn: listMissions })

  const listQuery = useQuery({
    queryKey: ['directives', { status, missionId }],
    queryFn: () => listDirectives({ status: status || undefined, mission_id: missionId || undefined }),
  })

  const directives = (listQuery.data?.data ?? []).filter((row) => !overdueOnly || isOverdue(row))

  function goToDirective(id: string) {
    navigate(`/directives/${id}`)
  }

  const columns: TableColumn<Directive>[] = [
    {
      key: 'reference',
      header: en.directives.list.columnReference,
      // No reference_number column exists on directives (CLAUDE.md Section 6), unlike
      // alerts/inquiries — the id's leading segment stands in as a stable, distinguishing label.
      render: (row) => <span className="font-mono">{row.id.slice(0, 8).toUpperCase()}</span>,
    },
    { key: 'mission', header: en.directives.list.columnMission, render: (row) => row.mission?.name ?? '—' },
    {
      key: 'target_user',
      header: en.directives.list.columnTargetAttache,
      render: (row) => row.target_user?.full_name ?? '—',
    },
    {
      key: 'status',
      header: en.directives.list.columnStatus,
      render: (row) => <DirectiveStatusBadge status={row.status} />,
    },
    {
      key: 'target_completion_date',
      header: en.directives.list.columnDueDate,
      render: (row) => (row.target_completion_date ? new Date(row.target_completion_date).toLocaleDateString() : '—'),
    },
    {
      key: 'stale',
      header: en.directives.list.columnStale,
      render: (row) => (isStale(row) ? <DirectiveStaleBadge /> : <span className="text-text-muted">—</span>),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 text-primary">{en.directives.list.title}</h1>
        {canIssue && (
          <Link to="/directives/new">
            <Button variant="primary">{en.directives.list.newDirectiveButton}</Button>
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.directives.list.filterStatus}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as DirectiveStatus | '')}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">{en.directives.list.allStatuses}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {en.directives.status[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.directives.list.filterMission}</span>
          <select
            value={missionId}
            onChange={(event) => setMissionId(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">{en.directives.list.allMissions}</option>
            {(missionsQuery.data ?? []).map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(event) => setOverdueOnly(event.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
          />
          <span className="text-body-sm text-text-secondary">{en.directives.list.filterOverdue}</span>
        </label>
      </div>

      <div className="mt-6">
        <Table
          columns={columns}
          data={directives}
          rowKey={(row) => row.id}
          emptyMessage={en.directives.list.empty}
          onRowClick={(row) => goToDirective(row.id)}
        />
      </div>
    </div>
  )
}
