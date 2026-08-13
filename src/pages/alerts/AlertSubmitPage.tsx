import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAlertIntelligenceTypeOptions,
  submitAlert,
  uploadAlertAttachment,
  type AlertCreateRequest,
} from '../../api/alerts'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import en from '../../i18n/en'

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const ACCEPTED_ATTACHMENT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'

/**
 * FR-ALERT-002, FR-ALERT-003, FR-ALERT-004. The Intelligence Type select is
 * populated from GET /master-data (the configured option list); every
 * other field is fixed per CLAUDE.md Section 8's Alert Field Schema table
 * (see api/alerts.ts's getAlertIntelligenceTypeOptions() note on why
 * `/alert-fields` itself isn't reachable from this role).
 */
export default function AlertSubmitPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const intelligenceTypesQuery = useQuery({
    queryKey: ['master-data', 'alert_intelligence_type'],
    queryFn: getAlertIntelligenceTypeOptions,
  })

  const [country, setCountry] = useState('')
  const [sector, setSector] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [intelligenceType, setIntelligenceType] = useState('')
  const [intelligenceSource, setIntelligenceSource] = useState('')
  const [urgency, setUrgency] = useState('')
  const [confidenceRating, setConfidenceRating] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)

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

  function addTag(raw: string) {
    const value = raw.trim()
    if (value && !tags.includes(value)) {
      setTags((current) => [...current, value])
    }
    setTagInput('')
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(tagInput)
    }
  }

  function removeTag(value: string) {
    setTags((current) => current.filter((tag) => tag !== value))
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_BYTES)
    if (oversized) {
      setFileError(en.alerts.submit.attachmentsHint)
      return
    }
    setFileError(null)
    setFiles(selected)
  }

  function removeFile(name: string) {
    setFiles((current) => current.filter((file) => file.name !== name))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({
      country,
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
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.alerts.submit.title}</h1>

      <form onSubmit={handleSubmit} data-testid="alert-form" className="mt-6 flex max-w-2xl flex-col gap-4">
        <Input
          label={en.alerts.submit.countryLabel}
          required
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        />

        <Input label={en.alerts.submit.sectorLabel} value={sector} onChange={(event) => setSector(event.target.value)} />

        <Input
          label={en.alerts.submit.productCategoryLabel}
          value={productCategory}
          onChange={(event) => setProductCategory(event.target.value)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">
            {en.alerts.submit.productDescriptionLabel}
          </span>
          <textarea
            value={productDescription}
            onChange={(event) => setProductDescription(event.target.value)}
            rows={3}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">
            {en.alerts.submit.intelligenceTypeLabel}
          </span>
          <select
            required
            value={intelligenceType}
            onChange={(event) => setIntelligenceType(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="" disabled>
              {en.common.required}
            </option>
            {(intelligenceTypesQuery.data ?? []).map((option) => (
              <option key={option.id} value={option.value}>
                {en.alerts.intelligenceType[option.value as 'opportunities' | 'trade_barriers'] ?? option.value}
              </option>
            ))}
          </select>
        </label>

        <Input
          label={en.alerts.submit.intelligenceSourceLabel}
          value={intelligenceSource}
          onChange={(event) => setIntelligenceSource(event.target.value)}
        />

        <Input label={en.alerts.submit.urgencyLabel} value={urgency} onChange={(event) => setUrgency(event.target.value)} />

        <Input
          label={en.alerts.submit.confidenceRatingLabel}
          value={confidenceRating}
          onChange={(event) => setConfidenceRating(event.target.value)}
        />

        <div className="flex flex-col gap-1">
          <Input
            label={en.alerts.submit.tagsLabel}
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => tagInput && addTag(tagInput)}
          />
          <p className="text-caption text-text-muted">{en.alerts.submit.tagsHint}</p>
          {tags.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-section-bg px-2.5 py-1 text-caption text-text-secondary">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`${en.common.delete} ${tag}`}
                      className="text-text-muted hover:text-danger"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">{en.alerts.submit.attachmentsLabel}</span>
            <input
              type="file"
              multiple
              accept={ACCEPTED_ATTACHMENT_TYPES}
              onChange={handleFilesChange}
              className="text-body-sm text-text-secondary"
            />
          </label>
          <p className="text-caption text-text-muted">{en.alerts.submit.attachmentsHint}</p>
          {fileError && <p className="text-caption text-danger-soft-text">{fileError}</p>}
          {files.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1">
              {files.map((file) => (
                <li key={file.name} className="flex items-center justify-between text-body-sm text-text-secondary">
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(file.name)}
                    aria-label={`${en.common.delete} ${file.name}`}
                    className="text-text-muted hover:text-danger"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {mutation.isError && <p className="text-body-sm text-danger-soft-text">{en.common.genericError}</p>}

        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {en.alerts.submit.button}
        </Button>
      </form>
    </div>
  )
}
