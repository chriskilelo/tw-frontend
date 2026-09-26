import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveApprovalRequest,
  cancelApprovalRequest,
  listApprovalRequests,
  rejectApprovalRequest,
  requestPsAppointment,
  requestPsDeactivation,
  requestPsPromotion,
  requestPsSuccession,
  type ApprovalRequest,
  type ApprovalRequestStatus,
  type ApprovalRequestType,
} from '../../api/approvals'
import { listUsers } from '../../api/users'
import { Table, type TableColumn } from '../../components/Table'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Modal } from '../../components/Modal'
import { Pagination, DEFAULT_PER_PAGE } from '../../components/Pagination'
import { useAuth, isMinistryAdministrator, isSystemAdministrator } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'
import { ApprovalStatusBadge } from './AdminStatusBadges'

const STATUSES: ApprovalRequestStatus[] = ['pending', 'approved', 'rejected', 'cancelled']
const TYPES: ApprovalRequestType[] = ['ps_appointment', 'ps_promotion', 'ps_deactivation', 'ps_succession']
/** Roles that can never be promoted into the PS role (mirrors PsApprovalService::INELIGIBLE_ROLES). */
const INELIGIBLE_ROLES = ['System Administrator', 'Ministry Administrator', 'Ministry PS', 'Acting PS']

/**
 * FR-AUTH-022/023, BR-027. A Ministry Administrator raises and tracks its department's
 * Principal Secretary requests here; a System Administrator decides them. /admin/approvals/:id
 * (the link in the approval notifications) highlights that request in the list.
 */
export default function ApprovalRequestsPage() {
  const { t } = useI18n()
  const { id: highlightedId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const systemAdministrator = isSystemAdministrator(role?.name)
  const ministryAdministrator = isMinistryAdministrator(role?.name)

  const [status, setStatus] = useState<ApprovalRequestStatus | ''>(systemAdministrator ? 'pending' : '')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)
  const [rejecting, setRejecting] = useState<ApprovalRequest | null>(null)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const listQuery = useQuery({
    queryKey: ['admin', 'approvals', { status, page, perPage }],
    queryFn: () => listApprovalRequests({ status: status || undefined, page, per_page: perPage }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'approvals'] })
  const onError = (error: unknown) => setErrors(apiErrorMessages(error, t.common.genericError))

  const approveMutation = useMutation({ mutationFn: approveApprovalRequest, onSuccess: invalidate, onError })
  const cancelMutation = useMutation({ mutationFn: cancelApprovalRequest, onSuccess: invalidate, onError })
  const rejectMutation = useMutation({
    mutationFn: () => rejectApprovalRequest(rejecting?.id as string, reason),
    onSuccess: () => {
      setRejecting(null)
      setReason('')
      invalidate()
    },
    onError,
  })

  function personLabel(row: ApprovalRequest): string {
    const payload = row.payload ?? {}
    switch (row.type) {
      case 'ps_appointment':
        return payload.full_name ?? '—'
      case 'ps_succession':
        return t.admin.approvals.incomingSummary
          .replace('{outgoing}', row.subject_user?.full_name ?? '—')
          .replace('{incoming}', payload.incoming_full_name ?? '…')
      default:
        return row.subject_user?.full_name ?? '—'
    }
  }

  const columns: TableColumn<ApprovalRequest>[] = [
    { key: 'type', header: t.admin.approvals.columnType, render: (row) => t.admin.approvals.type[row.type] },
    ...(systemAdministrator
      ? [{ key: 'department', header: t.admin.approvals.columnDepartment, render: (row: ApprovalRequest) => row.ministry?.name ?? '—' }]
      : []),
    { key: 'person', header: t.admin.approvals.columnPerson, render: personLabel },
    { key: 'requestedBy', header: t.admin.approvals.columnRequestedBy, render: (row) => row.requested_by?.full_name ?? '—' },
    {
      key: 'status',
      header: t.admin.approvals.columnStatus,
      render: (row) => (
        <div className="flex flex-col gap-1">
          <ApprovalStatusBadge status={row.status} />
          {row.decision_reason && (
            <span className="text-caption text-text-muted">
              {t.admin.approvals.decisionReason.replace('{reason}', row.decision_reason)}
            </span>
          )}
        </div>
      ),
    },
    { key: 'submitted', header: t.admin.approvals.columnSubmitted, render: (row) => new Date(row.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: t.admin.columnActions,
      render: (row) => {
        if (row.status !== 'pending') {
          return null
        }
        if (systemAdministrator) {
          return (
            <div className="flex gap-2">
              <Button onClick={() => approveMutation.mutate(row.id)} disabled={approveMutation.isPending}>
                {t.admin.approvals.approveButton}
              </Button>
              <Button variant="danger" onClick={() => setRejecting(row)}>
                {t.admin.approvals.rejectButton}
              </Button>
            </div>
          )
        }
        return row.requested_by?.id === user?.id ? (
          <Button variant="ghost" onClick={() => cancelMutation.mutate(row.id)} disabled={cancelMutation.isPending}>
            {t.admin.approvals.cancelRequestButton}
          </Button>
        ) : null
      },
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.admin.approvals.title}</h1>
      <p className="mt-1 text-body text-text-secondary">
        {systemAdministrator ? t.admin.approvals.subtitleSystem : t.admin.approvals.subtitleMinistry}
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Select
          label={t.admin.statusFilterLabel}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ApprovalRequestStatus | '')
            setPage(1)
          }}
          placeholder={t.admin.allStatuses}
          options={STATUSES.map((value) => ({ value, label: t.admin.approvals.status[value] }))}
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-4 list-disc pl-5 text-body-sm text-danger-soft-text" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        {listQuery.isLoading ? (
          <p className="text-body text-text-muted">{t.common.loading}</p>
        ) : (
          <Table
            columns={columns}
            data={listQuery.data?.data ?? []}
            rowKey={(row) => row.id}
            emptyMessage={t.admin.approvals.empty}
            getRowClassName={(row) => (row.id === highlightedId ? 'bg-accent-soft' : undefined)}
          />
        )}
        {listQuery.data?.meta && (
          <Pagination
            meta={listQuery.data.meta}
            onPageChange={setPage}
            onPerPageChange={(value) => {
              setPerPage(value)
              setPage(1)
            }}
            className="mt-4"
          />
        )}
      </div>

      {ministryAdministrator && <NewPsRequestForm onSubmitted={invalidate} />}

      <Modal open={rejecting !== null} onClose={() => setRejecting(null)} title={t.admin.approvals.rejectTitle}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            rejectMutation.mutate()
          }}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">{t.admin.approvals.reasonLabel}</span>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {t.admin.cancelButton}
            </Button>
            <Button type="submit" variant="danger" disabled={rejectMutation.isPending || reason.trim() === ''}>
              {t.admin.approvals.rejectButton}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

/**
 * The four PS request types. The sitting PS and the eligible accounts come from the
 * department's own account list (GET /users is already pinned to the department).
 */
function NewPsRequestForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { t } = useI18n()
  const [type, setType] = useState<ApprovalRequestType>('ps_appointment')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [incomingMode, setIncomingMode] = useState<'existing' | 'new'>('existing')
  const [notice, setNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const usersQuery = useQuery({ queryKey: ['admin', 'users', 'department-all'], queryFn: () => listUsers({ per_page: 100 }) })
  const accounts = (usersQuery.data?.data ?? []).filter((account) => account.status !== 'deactivated')
  const sittingPs = accounts.find((account) => account.role?.name === 'Ministry PS')
  const eligible = accounts.filter((account) => !INELIGIBLE_ROLES.includes(account.role?.name ?? ''))
  const eligibleOptions = eligible.map((account) => ({ value: account.id, label: `${account.full_name} — ${account.role?.name ?? ''}` }))

  const needsSittingPs = type === 'ps_deactivation' || type === 'ps_succession'
  const needsNewPerson = type === 'ps_appointment' || (type === 'ps_succession' && incomingMode === 'new')
  const needsExistingUser = type === 'ps_promotion' || (type === 'ps_succession' && incomingMode === 'existing')

  const submitMutation = useMutation({
    mutationFn: () => {
      switch (type) {
        case 'ps_appointment':
          return requestPsAppointment({ full_name: fullName, email })
        case 'ps_promotion':
          return requestPsPromotion(userId)
        case 'ps_deactivation':
          return requestPsDeactivation(sittingPs?.id as string)
        case 'ps_succession':
          return requestPsSuccession({
            outgoing_user_id: sittingPs?.id as string,
            ...(incomingMode === 'existing' ? { incoming_user_id: userId } : { incoming_full_name: fullName, incoming_email: email }),
          })
      }
    },
    onSuccess: () => {
      setFullName('')
      setEmail('')
      setUserId('')
      setErrors([])
      setNotice(t.admin.approvals.submitted)
      onSubmitted()
    },
    onError: (error) => {
      setNotice(null)
      setErrors(apiErrorMessages(error, t.common.genericError))
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitMutation.mutate()
  }

  const blocked = needsSittingPs && !sittingPs

  return (
    <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
      <h2 className="text-h3 text-primary">{t.admin.approvals.newTitle}</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" data-testid="ps-request-form">
        <Select
          label={t.admin.approvals.typeLabel}
          value={type}
          onChange={(event) => setType(event.target.value as ApprovalRequestType)}
          options={TYPES.map((value) => ({ value, label: t.admin.approvals.type[value] }))}
        />

        {needsSittingPs &&
          (sittingPs ? (
            <Input label={t.admin.approvals.outgoingLabel} value={sittingPs.full_name} readOnly />
          ) : (
            <p className="text-body-sm text-text-muted">{t.admin.approvals.noSittingPs}</p>
          ))}

        {type === 'ps_succession' && (
          <Select
            label={t.admin.approvals.incomingModeLabel}
            value={incomingMode}
            onChange={(event) => setIncomingMode(event.target.value as 'existing' | 'new')}
            options={[
              { value: 'existing', label: t.admin.approvals.incomingExisting },
              { value: 'new', label: t.admin.approvals.incomingNew },
            ]}
          />
        )}

        {needsExistingUser && (
          <Select
            label={t.admin.approvals.existingUserLabel}
            required
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder={t.admin.approvals.userPlaceholder}
            options={eligibleOptions}
          />
        )}

        {needsNewPerson && (
          <>
            <Input label={t.admin.approvals.fullNameLabel} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
            <Input
              label={t.admin.approvals.emailLabel}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </>
        )}

        {notice && <p className="text-body-sm text-success-soft-text">{notice}</p>}
        {errors.length > 0 && (
          <ul className="list-disc pl-5 text-body-sm text-danger-soft-text" role="alert">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <div>
          <Button type="submit" disabled={submitMutation.isPending || blocked}>
            {t.admin.approvals.submitButton}
          </Button>
        </div>
      </form>
    </div>
  )
}
