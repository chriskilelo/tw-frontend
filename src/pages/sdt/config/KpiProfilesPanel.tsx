import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowsRightLeftIcon, MapPinIcon, PlusIcon, Squares2X2Icon } from '@heroicons/react/20/solid'
import { assignKpiProfile, createKpiProfile, listKpiProfiles, type KpiProfile } from '../../../api/kpi'
import { listMissions, type Mission } from '../../../api/missions'
import type { KpiDefinition } from '../../../api/sdt'
import { Input } from '../../../components/Input'
import { Modal } from '../../../components/Modal'
import { DashboardCard, PanelEmpty } from '../../../components/dashboard/DashboardCard'
import { useI18n } from '../../../i18n/context'
import { apiErrorMessages, retryUnlessClientError } from '../../../lib/apiErrors'

const PROFILES_KEY = ['kpi', 'profiles'] as const

/**
 * FR-KPI-002/003, FR-SDT-021: KPI Profiles — named groups of KPIs for missions with similar
 * work. A mission on a profile tracks the profile's KPIs, and the target planner's profile
 * defaults apply to it unless it has a target of its own; a mission on no profile tracks
 * every KPI. A mission follows one profile, so assigning it here moves it off any other.
 */
export function KpiProfilesPanel({ definitions, ministryId }: { definitions: KpiDefinition[]; ministryId: string }) {
  const { t } = useI18n()
  const copy = t.kpi.profiles
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [selectedKpis, setSelectedKpis] = useState<string[]>([])
  const [assigning, setAssigning] = useState<KpiProfile | null>(null)

  const profilesQuery = useQuery({ queryKey: PROFILES_KEY, queryFn: listKpiProfiles, retry: retryUnlessClientError })
  const missionsQuery = useQuery({ queryKey: ['missions'], queryFn: listMissions, retry: retryUnlessClientError })

  const activeDefinitions = definitions.filter((definition) => definition.active && (!ministryId || definition.ministry_id === ministryId))
  const profiles = (profilesQuery.data ?? []).filter((profile) => !ministryId || profile.ministry_id === ministryId)
  const postings = (missionsQuery.data ?? []).filter(
    (mission) => mission.active && (mission.mission_ministry_links ?? []).some((link) => !ministryId || link.ministry_id === ministryId),
  )

  const createMutation = useMutation({
    mutationFn: () => createKpiProfile({ ministry_id: ministryId || undefined, name: name.trim(), kpi_definition_ids: selectedKpis }),
    onSuccess: () => {
      setName('')
      setSelectedKpis([])
      void queryClient.invalidateQueries({ queryKey: ['kpi'] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim() !== '' && selectedKpis.length > 0) {
      createMutation.mutate()
    }
  }

  return (
    <DashboardCard title={copy.title} subtitle={copy.subtitle} icon={<Squares2X2Icon />} tone="directive" className="mt-8" bodyClassName="space-y-6">
      {profiles.length === 0 ? (
        <PanelEmpty icon={<Squares2X2Icon />} title={copy.emptyTitle} body={copy.empty} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="kpi-profiles">
          {profiles.map((profile) => (
            <li key={profile.id} className="rounded-lg p-4 ring-1 ring-border">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-h4 text-primary">{profile.name}</h3>
                <button
                  type="button"
                  onClick={() => setAssigning(profile)}
                  className="inline-flex items-center gap-1.5 rounded border border-border bg-white px-3 py-1.5 text-body-sm font-semibold text-primary hover:bg-section-bg"
                >
                  <ArrowsRightLeftIcon aria-hidden="true" className="size-4" />
                  {copy.assign}
                </button>
              </div>
              <p className="mt-2 text-caption font-semibold uppercase tracking-wide text-text-secondary">{copy.kpis(profile.kpi_definitions.length)}</p>
              <p className="mt-1 text-body-sm text-text-primary">{profile.kpi_definitions.map((kpi) => kpi.name).join(' · ') || '—'}</p>
              <p className="mt-3 text-caption font-semibold uppercase tracking-wide text-text-secondary">{copy.missions(profile.assigned_missions.length)}</p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {profile.assigned_missions.length === 0 ? (
                  <span className="text-body-sm text-text-muted">{copy.noMissions}</span>
                ) : (
                  profile.assigned_missions.map((mission) => (
                    <span key={mission.id} className="inline-flex items-center gap-1 rounded-full bg-section-bg px-2 py-0.5 text-caption text-text-secondary">
                      <MapPinIcon aria-hidden="true" className="size-3" />
                      {mission.name}
                    </span>
                  ))
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="rounded-lg bg-page-bg p-4 ring-1 ring-border" aria-labelledby="kpi-profile-new">
        <h3 id="kpi-profile-new" className="text-h4 text-primary">
          {copy.newTitle}
        </h3>
        <div className="mt-3 max-w-md">
          <Input label={copy.nameLabel} required value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.namePlaceholder} />
        </div>
        <fieldset className="mt-4">
          <legend className="text-body-sm font-semibold text-text-secondary">{copy.kpisLabel}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {activeDefinitions.map((definition) => (
              <label key={definition.id} className="flex items-start gap-2 rounded-md bg-white px-3 py-2 text-body-sm ring-1 ring-border">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={selectedKpis.includes(definition.id)}
                  onChange={(event) =>
                    setSelectedKpis((previous) => (event.target.checked ? [...previous, definition.id] : previous.filter((id) => id !== definition.id)))
                  }
                />
                {definition.name}
              </label>
            ))}
          </div>
        </fieldset>
        {createMutation.isError && (
          <p role="alert" className="mt-3 text-body-sm text-danger-soft-text">
            {apiErrorMessages(createMutation.error, t.common.genericError)[0]}
          </p>
        )}
        <button
          type="submit"
          disabled={createMutation.isPending || name.trim() === '' || selectedKpis.length === 0}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light disabled:opacity-60"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          {copy.create}
        </button>
      </form>

      <Modal open={assigning !== null} onClose={() => setAssigning(null)} title={assigning ? copy.assignTitle(assigning.name) : undefined} size="xl">
        {assigning && <AssignMissions profile={assigning} profiles={profiles} postings={postings} onDone={() => setAssigning(null)} />}
      </Modal>
    </DashboardCard>
  )
}

function AssignMissions({ profile, profiles, postings, onDone }: { profile: KpiProfile; profiles: KpiProfile[]; postings: Mission[]; onDone: () => void }) {
  const { t } = useI18n()
  const copy = t.kpi.profiles
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string[]>(profile.assigned_missions.map((mission) => mission.id))
  const otherProfileOf = new Map<string, string>()
  profiles
    .filter((other) => other.id !== profile.id)
    .forEach((other) => other.assigned_missions.forEach((mission) => otherProfileOf.set(mission.id, other.name)))

  const mutation = useMutation({
    mutationFn: () => assignKpiProfile(profile.id, selected),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kpi'] })
      onDone()
    },
  })

  return (
    <div>
      <p className="text-body-sm text-text-secondary">{copy.assignHelp}</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {postings.map((mission) => {
          const checked = selected.includes(mission.id)
          const other = otherProfileOf.get(mission.id)
          return (
            <li key={mission.id}>
              <label className="flex items-start gap-2 rounded-md px-3 py-2 text-body-sm ring-1 ring-border">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={checked}
                  onChange={(event) => setSelected((previous) => (event.target.checked ? [...previous, mission.id] : previous.filter((id) => id !== mission.id)))}
                />
                <span>
                  <span className="block font-semibold text-text-primary">{mission.name}</span>
                  {other && <span className={`block text-caption ${checked ? 'font-semibold text-atrisk-soft-text' : 'text-text-secondary'}`}>{checked ? copy.willMove(other) : copy.onProfile(other)}</span>}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {mutation.isError && (
        <p role="alert" className="mt-3 text-body-sm text-danger-soft-text">
          {apiErrorMessages(mutation.error, t.common.genericError)[0]}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <button type="button" onClick={onDone} className="inline-flex h-10 items-center rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
          {copy.cancel}
        </button>
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="inline-flex h-10 items-center rounded bg-primary px-4 text-button text-white hover:bg-primary-light disabled:opacity-60">
          {mutation.isPending ? copy.saving : copy.save(selected.length)}
        </button>
      </div>
    </div>
  )
}
