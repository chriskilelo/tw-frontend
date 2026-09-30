import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  NoSymbolIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  ShieldExclamationIcon,
  TagIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import {
  getDirectiveTypeOptions,
  issueDirective,
  listDirectiveAssignees,
  type DirectiveAssigneeMission,
  type DirectiveCreateRequest,
} from '../../api/directives'
import { Button } from '../../components/Button'
import { ChoiceTile } from '../../components/ChoiceTile'
import { NEUTRAL_TONE } from '../../components/choiceTileTones'
import {
  FORM_INPUT_CLASS,
  FieldError,
  FieldLabel,
  FormReadinessPanel,
  FormSection,
  FormSectionNav,
  FormSidePanel,
  FormSubmitBar,
  TimelineStep,
} from '../../components/FormLayout'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { localeFor } from '../../lib/formatters'
import { DirectiveStatusBadge } from './DirectiveStatusBadge'
import { AttachePicker, MissionPicker } from './IssueDirectivePickers'
import { mapIssueDirectiveErrors, type IssueDirectiveField, type IssueDirectiveServerErrors } from './issueDirectiveErrors'
import { DIRECTIVE_TEXT_MAX, addDays, formatCalendarDate, localDateString } from './directivePresentation'

/**
 * Mirrors DirectivePolicy::create() (Ministry HQ Officer, Ministry PS, Acting PS — the latter
 * carries the PS permission set, FR-SDT-004 AC1). The page self-gates rather than relying only
 * on the sidebar hiding its link (TC-UI-006); the API remains the real guard.
 */
const ISSUING_ROLES = ['Ministry HQ Officer', 'Ministry PS', 'Acting PS']

type SectionKey = 'recipient' | 'directive' | 'timing' | 'review'
type DatePreset = 'none' | 'oneWeek' | 'twoWeeks' | 'thirtyDays' | 'custom'

const PRESET_DAYS: Record<Exclude<DatePreset, 'none' | 'custom'>, number> = {
  oneWeek: 7,
  twoWeeks: 14,
  thirtyDays: 30,
}

const NO_CATEGORY = ''

export default function IssueDirectivePage() {
  const { role } = useAuth()

  if (!role || !ISSUING_ROLES.includes(role.name)) {
    return <IssueForbidden />
  }

  return <IssueDirectiveForm />
}

function IssueForbidden() {
  const { t } = useI18n()
  const copy = t.directives.issue
  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger-soft-text">
          <ShieldExclamationIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-h3 text-primary">{copy.forbiddenTitle}</h1>
          <p className="mt-1 text-body text-text-secondary">{t.common.forbidden}</p>
          <p className="mt-1 text-body-sm text-text-muted">{copy.forbiddenBody}</p>
          <Link to="/directives" className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-semibold text-info hover:underline">
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {copy.backToDirectives}
          </Link>
        </div>
      </section>
    </div>
  )
}

/** FR-DIR-001, FR-DIR-002, FR-DIR-003. */
function IssueDirectiveForm() {
  const { t, language } = useI18n()
  const copy = t.directives.issue
  const locale = localeFor(language)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const idPrefix = useId()

  const assigneesQuery = useQuery({ queryKey: ['directives', 'assignees'], queryFn: listDirectiveAssignees })
  const typeOptionsQuery = useQuery({ queryKey: ['master-data', 'directive_type'], queryFn: getDirectiveTypeOptions })

  const todayString = localDateString()

  const [missionId, setMissionId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [typeCategory, setTypeCategory] = useState(NO_CATEGORY)
  const [description, setDescription] = useState('')
  const [isDescriptionTouched, setIsDescriptionTouched] = useState(false)
  const [datePreset, setDatePreset] = useState<DatePreset>('none')
  const [customDate, setCustomDate] = useState('')
  const [serverErrors, setServerErrors] = useState<IssueDirectiveServerErrors>({ fields: {}, general: [] })

  const missions = assigneesQuery.data ?? []
  const selectedMission = missions.find((mission) => mission.id === missionId)
  const selectedAttache = selectedMission?.attaches.find((attache) => attache.id === targetUserId)
  const typeOptions = typeOptionsQuery.data ?? []

  const targetDate =
    datePreset === 'none' ? '' : datePreset === 'custom' ? customDate : addDays(todayString, PRESET_DAYS[datePreset])

  const trimmedDescription = description.trim()
  const isDescriptionTooLong = trimmedDescription.length > DIRECTIVE_TEXT_MAX
  const isCustomDateMissing = datePreset === 'custom' && customDate === ''
  const isDateInPast = targetDate !== '' && targetDate < todayString
  const hasRecipient = Boolean(selectedMission && selectedAttache)
  const hasDescription = trimmedDescription !== '' && !isDescriptionTooLong
  const isTimingValid = !isCustomDateMissing && !isDateInPast

  const fieldCompletion = [
    { key: 'mission', label: copy.missionLabel, isRequired: true, isDone: Boolean(selectedMission) },
    { key: 'attache', label: copy.attacheLabel, isRequired: true, isDone: Boolean(selectedAttache) },
    { key: 'description', label: copy.descriptionLabel, isRequired: true, isDone: hasDescription },
    { key: 'type', label: copy.typeCategoryLabel, isRequired: false, isDone: typeCategory !== NO_CATEGORY },
    { key: 'date', label: copy.targetDateLabel, isRequired: false, isDone: targetDate !== '' && isTimingValid },
  ]
  const missingRequiredCount = fieldCompletion.filter((field) => field.isRequired && !field.isDone).length
  const hasInvalidField = isDescriptionTooLong || !isTimingValid
  const canSubmit = missingRequiredCount === 0 && !hasInvalidField

  const sections: { key: SectionKey; label: string; isDone: boolean }[] = [
    { key: 'recipient', label: copy.steps.recipient, isDone: hasRecipient },
    { key: 'directive', label: copy.steps.directive, isDone: hasDescription },
    { key: 'timing', label: copy.steps.timing, isDone: isTimingValid },
    { key: 'review', label: copy.steps.review, isDone: canSubmit },
  ]
  const sectionId = (key: SectionKey) => `${idPrefix}-section-${key}`

  function scrollToSection(key: SectionKey) {
    document.getElementById(sectionId(key))?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  function clearServerError(field: IssueDirectiveField) {
    setServerErrors((current) => {
      if (!current.fields[field]) {
        return current
      }
      const fields = { ...current.fields }
      delete fields[field]
      return { ...current, fields }
    })
  }

  const mutation = useMutation({
    mutationFn: (payload: DirectiveCreateRequest) => issueDirective(payload),
    onMutate: () => setServerErrors({ fields: {}, general: [] }),
    onSuccess: (directive) => {
      queryClient.invalidateQueries({ queryKey: ['directives'] })
      navigate(`/directives/${directive.id}`)
    },
    onError: (error) => {
      const mapped = mapIssueDirectiveErrors(error, t.common.genericError)
      setServerErrors(mapped)
      const firstField = (['mission', 'attache', 'type', 'description', 'date'] as const).find((field) => mapped.fields[field])
      if (firstField) {
        const sectionFor: Record<IssueDirectiveField, SectionKey> = {
          mission: 'recipient',
          attache: 'recipient',
          type: 'directive',
          description: 'directive',
          date: 'timing',
        }
        scrollToSection(sectionFor[firstField])
      }
    },
  })

  function selectMission(mission: DirectiveAssigneeMission) {
    setMissionId(mission.id)
    clearServerError('mission')
    clearServerError('attache')
    // Auto-select when the mission has exactly one posted attache; otherwise make the issuer choose.
    setTargetUserId(mission.attaches.length === 1 ? mission.attaches[0].id : '')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsDescriptionTouched(true)
    if (!canSubmit || mutation.isPending) {
      return
    }
    mutation.mutate({
      mission_id: missionId,
      target_user_id: targetUserId,
      type_category: typeCategory === NO_CATEGORY ? undefined : typeCategory,
      description: trimmedDescription,
      target_completion_date: targetDate || undefined,
    })
  }

  const statusLabel =
    missingRequiredCount > 0 ? copy.status.missing(missingRequiredCount) : hasInvalidField ? copy.status.invalid : copy.status.ready
  const statusNote =
    missingRequiredCount > 0 ? copy.status.missingNote : hasInvalidField ? copy.status.invalidNote : copy.status.readyNote

  const descriptionError =
    serverErrors.fields.description ??
    (isDescriptionTooLong
      ? copy.descriptionTooLong(DIRECTIVE_TEXT_MAX)
      : isDescriptionTouched && trimmedDescription === ''
        ? copy.descriptionRequired
        : undefined)
  const dateError =
    serverErrors.fields.date ?? (isDateInPast ? copy.dateInPast : isCustomDateMissing ? copy.customDateRequired : undefined)
  const hasFieldServerErrors = Object.keys(serverErrors.fields).length > 0

  const presets: { key: DatePreset; title: string; description: string }[] = [
    { key: 'none', title: copy.presets.none, description: copy.presets.noneDescription },
    ...(Object.keys(PRESET_DAYS) as (keyof typeof PRESET_DAYS)[]).map((key) => ({
      key,
      title: copy.presets[key],
      description: copy.presets.due(formatCalendarDate(addDays(todayString, PRESET_DAYS[key]), locale)),
    })),
    { key: 'custom', title: copy.presets.custom, description: copy.presets.customDescription },
  ]

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <header className="mb-6">
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        <p className="mt-1 max-w-[62ch] text-body text-text-secondary">{copy.lede}</p>
      </header>

      <div className="grid gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_320px] min-[1200px]:items-start">
        <form onSubmit={handleSubmit} data-testid="directive-form" noValidate className="flex min-w-0 flex-col gap-5">
          <FormSectionNav label={copy.stepsLabel} sections={sections} onSelect={scrollToSection} />

          <FormSection
            id={sectionId('recipient')}
            icon={<UserGroupIcon className="size-4.5" aria-hidden="true" />}
            title={copy.recipientSection.title}
            subtitle={copy.recipientSection.subtitle}
          >
            <MissionPicker
              missions={missions}
              isLoading={assigneesQuery.isLoading}
              isError={assigneesQuery.isError}
              selectedId={missionId}
              onSelect={selectMission}
              error={serverErrors.fields.mission}
            />
            <div className="col-span-full h-px bg-border" aria-hidden="true" />
            <AttachePicker
              mission={selectedMission}
              selectedId={targetUserId}
              onSelect={(id) => {
                setTargetUserId(id)
                clearServerError('attache')
              }}
              error={serverErrors.fields.attache}
            />
          </FormSection>

          <FormSection
            id={sectionId('directive')}
            icon={<DocumentTextIcon className="size-4.5" aria-hidden="true" />}
            title={copy.directiveSection.title}
            subtitle={copy.directiveSection.subtitle}
          >
            <fieldset className="col-span-full min-w-0" aria-describedby={serverErrors.fields.type ? `${idPrefix}-type-error` : undefined}>
              <legend className="mb-1.5 flex items-baseline gap-1.5 text-body-sm font-semibold text-text-secondary">
                {copy.typeCategoryLabel}
                <span className="text-caption font-normal text-text-muted">{copy.optional}</span>
              </legend>
              {typeOptionsQuery.isLoading ? (
                <p className="text-body-sm text-text-muted">{t.common.loading}</p>
              ) : (
                <>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    <ChoiceTile
                      name="type_category"
                      value={NO_CATEGORY}
                      isChecked={typeCategory === NO_CATEGORY}
                      onSelect={(value) => {
                        setTypeCategory(value)
                        clearServerError('type')
                      }}
                      tone={NEUTRAL_TONE}
                      icon={<NoSymbolIcon className="size-4" aria-hidden="true" />}
                      title={copy.typeCategoryNone}
                      description={copy.typeCategoryNoneDescription}
                    />
                    {typeOptions.map((option) => (
                      <ChoiceTile
                        key={option.id}
                        name="type_category"
                        value={option.value}
                        isChecked={typeCategory === option.value}
                        onSelect={(value) => {
                          setTypeCategory(value)
                          clearServerError('type')
                        }}
                        tone={NEUTRAL_TONE}
                        icon={<TagIcon className="size-4" aria-hidden="true" />}
                        title={option.value}
                      />
                    ))}
                  </div>
                  {typeOptions.length === 0 && (
                    <p className="mt-2.5 flex gap-2 text-caption leading-snug text-text-muted">
                      <InformationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
                      {typeOptionsQuery.isError ? copy.typeCategoriesError : copy.typeCategoriesEmpty}
                    </p>
                  )}
                </>
              )}
              {serverErrors.fields.type && <FieldError id={`${idPrefix}-type-error`} message={serverErrors.fields.type} />}
            </fieldset>

            <FieldLabel
              htmlFor={`${idPrefix}-description`}
              label={copy.descriptionLabel}
              isRequired
              className="col-span-full"
              trailing={
                <span
                  className={`ml-auto font-mono text-[0.6875rem] font-normal ${isDescriptionTooLong ? 'text-danger-soft-text' : 'text-text-muted'}`}
                >
                  {copy.characterCount(description.length, DIRECTIVE_TEXT_MAX)}
                </span>
              }
            >
              <textarea
                id={`${idPrefix}-description`}
                required
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                  clearServerError('description')
                }}
                onBlur={() => setIsDescriptionTouched(true)}
                rows={6}
                maxLength={DIRECTIVE_TEXT_MAX}
                placeholder={copy.descriptionPlaceholder}
                aria-invalid={Boolean(descriptionError)}
                aria-describedby={`${idPrefix}-description-hint`}
                className={`${FORM_INPUT_CLASS} min-h-36 resize-y`}
              />
              {descriptionError ? (
                <FieldError id={`${idPrefix}-description-hint`} message={descriptionError} />
              ) : (
                <p id={`${idPrefix}-description-hint`} className="mt-1.5 text-caption text-text-muted">
                  {copy.descriptionHint}
                </p>
              )}
            </FieldLabel>
          </FormSection>

          <FormSection
            id={sectionId('timing')}
            icon={<CalendarDaysIcon className="size-4.5" aria-hidden="true" />}
            title={copy.timingSection.title}
            subtitle={copy.timingSection.subtitle}
          >
            <fieldset className="col-span-full min-w-0">
              <legend className="mb-1.5 flex items-baseline gap-1.5 text-body-sm font-semibold text-text-secondary">
                {copy.targetDateLabel}
                <span className="text-caption font-normal text-text-muted">{copy.optional}</span>
              </legend>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {presets.map((preset) => (
                  <ChoiceTile
                    key={preset.key}
                    name="target_date_preset"
                    value={preset.key}
                    isChecked={datePreset === preset.key}
                    onSelect={(value) => {
                      setDatePreset(value as DatePreset)
                      clearServerError('date')
                    }}
                    tone={NEUTRAL_TONE}
                    icon={
                      preset.key === 'none' ? (
                        <NoSymbolIcon className="size-4" aria-hidden="true" />
                      ) : preset.key === 'custom' ? (
                        <PencilSquareIcon className="size-4" aria-hidden="true" />
                      ) : (
                        <CalendarDaysIcon className="size-4" aria-hidden="true" />
                      )
                    }
                    title={preset.title}
                    description={preset.description}
                  />
                ))}
              </div>
            </fieldset>

            {datePreset === 'custom' && (
              <FieldLabel htmlFor={`${idPrefix}-custom-date`} label={copy.customDateLabel} isRequired>
                <input
                  id={`${idPrefix}-custom-date`}
                  type="date"
                  required
                  min={todayString}
                  value={customDate}
                  onChange={(event) => {
                    setCustomDate(event.target.value)
                    clearServerError('date')
                  }}
                  aria-invalid={Boolean(dateError)}
                  aria-describedby={dateError ? `${idPrefix}-date-error` : undefined}
                  className={FORM_INPUT_CLASS}
                />
              </FieldLabel>
            )}

            <div className="col-span-full min-w-0">
              {dateError && <FieldError id={`${idPrefix}-date-error`} message={dateError} />}
              <p className="mt-1.5 flex gap-2 rounded-lg bg-info-soft px-3.5 py-2.5 text-caption leading-snug text-info-soft-text">
                <BellAlertIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
                {copy.timingHelp}
              </p>
            </div>
          </FormSection>

          <FormSection
            id={sectionId('review')}
            icon={<ClipboardDocumentCheckIcon className="size-4.5" aria-hidden="true" />}
            title={copy.reviewSection.title}
            subtitle={copy.reviewSection.subtitle}
          >
            <dl className="col-span-full grid gap-3 sm:grid-cols-2" data-testid="directive-review">
              <ReviewRow
                label={copy.review.recipient}
                value={selectedMission && selectedAttache ? copy.review.recipientValue(selectedAttache.full_name, selectedMission.name) : null}
                emptyText={copy.review.notChosen}
              />
              <ReviewRow
                label={copy.review.targetDate}
                value={targetDate && isTimingValid ? formatCalendarDate(targetDate, locale) : datePreset === 'none' ? copy.presets.none : null}
                emptyText={copy.review.notChosen}
              />
              <ReviewRow label={copy.review.type} value={typeCategory || copy.typeCategoryNone} emptyText={copy.review.notChosen} />
              <ReviewRow
                label={copy.review.issuedBy}
                value={[user?.full_name, role?.name].filter(Boolean).join(' · ')}
                emptyText={copy.review.notChosen}
              />
              <ReviewRow
                label={copy.descriptionLabel}
                value={trimmedDescription ? <span className="whitespace-pre-line font-normal">{trimmedDescription}</span> : null}
                emptyText={copy.review.notChosen}
                className="sm:col-span-2"
              />
            </dl>
            <p className="col-span-full flex gap-2 text-caption leading-snug text-text-muted">
              <InformationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
              {copy.review.immutableNote}
            </p>
          </FormSection>

          {(serverErrors.general.length > 0 || hasFieldServerErrors) && (
            <div role="alert" className="flex gap-2 rounded-lg bg-danger-soft px-3.5 py-2.5 text-body-sm text-danger-soft-text">
              <ExclamationCircleIcon className="mt-px size-4.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold">{copy.serverErrorTitle}</p>
                {hasFieldServerErrors && <p>{copy.fieldErrorSummary}</p>}
                {serverErrors.general.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            </div>
          )}

          <FormSubmitBar isReady={canSubmit} statusLabel={statusLabel} statusNote={statusNote}>
            <Button variant="secondary" onClick={() => navigate('/directives')} className="flex-1 sm:flex-none">
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending} className="flex-1 sm:flex-none">
              {mutation.isPending ? copy.issuing : copy.button}
              <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </FormSubmitBar>
        </form>

        <aside className="grid min-w-0 gap-4 sm:grid-cols-2 min-[1200px]:sticky min-[1200px]:top-5 min-[1200px]:grid-cols-1">
          <FormReadinessPanel
            title={copy.readiness.title}
            progressLabel={copy.readiness.progressLabel}
            requiredNote={copy.readiness.requiredNote}
            doneText={copy.status.ready}
            fields={fieldCompletion}
            testId="directive-readiness-checklist"
            className="sm:col-span-2 min-[1200px]:col-span-1"
          />

          <FormSidePanel title={copy.afterIssue.title} className="sm:col-span-2 min-[1200px]:col-span-1">
            <div className="flex items-center gap-2">
              <DirectiveStatusBadge status="issued" />
              <span className="text-caption text-text-muted">{copy.afterIssue.startsAs}</span>
            </div>
            <ol className="flex flex-col">
              <TimelineStep
                badge={<PaperAirplaneIcon className="size-3.5" />}
                isHighlighted
                title={copy.afterIssue.issued}
                note={selectedAttache ? copy.afterIssue.issuedNoteNamed(selectedAttache.full_name) : copy.afterIssue.issuedNote}
              />
              <TimelineStep badge={<ClockIcon className="size-3.5" />} title={copy.afterIssue.working} note={copy.afterIssue.workingNote} />
              <TimelineStep
                badge={<CheckBadgeIcon className="size-3.5" />}
                title={copy.afterIssue.closing}
                note={copy.afterIssue.closingNote}
                isLast
              />
            </ol>
          </FormSidePanel>
        </aside>
      </div>
    </div>
  )
}

function ReviewRow({ label, value, emptyText, className = '' }: { label: string; value: ReactNode; emptyText: string; className?: string }) {
  const hasValue = value !== null && value !== undefined && value !== ''
  return (
    <div className={`min-w-0 rounded-lg border border-border bg-page-bg px-3.5 py-2.5 ${className}`}>
      <dt className="text-caption font-medium text-text-secondary">{label}</dt>
      <dd className={`wrap-break-word text-body-sm ${hasValue ? 'font-semibold text-text-primary' : 'italic text-text-muted'}`}>
        {hasValue ? value : emptyText}
      </dd>
    </div>
  )
}
