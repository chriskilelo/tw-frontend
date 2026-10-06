import type {
  GovernancePeriodSummary,
  GovernanceTrendPoint,
  MfaAwarenessSummary,
  MissionActivityItem,
  MissionActivitySummary,
  MissionDrillDown,
  NationalOverview,
  SubmissionLogEntry,
} from '../../api/governance'

/**
 * Typed fixtures for the governance page tests, shaped like App\Services\GovernanceService's
 * responses. London has two departments (Trade with an attache posted, Agriculture likewise);
 * the current quarter is Q2 2026 (October to December 2026).
 */

export const TRADE = { id: '0198f5a2-0000-7000-8000-00000000000a', name: 'State Department for Trade' }
export const AGRICULTURE = { id: '0198f5a2-0000-7000-8000-00000000000b', name: 'State Department for Agriculture' }
export const LONDON_ID = '0198f5a2-0000-7000-8000-0000000000a1'
export const BERLIN_ID = '0198f5a2-0000-7000-8000-0000000000b1'

const QUARTERS: Omit<GovernanceTrendPoint, 'total' | 'by_type'>[] = [
  { label: 'Q1 2025', start: '2025-07-01', end: '2025-09-30', is_partial: false },
  { label: 'Q2 2025', start: '2025-10-01', end: '2025-12-31', is_partial: false },
  { label: 'Q3 2026', start: '2026-01-01', end: '2026-03-31', is_partial: false },
  { label: 'Q4 2026', start: '2026-04-01', end: '2026-06-30', is_partial: false },
  { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', is_partial: false },
  { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', is_partial: true },
]

export function trend(totals: number[] = [1, 2, 0, 3, 5, 4]): GovernanceTrendPoint[] {
  return QUARTERS.slice(QUARTERS.length - totals.length).map((quarter, index) => ({
    ...quarter,
    total: totals[index],
    by_type: { alert: totals[index], inquiry: 0, periodic_report: 0 },
  }))
}

export function period(overrides: Partial<GovernancePeriodSummary> = {}): GovernancePeriodSummary {
  return {
    label: 'Q2 2026',
    start: '2026-10-01',
    end: '2026-12-31',
    is_partial: true,
    total: 4,
    by_type: { alert: 2, inquiry: 1, periodic_report: 1 },
    by_status: { alert: { new: 1, acknowledged: 1 }, inquiry: { in_progress: 1 }, periodic_report: { submitted_on_time: 1 } },
    ...overrides,
  }
}

export function missionSummary(overrides: Partial<MissionActivitySummary> = {}): MissionActivitySummary {
  return {
    mission: { id: LONDON_ID, name: 'London', city: 'London', host_country: 'United Kingdom', active: true },
    ministry_id: null,
    departments: [
      { ...AGRICULTURE, active: true, posted: true, attache: { full_name: 'Joseph Kamau' }, has_activity: true },
      { ...TRADE, active: true, posted: true, attache: { full_name: 'Purity Samanthe' }, has_activity: true },
    ],
    current_period: period(),
    prior_period: period({
      label: 'Q1 2026',
      start: '2026-07-01',
      end: '2026-09-30',
      is_partial: false,
      total: 3,
      by_type: { alert: 1, inquiry: 1, periodic_report: 1 },
      by_status: { alert: { acknowledged: 1 }, inquiry: { closed: 1 }, periodic_report: { submitted_late: 1 } },
    }),
    trend: trend(),
    last_activity_at: '2026-10-12T11:00:00Z',
    ...overrides,
  }
}

export const FEED: MissionActivityItem[] = [
  {
    type: 'inquiry',
    id: 'inquiry-1',
    reference: 'INQ-202610-00007',
    status: 'received',
    date: '2026-10-12T11:00:00Z',
    ministry: TRADE,
    submitting_officer: 'Purity Samanthe',
    summary: { category: 'Buyer Seeking Supplier', sub_type: 'standard', inquirer_organisation: 'Acme Imports', product_or_sector: 'Tea', high_value: true, excerpt: 'Wants 40 tonnes of purple tea.' },
    link: '/inquiries/inquiry-1',
  },
  {
    type: 'alert',
    id: 'alert-1',
    reference: 'ALT-202610-00003',
    status: 'new',
    date: '2026-10-05T09:00:00Z',
    ministry: AGRICULTURE,
    submitting_officer: 'Joseph Kamau',
    summary: { country: 'United Kingdom', intelligence_type: 'trade_barriers', sector: 'Horticulture', product_category: null, urgency: 'high', excerpt: 'New phytosanitary checks on cut flowers.' },
    link: '/alerts/alert-1',
  },
  {
    type: 'periodic_report',
    id: 'report-1',
    reference: 'Q4 2026',
    status: 'submitted_late',
    date: '2026-07-20T08:00:00Z',
    ministry: TRADE,
    submitting_officer: 'Purity Samanthe',
    summary: { period_label: 'Q4 2026', period_start: '2026-04-01', period_end: '2026-06-30', is_late: true },
    link: '/reports/report-1',
  },
]

export function feedEnvelope(items: MissionActivityItem[] = FEED, total = items.length) {
  return { data: items, meta: { current_page: 1, per_page: 10, total, last_page: Math.max(1, Math.ceil(total / 10)) } }
}

export function mfaSummary(overrides: Partial<MfaAwarenessSummary> = {}): MfaAwarenessSummary {
  return {
    scope: { ministry_id: null, period: null },
    current_quarter: { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', is_partial: true },
    ministries: [AGRICULTURE, TRADE],
    total: 7,
    by_type: { alert: 3, inquiry: 2, periodic_report: 2 },
    by_mission: [
      { mission_id: LONDON_ID, mission_name: 'London', city: 'London', host_country: 'United Kingdom', active: true, total: 4, by_type: { alert: 2, inquiry: 1, periodic_report: 1 }, last_activity_at: '2026-10-12T11:00:00Z' },
      { mission_id: BERLIN_ID, mission_name: 'Berlin', city: 'Berlin', host_country: 'Germany', active: true, total: 3, by_type: { alert: 1, inquiry: 1, periodic_report: 1 }, last_activity_at: '2026-10-06T09:00:00Z' },
    ],
    by_ministry: [
      { ministry_id: TRADE.id, ministry_name: TRADE.name, total: 5, by_type: { alert: 2, inquiry: 2, periodic_report: 1 }, missions_reporting: 2 },
      { ministry_id: AGRICULTURE.id, ministry_name: AGRICULTURE.name, total: 2, by_type: { alert: 1, inquiry: 0, periodic_report: 1 }, missions_reporting: 1 },
    ],
    by_period: trend([0, 0, 1, 0, 2, 4]),
    ...overrides,
  }
}

export const LOG: SubmissionLogEntry[] = [
  { type: 'inquiry', date: '2026-10-12T11:00:00Z', mission: { id: LONDON_ID, name: 'London' }, ministry: TRADE },
  { type: 'alert', date: '2026-10-06T09:00:00Z', mission: { id: BERLIN_ID, name: 'Berlin' }, ministry: TRADE },
]

export function drillDown(overrides: Partial<MissionDrillDown> = {}): MissionDrillDown {
  const summary = missionSummary()
  return {
    ...summary,
    departments: summary.departments.map((department) => ({ ...department, attache: null })),
    recent: [LOG[0]],
    ...overrides,
  }
}

export function nationalOverview(overrides: Partial<NationalOverview> = {}): NationalOverview {
  return {
    period: { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', is_partial: true },
    comparison_period: { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', is_partial: false },
    ministries: [AGRICULTURE, TRADE],
    totals: { current: { total: 4, by_type: { alert: 2, inquiry: 1, periodic_report: 1 } }, prior: { total: 2, by_type: { alert: 1, inquiry: 0, periodic_report: 1 } } },
    missions: [
      {
        mission_id: BERLIN_ID,
        mission_name: 'Berlin',
        host_country: 'Germany',
        active: true,
        current: { total: 1, by_type: { alert: 1, inquiry: 0, periodic_report: 0 }, by_ministry: { [AGRICULTURE.id]: 0, [TRADE.id]: 1 } },
        prior: { total: 1, by_type: { alert: 0, inquiry: 0, periodic_report: 1 } },
      },
      {
        mission_id: LONDON_ID,
        mission_name: 'London',
        host_country: 'United Kingdom',
        active: true,
        current: { total: 3, by_type: { alert: 1, inquiry: 1, periodic_report: 1 }, by_ministry: { [AGRICULTURE.id]: 1, [TRADE.id]: 2 } },
        prior: { total: 1, by_type: { alert: 1, inquiry: 0, periodic_report: 0 } },
      },
    ],
    departments: [
      { ministry_id: AGRICULTURE.id, ministry_name: AGRICULTURE.name, current: { total: 1, by_type: { alert: 0, inquiry: 0, periodic_report: 1 }, missions_reporting: 1 }, prior: { total: 1, by_type: { alert: 1, inquiry: 0, periodic_report: 0 } } },
      { ministry_id: TRADE.id, ministry_name: TRADE.name, current: { total: 3, by_type: { alert: 2, inquiry: 1, periodic_report: 0 }, missions_reporting: 2 }, prior: { total: 1, by_type: { alert: 0, inquiry: 0, periodic_report: 1 } } },
    ],
    ...overrides,
  }
}
