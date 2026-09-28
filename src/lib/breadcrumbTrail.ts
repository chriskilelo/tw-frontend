import { matchPath } from 'react-router-dom'
import type { NavKey } from '../layouts/navigation'

export type CrumbPageKey =
  | 'profile'
  | 'submitAlert'
  | 'alertDetail'
  | 'logInquiry'
  | 'inquiryDetail'
  | 'issueDirective'
  | 'directiveDetail'
  | 'newReport'
  | 'reportDetail'
  | 'configuration'
  | 'alertFields'
  | 'inquirySettings'
  | 'directiveSettings'
  | 'kpiSettings'
  | 'referralOrganisations'
  | 'newUser'
  | 'editUser'
  | 'approvalRequest'

export type CrumbGroupKey = 'administration' | 'kpi' | 'console' | 'governance'

/**
 * One breadcrumb per route in router.tsx. A crumb takes its label and icon from the sidebar
 * entry (`nav`) when it has one; otherwise from `page` copy plus the icon of the module it
 * belongs to. `isDynamic` pages replace the `page` label with the record's own name via
 * useBreadcrumbLabel(); `param` crumbs show a URL parameter. `group` adds a non-link
 * section label above top-level pages that have no index page of their own.
 */
export interface CrumbDefinition {
  pattern: string
  nav?: NavKey
  page?: CrumbPageKey
  icon?: NavKey
  isDynamic?: boolean
  param?: string
  parent?: string
  group?: CrumbGroupKey
}

const CRUMB_DEFINITIONS: CrumbDefinition[] = [
  { pattern: '/dashboard', nav: 'dashboard' },
  { pattern: '/profile', page: 'profile', icon: 'dashboard' },
  { pattern: '/search', nav: 'search' },
  { pattern: '/search/countries/:country', param: 'country', icon: 'search', parent: '/search' },

  { pattern: '/alerts', nav: 'alerts' },
  { pattern: '/alerts/new', page: 'submitAlert', icon: 'alerts', parent: '/alerts' },
  { pattern: '/alerts/:id', page: 'alertDetail', icon: 'alerts', isDynamic: true, parent: '/alerts' },

  { pattern: '/inquiries', nav: 'inquiries' },
  { pattern: '/inquiries/new', page: 'logInquiry', icon: 'inquiries', parent: '/inquiries' },
  { pattern: '/inquiries/:id', page: 'inquiryDetail', icon: 'inquiries', isDynamic: true, parent: '/inquiries' },

  { pattern: '/directives', nav: 'directives' },
  { pattern: '/directives/new', page: 'issueDirective', icon: 'directives', parent: '/directives' },
  { pattern: '/directives/summary', nav: 'directivesSummary', parent: '/directives' },
  { pattern: '/directives/:id', page: 'directiveDetail', icon: 'directives', isDynamic: true, parent: '/directives' },

  { pattern: '/reports', nav: 'reports' },
  { pattern: '/reports/compliance', nav: 'reportsCompliance', parent: '/reports' },
  { pattern: '/reports/new', page: 'newReport', icon: 'reports', parent: '/reports' },
  { pattern: '/reports/:id', page: 'reportDetail', icon: 'reports', isDynamic: true, parent: '/reports' },

  { pattern: '/mission-activity', nav: 'missionActivity', group: 'governance' },
  { pattern: '/mfa-awareness', nav: 'mfaAwareness', group: 'governance' },

  { pattern: '/sdt/ps-dashboard', nav: 'psDashboard', group: 'console' },
  { pattern: '/sdt/hq-workspace', nav: 'hqWorkspace', group: 'console' },
  { pattern: '/sdt/reports/compliance', nav: 'sdtReportCompliance', group: 'console' },
  { pattern: '/sdt/directives/overview', nav: 'sdtDirectiveOverview', group: 'console' },

  { pattern: '/config', page: 'configuration', icon: 'config' },
  { pattern: '/sdt/config/aie-budget-codes', nav: 'aieBudgetCodes', parent: '/config' },
  { pattern: '/sdt/config/alert-fields', page: 'alertFields', icon: 'config', parent: '/config' },
  { pattern: '/sdt/config/inquiry-settings', page: 'inquirySettings', icon: 'config', parent: '/config' },
  { pattern: '/sdt/config/directive-settings', page: 'directiveSettings', icon: 'config', parent: '/config' },
  { pattern: '/sdt/config/kpi-settings', page: 'kpiSettings', icon: 'config', parent: '/config' },
  { pattern: '/sdt/config/referral-organisations', page: 'referralOrganisations', icon: 'config', parent: '/config' },

  { pattern: '/kpi/dashboard', nav: 'kpiDashboard', group: 'kpi' },
  { pattern: '/kpi/comparison', nav: 'kpiComparison', group: 'kpi' },
  { pattern: '/kpi/manual-entry', nav: 'kpiManualEntry', group: 'kpi' },
  { pattern: '/kpi/targets', nav: 'kpiTargets', group: 'kpi' },
  { pattern: '/sdt/hrmd-dashboard', nav: 'hrmdDashboard', group: 'kpi' },

  { pattern: '/admin/users', nav: 'adminUsers', group: 'administration' },
  { pattern: '/admin/users/new', page: 'newUser', icon: 'adminUsers', parent: '/admin/users' },
  { pattern: '/admin/users/:id', page: 'editUser', icon: 'adminUsers', isDynamic: true, parent: '/admin/users' },
  { pattern: '/admin/approvals', nav: 'adminApprovals', group: 'administration' },
  { pattern: '/admin/approvals/:id', page: 'approvalRequest', icon: 'adminApprovals', parent: '/admin/approvals' },
  { pattern: '/admin/mission-postings', nav: 'adminMissionPostings', group: 'administration' },
  { pattern: '/admin/leadership', nav: 'adminLeadership', group: 'administration' },
  { pattern: '/admin/audit-log', nav: 'adminAuditLog', group: 'administration' },
  { pattern: '/admin/ministries', nav: 'adminMinistries', group: 'administration' },
]

export interface TrailCrumb {
  path: string
  definition: CrumbDefinition
  params: Record<string, string | undefined>
}

function findCrumb(pathname: string): TrailCrumb | null {
  // Literal patterns first, so '/alerts/new' is never mistaken for '/alerts/:id'.
  const ordered = [...CRUMB_DEFINITIONS].sort((first, second) => Number(first.pattern.includes(':')) - Number(second.pattern.includes(':')))
  for (const definition of ordered) {
    const match = matchPath({ path: definition.pattern, end: true }, pathname)
    if (match) {
      return { path: match.pathname, definition, params: match.params }
    }
  }
  return null
}

/** The crumbs from the top-level page down to `pathname` (the Home crumb is not included). */
export function resolveTrail(pathname: string): TrailCrumb[] {
  const trail: TrailCrumb[] = []
  let crumb = findCrumb(pathname.replace(/\/+$/, '') || '/')
  while (crumb && trail.length < 6) {
    trail.unshift(crumb)
    crumb = crumb.definition.parent ? findCrumb(crumb.definition.parent) : null
  }
  return trail
}
