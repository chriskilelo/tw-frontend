import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { activateActingPs, activateDesignatedDeputy, deactivateActingPs, deactivateDesignatedDeputy } from '../../api/sdt'
import { listDepartments } from '../../api/ministries'
import { listUsers, type ManagedUser } from '../../api/users'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { useAuth, isSystemAdministrator } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'

/** Accounts that can never be switched into either leadership role from here. */
const EXCLUDED_ROLES = ['System Administrator', 'Ministry Administrator', 'Ministry PS', 'Acting PS']

/**
 * FR-SDT-003 (Designated Deputy) and FR-SDT-004 to 006 (Acting PS). Shared by the PS and the
 * Ministry Administrator (ADR-006); the PS keeps its existing controls on the PS dashboard.
 * The officer lists come from the department's own accounts (GET /users), replacing the
 * free-text user-id field the PS dashboard still uses. A System Administrator picks the
 * department first. The backend does not expose whether a switch is currently on, so both
 * directions are always offered and a 422 explains when there is nothing to switch off.
 */
export default function LeadershipSwitchesPage() {
  const { t } = useI18n()
  const { user, role } = useAuth()
  const systemAdministrator = isSystemAdministrator(role?.name)

  const [selectedDepartment, setSelectedDepartment] = useState('')
  const departmentId = systemAdministrator ? selectedDepartment : (user?.ministry_id ?? '')

  const departmentsQuery = useQuery({ queryKey: ['admin', 'ministries'], queryFn: listDepartments, enabled: systemAdministrator })
  const accountsQuery = useQuery({
    queryKey: ['admin', 'users', 'officers', departmentId],
    queryFn: () => listUsers({ per_page: 100, ...(systemAdministrator ? { ministry: departmentId } : {}) }),
    enabled: departmentId !== '',
  })

  const officers = (accountsQuery.data?.data ?? []).filter(
    (account) => account.status === 'active' && !EXCLUDED_ROLES.includes(account.role?.name ?? ''),
  )

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.admin.leadership.title}</h1>

      {systemAdministrator && (
        <div className="mt-6 max-w-sm">
          <Select
            label={t.admin.departmentLabel}
            value={selectedDepartment}
            onChange={(event) => setSelectedDepartment(event.target.value)}
            placeholder={t.admin.departmentPlaceholder}
            options={(departmentsQuery.data ?? []).map((ministry) => ({ value: ministry.id, label: ministry.name }))}
          />
        </div>
      )}

      {departmentId !== '' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <SwitchCard
            title={t.admin.leadership.actingPsTitle}
            hint={t.admin.leadership.actingPsHint}
            officers={officers}
            onActivate={(userId) => activateActingPs(userId)}
            onDeactivate={() => deactivateActingPs(systemAdministrator ? departmentId : undefined)}
            testId="acting-ps-switch"
          />
          <SwitchCard
            title={t.admin.leadership.deputyTitle}
            hint={t.admin.leadership.deputyHint}
            officers={officers}
            onActivate={(userId) => activateDesignatedDeputy(userId)}
            onDeactivate={() => deactivateDesignatedDeputy(systemAdministrator ? departmentId : undefined)}
            testId="designated-deputy-switch"
          />
        </div>
      )}
    </div>
  )
}

interface SwitchCardProps {
  title: string
  hint: string
  officers: ManagedUser[]
  onActivate: (userId: string) => Promise<unknown>
  onDeactivate: () => Promise<unknown>
  testId: string
}

function SwitchCard({ title, hint, officers, onActivate, onDeactivate, testId }: SwitchCardProps) {
  const { t } = useI18n()
  const [userId, setUserId] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const handlers = (message: string) => ({
    onSuccess: () => {
      setErrors([])
      setNotice(message)
    },
    onError: (error: unknown) => {
      setNotice(null)
      setErrors(apiErrorMessages(error, t.common.genericError))
    },
  })

  const activateMutation = useMutation({ mutationFn: () => onActivate(userId), ...handlers(t.admin.leadership.activated) })
  const deactivateMutation = useMutation({ mutationFn: onDeactivate, ...handlers(t.admin.leadership.deactivated) })
  const busy = activateMutation.isPending || deactivateMutation.isPending

  return (
    <section className="rounded-lg border border-border p-4" data-testid={testId}>
      <h2 className="text-h3 text-primary">{title}</h2>
      <p className="mt-1 text-body-sm text-text-secondary">{hint}</p>

      <div className="mt-4 flex flex-col gap-4">
        <Select
          label={t.admin.leadership.userLabel}
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder={t.admin.leadership.userPlaceholder}
          options={officers.map((account) => ({ value: account.id, label: `${account.full_name} — ${account.role?.name ?? ''}` }))}
        />

        {notice && <p className="text-body-sm text-success-soft-text">{notice}</p>}
        {errors.length > 0 && (
          <ul className="list-disc pl-5 text-body-sm text-danger-soft-text" role="alert">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <Button onClick={() => activateMutation.mutate()} disabled={busy || userId === ''}>
            {t.admin.leadership.activateButton}
          </Button>
          <Button variant="secondary" onClick={() => deactivateMutation.mutate()} disabled={busy}>
            {t.admin.leadership.deactivateButton}
          </Button>
        </div>
      </div>
    </section>
  )
}
