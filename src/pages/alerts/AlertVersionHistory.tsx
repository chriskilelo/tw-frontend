import { useId, useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import type { AlertDetail, AlertVersion, AlertVersionContent } from '../../api/alerts'
import { useI18n } from '../../i18n/context'
import { confidenceDisplayName, urgencyDisplayName } from './alertAssessment'

/** The editable fields, in the order the alert page shows them. */
const FIELDS: (keyof AlertVersionContent)[] = [
  'intelligence_type',
  'country',
  'sector',
  'product_category',
  'product_description',
  'intelligence_source',
  'urgency',
  'confidence_rating',
  'tags',
]

function normalised(value: unknown): string {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return 'null'
  }
  return JSON.stringify(value)
}

function currentContent(alert: AlertDetail): AlertVersionContent {
  return Object.fromEntries(FIELDS.map((field) => [field, alert[field]])) as unknown as AlertVersionContent
}

/**
 * FR-ALERT-012 (ISS-007): every earlier version of an alert, newest first. Each version is the
 * alert as it was before an edit; it lists the fields that edit changed, with the earlier and
 * the later value, and who made the edit. The later value is the next version, or the alert as
 * it is now for the newest version.
 */
export function AlertVersionHistory({ alert, formatDateTime }: { alert: AlertDetail; formatDateTime: (value: string) => string }) {
  const { t } = useI18n()
  const chronological = [...alert.versions].sort((first, second) => first.created_at.localeCompare(second.created_at))
  const entries = chronological
    .map((version, index) => ({ version, number: index + 1, after: chronological[index + 1]?.snapshot ?? currentContent(alert) }))
    .reverse()

  return (
    <ol aria-label={t.alerts.detail.versionHistoryTitle} className="flex flex-col gap-2">
      {entries.map(({ version, number, after }) => (
        <VersionEntry key={version.id} version={version} number={number} after={after} formatDateTime={formatDateTime} />
      ))}
    </ol>
  )
}

function VersionEntry({
  version,
  number,
  after,
  formatDateTime,
}: {
  version: AlertVersion
  number: number
  after: AlertVersionContent
  formatDateTime: (value: string) => string
}) {
  const { t } = useI18n()
  const copy = t.alerts.detail
  const [isOpen, setOpen] = useState(false)
  const changesId = useId()
  const changed = FIELDS.filter((field) => normalised(version.snapshot[field]) !== normalised(after[field]))

  const labels: Record<keyof AlertVersionContent, string> = {
    intelligence_type: t.alerts.submit.intelligenceTypeLabel,
    country: t.alerts.submit.countryLabel,
    sector: t.alerts.submit.sectorLabel,
    product_category: t.alerts.submit.productCategoryLabel,
    product_description: t.alerts.submit.productDescriptionLabel,
    intelligence_source: t.alerts.submit.intelligenceSourceLabel,
    urgency: t.alerts.submit.urgencyLabel,
    confidence_rating: t.alerts.submit.confidenceRatingLabel,
    tags: t.alerts.submit.tagsLabel,
  }

  function display(field: keyof AlertVersionContent, content: AlertVersionContent): string {
    const value = content[field]
    if (normalised(value) === 'null') {
      return copy.notProvided
    }
    if (field === 'tags' && Array.isArray(value)) {
      return value.join(', ')
    }
    if (field === 'intelligence_type' && (value === 'opportunities' || value === 'trade_barriers')) {
      return t.alerts.intelligenceType[value]
    }
    if (field === 'urgency') {
      return urgencyDisplayName(String(value), t.alerts.submit.urgencyOptions)
    }
    if (field === 'confidence_rating') {
      return confidenceDisplayName(String(value), t.alerts.submit.confidenceOptions)
    }
    return String(value)
  }

  return (
    <li className="rounded-lg border border-border px-3 py-2">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-section-bg font-mono text-[0.6875rem] text-primary">{number}</span>
        <span className="min-w-0 text-body-sm">
          <span className="block font-semibold text-text-primary">{copy.versionEntry(number)}</span>
          <span className="block text-caption text-text-secondary">
            {copy.versionSavedBeforeEdit} · {formatDateTime(version.created_at)}
          </span>
          {version.edited_by && <span className="block text-caption text-text-secondary">{copy.versionEditedBy(version.edited_by.full_name)}</span>}
        </span>
      </div>

      {changed.length === 0 ? (
        <p className="mt-1.5 text-caption text-text-muted">{copy.versionNoChanges}</p>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={changesId}
            onClick={() => setOpen((open) => !open)}
            className="mt-1.5 inline-flex items-center gap-1 rounded text-caption font-semibold text-info hover:underline"
          >
            <ChevronDownIcon className={`size-3.5 transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            {isOpen ? copy.versionHideChanges : copy.versionShowChanges(changed.length)}
          </button>
          <dl id={changesId} hidden={!isOpen} className="mt-2 flex flex-col gap-3 border-t border-border pt-2">
            {changed.map((field) => (
              <div key={field}>
                <dt className="text-caption font-semibold text-text-secondary">{labels[field]}</dt>
                <dd className="mt-1 flex flex-col gap-1 text-body-sm">
                  <ChangeValue tag={copy.versionBefore} value={display(field, version.snapshot)} isEarlier />
                  <ChangeValue tag={copy.versionAfter} value={display(field, after)} />
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </li>
  )
}

function ChangeValue({ tag, value, isEarlier = false }: { tag: string; value: string; isEarlier?: boolean }) {
  return (
    <span className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${isEarlier ? 'bg-section-bg text-text-secondary' : 'bg-info-soft text-text-primary'}`}>
      <span className={`mt-px shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wide ${isEarlier ? 'text-text-secondary' : 'text-info-soft-text'}`}>{tag}</span>
      <span className="min-w-0 whitespace-pre-line wrap-break-word">{value}</span>
    </span>
  )
}
