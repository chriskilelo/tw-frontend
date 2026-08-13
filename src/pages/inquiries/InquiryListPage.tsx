import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getInquiryCategories, listInquiries, type Inquiry, type InquiryStatus } from '../../api/inquiries'
import { Table, type TableColumn } from '../../components/Table'
import { Badge } from '../../components/Badge'
import { InquiryStatusBadge } from './InquiryStatusBadge'
import { InquirySubTypeBadge } from './InquirySubTypeBadge'
import en from '../../i18n/en'

const STATUS_OPTIONS: InquiryStatus[] = [
  'draft',
  'received',
  'in_progress',
  'pending_external_response',
  'resolved',
  'closed',
  'cancelled',
]

/** FR-INQ-015, FR-INQ-018. Filterable table of inquiries. */
export default function InquiryListPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<InquiryStatus | ''>('')
  const [category, setCategory] = useState('')
  const [highValueOnly, setHighValueOnly] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const categoriesQuery = useQuery({
    queryKey: ['inquiry-categories'],
    queryFn: getInquiryCategories,
  })

  const listQuery = useQuery({
    queryKey: ['inquiries', { status, category, highValueOnly, dateFrom, dateTo }],
    queryFn: () =>
      listInquiries({
        status: status || undefined,
        category: category || undefined,
        high_value_flag: highValueOnly || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  })

  const inquiries = listQuery.data?.data ?? []

  function goToInquiry(id: string) {
    navigate(`/inquiries/${id}`)
  }

  const columns: TableColumn<Inquiry>[] = [
    {
      key: 'reference_number',
      header: en.inquiries.list.columnReference,
      render: (row) => <span className="font-mono">{row.reference_number}</span>,
    },
    { key: 'category', header: en.inquiries.list.columnCategory, render: (row) => row.category },
    {
      key: 'sub_type',
      header: en.inquiries.list.columnSubType,
      render: (row) => <InquirySubTypeBadge subType={row.sub_type} />,
    },
    {
      key: 'status',
      header: en.inquiries.list.columnStatus,
      render: (row) => <InquiryStatusBadge status={row.status} />,
    },
    {
      key: 'date_received',
      header: en.inquiries.list.columnDateReceived,
      render: (row) => new Date(row.date_received).toLocaleDateString(),
    },
    {
      key: 'high_value_flag',
      header: en.inquiries.list.columnHighValue,
      render: (row) =>
        row.high_value_flag ? (
          <Badge
            variant="atrisk"
            label={en.inquiries.detail.highValueLabel}
            icon={
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            }
          />
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.inquiries.list.title}</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.inquiries.list.filterStatus}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as InquiryStatus | '')}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">{en.inquiries.list.allStatuses}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {en.inquiries.status[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.inquiries.list.filterCategory}</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">{en.inquiries.list.allCategories}</option>
            {(categoriesQuery.data ?? []).map((option) => (
              <option key={option.id} value={option.value}>
                {option.value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.inquiries.list.dateFromLabel}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.inquiries.list.dateToLabel}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={highValueOnly}
            onChange={(event) => setHighValueOnly(event.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
          />
          <span className="text-body-sm text-text-secondary">{en.inquiries.list.filterHighValue}</span>
        </label>
      </div>

      <div className="mt-6">
        <Table
          columns={columns}
          data={inquiries}
          rowKey={(row) => row.id}
          emptyMessage={en.inquiries.list.empty}
          onRowClick={(row) => goToInquiry(row.id)}
        />
      </div>
    </div>
  )
}
