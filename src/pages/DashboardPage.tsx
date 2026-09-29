import { useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getDashboard } from '../api/dashboard'
import type { AuthUser, Role } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { DashboardError, DashboardSkeleton } from '../components/dashboard/layout'
import AttacheDashboard from './dashboard/AttacheDashboard'
import LeadershipDashboard from './dashboard/LeadershipDashboard'
import HqOfficerDashboard from './dashboard/HqOfficerDashboard'
import GeneralDashboard from './dashboard/GeneralDashboard'
import MissionGovernanceDashboard from './dashboard/MissionGovernanceDashboard'
import MfaDashboard from './dashboard/MfaDashboard'
import HrmdDashboard from './dashboard/HrmdDashboard'
import AdministrationDashboard from './dashboard/AdministrationDashboard'

/**
 * The home dashboard, shaped by role. The operational roles share GET /dashboard, which
 * returns a view-specific payload; the governance, HRM&D and administrator roles read the
 * endpoints their own access rules already allow (BR-020, FR-SDT-018, BR-025).
 */
export default function DashboardPage() {
  const { user, role } = useAuth()

  if (!user || !role) {
    return (
      <DashboardFrame>
        <DashboardSkeleton />
      </DashboardFrame>
    )
  }

  return <DashboardFrame>{renderForRole(user, role)}</DashboardFrame>
}

function renderForRole(user: AuthUser, role: Role): ReactNode {
  switch (role.name) {
    case 'System Administrator':
    case 'Ministry Administrator':
      return <AdministrationDashboard user={user} role={role} />
    case 'Head of Mission':
    case 'Deputy Head of Mission':
      return <MissionGovernanceDashboard user={user} role={role} />
    case 'MFA HQ Officer':
    case 'MFA Principal Secretary':
      return <MfaDashboard user={user} role={role} />
    case 'HRM&D Officer':
      return <HrmdDashboard user={user} role={role} />
    default:
      return <OperationalDashboard user={user} role={role} />
  }
}

function OperationalDashboard({ user, role }: { user: AuthUser; role: Role }) {
  const [kpiCycle, setKpiCycle] = useState<string | undefined>(undefined)
  const query = useQuery({
    queryKey: ['dashboard', kpiCycle ?? 'default'],
    queryFn: () => getDashboard(kpiCycle),
    placeholderData: keepPreviousData,
  })

  if (query.isLoading) {
    return <DashboardSkeleton />
  }
  if (query.isError || !query.data) {
    return <DashboardError onRetry={() => void query.refetch()} />
  }

  const data = query.data
  switch (data.view) {
    case 'attache':
      return <AttacheDashboard data={data} user={user} role={role} kpiCycle={kpiCycle} onKpiCycleChange={setKpiCycle} />
    case 'leadership':
      return <LeadershipDashboard data={data} user={user} role={role} kpiCycle={kpiCycle} onKpiCycleChange={setKpiCycle} />
    case 'hq_officer':
      return <HqOfficerDashboard data={data} user={user} role={role} />
    default:
      return <GeneralDashboard data={data} user={user} role={role} />
  }
}

function DashboardFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-310 space-y-6 px-4 py-6 sm:px-7">{children}</div>
}
