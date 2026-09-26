import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDepartment, listDepartments, type Department } from '../../api/ministries'
import { Table, type TableColumn } from '../../components/Table'
import { Badge } from '../../components/Badge'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { useI18n } from '../../i18n/context'
import { apiErrorMessages } from '../../lib/apiErrors'

/**
 * ADR-006: the department registry. System Administrator only in the navigation (a Ministry
 * Administrator's GET /ministries returns just its own department and POST is refused).
 * Departments are never deleted (BR-003), so there is no remove action.
 */
export default function MinistriesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const listQuery = useQuery({ queryKey: ['admin', 'ministries'], queryFn: listDepartments })

  const createMutation = useMutation({
    mutationFn: () => createDepartment(name),
    onSuccess: () => {
      setName('')
      setErrors([])
      queryClient.invalidateQueries({ queryKey: ['admin', 'ministries'] })
    },
    onError: (error) => setErrors(apiErrorMessages(error, t.common.genericError)),
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate()
  }

  const columns: TableColumn<Department>[] = [
    { key: 'name', header: t.admin.ministries.columnName, render: (row) => row.name },
    {
      key: 'status',
      header: t.admin.ministries.columnStatus,
      render: (row) => <Badge variant={row.active ? 'success' : 'neutral'} label={row.active ? t.common.active : t.common.inactive} />,
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.admin.ministries.title}</h1>

      <div className="mt-6">
        <Table columns={columns} data={listQuery.data ?? []} rowKey={(row) => row.id} />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{t.admin.ministries.addTitle}</h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Input label={t.admin.ministries.nameLabel} required value={name} onChange={(event) => setName(event.target.value)} />
          <p className="text-caption text-text-muted">{t.admin.ministries.hint}</p>
          {errors.length > 0 && (
            <ul className="list-disc pl-5 text-body-sm text-danger-soft-text" role="alert">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <div>
            <Button type="submit" disabled={createMutation.isPending}>
              {t.admin.ministries.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
