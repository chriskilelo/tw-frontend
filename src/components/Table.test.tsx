import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table, type TableColumn } from './Table'

interface Row {
  id: string
  reference: string
}

const columns: TableColumn<Row>[] = [{ key: 'reference', header: 'Reference', render: (row) => row.reference }]

describe('Table', () => {
  it('renders a row per data item', () => {
    const data: Row[] = [
      { id: '1', reference: 'ALT-202608-00001' },
      { id: '2', reference: 'ALT-202608-00002' },
    ]
    render(<Table columns={columns} data={data} rowKey={(row) => row.id} />)
    expect(screen.getByText('ALT-202608-00001')).toBeInTheDocument()
    expect(screen.getByText('ALT-202608-00002')).toBeInTheDocument()
  })

  it('shows the empty message when there is no data', () => {
    render(<Table columns={columns} data={[]} rowKey={(row) => row.id} emptyMessage="No alerts found." />)
    expect(screen.getByText('No alerts found.')).toBeInTheDocument()
  })

  it('calls onRowClick with the clicked row', async () => {
    const onRowClick = vi.fn()
    const data: Row[] = [{ id: '1', reference: 'ALT-202608-00001' }]
    render(<Table columns={columns} data={data} rowKey={(row) => row.id} onRowClick={onRowClick} />)
    await userEvent.click(screen.getByText('ALT-202608-00001'))
    expect(onRowClick).toHaveBeenCalledWith(data[0])
  })

  it('bolds an identifier column in the signature navy, and applies the shared row-hover class', () => {
    const data: Row[] = [{ id: '1', reference: 'ALT-202608-00001' }]
    render(<Table columns={columns} data={data} rowKey={(row) => row.id} />)
    const cell = screen.getByText('ALT-202608-00001')
    expect(cell.className).toContain('font-bold')
    expect(cell.className).toContain('text-primary')
    expect(cell.closest('tr')?.className).toContain('tw-table-row')
  })

  it('does not apply identifier styling to a non-identifier column', () => {
    interface CountryRow {
      id: string
      country: string
    }
    const countryColumns: TableColumn<CountryRow>[] = [
      { key: 'country', header: 'Country', render: (row) => row.country },
    ]
    const data: CountryRow[] = [{ id: '1', country: 'Kenya' }]
    render(<Table columns={countryColumns} data={data} rowKey={(row) => row.id} />)
    const cell = screen.getByText('Kenya')
    expect(cell.className).not.toContain('font-bold')
    expect(cell.className).toContain('text-text-primary')
  })
})
