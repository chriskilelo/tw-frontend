import { useId, useState } from 'react'
import { BuildingLibraryIcon, MagnifyingGlassIcon, MapPinIcon, NoSymbolIcon, UserIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/20/solid'
import type { DirectiveAssigneeMission } from '../../api/directives'
import { ChoiceTile } from '../../components/ChoiceTile'
import { NEUTRAL_TONE } from '../../components/choiceTileTones'
import { FORM_INPUT_CLASS, FieldError, RequiredMarker } from '../../components/FormLayout'
import { initials } from '../../lib/formatters'
import { useI18n } from '../../i18n/context'

/** Above this many missions the picker gets a search box (SDT has 17). */
const MISSION_SEARCH_THRESHOLD = 6

function matchesQuery(mission: DirectiveAssigneeMission, query: string): boolean {
  const haystack = [mission.name, mission.city, mission.host_country, ...mission.attaches.map((attache) => attache.full_name)]
    .join(' ')
    .toLocaleLowerCase()
  return haystack.includes(query.toLocaleLowerCase())
}

interface MissionPickerProps {
  missions: DirectiveAssigneeMission[]
  isLoading: boolean
  isError: boolean
  selectedId: string
  onSelect: (mission: DirectiveAssigneeMission) => void
  error?: string
}

/**
 * FR-DIR-002: the target mission, from GET /directives/assignees (missions linked to the
 * issuer's department). A mission with no posted attache cannot be tasked, so it is shown
 * disabled with the reason rather than hidden, which would look like a missing mission.
 */
export function MissionPicker({ missions, isLoading, isError, selectedId, onSelect, error }: MissionPickerProps) {
  const { t } = useI18n()
  const copy = t.directives.issue
  const idPrefix = useId()
  const [query, setQuery] = useState('')

  const trimmedQuery = query.trim()
  const visibleMissions = trimmedQuery ? missions.filter((mission) => matchesQuery(mission, trimmedQuery)) : missions
  const hasUnavailable = missions.some((mission) => mission.attaches.length === 0)
  const errorId = `${idPrefix}-error`

  return (
    <fieldset className="col-span-full min-w-0" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-body-sm font-semibold text-text-secondary">
        {copy.missionLabel} <RequiredMarker />
      </legend>

      {isLoading ? (
        <p className="text-body-sm text-text-muted">{t.common.loading}</p>
      ) : isError ? (
        <p role="alert" className="text-body-sm text-danger-soft-text">
          {copy.missionsError}
        </p>
      ) : missions.length === 0 ? (
        <p className="rounded-lg border-[1.5px] border-dashed border-border-muted bg-page-bg px-4 py-3 text-body-sm text-text-secondary">
          {copy.missionsEmpty}
        </p>
      ) : (
        <>
          {missions.length > MISSION_SEARCH_THRESHOLD && (
            <div className="relative mb-3">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <label htmlFor={`${idPrefix}-search`} className="sr-only">
                {copy.missionSearchLabel}
              </label>
              <input
                id={`${idPrefix}-search`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.missionSearchPlaceholder}
                autoComplete="off"
                className={`${FORM_INPUT_CLASS} pl-9`}
              />
            </div>
          )}

          {visibleMissions.length === 0 ? (
            <p className="text-body-sm italic text-text-muted" aria-live="polite">
              {copy.missionNoMatches}
            </p>
          ) : (
            <div className="-m-1 grid max-h-104 gap-2.5 overflow-y-auto p-1 sm:grid-cols-2" data-testid="directive-mission-options">
              {visibleMissions.map((mission) => (
                <MissionOption key={mission.id} mission={mission} isChecked={mission.id === selectedId} onSelect={onSelect} />
              ))}
            </div>
          )}

          {hasUnavailable && <p className="mt-2.5 text-caption text-text-muted">{copy.missionUnavailableHint}</p>}
        </>
      )}

      {error && <FieldError id={errorId} message={error} />}
    </fieldset>
  )
}

function MissionOption({
  mission,
  isChecked,
  onSelect,
}: {
  mission: DirectiveAssigneeMission
  isChecked: boolean
  onSelect: (mission: DirectiveAssigneeMission) => void
}) {
  const { t } = useI18n()
  const copy = t.directives.issue
  const inputId = useId()
  const isDisabled = mission.attaches.length === 0
  const titleId = `${inputId}-title`
  const detailId = `${inputId}-detail`

  return (
    <label
      htmlFor={inputId}
      className={`relative flex flex-col gap-1.5 rounded-xl border-[1.5px] p-3.5 pr-9 transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-info has-[input:focus-visible]:ring-offset-2 ${
        isDisabled
          ? 'cursor-not-allowed border-dashed border-border-muted bg-page-bg'
          : isChecked
            ? `cursor-pointer bg-white ${NEUTRAL_TONE.selected}`
            : 'cursor-pointer border-border-muted bg-white hover:border-text-muted'
      }`}
    >
      <input
        id={inputId}
        type="radio"
        name="mission_id"
        value={mission.id}
        checked={isChecked}
        disabled={isDisabled}
        onChange={() => onSelect(mission)}
        aria-labelledby={titleId}
        aria-describedby={detailId}
        className="sr-only"
      />
      <span className="flex items-center gap-2.5">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-lg ${isDisabled ? 'bg-section-bg text-text-muted' : NEUTRAL_TONE.icon}`}
          aria-hidden="true"
        >
          <BuildingLibraryIcon className="size-4" />
        </span>
        <span id={titleId} className={`text-body-sm font-semibold ${isDisabled ? 'text-text-secondary' : 'text-text-primary'}`}>
          {mission.name}
        </span>
      </span>
      <span id={detailId} className="flex flex-col gap-0.5 text-caption leading-snug text-text-secondary">
        <span className="flex items-center gap-1.5">
          <MapPinIcon className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
          {copy.missionLocation(mission.city, mission.host_country)}
        </span>
        {isDisabled ? (
          <span className="flex items-center gap-1.5 font-semibold text-text-secondary">
            <NoSymbolIcon className="size-3.5 shrink-0" aria-hidden="true" />
            {copy.missionNoAttache}
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5">
            <UserIcon className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
            <span className="truncate">{copy.missionAttaches(mission.attaches.map((attache) => attache.full_name).join(', '))}</span>
          </span>
        )}
      </span>
      <span
        className={`absolute right-3 top-3 grid size-4 place-items-center rounded-full border-[1.5px] ${
          isChecked ? `${NEUTRAL_TONE.indicator} text-white` : 'border-border-muted bg-white'
        }`}
        aria-hidden="true"
      >
        {isChecked && <CheckIcon className="size-3" />}
      </span>
    </label>
  )
}

interface AttachePickerProps {
  mission: DirectiveAssigneeMission | undefined
  selectedId: string
  onSelect: (attacheId: string) => void
  error?: string
}

/** FR-DIR-002: the target attache, limited to those posted at the chosen mission. */
export function AttachePicker({ mission, selectedId, onSelect, error }: AttachePickerProps) {
  const { t } = useI18n()
  const copy = t.directives.issue
  const errorId = useId()

  return (
    <fieldset className="col-span-full min-w-0" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-body-sm font-semibold text-text-secondary">
        {copy.attacheLabel} <RequiredMarker />
      </legend>
      {!mission ? (
        <p className="rounded-lg border-[1.5px] border-dashed border-border-muted bg-page-bg px-4 py-3 text-body-sm text-text-secondary">
          {copy.attacheChooseMission}
        </p>
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {mission.attaches.map((attache) => (
              <ChoiceTile
                key={attache.id}
                name="target_user_id"
                value={attache.id}
                isChecked={attache.id === selectedId}
                onSelect={onSelect}
                isRequired
                tone={NEUTRAL_TONE}
                icon={<span className="text-[0.6875rem] font-bold">{initials(attache.full_name)}</span>}
                title={attache.full_name}
                description={copy.attacheAt(mission.name)}
              />
            ))}
          </div>
          {mission.attaches.length === 1 && selectedId === mission.attaches[0].id && (
            <p className="mt-2 text-caption text-text-muted">{copy.attacheAutoSelected}</p>
          )}
        </>
      )}
      {error && <FieldError id={errorId} message={error} />}
    </fieldset>
  )
}
