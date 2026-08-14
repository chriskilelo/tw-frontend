import type { ReactNode } from 'react'

export interface TableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  onRowClick?: (row: T) => void
  className?: string
  getRowTestId?: (row: T) => string
  getRowClassName?: (row: T) => string | undefined
}

export function Table<T>({
  columns,
  data,
  rowKey,
  emptyMessage = 'No results found.',
  onRowClick,
  className = '',
  getRowTestId,
  getRowClassName,
}: TableProps<T>) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-body text-text-muted">{emptyMessage}</p>
  }

  return (
    <div className={`overflow-x-auto rounded border border-border ${className}`}>
      <table className="min-w-full divide-y divide-border text-body-sm">
        <thead className="bg-section-bg">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-2 text-left font-semibold text-text-secondary ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              data-testid={getRowTestId?.(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={[onRowClick ? 'cursor-pointer hover:bg-section-bg' : '', getRowClassName?.(row) ?? '']
                .filter(Boolean)
                .join(' ') || undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-2 text-text-primary ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
