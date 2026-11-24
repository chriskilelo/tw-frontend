import { Link } from 'react-router-dom'
import { ArrowRightIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline'
import { useAuth, isMfaRole } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'

/**
 * What the search and country-profile pages show a role the API refuses search to (MFA,
 * HRM&D, Ministry Administrator), in place of the search box and results. The MFA roles are
 * pointed at their awareness view, which has the counts they can see (FR-MFA-001 AC2).
 */
export function SearchUnavailable() {
  const { t } = useI18n()
  const { role } = useAuth()

  return (
    <section
      role="alert"
      data-testid="search-unavailable"
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:p-6"
    >
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-section-bg text-primary">
        <ShieldExclamationIcon className="size-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-h3 text-primary">{t.search.forbiddenTitle}</h2>
        <p className="mt-1 text-body text-text-secondary">{t.search.forbiddenBody}</p>
        {isMfaRole(role?.name) && (
          <>
            <p className="mt-1 text-body text-text-secondary">{t.search.forbiddenMfaHint}</p>
            <Link to="/mfa-awareness" className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-semibold text-info hover:underline">
              {t.search.openMfaAwareness}
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
