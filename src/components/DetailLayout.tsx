import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowDownTrayIcon, CheckIcon as CheckOutlineIcon, Square2StackIcon } from '@heroicons/react/24/outline'
import { ArrowLeftIcon, ArrowPathIcon, CheckIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, ShieldExclamationIcon } from '@heroicons/react/20/solid'
import { fileExtension, formatFileSize } from '../lib/formatters'

/** Shared building blocks for the record detail pages (alert, inquiry). */

export type ProgressStepState = 'done' | 'current' | 'todo'

export function ProgressStep({ state, index, title, note }: { state: ProgressStepState; index: number; title: string; note: string }) {
  return (
    <li
      aria-current={state === 'current' ? 'step' : undefined}
      className="flex items-start gap-2.5 border-border px-4 py-3.5 not-first:border-t sm:px-6 md:not-first:border-l md:not-first:border-t-0"
    >
      <span
        className={`mt-px grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[0.6875rem] ${
          state === 'done'
            ? 'border-success bg-success text-white'
            : state === 'current'
              ? 'border-info bg-white text-info ring-4 ring-info-soft'
              : 'border-border-muted bg-white text-text-muted'
        }`}
        aria-hidden="true"
      >
        {state === 'done' ? <CheckIcon className="size-3.5" /> : index}
      </span>
      <span className="min-w-0">
        <strong className={`block text-body-sm ${state === 'todo' ? 'text-text-secondary' : 'text-text-primary'}`}>{title}</strong>
        <span className="block text-caption leading-snug text-text-secondary">{note}</span>
      </span>
    </li>
  )
}

interface DetailCardProps {
  icon: ReactNode
  title: string
  count?: number
  action?: ReactNode
  id?: string
  children: ReactNode
}

export function DetailCard({ icon, title, count, action, id, children }: DetailCardProps) {
  return (
    <section id={id} className="scroll-mt-5 rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
        <h2 className="flex items-center gap-2.5 text-h3 text-primary">
          <span className="grid size-8 place-items-center rounded-lg bg-section-bg text-primary">{icon}</span>
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-section-bg px-2 py-px font-mono text-[0.6875rem] font-medium text-text-secondary">{count}</span>
          )}
        </h2>
        {action}
      </div>
      <div className="p-4 sm:px-5 sm:pb-5">{children}</div>
    </section>
  )
}

export function FactTile({ icon, label, value, emptyText }: { icon: ReactNode; label: string; value: ReactNode; emptyText: string }) {
  const hasValue = value !== null && value !== undefined && value !== ''
  return (
    <div className="relative min-w-0 rounded-lg border border-border py-3 pl-13 pr-3">
      <dt className="text-caption font-medium text-text-secondary">
        <span
          className="absolute left-3 top-3 grid size-7.5 place-items-center rounded-lg bg-section-bg text-text-secondary"
          aria-hidden="true"
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className={hasValue ? 'wrap-break-word font-semibold text-text-primary' : 'italic text-text-muted'}>{hasValue ? value : emptyText}</dd>
    </div>
  )
}

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-dashed border-border-muted bg-page-bg px-4 py-3.5 text-body-sm text-text-secondary">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-white text-text-muted">{icon}</span>
      <span>
        <strong className="block text-text-primary">{title}</strong>
        {body}
      </span>
    </div>
  )
}

export function DetailSidePanel({ title, count, className = '', children }: { title: string; count?: number; className?: string; children: ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3.5 rounded-xl border border-border bg-white p-4.5 shadow-sm ${className}`}>
      <h2 className="flex items-center justify-between gap-2 text-h4 text-primary">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-section-bg px-2 py-px font-mono text-[0.6875rem] font-medium text-text-secondary">{count}</span>
        )}
      </h2>
      {children}
    </section>
  )
}

interface PersonRowProps {
  badge: string
  role: string
  name: string
  note?: string
  variant?: 'default' | 'highlight' | 'pending'
  isLast?: boolean
}

export function PersonRow({ badge, role, name, note, variant = 'default', isLast = false }: PersonRowProps) {
  const badgeClassName = {
    default: 'bg-section-bg text-primary',
    highlight: 'bg-accent text-accent-text',
    pending: 'border-[1.5px] border-dashed border-border-muted bg-white text-text-muted',
  }[variant]
  return (
    <li className={`relative grid grid-cols-[32px_1fr] gap-2.5 ${isLast ? '' : 'pb-4'}`}>
      {!isLast && <span className="absolute bottom-0.5 left-3.75 top-8.5 w-0.5 bg-border" aria-hidden="true" />}
      <span className={`grid size-8 place-items-center rounded-full text-[0.6875rem] font-bold ${badgeClassName}`} aria-hidden="true">
        {badge}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-text-secondary">{role}</span>
        <span className="block text-body-sm font-semibold leading-tight text-text-primary">{name}</span>
        {note && <span className="block text-caption text-text-secondary">{note}</span>}
      </span>
    </li>
  )
}

export function RecordRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-text-primary">{value}</dd>
    </div>
  )
}

interface CopyButtonProps {
  value: string
  label: string
  copiedLabel: string
  className?: string
}

/** Icon button that copies `value`, confirms with a tick for two seconds, and announces it to screen readers. */
export function CopyButton({ value, label, copiedLabel, className = '' }: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (!isCopied) {
      return
    }
    const timer = window.setTimeout(() => setIsCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [isCopied])

  function copy() {
    navigator.clipboard
      ?.writeText(value)
      .then(() => setIsCopied(true))
      .catch(() => undefined)
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className={`grid size-7 shrink-0 place-items-center rounded-md border border-border text-text-muted hover:border-border-muted hover:text-primary ${className}`}
      >
        {isCopied ? (
          <CheckOutlineIcon className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <Square2StackIcon className="size-3.5" aria-hidden="true" />
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {isCopied ? copiedLabel : ''}
      </span>
    </>
  )
}

interface AttachmentRowProps {
  fileName: string
  sizeBytes: number
  mimeType: string
  requestDownloadUrl: () => Promise<string>
  downloadLabel: string
  downloadAriaLabel: string
  downloadError: string
}

/** A file row whose download button fetches a short-lived signed URL, then opens it (NFR-SEC-004). */
export function AttachmentRow({ fileName, sizeBytes, mimeType, requestDownloadUrl, downloadLabel, downloadAriaLabel, downloadError }: AttachmentRowProps) {
  const downloadMutation = useMutation({
    mutationFn: requestDownloadUrl,
    onSuccess: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
  })
  const isImage = mimeType.startsWith('image/')

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
        <span
          className={`grid size-9.5 shrink-0 place-items-center rounded-lg font-mono text-[0.6875rem] font-medium ${
            isImage ? 'bg-info-soft text-info' : 'bg-danger-soft text-danger-soft-text'
          }`}
          aria-hidden="true"
        >
          {fileExtension(fileName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-text-primary">{fileName}</span>
          <span className="font-mono text-[0.6875rem] text-text-secondary">{formatFileSize(sizeBytes)}</span>
        </span>
        <button
          type="button"
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          aria-label={downloadAriaLabel}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-body-sm font-semibold text-info hover:bg-info-soft disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{downloadLabel}</span>
        </button>
      </div>
      {downloadMutation.isError && <p className="text-caption text-danger-soft-text">{downloadError}</p>}
    </li>
  )
}

interface RecordUnavailableProps {
  /** The HTTP status that refused the record, if any: 403 and 404 get their own explanation. */
  status: number | undefined
  copy: { forbiddenTitle: string; forbiddenBody: string; notFoundTitle: string; notFoundBody: string; loadError: string; retry: string }
  back: { to: string; label: string }
  onRetry: () => void
}

/**
 * The whole-page state for a record that cannot be shown: refused (403, the API's decision —
 * the page never relies on hidden links alone), missing (404), or failed to load (retry).
 */
export function RecordUnavailable({ status, copy, back, onRetry }: RecordUnavailableProps) {
  const isRefusal = status === 403 || status === 404
  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <section role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:p-6" data-testid="record-unavailable">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-section-bg text-primary [&>svg]:size-5">
          {status === 403 ? <ShieldExclamationIcon /> : status === 404 ? <MagnifyingGlassIcon /> : <ExclamationTriangleIcon />}
        </span>
        <div className="min-w-0">
          <h1 className="text-h3 text-primary">{status === 403 ? copy.forbiddenTitle : status === 404 ? copy.notFoundTitle : copy.loadError}</h1>
          {isRefusal && <p className="mt-1 text-body text-text-secondary">{status === 403 ? copy.forbiddenBody : copy.notFoundBody}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Link to={back.to} className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-info hover:underline">
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              {back.label}
            </Link>
            {!isRefusal && (
              <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary hover:underline">
                <ArrowPathIcon className="size-4" aria-hidden="true" />
                {copy.retry}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
