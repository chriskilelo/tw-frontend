import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAlertFieldSetting,
  getAlertFieldSettings,
  updateAlertFieldSetting,
} from '../../../api/sdt'
import type { MasterDataEntryOption } from '../../../api/alerts'
import { Table, type TableColumn } from '../../../components/Table'
import { Badge } from '../../../components/Badge'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { Pagination } from '../../../components/Pagination'
import { useClientPagination } from '../../../hooks/useClientPagination'
import { useAuth, isMinistryAdministrator } from '../../../hooks/useAuth'
import { useI18n } from '../../../i18n/context'

const QUERY_KEY = ['sdt', 'config', 'alert-fields'] as const

/**
 * FR-SDT-019. System Administrator only, enforced server-side by
 * MasterDataEntryPolicy::manage() on every ConfigController action including
 * GET. Same "no /ministries endpoint" fallback as AIEBudgetCodePage: a new
 * row's ministry_id defaults to the ministry shared by the existing entries.
 */
export default function AlertFieldsConfigPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const listQuery = useQuery({ queryKey: QUERY_KEY, queryFn: () => getAlertFieldSettings() })
  const entries = listQuery.data ?? []
  const { user, role } = useAuth()
  // ADR-006: a Ministry Administrator always writes to its own department (the backend pins
  // it too), so it never needs the free-text ministry field below.
  const defaultMinistryId = (isMinistryAdministrator(role?.name) ? user?.ministry_id : null) ?? entries[0]?.ministry_id ?? ''
  const entriesPage = useClientPagination(entries)

  const [newValue, setNewValue] = useState('')
  const [newDisplayOrder, setNewDisplayOrder] = useState('')
  const [newMinistryId, setNewMinistryId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDisplayOrder, setEditDisplayOrder] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createAlertFieldSetting({
        ministry_id: newMinistryId || defaultMinistryId,
        value: newValue,
        display_order: newDisplayOrder ? Number(newDisplayOrder) : undefined,
      }),
    onSuccess: () => {
      setNewValue('')
      setNewDisplayOrder('')
      setNewMinistryId('')
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; value?: string; display_order?: number; active?: boolean }) =>
      updateAlertFieldSetting(payload.id, {
        value: payload.value,
        display_order: payload.display_order,
        active: payload.active,
      }),
    onSuccess: () => {
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate()
  }

  function startEdit(entry: MasterDataEntryOption) {
    setEditingId(entry.id)
    setEditValue(entry.value)
    setEditDisplayOrder(String(entry.display_order))
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, value: editValue, display_order: editDisplayOrder ? Number(editDisplayOrder) : undefined })
  }

  function toggleActive(entry: MasterDataEntryOption) {
    updateMutation.mutate({ id: entry.id, active: !entry.active })
  }

  const columns: TableColumn<MasterDataEntryOption>[] = [
    {
      key: 'value',
      header: t.sdt.alertFields.columnValue,
      render: (row) =>
        editingId === row.id ? (
          <Input value={editValue} onChange={(event) => setEditValue(event.target.value)} />
        ) : (
          row.value
        ),
    },
    {
      key: 'display_order',
      header: t.sdt.alertFields.columnDisplayOrder,
      render: (row) =>
        editingId === row.id ? (
          <Input type="number" value={editDisplayOrder} onChange={(event) => setEditDisplayOrder(event.target.value)} />
        ) : (
          row.display_order
        ),
    },
    {
      key: 'active',
      header: t.sdt.alertFields.columnActive,
      render: (row) => (
        <Badge variant={row.active ? 'success' : 'neutral'} label={row.active ? t.common.active : t.common.inactive} />
      ),
    },
    {
      key: 'actions',
      header: t.sdt.alertFields.columnActions,
      render: (row) =>
        editingId === row.id ? (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => saveEdit(row.id)} disabled={updateMutation.isPending}>
              {t.sdt.alertFields.saveButton}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              {t.sdt.alertFields.cancelButton}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {t.sdt.alertFields.editButton}
            </Button>
            <Button variant={row.active ? 'danger' : 'primary'} onClick={() => toggleActive(row)} disabled={updateMutation.isPending}>
              {row.active ? t.sdt.alertFields.deactivateButton : t.sdt.alertFields.activateButton}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.sdt.alertFields.title}</h1>

      <div className="mt-6">
        <Table
          columns={columns}
          data={entriesPage.pageItems}
          rowKey={(row) => row.id}
          emptyMessage={t.sdt.alertFields.empty}
        />
        <Pagination
          meta={entriesPage.meta}
          onPageChange={entriesPage.setPage}
          onPerPageChange={entriesPage.setPerPage}
          className="mt-4"
        />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{t.sdt.alertFields.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label={t.sdt.alertFields.valueLabel}
            placeholder={t.sdt.alertFields.valuePlaceholder}
            required
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
          />
          <Input
            type="number"
            label={t.sdt.alertFields.displayOrderLabel}
            value={newDisplayOrder}
            onChange={(event) => setNewDisplayOrder(event.target.value)}
          />
          {!defaultMinistryId && (
            <Input
              label={t.sdt.alertFields.ministryIdLabel}
              required
              value={newMinistryId}
              onChange={(event) => setNewMinistryId(event.target.value)}
            />
          )}
          <p className="text-caption text-text-muted">{t.sdt.alertFields.ministryIdHint}</p>

          {createMutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

          <div>
            <Button type="submit" disabled={createMutation.isPending || (!newMinistryId && !defaultMinistryId)}>
              {t.sdt.alertFields.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
