import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheckIcon } from '@heroicons/react/20/solid'
import type { ManagedUser } from '../../api/users'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useI18n } from '../../i18n/context'
import { formatDateTime, localeFor } from '../../lib/formatters'
import { UserStatusBadge } from './AdminStatusBadges'
import { useAccountLifecycle, type AccountLifecycleAccess } from './useAccountLifecycle'

/**
 * FR-AUTH-004/005 (ISS-021): an account's status on its own page, what that status means, and
 * the actions the administrator may take. A locked account has no separate unlock action: the
 * person resets their password, or an administrator deactivates and then reactivates it
 * (FR-AUTH-009 AC2).
 */
export function AccountStatusPanel({ account, access }: { account: ManagedUser; access: AccountLifecycleAccess }) {
  const { t, language } = useI18n()
  const copy = t.admin.users
  const headingId = useId()
  const lifecycle = useAccountLifecycle()
  const [confirming, setConfirming] = useState(false)

  const lastSignIn = account.last_login_at
    ? copy.lastSignIn.replace('{when}', formatDateTime(account.last_login_at, localeFor(language)))
    : copy.neverSignedIn

  return (
    <section aria-labelledby={headingId} className="mt-6 max-w-3xl rounded-xl border border-border bg-white shadow-sm" data-testid="account-status">
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary">
          <ShieldCheckIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="text-h3 text-primary">
            {copy.statusTitle}
          </h2>
          <p className="mt-0.5 text-body-sm text-text-secondary">{copy.statusSubtitle}</p>
        </div>
      </header>

      <div className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <UserStatusBadge status={account.status} />
          <span className="text-body-sm text-text-secondary">{lastSignIn}</span>
        </div>
        <p className="text-body text-text-primary">{copy.statusMeaning[account.status]}</p>

        {lifecycle.notice && (
          <p role="status" className="text-body-sm text-success-soft-text">
            {lifecycle.notice}
          </p>
        )}
        {lifecycle.errors.length > 0 && (
          <ul role="alert" className="list-disc pl-5 text-body-sm text-danger-soft-text">
            {lifecycle.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {access === 'manage' ? (
          <div className="flex flex-wrap gap-2">
            {account.status === 'deactivated' ? (
              <Button onClick={() => lifecycle.reactivate.mutate(account)} disabled={lifecycle.isPending}>
                {copy.reactivateButton}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirming(true)} disabled={lifecycle.isPending}>
                {copy.deactivateButton}
              </Button>
            )}
            {account.status === 'activation_pending' && (
              <Button variant="secondary" onClick={() => lifecycle.resend.mutate(account)} disabled={lifecycle.isPending}>
                {copy.resendButton}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-body-sm text-text-secondary">
            {copy.lifecycleNote[access]}
            {access === 'ps_approval' && (
              <>
                {' '}
                <Link to="/admin/approvals" className="text-primary underline">
                  {copy.openApprovals}
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} title={copy.deactivateButton}>
        <p className="text-body text-text-primary">{copy.confirmDeactivate.replace('{name}', account.full_name)}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            {t.admin.cancelButton}
          </Button>
          <Button
            variant="danger"
            onClick={() => lifecycle.deactivate.mutate(account, { onSettled: () => setConfirming(false) })}
            disabled={lifecycle.isPending}
          >
            {copy.deactivateButton}
          </Button>
        </div>
      </Modal>
    </section>
  )
}
