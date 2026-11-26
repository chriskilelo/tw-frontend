import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InboxArrowDownIcon,
  MinusCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/20/solid'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import {
  activateActingPs,
  activateDesignatedDeputy,
  deactivateActingPs,
  deactivateDesignatedDeputy,
  getLeadershipSwitches,
  type LeadershipSwitchKey,
  type LeadershipSwitchState,
} from '../../api/sdt'
import { Avatar, getInitials } from '../../components/Avatar'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { PeoplePicker } from '../../components/PeoplePicker'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'
import { translatedName } from '../../lib/displayNames'
import { formatDate, localeFor } from '../../lib/formatters'

const leadershipQueryKey = (ministryId?: string) => ['sdt', 'leadership', ministryId ?? 'own'] as const

interface LeadershipSwitchPanelProps {
  /** Which switches to show, in order. */
  switches: LeadershipSwitchKey[]
  /** A System Administrator's chosen department; everyone else reads their own. */
  ministryId?: string
  /** Lays the cards side by side from the lg breakpoint. */
  columns?: 1 | 2
}

/**
 * K-02, K-08, FR-SDT-003 to 006: the Acting PS and Designated Deputy switches, shared by the PS
 * dashboard and the Leadership Switches page. GET /sdt/leadership says whether each switch is
 * on, who holds it and since when, and who may be chosen, so a switch that is on offers only
 * "End", and one that is off offers only the people the server accepts.
 */
export function LeadershipSwitchPanel({ switches, ministryId, columns = 1 }: LeadershipSwitchPanelProps) {
  const { t } = useI18n()
  const query = useQuery({
    queryKey: leadershipQueryKey(ministryId),
    queryFn: () => getLeadershipSwitches(ministryId),
  })

  if (query.isPending) {
    return (
      <div className={`grid gap-4 ${columns === 2 ? 'lg:grid-cols-2' : ''}`} aria-busy="true" aria-label={t.common.loading}>
        {switches.map((key) => (
          <div key={key} className="h-48 animate-pulse rounded-xl border border-border bg-section-bg/60" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger-soft-text">
        <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{apiErrorMessages(query.error, t.leadershipSwitch.loadError)[0]}</span>
        <Button variant="secondary" onClick={() => query.refetch()}>
          <ArrowPathIcon className="size-4" aria-hidden="true" />
          {t.leadershipSwitch.retry}
        </Button>
      </div>
    )
  }

  return (
    <div className={`grid gap-4 ${columns === 2 ? 'lg:grid-cols-2' : ''}`}>
      {switches.map((key) => (
        <LeadershipSwitchCard key={key} switchKey={key} state={query.data[key]} ministryId={ministryId} />
      ))}
    </div>
  )
}

function LeadershipSwitchCard({
  switchKey,
  state,
  ministryId,
}: {
  switchKey: LeadershipSwitchKey
  state: LeadershipSwitchState
  ministryId?: string
}) {
  const { t, language } = useI18n()
  const queryClient = useQueryClient()
  const copy = switchKey === 'acting_ps' ? t.leadershipSwitch.actingPs : t.leadershipSwitch.deputy
  const [chosen, setChosen] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const chosenPerson = state.candidates.find((candidate) => candidate.id === chosen[0])
  const holder = state.holder

  const handlers = {
    onMutate: () => {
      setNotice(null)
      setErrors([])
    },
    onError: (error: unknown) => setErrors(apiErrorMessages(error, t.common.genericError)),
  }

  function settle(message: string) {
    setNotice(message)
    setChosen([])
    queryClient.invalidateQueries({ queryKey: ['sdt', 'leadership'] })
    queryClient.invalidateQueries({ queryKey: ['sdt', 'dashboard'] })
  }

  const activateMutation = useMutation({
    mutationFn: (userId: string): Promise<unknown> => (switchKey === 'acting_ps' ? activateActingPs(userId) : activateDesignatedDeputy(userId)),
    ...handlers,
    onSuccess: (_result, userId) => settle(copy.activated(state.candidates.find((candidate) => candidate.id === userId)?.full_name ?? '')),
  })
  const endMutation = useMutation({
    mutationFn: (): Promise<unknown> => (switchKey === 'acting_ps' ? deactivateActingPs(ministryId) : deactivateDesignatedDeputy(ministryId)),
    ...handlers,
    onSuccess: () => settle(copy.ended),
  })
  const busy = activateMutation.isPending || endMutation.isPending
  const Icon = switchKey === 'acting_ps' ? ShieldCheckIcon : InboxArrowDownIcon
  const headingId = `leadership-${switchKey}-title`

  return (
    <section
      aria-labelledby={headingId}
      data-testid={switchKey === 'acting_ps' ? 'acting-ps-switch' : 'designated-deputy-switch'}
      className={`flex min-w-0 flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm ${state.active ? 'border-success/40' : 'border-border'}`}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`grid size-10 shrink-0 place-items-center rounded-lg ${state.active ? 'bg-success-soft text-success-soft-text' : 'bg-section-bg text-primary'}`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-h3 text-primary">
              {copy.title}
            </h2>
            <Badge
              variant={state.active ? 'success' : 'neutral'}
              label={state.active ? t.leadershipSwitch.on : t.leadershipSwitch.off}
              icon={state.active ? <CheckCircleIcon className="size-3.5" aria-hidden="true" /> : <MinusCircleIcon className="size-3.5" aria-hidden="true" />}
              testId={`${switchKey}-state`}
            />
          </div>
          <p className="mt-1 text-body-sm text-text-secondary">{copy.description}</p>
        </div>
      </header>

      {state.active ? (
        <div className="flex flex-col gap-3">
          {holder ? (
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-soft/50 px-3 py-3" data-testid={`${switchKey}-holder`}>
              <Avatar initials={getInitials(holder.full_name)} />
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-text-primary">{holder.full_name}</p>
                <p className="text-caption text-text-secondary">
                  {translatedName(holder.role.name ?? '', t.roleNames)}
                  {holder.since && ` · ${copy.since(formatDate(holder.since, localeFor(language)))}`}
                </p>
              </div>
            </div>
          ) : null}
          {holder && holder.status !== 'active' && (
            <p role="note" className="flex gap-2 rounded-lg bg-atrisk-soft px-3 py-2 text-caption leading-snug text-atrisk-soft-text">
              <ExclamationTriangleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
              {t.leadershipSwitch.inactiveHolder}
            </p>
          )}
          {state.can_manage ? (
            <div>
              <Button variant="secondary" onClick={() => endMutation.mutate()} disabled={busy}>
                {copy.end(holder?.full_name ?? copy.title)}
              </Button>
            </div>
          ) : (
            <p className="text-caption text-text-muted">{t.leadershipSwitch.viewOnly}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm font-semibold text-text-primary">{copy.offSummary}</p>
          {state.can_manage ? (
            <>
              <PeoplePicker
                label={copy.pickerLabel}
                description={copy.pickerHint}
                mode="single"
                value={chosen}
                onChange={setChosen}
                emptyMessage={copy.noneEligible}
                disabled={busy}
                people={state.candidates.map((candidate) => ({
                  id: candidate.id,
                  name: candidate.full_name,
                  detail: translatedName(candidate.role.name ?? '', t.roleNames),
                }))}
              />
              <div>
                <Button onClick={() => chosen[0] && activateMutation.mutate(chosen[0])} disabled={busy || !chosenPerson}>
                  {chosenPerson ? copy.activateNamed(chosenPerson.full_name) : copy.activate}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-caption text-text-muted">{t.leadershipSwitch.viewOnly}</p>
          )}
        </div>
      )}

      <div aria-live="polite">{notice && <p className="text-body-sm font-semibold text-success-soft-text">{notice}</p>}</div>
      {errors.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-body-sm text-danger-soft-text">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
