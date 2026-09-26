import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAuditLogs, type AuditLogEntry } from '../../api/audit'
import { Table, type TableColumn } from '../../components/Table'
import { Input } from '../../components/Input'
import { Pagination, DEFAULT_PER_PAGE } from '../../components/Pagination'
import { useAuth, isSystemAdministrator } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'

/**
 * FR-AUDIT-005 / FR-AUDIT-006. A System Administrator sees every entry; a Ministry
 * Administrator sees only its own department's account and configuration entries —
 * GET /audit-logs applies that filter server-side (operational records are never
 * returned, BR-025). Read-only: audit entries are immutable (BR-005).
 */
export default function AuditLogPage() {
  const { t } = useI18n()
  const { role } = useAuth()

  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)

  const logsQuery = useQuery({
    queryKey: ['admin', 'audit-logs', { action, from, to, page, perPage }],
    queryFn: () =>
      listAuditLogs({ action: action || undefined, from: from || undefined, to: to || undefined, page, per_page: perPage }),
  })

  const columns: TableColumn<AuditLogEntry>[] = [
    { key: 'when', header: t.admin.audit.columnWhen, render: (row) => new Date(row.created_at).toLocaleString() },
    { key: 'actor', header: t.admin.audit.columnActor, render: (row) => row.user_full_name ?? t.admin.audit.systemActor },
    { key: 'action', header: t.admin.audit.columnAction, render: (row) => <code className="font-mono text-caption">{row.action}</code> },
    {
      key: 'entity',
      header: t.admin.audit.columnEntity,
      // "App\Models\MasterDataEntry" -> "MasterDataEntry"; the id is kept in Roboto Mono.
      render: (row) => (
        <span>
          {row.affected_entity_type.split('\\').pop()}
          {row.affected_entity_id && (
            <span className="ml-1 font-mono text-caption text-text-muted">{row.affected_entity_id.slice(0, 8)}</span>
          )}
        </span>
      ),
    },
  ]

  function resetPageAnd(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.admin.audit.title}</h1>
      <p className="mt-1 text-body text-text-secondary">
        {isSystemAdministrator(role?.name) ? t.admin.audit.subtitleAll : t.admin.audit.subtitleMinistry}
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Input label={t.admin.audit.actionFilterLabel} value={action} onChange={(event) => resetPageAnd(setAction)(event.target.value)} />
        <Input label={t.admin.audit.fromLabel} type="date" value={from} onChange={(event) => resetPageAnd(setFrom)(event.target.value)} />
        <Input label={t.admin.audit.toLabel} type="date" value={to} onChange={(event) => resetPageAnd(setTo)(event.target.value)} />
      </div>

      <div className="mt-6">
        {logsQuery.isLoading ? (
          <p className="text-body text-text-muted">{t.common.loading}</p>
        ) : (
          <Table columns={columns} data={logsQuery.data?.data ?? []} rowKey={(row) => row.id} emptyMessage={t.admin.audit.empty} />
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
