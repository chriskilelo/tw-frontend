import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  LockClosedIcon,
  MapPinIcon,
  PencilSquareIcon,
  PhoneIcon,
  SparklesIcon,
  Squares2X2Icon,
  UserCircleIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/20/solid'
import { getInquiryCategories, logInquiry, type InquiryCreateRequest, type InquirySubType } from '../../api/inquiries'
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
  RequiredMarker,
  TimelineStep,
} from '../../components/FormLayout'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { InquiryStatusBadge } from './InquiryStatusBadge'
import { InquirySubTypeBadge } from './InquirySubTypeBadge'
import { HighValueToggle, IconInput } from './InquiryFormFields'
import {
  DISPUTES_CATEGORY,
  EMAIL_PATTERN,
  SUB_TYPE_ICONS,
  SUB_TYPE_TONES,
  categoryIcon,
  localDateString,
  type HeroIcon,
} from './inquiryPresentation'

type SectionKey = 'classification' | 'inquirer' | 'details'

function exampleReferenceNumber(): string {
  const now = new Date()
  return `INQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-00128`
}

/**
 * FR-INQ-002, FR-INQ-003, FR-INQ-004, FR-INQ-022. Country, mission and
 * logged_by are system-derived from the session (BR-014), so they are shown
 * read-only in the side panel rather than collected. Only category, inquirer
 * name and date received are mandatory (StoreInquiryRequest).
 */
export default function LogInquiryPage() {
  const { t } = useI18n()
  const copy = t.inquiries.log
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const idPrefix = useId()

  const categoriesQuery = useQuery({
    queryKey: ['inquiry-categories'],
    queryFn: getInquiryCategories,
  })

  const todayString = localDateString(new Date())

  const [inquirerName, setInquirerName] = useState('')
  const [inquirerOrganisation, setInquirerOrganisation] = useState('')
  const [inquirerEmail, setInquirerEmail] = useState('')
  const [inquirerPhone, setInquirerPhone] = useState('')
  const [category, setCategory] = useState('')
  const [subType, setSubType] = useState<InquirySubType>('standard')
  const [description, setDescription] = useState('')
  const [productOrSector, setProductOrSector] = useState('')
  const [dateReceived, setDateReceived] = useState(todayString)
  const [isHighValue, setIsHighValue] = useState(false)
  const [highValueJustification, setHighValueJustification] = useState('')
  const [isEmailTouched, setIsEmailTouched] = useState(false)

  const mutation = useMutation({
    mutationFn: (payload: InquiryCreateRequest) => logInquiry(payload),
    onSuccess: (inquiry) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      navigate(`/inquiries/${inquiry.id}`)
    },
  })

  const trimmedEmail = inquirerEmail.trim()
  const isEmailValid = trimmedEmail === '' || EMAIL_PATTERN.test(trimmedEmail)
  const isDateInFuture = dateReceived > todayString
  const hasContact = trimmedEmail !== '' || inquirerPhone.trim() !== ''
  const showEmailError = isEmailTouched && !isEmailValid
  const showDisputeMismatch = category === DISPUTES_CATEGORY && subType === 'standard'

  const fieldCompletion = [
    { key: 'category', label: copy.categoryLabel, isRequired: true, isDone: category !== '' },
    { key: 'name', label: copy.inquirerNameLabel, isRequired: true, isDone: inquirerName.trim() !== '' },
    { key: 'date', label: copy.dateReceivedLabel, isRequired: true, isDone: dateReceived !== '' && !isDateInFuture },
    { key: 'organisation', label: copy.inquirerOrganisationLabel, isRequired: false, isDone: inquirerOrganisation.trim() !== '' },
    { key: 'contact', label: copy.contactLabel, isRequired: false, isDone: hasContact && isEmailValid },
    { key: 'product', label: copy.productOrSectorLabel, isRequired: false, isDone: productOrSector.trim() !== '' },
    { key: 'description', label: copy.descriptionLabel, isRequired: false, isDone: description.trim() !== '' },
  ]
  const missingRequiredCount = fieldCompletion.filter((field) => field.isRequired && !field.isDone).length
  const hasInvalidField = !isEmailValid || isDateInFuture
  const canSubmit = missingRequiredCount === 0 && !hasInvalidField

  const sections: { key: SectionKey; label: string; isDone: boolean }[] = [
    { key: 'classification', label: copy.steps.classification, isDone: category !== '' },
    {
      key: 'inquirer',
      label: copy.steps.inquirer,
      isDone: inquirerName.trim() !== '' && hasContact && isEmailValid,
    },
    {
      key: 'details',
      label: copy.steps.details,
      isDone: dateReceived !== '' && !isDateInFuture && description.trim() !== '',
    },
  ]
  const sectionId = (key: SectionKey) => `${idPrefix}-section-${key}`

  function scrollToSection(key: SectionKey) {
    document.getElementById(sectionId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsEmailTouched(true)
    if (!canSubmit) {
      return
    }
    mutation.mutate({
      category,
      sub_type: subType,
      inquirer_name: inquirerName.trim(),
      inquirer_organisation: inquirerOrganisation.trim() || undefined,
      inquirer_email: trimmedEmail || undefined,
      inquirer_phone: inquirerPhone.trim() || undefined,
      product_or_sector: productOrSector.trim() || undefined,
      description: description.trim() || undefined,
      date_received: dateReceived,
      high_value_flag: isHighValue || undefined,
      high_value_justification: isHighValue ? highValueJustification.trim() || undefined : undefined,
    })
  }

  const statusLabel = missingRequiredCount > 0
    ? copy.status.missing(missingRequiredCount)
    : hasInvalidField
      ? copy.status.invalid
      : copy.status.ready
  const statusNote = missingRequiredCount > 0
    ? copy.status.missingNote
    : hasInvalidField
      ? copy.status.invalidNote
      : copy.status.readyNote

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <header className="mb-6">
        <h1 className="text-h1 text-primary">{t.inquiries.log.title}</h1>
        <p className="mt-1 max-w-[62ch] text-body text-text-secondary">{copy.lede}</p>
      </header>

      <div className="grid gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_320px] min-[1200px]:items-start">
        <form onSubmit={handleSubmit} data-testid="inquiry-form" noValidate className="flex min-w-0 flex-col gap-5">
          <FormSectionNav label={copy.stepsLabel} sections={sections} onSelect={scrollToSection} />

          <FormSection
            id={sectionId('classification')}
            icon={<Squares2X2Icon className="size-4.5" aria-hidden="true" />}
            title={copy.classificationSection.title}
            subtitle={copy.classificationSection.subtitle}
          >
            <fieldset className="col-span-full min-w-0">
              <legend className="mb-1.5 text-body-sm font-semibold text-text-secondary">
                {copy.categoryLabel} <RequiredMarker />
              </legend>
              {categoriesQuery.isLoading ? (
                <p className="text-body-sm text-text-muted">{t.common.loading}</p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {(categoriesQuery.data ?? []).map((option) => {
                    const CategoryIcon = categoryIcon(option.value)
                    return (
                      <ChoiceTile
                        key={option.id}
                        name="category"
                        value={option.value}
                        isChecked={category === option.value}
                        onSelect={setCategory}
                        isRequired
                        tone={NEUTRAL_TONE}
                        icon={<CategoryIcon className="size-4" aria-hidden="true" />}
                        title={option.value}
                        description={copy.categoryDescriptions[option.value]}
                      />
                    )
                  })}
                </div>
              )}
              {categoriesQuery.isError && (
                <p role="alert" className="text-body-sm text-danger-soft-text">
                  {t.common.genericError}
                </p>
              )}
            </fieldset>

            <div className="col-span-full h-px bg-border" aria-hidden="true" />

            <fieldset className="col-span-full min-w-0">
              <legend className="mb-1 text-body-sm font-semibold text-text-secondary">{copy.subTypeLabel}</legend>
              <p className="mb-2.5 text-caption text-text-muted">{copy.subTypeQuestion}</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {(['standard', 'dispute_or_complaint'] as const).map((value) => {
                  const SubTypeIcon = SUB_TYPE_ICONS[value]
                  return (
                    <ChoiceTile
                      key={value}
                      name="sub_type"
                      value={value}
                      isChecked={subType === value}
                      onSelect={(next) => setSubType(next as InquirySubType)}
                      tone={SUB_TYPE_TONES[value]}
                      icon={<SubTypeIcon className="size-4" aria-hidden="true" />}
                      title={t.inquiries.subType[value]}
                      description={copy.subTypeDescriptions[value]}
                    />
                  )
                })}
              </div>
              {showDisputeMismatch && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-info-soft px-3.5 py-2.5">
                  <p className="flex gap-2 text-caption leading-snug text-info-soft-text">
                    <InformationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
                    {copy.disputeMismatch}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubType('dispute_or_complaint')}
                    className="rounded px-1 text-body-sm font-semibold text-info hover:underline"
                  >
                    {copy.disputeMismatchAction}
                  </button>
                </div>
              )}
            </fieldset>
          </FormSection>

          <FormSection
            id={sectionId('inquirer')}
            icon={<UserIcon className="size-4.5" aria-hidden="true" />}
            title={copy.inquirerSection.title}
            subtitle={copy.inquirerSection.subtitle}
          >
            <FieldLabel htmlFor={`${idPrefix}-name`} label={copy.inquirerNameLabel} isRequired>
              <input
                id={`${idPrefix}-name`}
                required
                value={inquirerName}
                onChange={(event) => setInquirerName(event.target.value)}
                placeholder={copy.inquirerNamePlaceholder}
                maxLength={255}
                autoComplete="off"
                className={FORM_INPUT_CLASS}
              />
            </FieldLabel>

            <FieldLabel htmlFor={`${idPrefix}-organisation`} label={copy.inquirerOrganisationLabel} optionalText={copy.optional}>
              <input
                id={`${idPrefix}-organisation`}
                value={inquirerOrganisation}
                onChange={(event) => setInquirerOrganisation(event.target.value)}
                placeholder={copy.inquirerOrganisationPlaceholder}
                maxLength={255}
                autoComplete="off"
                className={FORM_INPUT_CLASS}
              />
            </FieldLabel>

            <FieldLabel htmlFor={`${idPrefix}-email`} label={copy.inquirerEmailLabel} optionalText={copy.optional}>
              <IconInput icon={EnvelopeIcon}>
                <input
                  id={`${idPrefix}-email`}
                  type="email"
                  inputMode="email"
                  value={inquirerEmail}
                  onChange={(event) => setInquirerEmail(event.target.value)}
                  onBlur={() => setIsEmailTouched(true)}
                  placeholder={copy.inquirerEmailPlaceholder}
                  maxLength={255}
                  autoComplete="off"
                  aria-invalid={showEmailError}
                  aria-describedby={showEmailError ? `${idPrefix}-email-error` : undefined}
                  className={`${FORM_INPUT_CLASS} pl-9`}
                />
              </IconInput>
              {showEmailError && <FieldError id={`${idPrefix}-email-error`} message={copy.emailInvalid} />}
            </FieldLabel>

            <FieldLabel htmlFor={`${idPrefix}-phone`} label={copy.inquirerPhoneLabel} optionalText={copy.optional}>
              <IconInput icon={PhoneIcon}>
                <input
                  id={`${idPrefix}-phone`}
                  type="tel"
                  inputMode="tel"
                  value={inquirerPhone}
                  onChange={(event) => setInquirerPhone(event.target.value)}
                  placeholder={copy.inquirerPhonePlaceholder}
                  maxLength={50}
                  autoComplete="off"
                  className={`${FORM_INPUT_CLASS} pl-9`}
                />
              </IconInput>
            </FieldLabel>

            {!hasContact && (
              <p className="col-span-full -mt-1.5 flex gap-2 text-caption text-text-muted">
                <InformationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
                {copy.contactHint}
              </p>
            )}
          </FormSection>

          <FormSection
            id={sectionId('details')}
            icon={<DocumentTextIcon className="size-4.5" aria-hidden="true" />}
            title={copy.detailsSection.title}
            subtitle={copy.detailsSection.subtitle}
          >
            <FieldLabel htmlFor={`${idPrefix}-product`} label={copy.productOrSectorLabel} optionalText={copy.optional}>
              <input
                id={`${idPrefix}-product`}
                value={productOrSector}
                onChange={(event) => setProductOrSector(event.target.value)}
                placeholder={copy.productOrSectorPlaceholder}
                maxLength={150}
                className={FORM_INPUT_CLASS}
              />
            </FieldLabel>

            <FieldLabel
              htmlFor={`${idPrefix}-date`}
              label={copy.dateReceivedLabel}
              isRequired
              trailing={
                dateReceived !== todayString && (
                  <button
                    type="button"
                    onClick={() => setDateReceived(todayString)}
                    className="ml-auto rounded px-1 text-caption font-semibold leading-none text-info hover:underline"
                  >
                    {copy.dateReceivedToday}
                  </button>
                )
              }
            >
              <input
                id={`${idPrefix}-date`}
                type="date"
                required
                max={todayString}
                value={dateReceived}
                onChange={(event) => setDateReceived(event.target.value)}
                aria-invalid={isDateInFuture}
                aria-describedby={`${idPrefix}-date-hint`}
                className={FORM_INPUT_CLASS}
              />
              {isDateInFuture ? (
                <FieldError id={`${idPrefix}-date-hint`} message={copy.dateReceivedFuture} />
              ) : (
                <p id={`${idPrefix}-date-hint`} className="mt-1.5 text-caption text-text-muted">
                  {copy.dateReceivedHint}
                </p>
              )}
            </FieldLabel>

            <FieldLabel
              htmlFor={`${idPrefix}-description`}
              label={copy.descriptionLabel}
              optionalText={copy.optional}
              className="col-span-full"
              trailing={
                <span className="ml-auto font-mono text-[0.6875rem] font-normal text-text-muted">
                  {copy.characterCount(description.length)}
                </span>
              }
            >
              <textarea
                id={`${idPrefix}-description`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder={copy.descriptionPlaceholder}
                aria-describedby={`${idPrefix}-description-hint`}
                className={`${FORM_INPUT_CLASS} min-h-30 resize-y`}
              />
              <p id={`${idPrefix}-description-hint`} className="mt-1.5 text-caption text-text-muted">
                {copy.descriptionHint}
              </p>
            </FieldLabel>

            <div className="col-span-full h-px bg-border" aria-hidden="true" />

            <div className="col-span-full min-w-0">
              <HighValueToggle
                id={`${idPrefix}-high-value`}
                isChecked={isHighValue}
                onChange={setIsHighValue}
                label={copy.highValueLabel}
                description={copy.highValueDescription}
                optionalText={copy.optional}
              />

              {isHighValue && (
                <FieldLabel
                  htmlFor={`${idPrefix}-justification`}
                  label={copy.highValueJustificationLabel}
                  optionalText={copy.optional}
                  className="mt-3.5"
                >
                  <textarea
                    id={`${idPrefix}-justification`}
                    value={highValueJustification}
                    onChange={(event) => setHighValueJustification(event.target.value)}
                    rows={2}
                    placeholder={copy.highValueJustificationPlaceholder}
                    className={`${FORM_INPUT_CLASS} resize-y`}
                  />
                </FieldLabel>
              )}
            </div>
          </FormSection>

          {mutation.isError && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3.5 py-2.5 text-body-sm text-danger-soft-text">
              <ExclamationCircleIcon className="size-4.5 shrink-0" aria-hidden="true" />
              {t.common.genericError}
            </p>
          )}

          <FormSubmitBar isReady={canSubmit} statusLabel={statusLabel} statusNote={statusNote}>
            <Button variant="secondary" onClick={() => navigate('/inquiries')} className="flex-1 sm:flex-none">
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending} className="flex-1 sm:flex-none">
              {copy.button}
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
            testId="inquiry-readiness-checklist"
            className="sm:col-span-2 min-[1200px]:col-span-1"
          />

          <FormSidePanel title={copy.recorded.title}>
            <dl className="flex flex-col gap-2.5">
              <RecordedRow icon={BuildingOffice2Icon} label={copy.recorded.mission} value={user?.mission?.name} emptyText={copy.recorded.notSet} />
              <RecordedRow
                icon={MapPinIcon}
                label={copy.recorded.country}
                value={user?.mission?.host_country}
                emptyText={copy.recorded.notSet}
              />
              <RecordedRow
                icon={UserCircleIcon}
                label={copy.recorded.loggedBy}
                value={[user?.full_name, role?.name].filter(Boolean).join(' · ')}
                emptyText={copy.recorded.notSet}
              />
            </dl>
            <p className="flex gap-2 rounded-lg bg-section-bg px-3 py-2 text-caption leading-snug text-text-secondary">
              <LockClosedIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
              {copy.recorded.note}
            </p>
          </FormSidePanel>

          <FormSidePanel title={copy.afterLog.title}>
            <InquiryPreviewCard
              referenceNumber={exampleReferenceNumber()}
              category={category}
              subType={subType}
              inquirerName={inquirerName.trim()}
              inquirerOrganisation={inquirerOrganisation.trim()}
              isHighValue={isHighValue}
              highValueLabel={copy.highValueLabel}
            />
            <ol className="flex flex-col">
              <TimelineStep
                badge={<PencilSquareIcon className="size-3.5" />}
                isHighlighted
                title={copy.afterLog.draft}
                note={copy.afterLog.draftNote}
              />
              <TimelineStep badge={<ArrowPathIcon className="size-3.5" />} title={copy.afterLog.working} note={copy.afterLog.workingNote} />
              <TimelineStep
                badge={<CheckBadgeIcon className="size-3.5" />}
                title={copy.afterLog.closing}
                note={copy.afterLog.closingNote}
                isLast
              />
            </ol>
            <p className="text-body-sm text-text-secondary">
              {copy.afterLog.referenceBefore}{' '}
              <span className="rounded bg-section-bg px-2 py-0.5 font-mono text-primary">{exampleReferenceNumber()}</span>{' '}
              {copy.afterLog.referenceAfter}
            </p>
          </FormSidePanel>
        </aside>
      </div>
    </div>
  )
}

interface RecordedRowProps {
  icon: HeroIcon
  label: string
  value: string | null | undefined
  emptyText: string
}

function RecordedRow({ icon: Icon, label, value, emptyText }: RecordedRowProps) {
  return (
    <div className="relative min-w-0 pl-9.5">
      <dt className="text-caption text-text-muted">
        <span className="absolute left-0 top-0 grid size-7 place-items-center rounded-md bg-section-bg text-text-secondary" aria-hidden="true">
          <Icon className="size-4" />
        </span>
        {label}
      </dt>
      <dd className={`truncate text-body-sm font-semibold ${value ? 'text-text-primary' : 'font-normal italic text-text-muted'}`}>
        {value || emptyText}
      </dd>
    </div>
  )
}

interface InquiryPreviewCardProps {
  referenceNumber: string
  category: string
  subType: InquirySubType
  inquirerName: string
  inquirerOrganisation: string
  isHighValue: boolean
  highValueLabel: string
}

/** Live preview of the list row the logged inquiry will produce. */
function InquiryPreviewCard({
  referenceNumber,
  category,
  subType,
  inquirerName,
  inquirerOrganisation,
  isHighValue,
  highValueLabel,
}: InquiryPreviewCardProps) {
  const CategoryIcon = category ? categoryIcon(category) : SparklesIcon
  return (
    <div className="rounded-lg border border-dashed border-border-muted bg-page-bg p-3" aria-hidden="true" data-testid="inquiry-preview">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-caption font-medium text-primary">{referenceNumber}</span>
        <InquiryStatusBadge status="draft" />
      </div>
      <p className={`mt-2 truncate text-body-sm font-semibold ${inquirerName ? 'text-text-primary' : 'text-text-muted'}`}>
        {inquirerName || '—'}
        {inquirerOrganisation && <span className="font-normal text-text-secondary"> · {inquirerOrganisation}</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {category && (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-section-bg px-2 py-0.5 text-caption text-text-secondary">
            <CategoryIcon className="size-3 shrink-0" />
            <span className="truncate">{category}</span>
          </span>
        )}
        <InquirySubTypeBadge subType={subType} />
        {isHighValue && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent-soft-text">
            <StarSolidIcon className="size-3" />
            {highValueLabel}
          </span>
        )}
      </div>
    </div>
  )
}
