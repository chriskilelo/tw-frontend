import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listDepartments } from '../../api/ministries'
import { Select } from '../../components/Select'
import { useAuth, isSystemAdministrator } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { LeadershipSwitchPanel } from '../sdt/LeadershipSwitchPanel'

/**
 * FR-SDT-003 (Designated Deputy) and FR-SDT-004 to 006 (Acting PS). Shared by the PS, the Acting
 * PS and the Ministry Administrator (ADR-006). K-08: each switch now shows whether it is on and
 * who holds it, so only the action that applies is offered. K-02: the people offered come from
 * GET /sdt/leadership, which applies the same eligibility rules as the switches themselves. A
 * System Administrator picks the department first.
 */
export default function LeadershipSwitchesPage() {
  const { t } = useI18n()
  const { role } = useAuth()
  const systemAdministrator = isSystemAdministrator(role?.name)
  const [selectedDepartment, setSelectedDepartment] = useState('')

  const departmentsQuery = useQuery({ queryKey: ['admin', 'ministries'], queryFn: listDepartments, enabled: systemAdministrator })
  // Wait for the role: until it loads, a System Administrator would look like a department user
  // and the panel would ask for "my own department", which it doesn't have.
  const roleKnown = role != null
  const ready = roleKnown && (!systemAdministrator || selectedDepartment !== '')

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.admin.leadership.title}</h1>
      <p className="mt-1 max-w-2xl text-body text-text-secondary">{t.admin.leadership.intro}</p>

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

      <div className="mt-6">
        {!roleKnown ? null : ready ? (
          <LeadershipSwitchPanel
            key={selectedDepartment || 'own'}
            switches={['acting_ps', 'designated_deputy']}
            ministryId={systemAdministrator ? selectedDepartment : undefined}
            columns={2}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-body-sm text-text-muted">
            {t.admin.leadership.chooseDepartment}
          </p>
        )}
      </div>
    </div>
  )
}
