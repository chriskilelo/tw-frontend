import { useId, useState, type ReactNode } from 'react'
import { ChartBarIcon, TableCellsIcon } from '@heroicons/react/20/solid'
import { useI18n } from '../../i18n/context'

export interface DataTableColumn {
  key: string
  label: string
  numeric?: boolean
}

export interface DataTableSpec {
  caption: string
  columns: DataTableColumn[]
  rows: Record<string, ReactNode>[]
}

export type IconTone = 'info' | 'directive' | 'success' | 'accent' | 'danger' | 'atrisk' | 'neutral' | 'primary'

const TONE_CLASSES: Record<IconTone, string> = {
  info: 'bg-info-soft text-info-soft-text',
  directive: 'bg-directive-soft text-directive-soft-text',
  success: 'bg-success-soft text-success-soft-text',
  accent: 'bg-accent-soft text-accent-soft-text',
  danger: 'bg-danger-soft text-danger-soft-text',
  atrisk: 'bg-atrisk-soft text-atrisk-soft-text',
  neutral: 'bg-section-bg text-text-secondary',
  primary: 'bg-primary text-white',
}

export function IconChip({ icon, tone = 'neutral', size = 'md' }: { icon: ReactNode; tone?: IconTone; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-lg ${size === 'sm' ? 'size-7 [&>svg]:size-4' : 'size-9 [&>svg]:size-5'} ${TONE_CLASSES[tone]}`}
    >
      {icon}
    </span>
  )
}

interface DashboardCardProps {
  title: string
  icon: ReactNode
  tone?: IconTone
  /** One plain sentence stating what the chart shows — the takeaway for every reader. */
  subtitle?: ReactNode
  action?: ReactNode
  /** When given, a toggle swaps the visual for an accessible data table (WCAG 1.1.1, 1.3.1). */
  table?: DataTableSpec
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * The shell every dashboard panel shares: icon, title, a one-sentence takeaway, an optional
 * action, and — for anything drawn as a chart — a "table view" switch so the same numbers
 * are always available as text.
 */
export function DashboardCard({ title, icon, tone = 'neutral', subtitle, action, table, className = '', bodyClassName = '', children }: DashboardCardProps) {
  const { t } = useI18n()
  const headingId = useId()
  const [showTable, setShowTable] = useState(false)

  return (
    <section aria-labelledby={headingId} className={`flex min-w-0 flex-col rounded-xl border border-border bg-white shadow-sm ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={icon} tone={tone} />
          <div className="min-w-0">
            <h2 id={headingId} className="text-h3 text-primary">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-body-sm text-text-secondary">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {table && (
            <button
              type="button"
              aria-pressed={showTable}
              onClick={() => setShowTable((value) => !value)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-caption font-semibold text-text-secondary transition-colors hover:bg-section-bg hover:text-primary"
            >
              {showTable ? <ChartBarIcon aria-hidden="true" className="size-4" /> : <TableCellsIcon aria-hidden="true" className="size-4" />}
              {showTable ? t.dashboard.common.showChart : t.dashboard.common.showTable}
            </button>
          )}
        </div>
      </header>
      <div className={`flex-1 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 ${bodyClassName}`}>{table && showTable ? <DataTable spec={table} /> : children}</div>
    </section>
  )
}

export function DataTable({ spec }: { spec: DataTableSpec }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-body-sm">
        <caption className="sr-only">{spec.caption}</caption>
        <thead className="bg-section-bg text-caption font-semibold uppercase tracking-wide text-text-secondary">
          <tr>
            {spec.columns.map((column) => (
              <th key={column.key} scope="col" className={`px-3 py-2 ${column.numeric ? 'text-right' : ''}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {spec.columns.map((column, columnIndex) =>
                columnIndex === 0 ? (
                  <th key={column.key} scope="row" className="px-3 py-2 font-medium text-text-primary">
                    {row[column.key]}
                  </th>
                ) : (
                  <td key={column.key} className={`px-3 py-2 text-text-secondary ${column.numeric ? 'text-right font-mono' : ''}`}>
                    {row[column.key]}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A friendly, centred empty state for a panel with nothing to show. */
export function PanelEmpty({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-lg bg-page-bg px-4 py-8 text-center">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-white text-success shadow-sm ring-1 ring-border [&>svg]:size-5">
        {icon}
      </span>
      <p className="text-h4 text-primary">{title}</p>
      <p className="max-w-xs text-body-sm text-text-secondary">{body}</p>
    </div>
  )
}
