import { ArrowPathIcon, ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useI18n } from '../i18n/context'
import { isForbidden } from '../lib/apiErrors'

interface ListUnavailableProps {
  error: unknown
  /** Shown when the API refuses the list to this role (403), e.g. "Alerts aren't available to your role". */
  notAvailableTitle: string
  /** Shown for any other failure, with a retry. */
  loadError: string
  retryLabel: string
  onRetry: () => void
}

/**
 * The state a list page shows when its list request fails. A refusal says the page isn't part
 * of the user's role (ISS-018: it used to look like an empty list, "No alerts found."); any
 * other failure says the list couldn't be loaded and offers a retry. Retrying a refusal never
 * helps, so it gets no button.
 */
export function ListUnavailable({ error, notAvailableTitle, loadError, retryLabel, onRetry }: ListUnavailableProps) {
  const { t } = useI18n()

  if (isForbidden(error)) {
    return (
      <section
        role="alert"
        aria-labelledby="list-not-available-title"
        data-testid="list-not-available"
        className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm"
      >
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-section-bg text-primary">
          <LockClosedIcon className="size-5" />
        </span>
        <h2 id="list-not-available-title" className="text-h3 text-primary">
          {notAvailableTitle}
        </h2>
        <p className="max-w-md text-body text-text-secondary">{t.common.notAvailableBody}</p>
      </section>
    )
  }

  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
        <ExclamationTriangleIcon className="size-5" />
      </span>
      <p className="max-w-md text-body text-text-secondary">{loadError}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light"
      >
        <ArrowPathIcon aria-hidden="true" className="size-4" />
        {retryLabel}
      </button>
    </div>
  )
}
