import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '../../components/Badge'
import type { InquirySubType } from '../../api/inquiries'
import { useI18n } from '../../i18n/context'

const SUB_TYPE_VARIANT: Record<InquirySubType, BadgeVariant> = {
  standard: 'neutral',
  dispute_or_complaint: 'danger',
}

function StandardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h9l5 5v15H6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v5h5" />
    </svg>
  )
}

function DisputeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}

const SUB_TYPE_ICON: Record<InquirySubType, ReactNode> = {
  standard: <StandardIcon />,
  dispute_or_complaint: <DisputeIcon />,
}

export function InquirySubTypeBadge({ subType }: { subType: InquirySubType }) {
  const { t } = useI18n()
  return <Badge variant={SUB_TYPE_VARIANT[subType]} icon={SUB_TYPE_ICON[subType]} label={t.inquiries.subType[subType]} />
}
