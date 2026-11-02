import type { ReactNode } from 'react'
import { Card } from './Card'

export type Column<T> = {
  /** Stable identifier, also used as the React key for header and cells. */
  id: string
  header: ReactNode
  render: (row: T) => ReactNode
  className?: string
}

type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Rendered inside the card, above the table — a header, search or filter. */
  header?: ReactNode
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
}

/**
 * Table inside a card. Columns describe their own cells, which keeps the
 * markup (card → scroll wrapper → table) in one place instead of repeated on
 * every page that shows a list.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  header,
  onRowClick,
  emptyMessage = 'Sin resultados',
  className = '',
}: DataTableProps<T>) {
  return (
    <Card className={`table-card ${className}`.trim()}>
      {header}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} onClick={onRowClick && (() => onRowClick(row))}>
                {columns.map((column) => (
                  <td key={column.id} className={column.className}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty-table">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
