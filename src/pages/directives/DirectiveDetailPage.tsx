import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDirectiveNote,
  getDirective,
  transitionDirectiveStatus,
  type DirectiveActionableStatus,
  type DirectiveDetail,
  type DirectiveStatus,
} from '../../api/directives'
import { useAuth, isReadOnlyRole } from '../../hooks/useAuth'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { DirectiveStatusBadge } from './DirectiveStatusBadge'
import en from '../../i18n/en'

/**
 * Inverse of App\Services\DirectiveService::ALLOWED_TRANSITIONS (Session 27): the set of
 * statuses reachable from each current status. 'draft' and 'closed' are never reachable
 * through the API (see api/directives.ts's DirectiveStatus note), so both map to [].
 */
const NEXT_STATUSES: Record<DirectiveStatus, DirectiveActionableStatus[]> = {
  draft: [],
  issued: ['acknowledged', 'cancelled'],
  acknowledged: ['in_progress'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  closed: [],
}

const ACTION_LABEL: Record<DirectiveActionableStatus, string> = {
  acknowledged: en.directives.detail.acknowledgeButton,
  in_progress: en.directives.detail.inProgressButton,
  completed: en.directives.detail.completeButton,
  cancelled: en.directives.detail.cancelButton,
}

export default function DirectiveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const readOnly = isReadOnlyRole(role?.name)

  const directiveQuery = useQuery({
    queryKey: ['directive', id],
    queryFn: () => getDirective(id as string),
    enabled: Boolean(id),
  })

  const [noteContent, setNoteContent] = useState('')
  const [isCompleteModalOpen, setCompleteModalOpen] = useState(false)

  const transitionMutation = useMutation({
    mutationFn: (status: DirectiveActionableStatus) => transitionDirectiveStatus(id as string, { status }),
    onSuccess: (updated) => queryClient.setQueryData(['directive', id], updated),
  })

  const noteMutation = useMutation({
    mutationFn: () => addDirectiveNote(id as string, { content: noteContent }),
    onSuccess: () => {
      setNoteContent('')
      queryClient.invalidateQueries({ queryKey: ['directive', id] })
    },
  })

  if (directiveQuery.isLoading || !directiveQuery.data) {
    return (
      <div className="p-6">
        <p className="text-body text-text-muted">{en.common.loading}</p>
      </div>
    )
  }

  const directive = directiveQuery.data

  // App\Policies\DirectivePolicy: transitionStatus() is the target attache only; addNote()
  // is the target attache or the issuing HQ officer.
  const isTargetAttache = role?.name === 'Ministry Attache' && user?.id === directive.target_user?.id
  const isIssuingOfficer = role?.name === 'Ministry HQ Officer' && user?.id === directive.issued_by?.id
  const canTransition = !readOnly && isTargetAttache
  const canAddNote = !readOnly && (isTargetAttache || isIssuingOfficer)

  const nextStatuses = NEXT_STATUSES[directive.status]

  return (
    <div className="p-6">
      <Link to="/directives" className="text-body-sm font-semibold text-accent-soft-text hover:underline">
        ← {en.directives.detail.backToList}
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 text-primary">{directive.description.slice(0, 60)}</h1>
        <DirectiveStatusBadge status={directive.status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DirectiveInfoPanel directive={directive} />

          {canTransition && nextStatuses.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {nextStatuses.map((next) =>
                next === 'completed' ? (
                  <Button key={next} variant="primary" onClick={() => setCompleteModalOpen(true)}>
                    {ACTION_LABEL[next]}
                  </Button>
                ) : (
                  <Button
                    key={next}
                    variant={next === 'cancelled' ? 'danger' : 'secondary'}
                    disabled={transitionMutation.isPending}
                    onClick={() => transitionMutation.mutate(next)}
                  >
                    {ACTION_LABEL[next]}
                  </Button>
                ),
              )}
            </div>
          )}

          <section className="mt-8">
            <h2 className="text-h3 text-primary">{en.directives.detail.notesTitle}</h2>
            {directive.notes.length === 0 ? (
              <p className="mt-2 text-body-sm text-text-muted">{en.directives.detail.notesEmpty}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {directive.notes.map((note) => (
                  <li key={note.id} className="rounded border border-border bg-white p-3">
                    <p className="text-body-sm text-text-primary">{note.content}</p>
                    <p className="mt-1 text-caption text-text-muted">
                      {note.authored_by?.full_name ?? '—'} · {new Date(note.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {canAddNote && (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault()
                  if (noteContent.trim()) {
                    noteMutation.mutate()
                  }
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="sr-only">{en.directives.detail.notesPlaceholder}</span>
                  <textarea
                    value={noteContent}
                    onChange={(event) => setNoteContent(event.target.value)}
                    placeholder={en.directives.detail.notesPlaceholder}
                    rows={3}
                    className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
                <Button type="submit" disabled={noteMutation.isPending} className="self-start">
                  {en.directives.detail.addNoteButton}
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>

      {canTransition && (
        <CompleteDirectiveModal
          directiveId={directive.id}
          open={isCompleteModalOpen}
          onClose={() => setCompleteModalOpen(false)}
          onCompleted={(updated) => {
            queryClient.setQueryData(['directive', id], updated)
            setCompleteModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

function DirectiveInfoPanel({ directive }: { directive: DirectiveDetail }) {
  const rows: { label: string; value: string | null }[] = [
    { label: en.directives.detail.descriptionLabel, value: directive.description },
    { label: en.directives.detail.typeCategoryLabel, value: directive.type_category },
    { label: en.directives.detail.missionLabel, value: directive.mission?.name ?? null },
    { label: en.directives.detail.targetAttacheLabel, value: directive.target_user?.full_name ?? null },
    { label: en.directives.detail.issuedByLabel, value: directive.issued_by?.full_name ?? null },
    {
      label: en.directives.detail.targetCompletionDateLabel,
      value: directive.target_completion_date ? new Date(directive.target_completion_date).toLocaleDateString() : null,
    },
    {
      label: en.directives.detail.lastProgressUpdateLabel,
      value: directive.last_progress_update_at ? new Date(directive.last_progress_update_at).toLocaleString() : null,
    },
  ]

  return (
    <section>
      <h2 className="text-h3 text-primary">{en.directives.detail.infoTitle}</h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows
          .filter((row) => row.value)
          .map((row) => (
            <div key={row.label}>
              <dt className="text-caption text-text-muted">{row.label}</dt>
              <dd className="text-body text-text-primary">{row.value}</dd>
            </div>
          ))}
      </dl>
      {directive.completion_summary && (
        <div className="mt-4">
          <dt className="text-caption text-text-muted">{en.directives.detail.completionSummaryLabel}</dt>
          <dd className="text-body text-text-primary">{directive.completion_summary}</dd>
        </div>
      )}
    </section>
  )
}

/** FR-DIR-007: a completion summary is mandatory before a directive can be marked complete. */
function CompleteDirectiveModal({
  directiveId,
  open,
  onClose,
  onCompleted,
}: {
  directiveId: string
  open: boolean
  onClose: () => void
  onCompleted: (updated: DirectiveDetail) => void
}) {
  const [completionSummary, setCompletionSummary] = useState('')

  const mutation = useMutation({
    mutationFn: () => transitionDirectiveStatus(directiveId, { status: 'completed', note: completionSummary }),
    onSuccess: onCompleted,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (completionSummary.trim()) {
      mutation.mutate()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={en.directives.detail.completeModalTitle}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">
            {en.directives.detail.completionSummaryRequiredLabel}
          </span>
          <textarea
            required
            value={completionSummary}
            onChange={(event) => setCompletionSummary(event.target.value)}
            rows={4}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending || completionSummary.trim() === ''}>
            {en.directives.detail.completeSubmitButton}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {en.common.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
