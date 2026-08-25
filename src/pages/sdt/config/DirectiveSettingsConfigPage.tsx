import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDirectiveSetting } from '../../../api/sdt'
import { getDirectiveTypeOptions, type DirectiveTypeOption } from '../../../api/directives'
import { Table, type TableColumn } from '../../../components/Table'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import en from '../../../i18n/en'

const QUERY_KEY = ['master-data', 'directive_type'] as const

/**
 * FR-SDT-010. System Administrator only. CLAUDE.md Section 8: directive_type
 * was deliberately left unseeded at go-live ("no fixed category list
 * configured"), so this screen lets a System Administrator start populating
 * it. Add-only, matching the backend exactly — Sdt\ConfigController has a
 * store action for this category but no GET or PATCH, so the list below is
 * read from the public GET /master-data?category=directive_type endpoint
 * (api/directives.ts's existing getDirectiveTypeOptions()) and there is no
 * edit/deactivate control here.
 */
export default function DirectiveSettingsConfigPage() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({ queryKey: QUERY_KEY, queryFn: getDirectiveTypeOptions })
  const entries = listQuery.data ?? []

  const [newValue, setNewValue] = useState('')
  const [newDisplayOrder, setNewDisplayOrder] = useState('')
  const [newMinistryId, setNewMinistryId] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createDirectiveSetting({
        ministry_id: newMinistryId,
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

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate()
  }

  const columns: TableColumn<DirectiveTypeOption>[] = [
    { key: 'value', header: en.sdt.directiveSettings.columnValue, render: (row) => row.value },
    { key: 'display_order', header: en.sdt.directiveSettings.columnDisplayOrder, render: (row) => row.display_order },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.sdt.directiveSettings.title}</h1>
      <p className="mt-2 text-body text-text-secondary">{en.sdt.directiveSettings.description}</p>

      <div className="mt-6">
        <Table columns={columns} data={entries} rowKey={(row) => row.id} emptyMessage={en.sdt.directiveSettings.empty} />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{en.sdt.directiveSettings.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label={en.sdt.directiveSettings.valueLabel}
            required
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
          />
          <Input
            type="number"
            label={en.sdt.directiveSettings.displayOrderLabel}
            value={newDisplayOrder}
            onChange={(event) => setNewDisplayOrder(event.target.value)}
          />
          <Input
            label={en.sdt.directiveSettings.ministryIdLabel}
            required
            value={newMinistryId}
            onChange={(event) => setNewMinistryId(event.target.value)}
          />
          <p className="text-caption text-text-muted">{en.sdt.directiveSettings.ministryIdHint}</p>

          {createMutation.isError && <p className="text-body-sm text-danger-soft-text">{en.common.genericError}</p>}

          <div>
            <Button type="submit" disabled={createMutation.isPending}>
              {en.sdt.directiveSettings.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
