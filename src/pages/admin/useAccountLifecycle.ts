import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deactivateUser, reactivateUser, resendActivation, unlockUser, type ManagedUser } from '../../api/users'
import { isSystemAdministrator, MINISTRY_ADMINISTRATOR, SYSTEM_ADMINISTRATOR } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'

/**
 * What the signed-in administrator may do about an account's status. Mirrors UserPolicy and
 * UserController (UI-006 convenience only; the API enforces it):
 * - `manage`: deactivate, reactivate, unlock, resend activation.
 * - `own_account`: a System Administrator cannot deactivate itself.
 * - `ps_approval`: a Ministry Administrator changes a Principal Secretary only through an
 *   approval request (BR-027), but may unlock one, which changes no seat.
 * - `view_only`: administrator accounts are managed by a System Administrator (BR-028).
 */
export type AccountLifecycleAccess = 'manage' | 'own_account' | 'ps_approval' | 'view_only'

/** Whether Unlock is offered (FR-AUTH-009 AC2): the account must be locked. */
export function canUnlock(access: AccountLifecycleAccess, account: ManagedUser): boolean {
  return account.status === 'locked' && (access === 'manage' || access === 'ps_approval')
}

export function accountLifecycleAccess(actor: { id?: string; roleName?: string }, account: ManagedUser): AccountLifecycleAccess {
  if (isSystemAdministrator(actor.roleName)) {
    return account.id === actor.id ? 'own_account' : 'manage'
  }
  const roleName = account.role?.name
  if (roleName === SYSTEM_ADMINISTRATOR || roleName === MINISTRY_ADMINISTRATOR) {
    return 'view_only'
  }
  return roleName === 'Ministry PS' ? 'ps_approval' : 'manage'
}

/**
 * FR-AUTH-002/004/005/009: deactivate, reactivate, unlock and resend activation, with the
 * outcome as a message. Shared by the account list and the account page so both say the same
 * thing.
 */
export function useAccountLifecycle() {
  const { t } = useI18n()
  const copy = t.admin.users
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  function begin() {
    setNotice(null)
    setErrors([])
  }

  function fail(error: unknown) {
    setErrors(apiErrorMessages(error, t.common.genericError))
  }

  function changed(account: ManagedUser, message: string) {
    queryClient.setQueryData(['admin', 'users', account.id], account)
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    setNotice(message)
  }

  const deactivate = useMutation({
    mutationFn: (account: ManagedUser) => deactivateUser(account.id),
    onMutate: begin,
    onSuccess: (account) => changed(account, copy.deactivated.replace('{name}', account.full_name)),
    onError: fail,
  })

  const reactivate = useMutation({
    mutationFn: (account: ManagedUser) => reactivateUser(account.id),
    onMutate: begin,
    onSuccess: (account) => changed(account, copy.reactivated.replace('{name}', account.full_name)),
    onError: fail,
  })

  const unlock = useMutation({
    mutationFn: (account: ManagedUser) => unlockUser(account.id),
    onMutate: begin,
    onSuccess: (account) => changed(account, copy.unlocked.replace('{name}', account.full_name)),
    onError: fail,
  })

  const resend = useMutation({
    mutationFn: (account: ManagedUser) => resendActivation(account.id),
    onMutate: begin,
    onSuccess: () => setNotice(copy.resendSuccess),
    onError: fail,
  })

  return {
    deactivate,
    reactivate,
    unlock,
    resend,
    notice,
    errors,
    isPending: deactivate.isPending || reactivate.isPending || unlock.isPending || resend.isPending,
  }
}
