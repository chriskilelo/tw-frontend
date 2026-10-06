import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth, AUTH_QUERY_KEY } from '../hooks/useAuth'
import { logout } from '../api/auth'
import { I18nProvider, useI18n } from '../i18n/context'
import { NotificationBell } from '../components/NotificationBell'
import { LanguageToggle } from '../components/LanguageToggle'
import { UserMenu } from '../components/UserMenu'
import { BreadcrumbProvider } from '../components/BreadcrumbProvider'
import { Breadcrumbs } from '../components/Breadcrumbs'
import crest from '../assets/tw_crest.png'
import { Bars3Icon } from '@heroicons/react/20/solid'
import { NAV_ICONS, NAV_ITEMS, type NavKey } from './navigation'

const ALL_KEYS: NavKey[] = NAV_ITEMS.map((item) => item.key)

/**
 * The directive engine's two sidebar entries. 'directives' is shown only to the roles that
 * work directives day to day (DirectivePolicy: the target Ministry Attache, the issuing
 * Ministry HQ Officer, and the Ministry PS / Acting PS / Ministry HQ Director oversight roles);
 * 'directivesSummary' only to DirectivePolicy::viewSummary()'s Ministry HQ Director, Ministry
 * PS and Acting PS. Every other role, the System Administrator included, gets neither. The
 * API still enforces all of this (a hidden link is never the only guard).
 */
const DIRECTIVE_NAV_KEYS: NavKey[] = ['directives', 'directivesSummary']

/**
 * The Periodic Report Engine's entries. ReportPolicy grants reading to the attache (own
 * mission), the HQ review roles and the Heads of Mission; compliance to the HQ Director, PS and
 * Acting PS. The System Administrator is none of these (API-001 Section 5), so it gets none.
 */
const REPORT_NAV_KEYS: NavKey[] = ['reports', 'reportsCompliance', 'sdtReportCompliance']

/**
 * The KPI Framework Engine's operational entries. KpiPolicy grants them to department roles
 * only (directors, the PS, HRM&D, the attache and the HQ Officer); the System Administrator
 * has no department and configures KPIs under KPI settings instead, so it gets none.
 */
const KPI_NAV_KEYS: NavKey[] = ['kpiDashboard', 'kpiComparison', 'kpiTargets', 'kpiManualEntry', 'hrmdDashboard']

/**
 * The two mission-governance views. MissionPolicy opens Mission Activity to the Head and Deputy
 * Head of Mission and MFA Awareness to the two MFA roles (FR-HOM-001, FR-MFA-001); the System
 * Administrator is neither, and the API refuses it both, so it gets neither link.
 */
const GOVERNANCE_NAV_KEYS: NavKey[] = ['missionActivity', 'mfaAwareness']

/**
 * CLAUDE.md Section 5 role catalogue mapped to visible nav sections. Roles without an entry
 * (Designated Deputy, Honorary Consul) fall back to
 * DEFAULT_NAV_KEYS rather than a guessed section list.
 */
const ROLE_NAV_KEYS: Record<string, NavKey[]> = {
  // The platform administrator sees every section except the directive engine's two entries
  // (DIRECTIVE_NAV_KEYS above): it neither issues, receives nor oversees directives.
  'System Administrator': ALL_KEYS.filter(
    (key) => !DIRECTIVE_NAV_KEYS.includes(key) && !REPORT_NAV_KEYS.includes(key) && !KPI_NAV_KEYS.includes(key) && !GOVERNANCE_NAV_KEYS.includes(key),
  ),
  // ReportPolicy::viewCompliance() (Session 25): Ministry HQ Director / Ministry PS only.
  // directivesSummary: DirectivePolicy::viewSummary() grants Ministry HQ Director, Ministry PS
  // and Acting PS (FR-DIR-012; Acting PS carries the full PS permission set, FR-SDT-004 AC1).
  // sdtReportCompliance/sdtDirectiveOverview (Session 31): MinistryPolicy::viewPsDashboard()
  // gates both, the same boundary as psDashboard, so they're added alongside it for both
  // Ministry PS and Acting PS below.
  // kpiDashboard/kpiComparison/kpiTargets (Session 35): KpiPolicy::viewComparison()/
  // setTarget() grant Ministry HQ Director, Ministry PS, and Acting PS identically — added
  // to all three below, not just the two roles the session task named literally.
  // 'config' (System Configuration hub, /config -> ConfigHubPage, and its six
  // /sdt/config/* sub-pages) was previously present on Ministry PS/Acting PS/Ministry HQ
  // Director's nav below despite pointing at a route that didn't exist at all. Now that the
  // hub and all six sub-pages are built, 'config' is deliberately NOT restored to these three
  // roles' lists — every ConfigController action (alert fields, AIE budget codes, inquiry
  // settings, directive settings, KPI settings, referral organisations) is gated System
  // Administrator only, including GET (MasterDataEntryPolicy::manage(), KpiPolicy::
  // manageDefinitions(), ReferralPolicy::manage()), so it stays visible only via
  // ALL_KEYS on 'System Administrator' below.
  'Ministry PS': [
    'dashboard',
    'search',
    'alerts',
    'inquiries',
    'directives',
    'directivesSummary',
    'reports',
    'reportsCompliance',
    'kpiDashboard',
    'kpiComparison',
    'kpiTargets',
    'psDashboard',
    'sdtReportCompliance',
    'sdtDirectiveOverview',
  ],
  // Acting PS holds the full Ministry PS permission set for the duration of the
  // activation (FR-SDT-004, role-swap per Session 14 implementation note), so it
  // gets the same nav, including the Acting PS deactivation control on the PS dashboard and
  // the directive summary (DirectivePolicy::viewSummary() includes Acting PS).
  'Acting PS': [
    'dashboard',
    'search',
    'alerts',
    'inquiries',
    'directives',
    'directivesSummary',
    'reports',
    'reportsCompliance',
    'kpiDashboard',
    'kpiComparison',
    'kpiTargets',
    'psDashboard',
    'sdtReportCompliance',
    'sdtDirectiveOverview',
  ],
  'Ministry HQ Director': [
    'dashboard',
    'search',
    'alerts',
    'inquiries',
    'directives',
    'directivesSummary',
    'reports',
    'reportsCompliance',
    'kpiDashboard',
    'kpiComparison',
    'kpiTargets',
  ],
  // kpiManualEntry (Session 35): KpiPolicy::recordActual() grants Ministry Attache and
  // Ministry HQ Officer identically (FR-KPI-007).
  // 'reports': FR-RPT-017 / FR-SDT-015 — the HQ Officer reviews every mission's submitted reports.
  'Ministry HQ Officer': ['dashboard', 'search', 'alerts', 'inquiries', 'directives', 'reports', 'hqWorkspace', 'kpiManualEntry'],
  // FR-SDT-007: the Director of External Trade (Publishing Authority) reviews submitted reports.
  'Ministry Publishing Authority': ['dashboard', 'search', 'reports'],
  // ReportPolicy::create() (Session 25): draft reports may only ever be started by a
  // Ministry Attache, so 'reports' was already here for that reason. 'directives': the
  // attache sees the directives that target them (DirectivePolicy) and acknowledges,
  // progresses and completes them on DirectiveDetailPage; only the issuer withdraws one.
  // kpiDashboard: FR-KPI-010 — the attache's own-mission, read-only KPI view
  // (KpiPolicy::viewDashboard(); the API pins it to their mission).
  'Ministry Attache': ['dashboard', 'search', 'alerts', 'inquiries', 'directives', 'reports', 'kpiDashboard', 'kpiManualEntry'],
  // 'reports' (read-only): FR-HOM-001 AC2 — their mission's submitted reports in full.
  // 'search' finds their own mission's records only (Alert/Inquiry visibleTo()).
  'Head of Mission': ['dashboard', 'search', 'missionActivity', 'reports'],
  'Deputy Head of Mission': ['dashboard', 'search', 'missionActivity', 'reports'],
  // FR-MFA-001 AC2: aggregate counts and submission metadata only. No 'search': every result
  // is record content, so the API refuses knowledge search to the MFA roles (403).
  'MFA HQ Officer': ['dashboard', 'mfaAwareness'],
  'MFA Principal Secretary': ['dashboard', 'mfaAwareness'],
  // hrmdDashboard (Session 35): replaces the previously dead 'kpiReports' nav entry, which
  // pointed at a route ('/kpi-reports') that was never built. KpiPolicy::viewHrmdDashboard()
  // is HRM&D Officer only. 'search' is deliberately NOT included here: MinistryScope
  // middleware (Session 33, FR-SDT-018) 403s HRM&D Officer on any request path outside
  // api/v1/kpi-* / api/v1/sdt/hrmd-dashboard* as a blanket net, GET /search included.
  // kpiDashboard: FR-KPI-011 / FR-SDT-016 — read-only KPI dashboards across every mission,
  // each access audit-logged by the API; the path is under api/v1/kpi-*, inside the
  // MinistryScope guard's KPI allowance.
  'HRM&D Officer': ['dashboard', 'kpiDashboard', 'hrmdDashboard'],
  // ADR-006 / BR-025: department administration only — no search or engine pages, all of
  // which the backend's operational fence (MinistryScope middleware + BasePolicy) would 403.
  // 'dashboard' is the administrator dashboard (GET /admin/dashboard: accounts, seats,
  // approvals and configuration — never operational records), not the operational one.
  // 'config' is restored for this role: every Sdt\ConfigController screen now pins a
  // Ministry Administrator to its own department. adminMinistries is omitted (its list
  // would only ever show the administrator's own department).
  'Ministry Administrator': [
    'dashboard',
    'adminUsers',
    'adminApprovals',
    'config',
    'adminMissionPostings',
    'adminLeadership',
    'adminAuditLog',
  ],
}

const DEFAULT_NAV_KEYS: NavKey[] = ['dashboard', 'search']

/**
 * I18nProvider is scoped here (authenticated subtree only), not mounted globally in
 * main.tsx — it depends on useAuth(), and mounting it above the public /login,
 * /forgot-password, /reset-password routes would fire an extra GET /me there and trip
 * the 401 interceptor's redirect-to-/login on pages that are already unauthenticated.
 */
export default function AppLayout() {
  return (
    <I18nProvider>
      <BreadcrumbProvider>
        <AppLayoutContent />
      </BreadcrumbProvider>
    </I18nProvider>
  )
}

function AppLayoutContent() {
  const { user, role, refetch } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navKeys = (role?.name && ROLE_NAV_KEYS[role.name]) ?? DEFAULT_NAV_KEYS

  async function handleLogout() {
    await logout()
    queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY })
    await refetch()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-page-bg">
      {mobileOpen && (
        <button
          type="button"
          aria-label={t.common.close}
          className="fixed inset-0 z-30 bg-surface-dark/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-primary transition-transform md:static md:translate-x-0 print:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-3 py-5">
          <img src={crest} alt="" aria-hidden="true" className="h-12 w-12 shrink-0 object-contain" />
          <div className="flex flex-col gap-0.5">
            <span className="text-h3 font-bold text-white">{t.nav.brandTitle}</span>
            <span className="text-body-sm text-white/70">{t.nav.brandSubtitle}</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-2" aria-label={t.nav.brandTitle}>
          {NAV_ITEMS.filter((item) => navKeys.includes(item.key)).map((item) => {
            const Icon = NAV_ICONS[item.key]
            return (
              <NavLink
                key={item.key}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded px-3 py-2 text-body-sm font-medium transition-colors ${
                    isActive ? 'bg-primary-lighter text-white' : 'text-white/80 hover:bg-primary-light hover:text-white'
                  }`
                }
              >
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span>{t.nav[item.key]}</span>
              </NavLink>
            )
          })}
        </nav>

        {user && <UserMenu user={user} role={role} onLogout={handleLogout} />}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:pl-0">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-primary px-4 py-3 md:flex-nowrap md:px-6 print:hidden">
          <button
            type="button"
            className="rounded p-1.5 text-white hover:bg-primary-light md:hidden"
            aria-label={t.nav.brandTitle}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <Bars3Icon aria-hidden="true" className="h-5 w-5" />
          </button>

          <Breadcrumbs className="order-last w-full md:order-none md:w-auto md:flex-1" />

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <LanguageToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
