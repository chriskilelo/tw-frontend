import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { listMissions, type Mission } from '../../api/missions'
import {
  getMfaAwarenessSummary,
  getMissionDrillDown,
  getNationalOverview,
  type GovernanceActivityPeriod,
} from '../../api/governance'
import { Table, type TableColumn } from '../../components/Table'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Pagination } from '../../components/Pagination'
import { useClientPagination } from '../../hooks/useClientPagination'
import { useI18n } from '../../i18n/context'

type Tab = 'aggregate' | 'national'

interface MissionCount {
  mission: Mission
  count: number
}

/**
 * FR-MFA-001 to 003. Read-only aggregate counts for MFA HQ Officer / MFA Principal
 * Secretary — never exposes underlying record content, matching
 * App\Services\GovernanceService::mfaAwarenessSummary()'s aggregate-only response.
 */
export default function MfaAwarenessPage() {
  const { t } = useI18n()
  const { role } = useAuth()
  const isMfaPrincipalSecretary = role?.name === 'MFA Principal Secretary'
  const [tab, setTab] = useState<Tab>('aggregate')
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)

  const missionsQuery = useQuery({ queryKey: ['missions'], queryFn: listMissions })
  const summaryQuery = useQuery({ queryKey: ['mfa-awareness'], queryFn: getMfaAwarenessSummary })

  const drillDownQuery = useQuery({
    queryKey: ['mfa-awareness', 'missions', selectedMissionId],
    queryFn: () => getMissionDrillDown(selectedMissionId as string),
    enabled: selectedMissionId !== null,
  })

  const nationalOverviewQuery = useQuery({
    queryKey: ['mfa-awareness', 'national-overview'],
    queryFn: getNationalOverview,
    enabled: tab === 'national' && isMfaPrincipalSecretary,
  })

  const missionCounts: MissionCount[] = (missionsQuery.data ?? []).map((mission) => ({
    mission,
    count: summaryQuery.data?.by_mission[mission.name] ?? 0,
  }))

  const selectedMission = missionsQuery.data?.find((mission) => mission.id === selectedMissionId) ?? null

  const missionCountsPage = useClientPagination(missionCounts)

  const missionColumns: TableColumn<MissionCount>[] = [
    { key: 'mission', header: t.governance.mfaAwareness.columnMission, render: (row) => row.mission.name },
    {
      key: 'count',
      header: t.governance.mfaAwareness.columnCount,
      render: (row) => <span className="font-mono">{row.count}</span>,
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.governance.mfaAwareness.title}</h1>
      <Badge variant="neutral" label={t.common.readOnly} className="mt-2" />

      {isMfaPrincipalSecretary && (
        <div className="mt-4 flex gap-2">
          <Button
            variant={tab === 'aggregate' ? 'primary' : 'secondary'}
            onClick={() => setTab('aggregate')}
          >
            {t.governance.mfaAwareness.aggregateTitle}
          </Button>
          <Button
            variant={tab === 'national' ? 'primary' : 'secondary'}
            onClick={() => setTab('national')}
          >
            {t.governance.mfaAwareness.nationalOverviewTab}
          </Button>
        </div>
      )}

      {tab === 'aggregate' && (
        <>
          {summaryQuery.data && (
            <section className="mt-6">
              <h2 className="text-h3 text-primary">{t.governance.mfaAwareness.aggregateTitle}</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile label={t.governance.mfaAwareness.totalLabel} value={summaryQuery.data.total} />
                <BreakdownTile title={t.governance.mfaAwareness.byTypeTitle} breakdown={summaryQuery.data.by_type} />
                <BreakdownTile
                  title={t.governance.mfaAwareness.byPeriodTitle}
                  breakdown={summaryQuery.data.by_period}
                />
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-h3 text-primary">{t.governance.mfaAwareness.byMissionTitle}</h2>
            <div className="mt-3">
              <Table
                columns={missionColumns}
                data={missionCountsPage.pageItems}
                rowKey={(row) => row.mission.id}
                emptyMessage={t.governance.mfaAwareness.empty}
                onRowClick={(row) => setSelectedMissionId(row.mission.id)}
              />
              <Pagination
                meta={missionCountsPage.meta}
                onPageChange={missionCountsPage.setPage}
                onPerPageChange={missionCountsPage.setPerPage}
                className="mt-4"
              />
            </div>
          </section>

          {selectedMissionId !== null && (
            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-h3 text-primary">
                  {t.governance.mfaAwareness.missionDrillDownTitle}
                  {selectedMission ? ` — ${selectedMission.name}` : ''}
                </h2>
                <Button variant="ghost" onClick={() => setSelectedMissionId(null)}>
                  {t.governance.mfaAwareness.backToOverview}
                </Button>
              </div>
              {drillDownQuery.data && (
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PeriodSummaryCard
                    label={t.governance.mfaAwareness.currentPeriodLabel}
                    period={drillDownQuery.data.current_period}
                  />
                  <PeriodSummaryCard
                    label={t.governance.mfaAwareness.priorPeriodLabel}
                    period={drillDownQuery.data.prior_period}
                  />
                </div>
              )}
            </section>
          )}
        </>
      )}

      {tab === 'national' && isMfaPrincipalSecretary && (
        <section className="mt-6">
          <h2 className="text-h3 text-primary">{t.governance.mfaAwareness.nationalOverviewTab}</h2>
          <div className="mt-3 flex flex-col gap-4">
            {(nationalOverviewQuery.data?.missions ?? []).map((mission) => (
              <div key={mission.mission_id} className="rounded-lg border border-border bg-white p-4 shadow-sm">
                <p className="text-body font-semibold text-text-primary">{mission.mission_name}</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PeriodSummaryCard
                    label={t.governance.mfaAwareness.currentPeriodLabel}
                    period={mission.current_period}
                  />
                  <PeriodSummaryCard
                    label={t.governance.mfaAwareness.priorPeriodLabel}
                    period={mission.prior_period}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-body-sm text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-h1 text-primary">{value}</p>
    </div>
  )
}

function BreakdownTile({ title, breakdown }: { title: string; breakdown: Record<string, number> }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-body-sm text-text-muted">{title}</p>
      <dl className="mt-2 space-y-1 text-body-sm">
        {Object.entries(breakdown).map(([key, count]) => (
          <div key={key} className="flex justify-between">
            <dt className="text-text-secondary">{key}</dt>
            <dd className="font-mono text-text-primary">{count}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function PeriodSummaryCard({ label, period }: { label: string; period: GovernanceActivityPeriod }) {
  return (
    <div className="rounded-lg border border-border bg-section-bg p-4">
      <p className="text-body-sm text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-h2 text-primary">{period.total}</p>
      <p className="text-caption text-text-muted">
        {period.period_start} – {period.period_end}
      </p>
    </div>
  )
}
