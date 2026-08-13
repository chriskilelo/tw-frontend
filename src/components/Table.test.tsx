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
})
