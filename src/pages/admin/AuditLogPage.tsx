import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { listAuditLogs, type AuditLogEntry } from '../../api/audit'
import { AuditChangeDiff } from '../../components/AuditChangeDiff'
import { Badge } from '../../components/Badge'
import { Input } from '../../components/Input'
import { Pagination, DEFAULT_PER_PAGE } from '../../components/Pagination'
import { useAuth, isSystemAdministrator } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { auditActionVariant, formatAuditAction, formatRecordType } from '../../lib/auditAction'

/**
 * FR-AUDIT-005 / FR-AUDIT-006. A System Administrator sees every entry; a Ministry
 * Administrator sees only its own department's account and configuration entries —
 * GET /audit-logs applies that filter server-side (operational records are never
 * returned, BR-025). Read-only: audit entries are immutable (BR-005).
 *
 * Each row expands in place to a before/after diff of exactly what changed
 * (App\Observers\ModelObserver writes `{before, after}` into `changes` for every
 * create/update/delete; AuditChangeDiff also renders the handful of manually
 * recorded actions that carry a different shape, e.g. a role change's
 * `{field: {from, to}}`, or nothing at all for a login attempt). This is a
 * one-off expand-in-place interaction the shared Table component doesn't
 * support, so the list is hand-built here rather than forced into Table.
 */
export default function AuditLogPage() {
  const { t } = useI18n()
  const { role } = useAuth()
  const copy = t.admin.audit

  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const logsQuery = useQuery({
    queryKey: ['admin', 'audit-logs', { action, from, to, page, perPage }],
    queryFn: () =>
      listAuditLogs({ action: action || undefined, from: from || undefined, to: to || undefined, page, per_page: perPage }),
  })

  function resetPageAnd(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setPage(1)
    }
  }

  const entries = logsQuery.data?.data ?? []

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{copy.title}</h1>
      <p className="mt-1 text-body text-text-secondary">
        {isSystemAdministrator(role?.name) ? copy.subtitleAll : copy.subtitleMinistry}
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Input label={copy.actionFilterLabel} value={action} onChange={(event) => resetPageAnd(setAction)(event.target.value)} />
        <Input label={copy.fromLabel} type="date" value={from} onChange={(event) => resetPageAnd(setFrom)(event.target.value)} />
        <Input label={copy.toLabel} type="date" value={to} onChange={(event) => resetPageAnd(setTo)(event.target.value)} />
      </div>

      <div className="mt-6">
        {logsQuery.isLoading ? (
          <p className="text-body text-text-muted">{t.common.loading}</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-body text-text-muted">{copy.empty}</p>
        ) : (
          <div className="overflow-hidden rounded border border-border">
            <table className="min-w-full divide-y divide-border text-body-sm">
              <thead className="bg-section-bg">
                <tr>
                  <th scope="col" className="w-10 px-2 py-2" aria-hidden="true" />
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnWhen}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnActor}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnAction}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnRecordType}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-text-secondary">
                    {copy.columnRecordId}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {entries.map((entry) => (
                  <AuditLogRow
                    key={entry.id}
                    entry={entry}
                    expanded={expandedId === entry.id}
                    onToggle={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
                    systemActorLabel={copy.systemActor}
                    expandLabel={copy.expandRow}
                    collapseLabel={copy.collapseRow}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {logsQuery.data?.meta && (
          <Pagination
            meta={logsQuery.data.meta}
            onPageChange={setPage}
            onPerPageChange={(value) => {
              setPerPage(value)
              setPage(1)
            }}
            className="mt-4"
          />
        )}
      </div>
    </div>
  )
}

function AuditLogRow({
  entry,
  expanded,
  onToggle,
  systemActorLabel,
  expandLabel,
  collapseLabel,
}: {
  entry: AuditLogEntry
  expanded: boolean
  onToggle: () => void
  systemActorLabel: string
  expandLabel: string
  collapseLabel: string
}) {
  const detailId = `audit-log-detail-${entry.id}`

  return (
    <>
      <tr className="tw-table-row cursor-pointer hover:bg-section-bg" onClick={onToggle}>
        <td className="px-2 py-2 text-center">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={expanded ? collapseLabel : expandLabel}
            className="rounded p-0.5 text-text-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {expanded ? <ChevronDownIcon aria-hidden="true" className="size-4" /> : <ChevronRightIcon aria-hidden="true" className="size-4" />}
          </button>
        </td>
        <td className="px-4 py-2 text-text-primary">{new Date(entry.created_at).toLocaleString()}</td>
        <td className="px-4 py-2 text-text-primary">
          {entry.user_full_name ? (
            <div>
              <p className="font-semibold">{entry.user_full_name}</p>
              {entry.user_email && <p className="text-caption text-text-muted">{entry.user_email}</p>}
            </div>
          ) : (
            <span className="italic text-text-muted">{systemActorLabel}</span>
          )}
        </td>
        <td className="px-4 py-2">
          <Badge variant={auditActionVariant(entry.action)} label={formatAuditAction(entry.action)} />
        </td>
        <td className="px-4 py-2 text-text-primary">{formatRecordType(entry.affected_entity_type)}</td>
        <td className="px-4 py-2 font-bold text-primary">
          {entry.affected_entity_id ? <span className="font-mono text-caption">{entry.affected_entity_id.slice(0, 8)}</span> : '—'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td />
          <td id={detailId} colSpan={5} className="px-4 py-3">
            <AuditChangeDiff changes={entry.changes} ipAddress={entry.ip_address} />
          </td>
        </tr>
      )}
    </>
  )
}
