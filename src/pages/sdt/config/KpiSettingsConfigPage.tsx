import { useState, type FormEvent, type ReactNode } from 'react'
import { BoltIcon, PencilIcon } from '@heroicons/react/20/solid'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createKpiSetting, getKpiSettings, updateKpiSetting, type KpiDefinition, type KpiDefinitionUpdateRequest } from '../../../api/sdt'
import { Table, type TableColumn } from '../../../components/Table'
import { Badge } from '../../../components/Badge'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { Pagination } from '../../../components/Pagination'
import { useClientPagination } from '../../../hooks/useClientPagination'
import { useAuth, isMinistryAdministrator } from '../../../hooks/useAuth'
import { useI18n } from '../../../i18n/context'
import { apiErrorMessages } from '../../../lib/apiErrors'
import { KpiProfilesPanel } from './KpiProfilesPanel'

const QUERY_KEY = ['sdt', 'config', 'kpi-settings'] as const

/**
 * FR-SDT-021. System Administrator and the department's Ministry Administrator
 * (KpiPolicy::manageDefinitions()). Wraps the same defineKpi()/kpi_definitions table the
 * general-purpose /kpi-definitions endpoint uses; KPI Profiles (FR-KPI-002) are managed in
 * the panel below, over the /kpi-profiles endpoints. An auto-calculated KPI picks its data
 * source from the counts the engine can compute live (App\Services\KpiDataSources); any
 * other source is described in words and its values are recorded by hand.
 */
const LIVE_SOURCES = ['alerts.count_submitted', 'inquiries.count_closed', 'inquiries.count_disputes_closed', 'reports.count_submitted', 'reports.count_submitted_on_time']

type Method = 'auto' | 'manual'

/** The data source to send for an auto KPI: a live key, or the words describing another source. */
function chosenDataSource(choice: string, other: string): string | undefined {
  return choice === 'other' ? other.trim() || undefined : choice
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function KpiSettingsConfigPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const listQuery = useQuery({ queryKey: QUERY_KEY, queryFn: () => getKpiSettings() })
  const definitions = listQuery.data ?? []
  const { user, role } = useAuth()
  // ADR-006: a Ministry Administrator always writes to its own department (the backend pins
  // it too), so it never needs the free-text ministry field below.
  const defaultMinistryId = (isMinistryAdministrator(role?.name) ? user?.ministry_id : null) ?? definitions[0]?.ministry_id ?? ''
  const definitionsPage = useClientPagination(definitions)

  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newCalculationMethod, setNewCalculationMethod] = useState<'auto' | 'manual'>('manual')
  const [newDataSource, setNewDataSource] = useState(LIVE_SOURCES[0])
  const [otherDataSource, setOtherDataSource] = useState('')
  const [newReportingFrequency, setNewReportingFrequency] = useState('quarterly')
  const [newMinistryId, setNewMinistryId] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editReportingFrequency, setEditReportingFrequency] = useState('')
  const [editMethod, setEditMethod] = useState<Method>('manual')
  const [editDataSource, setEditDataSource] = useState(LIVE_SOURCES[0])
  const [editOtherDataSource, setEditOtherDataSource] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createKpiSetting({
        ministry_id: newMinistryId || defaultMinistryId,
        name: newName,
        description: newDescription || undefined,
        unit: newUnit || undefined,
        calculation_method: newCalculationMethod,
        data_source: newCalculationMethod === 'auto' ? chosenDataSource(newDataSource, otherDataSource) : undefined,
        reporting_frequency: newReportingFrequency,
      }),
    onSuccess: () => {
      setNewName('')
      setNewDescription('')
      setNewUnit('')
      setNewDataSource(LIVE_SOURCES[0])
      setOtherDataSource('')
      setNewMinistryId('')
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...changes }: { id: string } & KpiDefinitionUpdateRequest) => updateKpiSetting(id, changes),
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
    const source = definition.data_source ?? ''
    updateMutation.reset()
    setEditingId(definition.id)
    setEditName(definition.name)
    setEditReportingFrequency(definition.reporting_frequency)
    setEditMethod(definition.calculation_method)
    setEditDataSource(LIVE_SOURCES.includes(source) ? source : source ? 'other' : LIVE_SOURCES[0])
    setEditOtherDataSource(LIVE_SOURCES.includes(source) ? '' : source)
  }

  // ISS-026: an edit can change how a KPI is measured as well as its name and frequency.
  function saveEdit(id: string) {
    updateMutation.mutate({
      id,
      name: editName,
      reporting_frequency: editReportingFrequency,
      calculation_method: editMethod,
      ...(editMethod === 'auto' ? { data_source: chosenDataSource(editDataSource, editOtherDataSource) } : {}),
    })
  }

  const methodName = (method: Method) => (method === 'auto' ? t.sdt.kpiSettings.methodAuto : t.sdt.kpiSettings.methodManual)

  function toggleActive(definition: KpiDefinition) {
    updateMutation.mutate({ id: definition.id, active: !definition.active })
  }

  const columns: TableColumn<KpiDefinition>[] = [
    {
      key: 'name',
      header: t.sdt.kpiSettings.columnName,
      render: (row) =>
        editingId === row.id ? <Input label={t.sdt.kpiSettings.nameLabel} value={editName} onChange={(event) => setEditName(event.target.value)} className="w-44" /> : row.name,
    },
    {
      key: 'calculation_method',
      header: t.sdt.kpiSettings.columnMethodAndSource,
      render: (row) =>
        editingId === row.id ? (
          <div className="flex w-56 flex-col gap-2">
            <MethodSelect value={editMethod} onChange={setEditMethod} />
            {editMethod === 'auto' && (
              <DataSourceFields choice={editDataSource} onChoice={setEditDataSource} other={editOtherDataSource} onOther={setEditOtherDataSource} />
            )}
          </div>
        ) : (
          <DataSourceSummary definition={row} methodName={methodName(row.calculation_method)} />
        ),
    },
    {
      key: 'reporting_frequency',
      header: t.sdt.kpiSettings.columnFrequency,
      render: (row) =>
        editingId === row.id ? (
          <Input label={t.sdt.kpiSettings.frequencyLabel} value={editReportingFrequency} onChange={(event) => setEditReportingFrequency(event.target.value)} className="w-28" />
        ) : (
          (t.sdt.kpiSettings.frequencyNames[row.reporting_frequency] ?? capitalised(row.reporting_frequency.replace(/_/g, ' ')))
        ),
    },
    {
      key: 'active',
      header: t.sdt.kpiSettings.columnActive,
      render: (row) => (
        <Badge variant={row.active ? 'success' : 'neutral'} label={row.active ? t.common.active : t.common.inactive} />
      ),
    },
    {
      key: 'actions',
      header: t.sdt.kpiSettings.columnActions,
      render: (row) =>
        editingId === row.id ? (
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => saveEdit(row.id)} disabled={updateMutation.isPending}>
              {t.sdt.kpiSettings.saveButton}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              {t.sdt.kpiSettings.cancelButton}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {t.sdt.kpiSettings.editButton}
            </Button>
            <Button variant={row.active ? 'danger' : 'primary'} onClick={() => toggleActive(row)} disabled={updateMutation.isPending}>
              {row.active ? t.sdt.kpiSettings.deactivateButton : t.sdt.kpiSettings.activateButton}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.sdt.kpiSettings.title}</h1>

      <div className="mt-6">
        <Table
          columns={columns}
          data={definitionsPage.pageItems}
          rowKey={(row) => row.id}
          emptyMessage={t.sdt.kpiSettings.empty}
        />
        {updateMutation.isError && <ErrorList messages={apiErrorMessages(updateMutation.error, t.common.genericError)} />}
        <Pagination
          meta={definitionsPage.meta}
          onPageChange={definitionsPage.setPage}
          onPerPageChange={definitionsPage.setPerPage}
          className="mt-4"
        />
      </div>

      <div className="mt-8 max-w-lg rounded-lg border border-border p-4">
        <h2 className="text-h3 text-primary">{t.sdt.kpiSettings.addTitle}</h2>
        <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label={t.sdt.kpiSettings.nameLabel}
            required
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <Input
            label={t.sdt.kpiSettings.descriptionLabel}
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
          />
          <Input label={t.sdt.kpiSettings.unitLabel} value={newUnit} onChange={(event) => setNewUnit(event.target.value)} />

          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">{t.sdt.kpiSettings.methodLabel}</span>
            <select
              required
              value={newCalculationMethod}
              onChange={(event) => setNewCalculationMethod(event.target.value as 'auto' | 'manual')}
              className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="manual">{t.sdt.kpiSettings.methodManual}</option>
              <option value="auto">{t.sdt.kpiSettings.methodAuto}</option>
            </select>
          </label>

          {newCalculationMethod === 'auto' && (
            <DataSourceFields choice={newDataSource} onChoice={setNewDataSource} other={otherDataSource} onOther={setOtherDataSource} withHint />
          )}

          <Input
            label={t.sdt.kpiSettings.frequencyLabel}
            required
            value={newReportingFrequency}
            onChange={(event) => setNewReportingFrequency(event.target.value)}
          />

          {!defaultMinistryId && (
            <Input
              label={t.sdt.kpiSettings.ministryIdLabel}
              required
              value={newMinistryId}
              onChange={(event) => setNewMinistryId(event.target.value)}
            />
          )}
          <p className="text-caption text-text-muted">{t.sdt.kpiSettings.ministryIdHint}</p>

          {createMutation.isError && <ErrorList messages={apiErrorMessages(createMutation.error, t.common.genericError)} />}

          <div>
            <Button type="submit" disabled={createMutation.isPending || (!newMinistryId && !defaultMinistryId)}>
              {t.sdt.kpiSettings.addButton}
            </Button>
          </div>
        </form>
      </div>

      <KpiProfilesPanel definitions={definitions} ministryId={defaultMinistryId} />
    </div>
  )
}

const SELECT_CLASS = 'w-full min-w-0 rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent'

function MethodSelect({ value, onChange }: { value: Method; onChange: (method: Method) => void }) {
  const { t } = useI18n()
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption font-semibold text-text-secondary">{t.sdt.kpiSettings.methodLabel}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as Method)} className={SELECT_CLASS}>
        <option value="manual">{t.sdt.kpiSettings.methodManual}</option>
        <option value="auto">{t.sdt.kpiSettings.methodAuto}</option>
      </select>
    </label>
  )
}

/** The live counts the engine can calculate, or "something else" described in words (recorded by hand). */
function DataSourceFields({
  choice,
  onChoice,
  other,
  onOther,
  withHint = false,
}: {
  choice: string
  onChoice: (choice: string) => void
  other: string
  onOther: (text: string) => void
  withHint?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-body-sm font-semibold text-text-secondary">{t.sdt.kpiSettings.dataSourceLabel}</span>
        <select required value={choice} onChange={(event) => onChoice(event.target.value)} className={SELECT_CLASS}>
          {LIVE_SOURCES.map((source) => (
            <option key={source} value={source}>
              {capitalised(t.kpi.dataSource[source])}
            </option>
          ))}
          <option value="other">{t.sdt.kpiSettings.dataSourceOther}</option>
        </select>
      </label>
      {choice === 'other' ? (
        <Input label={t.sdt.kpiSettings.dataSourceOtherLabel} required value={other} onChange={(event) => onOther(event.target.value)} />
      ) : (
        withHint && <p className="text-caption text-text-muted">{t.sdt.kpiSettings.dataSourceLiveHint}</p>
      )}
    </div>
  )
}

/** ISS-026: how a KPI is measured: its method, what it counts, and whether the engine counts it live. */
function DataSourceSummary({ definition, methodName }: { definition: KpiDefinition; methodName: string }) {
  const { t } = useI18n()
  const isLive = definition.source === 'live'
  const description: ReactNode = definition.data_source ? (isLive ? capitalised(t.kpi.dataSource[definition.data_source] ?? definition.data_source) : definition.data_source) : null

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-body-sm text-text-primary">
        <span className="font-semibold">{methodName}</span>
        {description && <> · {description}</>}
      </span>
      <SourceChip isLive={isLive} />
    </div>
  )
}

function SourceChip({ isLive }: { isLive: boolean }) {
  const { t } = useI18n()
  const Icon = isLive ? BoltIcon : PencilIcon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${
        isLive ? 'bg-info-soft text-info-soft-text' : 'bg-section-bg text-text-secondary'
      }`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {isLive ? t.sdt.kpiSettings.sourceLive : t.sdt.kpiSettings.sourceRecorded}
    </span>
  )
}

function ErrorList({ messages }: { messages: string[] }) {
  return (
    <ul role="alert" className="mt-2 list-disc pl-5 text-body-sm text-danger-soft-text">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  )
}
