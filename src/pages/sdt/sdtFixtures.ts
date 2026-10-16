import { vi } from 'vitest'
import type { Directive, DirectiveSummary } from '../../api/directives'
import type {
  DirectiveOverview,
  HqWorkspaceAlert,
  HqWorkspaceDirective,
  HqWorkspaceInquiry,
  HqWorkspaceOverview,
  HqWorkspacePage,
  HqWorkspaceReport,
} from '../../api/sdt'

/** Test fixtures for the SDT console pages (HQ workspace, directive overview). */

export function meFor(roleName: string, overrides: { id?: string; ministryName?: string } = {}) {
  return {
    user: {
      id: overrides.id ?? 'user-1',
      full_name: 'Carol Officer',
      email: 'carol.officer@tradewatch.go.ke',
      role_id: 'role-1',
      mission_id: null,
      ministry_id: 'ministry-trade',
      status: 'active' as const,
      language_preference: 'en' as const,
      email_notification_preferences: null,
      ministry: { id: 'ministry-trade', name: overrides.ministryName ?? 'State Department for Trade' },
    },
    role: { id: 'role-1', name: roleName, layer: '3' as const, scope: 'ministry' as const },
    permissions: [],
    isLoading: false,
    isAuthenticated: true,
    refetch: vi.fn(),
  }
}

export function workspaceOverview(overrides: Partial<HqWorkspaceOverview> = {}): HqWorkspaceOverview {
  return {
    department: { id: 'ministry-trade', name: 'State Department for Trade' },
    scope: 'portfolio',
    portfolio: {
      configured: true,
      missions: [{ id: 'mission-berlin', name: 'Berlin', city: 'Berlin', host_country: 'Germany', active: true }],
      countries: ['Ghana'],
      sectors: ['tea'],
      covers_missions: true,
    },
    counts: {
      alerts: { awaiting: 2, acknowledged: 5, feed: 9 },
      inquiries: { open: 3, resolved: 1, closed: 4, all: 8, high_value_open: 1 },
      directives: { attention: 2, awaiting_closure: 1, open: 4, all: 7, overdue: 1, stale: 0 },
      reports: { submitted: 6, latest_period: { label: 'Q1 2026', submitted: 2, late: 1 } },
    },
    filter_options: {
      missions: [
        { id: 'mission-accra', name: 'Accra', city: 'Accra', host_country: 'Ghana', active: true, in_portfolio: true },
        { id: 'mission-berlin', name: 'Berlin', city: 'Berlin', host_country: 'Germany', active: true, in_portfolio: true },
        { id: 'mission-london', name: 'London', city: 'London', host_country: 'United Kingdom', active: true, in_portfolio: false },
      ],
      periods: ['Q1 2026', 'Q4 2025'],
    },
    filters: { scope: null, mission_id: null },
    ...overrides,
  }
}

export function workspaceAlert(overrides: Partial<HqWorkspaceAlert> = {}): HqWorkspaceAlert {
  return {
    id: 'alert-1',
    reference_number: 'ALT-202610-00012',
    country: 'Germany',
    sector: 'coffee',
    product_category: null,
    intelligence_type: 'opportunities',
    urgency: 'high',
    status: 'assigned',
    excerpt: 'German roasters are looking for new specialty coffee suppliers.',
    mission: { id: 'mission-berlin', name: 'Berlin' },
    submitted_by: { id: 'attache-1', full_name: 'Amina Attache' },
    assigned_to: { id: 'user-1', full_name: 'Carol Officer' },
    assigned_to_me: true,
    feedback_count: 1,
    in_portfolio: true,
    created_at: '2026-10-14T09:00:00Z',
    actions: { acknowledge: true, feedback: true },
    ...overrides,
  }
}

export function workspaceInquiry(overrides: Partial<HqWorkspaceInquiry> = {}): HqWorkspaceInquiry {
  return {
    id: 'inquiry-1',
    reference_number: 'INQ-202610-00007',
    category: 'Buyer Seeking Supplier',
    sub_type: 'standard',
    status: 'in_progress',
    high_value_flag: true,
    inquirer_name: 'Hans Becker',
    inquirer_organisation: 'Becker Kaffee GmbH',
    product_or_sector: 'Coffee',
    excerpt: 'A roaster wants 40 tonnes of AA grade a year.',
    date_received: '2026-10-01T00:00:00.000000Z',
    days_since_received: 14,
    mission: { id: 'mission-berlin', name: 'Berlin' },
    logged_by: { id: 'attache-1', full_name: 'Amina Attache' },
    hq_notified: { at: '2026-10-13T08:00:00Z', by: { id: 'attache-1', full_name: 'Amina Attache' }, note: 'Large buyer, worth a call.' },
    in_portfolio: true,
    created_at: '2026-10-01T09:00:00Z',
    ...overrides,
  }
}

export function directiveRow(overrides: Partial<Directive> & Pick<Directive, 'id' | 'description'>): Directive {
  return {
    type_category: null,
    status: 'issued',
    target_completion_date: null,
    last_progress_update_at: '2026-10-10T09:00:00Z',
    mission: { id: 'mission-berlin', name: 'Berlin' },
    target_user: { id: 'attache-1', full_name: 'Amina Attache' },
    issued_by: { id: 'user-1', full_name: 'Carol Officer' },
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:00:00Z',
    is_overdue: false,
    is_stale: false,
    due_state: 'no_date',
    days_until_due: null,
    ...overrides,
  }
}

export function workspaceDirective(overrides: Partial<HqWorkspaceDirective> = {}): HqWorkspaceDirective {
  return {
    ...directiveRow({ id: 'directive-1', description: 'Compile the Q2 buyer-contact list for the Berlin food fair.' }),
    status: 'completed',
    due_state: 'completed',
    attention: ['awaiting_closure'],
    in_portfolio: true,
    allowed_actions: { transitions: ['closed'], add_note: true, revise: false },
    ...overrides,
  }
}

export function workspaceReport(overrides: Partial<HqWorkspaceReport> = {}): HqWorkspaceReport {
  return {
    id: 'report-1',
    reporting_period_label: 'Q1 2026',
    period_start_date: '2026-07-01',
    period_end_date: '2026-09-30',
    submitted_at: '2026-10-16T09:00:00Z',
    is_late: true,
    mission: { id: 'mission-berlin', name: 'Berlin', city: 'Berlin', host_country: 'Germany', active: true },
    authored_by: { id: 'attache-1', full_name: 'Amina Attache' },
    in_portfolio: true,
    ...overrides,
  }
}

export function workspacePage<T>(rows: T[], scope: 'portfolio' | 'department' = 'portfolio'): HqWorkspacePage<T> {
  return { data: rows, meta: { current_page: 1, per_page: 10, total: rows.length, last_page: 1, scope } }
}

export const directiveSummary: DirectiveSummary = {
  total: 15,
  completed: 3,
  closed: 1,
  in_progress: 4,
  issued: 5,
  acknowledged: 1,
  cancelled: 0,
  overdue: 2,
  approaching: 1,
  no_target_date: 6,
  on_track: 3,
  stale: 1,
  percentages: { completed: 20, in_progress: 26.7, overdue: 13.3, no_target_date: 40 },
  by_mission: [],
  by_issuer: [],
  filter_options: {
    missions: [
      { id: 'mission-berlin', name: 'Berlin' },
      { id: 'mission-london', name: 'London' },
    ],
    issuers: [{ id: 'user-1', full_name: 'Carol Officer' }],
  },
  filters: { date_from: null, date_to: null, mission_id: null, issued_by_user_id: null },
}

export function directiveOverview(overrides: Partial<DirectiveOverview> = {}): DirectiveOverview {
  return {
    summary: directiveSummary,
    attention: { open: 10, overdue: 2, approaching: 1, stale: 1, no_date: 6, awaiting_closure: 2 },
    missions: [
      {
        mission_id: 'mission-berlin',
        mission_name: 'Berlin',
        host_country: 'Germany',
        active: true,
        attache: { id: 'attache-1', full_name: 'Amina Attache' },
        total: 6,
        completed: 1,
        completion_rate: 16.7,
        open: 4,
        overdue: 2,
        approaching: 0,
        stale: 1,
        no_date: 1,
        awaiting_closure: 1,
        last_progress_at: '2026-10-10T09:00:00Z',
        health: 'attention',
      },
      {
        mission_id: 'mission-cairo',
        mission_name: 'Cairo',
        host_country: 'Egypt',
        active: true,
        attache: null,
        total: 0,
        completed: 0,
        completion_rate: 0,
        open: 0,
        overdue: 0,
        approaching: 0,
        stale: 0,
        no_date: 0,
        awaiting_closure: 0,
        last_progress_at: null,
        health: 'idle',
      },
    ],
    issuers: [
      { user_id: 'user-1', full_name: 'Carol Officer', total: 9, completion_rate: 22.2, open: 6, overdue: 2, approaching: 1, stale: 1, no_date: 3, awaiting_closure: 2 },
    ],
    my_follow_through: null,
    recent_activity: [
      {
        id: 'log-1',
        directive_id: 'directive-1',
        description: 'Compile the Q2 buyer-contact list for the Berlin food fair.',
        mission: { id: 'mission-berlin', name: 'Berlin' },
        from_status: 'in_progress',
        status: 'completed',
        at: '2026-10-14T09:00:00Z',
        by: { id: 'attache-1', full_name: 'Amina Attache' },
      },
    ],
    filters: { mission_id: null, issued_by_user_id: null },
    ...overrides,
  }
}
