import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowsRightLeftIcon, BuildingLibraryIcon, LinkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { findInquiryMatches, linkInquiry, type Inquiry, type InquiryDetail } from '../api/inquiries'
import { useAuth } from '../hooks/useAuth'
import { Button } from './Button'
import { DetailCard, EmptyState } from './DetailLayout'
import { useI18n } from '../i18n/context'

/**
 * FR-INQ-019 (Match and Flag Cross-Mission Inquiries). InquiryPolicy::link()
 * (App\Policies\InquiryPolicy, Session 34) restricts POST /inquiries/{id}/link
 * to Ministry HQ Officer only, per API-001 Section 7's literal Roles-Allowed
 * column — this panel mirrors that boundary by rendering nothing for any
 * other role, rather than relying solely on the 403 the backend would
 * otherwise return.
 *
 * Omitting target_inquiry_id (findInquiryMatches()) returns suggested
 * matches only, already ranked by ts_rank server-side
 * (InquiryMatchingService::findMatches()) — highest relevance first. The
 * InquiryResource shape returned carries no numeric score, so list
 * position is the only relevance signal available; it is rendered as a
 * coarse High/Medium/Possible band rather than a fabricated percentage.
 */
export function InquiryMatchingPanel({
  inquiry,
  onLinked,
}: {
  inquiry: InquiryDetail
  onLinked: (updated: InquiryDetail) => void
}) {
  const { t } = useI18n()
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const canMatch = role?.name === 'Ministry HQ Officer'

  const matchesQuery = useQuery({
    queryKey: ['inquiry', inquiry.id, 'matches'],
    queryFn: () => findInquiryMatches(inquiry.id),
    enabled: canMatch,
  })

  const linkMutation = useMutation({
    mutationFn: (targetId: string) => linkInquiry(inquiry.id, targetId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['inquiry', inquiry.id, 'matches'] })
      onLinked(updated)
    },
  })

  if (!canMatch) {
    return null
  }

  const matches = matchesQuery.data ?? []

  return (
    <div data-testid="inquiry-matching-panel">
      <DetailCard icon={<ArrowsRightLeftIcon className="size-4" aria-hidden="true" />} title={t.inquiries.matching.title} count={matches.length}>
        <p className="-mt-1 mb-3.5 text-body-sm text-text-secondary">{t.inquiries.matching.hint}</p>

        {inquiry.linked_inquiry && (
          <p className="mb-3.5 flex flex-wrap items-center gap-2 rounded-lg bg-success-soft px-3.5 py-2.5 text-body-sm text-success-soft-text">
            <LinkIcon className="size-4 shrink-0" aria-hidden="true" />
            {t.inquiries.detail.linkedToLabel}:
            <Link to={`/inquiries/${inquiry.linked_inquiry.id}`} className="font-mono font-semibold hover:underline">
              {inquiry.linked_inquiry.reference_number}
            </Link>
            {inquiry.linked_inquiry.mission && <span>({inquiry.linked_inquiry.mission})</span>}
          </p>
        )}

        {matchesQuery.isLoading ? (
          <p className="text-body-sm text-text-muted">{t.common.loading}</p>
        ) : matches.length === 0 ? (
          <EmptyState icon={<MagnifyingGlassIcon className="size-4.5" aria-hidden="true" />} title={t.inquiries.matching.empty} body="" />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {matches.map((match, index) => (
              <MatchRow
                key={match.id}
                match={match}
                rank={index}
                total={matches.length}
                disabled={linkMutation.isPending}
                isLinked={inquiry.linked_inquiry?.id === match.id}
                onLink={() => linkMutation.mutate(match.id)}
              />
            ))}
          </ul>
        )}
      </DetailCard>
    </div>
  )
}

function relevanceLabel(t: ReturnType<typeof useI18n>['t'], rank: number, total: number): string {
  const percentile = total <= 1 ? 0 : rank / (total - 1)
  if (percentile <= 0.33) {
    return t.inquiries.matching.relevanceHigh
  }
  if (percentile <= 0.66) {
    return t.inquiries.matching.relevanceMedium
  }
  return t.inquiries.matching.relevanceLow
}

const RELEVANCE_TONE = ['bg-success-soft text-success-soft-text', 'bg-info-soft text-info', 'bg-section-bg text-text-secondary']

function MatchRow({
  match,
  rank,
  total,
  disabled,
  isLinked,
  onLink,
}: {
  match: Inquiry
  rank: number
  total: number
  disabled: boolean
  isLinked: boolean
  onLink: () => void
}) {
  const { t } = useI18n()
  const relevance = relevanceLabel(t, rank, total)
  const toneIndex = [t.inquiries.matching.relevanceHigh, t.inquiries.matching.relevanceMedium].indexOf(relevance)
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <Link to={`/inquiries/${match.id}`} className="font-mono text-body-sm font-medium text-primary hover:underline">
            {match.reference_number}
          </Link>
          <span className={`rounded-full px-2 py-0.5 text-caption font-semibold ${RELEVANCE_TONE[toneIndex === -1 ? 2 : toneIndex]}`}>
            {t.inquiries.matching.relevanceLabel}: {relevance}
          </span>
        </p>
        <p className="mt-1 text-body-sm text-text-secondary">
          {match.category} — {match.inquirer_name}
        </p>
        {match.mission && (
          <p className="mt-0.5 flex items-center gap-1.5 text-caption text-text-muted">
            <BuildingLibraryIcon className="size-3.5" aria-hidden="true" />
            <span>{match.mission.name}</span>
          </p>
        )}
      </div>
      {!isLinked && (
        <Button variant="secondary" disabled={disabled} onClick={onLink}>
          <LinkIcon className="size-4" aria-hidden="true" />
          {t.inquiries.matching.linkButton}
        </Button>
      )}
    </li>
  )
}
