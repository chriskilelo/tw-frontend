import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInquirySetting,
  getInquirySettings,
  updateInquirySetting,
  type InquirySettingCategory,
} from '../../../api/sdt'
import type { MasterDataEntryOption } from '../../../api/alerts'
import { Table, type TableColumn } from '../../../components/Table'
import { Badge } from '../../../components/Badge'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import en from '../../../i18n/en'

const QUERY_KEY = ['sdt', 'config', 'inquiry-settings'] as const

const CATEGORIES: InquirySettingCategory[] = ['inquiry_category', 'inquiry_workflow_status', 'inquiry_event_type']

/**
 * FR-SDT-020. System Administrator only (MasterDataEntryPolicy::manage()).
 * Administers three master_data_entries categories at once (CLAUDE.md
 * Section 7): inquiry_category, inquiry_workflow_status, inquiry_event_type.
 * The workflow *transitions* themselves stay hardcoded in InquiryService
 * (CLAUDE.md Session 11 note) — this screen only manages the value lists.
 */
export default function InquirySettingsConfigPage() {
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState<InquirySettingCategory | ''>('')

  const listQuery = useQuery({
    queryKey: [...QUERY_KEY, categoryFilter],
    queryFn: () => getInquirySettings(categoryFilter || undefined),
  })
  const entries = listQuery.data ?? []
  const defaultMinistryId = entries[0]?.ministry_id ?? ''

  const [newCategory, setNewCategory] = useState<InquirySettingCategory>('inquiry_category')
  const [newValue, setNewValue] = useState('')
  const [newDisplayOrder, setNewDisplayOrder] = useState('')
  const [newMinistryId, setNewMinistryId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDisplayOrder, setEditDisplayOrder] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createInquirySetting({
        category: newCategory,
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
      updateInquirySetting(payload.id, {
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

  const categoryLabel = (category: string) =>
    en.sdt.inquirySettings.categoryLabels[category as InquirySettingCategory] ?? category

  const columns: TableColumn<MasterDataEntryOption>[] = [
    {
      key: 'category',
      header: en.sdt.inquirySettings.columnCategory,
      render: (row) => categoryLabel(row.category),
    },
    {
      key: 'value',
      header: en.sdt.inquirySettings.columnValue,
      render: (row) =>
        editingId === row.id ? (
          <Input value={editValue} onChange={(event) => setEditValue(event.target.value)} />
        ) : (
          row.value
        ),
    },
    {
      key: 'display_order',
      header: en.sdt.inquirySettings.columnDisplayOrder,
      render: (row) =>
        editingId === row.id ? (
          <Input type="number" value={editDisplayOrder} onChange={(event) => setEditDisplayOrder(event.target.value)} />
        ) : (
          row.display_order
        ),
    },
    {
      key: 'active',
      header: en.sdt.inquirySettings.columnActive,
      render: (row) => (
        <Badge variant={row.active ? 'success' : 'neutral'} label={row.active ? en.common.active : en.common.inactive} />
      ),
    },
    {
      key: 'actions',
      header: en.sdt.inquirySettings.columnActions,
      render: (row) =>
        editingId === row.id ? (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => saveEdit(row.id)} disabled={updateMutation.isPending}>
              {en.sdt.inquirySettings.saveButton}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              {en.sdt.inquirySettings.cancelButton}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {en.sdt.inquirySettings.editButton}
            </Button>
            <Button variant={row.active ? 'danger' : 'primary'} onClick={() => toggleActive(row)} disabled={updateMutation.isPending}>
              {row.active ? en.sdt.inquirySettings.deactivateButton : en.sdt.inquirySettings.activateButton}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.sdt.inquirySettings.title}</h1>

      <label className="mt-4 flex max-w-xs flex-col gap-1">
        <span className="text-body-sm font-semibold text-text-secondary">{en.sdt.inquirySettings.filterLabel}</span>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as InquirySettingCategory | '')}
          className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">{en.sdt.inquirySettings.filterAll}</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabel(category)}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-6">
        <Table columns={columns} data={entries} rowKey={(row) => row.id} emptyMessage={en.sdt.inquirySettings.empty} />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{en.sdt.inquirySettings.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">{en.sdt.inquirySettings.categoryFieldLabel}</span>
            <select
              required
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value as InquirySettingCategory)}
              className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <Input
            label={en.sdt.inquirySettings.valueLabel}
            required
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
          />
          <Input
            type="number"
            label={en.sdt.inquirySettings.displayOrderLabel}
            value={newDisplayOrder}
            onChange={(event) => setNewDisplayOrder(event.target.value)}
          />
          {!defaultMinistryId && (
            <Input
              label={en.sdt.inquirySettings.ministryIdLabel}
              required
              value={newMinistryId}
              onChange={(event) => setNewMinistryId(event.target.value)}
            />
          )}
          <p className="text-caption text-text-muted">{en.sdt.inquirySettings.ministryIdHint}</p>

          {createMutation.isError && <p className="text-body-sm text-danger-soft-text">{en.common.genericError}</p>}

          <div>
            <Button type="submit" disabled={createMutation.isPending || (!newMinistryId && !defaultMinistryId)}>
              {en.sdt.inquirySettings.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
