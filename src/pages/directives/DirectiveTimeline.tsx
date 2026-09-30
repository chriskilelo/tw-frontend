import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import {
  ArrowPathIcon,
  CheckBadgeIcon,
  CheckIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import type { DirectiveDetail, DirectiveNoteKind, DirectiveStatus } from '../../api/directives'
import { ProgressStep, type ProgressStepState } from '../../components/DetailLayout'
import { formatDate, formatDateTime, formatRelativeTime, initials } from '../../lib/formatters'
import { useI18n } from '../../i18n/context'
import { DirectiveStatusBadge } from './DirectiveStatusBadge'

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>

/** The main line of the URD FR-DIR lifecycle; Cancelled is a terminal branch shown separately. */
const WORKFLOW_STEPS = ['issued', 'acknowledged', 'in_progress', 'completed', 'closed'] as const
type WorkflowStep = (typeof WORKFLOW_STEPS)[number]

/** When each status was (most recently) reached, from the server-built status_history. */
function statusReachedAt(directive: DirectiveDetail): Partial<Record<DirectiveStatus, string>> {
  const reached: Partial<Record<DirectiveStatus, string>> = {}
  for (const entry of directive.status_history) {
    reached[entry.status] = entry.at
  }
  reached.issued ??= directive.created_at
  return reached
}

interface DirectiveProgressStepsProps {
  directive: DirectiveDetail
  locale: string
}

export function DirectiveProgressSteps({ directive, locale }: DirectiveProgressStepsProps) {
  const { t } = useI18n()
  const copy = t.directives.detail
  const reachedAt = statusReachedAt(directive)
  const isCancelled = directive.status === 'cancelled'
  const currentIndex = WORKFLOW_STEPS.indexOf(directive.status as WorkflowStep)

  const currentNote: Record<WorkflowStep, string> = {
    issued: copy.stepNotes.issuedCurrent,
    acknowledged: copy.stepNotes.acknowledgedCurrent,
    in_progress: copy.stepNotes.inProgressCurrent,
    completed: copy.stepNotes.completedCurrent,
    closed: copy.stepNotes.done,
  }

  function stateFor(step: WorkflowStep, index: number): ProgressStepState {
    if (isCancelled) {
      return reachedAt[step] ? 'done' : 'todo'
    }
    if (index < currentIndex || (index === currentIndex && directive.status === 'closed')) {
      return 'done'
    }
    return index === currentIndex ? 'current' : 'todo'
  }

  function noteFor(step: WorkflowStep, state: ProgressStepState): string {
    const reached = reachedAt[step]
    if (state === 'done') {
      // In Progress can be reached straight from Issued (FR-DIR-006 AC1), skipping Acknowledged.
      return reached ? formatDate(reached, locale) : copy.stepNotes.skipped
    }
    if (state === 'current') {
      return reached ? `${formatDate(reached, locale)} · ${currentNote[step]}` : currentNote[step]
    }
    return isCancelled ? copy.stepNotes.notReached : copy.stepNotes.notYet
  }

  return (
    <ol aria-label={copy.progressLabel} className="grid border-t border-border bg-page-bg md:grid-cols-5" data-testid="directive-progress">
      {WORKFLOW_STEPS.map((step, index) => {
        const state = stateFor(step, index)
        return <ProgressStep key={step} state={state} index={index + 1} title={copy.steps[step]} note={noteFor(step, state)} />
      })}
    </ol>
  )
}

type ActivityFilter = 'all' | 'notes' | 'status'

interface ActivityItem {
  id: string
  kind: Exclude<ActivityFilter, 'all'>
  at: string
  marker: ReactNode
  tone: string
  title: ReactNode
  actor?: string
  detail?: string
}

const STATUS_STYLE: Record<DirectiveStatus, { icon: HeroIcon; tone: string }> = {
  draft: { icon: PaperAirplaneIcon, tone: 'bg-section-bg text-primary' },
  issued: { icon: PaperAirplaneIcon, tone: 'bg-info-soft text-info-soft-text' },
  acknowledged: { icon: CheckIcon, tone: 'bg-directive-soft text-directive-soft-text' },
  in_progress: { icon: ArrowPathIcon, tone: 'bg-accent-soft text-accent-soft-text' },
  completed: { icon: CheckBadgeIcon, tone: 'bg-success-soft text-success-soft-text' },
  cancelled: { icon: XCircleIcon, tone: 'bg-danger-soft text-danger-soft-text' },
  closed: { icon: LockClosedIcon, tone: 'bg-section-bg text-text-secondary' },
}

const NOTE_TONE: Record<DirectiveNoteKind, string> = {
  progress: 'bg-info-soft text-info-soft-text',
  follow_up: 'bg-directive-soft text-directive-soft-text',
  note: 'bg-section-bg text-primary',
}

const NOTE_CHIP: Record<DirectiveNoteKind, string> = {
  progress: 'bg-info-soft text-info-soft-text',
  follow_up: 'bg-directive-soft text-directive-soft-text',
  note: 'bg-section-bg text-text-secondary',
}

interface DirectiveActivityProps {
  directive: DirectiveDetail
  locale: string
  /** The note composer, rendered above the filters when the user may add notes. */
  composer?: ReactNode
}

/** Notes (FR-DIR-008, FR-DIR-011) and dated status changes on one timeline, newest first. */
export function DirectiveActivity({ directive, locale, composer }: DirectiveActivityProps) {
  const { t } = useI18n()
  const copy = t.directives.detail
  const [filter, setFilter] = useState<ActivityFilter>('all')

  const history = directive.status_history.length > 0
    ? directive.status_history
    : [{ status: 'issued' as const, at: directive.created_at, by: directive.issued_by ?? null }]

  const items: ActivityItem[] = [
    ...history.map((entry, index): ActivityItem => {
      const Icon = STATUS_STYLE[entry.status].icon
      return {
        id: `status-${index}-${entry.status}`,
        kind: 'status',
        at: entry.at,
        marker: <Icon className="size-4" />,
        tone: STATUS_STYLE[entry.status].tone,
        title:
          entry.status === 'issued' ? (
            copy.activityIssued
          ) : (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {copy.activityMovedTo}
              <DirectiveStatusBadge status={entry.status} />
            </span>
          ),
        actor: entry.by?.full_name,
      }
    }),
    ...directive.notes.map(
      (note): ActivityItem => ({
        id: `note-${note.id}`,
        kind: 'notes',
        at: note.created_at,
        marker: <span className="text-[0.6875rem] font-bold">{initials(note.authored_by?.full_name) || '—'}</span>,
        tone: NOTE_TONE[note.kind],
        title: (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {note.authored_by?.full_name ?? '—'}
            <span className={`rounded-full px-2 py-px text-[0.6875rem] font-semibold ${NOTE_CHIP[note.kind]}`}>
              {copy.noteKinds[note.kind]}
            </span>
          </span>
        ),
        detail: note.content,
      }),
    ),
  ].sort((first, second) => second.at.localeCompare(first.at))

  const counts: Record<ActivityFilter, number> = {
    all: items.length,
    notes: items.filter((item) => item.kind === 'notes').length,
    status: items.filter((item) => item.kind === 'status').length,
  }
  const visible = filter === 'all' ? items : items.filter((item) => item.kind === filter)

  return (
    <>
      {composer}

      <div role="group" aria-label={copy.activityFilterLabel} className="mb-4 flex flex-wrap gap-1.5">
        {(['all', 'notes', 'status'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-semibold transition-colors ${
              filter === option
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-white text-text-secondary hover:border-text-muted hover:text-primary'
            }`}
          >
            {copy.activityFilters[option]}
            <span className={`font-mono text-[0.6875rem] ${filter === option ? 'text-white/80' : 'text-text-muted'}`}>{counts[option]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-body-sm italic text-text-muted">{filter === 'notes' ? copy.notesEmpty : copy.activityEmpty}</p>
      ) : (
        <ol className="flex flex-col" data-testid="directive-activity">
          {visible.map((item, index) => {
            const isLast = index === visible.length - 1
            return (
              <li key={item.id} className={`relative grid grid-cols-[32px_1fr] gap-3 ${isLast ? '' : 'pb-4'}`} data-kind={item.kind}>
                {!isLast && <span className="absolute bottom-0.5 left-3.75 top-8.5 w-0.5 bg-border" aria-hidden="true" />}
                <span className={`grid size-8 place-items-center rounded-full ${item.tone}`} aria-hidden="true">
                  {item.marker}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <strong className="text-body-sm text-text-primary">{item.title}</strong>
                    {item.actor && <span className="text-caption text-text-secondary">{copy.activityBy(item.actor)}</span>}
                    <span className="text-caption text-text-muted">
                      <time dateTime={item.at}>{formatRelativeTime(item.at, locale)}</time>
                      <span aria-hidden="true"> · </span>
                      <span className="sr-only">, </span>
                      {formatDateTime(item.at, locale)}
                    </span>
                  </p>
                  {item.detail && (
                    <p className="mt-1 whitespace-pre-line wrap-break-word rounded-[4px_12px_12px_12px] border border-border bg-page-bg px-3.5 py-2.5 text-body-sm text-text-primary">
                      {item.detail}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
