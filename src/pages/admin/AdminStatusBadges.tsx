import type { ReactNode } from 'react'
import { CheckIcon, ClockIcon, LockClosedIcon, NoSymbolIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { Badge, type BadgeVariant } from '../../components/Badge'
import type { ManagedUser } from '../../api/users'
import type { ApprovalRequestStatus } from '../../api/approvals'
import { useI18n } from '../../i18n/context'

/** CLAUDE.md Section 4 Rule 9: every status badge pairs colour with an icon and a text label. */
const ICON_CLASS = 'h-3 w-3'

const USER_STATUS: Record<ManagedUser['status'], { variant: BadgeVariant; icon: ReactNode }> = {
  activation_pending: { variant: 'info', icon: <ClockIcon aria-hidden="true" className={ICON_CLASS} /> },
  active: { variant: 'success', icon: <CheckIcon aria-hidden="true" className={ICON_CLASS} /> },
  locked: { variant: 'danger', icon: <LockClosedIcon aria-hidden="true" className={ICON_CLASS} /> },
  deactivated: { variant: 'neutral', icon: <NoSymbolIcon aria-hidden="true" className={ICON_CLASS} /> },
}

const APPROVAL_STATUS: Record<ApprovalRequestStatus, { variant: BadgeVariant; icon: ReactNode }> = {
  pending: { variant: 'info', icon: <ClockIcon aria-hidden="true" className={ICON_CLASS} /> },
  approved: { variant: 'success', icon: <CheckIcon aria-hidden="true" className={ICON_CLASS} /> },
  rejected: { variant: 'danger', icon: <XMarkIcon aria-hidden="true" className={ICON_CLASS} /> },
  cancelled: { variant: 'neutral', icon: <NoSymbolIcon aria-hidden="true" className={ICON_CLASS} /> },
}

export function UserStatusBadge({ status }: { status: ManagedUser['status'] }) {
  const { t } = useI18n()
  const { variant, icon } = USER_STATUS[status]
  return <Badge variant={variant} icon={icon} label={t.admin.userStatus[status]} />
}

export function ApprovalStatusBadge({ status }: { status: ApprovalRequestStatus }) {
  const { t } = useI18n()
  const { variant, icon } = APPROVAL_STATUS[status]
  return <Badge variant={variant} icon={icon} label={t.admin.approvals.status[status]} />
}
