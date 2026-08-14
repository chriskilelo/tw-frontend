import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { findInquiryMatches, linkInquiry, type Inquiry, type InquiryDetail } from '../api/inquiries'
import { useAuth } from '../hooks/useAuth'
import { Button } from './Button'
import en from '../i18n/en'

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
    <section className="mt-8" data-testid="inquiry-matching-panel">
      <h2 className="text-h3 text-primary">{en.inquiries.matching.title}</h2>
      <p className="mt-1 text-body-sm text-text-muted">{en.inquiries.matching.hint}</p>

      {inquiry.linked_inquiry && (
        <p className="mt-2 text-body-sm text-text-secondary">
          {en.inquiries.detail.linkedToLabel}:{' '}
          <Link to={`/inquiries/${inquiry.linked_inquiry.id}`} className="font-mono text-accent-soft-text hover:underline">
            {inquiry.linked_inquiry.reference_number}
          </Link>
          {inquiry.linked_inquiry.mission && ` (${inquiry.linked_inquiry.mission})`}
        </p>
      )}

      {matchesQuery.isLoading ? (
        <p className="mt-3 text-body-sm text-text-muted">{en.common.loading}</p>
      ) : matches.length === 0 ? (
        <p className="mt-3 text-body-sm text-text-muted">{en.inquiries.matching.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {matches.map((match, index) => (
            <MatchRow
              key={match.id}
              match={match}
              rank={index}
              total={matches.length}
              disabled={linkMutation.isPending}
              onLink={() => linkMutation.mutate(match.id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function relevanceLabel(rank: number, total: number): string {
  const percentile = total <= 1 ? 0 : rank / (total - 1)
  if (percentile <= 0.33) {
    return en.inquiries.matching.relevanceHigh
  }
  if (percentile <= 0.66) {
    return en.inquiries.matching.relevanceMedium
  }
  return en.inquiries.matching.relevanceLow
}

function MatchRow({
  match,
  rank,
  total,
  disabled,
  onLink,
}: {
  match: Inquiry
  rank: number
  total: number
  disabled: boolean
  onLink: () => void
}) {
  return (
    <li className="rounded border border-border bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-body-sm text-text-primary">{match.reference_number}</p>
          <p className="mt-1 text-body-sm text-text-secondary">
            {match.category} — {match.inquirer_name}
          </p>
          {match.mission && <p className="mt-1 text-caption text-text-muted">{match.mission.name}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-caption text-text-muted">
            {en.inquiries.matching.relevanceLabel}: {relevanceLabel(rank, total)}
          </span>
          <Button variant="secondary" disabled={disabled} onClick={onLink}>
            {en.inquiries.matching.linkButton}
          </Button>
        </div>
      </div>
    </li>
  )
}
