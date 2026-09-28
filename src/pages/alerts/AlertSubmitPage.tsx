import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  ArrowUpTrayIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  MapPinIcon,
  NoSymbolIcon,
  PaperClipIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { XMarkIcon } from '@heroicons/react/20/solid'
import {
  getAlertIntelligenceTypeOptions,
  submitAlert,
  uploadAlertAttachment,
  type AlertCreateRequest,
} from '../../api/alerts'
import { Button } from '../../components/Button'
import { ChoiceTile } from '../../components/ChoiceTile'
import { NEUTRAL_TONE, type TileTone } from '../../components/choiceTileTones'
import {
  FORM_INPUT_CLASS,
  FieldLabel,
  FormReadinessPanel,
  FormSection,
  FormSectionNav,
  FormSidePanel,
  FormSubmitBar,
  OptionalMarker,
  RequiredMarker,
  TimelineStep,
} from '../../components/FormLayout'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { SignalStrength } from './SignalStrength'
import {
  CONFIDENCE_VALUES,
  URGENCY_ICONS,
  URGENCY_TONES,
  URGENCY_VALUES,
  type ConfidenceValue,
  type UrgencyValue,
} from './alertAssessment'

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
// Must match StoreAlertAttachmentRequest's 'extensions' allowlist exactly (NFR-SEC-004,
// Session 38) — this list previously included doc/docx/xls/xlsx, which the backend
// stopped accepting when that hardening pass narrowed the allowlist; the frontend was
// never updated to match, so those files silently 422'd after the alert itself had
// already been created (UI-007 gap, closed here).
const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'mp4', 'log']
const ACCEPTED_ATTACHMENT_TYPES = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',')
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png']
const DESCRIPTION_MAX_LENGTH = 2000

const SUGGESTED_TAGS = ['horticulture', 'SPS', 'EPA', 'tender']

type KnownIntelligenceType = 'opportunities' | 'trade_barriers'
type SectionKey = 'type' | 'market' | 'intelligence' | 'assessment' | 'evidence'

const INTELLIGENCE_TYPE_TONES: Record<KnownIntelligenceType, TileTone> = {
  opportunities: { ...NEUTRAL_TONE, icon: 'bg-success-soft text-success' },
  trade_barriers: { ...NEUTRAL_TONE, icon: 'bg-danger-soft text-danger-soft-text' },
}

function isKnownIntelligenceType(value: string): value is KnownIntelligenceType {
  return value === 'opportunities' || value === 'trade_barriers'
}

function fileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`
}

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function exampleReferenceNumber(): string {
  const now = new Date()
  return `ALT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-00412`
}

/**
 * FR-ALERT-002, FR-ALERT-003, FR-ALERT-004. The Intelligence Type tiles are
 * populated from GET /master-data (the configured option list); every
 * other field is fixed per CLAUDE.md Section 8's Alert Field Schema table
 * (see api/alerts.ts's getAlertIntelligenceTypeOptions() note on why
 * `/alert-fields` itself isn't reachable from this role). Only Country and
 * Intelligence Type are mandatory (StoreAlertRequest, BR-011).
 */
export default function AlertSubmitPage() {
  const { t } = useI18n()
  const copy = t.alerts.submit
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()

  const intelligenceTypesQuery = useQuery({
    queryKey: ['master-data', 'alert_intelligence_type'],
    queryFn: getAlertIntelligenceTypeOptions,
  })

  const missionCountry = user?.mission?.host_country ?? ''
  const [countryOverride, setCountryOverride] = useState<string | null>(null)
  const [shouldFocusCountry, setShouldFocusCountry] = useState(false)
  const [sector, setSector] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [intelligenceType, setIntelligenceType] = useState('')
  const [intelligenceSource, setIntelligenceSource] = useState('')
  const [urgency, setUrgency] = useState<UrgencyValue | ''>('')
  const [confidenceRating, setConfidenceRating] = useState<ConfidenceValue | ''>('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const countryInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const idPrefix = useId()

  const isCountryPrefilled = Boolean(missionCountry) && countryOverride === null
  const country = countryOverride ?? missionCountry

  useEffect(() => {
    if (shouldFocusCountry) {
      countryInputRef.current?.focus()
      setShouldFocusCountry(false)
    }
  }, [shouldFocusCountry])

  const mutation = useMutation({
    mutationFn: async (payload: AlertCreateRequest) => {
      const alert = await submitAlert(payload)
      for (const file of files) {
        await uploadAlertAttachment(alert.id, file)
      }
      return alert
    },
    onSuccess: (alert) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      navigate(`/alerts/${alert.id}`)
    },
  })

  const fieldCompletion = [
    { key: 'type', label: copy.intelligenceTypeLabel, isRequired: true, isDone: intelligenceType !== '' },
    { key: 'country', label: copy.countryLabel, isRequired: true, isDone: country.trim() !== '' },
    { key: 'sector', label: copy.sectorLabel, isRequired: false, isDone: sector.trim() !== '' },
    { key: 'category', label: copy.productCategoryLabel, isRequired: false, isDone: productCategory.trim() !== '' },
    { key: 'description', label: copy.productDescriptionLabel, isRequired: false, isDone: productDescription.trim() !== '' },
    { key: 'source', label: copy.intelligenceSourceLabel, isRequired: false, isDone: intelligenceSource.trim() !== '' },
    { key: 'urgency', label: copy.urgencyLabel, isRequired: false, isDone: urgency !== '' },
    { key: 'confidence', label: copy.confidenceRatingLabel, isRequired: false, isDone: confidenceRating !== '' },
    { key: 'tags', label: copy.tagsLabel, isRequired: false, isDone: tags.length > 0 },
    { key: 'evidence', label: copy.attachmentsLabel, isRequired: false, isDone: files.length > 0 },
  ]
  const missingRequiredCount = fieldCompletion.filter((field) => field.isRequired && !field.isDone).length
  const canSubmit = missingRequiredCount === 0

  const sections: { key: SectionKey; label: string; isDone: boolean }[] = [
    { key: 'type', label: copy.steps.type, isDone: intelligenceType !== '' },
    {
      key: 'market',
      label: copy.steps.market,
      isDone: country.trim() !== '' && (sector.trim() !== '' || productCategory.trim() !== ''),
    },
    {
      key: 'intelligence',
      label: copy.steps.intelligence,
      isDone: productDescription.trim() !== '' && intelligenceSource.trim() !== '',
    },
    { key: 'assessment', label: copy.steps.assessment, isDone: urgency !== '' && confidenceRating !== '' },
    { key: 'evidence', label: copy.steps.evidence, isDone: tags.length > 0 || files.length > 0 },
  ]
  const sectionId = (key: SectionKey) => `${idPrefix}-section-${key}`

  function scrollToSection(key: SectionKey) {
    document.getElementById(sectionId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function startEditingCountry() {
    setCountryOverride(missionCountry)
    setShouldFocusCountry(true)
  }

  function addTag(raw: string) {
    const value = raw.replace(/,/g, '').trim()
    if (value && !tags.includes(value)) {
      setTags((current) => [...current, value])
    }
    setTagInput('')
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(tagInput)
    } else if (event.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags((current) => current.slice(0, -1))
    }
  }

  function removeTag(value: string) {
    setTags((current) => current.filter((tag) => tag !== value))
  }

  function addFiles(selected: File[]) {
    if (selected.length === 0) {
      return
    }

    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_BYTES)
    if (oversized) {
      setFileError(copy.attachmentsSizeError)
      return
    }

    const invalidType = selected.find((file) => !ACCEPTED_EXTENSIONS.includes(fileExtension(file.name)))
    if (invalidType) {
      setFileError(copy.attachmentsTypeError)
      return
    }

    setFileError(null)
    setFiles((current) => [
      ...current,
      ...selected.filter((file) => !current.some((existing) => existing.name === file.name && existing.size === file.size)),
    ])
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function handleFileDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDraggingFile(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  function removeFile(name: string) {
    setFiles((current) => current.filter((file) => file.name !== name))
  }

  function clearAssessment() {
    setUrgency('')
    setConfidenceRating('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    mutation.mutate({
      country: country.trim(),
      intelligence_type: intelligenceType as AlertCreateRequest['intelligence_type'],
      sector: sector || undefined,
      product_category: productCategory || undefined,
      product_description: productDescription || undefined,
      intelligence_source: intelligenceSource || undefined,
      urgency: urgency || undefined,
      confidence_rating: confidenceRating || undefined,
      tags: tags.length > 0 ? tags : undefined,
    })
  }

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <header className="mb-6">
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        <p className="mt-1 max-w-[62ch] text-body text-text-secondary">{copy.lede}</p>
      </header>

      <div className="grid gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_320px] min-[1200px]:items-start">
        <form onSubmit={handleSubmit} data-testid="alert-form" noValidate className="flex min-w-0 flex-col gap-5">
          <FormSectionNav label={copy.stepsLabel} sections={sections} onSelect={scrollToSection} />

          <FormSection
            id={sectionId('type')}
            icon={<ArrowTrendingUpIcon className="size-4.5" aria-hidden="true" />}
            title={copy.typeSection.title}
            subtitle={copy.typeSection.subtitle}
          >
            <fieldset className="col-span-full min-w-0">
              <legend className="mb-1.5 text-body-sm font-semibold text-text-secondary">
                {copy.intelligenceTypeLabel} <RequiredMarker />
              </legend>
              {intelligenceTypesQuery.isLoading ? (
                <p className="text-body-sm text-text-muted">{t.common.loading}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(intelligenceTypesQuery.data ?? []).map((option) => {
                    const isKnown = isKnownIntelligenceType(option.value)
                    const OptionIcon = option.value === 'trade_barriers' ? NoSymbolIcon : ArrowTrendingUpIcon
                    return (
                      <ChoiceTile
                        key={option.id}
                        name="intelligence_type"
                        value={option.value}
                        isChecked={intelligenceType === option.value}
                        onSelect={setIntelligenceType}
                        isRequired
                        tone={isKnown ? INTELLIGENCE_TYPE_TONES[option.value as KnownIntelligenceType] : NEUTRAL_TONE}
                        icon={<OptionIcon className="size-4.5" aria-hidden="true" />}
                        iconSize="large"
                        title={isKnown ? t.alerts.intelligenceType[option.value as KnownIntelligenceType] : option.value}
                        description={isKnown ? copy.typeDescriptions[option.value as KnownIntelligenceType] : undefined}
                      />
                    )
                  })}
                </div>
              )}
            </fieldset>
          </FormSection>

          <FormSection
            id={sectionId('market')}
            icon={<GlobeAltIcon className="size-4.5" aria-hidden="true" />}
            title={copy.marketSection.title}
            subtitle={copy.marketSection.subtitle}
          >
            <div className="flex min-w-0 flex-col">
              {isCountryPrefilled ? (
                <>
                  <span className="mb-1.5 text-body-sm font-semibold text-text-secondary">
                    {copy.countryLabel} <RequiredMarker />
                  </span>
                  <div className="flex items-center gap-2 rounded-lg border border-border-muted bg-section-bg px-3 py-2">
                    <MapPinIcon className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                    <p
                      className="min-w-0 flex-1 truncate text-body font-semibold text-text-primary"
                      data-testid="alert-country-prefilled"
                    >
                      {missionCountry}
                    </p>
                    <button
                      type="button"
                      onClick={startEditingCountry}
                      aria-label={`${copy.changeCountry} ${copy.countryLabel}`}
                      className="shrink-0 rounded px-1 text-body-sm font-semibold leading-none text-info hover:underline"
                    >
                      {copy.changeCountry}
                    </button>
                  </div>
                  <p className="mt-1.5 truncate text-caption text-text-muted">
                    {copy.countryFromMission(user?.mission?.name ?? '')}
                  </p>
                </>
              ) : (
                <FieldLabel htmlFor={`${idPrefix}-country`} label={copy.countryLabel} isRequired>
                  <input
                    ref={countryInputRef}
                    id={`${idPrefix}-country`}
                    required
                    value={country}
                    onChange={(event) => setCountryOverride(event.target.value)}
                    className={FORM_INPUT_CLASS}
                  />
                </FieldLabel>
              )}
            </div>

            <FieldLabel htmlFor={`${idPrefix}-sector`} label={copy.sectorLabel} optionalText={copy.optional}>
              <input
                id={`${idPrefix}-sector`}
                value={sector}
                onChange={(event) => setSector(event.target.value)}
                placeholder={copy.sectorPlaceholder}
                maxLength={100}
                className={FORM_INPUT_CLASS}
              />
            </FieldLabel>

            <FieldLabel
              htmlFor={`${idPrefix}-category`}
              label={copy.productCategoryLabel}
              optionalText={copy.optional}
              className="col-span-full"
            >
              <input
                id={`${idPrefix}-category`}
                value={productCategory}
                onChange={(event) => setProductCategory(event.target.value)}
                placeholder={copy.productCategoryPlaceholder}
                maxLength={150}
                className={FORM_INPUT_CLASS}
              />
            </FieldLabel>
          </FormSection>

          <FormSection
            id={sectionId('intelligence')}
            icon={<DocumentTextIcon className="size-4.5" aria-hidden="true" />}
            title={copy.intelligenceSection.title}
            subtitle={copy.intelligenceSection.subtitle}
          >
            <FieldLabel
              htmlFor={`${idPrefix}-description`}
              label={copy.productDescriptionLabel}
              optionalText={copy.optional}
              className="col-span-full"
              trailing={
                <span className="ml-auto font-mono text-[0.6875rem] font-normal text-text-muted">
                  {copy.characterCount(productDescription.length, DESCRIPTION_MAX_LENGTH)}
                </span>
              }
            >
              <textarea
                id={`${idPrefix}-description`}
                value={productDescription}
                onChange={(event) => setProductDescription(event.target.value)}
                maxLength={DESCRIPTION_MAX_LENGTH}
                rows={5}
                placeholder={copy.productDescriptionPlaceholder}
                aria-describedby={`${idPrefix}-description-hint`}
                className={`${FORM_INPUT_CLASS} min-h-30 resize-y`}
              />
              <p id={`${idPrefix}-description-hint`} className="mt-1.5 text-caption text-text-muted">
                {copy.productDescriptionHint}
              </p>
            </FieldLabel>

            <FieldLabel
              htmlFor={`${idPrefix}-source`}
              label={copy.intelligenceSourceLabel}
              optionalText={copy.optional}
              className="col-span-full"
            >
              <input
                id={`${idPrefix}-source`}
                value={intelligenceSource}
                onChange={(event) => setIntelligenceSource(event.target.value)}
                placeholder={copy.intelligenceSourcePlaceholder}
                maxLength={255}
                className={FORM_INPUT_CLASS}
              />
            </FieldLabel>
          </FormSection>

          <FormSection
            id={sectionId('assessment')}
            icon={<ClipboardDocumentCheckIcon className="size-4.5" aria-hidden="true" />}
            title={copy.assessmentSection.title}
            subtitle={copy.assessmentSection.subtitle}
          >
            <fieldset className="col-span-full min-w-0">
              <legend className="mb-1 text-body-sm font-semibold text-text-secondary">
                {copy.urgencyLabel} <OptionalMarker text={copy.optional} />
              </legend>
              <p className="mb-2.5 text-caption text-text-muted">{copy.urgencyQuestion}</p>
              <div className="grid gap-2.5 md:grid-cols-3">
                {URGENCY_VALUES.map((value) => {
                  const option = copy.urgencyOptions[value]
                  const UrgencyIcon = URGENCY_ICONS[value]
                  return (
                    <ChoiceTile
                      key={value}
                      name="urgency"
                      value={value}
                      isChecked={urgency === value}
                      onSelect={(next) => setUrgency(next as UrgencyValue)}
                      tone={URGENCY_TONES[value]}
                      icon={<UrgencyIcon className="size-4" aria-hidden="true" />}
                      title={option.name}
                      description={option.description}
                      footer={
                        <span className="w-fit rounded bg-section-bg px-1.5 py-px font-mono text-[0.6875rem] text-text-secondary">
                          {option.timeframe}
                        </span>
                      }
                    />
                  )
                })}
              </div>
            </fieldset>

            <div className="col-span-full h-px bg-border" aria-hidden="true" />

            <fieldset className="col-span-full min-w-0">
              <legend className="mb-1 text-body-sm font-semibold text-text-secondary">
                {copy.confidenceRatingLabel} <OptionalMarker text={copy.optional} />
              </legend>
              <p className="mb-2.5 text-caption text-text-muted">{copy.confidenceQuestion}</p>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {CONFIDENCE_VALUES.map((value, index) => {
                  const option = copy.confidenceOptions[value]
                  return (
                    <ChoiceTile
                      key={value}
                      name="confidence_rating"
                      value={value}
                      isChecked={confidenceRating === value}
                      onSelect={(next) => setConfidenceRating(next as ConfidenceValue)}
                      tone={NEUTRAL_TONE}
                      icon={<SignalStrength level={index + 1} />}
                      title={option.name}
                      description={option.description}
                    />
                  )
                })}
              </div>
            </fieldset>

            <div
              className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-lg bg-section-bg px-3.5 py-2.5"
              aria-live="polite"
            >
              <span className="text-caption text-text-secondary">{copy.assessmentSummaryLabel}</span>
              <span className="flex flex-wrap items-center gap-2">
                <SummaryPill text={urgency ? copy.urgencyOptions[urgency].summary : copy.urgencyNotRated} isEmpty={!urgency} />
                <SummaryPill
                  text={confidenceRating ? copy.confidenceOptions[confidenceRating].summary : copy.confidenceNotRated}
                  isEmpty={!confidenceRating}
                />
                {(urgency || confidenceRating) && (
                  <button
                    type="button"
                    onClick={clearAssessment}
                    className="rounded px-1 text-body-sm font-semibold text-info hover:underline"
                  >
                    {copy.clearAssessment}
                  </button>
                )}
              </span>
            </div>
          </FormSection>

          <FormSection
            id={sectionId('evidence')}
            icon={<PaperClipIcon className="size-4.5" aria-hidden="true" />}
            title={copy.evidenceSection.title}
            subtitle={copy.evidenceSection.subtitle}
          >
            <div className="col-span-full min-w-0">
              <label htmlFor={`${idPrefix}-tags`} className="mb-1.5 flex items-baseline gap-1.5 text-body-sm font-semibold text-text-secondary">
                {copy.tagsLabel} <OptionalMarker text={copy.optional} />
              </label>
              <div
                className="flex min-h-10.5 cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-border-muted bg-white px-2 py-1.5 focus-within:border-info focus-within:ring-4 focus-within:ring-info-soft"
                onClick={() => tagInputRef.current?.focus()}
              >
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-info-soft py-0.5 pl-2.5 pr-1 text-caption font-semibold text-info"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeTag(tag)
                      }}
                      aria-label={copy.removeTag(tag)}
                      className="grid size-4.5 place-items-center rounded-full hover:bg-info/15"
                    >
                      <XMarkIcon className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  ref={tagInputRef}
                  id={`${idPrefix}-tags`}
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => tagInput && addTag(tagInput)}
                  placeholder={copy.tagsPlaceholder}
                  aria-describedby={`${idPrefix}-tags-hint`}
                  className="min-w-30 flex-1 border-0 bg-transparent p-1 text-body text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              </div>
              <p id={`${idPrefix}-tags-hint`} className="sr-only">
                {copy.tagsHint}
              </p>
              {SUGGESTED_TAGS.some((tag) => !tags.includes(tag)) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-caption text-text-muted">{copy.suggestedTags}</span>
                  {SUGGESTED_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="rounded-full border border-dashed border-border-muted bg-white px-2.5 py-0.5 text-caption text-text-secondary hover:border-info hover:text-info"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-full min-w-0">
              <span className="mb-1.5 flex items-baseline gap-1.5 text-body-sm font-semibold text-text-secondary">
                {copy.attachmentsLabel} <OptionalMarker text={copy.optional} />
              </span>
              <label
                htmlFor={`${idPrefix}-files`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDraggingFile(true)
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleFileDrop}
                className={`flex min-h-53 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed px-5 py-9 text-center transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-info ${
                  isDraggingFile ? 'border-info bg-info-soft' : 'border-border-muted bg-section-bg'
                }`}
              >
                <span className="mb-3 grid size-14 place-items-center rounded-xl border border-border bg-white text-text-secondary shadow-sm">
                  <ArrowUpTrayIcon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-[1rem] font-bold leading-snug text-text-primary">
                  {copy.dropzoneTitle}{' '}
                  <span className="underline decoration-accent decoration-2 underline-offset-[5px]">{copy.dropzoneBrowse}</span>
                </span>
                <span className="mt-1.5 text-body-sm text-text-secondary">{copy.attachmentsHint}</span>
                <input
                  id={`${idPrefix}-files`}
                  type="file"
                  multiple
                  accept={ACCEPTED_ATTACHMENT_TYPES}
                  onChange={handleFilesChange}
                  aria-label={copy.attachmentsLabel}
                  className="sr-only"
                />
              </label>
              {fileError && (
                <p role="alert" className="mt-2 flex items-center gap-1.5 text-caption font-semibold text-danger-soft-text">
                  <ExclamationCircleIcon className="size-4" aria-hidden="true" />
                  {fileError}
                </p>
              )}
              {files.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {files.map((file) => {
                    const extension = fileExtension(file.name)
                    return (
                      <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                        <span
                          className={`grid size-9.5 shrink-0 place-items-center rounded-md font-mono text-[0.6875rem] font-medium uppercase ${
                            IMAGE_EXTENSIONS.includes(extension)
                              ? 'bg-info-soft text-info'
                              : 'bg-danger-soft text-danger-soft-text'
                          }`}
                        >
                          {extension.slice(0, 4)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-text-primary">{file.name}</span>
                          <span className="font-mono text-[0.6875rem] text-text-muted">{formatFileSize(file.size)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(file.name)}
                          aria-label={copy.removeFile(file.name)}
                          className="grid size-7.5 place-items-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger-soft-text"
                        >
                          <TrashIcon className="size-4" aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </FormSection>

          {mutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

          <FormSubmitBar
            isReady={canSubmit}
            statusLabel={canSubmit ? copy.status.ready : copy.status.missing(missingRequiredCount)}
            statusNote={canSubmit ? copy.status.readyNote : copy.status.missingNote}
          >
            <Button variant="secondary" onClick={() => navigate('/alerts')} className="flex-1 sm:flex-none">
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
            testId="alert-readiness-checklist"
            className="sm:col-span-2 min-[1200px]:col-span-1"
          />

          <FormSidePanel title={copy.routing.title}>
            <ol className="flex flex-col">
              <TimelineStep
                badge={initials(user?.full_name ?? '')}
                isHighlighted
                title={copy.routing.you}
                note={[role?.name, user?.mission?.name].filter(Boolean).join(' · ')}
              />
              <TimelineStep badge="PS" title={copy.routing.principalSecretary} note={copy.routing.principalSecretaryNote} />
              <TimelineStep badge="HQ" title={copy.routing.delegatedOfficer} note={copy.routing.delegatedOfficerNote} isLast />
            </ol>
            <p className="flex gap-2 rounded-lg bg-atrisk-soft px-3 py-2 text-caption leading-snug text-atrisk-soft-text">
              <InformationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
              {copy.routing.immutableNote}
            </p>
          </FormSidePanel>

          <FormSidePanel title={copy.afterSubmit.title}>
            <p className="text-body-sm text-text-secondary">
              {copy.afterSubmit.referenceBefore}{' '}
              <span className="rounded bg-section-bg px-2 py-0.5 font-mono text-primary">{exampleReferenceNumber()}</span>{' '}
              {copy.afterSubmit.referenceAfter}
            </p>
          </FormSidePanel>
        </aside>
      </div>
    </div>
  )
}

function SummaryPill({ text, isEmpty }: { text: string; isEmpty: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-white px-2.5 py-0.5 text-caption ${
        isEmpty ? 'border-dashed border-border-muted font-medium text-text-muted' : 'border-border font-semibold text-text-secondary'
      }`}
    >
      {text}
    </span>
  )
}

