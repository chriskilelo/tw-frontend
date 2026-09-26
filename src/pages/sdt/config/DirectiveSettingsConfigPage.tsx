import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDirectiveSetting } from '../../../api/sdt'
import { getDirectiveTypeOptions, type DirectiveTypeOption } from '../../../api/directives'
import { Table, type TableColumn } from '../../../components/Table'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { Pagination } from '../../../components/Pagination'
import { useClientPagination } from '../../../hooks/useClientPagination'
import { useAuth, isMinistryAdministrator } from '../../../hooks/useAuth'
import { useI18n } from '../../../i18n/context'

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
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const listQuery = useQuery({ queryKey: QUERY_KEY, queryFn: getDirectiveTypeOptions })
  const entries = listQuery.data ?? []
  const entriesPage = useClientPagination(entries)

  const [newValue, setNewValue] = useState('')
  const [newDisplayOrder, setNewDisplayOrder] = useState('')
  const [newMinistryId, setNewMinistryId] = useState('')
  const { user, role } = useAuth()
  // ADR-006: a Ministry Administrator always writes to its own department (pinned server-side).
  const ownMinistryId = isMinistryAdministrator(role?.name) ? (user?.ministry_id ?? '') : ''

  const createMutation = useMutation({
    mutationFn: () =>
      createDirectiveSetting({
        ministry_id: ownMinistryId || newMinistryId,
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
    { key: 'value', header: t.sdt.directiveSettings.columnValue, render: (row) => row.value },
    { key: 'display_order', header: t.sdt.directiveSettings.columnDisplayOrder, render: (row) => row.display_order },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.sdt.directiveSettings.title}</h1>
      <p className="mt-2 text-body text-text-secondary">{t.sdt.directiveSettings.description}</p>

      <div className="mt-6">
        <Table
          columns={columns}
          data={entriesPage.pageItems}
          rowKey={(row) => row.id}
          emptyMessage={t.sdt.directiveSettings.empty}
        />
        <Pagination
          meta={entriesPage.meta}
          onPageChange={entriesPage.setPage}
          onPerPageChange={entriesPage.setPerPage}
          className="mt-4"
        />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{t.sdt.directiveSettings.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label={t.sdt.directiveSettings.valueLabel}
            required
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
          />
          <Input
            type="number"
            label={t.sdt.directiveSettings.displayOrderLabel}
            value={newDisplayOrder}
            onChange={(event) => setNewDisplayOrder(event.target.value)}
          />
          {!ownMinistryId && (
            <>
              <Input
                label={t.sdt.directiveSettings.ministryIdLabel}
                required
                value={newMinistryId}
                onChange={(event) => setNewMinistryId(event.target.value)}
              />
              <p className="text-caption text-text-muted">{t.sdt.directiveSettings.ministryIdHint}</p>
            </>
          )}

          {createMutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

          <div>
            <Button type="submit" disabled={createMutation.isPending}>
              {t.sdt.directiveSettings.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
