import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, getUser, listRoles, updateUser, type UserCreateRequest } from '../../api/users'
import { listMissions } from '../../api/missions'
import { listDepartments } from '../../api/ministries'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Button } from '../../components/Button'
import { useAuth, isMinistryAdministrator, isSystemAdministrator, SYSTEM_ADMINISTRATOR } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'

/**
 * FR-AUTH-001 / FR-AUTH-021. Create (/admin/users/new) and edit (/admin/users/:id).
 *
 * The role list comes from GET /roles, which already narrows a Ministry Administrator to
 * the roles it may assign; its department is pinned server-side, so the department field
 * is only offered to a System Administrator. Mission-scoped roles (scope = 'mission')
 * need a mission; the home-department field applies to System Administrator accounts only.
 */
export default function UserFormPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { role } = useAuth()
  const systemAdministrator = isSystemAdministrator(role?.name)
  const isEdit = Boolean(id)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [missionId, setMissionId] = useState('')
  const [ministryId, setMinistryId] = useState('')
  const [homeMinistryId, setHomeMinistryId] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const rolesQuery = useQuery({ queryKey: ['admin', 'roles'], queryFn: listRoles })
  const missionsQuery = useQuery({ queryKey: ['missions'], queryFn: listMissions })
  const departmentsQuery = useQuery({ queryKey: ['admin', 'ministries'], queryFn: listDepartments, enabled: systemAdministrator })
  const userQuery = useQuery({ queryKey: ['admin', 'users', id], queryFn: () => getUser(id as string), enabled: isEdit })

  useEffect(() => {
    const existing = userQuery.data
    if (!existing) {
      return
    }
    setFullName(existing.full_name)
    setEmail(existing.email)
    setRoleId(existing.role?.id ?? '')
    setMissionId(existing.mission?.id ?? '')
    setMinistryId(existing.ministry?.id ?? '')
    setHomeMinistryId(existing.home_ministry?.id ?? '')
  }, [userQuery.data])

  const roles = rolesQuery.data ?? []
  const selectedRole = roles.find((candidate) => candidate.id === roleId)
  // Editing a role the actor may not assign (e.g. a PS, whose role only changes through an
  // approval request): keep it visible so the form still shows what the account holds.
  const roleOptions = roles.map((candidate) => ({ value: candidate.id, label: candidate.name }))
  if (userQuery.data?.role && !roles.some((candidate) => candidate.id === userQuery.data?.role?.id)) {
    roleOptions.push({ value: userQuery.data.role.id, label: userQuery.data.role.name })
  }
  const selectedRoleName = selectedRole?.name ?? userQuery.data?.role?.name
  const needsMission = selectedRole?.scope === 'mission'
  const showDepartment = systemAdministrator && selectedRole !== undefined && selectedRole.scope !== 'platform'
  const showHomeDepartment = systemAdministrator && selectedRoleName === SYSTEM_ADMINISTRATOR

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: UserCreateRequest = {
        full_name: fullName,
        email,
        role_id: roleId,
        mission_id: needsMission ? missionId || null : null,
        ...(showDepartment ? { ministry_id: ministryId || null } : {}),
        ...(showHomeDepartment ? { home_ministry_id: homeMinistryId || null } : {}),
      }
      return isEdit ? updateUser(id as string, payload) : createUser(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      navigate('/admin/users')
    },
    onError: (error) => setErrors(apiErrorMessages(error, t.common.genericError)),
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors([])
    saveMutation.mutate()
  }

  const departmentOptions = (departmentsQuery.data ?? []).map((ministry) => ({ value: ministry.id, label: ministry.name }))

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{isEdit ? t.admin.userForm.editTitle : t.admin.userForm.createTitle}</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-lg flex-col gap-4" data-testid="user-form">
        <Input label={t.admin.userForm.fullNameLabel} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <Input
          label={t.admin.userForm.emailLabel}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Select
          label={t.admin.userForm.roleLabel}
          required
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
          placeholder={t.admin.userForm.rolePlaceholder}
          options={roleOptions}
        />
        {isMinistryAdministrator(role?.name) && <p className="text-caption text-text-muted">{t.admin.userForm.psHint}</p>}

        {needsMission && (
          <Select
            label={t.admin.userForm.missionLabel}
            required
            value={missionId}
            onChange={(event) => setMissionId(event.target.value)}
            placeholder={t.admin.userForm.missionPlaceholder}
            options={(missionsQuery.data ?? []).map((mission) => ({ value: mission.id, label: mission.name }))}
          />
        )}

        {showDepartment && (
          <Select
            label={t.admin.departmentLabel}
            value={ministryId}
            onChange={(event) => setMinistryId(event.target.value)}
            placeholder={t.admin.departmentPlaceholder}
            options={departmentOptions}
          />
        )}

        {showHomeDepartment && (
          <div className="flex flex-col gap-1">
            <Select
              label={t.admin.userForm.homeDepartmentLabel}
              value={homeMinistryId}
              onChange={(event) => setHomeMinistryId(event.target.value)}
              placeholder={t.admin.userForm.noHomeDepartment}
              options={departmentOptions}
            />
            <p className="text-caption text-text-muted">{t.admin.userForm.homeDepartmentHint}</p>
          </div>
        )}

        {errors.length > 0 && (
          <ul className="list-disc pl-5 text-body-sm text-danger-soft-text" role="alert">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saveMutation.isPending}>
            {t.admin.saveButton}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/admin/users')}>
            {t.admin.cancelButton}
          </Button>
        </div>
      </form>
    </div>
  )
}
