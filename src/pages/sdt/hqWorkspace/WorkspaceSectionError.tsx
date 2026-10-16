import { isAxiosError } from 'axios'
import { ArrowPathIcon, ExclamationTriangleIcon, FunnelIcon, ShieldExclamationIcon } from '@heroicons/react/20/solid'
import { useI18n } from '../../../i18n/context'

/**
 * Why a workspace list failed to load: no access (403, e.g. the role changed mid-session), a
 * filter the API refused (422, e.g. a mission no longer posted to the department), or a
 * network/server failure that a retry may fix.
 */
export function WorkspaceSectionError({ error, onRetry, onResetFilters }: { error: unknown; onRetry: () => void; onResetFilters?: () => void }) {
  const { t } = useI18n()
  const copy = t.sdt.hqWorkspace
  const status = isAxiosError(error) ? error.response?.status : undefined

  if (status === 403) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-section-bg text-text-secondary">
          <ShieldExclamationIcon className="size-5" />
        </span>
        <p className="text-h4 text-primary">{copy.forbiddenTitle}</p>
        <p className="max-w-md text-body-sm text-text-secondary">{copy.forbiddenBody}</p>
      </div>
    )
  }

  if (status === 422) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-atrisk-soft text-atrisk-soft-text">
          <FunnelIcon className="size-5" />
        </span>
        <p className="max-w-md text-body-sm text-text-secondary">{copy.invalidFilters}</p>
        {onResetFilters && (
          <button type="button" onClick={onResetFilters} className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
            {copy.filters.clear}
          </button>
        )}
      </div>
    )
  }

  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
        <ExclamationTriangleIcon className="size-5" />
      </span>
      <p className="max-w-md text-body-sm text-text-secondary">{copy.loadError}</p>
      <button type="button" onClick={onRetry} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
        <ArrowPathIcon aria-hidden="true" className="size-4" />
        {copy.retry}
      </button>
    </div>
  )
}
