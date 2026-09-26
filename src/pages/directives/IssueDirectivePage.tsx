import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDirectiveTypeOptions, issueDirective, type DirectiveCreateRequest } from '../../api/directives'
import { listMissions } from '../../api/missions'
import { useAuth } from '../../hooks/useAuth'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { useI18n } from '../../i18n/context'

/**
 * FR-DIR-002, FR-DIR-003. Mirrors App\Policies\DirectivePolicy::create() exactly: Ministry
 * HQ Officer or Ministry PS only — not Acting PS or Ministry HQ Director, even though other
 * abilities on this engine extend to Acting PS (Session 14's role-swap precedent). This page
 * self-gates rather than relying only on the sidebar hiding its link (TC-UI-006), the same
 * way ReportFormPage's create form is only reachable by the role ReportPolicy::create() names.
 */
const ISSUING_ROLES = ['Ministry HQ Officer', 'Ministry PS']

export default function IssueDirectivePage() {
  const { t } = useI18n()
  const { role } = useAuth()

  if (!role || !ISSUING_ROLES.includes(role.name)) {
    return (
      <div className="p-6">
        <p className="text-body text-text-secondary">{t.common.forbidden}</p>
      </div>
    )
  }

  return <IssueDirectiveForm />
}

function IssueDirectiveForm() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const missionsQuery = useQuery({ queryKey: ['missions'], queryFn: listMissions })
  const typeOptionsQuery = useQuery({
    queryKey: ['master-data', 'directive_type'],
    queryFn: getDirectiveTypeOptions,
  })

  const [missionId, setMissionId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [typeCategory, setTypeCategory] = useState('')
  const [description, setDescription] = useState('')
  const [targetCompletionDate, setTargetCompletionDate] = useState('')

  const mutation = useMutation({
    mutationFn: (payload: DirectiveCreateRequest) => issueDirective(payload),
    onSuccess: (directive) => {
      queryClient.invalidateQueries({ queryKey: ['directives'] })
      navigate(`/directives/${directive.id}`)
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({
      mission_id: missionId,
      target_user_id: targetUserId,
      type_category: typeCategory || undefined,
      description,
      target_completion_date: targetCompletionDate || undefined,
    })
  }

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.directives.issue.title}</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-2xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{t.directives.issue.missionLabel}</span>
          <select
            required
            value={missionId}
            onChange={(event) => setMissionId(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="" disabled>
              {t.common.required}
            </option>
            {(missionsQuery.data ?? []).map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <Input
            label={t.directives.issue.targetUserIdLabel}
            required
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
          />
          <p className="text-caption text-text-muted">{t.directives.issue.targetUserIdHint}</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{t.directives.issue.typeCategoryLabel}</span>
          <select
            value={typeCategory}
            onChange={(event) => setTypeCategory(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">{t.directives.issue.typeCategoryNone}</option>
            {(typeOptionsQuery.data ?? []).map((option) => (
              <option key={option.id} value={option.value}>
                {option.value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{t.directives.issue.descriptionLabel}</span>
          <textarea
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <Input
          type="date"
          label={t.directives.issue.targetCompletionDateLabel}
          value={targetCompletionDate}
          onChange={(event) => setTargetCompletionDate(event.target.value)}
        />

        {mutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {t.directives.issue.button}
        </Button>
      </form>
    </div>
  )
}
