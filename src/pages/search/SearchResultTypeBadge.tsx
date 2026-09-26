import { Badge, type BadgeVariant } from '../../components/Badge'
import type { SearchResultType } from '../../api/search'
import { useI18n } from '../../i18n/context'

/**
 * CLAUDE.md Section 4 Rule 9: colour + icon + label, never colour alone.
 * Variant mapping matches GovernanceService's TYPE_BADGE_VARIANT convention
 * (MissionActivityPage) so the same record type reads the same colour
 * everywhere in the app: alert = accent, inquiry = info, periodic_report =
 * neutral (that page also has a directive variant; search never returns
 * directives, SearchService only indexes alerts/inquiries/periodic_reports).
 */
const TYPE_VARIANT: Record<SearchResultType, BadgeVariant> = {
  alert: 'accent',
  inquiry: 'info',
  periodic_report: 'neutral',
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}

function InquiryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 1 1-4.5-7.79L21 3l-1.2 4.5A8.96 8.96 0 0 1 21 12Z"
      />
    </svg>
  )
}

function ReportIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7V3Zm7 0v5h5M9 13h6M9 17h6" />
    </svg>
  )
}

const TYPE_ICON: Record<SearchResultType, ReturnType<typeof AlertIcon>> = {
  alert: <AlertIcon />,
  inquiry: <InquiryIcon />,
  periodic_report: <ReportIcon />,
}

export function SearchResultTypeBadge({ type, testId }: { type: SearchResultType; testId?: string }) {
  const { t } = useI18n()
  return <Badge variant={TYPE_VARIANT[type]} icon={TYPE_ICON[type]} label={t.search.type[type]} testId={testId} />
}
