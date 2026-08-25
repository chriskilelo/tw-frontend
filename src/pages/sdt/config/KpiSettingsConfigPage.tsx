import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createKpiSetting, getKpiSettings, updateKpiSetting, type KpiDefinition } from '../../../api/sdt'
import { Table, type TableColumn } from '../../../components/Table'
import { Badge } from '../../../components/Badge'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import en from '../../../i18n/en'

const QUERY_KEY = ['sdt', 'config', 'kpi-settings'] as const

/**
 * FR-SDT-021. System Administrator only (KpiPolicy::manageDefinitions()).
 * Wraps the same defineKpi()/kpi_definitions table the general-purpose
 * /kpi-definitions endpoint uses (Session 32/41 note) — KPI Profile
 * management stays on its own /kpi-profiles screen, not built here.
 */
export default function KpiSettingsConfigPage() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({ queryKey: QUERY_KEY, queryFn: () => getKpiSettings() })
  const definitions = listQuery.data ?? []
  const defaultMinistryId = definitions[0]?.ministry_id ?? ''

  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newCalculationMethod, setNewCalculationMethod] = useState<'auto' | 'manual'>('manual')
  const [newDataSource, setNewDataSource] = useState('')
  const [newReportingFrequency, setNewReportingFrequency] = useState('quarterly')
  const [newMinistryId, setNewMinistryId] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editReportingFrequency, setEditReportingFrequency] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createKpiSetting({
        ministry_id: newMinistryId || defaultMinistryId,
        name: newName,
        description: newDescription || undefined,
        unit: newUnit || undefined,
        calculation_method: newCalculationMethod,
        data_source: newDataSource || undefined,
        reporting_frequency: newReportingFrequency,
      }),
    onSuccess: () => {
      setNewName('')
      setNewDescription('')
      setNewUnit('')
      setNewDataSource('')
      setNewMinistryId('')
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name?: string; reporting_frequency?: string; active?: boolean }) =>
      updateKpiSetting(payload.id, { name: payload.name, reporting_frequency: payload.reporting_frequency, active: payload.active }),
    onSuccess: () => {
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate()
  }

  function startEdit(definition: KpiDefinition) {
    setEditingId(definition.id)
    setEditName(definition.name)
    setEditReportingFrequency(definition.reporting_frequency)
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, name: editName, reporting_frequency: editReportingFrequency })
  }

  function toggleActive(definition: KpiDefinition) {
    updateMutation.mutate({ id: definition.id, active: !definition.active })
  }

  const columns: TableColumn<KpiDefinition>[] = [
    {
      key: 'name',
      header: en.sdt.kpiSettings.columnName,
      render: (row) =>
        editingId === row.id ? <Input value={editName} onChange={(event) => setEditName(event.target.value)} /> : row.name,
    },
    { key: 'calculation_method', header: en.sdt.kpiSettings.columnMethod, render: (row) => row.calculation_method },
    {
      key: 'reporting_frequency',
      header: en.sdt.kpiSettings.columnFrequency,
      render: (row) =>
        editingId === row.id ? (
          <Input value={editReportingFrequency} onChange={(event) => setEditReportingFrequency(event.target.value)} />
        ) : (
          row.reporting_frequency
        ),
    },
    {
      key: 'active',
      header: en.sdt.kpiSettings.columnActive,
      render: (row) => (
        <Badge variant={row.active ? 'success' : 'neutral'} label={row.active ? en.common.active : en.common.inactive} />
      ),
    },
    {
      key: 'actions',
      header: en.sdt.kpiSettings.columnActions,
      render: (row) =>
        editingId === row.id ? (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => saveEdit(row.id)} disabled={updateMutation.isPending}>
              {en.sdt.kpiSettings.saveButton}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              {en.sdt.kpiSettings.cancelButton}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {en.sdt.kpiSettings.editButton}
            </Button>
            <Button variant={row.active ? 'danger' : 'primary'} onClick={() => toggleActive(row)} disabled={updateMutation.isPending}>
              {row.active ? en.sdt.kpiSettings.deactivateButton : en.sdt.kpiSettings.activateButton}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{en.sdt.kpiSettings.title}</h1>

      <div className="mt-6">
        <Table columns={columns} data={definitions} rowKey={(row) => row.id} emptyMessage={en.sdt.kpiSettings.empty} />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{en.sdt.kpiSettings.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label={en.sdt.kpiSettings.nameLabel}
            required
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <Input
            label={en.sdt.kpiSettings.descriptionLabel}
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
          />
          <Input label={en.sdt.kpiSettings.unitLabel} value={newUnit} onChange={(event) => setNewUnit(event.target.value)} />

          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">{en.sdt.kpiSettings.methodLabel}</span>
            <select
              required
              value={newCalculationMethod}
              onChange={(event) => setNewCalculationMethod(event.target.value as 'auto' | 'manual')}
              className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="manual">{en.sdt.kpiSettings.methodManual}</option>
              <option value="auto">{en.sdt.kpiSettings.methodAuto}</option>
            </select>
          </label>

          {newCalculationMethod === 'auto' && (
            <Input
              label={en.sdt.kpiSettings.dataSourceLabel}
              required
              value={newDataSource}
              onChange={(event) => setNewDataSource(event.target.value)}
            />
          )}

          <Input
            label={en.sdt.kpiSettings.frequencyLabel}
            required
            value={newReportingFrequency}
            onChange={(event) => setNewReportingFrequency(event.target.value)}
          />

          {!defaultMinistryId && (
            <Input
              label={en.sdt.kpiSettings.ministryIdLabel}
              required
              value={newMinistryId}
              onChange={(event) => setNewMinistryId(event.target.value)}
            />
          )}
          <p className="text-caption text-text-muted">{en.sdt.kpiSettings.ministryIdHint}</p>

          {createMutation.isError && <p className="text-body-sm text-danger-soft-text">{en.common.genericError}</p>}

          <div>
            <Button type="submit" disabled={createMutation.isPending || (!newMinistryId && !defaultMinistryId)}>
              {en.sdt.kpiSettings.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
