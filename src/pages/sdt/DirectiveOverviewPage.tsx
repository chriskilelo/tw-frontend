import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDirectiveOverview } from '../../api/sdt'
import type { Directive } from '../../api/directives'
import { Table, type TableColumn } from '../../components/Table'
import { DirectiveStatusBadge } from '../directives/DirectiveStatusBadge'
import en from '../../i18n/en'

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
  const navigate = useNavigate()

  const overviewQuery = useQuery({ queryKey: ['sdt', 'directives', 'overview'], queryFn: getDirectiveOverview })
  const overview = overviewQuery.data

  const columns: TableColumn<Directive>[] = [
    { key: 'mission', header: en.sdt.directiveOverview.columnMission, render: (row) => row.mission?.name ?? '—' },
    {
      key: 'target_user',
      header: en.sdt.directiveOverview.columnTargetAttache,
      render: (row) => row.target_user?.full_name ?? '—',
    },
    { key: 'status', header: en.sdt.directiveOverview.columnStatus, render: (row) => <DirectiveStatusBadge status={row.status} /> },
    {
      key: 'target_completion_date',
      header: en.sdt.directiveOverview.columnDueDate,
      render: (row) => (row.target_completion_date ? new Date(row.target_completion_date).toLocaleDateString() : '—'),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.sdt.directiveOverview.title}</h1>

      {overview && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile variant="info" label={en.sdt.directiveOverview.tileIssued} value={overview.summary.issued} />
          <SummaryTile variant="accent" label={en.sdt.directiveOverview.tileInProgress} value={overview.summary.in_progress} />
          <SummaryTile variant="atrisk" label={en.sdt.directiveOverview.tileOverdue} value={overview.summary.overdue} />
          <SummaryTile variant="success" label={en.sdt.directiveOverview.tileCompleted} value={overview.summary.completed} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-h2 text-primary">{en.sdt.directiveOverview.recentTitle}</h2>
        <div className="mt-3">
          <Table
            columns={columns}
            data={overview?.recent_directives ?? []}
            rowKey={(row) => row.id}
            emptyMessage={en.sdt.directiveOverview.recentEmpty}
            onRowClick={(row) => navigate(`/directives/${row.id}`)}
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-h2 text-primary">{en.sdt.directiveOverview.staleTitle}</h2>
        <div className="mt-3">
          <Table
            columns={columns}
            data={overview?.stale_directives ?? []}
            rowKey={(row) => row.id}
            emptyMessage={en.sdt.directiveOverview.staleEmpty}
            onRowClick={(row) => navigate(`/directives/${row.id}`)}
            getRowClassName={() => 'bg-atrisk-soft'}
          />
        </div>
      </div>
    </div>
  )
}
