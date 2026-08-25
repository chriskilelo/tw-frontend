import { Link } from 'react-router-dom'
import en from '../../../i18n/en'

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
 * restricts the 'config' nav entry to System Administrator only, matching
 * that same boundary.
 */
export default function ConfigHubPage() {
  const areas: ConfigArea[] = [
    {
      key: 'alertFields',
      path: '/sdt/config/alert-fields',
      title: en.sdt.configHub.alertFieldsTitle,
      description: en.sdt.configHub.alertFieldsDescription,
    },
    {
      key: 'aieBudgetCodes',
      path: '/sdt/config/aie-budget-codes',
      title: en.sdt.configHub.aieBudgetCodesTitle,
      description: en.sdt.configHub.aieBudgetCodesDescription,
    },
    {
      key: 'inquirySettings',
      path: '/sdt/config/inquiry-settings',
      title: en.sdt.configHub.inquirySettingsTitle,
      description: en.sdt.configHub.inquirySettingsDescription,
    },
    {
      key: 'directiveSettings',
      path: '/sdt/config/directive-settings',
      title: en.sdt.configHub.directiveSettingsTitle,
      description: en.sdt.configHub.directiveSettingsDescription,
    },
    {
      key: 'kpiSettings',
      path: '/sdt/config/kpi-settings',
      title: en.sdt.configHub.kpiSettingsTitle,
      description: en.sdt.configHub.kpiSettingsDescription,
    },
    {
      key: 'referralOrganisations',
      path: '/sdt/config/referral-organisations',
      title: en.sdt.configHub.referralOrganisationsTitle,
      description: en.sdt.configHub.referralOrganisationsDescription,
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.sdt.configHub.title}</h1>
      <p className="mt-2 text-body text-text-secondary">{en.sdt.configHub.subtitle}</p>

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
