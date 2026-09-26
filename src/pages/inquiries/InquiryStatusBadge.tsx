import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '../../components/Badge'
import type { InquiryStatus } from '../../api/inquiries'
import { useI18n } from '../../i18n/context'

/** CLAUDE.md Section 4 Rule 9: every status badge pairs colour with an icon and a text label. */
const STATUS_VARIANT: Record<InquiryStatus, BadgeVariant> = {
  draft: 'neutral',
  received: 'info',
  in_progress: 'accent',
  pending_external_response: 'atrisk',
  resolved: 'success',
  closed: 'directive',
  cancelled: 'danger',
}

function DraftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.5-9.5a2.121 2.121 0 0 1 3 3L12 16l-4 1 1-4 9.5-9.5Z" />
    </svg>
  )
}

function ReceivedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M16 6l-4-4-4 4M12 2v13" />
    </svg>
  )
}

function InProgressIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <circle cx={12} cy={12} r={9} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  )
}

function PendingExternalResponseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 9-18 9 4.5-9L3 3Z" />
    </svg>
  )
}

function ResolvedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  )
}

function ClosedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <rect x={5} y={11} width={14} height={9} rx={2} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function CancelledIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <circle cx={12} cy={12} r={9} />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 6 6m0-6-6 6" />
    </svg>
  )
}

const STATUS_ICON: Record<InquiryStatus, ReactNode> = {
  draft: <DraftIcon />,
  received: <ReceivedIcon />,
  in_progress: <InProgressIcon />,
  pending_external_response: <PendingExternalResponseIcon />,
  resolved: <ResolvedIcon />,
  closed: <ClosedIcon />,
  cancelled: <CancelledIcon />,
}

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  const { t } = useI18n()
  return <Badge variant={STATUS_VARIANT[status]} icon={STATUS_ICON[status]} label={t.inquiries.status[status]} />
}
