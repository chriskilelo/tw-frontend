import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
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
import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid'
import {
  getAlertIntelligenceTypeOptions,
  submitAlert,
  uploadAlertAttachment,
  type AlertCreateRequest,
} from '../../api/alerts'
import { Button } from '../../components/Button'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { ChoiceTile, SignalStrength } from './AlertChoiceTile'
import {
  CONFIDENCE_VALUES,
  NEUTRAL_TONE,
  URGENCY_ICONS,
  URGENCY_TONES,
  URGENCY_VALUES,
  type ConfidenceValue,
  type TileTone,
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
  const completedFieldCount = fieldCompletion.filter((field) => field.isDone).length
  const missingRequiredCount = fieldCompletion.filter((field) => field.isRequired && !field.isDone).length
  const canSubmit = missingRequiredCount === 0

  const sectionCompletion: Record<SectionKey, boolean> = {
    type: intelligenceType !== '',
    market: country.trim() !== '' && (sector.trim() !== '' || productCategory.trim() !== ''),
    intelligence: productDescription.trim() !== '' && intelligenceSource.trim() !== '',
    assessment: urgency !== '' && confidenceRating !== '',
    evidence: tags.length > 0 || files.length > 0,
  }
  const sections: { key: SectionKey; label: string }[] = [
    { key: 'type', label: copy.steps.type },
    { key: 'market', label: copy.steps.market },
    { key: 'intelligence', label: copy.steps.intelligence },
    { key: 'assessment', label: copy.steps.assessment },
    { key: 'evidence', label: copy.steps.evidence },
  ]
  const currentSection = sections.find((section) => !sectionCompletion[section.key])?.key
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

  const inputClassName =
    'w-full rounded-lg border border-border-muted bg-white px-3 py-2 text-body text-text-primary placeholder:text-text-muted hover:border-text-muted focus:border-info focus:outline-none focus:ring-4 focus:ring-info-soft'

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <header className="mb-6">
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        <p className="mt-1 max-w-[62ch] text-body text-text-secondary">{copy.lede}</p>
      </header>

      <div className="grid gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_320px] min-[1200px]:items-start">
        <form onSubmit={handleSubmit} data-testid="alert-form" noValidate className="flex min-w-0 flex-col gap-5">
          <nav
            aria-label={copy.stepsLabel}
            className="flex gap-1 rounded-xl border border-border bg-white p-1.5 shadow-sm"
          >
            {sections.map((section, index) => {
              const isDone = sectionCompletion[section.key]
              const isCurrent = section.key === currentSection
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => scrollToSection(section.key)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-body-sm font-semibold sm:justify-start ${
                    isCurrent ? 'bg-section-bg text-primary' : isDone ? 'text-success' : 'text-text-muted'
                  }`}
                >
                  <span
                    className={`grid size-5.5 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[0.6875rem] ${
                      isDone
                        ? 'border-success bg-success text-white'
                        : isCurrent
                          ? 'border-primary text-primary'
                          : 'border-border-muted'
                    }`}
                  >
                    {isDone ? <CheckIcon className="size-3.5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="sr-only md:not-sr-only md:truncate">{section.label}</span>
                </button>
              )
            })}
          </nav>

          <SectionCard
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
          </SectionCard>

          <SectionCard
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
                    className={inputClassName}
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
                className={inputClassName}
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
                className={inputClassName}
              />
            </FieldLabel>
          </SectionCard>

          <SectionCard
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
                className={`${inputClassName} min-h-30 resize-y`}
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
                className={inputClassName}
              />
            </FieldLabel>
          </SectionCard>

          <SectionCard
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
          </SectionCard>

          <SectionCard
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
          </SectionCard>

          {mutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <p className="flex items-center gap-2 text-body-sm text-text-secondary" aria-live="polite">
              {canSubmit ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-caption font-semibold text-success-soft-text">
                    <CheckIcon className="size-3.5" aria-hidden="true" />
                    {copy.status.ready}
                  </span>
                  <span className="hidden sm:inline">{copy.status.readyNote}</span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-atrisk-soft px-2.5 py-0.5 text-caption font-semibold text-atrisk-soft-text">
                    <ExclamationCircleIcon className="size-3.5" aria-hidden="true" />
                    {copy.status.missing(missingRequiredCount)}
                  </span>
                  <span className="hidden sm:inline">{copy.status.missingNote}</span>
                </>
              )}
            </p>
            <div className="flex w-full gap-2.5 sm:w-auto">
              <Button variant="secondary" onClick={() => navigate('/alerts')} className="flex-1 sm:flex-none">
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={!canSubmit || mutation.isPending} className="flex-1 sm:flex-none">
                {copy.button}
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </form>

        <aside className="grid gap-4 sm:grid-cols-2 min-[1200px]:sticky min-[1200px]:top-5 min-[1200px]:grid-cols-1">
          <SidePanel title={copy.readiness.title} className="sm:col-span-2 min-[1200px]:col-span-1">
            <div className="flex justify-between text-caption text-text-muted">
              <span>{copy.readiness.progressLabel}</span>
              <span className="font-mono font-medium text-text-primary">
                {completedFieldCount} / {fieldCompletion.length}
              </span>
            </div>
            <div
              className="mb-3.5 mt-1 h-1.5 overflow-hidden rounded-full bg-section-bg"
              role="progressbar"
              aria-label={copy.readiness.progressLabel}
              aria-valuemin={0}
              aria-valuemax={fieldCompletion.length}
              aria-valuenow={completedFieldCount}
            >
              <span
                className="block h-full origin-left bg-success transition-transform duration-300"
                style={{ transform: `scaleX(${completedFieldCount / fieldCompletion.length})` }}
              />
            </div>
            <ul className="flex flex-col gap-2" data-testid="alert-readiness-checklist">
              {fieldCompletion.map((field) => (
                <li
                  key={field.key}
                  className={`flex items-start gap-2 text-body-sm ${field.isDone ? 'text-text-primary' : 'text-text-secondary'}`}
                >
                  <span
                    className={`mt-px grid size-4.5 shrink-0 place-items-center rounded-full border-[1.5px] ${
                      field.isDone ? 'border-success bg-success text-white' : 'border-border-muted'
                    }`}
                    aria-hidden="true"
                  >
                    {field.isDone && <CheckIcon className="size-3" />}
                  </span>
                  <span>
                    {field.label}
                    {field.isRequired && <RequiredMarker />}
                    <span className="sr-only">{field.isDone ? ` (${copy.status.ready})` : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-border pt-2.5 text-caption text-text-muted">
              <span className="text-danger" aria-hidden="true">
                *
              </span>{' '}
              {copy.readiness.requiredNote}
            </p>
          </SidePanel>

          <SidePanel title={copy.routing.title}>
            <ol className="flex flex-col">
              <RouteStep
                badge={initials(user?.full_name ?? '')}
                isHighlighted
                title={copy.routing.you}
                note={[role?.name, user?.mission?.name].filter(Boolean).join(' · ')}
              />
              <RouteStep badge="PS" title={copy.routing.principalSecretary} note={copy.routing.principalSecretaryNote} />
              <RouteStep badge="HQ" title={copy.routing.delegatedOfficer} note={copy.routing.delegatedOfficerNote} isLast />
            </ol>
            <p className="flex gap-2 rounded-lg bg-atrisk-soft px-3 py-2 text-caption leading-snug text-atrisk-soft-text">
              <InformationCircleIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
              {copy.routing.immutableNote}
            </p>
          </SidePanel>

          <SidePanel title={copy.afterSubmit.title}>
            <p className="text-body-sm text-text-secondary">
              {copy.afterSubmit.referenceBefore}{' '}
              <span className="rounded bg-section-bg px-2 py-0.5 font-mono text-primary">{exampleReferenceNumber()}</span>{' '}
              {copy.afterSubmit.referenceAfter}
            </p>
          </SidePanel>
        </aside>
      </div>
    </div>
  )
}

function RequiredMarker() {
  return (
    <span className="ml-0.5 font-bold text-danger" aria-hidden="true">
      *
    </span>
  )
}

function OptionalMarker({ text }: { text: string }) {
  return <span className="text-caption font-normal text-text-muted">{text}</span>
}

interface FieldLabelProps {
  htmlFor: string
  label: string
  isRequired?: boolean
  optionalText?: string
  trailing?: ReactNode
  className?: string
  children: ReactNode
}

function FieldLabel({ htmlFor, label, isRequired = false, optionalText, trailing, className = '', children }: FieldLabelProps) {
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1.5 text-body-sm font-semibold text-text-secondary">
        <span>
          {label}
          {isRequired && <RequiredMarker />}
        </span>
        {optionalText && <OptionalMarker text={optionalText} />}
        {trailing}
      </label>
      {children}
    </div>
  )
}

interface SectionCardProps {
  id: string
  icon: ReactNode
  title: string
  subtitle: string
  children: ReactNode
}

function SectionCard({ id, icon, title, subtitle, children }: SectionCardProps) {
  const headingId = `${id}-heading`
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-5 rounded-xl border border-border bg-white shadow-sm">
      <div className="flex items-start gap-3.5 px-4 pt-4 sm:px-5.5 sm:pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-section-bg text-primary">{icon}</span>
        <div>
          <h2 id={headingId} className="text-h3 text-primary">
            {title}
          </h2>
          <p className="text-body-sm text-text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="grid gap-x-5 gap-y-4.5 p-4 sm:grid-cols-2 sm:p-5.5">{children}</div>
    </section>
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

function SidePanel({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-3 rounded-xl border border-border bg-white p-4.5 shadow-sm ${className}`}>
      <h3 className="text-h4 text-primary">{title}</h3>
      {children}
    </section>
  )
}

interface RouteStepProps {
  badge: string
  title: string
  note: string
  isHighlighted?: boolean
  isLast?: boolean
}

function RouteStep({ badge, title, note, isHighlighted = false, isLast = false }: RouteStepProps) {
  return (
    <li className="relative grid grid-cols-[28px_1fr] gap-2.5 pb-3.5 last:pb-0">
      {!isLast && <span className="absolute bottom-0 left-3.25 top-7 w-0.5 bg-border" aria-hidden="true" />}
      <span
        className={`grid size-7 place-items-center rounded-full text-[0.6875rem] font-bold ${
          isHighlighted ? 'bg-accent text-accent-text' : 'bg-section-bg text-primary'
        }`}
        aria-hidden="true"
      >
        {badge}
      </span>
      <span>
        <span className="block text-body-sm font-semibold leading-tight text-text-primary">{title}</span>
        {note && <span className="block text-caption text-text-muted">{note}</span>}
      </span>
    </li>
  )
}
