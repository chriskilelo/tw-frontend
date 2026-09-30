import { getReportComplianceDashboard } from '../../api/reports'
import { useI18n } from '../../i18n/context'
import { ComplianceBoard } from './ComplianceBoard'

/**
 * /reports/compliance — FR-RPT-018: Ministry HQ Director, Ministry PS and Acting PS, enforced by
 * ReportPolicy::viewCompliance(); the page renders what the endpoint returns.
 */
export default function ComplianceDashboardPage() {
  const { t } = useI18n()
  return (
    <ComplianceBoard
      title={t.reports.board.title}
      subtitle={t.reports.board.subtitle}
      queryKey={['periodic-reports', 'compliance']}
      fetchBoard={getReportComplianceDashboard}
    />
  )
}
