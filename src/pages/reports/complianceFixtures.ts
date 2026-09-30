import type { ComplianceDashboard, ComplianceMissionRow } from '../../api/reports'

/** A compliance board with one mission in each FR-RPT-018 state, for the board page tests. */
function mission(overrides: Partial<ComplianceMissionRow> & Pick<ComplianceMissionRow, 'mission_id' | 'mission_name' | 'status'>): ComplianceMissionRow {
  return {
    mission_city: overrides.mission_name,
    host_country: null,
    attache: { id: `attache-${overrides.mission_id}`, full_name: `${overrides.mission_name} Attache` },
    report_id: null,
    submitted_at: null,
    is_late: false,
    is_overdue: false,
    days_overdue: null,
    progress: null,
    last_activity_at: null,
    ...overrides,
  }
}

export const COMPLIANCE_BOARD: ComplianceDashboard = {
  period_label: 'Q1 2026',
  period: { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', phase: 'open', days_to_deadline: 10 },
  missions: [
    mission({ mission_id: 'm-accra', mission_name: 'Accra', host_country: 'Ghana', status: 'submitted_late', report_id: 'report-accra', submitted_at: '2026-10-18T09:00:00Z', is_late: true, days_overdue: 3 }),
    mission({ mission_id: 'm-berlin', mission_name: 'Berlin', host_country: 'Germany', status: 'submitted_on_time', report_id: 'report-berlin', submitted_at: '2026-10-02T09:00:00Z' }),
    mission({
      mission_id: 'm-london',
      mission_name: 'London',
      status: 'draft_in_progress',
      progress: { total: 12, complete: 7, started: 2, empty: 3 },
      last_activity_at: '2026-09-30T09:00:00Z',
    }),
    mission({ mission_id: 'm-lusaka', mission_name: 'Lusaka', status: 'not_started', attache: null, is_overdue: true, days_overdue: 2 }),
  ],
  summary: { submitted_on_time: 1, submitted_late: 1, draft_in_progress: 1, not_started: 1, not_yet_submitted: 2, overdue: 1, vacant: 1, total: 4 },
  available_periods: [
    { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', deadline: '2027-01-15', phase: 'in_progress', days_to_deadline: 102 },
    { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', phase: 'open', days_to_deadline: 10 },
    { label: 'Q4 2026', start: '2026-04-01', end: '2026-06-30', deadline: '2026-07-15', phase: 'closed', days_to_deadline: -82 },
  ],
  history: {
    periods: [
      { label: 'Q4 2026', start: '2026-04-01', end: '2026-06-30', deadline: '2026-07-15', phase: 'closed', days_to_deadline: -82 },
      { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', phase: 'open', days_to_deadline: 10 },
    ],
    missions: [
      {
        mission_id: 'm-berlin',
        mission_name: 'Berlin',
        cells: [
          { label: 'Q4 2026', status: 'submitted_late', is_overdue: false, report_id: 'report-berlin-q4' },
          { label: 'Q1 2026', status: 'submitted_on_time', is_overdue: false, report_id: 'report-berlin' },
        ],
      },
      {
        mission_id: 'm-lusaka',
        mission_name: 'Lusaka',
        cells: [
          { label: 'Q4 2026', status: 'not_started', is_overdue: true, report_id: null },
          { label: 'Q1 2026', status: 'not_started', is_overdue: false, report_id: null },
        ],
      },
    ],
    totals: [
      { label: 'Q4 2026', submitted_on_time: 0, submitted_late: 1, draft_in_progress: 0, not_started: 1 },
      { label: 'Q1 2026', submitted_on_time: 1, submitted_late: 0, draft_in_progress: 0, not_started: 1 },
    ],
  },
}
