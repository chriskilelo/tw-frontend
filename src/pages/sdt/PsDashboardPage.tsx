import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listAlerts, type Alert } from '../../api/alerts'
import { activateActingPs, deactivateActingPs, getPsDashboard } from '../../api/sdt'
import { useAuth } from '../../hooks/useAuth'
import { Table, type TableColumn } from '../../components/Table'
import { AlertStatusBadge } from '../alerts/AlertStatusBadge'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import en from '../../i18n/en'

/**
 * FR-SDT-001: SdtService::psDashboard() only returns unacknowledged_alerts_count, not
 * the alerts themselves. The unacknowledged-alerts panel (which needs real per-alert
 * links, per the task) is built from two ministry-scoped GET /alerts calls — status=new
 * and status=assigned — merged client-side, since AlertController::index has no
 * "status != acknowledged" filter.
 *
 * The Acting PS activate/deactivate section (FR-SDT-004/006, MinistryPolicy::manageActingPs
 * — Ministry PS or System Administrator only) is gated on role here too: the route itself
 * has no per-role guard (only ProtectedRoute checks authentication, CLAUDE.md Section 10),
 * so without this check any authenticated user landing on this page — e.g. a read-only
 * BR-020 role — would see live activation controls even though the underlying API call
 * would 403. UI-006: this hides the panel, it does not substitute for the backend check.
 */
export default function PsDashboardPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { role } = useAuth()
  const canManageActingPs = role?.name === 'Ministry PS' || role?.name === 'System Administrator'
  const [actingPsUserId, setActingPsUserId] = useState('')

  const dashboardQuery = useQuery({ queryKey: ['sdt', 'dashboard'], queryFn: getPsDashboard })

  const newAlertsQuery = useQuery({
    queryKey: ['alerts', { status: 'new' }],
    queryFn: () => listAlerts({ status: 'new' }),
  })
  const assignedAlertsQuery = useQuery({
    queryKey: ['alerts', { status: 'assigned' }],
    queryFn: () => listAlerts({ status: 'assigned' }),
  })

  const unacknowledgedAlerts = [...(newAlertsQuery.data?.data ?? []), ...(assignedAlertsQuery.data?.data ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const activateMutation = useMutation({
    mutationFn: () => activateActingPs(actingPsUserId),
    onSuccess: () => {
      setActingPsUserId('')
      queryClient.invalidateQueries({ queryKey: ['sdt', 'dashboard'] })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateActingPs(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sdt', 'dashboard'] }),
  })

  const columns: TableColumn<Alert>[] = [
    {
      key: 'reference_number',
      header: en.sdt.psDashboard.columnReference,
      render: (row) => <span className="font-mono">{row.reference_number}</span>,
    },
    { key: 'country', header: en.sdt.psDashboard.columnCountry, render: (row) => row.country },
    {
      key: 'status',
      header: en.sdt.psDashboard.columnStatus,
      render: (row) => <AlertStatusBadge status={row.status} />,
    },
  ]

  const directiveSummary = dashboardQuery.data?.directive_summary_this_week

  return (
    <div className="p-6" data-testid="alert-dashboard">
      <h1 className="text-h1 text-primary">{en.sdt.psDashboard.title}</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <p className="text-body-sm text-text-muted">{en.sdt.psDashboard.pendingInquiriesTitle}</p>
          <p className="mt-1 font-mono text-h1 text-primary">{dashboardQuery.data?.pending_inquiries_count ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <p className="text-body-sm text-text-muted">{en.sdt.psDashboard.directiveSummaryTitle}</p>
          <p className="mt-1 font-mono text-h1 text-primary">{directiveSummary?.total ?? '—'}</p>
          {directiveSummary && (
            <dl className="mt-2 space-y-1 text-body-sm">
              {Object.entries(directiveSummary.by_status).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <dt className="text-text-secondary">{status}</dt>
                  <dd className="font-mono text-text-primary">{count}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-h3 text-primary">{en.sdt.psDashboard.unacknowledgedAlertsTitle}</h2>
        <div className="mt-3">
          <Table
            columns={columns}
            data={unacknowledgedAlerts}
            rowKey={(row) => row.id}
            emptyMessage={en.sdt.psDashboard.unacknowledgedAlertsEmpty}
            onRowClick={(row) => navigate(`/alerts/${row.id}`)}
            getRowTestId={() => 'alert-row'}
          />
        </div>
      </section>

      {canManageActingPs && (
        <section className="mt-8">
          <h2 className="text-h3 text-primary">{en.sdt.psDashboard.actingPsSectionTitle}</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label={en.sdt.psDashboard.actingPsUserIdLabel}
              value={actingPsUserId}
              onChange={(event) => setActingPsUserId(event.target.value)}
              className="sm:w-80"
            />
            <Button
              variant="primary"
              disabled={actingPsUserId.trim().length === 0 || activateMutation.isPending}
              onClick={() => activateMutation.mutate()}
            >
              {en.sdt.psDashboard.activateActingPsButton}
            </Button>
            <Button variant="secondary" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate()}>
              {en.sdt.psDashboard.deactivateActingPsButton}
            </Button>
          </div>
          <p className="mt-2 text-caption text-text-muted">{en.sdt.psDashboard.actingPsUserIdHint}</p>
          {activateMutation.isSuccess && (
            <p className="mt-2 text-body-sm text-success-soft-text">{en.sdt.psDashboard.activateSuccessMessage}</p>
          )}
          {deactivateMutation.isSuccess && (
            <p className="mt-2 text-body-sm text-success-soft-text">{en.sdt.psDashboard.deactivateSuccessMessage}</p>
          )}
        </section>
      )}
    </div>
  )
}
