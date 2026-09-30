import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDirectiveSetting,
  listDirectiveSettings,
  updateDirectiveSetting,
  type DirectiveSettingEntry,
  type DirectiveSettingUpdateRequest,
} from '../../../api/sdt'
import { Table, type TableColumn } from '../../../components/Table'
import { Badge } from '../../../components/Badge'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { Pagination } from '../../../components/Pagination'
import { useClientPagination } from '../../../hooks/useClientPagination'
import { useAuth, isMinistryAdministrator } from '../../../hooks/useAuth'
import { useI18n } from '../../../i18n/context'

/**
 * Shares its prefix with the issue form's active-only list (['master-data', 'directive_type'],
 * IssueDirectivePage), so invalidating the prefix refreshes both after a change.
 */
const QUERY_PREFIX = ['master-data', 'directive_type'] as const
const QUERY_KEY = [...QUERY_PREFIX, 'all'] as const

/**
 * FR-DIR-001 / FR-SDT-010: the configurable, optional directive type categories. CLAUDE.md
 * Section 8 left directive_type unseeded at go-live, so this is where it gets populated.
 * Adding uses Sdt\ConfigController::storeDirectiveSetting(); listing (inactive entries
 * included) and rename / reorder / activate / deactivate use the generic master-data
 * endpoints (FR-MDATA-002). Deactivating only hides a type from the issue form: directives
 * store type_category as text, so existing ones keep their value. The System Administrator
 * and a department's Ministry Administrator (own department only) may manage these; the
 * API enforces it (MasterDataEntryPolicy), this page does not re-check roles.
 */
export default function DirectiveSettingsConfigPage() {
  const { t } = useI18n()
  const copy = t.sdt.directiveSettings
  const queryClient = useQueryClient()

  const listQuery = useQuery({ queryKey: QUERY_KEY, queryFn: listDirectiveSettings })
  const entries = listQuery.data ?? []
  const entriesPage = useClientPagination(entries)

  const { user, role } = useAuth()
  // ADR-006: a Ministry Administrator always writes to its own department (the backend pins
  // it too). Otherwise a new row defaults to the department the existing entries share, and
  // only an empty list needs the free-text ministry field (no GET /ministries picker exists).
  const defaultMinistryId = (isMinistryAdministrator(role?.name) ? user?.ministry_id : null) ?? entries.find((entry) => entry.ministry_id)?.ministry_id ?? ''

  const [newValue, setNewValue] = useState('')
  const [newDisplayOrder, setNewDisplayOrder] = useState('')
  const [newMinistryId, setNewMinistryId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDisplayOrder, setEditDisplayOrder] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createDirectiveSetting({
        ministry_id: newMinistryId || defaultMinistryId,
        value: newValue.trim(),
        display_order: newDisplayOrder ? Number(newDisplayOrder) : undefined,
      }),
    onSuccess: () => {
      setNewValue('')
      setNewDisplayOrder('')
      setNewMinistryId('')
      void queryClient.invalidateQueries({ queryKey: QUERY_PREFIX })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: DirectiveSettingUpdateRequest & { id: string }) => updateDirectiveSetting(id, payload),
    onSuccess: () => {
      setEditingId(null)
      void queryClient.invalidateQueries({ queryKey: QUERY_PREFIX })
    },
  })

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate()
  }

  function startEdit(entry: DirectiveSettingEntry) {
    updateMutation.reset()
    setEditingId(entry.id)
    setEditValue(entry.value)
    setEditDisplayOrder(String(entry.display_order))
  }

  function saveEdit(id: string) {
    updateMutation.mutate({
      id,
      value: editValue.trim(),
      ...(editDisplayOrder !== '' ? { display_order: Number(editDisplayOrder) } : {}),
    })
  }

  const columns: TableColumn<DirectiveSettingEntry>[] = [
    {
      key: 'value',
      header: copy.columnValue,
      render: (row) =>
        editingId === row.id ? (
          <Input aria-label={copy.editValueLabel(row.value)} required maxLength={255} value={editValue} onChange={(event) => setEditValue(event.target.value)} />
        ) : (
          row.value
        ),
    },
    {
      key: 'display_order',
      header: copy.columnDisplayOrder,
      render: (row) =>
        editingId === row.id ? (
          <Input
            type="number"
            min={0}
            aria-label={copy.editDisplayOrderLabel(row.value)}
            value={editDisplayOrder}
            onChange={(event) => setEditDisplayOrder(event.target.value)}
            className="w-24"
          />
        ) : (
          row.display_order
        ),
    },
    {
      key: 'active',
      header: copy.columnActive,
      render: (row) => (
        <Badge
          variant={row.active ? 'success' : 'neutral'}
          label={row.active ? t.common.active : t.common.inactive}
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
              {row.active ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              )}
            </svg>
          }
        />
      ),
    },
    {
      key: 'actions',
      header: copy.columnActions,
      render: (row) =>
        editingId === row.id ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => saveEdit(row.id)} disabled={updateMutation.isPending || editValue.trim() === ''}>
              {copy.saveButton}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              {copy.cancelButton}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => startEdit(row)} aria-label={`${copy.editButton}: ${row.value}`}>
              {copy.editButton}
            </Button>
            <Button
              variant={row.active ? 'danger' : 'primary'}
              onClick={() => updateMutation.mutate({ id: row.id, active: !row.active })}
              disabled={updateMutation.isPending}
              aria-label={`${row.active ? copy.deactivateButton : copy.activateButton}: ${row.value}`}
            >
              {row.active ? copy.deactivateButton : copy.activateButton}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-7">
      <h1 className="text-h1 text-primary">{copy.title}</h1>
      <p className="mt-2 max-w-3xl text-body text-text-secondary">{copy.description}</p>

      <div className="mt-6">
        {listQuery.isError ? (
          <p role="alert" className="text-body-sm text-danger-soft-text">
            {copy.loadError}
          </p>
        ) : (
          <>
            <Table columns={columns} data={entriesPage.pageItems} rowKey={(row) => row.id} emptyMessage={copy.empty} />
            <Pagination meta={entriesPage.meta} onPageChange={entriesPage.setPage} onPerPageChange={entriesPage.setPerPage} className="mt-4" />
          </>
        )}
        {updateMutation.isError && (
          <p role="alert" className="mt-3 text-body-sm text-danger-soft-text">
            {copy.updateError}
          </p>
        )}
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border bg-white p-4">
        <h2 className="text-h3 text-primary">{copy.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <Input label={copy.valueLabel} required maxLength={255} value={newValue} onChange={(event) => setNewValue(event.target.value)} />
          <Input type="number" min={0} label={copy.displayOrderLabel} value={newDisplayOrder} onChange={(event) => setNewDisplayOrder(event.target.value)} />
          {!defaultMinistryId && (
            <>
              <Input label={copy.ministryIdLabel} required value={newMinistryId} onChange={(event) => setNewMinistryId(event.target.value)} />
              <p className="text-caption text-text-muted">{copy.ministryIdHint}</p>
            </>
          )}

          {createMutation.isError && (
            <p role="alert" className="text-body-sm text-danger-soft-text">
              {t.common.genericError}
            </p>
          )}

          <div>
            <Button type="submit" disabled={createMutation.isPending || newValue.trim() === '' || (!newMinistryId && !defaultMinistryId)}>
              {copy.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
