import type { ComponentType, SVGProps } from 'react'
import {
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BellAlertIcon,
  BriefcaseIcon,
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ChartBarSquareIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  FlagIcon,
  GlobeAltIcon,
  HomeIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PencilSquareIcon,
  ScaleIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'

export type NavKey =
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
  | 'adminUsers'
  | 'adminApprovals'
  | 'adminMissionPostings'
  | 'adminLeadership'
  | 'adminAuditLog'
  | 'adminMinistries'

export const NAV_ITEMS: { key: NavKey; path: string }[] = [
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
  // ADR-006: account and department administration.
  { key: 'adminUsers', path: '/admin/users' },
  { key: 'adminApprovals', path: '/admin/approvals' },
  { key: 'adminMissionPostings', path: '/admin/mission-postings' },
  { key: 'adminLeadership', path: '/admin/leadership' },
  { key: 'adminAuditLog', path: '/admin/audit-log' },
  { key: 'adminMinistries', path: '/admin/ministries' },
]

/**
 * One Heroicon (20/solid, sized for sitting beside a text label per Heroicons' own sizing
 * guidance) per nav item. Chosen for semantic fit within TradeWatch's own domain language
 * rather than generic dashboard-icon conventions, and deliberately kept distinct pairwise
 * within each engine (e.g. directives vs directivesSummary; reportsCompliance vs
 * sdtReportCompliance) so two related-but-different screens never share a silhouette.
 */
export const NAV_ICONS: Record<NavKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  dashboard: HomeIcon,
  search: MagnifyingGlassIcon,
  // Market intelligence alerts (Intelligence Alert Engine) — a triangle/warning glyph reads
  // as "flagged intelligence," distinct from the system-notification bell in the header.
  alerts: BellAlertIcon,
  // Trade inquiries are conversations with an external party (buyer/investor/complainant).
  inquiries: ChatBubbleLeftRightIcon,
  // A directive is a tasked action to be completed and checked off.
  directives: ClipboardDocumentCheckIcon,
  // The summary view is a rolled-up list of directives, not an individual one.
  directivesSummary: ClipboardDocumentListIcon,
  reports: DocumentTextIcon,
  // Compliance status is a report viewed as a chart/scorecard, not prose.
  reportsCompliance: DocumentChartBarIcon,
  config: Cog6ToothIcon,
  // A mission is an embassy abroad — a globe fits better than a building here.
  missionActivity: GlobeAltIcon,
  // MFA is a separate ministry (government institution), so a civic building distinguishes
  // it from the mission's globe above.
  mfaAwareness: BuildingLibraryIcon,
  kpiDashboard: ChartBarIcon,
  // A balance scale reads as "comparing" more clearly than a second bar-chart glyph would.
  kpiComparison: ScaleIcon,
  kpiManualEntry: PencilSquareIcon,
  // Heroicons has no literal target/bullseye glyph; a flag ("setting a goal to reach") is
  // the closest semantic fit and stays visually distinct from the KPI chart icons above.
  kpiTargets: FlagIcon,
  // HRM&D is a people/human-resources function.
  hrmdDashboard: UserGroupIcon,
  // Principal Secretary is the ministry's executive office.
  psDashboard: BriefcaseIcon,
  // HQ Workspace is a physical headquarters workspace.
  hqWorkspace: BuildingOfficeIcon,
  // The SDT-console compliance wrapper is an oversight/enforcement console, so a shield
  // distinguishes it from the plain report-chart icon used by the generic reportsCompliance.
  sdtReportCompliance: ShieldCheckIcon,
  // Overview is an aggregate analytics view across missions, distinct from the flat list
  // used by directivesSummary above.
  sdtDirectiveOverview: ChartBarSquareIcon,
  aieBudgetCodes: BanknotesIcon,
  adminUsers: UsersIcon,
  // A checked badge reads as "sign-off", which is what a PS approval is.
  adminApprovals: CheckBadgeIcon,
  adminMissionPostings: MapPinIcon,
  // Acting PS / Designated Deputy hand authority across, hence the two-way arrows.
  adminLeadership: ArrowsRightLeftIcon,
  adminAuditLog: ListBulletIcon,
  // Distinct from hqWorkspace's single office building: many departments.
  adminMinistries: BuildingOffice2Icon,
}
