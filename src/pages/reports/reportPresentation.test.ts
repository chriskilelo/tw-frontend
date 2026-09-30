import { describe, expect, it } from 'vitest'
import {
  computeTotals,
  formatNumber,
  isTotalPlaceholder,
  narrativeCompletion,
  parseNumberInput,
  rowsFromSection,
  rowsPayload,
  tableCompletion,
  validateRows,
  wordCount,
  type EditableRow,
} from './reportPresentation'
import { aieSection, assetSection } from './reportTestUtils'

describe('reportPresentation', () => {
  it('TC-FR-RPT-010-A: parses numbers, dropping thousands separators and refusing anything else', () => {
    expect(parseNumberInput('1,250.50', false)).toEqual({ value: 1250.5, error: null })
    expect(parseNumberInput(' 12 000 ', true)).toEqual({ value: 12000, error: null })
    expect(parseNumberInput('-20', false)).toEqual({ value: -20, error: null })
    expect(parseNumberInput('', false)).toEqual({ value: null, error: null })
    expect(parseNumberInput('abc', false).error).toBe('number')
    expect(parseNumberInput('1.2.3', false).error).toBe('number')
    expect(parseNumberInput('2.5', true).error).toBe('integer')
    expect(parseNumberInput('1.23456', false).error).toBe('number')
  })

  it('TC-FR-RPT-010-B: formats numbers with the locale\'s thousands separators', () => {
    expect(formatNumber(1250000.5, 'en-GB')).toBe('1,250,000.5')
  })

  it('validates each cell against its column: numbers, option lists and length', () => {
    const columns = assetSection().column_schema ?? []
    const rows: EditableRow[] = [
      { id: 'a', values: { 'Item Number': 'x', Status: 'Lost', 'Item Description': 'ok' } },
      { id: 'b', values: { 'Item Number': '2', Status: 'Serviceable', Remarks: 'r'.repeat(2001) } },
    ]

    expect(validateRows(columns, rows)).toEqual([
      { rowIndex: 0, column: 'Item Number', code: 'number' },
      { rowIndex: 0, column: 'Status', code: 'option' },
      { rowIndex: 1, column: 'Remarks', code: 'tooLong' },
    ])
  })

  it('builds the save payload with numbers as numbers and blank cells left out', () => {
    const columns = aieSection().column_schema ?? []

    expect(rowsPayload(columns, [{ id: 'r1', values: { 'Budget Code': ' 2110300 ', 'Quarter Allocation': '1,200', 'Deficit/Surplus': '' } }])).toEqual([
      { id: 'r1', row_data: { 'Budget Code': '2110300', 'Quarter Allocation': 1200 } },
    ])
  })

  it('round-trips server rows into editable text', () => {
    expect(rowsFromSection(aieSection())[1]).toEqual({
      id: 'row-2',
      values: { 'Budget Code': '2210100', 'Head Description': 'Utilities', 'Quarter Allocation': '800.5' },
    })
  })

  it('TC-FR-RPT-009: totals the designated columns over the budget lines only', () => {
    const section = aieSection()
    const rows = [
      ...rowsFromSection(section),
      { id: 'total', values: { 'Budget Code': 'N/A', 'Head Description': 'TOTAL (auto-calculated row)', 'Quarter Allocation': '99999' } },
    ]

    expect(isTotalPlaceholder(section.table, rows[3].values)).toBe(true)
    expect(computeTotals(section.table, section.column_schema ?? [], rows)).toEqual({ 'Quarter Allocation': 2000.5, 'Deficit/Surplus': 0 })
    expect(computeTotals(null, section.column_schema ?? [], rows)).toBeNull()
  })

  it('TC-FR-RPT-013: marks sections empty, started or complete like the API does', () => {
    const assets = assetSection()
    const columns = assets.column_schema ?? []

    expect(narrativeCompletion('   ')).toBe('empty')
    expect(narrativeCompletion('Written')).toBe('complete')
    expect(tableCompletion(columns, assets.table, [])).toBe('empty')
    expect(tableCompletion(columns, assets.table, [{ id: 'a', values: { 'Item Number': '1' } }])).toBe('started')
    expect(tableCompletion(columns, assets.table, [{ id: 'a', values: { 'Item Number': '1', 'Item Description': 'Laptop', Status: 'Serviceable' } }])).toBe('complete')

    const aie = aieSection()
    const labelsOnly = rowsFromSection(aie).map((row) => ({ ...row, values: { 'Budget Code': row.values['Budget Code'], 'Head Description': row.values['Head Description'] } }))
    expect(tableCompletion(aie.column_schema ?? [], aie.table, labelsOnly)).toBe('empty')
  })

  it('counts the words in formatted text', () => {
    expect(wordCount('**Two** words\n- and a list')).toBe(5)
  })
})
