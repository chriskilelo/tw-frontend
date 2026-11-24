import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listUsers, type ManagedUser } from '../../api/users'
import { listDepartments } from '../../api/ministries'
import { Table, type TableColumn } from '../../components/Table'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { Modal } from '../../components/Modal'
import { Pagination, DEFAULT_PER_PAGE } from '../../components/Pagination'
import { useAuth, isSystemAdministrator } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { UserStatusBadge } from './AdminStatusBadges'
import { accountLifecycleAccess, useAccountLifecycle } from './useAccountLifecycle'

const USER_STATUSES: ManagedUser['status'][] = ['activation_pending', 'active', 'locked', 'deactivated']

/**
 * FR-AUTH-003 / FR-AUTH-021 / ADR-006. A System Administrator sees every account and may
 * filter by department; a Ministry Administrator sees only its own department (GET /users
 * pins it server-side — the department filter is simply not offered). Deactivated accounts
 * stay listed so they can be reactivated (ISS-021). Administrator accounts are listed but not
 * editable by a Ministry Administrator: the backend answers 403 and the row actions are
 * hidden to match (UI-006 convenience only, never the enforcement).
 */
export default function UserListPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const systemAdministrator = isSystemAdministrator(role?.name)
  const lifecycle = useAccountLifecycle()

  const [status, setStatus] = useState('')
  const [department, setDepartment] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)
  const [confirming, setConfirming] = useState<ManagedUser | null>(null)

  const departmentsQuery = useQuery({
    queryKey: ['admin', 'ministries'],
    queryFn: listDepartments,
    enabled: systemAdministrator,
  })

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', { status, department, page, perPage }],
    queryFn: () =>
      listUsers({
        status: status || undefined,
        ministry: department || undefined,
        page,
        per_page: perPage,
      }),
  })

  const columns: TableColumn<ManagedUser>[] = [
    { key: 'name', header: t.admin.users.columnName, render: (row) => row.full_name },
    { key: 'email', header: t.admin.users.columnEmail, render: (row) => row.email },
    { key: 'role', header: t.admin.users.columnRole, render: (row) => row.role?.name ?? '—' },
    { key: 'mission', header: t.admin.users.columnMission, render: (row) => row.mission?.name ?? '—' },
    ...(systemAdministrator
      ? [{ key: 'department', header: t.admin.users.columnDepartment, render: (row: ManagedUser) => row.ministry?.name ?? '—' }]
      : []),
    { key: 'status', header: t.admin.users.columnStatus, render: (row) => <UserStatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: t.admin.columnActions,
      render: (row) => {
        const access = accountLifecycleAccess({ id: user?.id, roleName: role?.name }, row)
        if (access === 'view_only' || access === 'own_account') {
          return null
        }
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/admin/users/${row.id}`)}>
              {t.admin.users.editButton}
            </Button>
            {access === 'manage' &&
              (row.status === 'deactivated' ? (
                <Button variant="primary" onClick={() => lifecycle.reactivate.mutate(row)} disabled={lifecycle.isPending}>
                  {t.admin.users.reactivateButton}
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setConfirming(row)} disabled={lifecycle.isPending}>
                  {t.admin.users.deactivateButton}
                </Button>
              ))}
            {access === 'manage' && row.status === 'activation_pending' && (
              <Button variant="ghost" onClick={() => lifecycle.resend.mutate(row)} disabled={lifecycle.isPending}>
                {t.admin.users.resendButton}
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const subtitle = systemAdministrator
    ? t.admin.users.subtitleAll
    : t.admin.users.subtitleDepartment.replace('{department}', user?.ministry?.name ?? '')

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-primary">{t.admin.users.title}</h1>
          <p className="mt-1 text-body text-text-secondary">{subtitle}</p>
        </div>
        <Link to="/admin/users/new">
          <Button>{t.admin.users.newButton}</Button>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <Select
          label={t.admin.statusFilterLabel}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          placeholder={t.admin.allStatuses}
          options={USER_STATUSES.map((value) => ({ value, label: t.admin.userStatus[value] }))}
        />
        {systemAdministrator && (
          <Select
            label={t.admin.departmentLabel}
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value)
              setPage(1)
            }}
            placeholder={t.admin.allDepartments}
            options={(departmentsQuery.data ?? []).map((ministry) => ({ value: ministry.id, label: ministry.name }))}
          />
        )}
      </div>

      {lifecycle.notice && (
        <p role="status" className="mt-4 text-body-sm text-success-soft-text">
          {lifecycle.notice}
        </p>
      )}
      {lifecycle.errors.length > 0 && (
        <ul role="alert" className="mt-4 list-disc pl-5 text-body-sm text-danger-soft-text">
          {lifecycle.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        {usersQuery.isLoading ? (
          <p className="text-body text-text-muted">{t.common.loading}</p>
        ) : (
          <Table
            columns={columns}
            data={usersQuery.data?.data ?? []}
            rowKey={(row) => row.id}
            emptyMessage={t.admin.users.empty}
          />
        )}
        {usersQuery.data?.meta && (
          <Pagination
            meta={usersQuery.data.meta}
            onPageChange={setPage}
            onPerPageChange={(value) => {
              setPerPage(value)
              setPage(1)
            }}
            className="mt-4"
          />
        )}
      </div>

      <Modal open={confirming !== null} onClose={() => setConfirming(null)} title={t.admin.users.deactivateButton}>
        <p className="text-body text-text-primary">
          {t.admin.users.confirmDeactivate.replace('{name}', confirming?.full_name ?? '')}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirming(null)}>
            {t.admin.cancelButton}
          </Button>
          <Button
            variant="danger"
            onClick={() => confirming && lifecycle.deactivate.mutate(confirming, { onSettled: () => setConfirming(null) })}
            disabled={lifecycle.isPending}
          >
            {t.admin.users.deactivateButton}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
