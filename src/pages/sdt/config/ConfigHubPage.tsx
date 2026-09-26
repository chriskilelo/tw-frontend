import { Link } from 'react-router-dom'
import { useI18n } from '../../../i18n/context'

interface ConfigArea {
  key: string
  path: string
  title: string
  description: string
}

/**
 * Landing page for the 'config' nav entry (previously pointed at /config
 * with no route registered at all — a dead link). Links out to the six
 * System-Administrator-only screens under Sdt\ConfigController, all of
 * which are gated identically server-side (MasterDataEntryPolicy::manage(),
 * KpiPolicy::manageDefinitions(), ReferralPolicy::manage()), so this hub
 * itself carries no separate authorization — AppLayout's ROLE_NAV_KEYS
 * restricts the 'config' nav entry to the two administrator roles, matching
 * that same boundary. ADR-006: a Ministry Administrator reaches the same six
 * screens, each pinned to its own department server-side.
 */
export default function ConfigHubPage() {
  const { t } = useI18n()
  const areas: ConfigArea[] = [
    {
      key: 'alertFields',
      path: '/sdt/config/alert-fields',
      title: t.sdt.configHub.alertFieldsTitle,
      description: t.sdt.configHub.alertFieldsDescription,
    },
    {
      key: 'aieBudgetCodes',
      path: '/sdt/config/aie-budget-codes',
      title: t.sdt.configHub.aieBudgetCodesTitle,
      description: t.sdt.configHub.aieBudgetCodesDescription,
    },
    {
      key: 'inquirySettings',
      path: '/sdt/config/inquiry-settings',
      title: t.sdt.configHub.inquirySettingsTitle,
      description: t.sdt.configHub.inquirySettingsDescription,
    },
    {
      key: 'directiveSettings',
      path: '/sdt/config/directive-settings',
      title: t.sdt.configHub.directiveSettingsTitle,
      description: t.sdt.configHub.directiveSettingsDescription,
    },
    {
      key: 'kpiSettings',
      path: '/sdt/config/kpi-settings',
      title: t.sdt.configHub.kpiSettingsTitle,
      description: t.sdt.configHub.kpiSettingsDescription,
    },
    {
      key: 'referralOrganisations',
      path: '/sdt/config/referral-organisations',
      title: t.sdt.configHub.referralOrganisationsTitle,
      description: t.sdt.configHub.referralOrganisationsDescription,
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.sdt.configHub.title}</h1>
      <p className="mt-2 text-body text-text-secondary">{t.sdt.configHub.subtitle}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => (
          <Link
            key={area.key}
            to={area.path}
            className="block rounded-lg border border-border bg-white p-4 shadow-sm transition-colors hover:border-accent"
          >
            <p className="text-h3 text-primary">{area.title}</p>
            <p className="mt-1 text-body-sm text-text-muted">{area.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
