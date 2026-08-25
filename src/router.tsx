import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import AppLayout from './layouts/AppLayout'

import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import AlertListPage from './pages/alerts/AlertListPage'
import AlertSubmitPage from './pages/alerts/AlertSubmitPage'
import AlertDetailPage from './pages/alerts/AlertDetailPage'
import InquiryListPage from './pages/inquiries/InquiryListPage'
import LogInquiryPage from './pages/inquiries/LogInquiryPage'
import InquiryDetailPage from './pages/inquiries/InquiryDetailPage'
import DirectiveListPage from './pages/directives/DirectiveListPage'
import IssueDirectivePage from './pages/directives/IssueDirectivePage'
import DirectiveSummaryPage from './pages/directives/DirectiveSummaryPage'
import DirectiveDetailPage from './pages/directives/DirectiveDetailPage'
import ReportListPage from './pages/reports/ReportListPage'
import ReportFormPage from './pages/reports/ReportFormPage'
import ComplianceDashboardPage from './pages/reports/ComplianceDashboardPage'
import MissionActivityPage from './pages/governance/MissionActivityPage'
import MfaAwarenessPage from './pages/governance/MfaAwarenessPage'
import PsDashboardPage from './pages/sdt/PsDashboardPage'
import HqWorkspacePage from './pages/sdt/HqWorkspacePage'
import ReportComplianceConsolePage from './pages/sdt/ReportComplianceConsolePage'
import DirectiveOverviewPage from './pages/sdt/DirectiveOverviewPage'
import AIEBudgetCodePage from './pages/sdt/config/AIEBudgetCodePage'
import ConfigHubPage from './pages/sdt/config/ConfigHubPage'
import AlertFieldsConfigPage from './pages/sdt/config/AlertFieldsConfigPage'
import InquirySettingsConfigPage from './pages/sdt/config/InquirySettingsConfigPage'
import DirectiveSettingsConfigPage from './pages/sdt/config/DirectiveSettingsConfigPage'
import KpiSettingsConfigPage from './pages/sdt/config/KpiSettingsConfigPage'
import ReferralOrganisationsConfigPage from './pages/sdt/config/ReferralOrganisationsConfigPage'
import KpiDashboardPage from './pages/kpi/KpiDashboardPage'
import KpiComparisonPage from './pages/kpi/KpiComparisonPage'
import ManualKpiEntryPage from './pages/kpi/ManualKpiEntryPage'
import SetKpiTargetsPage from './pages/kpi/SetKpiTargetsPage'
import HrmdDashboardPage from './pages/sdt/HrmdDashboardPage'
import SearchResultsPage from './pages/search/SearchResultsPage'
import CountryProfilePage from './pages/search/CountryProfilePage'
import NotFoundPage from './pages/NotFoundPage'

/**
 * Redirects unauthenticated users to /login (CLAUDE.md Section 2 decoupled SPA /
 * Sanctum session model). GET /api/v1/me — via useAuth() — is the source of truth for
 * whether a session cookie is currently valid; nothing here inspects the cookie directly.
 */
function ProtectedRoute() {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

// Route names mirror API-001's endpoint map (14_TW_API_Specification.md Sections 3-12)
// so a given resource's UI path and API path stay easy to cross-reference.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/alerts', element: <AlertListPage /> },
          { path: '/alerts/new', element: <AlertSubmitPage /> },
          { path: '/alerts/:id', element: <AlertDetailPage /> },
          { path: '/inquiries', element: <InquiryListPage /> },
          { path: '/inquiries/new', element: <LogInquiryPage /> },
          { path: '/inquiries/:id', element: <InquiryDetailPage /> },
          { path: '/directives', element: <DirectiveListPage /> },
          { path: '/directives/new', element: <IssueDirectivePage /> },
          { path: '/directives/summary', element: <DirectiveSummaryPage /> },
          { path: '/directives/:id', element: <DirectiveDetailPage /> },
          { path: '/reports', element: <ReportListPage /> },
          { path: '/reports/compliance', element: <ComplianceDashboardPage /> },
          { path: '/reports/new', element: <ReportFormPage /> },
          { path: '/reports/:id', element: <ReportFormPage /> },
          { path: '/mission-activity', element: <MissionActivityPage /> },
          { path: '/mfa-awareness', element: <MfaAwarenessPage /> },
          { path: '/sdt/ps-dashboard', element: <PsDashboardPage /> },
          { path: '/sdt/hq-workspace', element: <HqWorkspacePage /> },
          { path: '/sdt/reports/compliance', element: <ReportComplianceConsolePage /> },
          { path: '/sdt/directives/overview', element: <DirectiveOverviewPage /> },
          { path: '/config', element: <ConfigHubPage /> },
          { path: '/sdt/config/aie-budget-codes', element: <AIEBudgetCodePage /> },
          { path: '/sdt/config/alert-fields', element: <AlertFieldsConfigPage /> },
          { path: '/sdt/config/inquiry-settings', element: <InquirySettingsConfigPage /> },
          { path: '/sdt/config/directive-settings', element: <DirectiveSettingsConfigPage /> },
          { path: '/sdt/config/kpi-settings', element: <KpiSettingsConfigPage /> },
          { path: '/sdt/config/referral-organisations', element: <ReferralOrganisationsConfigPage /> },
          { path: '/kpi/dashboard', element: <KpiDashboardPage /> },
          { path: '/kpi/comparison', element: <KpiComparisonPage /> },
          { path: '/kpi/manual-entry', element: <ManualKpiEntryPage /> },
          { path: '/kpi/targets', element: <SetKpiTargetsPage /> },
          { path: '/sdt/hrmd-dashboard', element: <HrmdDashboardPage /> },
          { path: '/search', element: <SearchResultsPage /> },
          { path: '/search/countries/:country', element: <CountryProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
