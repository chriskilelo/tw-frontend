import type { ReactNode } from 'react'
import { useI18n } from '../i18n/context'
import { formatDateTime, localeFor } from '../lib/formatters'

type Changes = Record<string, unknown> | null

interface AuditChangeDiffProps {
  changes: Changes
  ipAddress: string | null
}

/**
 * Renders App\Observers\ModelObserver's `{before, after}` payload (every
 * create/update/delete) as a two-column diff, and falls back gracefully for
 * the other shapes App\Services\AuditService::record() is called with
 * directly: a flat `{field: {from, to}}` map (e.g. a role change), a flat
 * value map with no prior state (e.g. a new PS's details), or null (e.g. a
 * login attempt, which carries only an IP address).
 */
export function AuditChangeDiff({ changes, ipAddress }: AuditChangeDiffProps) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.admin.audit.detail
  const yesNo = { yes: t.common.yes, no: t.common.no }

  const shape = classify(changes)

  return (
    <div className="grid gap-4 rounded border border-border bg-section-bg p-4 text-body-sm">
      {shape.kind === 'empty' && <p className="text-text-muted">{copy.noChanges}</p>}

      {shape.kind === 'structured' && (
        <StructuredDiff before={shape.before} after={shape.after} locale={locale} copy={copy} yesNo={yesNo} />
      )}

      {shape.kind === 'flat' && (
        <FlatDiff fieldDiffs={shape.fieldDiffs} details={shape.details} locale={locale} copy={copy} yesNo={yesNo} />
      )}

      {ipAddress && (
        <p className="border-t border-border pt-3 font-mono text-caption text-text-muted">
          {copy.ipAddress}: {ipAddress}
        </p>
      )}
    </div>
  )
}

type Classified =
  | { kind: 'empty' }
  | { kind: 'structured'; before: Record<string, unknown> | null; after: Record<string, unknown> | null }
  | { kind: 'flat'; fieldDiffs: Array<[string, unknown, unknown]>; details: Array<[string, unknown]> }

function classify(changes: Changes): Classified {
  if (changes === null || typeof changes !== 'object') {
    return { kind: 'empty' }
  }

  const keys = Object.keys(changes)

  if (keys.length > 0 && keys.every((key) => key === 'before' || key === 'after')) {
    return {
      kind: 'structured',
      before: asRecord(changes.before),
      after: asRecord(changes.after),
    }
  }

  const fieldDiffs: Array<[string, unknown, unknown]> = []
  const details: Array<[string, unknown]> = []

  for (const [key, value] of Object.entries(changes)) {
    if (isFromTo(value)) {
      fieldDiffs.push([key, value.from, value.to])
    } else {
      details.push([key, value])
    }
  }

  if (fieldDiffs.length === 0 && details.length === 0) {
    return { kind: 'empty' }
  }

  return { kind: 'flat', fieldDiffs, details }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function isFromTo(value: unknown): value is { from: unknown; to: unknown } {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && 'from' in value && 'to' in value && Object.keys(value).length === 2
}

type YesNo = { yes: string; no: string }

function StructuredDiff({
  before,
  after,
  locale,
  copy,
  yesNo,
}: {
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  locale: string
  copy: typeof import('../i18n/en').default.admin.audit.detail
  yesNo: YesNo
}) {
  const fieldKeys = Object.keys(after ?? before ?? {})

  if (fieldKeys.length === 0) {
    // before and after both null/empty never actually reaches here (classify() would
    // have returned 'empty'), but guards the exhaustive-looking render regardless.
    return <p className="text-text-muted">{copy.noChanges}</p>
  }

  const isNewRecord = before === null
  const isRemovedRecord = after === null

  // The full record is shown on both sides (App\Observers\ModelObserver logs the
  // complete attribute set, not only what changed); only the rows that actually
  // differ are highlighted, matching every field against its counterpart.
  const changedKeys = new Set(
    isNewRecord || isRemovedRecord
      ? []
      : fieldKeys.filter((key) => JSON.stringify((before as Record<string, unknown>)[key]) !== JSON.stringify((after as Record<string, unknown>)[key])),
  )

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DiffColumn
        heading={copy.before}
        tone={isRemovedRecord ? 'danger' : 'neutral'}
        emptyLabel={isNewRecord ? copy.newRecord : undefined}
        fields={fieldKeys}
        values={before}
        changedKeys={changedKeys}
        locale={locale}
        yesNo={yesNo}
      />
      <DiffColumn
        heading={copy.after}
        tone={isNewRecord ? 'success' : 'neutral'}
        emptyLabel={isRemovedRecord ? copy.recordRemoved : undefined}
        fields={fieldKeys}
        values={after}
        changedKeys={changedKeys}
        locale={locale}
        yesNo={yesNo}
      />
    </div>
  )
}

function DiffColumn({
  heading,
  tone,
  emptyLabel,
  fields,
  values,
  changedKeys,
  locale,
  yesNo,
}: {
  heading: string
  tone: 'neutral' | 'success' | 'danger'
  emptyLabel?: string
  fields: string[]
  values: Record<string, unknown> | null
  changedKeys: Set<string>
  locale: string
  yesNo: YesNo
}) {
  const headingClass = tone === 'success' ? 'text-success-text' : tone === 'danger' ? 'text-danger-text' : 'text-text-secondary'

  return (
    <div>
      <p className={`mb-2 text-caption font-semibold uppercase tracking-wide ${headingClass}`}>{heading}</p>
      {values === null ? (
        <p className="italic text-text-muted">{emptyLabel}</p>
      ) : (
        <dl className="grid gap-1">
          {fields.map((key) => {
            const changed = changedKeys.has(key)
            return (
              <div key={key} className={`rounded px-2 py-1 ${changed ? 'bg-info-soft' : ''}`}>
                <dt className="font-mono text-caption text-text-muted">{key}</dt>
                <dd className={changed ? 'text-info-soft-text' : 'text-text-primary'}>{renderValue(key, values[key], locale, yesNo)}</dd>
              </div>
            )
          })}
        </dl>
      )}
    </div>
  )
}

function FlatDiff({
  fieldDiffs,
  details,
  locale,
  copy,
  yesNo,
}: {
  fieldDiffs: Array<[string, unknown, unknown]>
  details: Array<[string, unknown]>
  locale: string
  copy: typeof import('../i18n/en').default.admin.audit.detail
  yesNo: YesNo
}) {
  return (
    <div className="grid gap-4">
      {fieldDiffs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-secondary">{copy.before}</p>
            <dl className="grid gap-1">
              {fieldDiffs.map(([key, from]) => (
                <div key={key} className="rounded bg-info-soft px-2 py-1">
                  <dt className="font-mono text-caption text-text-muted">{key}</dt>
                  <dd className="text-info-soft-text">{renderValue(key, from, locale, yesNo)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-secondary">{copy.after}</p>
            <dl className="grid gap-1">
              {fieldDiffs.map(([key, , to]) => (
                <div key={key} className="rounded bg-info-soft px-2 py-1">
                  <dt className="font-mono text-caption text-text-muted">{key}</dt>
                  <dd className="text-info-soft-text">{renderValue(key, to, locale, yesNo)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {details.length > 0 && (
        <div>
          <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-secondary">{copy.details}</p>
          <dl className="grid gap-1">
            {details.map(([key, value]) => (
              <div key={key} className="px-2 py-1">
                <dt className="font-mono text-caption text-text-muted">{key}</dt>
                <dd className="text-text-primary">{renderValue(key, value, locale, yesNo)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

function renderValue(key: string, value: unknown, locale: string, yesNo: YesNo): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-text-muted">—</span>
  }

  if (typeof value === 'boolean') {
    return value ? yesNo.yes : yesNo.no
  }

  if (typeof value === 'string' && /_at$/.test(key)) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return formatDateTime(value, locale)
    }
  }

  if (typeof value === 'object') {
    return <pre className="mt-0.5 wrap-break-word whitespace-pre-wrap font-mono text-caption">{JSON.stringify(value, null, 2)}</pre>
  }

  return String(value)
}
