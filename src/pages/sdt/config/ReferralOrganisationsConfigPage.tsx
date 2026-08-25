import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createReferralOrganisationSetting,
  getReferralOrganisationSettings,
  updateReferralOrganisationSetting,
} from '../../../api/sdt'
import type { ReferralOrganisation } from '../../../api/referrals'
import { Table, type TableColumn } from '../../../components/Table'
import { Badge } from '../../../components/Badge'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import en from '../../../i18n/en'

const QUERY_KEY = ['sdt', 'config', 'referral-organisations'] as const

/**
 * FR-SDT-023. System Administrator only (ReferralPolicy::manage()). This is
 * the admin CRUD surface for the same registry the public
 * GET /referral-organisations dropdown (api/referrals.ts) reads for
 * ReferralRecordModal — that endpoint stays read-only and open to any
 * authenticated user; this page is the only place entries are added/edited.
 */
export default function ReferralOrganisationsConfigPage() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({ queryKey: QUERY_KEY, queryFn: () => getReferralOrganisationSettings() })
  const organisations = listQuery.data ?? []
  const defaultMinistryId = organisations[0]?.ministry_id ?? ''

  const [newName, setNewName] = useState('')
  const [newMinistryId, setNewMinistryId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createReferralOrganisationSetting({
        ministry_id: newMinistryId || defaultMinistryId,
        name: newName,
      }),
    onSuccess: () => {
      setNewName('')
      setNewMinistryId('')
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name?: string; active?: boolean }) =>
      updateReferralOrganisationSetting(payload.id, { name: payload.name, active: payload.active }),
    onSuccess: () => {
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate()
  }

  function startEdit(organisation: ReferralOrganisation) {
    setEditingId(organisation.id)
    setEditName(organisation.name)
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, name: editName })
  }

  function toggleActive(organisation: ReferralOrganisation) {
    updateMutation.mutate({ id: organisation.id, active: !organisation.active })
  }

  const columns: TableColumn<ReferralOrganisation>[] = [
    {
      key: 'name',
      header: en.sdt.referralOrganisations.columnName,
      render: (row) =>
        editingId === row.id ? <Input value={editName} onChange={(event) => setEditName(event.target.value)} /> : row.name,
    },
    {
      key: 'active',
      header: en.sdt.referralOrganisations.columnActive,
      render: (row) => (
        <Badge variant={row.active ? 'success' : 'neutral'} label={row.active ? en.common.active : en.common.inactive} />
      ),
    },
    {
      key: 'actions',
      header: en.sdt.referralOrganisations.columnActions,
      render: (row) =>
        editingId === row.id ? (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => saveEdit(row.id)} disabled={updateMutation.isPending}>
              {en.sdt.referralOrganisations.saveButton}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              {en.sdt.referralOrganisations.cancelButton}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {en.sdt.referralOrganisations.editButton}
            </Button>
            <Button variant={row.active ? 'danger' : 'primary'} onClick={() => toggleActive(row)} disabled={updateMutation.isPending}>
              {row.active ? en.sdt.referralOrganisations.deactivateButton : en.sdt.referralOrganisations.activateButton}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.sdt.referralOrganisations.title}</h1>

      <div className="mt-6">
        <Table
          columns={columns}
          data={organisations}
          rowKey={(row) => row.id}
          emptyMessage={en.sdt.referralOrganisations.empty}
        />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{en.sdt.referralOrganisations.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label={en.sdt.referralOrganisations.nameLabel}
            required
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          {!defaultMinistryId && (
            <Input
              label={en.sdt.referralOrganisations.ministryIdLabel}
              required
              value={newMinistryId}
              onChange={(event) => setNewMinistryId(event.target.value)}
            />
          )}
          <p className="text-caption text-text-muted">{en.sdt.referralOrganisations.ministryIdHint}</p>

          {createMutation.isError && <p className="text-body-sm text-danger-soft-text">{en.common.genericError}</p>}

          <div>
            <Button type="submit" disabled={createMutation.isPending || (!newMinistryId && !defaultMinistryId)}>
              {en.sdt.referralOrganisations.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
