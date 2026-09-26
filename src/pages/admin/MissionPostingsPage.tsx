import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listMissions, updateMissionPosting, type Mission } from '../../api/missions'
import { listDepartments } from '../../api/ministries'
import { listUsers } from '../../api/users'
import { Table, type TableColumn } from '../../components/Table'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { useAuth, isSystemAdministrator } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'

/**
 * ADR-006 / BR-004: which attache represents the department at each mission
 * (PATCH /mission-links/{mission}). Missions themselves are shared by every department and
 * stay System Administrator only; this page changes only the department's own posting. A
 * System Administrator first picks the department; a Ministry Administrator is pinned to its own.
 */
export default function MissionPostingsPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const systemAdministrator = isSystemAdministrator(role?.name)

  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const departmentId = systemAdministrator ? selectedDepartment : (user?.ministry_id ?? '')

  const departmentsQuery = useQuery({ queryKey: ['admin', 'ministries'], queryFn: listDepartments, enabled: systemAdministrator })
  const missionsQuery = useQuery({ queryKey: ['admin', 'missions-with-postings'], queryFn: listMissions })
  const attachesQuery = useQuery({
    queryKey: ['admin', 'users', 'attaches', departmentId],
    queryFn: () => listUsers({ per_page: 100, ...(systemAdministrator ? { ministry: departmentId } : {}) }),
    enabled: departmentId !== '',
  })

  const attaches = (attachesQuery.data?.data ?? []).filter(
    (account) => account.role?.name === 'Ministry Attache' && account.status !== 'deactivated',
  )

  const postingMutation = useMutation({
    mutationFn: ({ missionId, attacheId }: { missionId: string; attacheId: string | null }) =>
      updateMissionPosting(missionId, {
        active_attache_user_id: attacheId,
        ...(systemAdministrator ? { ministry_id: departmentId } : {}),
      }),
    onSuccess: () => {
      setErrors([])
      setNotice(t.admin.postings.saved)
      queryClient.invalidateQueries({ queryKey: ['admin', 'missions-with-postings'] })
    },
    onError: (error) => {
      setNotice(null)
      setErrors(apiErrorMessages(error, t.common.genericError))
    },
  })

  function currentPosting(mission: Mission) {
    return mission.mission_ministry_links?.find((link) => link.ministry_id === departmentId)
  }

  const columns: TableColumn<Mission>[] = [
    { key: 'mission', header: t.admin.postings.columnMission, render: (mission) => mission.name },
    {
      key: 'attache',
      header: t.admin.postings.columnAttache,
      render: (mission) => currentPosting(mission)?.active_attache?.full_name ?? t.admin.postings.vacant,
    },
    {
      key: 'actions',
      header: t.admin.columnActions,
      render: (mission) => {
        const eligible = attaches.filter((account) => account.mission?.id === mission.id)
        if (eligible.length === 0) {
          return <span className="text-caption text-text-muted">{t.admin.postings.noEligible}</span>
        }
        const posting = currentPosting(mission)
        const chosen = choices[mission.id] ?? posting?.active_attache_user_id ?? ''
        return (
          <div className="flex flex-wrap items-end gap-2">
            <Select
              aria-label={t.admin.postings.attacheLabel.replace('{mission}', mission.name)}
              value={chosen}
              onChange={(event) => setChoices((previous) => ({ ...previous, [mission.id]: event.target.value }))}
              placeholder={t.admin.postings.vacant}
              options={eligible.map((account) => ({ value: account.id, label: account.full_name }))}
            />
            <Button
              onClick={() => postingMutation.mutate({ missionId: mission.id, attacheId: chosen || null })}
              disabled={postingMutation.isPending}
            >
              {t.admin.saveButton}
            </Button>
            {posting?.active_attache_user_id && (
              <Button
                variant="ghost"
                onClick={() => postingMutation.mutate({ missionId: mission.id, attacheId: null })}
                disabled={postingMutation.isPending}
              >
                {t.admin.postings.clearButton}
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.admin.postings.title}</h1>
      <p className="mt-1 text-body text-text-secondary">{t.admin.postings.subtitle}</p>

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

      {notice && <p className="mt-4 text-body-sm text-success-soft-text">{notice}</p>}
      {errors.length > 0 && (
        <ul className="mt-4 list-disc pl-5 text-body-sm text-danger-soft-text" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {departmentId !== '' && (
        <div className="mt-6">
          <Table
            columns={columns}
            data={(missionsQuery.data ?? []).filter((mission) => mission.active)}
            rowKey={(mission) => mission.id}
          />
        </div>
      )}
    </div>
  )
}
