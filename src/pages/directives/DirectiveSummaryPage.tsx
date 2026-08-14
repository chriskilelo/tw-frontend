import { useQuery } from '@tanstack/react-query'
import { getDirectiveSummary } from '../../api/directives'
import en from '../../i18n/en'

type TileVariant = 'success' | 'accent' | 'atrisk' | 'danger'

const TILE_VARIANT_CLASSES: Record<TileVariant, string> = {
  success: 'border-success bg-success-soft text-success-soft-text',
  accent: 'border-accent bg-accent-soft text-accent-soft-text',
  atrisk: 'border-atrisk bg-atrisk-soft text-atrisk-soft-text',
  danger: 'border-danger bg-danger-soft text-danger-soft-text',
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
 * FR-DIR-012. Ministry HQ Director / Ministry PS only — enforced server-side by
 * DirectivePolicy::viewSummary() (deliberately not extended to Acting PS, unlike most other
 * abilities on this engine — see AppLayout.tsx's ROLE_NAV_KEYS note). This page renders
 * whatever GET /directives/summary returns rather than re-checking the role client-side,
 * mirroring ComplianceDashboardPage's established precedent.
 */
export default function DirectiveSummaryPage() {
  const summaryQuery = useQuery({ queryKey: ['directives', 'summary'], queryFn: getDirectiveSummary })
  const summary = summaryQuery.data

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.directives.summary.title}</h1>

      {summary && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile variant="success" label={en.directives.summary.tileCompleted} value={summary.completed} />
          <SummaryTile variant="accent" label={en.directives.summary.tileInProgress} value={summary.in_progress} />
          <SummaryTile variant="atrisk" label={en.directives.summary.tileOverdue} value={summary.overdue} />
          <SummaryTile variant="danger" label={en.directives.summary.tileCancelled} value={summary.cancelled} />
        </div>
      )}
    </div>
  )
}
