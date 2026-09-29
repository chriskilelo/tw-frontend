import { describe, expect, it } from 'vitest'
import { fiscalQuarterLabel, greetingPart, percentOf, periodRange, periodTick, recentKpiCycles, recentQuarters } from './dashboardFormat'

/** CLAUDE.md Section 8: Q1 Jul-Sep .. Q4 Apr-Jun, labelled by the quarter's own start year. */
describe('dashboardFormat', () => {
  it('labels fiscal quarters the way ReportService::periodLabelFor() does', () => {
    expect(fiscalQuarterLabel('2026-07-01')).toBe('Q1 2026')
    expect(fiscalQuarterLabel('2026-10-01')).toBe('Q2 2026')
    expect(fiscalQuarterLabel('2026-01-01')).toBe('Q3 2026')
    expect(fiscalQuarterLabel('2026-04-01')).toBe('Q4 2026')
  })

  it('lists the recent quarters oldest first, ending with the one in progress', () => {
    const quarters = recentQuarters(3, new Date('2026-09-29T10:00:00'))

    expect(quarters).toEqual([
      { label: 'Q3 2026', start: '2026-01-01', end: '2026-03-31' },
      { label: 'Q4 2026', start: '2026-04-01', end: '2026-06-30' },
      { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30' },
    ])
  })

  it('lists half-yearly KPI cycles newest first, matching the backend labels', () => {
    expect(recentKpiCycles(3, new Date('2026-09-29T10:00:00')).map((cycle) => cycle.label)).toEqual(['H1 2026', 'H2 2026', 'H1 2025'])
    expect(recentKpiCycles(2, new Date('2026-02-10T10:00:00')).map((cycle) => cycle.label)).toEqual(['H2 2026', 'H1 2025'])
  })

  it('names periods by their months so an axis reads in order', () => {
    const quarter = { label: 'Q1 2026', start: '2026-07-01', end: '2026-09-30' }

    expect(periodTick(quarter, 'en-GB')).toMatch(/^Jul–Sep/)
    expect(periodTick(quarter, 'en-GB')).toContain('’26')
    expect(periodRange({ label: 'H1 2025', start: '2025-07-01', end: '2025-12-31' }, 'en-GB')).toBe('Jul – Dec 2025')
    expect(periodRange({ label: 'X', start: '2025-11-01', end: '2026-04-30' }, 'en-GB')).toBe('Nov 2025 – Apr 2026')
  })

  it('greets by time of day and rounds shares safely', () => {
    expect(greetingPart(new Date('2026-09-29T08:00:00'))).toBe('morning')
    expect(greetingPart(new Date('2026-09-29T13:00:00'))).toBe('afternoon')
    expect(greetingPart(new Date('2026-09-29T19:00:00'))).toBe('evening')
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(5, 0)).toBe(0)
  })
})
