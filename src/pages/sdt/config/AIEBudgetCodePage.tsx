import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAieBudgetCode,
  getAieBudgetCodes,
  updateAieBudgetCode,
  type AieBudgetCodeEntry,
} from '../../../api/sdt'
import { Table, type TableColumn } from '../../../components/Table'
import { Badge } from '../../../components/Badge'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import en from '../../../i18n/en'

const QUERY_KEY = ['sdt', 'config', 'aie-budget-codes'] as const

/**
 * FR-SDT-022. System Administrator only — enforced server-side by
 * MasterDataEntryPolicy::manage() (Gate::authorize('manage', ...) on every ConfigController
 * action, including GET). No GET /ministries endpoint exists anywhere in this API yet
 * (CLAUDE.md Section 10 never lists one), so a new row's ministry_id defaults to the
 * ministry already shared by the existing budget codes below; an explicit ministry_id
 * field is offered only as a fallback for the empty-list case.
 */
export default function AIEBudgetCodePage() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({ queryKey: QUERY_KEY, queryFn: () => getAieBudgetCodes() })
  const entries = listQuery.data ?? []
  const defaultMinistryId = entries[0]?.ministry_id ?? ''

  const [newValue, setNewValue] = useState('')
  const [newDisplayOrder, setNewDisplayOrder] = useState('')
  const [newMinistryId, setNewMinistryId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDisplayOrder, setEditDisplayOrder] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createAieBudgetCode({
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
      updateAieBudgetCode(payload.id, {
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

  function startEdit(entry: AieBudgetCodeEntry) {
    setEditingId(entry.id)
    setEditValue(entry.value)
    setEditDisplayOrder(String(entry.display_order))
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, value: editValue, display_order: editDisplayOrder ? Number(editDisplayOrder) : undefined })
  }

  function toggleActive(entry: AieBudgetCodeEntry) {
    updateMutation.mutate({ id: entry.id, active: !entry.active })
  }

  const columns: TableColumn<AieBudgetCodeEntry>[] = [
    {
      key: 'value',
      header: en.sdt.aieBudgetCodes.columnValue,
      render: (row) =>
        editingId === row.id ? (
          <Input value={editValue} onChange={(event) => setEditValue(event.target.value)} />
        ) : (
          row.value
        ),
    },
    {
      key: 'display_order',
      header: en.sdt.aieBudgetCodes.columnDisplayOrder,
      render: (row) =>
        editingId === row.id ? (
          <Input type="number" value={editDisplayOrder} onChange={(event) => setEditDisplayOrder(event.target.value)} />
        ) : (
          row.display_order
        ),
    },
    {
      key: 'active',
      header: en.sdt.aieBudgetCodes.columnActive,
      render: (row) => (
        <Badge variant={row.active ? 'success' : 'neutral'} label={row.active ? en.common.active : en.common.inactive} />
      ),
    },
    {
      key: 'actions',
      header: en.sdt.aieBudgetCodes.columnActions,
      render: (row) =>
        editingId === row.id ? (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => saveEdit(row.id)} disabled={updateMutation.isPending}>
              {en.sdt.aieBudgetCodes.saveButton}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              {en.sdt.aieBudgetCodes.cancelButton}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {en.sdt.aieBudgetCodes.editButton}
            </Button>
            <Button variant={row.active ? 'danger' : 'primary'} onClick={() => toggleActive(row)} disabled={updateMutation.isPending}>
              {row.active ? en.sdt.aieBudgetCodes.deactivateButton : en.sdt.aieBudgetCodes.activateButton}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.sdt.aieBudgetCodes.title}</h1>

      <div className="mt-6">
        <Table columns={columns} data={entries} rowKey={(row) => row.id} emptyMessage={en.sdt.aieBudgetCodes.empty} />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{en.sdt.aieBudgetCodes.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label={en.sdt.aieBudgetCodes.valueLabel}
            placeholder={en.sdt.aieBudgetCodes.valuePlaceholder}
            required
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
          />
          <Input
            type="number"
            label={en.sdt.aieBudgetCodes.displayOrderLabel}
            value={newDisplayOrder}
            onChange={(event) => setNewDisplayOrder(event.target.value)}
          />
          {!defaultMinistryId && (
            <Input
              label={en.sdt.aieBudgetCodes.ministryIdLabel}
              required
              value={newMinistryId}
              onChange={(event) => setNewMinistryId(event.target.value)}
            />
          )}
          <p className="text-caption text-text-muted">{en.sdt.aieBudgetCodes.ministryIdHint}</p>

          {createMutation.isError && <p className="text-body-sm text-danger-soft-text">{en.common.genericError}</p>}

          <div>
            <Button type="submit" disabled={createMutation.isPending || (!newMinistryId && !defaultMinistryId)}>
              {en.sdt.aieBudgetCodes.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
