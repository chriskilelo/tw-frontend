import type { DirectiveListFilters, DirectiveSort } from '../../../api/directives'
import type { DirectiveAttentionCounts } from '../../../api/sdt'

/** The board's attention queues, each a filter on GET /directives. */
export const ATTENTION_QUEUES = ['overdue', 'stale', 'awaiting_closure', 'approaching', 'no_date'] as const
export type AttentionQueue = (typeof ATTENTION_QUEUES)[number]

/**
 * Each queue as a directive-list filter, with the order that puts the most urgent first:
 * longest overdue, longest without progress, longest waiting for closure, due soonest, and
 * oldest without a date.
 */
export const QUEUE_FILTERS: Record<AttentionQueue, { filters: DirectiveListFilters; sort: DirectiveSort }> = {
  overdue: { filters: { due: 'overdue' }, sort: 'target_completion_date' },
  stale: { filters: { stale: true }, sort: 'last_progress_update_at' },
  awaiting_closure: { filters: { status: 'completed' }, sort: 'last_progress_update_at' },
  approaching: { filters: { due: 'approaching' }, sort: 'target_completion_date' },
  no_date: { filters: { due: 'no_date' }, sort: 'created_at' },
}

/** The count behind each queue in DirectiveAttentionCounts. */
export const QUEUE_COUNT_KEY: Record<AttentionQueue, keyof DirectiveAttentionCounts> = {
  overdue: 'overdue',
  stale: 'stale',
  awaiting_closure: 'awaiting_closure',
  approaching: 'approaching',
  no_date: 'no_date',
}

/** The first queue with something in it, so the board opens on what matters. */
export function firstBusyQueue(attention: DirectiveAttentionCounts): AttentionQueue {
  return ATTENTION_QUEUES.find((queue) => attention[QUEUE_COUNT_KEY[queue]] > 0) ?? 'overdue'
}

/** A /directives link carrying the board's filters plus the given ones. */
export function directiveListLink(base: { missionId?: string; issuerId?: string }, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams()
  if (base.missionId) {
    query.set('mission_id', base.missionId)
  }
  if (base.issuerId) {
    query.set('issued_by_user_id', base.issuerId)
  }
  for (const [key, value] of Object.entries(extra)) {
    query.set(key, value)
  }
  const search = query.toString()
  return search ? `/directives?${search}` : '/directives'
}

/** The list-page query string for one queue (the same filter the queue itself uses). */
export function queueListParams(queue: AttentionQueue): Record<string, string> {
  const { filters, sort } = QUEUE_FILTERS[queue]
  return {
    ...(filters.due ? { due: filters.due } : {}),
    ...(filters.stale ? { stale: '1' } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    sort,
  }
}
