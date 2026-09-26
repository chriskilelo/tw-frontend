import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDirectiveOverview } from '../../api/sdt'
import type { Directive } from '../../api/directives'
import { Table, type TableColumn } from '../../components/Table'
import { Pagination } from '../../components/Pagination'
import { useClientPagination } from '../../hooks/useClientPagination'
import { DirectiveStatusBadge } from '../directives/DirectiveStatusBadge'
import { useI18n } from '../../i18n/context'

type TileVariant = 'info' | 'accent' | 'atrisk' | 'success'

const TILE_VARIANT_CLASSES: Record<TileVariant, string> = {
  info: 'border-info bg-info-soft text-info-soft-text',
  accent: 'border-accent bg-accent-soft text-accent-soft-text',
  atrisk: 'border-atrisk bg-atrisk-soft text-atrisk-soft-text',
  success: 'border-success bg-success-soft text-success-soft-text',
}

function SummaryTile({ variant, label, value }: { variant: TileVariant; label: string; value: number }) {
  return (
    <div className={`rounded-lg border p-4 ${TILE_VARIANT_CLASSES[variant]}`}>
      <p className="text-h2 font-bold">{value}</p>
      <p className="text-body-sm font-semibold">{label}</p>
    </div>
  )
}

/**
 * FR-SDT-008: PS-level directive overview — App\Http\Controllers\Api\Sdt\DirectivesController::overview(),
 * gated server-side by MinistryPolicy::viewPsDashboard() (Ministry PS and Acting PS only).
 * The summary tiles reflect App\Services\DirectiveService::getSummary(), which is all-time
 * and ministry-wide, not scoped to "this quarter" — the backend has no quarter-scoped
 * variant to call instead (see api/sdt.ts's DirectiveOverview note).
 */
export default function DirectiveOverviewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const overviewQuery = useQuery({ queryKey: ['sdt', 'directives', 'overview'], queryFn: getDirectiveOverview })
  const overview = overviewQuery.data
  const recentPage = useClientPagination(overview?.recent_directives ?? [])
  const stalePage = useClientPagination(overview?.stale_directives ?? [])

  const columns: TableColumn<Directive>[] = [
    { key: 'mission', header: t.sdt.directiveOverview.columnMission, render: (row) => row.mission?.name ?? '—' },
    {
      key: 'target_user',
      header: t.sdt.directiveOverview.columnTargetAttache,
      render: (row) => row.target_user?.full_name ?? '—',
    },
    { key: 'status', header: t.sdt.directiveOverview.columnStatus, render: (row) => <DirectiveStatusBadge status={row.status} /> },
    {
      key: 'target_completion_date',
      header: t.sdt.directiveOverview.columnDueDate,
      render: (row) => (row.target_completion_date ? new Date(row.target_completion_date).toLocaleDateString() : '—'),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.sdt.directiveOverview.title}</h1>

      {overview && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile variant="info" label={t.sdt.directiveOverview.tileIssued} value={overview.summary.issued} />
          <SummaryTile variant="accent" label={t.sdt.directiveOverview.tileInProgress} value={overview.summary.in_progress} />
          <SummaryTile variant="atrisk" label={t.sdt.directiveOverview.tileOverdue} value={overview.summary.overdue} />
          <SummaryTile variant="success" label={t.sdt.directiveOverview.tileCompleted} value={overview.summary.completed} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-h2 text-primary">{t.sdt.directiveOverview.recentTitle}</h2>
        <div className="mt-3">
          <Table
            columns={columns}
            data={recentPage.pageItems}
            rowKey={(row) => row.id}
            emptyMessage={t.sdt.directiveOverview.recentEmpty}
            onRowClick={(row) => navigate(`/directives/${row.id}`)}
          />
          <Pagination meta={recentPage.meta} onPageChange={recentPage.setPage} onPerPageChange={recentPage.setPerPage} className="mt-4" />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-h2 text-primary">{t.sdt.directiveOverview.staleTitle}</h2>
        <div className="mt-3">
          <Table
            columns={columns}
            data={stalePage.pageItems}
            rowKey={(row) => row.id}
            emptyMessage={t.sdt.directiveOverview.staleEmpty}
            onRowClick={(row) => navigate(`/directives/${row.id}`)}
            getRowClassName={() => 'bg-atrisk-soft'}
          />
          <Pagination meta={stalePage.meta} onPageChange={stalePage.setPage} onPerPageChange={stalePage.setPerPage} className="mt-4" />
        </div>
      </div>
    </div>
  )
}
