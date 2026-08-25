import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth, isReadOnlyRole, AUTH_QUERY_KEY } from '../hooks/useAuth'
import { logout } from '../api/auth'
import { I18nProvider, useI18n } from '../i18n/context'
import { NotificationBell } from '../components/NotificationBell'
import { LanguageToggle } from '../components/LanguageToggle'
import { Button } from '../components/Button'

type NavKey =
  | 'dashboard'
  | 'search'
  | 'alerts'
  | 'inquiries'
  | 'directives'
  | 'reports'
  | 'reportsCompliance'
  | 'config'
  | 'missionActivity'
  | 'mfaAwareness'
  | 'kpiDashboard'
  | 'kpiComparison'
  | 'kpiManualEntry'
  | 'kpiTargets'
  | 'hrmdDashboard'
  | 'directivesSummary'
  | 'psDashboard'
  | 'hqWorkspace'
  | 'sdtReportCompliance'
  | 'sdtDirectiveOverview'
  | 'aieBudgetCodes'

const NAV_ITEMS: { key: NavKey; path: string }[] = [
  { key: 'dashboard', path: '/dashboard' },
  { key: 'search', path: '/search' },
  { key: 'alerts', path: '/alerts' },
  { key: 'inquiries', path: '/inquiries' },
  { key: 'directives', path: '/directives' },
  { key: 'directivesSummary', path: '/directives/summary' },
  { key: 'reports', path: '/reports' },
  { key: 'reportsCompliance', path: '/reports/compliance' },
  { key: 'config', path: '/config' },
  { key: 'missionActivity', path: '/mission-activity' },
  { key: 'mfaAwareness', path: '/mfa-awareness' },
  { key: 'kpiDashboard', path: '/kpi/dashboard' },
  { key: 'kpiComparison', path: '/kpi/comparison' },
  { key: 'kpiManualEntry', path: '/kpi/manual-entry' },
  { key: 'kpiTargets', path: '/kpi/targets' },
  { key: 'hrmdDashboard', path: '/sdt/hrmd-dashboard' },
  { key: 'psDashboard', path: '/sdt/ps-dashboard' },
  { key: 'hqWorkspace', path: '/sdt/hq-workspace' },
  { key: 'sdtReportCompliance', path: '/sdt/reports/compliance' },
  { key: 'sdtDirectiveOverview', path: '/sdt/directives/overview' },
  { key: 'aieBudgetCodes', path: '/sdt/config/aie-budget-codes' },
]

const ALL_KEYS: NavKey[] = NAV_ITEMS.map((item) => item.key)

/**
 * CLAUDE.md Section 5 role catalogue mapped to visible nav sections. Roles not named in
 * the session spec (Ministry Publishing Authority, Designated Deputy, Acting PS,
 * Honorary Consul) fall back to DEFAULT_NAV_KEYS rather than a guessed section list.
 */
const ROLE_NAV_KEYS: Record<string, NavKey[]> = {
  'System Administrator': ALL_KEYS,
  // ReportPolicy::viewCompliance() (Session 25): Ministry HQ Director / Ministry PS only.
  // DirectivePolicy::viewSummary() (Session 27) grants directivesSummary to the same two
  // role names literally, and — unlike every other ability on this engine — does NOT
  // extend to Acting PS (see the 'Acting PS' entry below), so it is omitted there on purpose.
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
  // gets the same nav, including the Acting PS deactivation control on the PS dashboard —
  // except directivesSummary: DirectivePolicy::viewSummary() checks the literal role name
  // 'Ministry PS', which an activated Acting PS no longer carries, so GET /directives/summary
  // would 403 for this role. Omitted here to match that, not extended by analogy.
  'Acting PS': [
    'dashboard',
    'search',
    'alerts',
    'inquiries',
    'directives',
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
  'Ministry HQ Officer': ['dashboard', 'search', 'alerts', 'inquiries', 'directives', 'hqWorkspace', 'kpiManualEntry'],
  // ReportPolicy::create() (Session 25): draft reports may only ever be started by a
  // Ministry Attache, so 'reports' was already here for that reason. 'directives' is added
  // here for a different reason (Session 30): DirectivePolicy scopes a Ministry Attache to
  // directives that target them, and DirectiveDetailPage is where they acknowledge/progress/
  // complete/cancel one — this role had no nav path to that page at all until now.
  'Ministry Attache': ['dashboard', 'search', 'alerts', 'inquiries', 'directives', 'reports', 'kpiManualEntry'],
  'Head of Mission': ['dashboard', 'search', 'missionActivity'],
  'Deputy Head of Mission': ['dashboard', 'search', 'missionActivity'],
  'MFA HQ Officer': ['dashboard', 'search', 'mfaAwareness'],
  'MFA Principal Secretary': ['dashboard', 'search', 'mfaAwareness'],
  // hrmdDashboard (Session 35): replaces the previously dead 'kpiReports' nav entry, which
  // pointed at a route ('/kpi-reports') that was never built. KpiPolicy::viewHrmdDashboard()
  // is HRM&D Officer only. 'search' is deliberately NOT included here: MinistryScope
  // middleware (Session 33, FR-SDT-018) 403s HRM&D Officer on any request path outside
  // api/v1/kpi-* / api/v1/sdt/hrmd-dashboard* as a blanket net, GET /search included.
  'HRM&D Officer': ['dashboard', 'hrmdDashboard'],
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
      <AppLayoutContent />
    </I18nProvider>
  )
}

function AppLayoutContent() {
  const { user, role, refetch } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const readOnly = isReadOnlyRole(role?.name)
  const navKeys = (role?.name && ROLE_NAV_KEYS[role.name]) ?? DEFAULT_NAV_KEYS
  const canWrite = !readOnly

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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-primary transition-transform md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-0.5 px-4 py-5">
          <span className="text-h3 font-bold text-white">{t.nav.brandTitle}</span>
          <span className="text-body-sm text-white/70">{t.nav.brandSubtitle}</span>
        </div>

        <nav className="flex-1 space-y-1 px-2" aria-label={t.nav.brandTitle}>
          {NAV_ITEMS.filter((item) => navKeys.includes(item.key)).map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-body-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-lighter text-white' : 'text-white/80 hover:bg-primary-light hover:text-white'
                }`
              }
            >
              {t.nav[item.key]}
            </NavLink>
          ))}
        </nav>

        {canWrite && (navKeys.includes('alerts') || navKeys.includes('inquiries')) && (
          <div className="space-y-2 border-t border-white/10 px-3 py-4">
            {navKeys.includes('alerts') && (
              <NavLink to="/alerts/new" onClick={() => setMobileOpen(false)}>
                <Button variant="primary" className="w-full justify-center">
                  {t.alerts.list.newAlertButton}
                </Button>
              </NavLink>
            )}
            {navKeys.includes('inquiries') && (
              <NavLink to="/inquiries/new" onClick={() => setMobileOpen(false)}>
                <Button variant="secondary" className="w-full justify-center">
                  {t.inquiries.list.newInquiryButton}
                </Button>
              </NavLink>
            )}
          </div>
        )}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:pl-0">
        <header className="flex items-center justify-between bg-primary px-4 py-3 md:px-6">
          <button
            type="button"
            className="rounded p-1.5 text-white hover:bg-primary-light md:hidden"
            aria-label={t.nav.brandTitle}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <MenuIcon />
          </button>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <NotificationBell />
            {user && (
              <span className="hidden text-body-sm text-white/90 sm:inline">{user.full_name}</span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded px-2 py-1 text-caption font-semibold text-white/80 hover:bg-primary-light hover:text-white"
            >
              {t.nav.logout}
            </button>
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
