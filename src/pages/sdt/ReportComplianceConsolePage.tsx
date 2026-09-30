import { getSdtReportCompliance } from '../../api/sdt'
import { useI18n } from '../../i18n/context'
import { ComplianceBoard } from '../reports/ComplianceBoard'

/**
 * /sdt/reports/compliance — the PS console's compliance view (FR-SDT-001, FR-RPT-018): the same
 * board as /reports/compliance over App\Http\Controllers\Api\Sdt\ReportsController, gated
 * server-side by MinistryPolicy::viewPsDashboard() (Ministry PS and Acting PS).
 */
export default function ReportComplianceConsolePage() {
  const { t } = useI18n()
  return (
    <ComplianceBoard
      title={t.sdt.reportCompliance.title}
      subtitle={t.sdt.reportCompliance.subtitle}
      queryKey={['sdt', 'reports', 'compliance']}
      fetchBoard={getSdtReportCompliance}
    />
  )
}
