import type {
  ComparisonKpiColumn,
  ComparisonKpiRow,
  ComparisonMissionRow,
  DashboardKpiRow,
  KpiActualEntry,
  KpiComparisonMatrix,
  KpiDashboard,
  KpiPeriodInfo,
  KpiPeriodOptions,
  KpiStatusSummary,
  KpiTargetCell,
  KpiTargetPlan,
  PerformanceStatus,
} from '../../api/kpi'

/** Shared fixtures for the KPI page tests: 2 November 2026, H1 2026 half settled. */

export const PERIOD_H1_2026: KpiPeriodInfo = {
  type: 'half',
  label: 'H1 2026',
  start: '2026-07-01',
  end: '2026-12-31',
  phase: 'in_progress',
  progress: 0.5,
  is_final: false,
  completed_quarters: 1,
  settled_quarters: 1,
  quarter_count: 2,
  quarters: [
    { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', phase: 'complete', settled: true },
    { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', deadline: '2027-01-15', phase: 'in_progress', settled: false },
  ],
}

export const PERIOD_H2_2026_FINAL: KpiPeriodInfo = {
  type: 'half',
  label: 'H2 2026',
  start: '2026-01-01',
  end: '2026-06-30',
  phase: 'complete',
  progress: 1,
  is_final: true,
  completed_quarters: 2,
  settled_quarters: 2,
  quarter_count: 2,
  quarters: [
    { label: 'Q3 2026', start: '2026-01-01', end: '2026-03-31', deadline: '2026-04-15', phase: 'complete', settled: true },
    { label: 'Q4 2026', start: '2026-04-01', end: '2026-06-30', deadline: '2026-07-15', phase: 'complete', settled: true },
  ],
}

export const PERIOD_OPTIONS: KpiPeriodOptions = {
  default: 'H1 2026',
  quarters: [
    { label: 'Q2 2026', type: 'quarter', start: '2026-10-01', end: '2026-12-31', phase: 'in_progress' },
    { label: 'Q1 2026', type: 'quarter', start: '2026-07-01', end: '2026-09-30', phase: 'complete' },
    { label: 'Q4 2026', type: 'quarter', start: '2026-04-01', end: '2026-06-30', phase: 'complete' },
  ],
  halves: [
    { label: 'H1 2026', type: 'half', start: '2026-07-01', end: '2026-12-31', phase: 'in_progress' },
    { label: 'H2 2026', type: 'half', start: '2026-01-01', end: '2026-06-30', phase: 'complete' },
  ],
  range: { max_quarters: 12, latest_end: '2026-12-31' },
}

export function counts(overrides: Partial<Record<PerformanceStatus, number>> = {}): Record<PerformanceStatus, number> {
  return { on_track: 0, at_risk: 0, below_target: 0, pending: 0, no_data: 0, no_target: 0, ...overrides }
}

export function summary(overrides: Partial<Record<PerformanceStatus, number>>, score: number | null = 0.8): KpiStatusSummary {
  const values = counts(overrides)
  const total = Object.values(values).reduce((sum, value) => sum + value, 0)
  return { counts: values, total, judged: values.on_track + values.at_risk + values.below_target, score }
}

export function kpiRow(overrides: Partial<DashboardKpiRow> = {}): DashboardKpiRow {
  const id = overrides.kpi_definition_id ?? overrides.id ?? 'kpi-1'
  return {
    id,
    kpi_definition_id: id,
    name: 'Agreements signed',
    description: null,
    unit: null,
    calculation_method: 'manual',
    data_source: null,
    source: 'recorded',
    applicable: true,
    target: 10,
    actual: 6,
    expected: 5,
    attainment: 0.6,
    variance: -4,
    performance: 1.2,
    status: 'on_track',
    target_source: 'mission',
    quarters_reported: 1,
    quarters: [
      { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', actual: 6, target: 5 },
      { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', actual: null, target: 5 },
    ],
    previous: { target: 8, actual: 4, status: 'below_target', attainment: 0.5 },
    previous_actual: 4,
    change: 2,
    change_pct: 0.5,
    trend: [
      { label: 'Q4 2026', start: '2026-04-01', end: '2026-06-30', actual: 2, target: 4 },
      { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', actual: 6, target: 5 },
      { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', actual: null, target: 5 },
    ],
    ...overrides,
  }
}

export function missionDashboard(overrides: Partial<KpiDashboard> = {}): KpiDashboard {
  return {
    scope: 'mission',
    period: PERIOD_H1_2026,
    previous_period: { label: 'H2 2026', type: 'half', start: '2026-01-01', end: '2026-06-30', phase: 'complete' },
    thresholds: { on_track: 1, at_risk: 0.75 },
    mission: { id: 'mission-london', name: 'London', city: 'London', host_country: 'United Kingdom', attache: { id: 'user-a', full_name: 'Purity Samanthe' }, profiles: [] },
    summary: summary({ on_track: 1, below_target: 1 }),
    kpis: [
      kpiRow(),
      kpiRow({
        kpi_definition_id: 'kpi-2',
        id: 'kpi-2',
        name: 'Alerts submitted',
        source: 'live',
        calculation_method: 'auto',
        data_source: 'alerts.count_submitted',
        actual: 1,
        target: 8,
        expected: 4,
        attainment: 0.125,
        performance: 0.25,
        variance: -7,
        status: 'below_target',
        change: -1,
        change_pct: -0.5,
        previous_actual: 2,
      }),
    ],
    compliance: [
      { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30', deadline: '2026-10-15', status: 'submitted_on_time', is_overdue: false, submitted_at: '2026-10-10T09:00:00Z', report_id: 'report-q1' },
      { label: 'Q2 2026', start: '2026-10-01', end: '2026-12-31', deadline: '2027-01-15', status: 'not_due', is_overdue: false, submitted_at: null, report_id: null },
    ],
    options: PERIOD_OPTIONS,
    missions_available: [
      { id: 'mission-london', name: 'London', city: 'London', host_country: 'United Kingdom' },
      { id: 'mission-dubai', name: 'Dubai', city: 'Dubai', host_country: 'United Arab Emirates' },
    ],
    can: { choose_mission: true, set_targets: true, compare: true, download_report: true, record_actuals: false },
    ...overrides,
  }
}

export function departmentDashboard(overrides: Partial<KpiDashboard> = {}): KpiDashboard {
  return missionDashboard({
    scope: 'ministry',
    mission: null,
    compliance: null,
    kpis: [
      kpiRow({
        target: 20,
        actual: 14,
        expected: 10,
        status: 'on_track',
        actual_all: 15,
        missions_applicable: 2,
        missions_with_target: 2,
        distribution: counts({ on_track: 1, below_target: 1 }),
      }),
    ],
    missions: [
      { mission_id: 'mission-dubai', mission_name: 'Dubai', city: 'Dubai', host_country: 'United Arab Emirates', ...summary({ below_target: 1 }, 0.4) },
      { mission_id: 'mission-london', mission_name: 'London', city: 'London', host_country: 'United Kingdom', ...summary({ on_track: 1 }, 1) },
    ],
    ...overrides,
  })
}

function cell(kpiId: string, name: string, overrides: Partial<ComparisonKpiRow> = {}): ComparisonKpiRow {
  return {
    kpi_definition_id: kpiId,
    name,
    applicable: true,
    target: 10,
    actual: 5,
    expected: 5,
    attainment: 0.5,
    variance: -5,
    performance: 1,
    status: 'on_track',
    target_source: 'mission',
    quarters_reported: 1,
    quarters: [],
    previous_actual: 3,
    change: 2,
    change_pct: 0.67,
    previous_status: 'at_risk',
    ...overrides,
  }
}

function column(id: string, name: string): ComparisonKpiColumn {
  return {
    id,
    name,
    description: null,
    unit: null,
    calculation_method: 'manual',
    data_source: null,
    source: 'recorded',
    total: {
      target: 30,
      actual: 15,
      expected: 15,
      attainment: 0.5,
      variance: -15,
      performance: 1,
      status: 'on_track',
      target_source: null,
      quarters_reported: 1,
      quarters: [],
      actual_all: 15,
      missions_applicable: 3,
      missions_with_target: 3,
      distribution: counts({ on_track: 2, below_target: 1 }),
      previous_actual: 10,
    },
  }
}

function missionRow(id: string, name: string, country: string, score: number | null, kpis: ComparisonKpiRow[]): ComparisonMissionRow {
  return { mission_id: id, mission_name: name, city: name, host_country: country, profiles: [], summary: { ...summary({ on_track: 1, below_target: 1 }, score) }, kpis }
}

export function comparisonMatrix(overrides: Partial<KpiComparisonMatrix> = {}): KpiComparisonMatrix {
  return {
    cycle_label: 'H1 2026',
    period: PERIOD_H1_2026,
    previous_period: { label: 'H2 2026', type: 'half', start: '2026-01-01', end: '2026-06-30', phase: 'complete' },
    thresholds: { on_track: 1, at_risk: 0.75 },
    kpis: [column('kpi-agreements', 'Agreements signed'), column('kpi-briefs', 'Trade briefs')],
    missions: [
      missionRow('mission-accra', 'Accra', 'Ghana', 0.9, [
        cell('kpi-agreements', 'Agreements signed', { actual: 9, attainment: 0.9, performance: 1.8 }),
        cell('kpi-briefs', 'Trade briefs', { actual: 1, attainment: 0.1, performance: 0.2, status: 'below_target' }),
      ]),
      missionRow('mission-berlin', 'Berlin', 'Germany', 0.5, [
        cell('kpi-agreements', 'Agreements signed', { actual: 2, attainment: 0.2, performance: 0.4, status: 'below_target' }),
        cell('kpi-briefs', 'Trade briefs', { actual: 6, attainment: 0.6, performance: 1.2 }),
      ]),
      missionRow('mission-cairo', 'Cairo', 'Egypt', null, [
        cell('kpi-agreements', 'Agreements signed', { actual: 4, attainment: 0.4, performance: 0.8, status: 'at_risk' }),
        cell('kpi-briefs', 'Trade briefs', { applicable: false, target: null, actual: null, attainment: null, performance: null, status: 'no_target' }),
      ]),
    ],
    summary: summary({ on_track: 2, at_risk: 1, below_target: 2 }),
    options: PERIOD_OPTIONS,
    can: { set_targets: true, download_report: true },
    ...overrides,
  }
}

export function targetCell(overrides: Partial<KpiTargetCell> = {}): KpiTargetCell {
  return {
    applicable: true,
    value: null,
    source: null,
    override: null,
    profile_default: null,
    previous: { target: 4, actual: 5, status: 'on_track' },
    ...overrides,
  }
}

export function targetPlan(overrides: Partial<KpiTargetPlan> = {}): KpiTargetPlan {
  return {
    cycle: { label: 'H1 2026', type: 'half', start: '2026-07-01', end: '2026-12-31', phase: 'in_progress', editable: true, reason: null },
    previous_cycle: { label: 'H2 2026', type: 'half', start: '2026-01-01', end: '2026-06-30', phase: 'complete' },
    cycles: [
      { label: 'H2 2026', type: 'half', start: '2026-01-01', end: '2026-06-30', phase: 'complete', editable: false, reason: 'ended' },
      { label: 'H1 2026', type: 'half', start: '2026-07-01', end: '2026-12-31', phase: 'in_progress', editable: true, reason: null },
      { label: 'H2 2027', type: 'half', start: '2027-01-01', end: '2027-06-30', phase: 'upcoming', editable: true, reason: null },
    ],
    thresholds: { on_track: 1, at_risk: 0.75 },
    kpis: [
      { id: 'kpi-agreements', name: 'Agreements signed', description: 'Bilateral and commercial agreements', unit: null, calculation_method: 'manual', data_source: null, source: 'recorded' },
      { id: 'kpi-alerts', name: 'Alerts submitted', description: null, unit: null, calculation_method: 'auto', data_source: 'alerts.count_submitted', source: 'live' },
    ],
    profiles: [],
    missions: [
      {
        id: 'mission-london',
        name: 'London',
        city: 'London',
        host_country: 'United Kingdom',
        attache: { id: 'user-a', full_name: 'Purity Samanthe' },
        profiles: [],
        missing: 1,
        targets: {
          'kpi-agreements': targetCell({ value: 6, source: 'mission', override: { value: 6, note: null, set_by: { id: 'u-d', full_name: 'Director One' }, set_at: '2026-07-02T08:00:00Z', versions: 2 } }),
          'kpi-alerts': targetCell({ previous: { target: 10, actual: 12, status: 'on_track' } }),
        },
      },
      {
        id: 'mission-dubai',
        name: 'Dubai',
        city: 'Dubai',
        host_country: 'United Arab Emirates',
        attache: null,
        profiles: [],
        missing: 2,
        targets: {
          'kpi-agreements': targetCell({ previous: { target: null, actual: 1, status: 'no_target' } }),
          'kpi-alerts': targetCell(),
        },
      },
    ],
    summary: { required: 4, set: 1, missing: 3, overrides: 1, from_profile: 0, missions_complete: 0 },
    can: { set_targets: true },
    ...overrides,
  }
}

export function actualEntry(overrides: Partial<KpiActualEntry> = {}): KpiActualEntry {
  return {
    quarter: { label: 'Q1 2026', type: 'quarter', start: '2026-07-01', end: '2026-09-30', phase: 'complete' },
    quarters: [
      { label: 'Q2 2026', type: 'quarter', start: '2026-10-01', end: '2026-12-31', phase: 'in_progress' },
      { label: 'Q1 2026', type: 'quarter', start: '2026-07-01', end: '2026-09-30', phase: 'complete' },
    ],
    mission: { id: 'mission-london', name: 'London', city: 'London', host_country: 'United Kingdom' },
    kpis: [
      { id: 'kpi-agreements', name: 'Agreements signed', description: null, unit: null, calculation_method: 'manual', data_source: null, source: 'recorded', recordable: true, value: 2, quarter_target: 3, entered_by: { id: 'u-1', full_name: 'Officer One' }, updated_at: '2026-10-05T10:00:00Z' },
      { id: 'kpi-briefs', name: 'Trade briefs', description: null, unit: null, calculation_method: 'manual', data_source: null, source: 'recorded', recordable: true, value: null, quarter_target: null, entered_by: null, updated_at: null },
      { id: 'kpi-alerts', name: 'Alerts submitted', description: null, unit: null, calculation_method: 'auto', data_source: 'alerts.count_submitted', source: 'live', recordable: false, value: 7, quarter_target: 4, entered_by: null, updated_at: null },
    ],
    missions_available: [{ id: 'mission-london', name: 'London', city: 'London', host_country: 'United Kingdom' }],
    ...overrides,
  }
}
