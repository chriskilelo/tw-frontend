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
import { Pagination } from '../../../components/Pagination'
import { useClientPagination } from '../../../hooks/useClientPagination'
import { useAuth, isMinistryAdministrator } from '../../../hooks/useAuth'
import { useI18n } from '../../../i18n/context'

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
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState<InquirySettingCategory | ''>('')

  const listQuery = useQuery({
    queryKey: [...QUERY_KEY, categoryFilter],
    queryFn: () => getInquirySettings(categoryFilter || undefined),
  })
  const entries = listQuery.data ?? []
  const { user, role } = useAuth()
  // ADR-006: a Ministry Administrator always writes to its own department (the backend pins
  // it too), so it never needs the free-text ministry field below.
  const defaultMinistryId = (isMinistryAdministrator(role?.name) ? user?.ministry_id : null) ?? entries[0]?.ministry_id ?? ''
  const entriesPage = useClientPagination(entries)

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
    t.sdt.inquirySettings.categoryLabels[category as InquirySettingCategory] ?? category

  const columns: TableColumn<MasterDataEntryOption>[] = [
    {
      key: 'category',
      header: t.sdt.inquirySettings.columnCategory,
      render: (row) => categoryLabel(row.category),
    },
    {
      key: 'value',
      header: t.sdt.inquirySettings.columnValue,
      render: (row) =>
        editingId === row.id ? (
          <Input value={editValue} onChange={(event) => setEditValue(event.target.value)} />
        ) : (
          row.value
        ),
    },
    {
      key: 'display_order',
      header: t.sdt.inquirySettings.columnDisplayOrder,
      render: (row) =>
        editingId === row.id ? (
          <Input type="number" value={editDisplayOrder} onChange={(event) => setEditDisplayOrder(event.target.value)} />
        ) : (
          row.display_order
        ),
    },
    {
      key: 'active',
      header: t.sdt.inquirySettings.columnActive,
      render: (row) => (
        <Badge variant={row.active ? 'success' : 'neutral'} label={row.active ? t.common.active : t.common.inactive} />
      ),
    },
    {
      key: 'actions',
      header: t.sdt.inquirySettings.columnActions,
      render: (row) =>
        editingId === row.id ? (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => saveEdit(row.id)} disabled={updateMutation.isPending}>
              {t.sdt.inquirySettings.saveButton}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              {t.sdt.inquirySettings.cancelButton}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {t.sdt.inquirySettings.editButton}
            </Button>
            <Button variant={row.active ? 'danger' : 'primary'} onClick={() => toggleActive(row)} disabled={updateMutation.isPending}>
              {row.active ? t.sdt.inquirySettings.deactivateButton : t.sdt.inquirySettings.activateButton}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.sdt.inquirySettings.title}</h1>

      <label className="mt-4 flex max-w-xs flex-col gap-1">
        <span className="text-body-sm font-semibold text-text-secondary">{t.sdt.inquirySettings.filterLabel}</span>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as InquirySettingCategory | '')}
          className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">{t.sdt.inquirySettings.filterAll}</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabel(category)}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-6">
        <Table
          columns={columns}
          data={entriesPage.pageItems}
          rowKey={(row) => row.id}
          emptyMessage={t.sdt.inquirySettings.empty}
        />
        <Pagination
          meta={entriesPage.meta}
          onPageChange={entriesPage.setPage}
          onPerPageChange={entriesPage.setPerPage}
          className="mt-4"
        />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{t.sdt.inquirySettings.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">{t.sdt.inquirySettings.categoryFieldLabel}</span>
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
            label={t.sdt.inquirySettings.valueLabel}
            required
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
          />
          <Input
            type="number"
            label={t.sdt.inquirySettings.displayOrderLabel}
            value={newDisplayOrder}
            onChange={(event) => setNewDisplayOrder(event.target.value)}
          />
          {!defaultMinistryId && (
            <Input
              label={t.sdt.inquirySettings.ministryIdLabel}
              required
              value={newMinistryId}
              onChange={(event) => setNewMinistryId(event.target.value)}
            />
          )}
          <p className="text-caption text-text-muted">{t.sdt.inquirySettings.ministryIdHint}</p>

          {createMutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

          <div>
            <Button type="submit" disabled={createMutation.isPending || (!newMinistryId && !defaultMinistryId)}>
              {t.sdt.inquirySettings.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
