import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  LockClosedIcon,
  PresentationChartLineIcon,
  ScaleIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from '@heroicons/react/20/solid'
import {
  getKpiTargetHistory,
  getKpiTargetPlan,
  saveKpiTargets,
  type KpiMeta,
  type KpiTargetCell,
  type KpiTargetEntry,
  type KpiTargetPlan,
  type KpiTargetPlanMission,
  type KpiTargetPlanProfile,
} from '../../api/kpi'
import { Modal } from '../../components/Modal'
import { Select } from '../../components/Select'
import { FormSubmitBar } from '../../components/FormLayout'
import { PanelEmpty } from '../../components/dashboard/DashboardCard'
import { SegmentedControl } from '../../components/dashboard/layout'
import { ProgressRing, StatTile } from '../../components/dashboard/visuals'
import { CHART_COLORS } from '../../components/dashboard/chartTheme'
import { useI18n } from '../../i18n/context'
import { retryUnlessClientError } from '../../lib/apiErrors'
import { formatDateTime, localeFor } from '../../lib/formatters'
import { periodRange, periodTick } from '../../lib/dashboardFormat'
import { KpiStatusIcon } from './KpiStatusBadge'
import { formatKpiValue, formatRatio, STATUS_TEXT } from './kpiPresentation'

type EditorMode = 'missions' | 'profiles'

/** A draft is keyed by scope and id: "m:{missionId}:{kpiId}" or "p:{profileId}:{kpiId}". */
type Drafts = Record<string, string>

function draftKey(scope: 'm' | 'p', scopeId: string, kpiId: string): string {
  return `${scope}:${scopeId}:${kpiId}`
}

/** Parses a typed target: a positive number with at most two decimals, else an error key. */
function parseTarget(raw: string): { value: number | null; error: 'required' | 'positive' | 'number' | null } {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return { value: null, error: 'required' }
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    return { value: null, error: 'number' }
  }
  if (value <= 0) {
    return { value: null, error: 'positive' }
  }
  return { value: Math.round(value * 100) / 100, error: null }
}

interface HistoryTarget {
  kpi: KpiMeta
  missionId?: string
  profileId?: string
  title: string
}

/**
 * FR-KPI-003, 004, 005; BR-019. Ministry HQ Director, Ministry PS and Acting PS set each
 * mission's target for a half-yearly performance cycle (KpiPolicy::setTarget()), and the
 * default target of each KPI Profile, which a mission target overrides (FR-KPI-003). Every save
 * is a new version — earlier ones stay retrievable in each target's history (FR-KPI-004) — and
 * a cycle that has ended is read-only. The planner edits one KPI at a time across every
 * mission, with last cycle's target and result alongside, and saves all changes in one batch.
 */
export default function SetKpiTargetsPage() {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.setTargets
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const cycleParam = params.get('cycle') || undefined
  const mode: EditorMode = params.get('mode') === 'profiles' ? 'profiles' : 'missions'
  const [drafts, setDrafts] = useState<Drafts>({})
  const [note, setNote] = useState('')
  const [fillValue, setFillValue] = useState('')
  const [saved, setSaved] = useState<{ saved: number; unchanged: number } | null>(null)
  const [pendingCycle, setPendingCycle] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryTarget | null>(null)

  const planQuery = useQuery({
    queryKey: ['kpi', 'target-plan', cycleParam ?? 'current'],
    queryFn: () => getKpiTargetPlan(cycleParam),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })

  const plan = planQuery.data
  const kpiParam = params.get('kpi')
  const focusKpi = plan?.kpis.find((kpi) => kpi.id === kpiParam) ?? plan?.kpis[0]
  const dirtyCount = Object.keys(drafts).length

  useEffect(() => {
    if (dirtyCount === 0) {
      return
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyCount])

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof saveKpiTargets>[0]) => saveKpiTargets(payload),
    onSuccess: (result) => {
      queryClient.setQueryData(['kpi', 'target-plan', cycleParam ?? 'current'], result.plan)
      void queryClient.invalidateQueries({ queryKey: ['kpi'], predicate: (query) => query.queryKey[1] !== 'target-plan' })
      setDrafts({})
      setNote('')
      setSaved({ saved: result.saved, unchanged: result.unchanged })
    },
  })

  function updateParams(changes: Record<string, string | null>) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace: true },
    )
  }

  function chooseCycle(label: string) {
    if (label === plan?.cycle.label) {
      return
    }
    if (dirtyCount > 0) {
      setPendingCycle(label)
      return
    }
    switchCycle(label)
  }

  function switchCycle(label: string) {
    setDrafts({})
    setSaved(null)
    setPendingCycle(null)
    updateParams({ cycle: label })
  }

  function setDraft(key: string, raw: string, current: number | null) {
    setSaved(null)
    setDrafts((previous) => {
      const next = { ...previous }
      const parsed = parseTarget(raw)
      if (raw.trim() === '' && current === null) {
        delete next[key]
      } else if (parsed.value !== null && current !== null && parsed.value === current) {
        delete next[key]
      } else {
        next[key] = raw
      }
      return next
    })
  }

  const entries = useMemo(() => {
    const valid: KpiTargetEntry[] = []
    let invalid = 0
    Object.entries(drafts).forEach(([key, raw]) => {
      const [scope, scopeId, kpiId] = key.split(':')
      const parsed = parseTarget(raw)
      if (parsed.value === null) {
        invalid++
        return
      }
      valid.push(scope === 'm' ? { kpi_definition_id: kpiId, mission_id: scopeId, target_value: parsed.value } : { kpi_definition_id: kpiId, kpi_profile_id: scopeId, target_value: parsed.value })
    })
    return { valid, invalid }
  }, [drafts])

  const error = planQuery.error
  if (isAxiosError(error) && error.response?.status === 403) {
    return (
      <PageShell>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <PanelEmpty icon={<LockClosedIcon />} title={copy.notAvailableTitle} body={copy.notAvailableBody} />
        </div>
      </PageShell>
    )
  }

  if (planQuery.isError && !plan) {
    return (
      <PageShell>
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-soft-text">
            <ExclamationTriangleIcon className="size-5" />
          </span>
          <p className="max-w-md text-body text-text-secondary">{copy.loadError}</p>
          <button type="button" onClick={() => void planQuery.refetch()} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
            <ArrowPathIcon aria-hidden="true" className="size-4" />
            {copy.retry}
          </button>
        </div>
      </PageShell>
    )
  }

  if (!plan) {
    return (
      <PageShell>
        <div role="status" aria-live="polite" className="space-y-5">
          <span className="sr-only">{copy.loading}</span>
          <div aria-hidden="true" className="h-20 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
          <div aria-hidden="true" className="h-36 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
          <div aria-hidden="true" className="h-96 rounded-xl border border-border bg-white motion-safe:animate-pulse" />
        </div>
      </PageShell>
    )
  }

  const editable = plan.cycle.editable && plan.can.set_targets
  const saveError = isAxiosError(saveMutation.error) ? ((saveMutation.error.response?.data as { errors?: string[] } | undefined)?.errors?.[0] ?? copy.saveFailed) : saveMutation.isError ? copy.saveFailed : null

  function copyLastCycle() {
    if (!plan || !focusKpi) {
      return
    }
    setSaved(null)
    setDrafts((previous) => {
      const next = { ...previous }
      plan.missions.forEach((mission) => {
        const cell = mission.targets[focusKpi.id]
        const key = draftKey('m', mission.id, focusKpi.id)
        if (cell?.applicable && cell.override === null && cell.previous.target !== null && next[key] === undefined) {
          next[key] = String(cell.previous.target)
        }
      })
      return next
    })
  }

  function fillEmpty() {
    if (!plan || !focusKpi || parseTarget(fillValue).value === null) {
      return
    }
    setSaved(null)
    setDrafts((previous) => {
      const next = { ...previous }
      plan.missions.forEach((mission) => {
        const cell = mission.targets[focusKpi.id]
        const key = draftKey('m', mission.id, focusKpi.id)
        if (cell?.applicable && cell.value === null && next[key] === undefined) {
          next[key] = fillValue.trim()
        }
      })
      return next
    })
  }

  return (
    <PageShell
      action={
        <div className="flex flex-wrap gap-2">
          <Link to={`/kpi/dashboard?period=${encodeURIComponent(plan.cycle.label)}`} className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
            <PresentationChartLineIcon aria-hidden="true" className="size-4" />
            {copy.actions.dashboard}
          </Link>
          <Link to={`/kpi/comparison?period=${encodeURIComponent(plan.cycle.label)}`} className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
            <ScaleIcon aria-hidden="true" className="size-4" />
            {copy.actions.compare}
          </Link>
        </div>
      }
    >
      <section aria-label={copy.cycleLabel} className="space-y-2 rounded-xl border border-border bg-white p-4 shadow-sm">
        <span className="text-body-sm font-semibold text-text-secondary">{copy.cycleLabel}</span>
        <div>
          <SegmentedControl<string>
            label={copy.cycleLabel}
            value={plan.cycle.label}
            onChange={chooseCycle}
            options={plan.cycles.map((cycle) => ({
              value: cycle.label,
              label: cycle.label,
              note: `${periodTick(cycle, locale)} · ${cycle.reason === 'ended' ? copy.cycleNote.ended : cycle.phase === 'in_progress' ? copy.cycleNote.current : cycle.editable ? copy.cycleNote.upcoming : copy.cycleNote.later}`,
            }))}
          />
        </div>
        <p className="text-caption text-text-secondary">
          {copy.cycleRange(periodRange(plan.cycle, locale))} {copy.previousNote(plan.previous_cycle.label)}
        </p>
      </section>

      {!plan.cycle.editable && (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-section-bg px-4 py-3 text-body-sm text-text-secondary" data-testid="kpi-cycle-locked">
          <LockClosedIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
          {plan.cycle.reason === 'ended' ? copy.locked.ended(plan.cycle.label) : copy.locked.beyondHorizon(plan.cycle.label)}
        </p>
      )}

      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-body-sm font-medium text-success-soft-text" data-testid="kpi-targets-saved">
          <CheckCircleIcon aria-hidden="true" className="size-4" />
          {copy.savedMessage(saved.saved, saved.unchanged)}
        </p>
      )}

      {plan.kpis.length === 0 || plan.missions.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <PanelEmpty icon={<FlagIcon />} title={copy.emptyTitle} body={plan.kpis.length === 0 ? copy.emptyKpis : copy.emptyMissions} />
        </div>
      ) : (
        <>
          <ProgressSummary plan={plan} />

          <section aria-labelledby="kpi-target-editor" className="rounded-xl border border-border bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 id="kpi-target-editor" className="text-h3 text-primary">
                  {copy.editor.title}
                </h2>
                <p className="text-body-sm text-text-secondary">{mode === 'missions' ? copy.editor.subtitleMissions : copy.editor.subtitleProfiles}</p>
              </div>
              <SegmentedControl<EditorMode>
                label={copy.editor.modeLabel}
                value={mode}
                onChange={(value) => updateParams({ mode: value === 'missions' ? null : value })}
                options={[
                  { value: 'missions', label: copy.editor.modes.missions },
                  { value: 'profiles', label: copy.editor.modes.profiles, note: String(plan.profiles.length) },
                ]}
              />
            </div>

            <div className="grid lg:grid-cols-12">
              <KpiRail plan={plan} focusId={focusKpi?.id} drafts={drafts} mode={mode} onSelect={(id) => updateParams({ kpi: id })} />

              <div className="min-w-0 p-4 lg:col-span-8 lg:border-l lg:border-border">
                {focusKpi && (
                  <>
                    <div className="lg:hidden">
                      <Select label={copy.editor.kpiLabel} value={focusKpi.id} onChange={(event) => updateParams({ kpi: event.target.value })} options={plan.kpis.map((kpi) => ({ value: kpi.id, label: kpi.name }))} className="w-full" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-3 lg:mt-0">
                      <div className="min-w-0">
                        <h3 className="text-h4 text-primary">{focusKpi.name}</h3>
                        <p className="text-caption text-text-secondary">
                          {focusKpi.source === 'live' ? copy.editor.liveKpi : copy.editor.recordedKpi}
                          {focusKpi.unit && ` · ${focusKpi.unit}`}
                        </p>
                        {focusKpi.description && <p className="mt-1 text-body-sm text-text-secondary">{focusKpi.description}</p>}
                      </div>
                    </div>

                    {mode === 'missions' ? (
                      <>
                        {editable && (
                          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-page-bg p-3 ring-1 ring-border">
                            <label className="flex flex-col gap-1 text-body-sm font-semibold text-text-secondary">
                              {copy.editor.fillLabel}
                              <input
                                type="number"
                                min="0"
                                step="any"
                                inputMode="decimal"
                                value={fillValue}
                                onChange={(event) => setFillValue(event.target.value)}
                                className="h-9 w-28 rounded border border-border px-2 font-mono text-body focus:outline-none focus:ring-2 focus:ring-accent"
                              />
                            </label>
                            <button type="button" onClick={fillEmpty} disabled={parseTarget(fillValue).value === null} className="inline-flex h-9 items-center gap-1.5 rounded border border-border bg-white px-3 text-body-sm font-semibold text-primary hover:bg-section-bg disabled:opacity-50">
                              <Squares2X2Icon aria-hidden="true" className="size-4" />
                              {copy.editor.fillEmpty}
                            </button>
                            <button type="button" onClick={copyLastCycle} className="inline-flex h-9 items-center gap-1.5 rounded border border-border bg-white px-3 text-body-sm font-semibold text-primary hover:bg-section-bg">
                              <DocumentDuplicateIcon aria-hidden="true" className="size-4" />
                              {copy.editor.copyLast(plan.previous_cycle.label)}
                            </button>
                          </div>
                        )}
                        <MissionTargetTable
                          plan={plan}
                          kpi={focusKpi}
                          drafts={drafts}
                          editable={editable}
                          onChange={setDraft}
                          onHistory={(mission) => setHistory({ kpi: focusKpi, missionId: mission.id, title: copy.history.titleMission(focusKpi.name, mission.name) })}
                        />
                      </>
                    ) : (
                      <ProfileTargetTable
                        plan={plan}
                        kpi={focusKpi}
                        drafts={drafts}
                        editable={editable}
                        onChange={setDraft}
                        onHistory={(profile) => setHistory({ kpi: focusKpi, profileId: profile.id, title: copy.history.titleProfile(focusKpi.name, profile.name) })}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {editable && dirtyCount > 0 && (
            <FormSubmitBar
              isReady={entries.invalid === 0}
              statusLabel={entries.invalid === 0 ? copy.bar.ready(dirtyCount) : copy.bar.invalid(entries.invalid)}
              statusNote={copy.bar.note(plan.cycle.label)}
            >
              <label className="sr-only" htmlFor="kpi-target-note">
                {copy.bar.noteLabel}
              </label>
              <input
                id="kpi-target-note"
                type="text"
                maxLength={500}
                placeholder={copy.bar.notePlaceholder}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded border border-border px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent sm:w-72"
              />
              <button type="button" onClick={() => setDrafts({})} className="inline-flex h-10 items-center gap-1.5 rounded border border-border bg-white px-3 text-button text-primary hover:bg-section-bg">
                <ArrowUturnLeftIcon aria-hidden="true" className="size-4" />
                {copy.bar.discard}
              </button>
              <button
                type="button"
                disabled={entries.invalid > 0 || entries.valid.length === 0 || saveMutation.isPending}
                onClick={() => saveMutation.mutate({ performance_cycle_label: plan.cycle.label, note: note.trim() || undefined, targets: entries.valid })}
                className="inline-flex h-10 items-center gap-1.5 rounded bg-accent px-4 text-button text-accent-text shadow-sm hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="kpi-targets-save"
              >
                <FlagIcon aria-hidden="true" className="size-4" />
                {saveMutation.isPending ? copy.bar.saving : copy.bar.save}
              </button>
            </FormSubmitBar>
          )}
          {saveError && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger-soft-text">
              {saveError}
            </p>
          )}
        </>
      )}

      <Modal open={pendingCycle !== null} onClose={() => setPendingCycle(null)} title={copy.discardTitle}>
        <p className="text-body-sm text-text-secondary">{copy.discardBody(dirtyCount)}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setPendingCycle(null)} className="inline-flex h-10 items-center rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
            {copy.keepEditing}
          </button>
          <button type="button" onClick={() => pendingCycle && switchCycle(pendingCycle)} className="inline-flex h-10 items-center rounded bg-danger px-4 text-button text-white hover:opacity-90">
            {copy.discardAndSwitch}
          </button>
        </div>
      </Modal>

      <Modal open={history !== null} onClose={() => setHistory(null)} title={history?.title} size="xl">
        {history && <TargetHistory target={history} locale={locale} />}
        <div className="mt-5 flex justify-end border-t border-border pt-4">
          <button type="button" onClick={() => setHistory(null)} className="inline-flex h-10 items-center rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
            {copy.history.close}
          </button>
        </div>
      </Modal>
    </PageShell>
  )
}

function PageShell({ action, children }: { action?: ReactNode; children: ReactNode }) {
  const { t } = useI18n()
  const copy = t.kpi.setTargets
  return (
    <div className="mx-auto w-full max-w-310 space-y-5 px-4 py-6 sm:px-7" data-testid="set-kpi-targets-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-primary">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-body text-text-secondary">{copy.subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

function ProgressSummary({ plan }: { plan: KpiTargetPlan }) {
  const { t } = useI18n()
  const copy = t.kpi.setTargets.summary
  const { required, set, missing, overrides, from_profile: fromProfile, missions_complete: missionsComplete } = plan.summary

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <section className="flex items-center gap-5 rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-5" aria-label={copy.setOf(set, required)}>
        <ProgressRing value={set} total={Math.max(required, 1)} label={copy.ringLabel(set, required)} caption={copy.ringCaption} color={missing === 0 ? CHART_COLORS.onTrack : CHART_COLORS.series1} />
        <div className="min-w-0 space-y-1.5">
          <p className="text-h4 text-primary">{copy.setOf(set, required)}</p>
          <p className="text-body-sm text-text-secondary">{missing === 0 ? copy.complete : copy.missing(missing)}</p>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7">
        <StatTile label={copy.missionsComplete} value={`${missionsComplete}/${plan.missions.length}`} icon={<UserGroupIcon />} tone="success" />
        <StatTile label={copy.overrides} value={overrides} icon={<FlagIcon />} tone="info" footnote={copy.overridesNote} />
        <StatTile label={copy.fromProfile} value={fromProfile} icon={<ClipboardDocumentListIcon />} tone="directive" footnote={copy.fromProfileNote} />
      </div>
    </div>
  )
}

function KpiRail({ plan, focusId, drafts, mode, onSelect }: { plan: KpiTargetPlan; focusId?: string; drafts: Drafts; mode: EditorMode; onSelect: (id: string) => void }) {
  const { t } = useI18n()
  const copy = t.kpi.setTargets.editor

  return (
    <nav aria-label={copy.kpiLabel} className="hidden border-border p-3 lg:col-span-4 lg:block">
      <ul className="space-y-1">
        {plan.kpis.map((kpi) => {
          const applicable = plan.missions.filter((mission) => mission.targets[kpi.id]?.applicable)
          const set = applicable.filter((mission) => mission.targets[kpi.id]?.value !== null).length
          const edited = Object.keys(drafts).some((key) => key.endsWith(`:${kpi.id}`))
          const profiles = plan.profiles.filter((profile) => profile.kpi_ids.includes(kpi.id)).length
          const active = kpi.id === focusId
          return (
            <li key={kpi.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(kpi.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${active ? 'bg-primary text-white shadow-sm' : 'text-text-primary hover:bg-section-bg'}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-body-sm font-semibold leading-snug">{kpi.name}</span>
                  {edited && (
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${active ? 'bg-accent' : 'bg-accent'}`}>
                      <span className="sr-only">{copy.unsaved}</span>
                    </span>
                  )}
                </span>
                <span className={`mt-1 flex items-center gap-2 text-caption ${active ? 'text-white/80' : 'text-text-secondary'}`}>
                  {mode === 'missions' ? copy.railSet(set, applicable.length) : copy.railProfiles(profiles)}
                  {mode === 'missions' && (
                    <span aria-hidden="true" className={`h-1.5 flex-1 overflow-hidden rounded-full ${active ? 'bg-white/20' : 'bg-section-bg'}`}>
                      <span className={`block h-full rounded-full ${set === applicable.length ? 'bg-success' : 'bg-accent'}`} style={{ width: `${applicable.length ? (set / applicable.length) * 100 : 0}%` }} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function TargetInput({
  id,
  label,
  draft,
  current,
  editable,
  onChange,
}: {
  id: string
  label: string
  draft: string | undefined
  current: number | null
  editable: boolean
  onChange: (raw: string) => void
}) {
  const { t } = useI18n()
  const copy = t.kpi.setTargets.editor
  const raw = draft ?? (current === null ? '' : String(current))
  const parsed = draft !== undefined ? parseTarget(draft) : null
  const errorId = `${id}-error`
  const error = parsed?.error ? copy.errors[parsed.error] : null

  if (!editable) {
    return <span className="font-mono text-body font-semibold text-text-primary">{current === null ? '—' : current}</span>
  }

  return (
    <span className="flex flex-col gap-1">
      <input
        id={id}
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={raw}
        onChange={(event) => onChange(event.target.value)}
        className={`h-9 w-28 rounded border px-2 text-right font-mono text-body focus:outline-none focus:ring-2 focus:ring-accent ${
          error ? 'border-danger bg-danger-soft/40' : draft !== undefined ? 'border-accent bg-accent-soft/40' : 'border-border'
        }`}
      />
      {error && (
        <span id={errorId} className="text-caption font-semibold text-danger-soft-text">
          {error}
        </span>
      )}
    </span>
  )
}

function ChangeHint({ draft, current, previous }: { draft: string | undefined; current: number | null; previous: number | null }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.setTargets.editor
  const value = draft !== undefined ? parseTarget(draft).value : current
  if (value === null || previous === null || previous <= 0) {
    return null
  }
  const change = (value - previous) / previous
  if (Math.abs(change) < 0.005) {
    return <span className="text-caption text-text-muted">{copy.sameAsLast}</span>
  }
  return (
    <span className={`text-caption ${Math.abs(change) >= 0.5 ? 'font-semibold text-atrisk-soft-text' : 'text-text-secondary'}`}>
      {copy.vsLast(`${change > 0 ? '+' : '−'}${formatRatio(Math.abs(change))}`, formatKpiValue(previous, locale))}
    </span>
  )
}

function SourceTag({ cell, draft }: { cell: KpiTargetCell; draft: string | undefined }) {
  const { t } = useI18n()
  const copy = t.kpi.setTargets.editor.source
  if (draft !== undefined) {
    return <span className="whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent-soft-text">{copy.edited}</span>
  }
  if (cell.source === 'mission') {
    return <span className="whitespace-nowrap rounded-full bg-info-soft px-2 py-0.5 text-caption font-semibold text-info-soft-text">{copy.mission}</span>
  }
  if (cell.source === 'profile') {
    return <span className="whitespace-nowrap rounded-full bg-directive-soft px-2 py-0.5 text-caption font-semibold text-directive-soft-text">{copy.profile}</span>
  }
  return <span className="whitespace-nowrap rounded-full bg-section-bg px-2 py-0.5 text-caption font-semibold text-text-secondary">{copy.notSet}</span>
}

function MissionTargetTable({
  plan,
  kpi,
  drafts,
  editable,
  onChange,
  onHistory,
}: {
  plan: KpiTargetPlan
  kpi: KpiMeta
  drafts: Drafts
  editable: boolean
  onChange: (key: string, raw: string, current: number | null) => void
  onHistory: (mission: KpiTargetPlanMission) => void
}) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const copy = t.kpi.setTargets.editor

  return (
    <div className="relative mt-4 overflow-x-auto rounded-lg border border-border" data-testid="kpi-target-table">
      <table className="min-w-full text-left text-body-sm">
        <caption className="sr-only">{copy.tableCaption(kpi.name, plan.cycle.label)}</caption>
        <thead className="bg-section-bg text-caption font-semibold uppercase tracking-wide text-text-secondary">
          <tr>
            <th scope="col" className="px-3 py-2">
              {copy.columns.mission}
            </th>
            <th scope="col" className="hidden px-3 py-2 md:table-cell">
              {copy.columns.lastCycle(plan.previous_cycle.label)}
            </th>
            <th scope="col" className="px-3 py-2">
              {copy.columns.target(plan.cycle.label)}
            </th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">{copy.columns.history}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {plan.missions.map((mission) => {
            const cell = mission.targets[kpi.id]
            if (!cell) {
              return null
            }
            const key = draftKey('m', mission.id, kpi.id)
            const current = cell.override?.value ?? null
            const draft = drafts[key]
            if (!cell.applicable) {
              return (
                <tr key={mission.id} className="border-t border-border bg-page-bg">
                  <th scope="row" className="px-3 py-2.5 font-medium text-text-secondary">
                    {mission.name}
                  </th>
                  <td colSpan={3} className="px-3 py-2.5 text-caption text-text-muted">
                    {copy.notTracked(mission.profiles.map((profile) => profile.name).join(', '))}
                  </td>
                </tr>
              )
            }
            return (
              <tr key={mission.id} className="border-t border-border align-top" data-testid={`kpi-target-row-${mission.id}`}>
                <th scope="row" className="px-3 py-2.5">
                  <span className="block font-semibold text-text-primary">{mission.name}</span>
                  <span className="block text-caption font-normal text-text-secondary">{mission.attache?.full_name ?? copy.vacant}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <SourceTag cell={cell} draft={draft} />
                    {cell.profile_default && (
                      <span className="text-caption font-normal text-text-secondary">{copy.profileDefault(cell.profile_default.profile.name, formatKpiValue(cell.profile_default.value, locale))}</span>
                    )}
                  </span>
                </th>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  <span className="flex items-center gap-1.5">
                    <KpiStatusIcon status={cell.previous.status} className={`size-4 ${STATUS_TEXT[cell.previous.status]}`} />
                    <span className="font-mono text-text-primary">{copy.lastResult(formatKpiValue(cell.previous.actual, locale), formatKpiValue(cell.previous.target, locale))}</span>
                  </span>
                  <span className="block text-caption text-text-secondary">{t.kpi.status[cell.previous.status]}</span>
                </td>
                <td className="px-3 py-2.5">
                  <TargetInput
                    id={`target-${mission.id}-${kpi.id}`}
                    label={copy.inputLabel(mission.name, kpi.name)}
                    draft={draft}
                    current={current}
                    editable={editable}
                    onChange={(raw) => onChange(key, raw, current)}
                  />
                  {cell.source === 'profile' && draft === undefined && editable && <span className="mt-1 block text-caption text-text-secondary">{copy.followsProfile(formatKpiValue(cell.value, locale))}</span>}
                  <span className="mt-1 block">
                    <ChangeHint draft={draft} current={cell.value} previous={cell.previous.target} />
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {cell.override && (
                    <button type="button" onClick={() => onHistory(mission)} className="inline-flex items-center gap-1 whitespace-nowrap text-caption font-semibold text-info-soft-text hover:underline" aria-label={copy.historyFor(mission.name)}>
                      <ClockIcon aria-hidden="true" className="size-3.5" />
                      {copy.versions(cell.override.versions ?? 1)}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ProfileTargetTable({
  plan,
  kpi,
  drafts,
  editable,
  onChange,
  onHistory,
}: {
  plan: KpiTargetPlan
  kpi: KpiMeta
  drafts: Drafts
  editable: boolean
  onChange: (key: string, raw: string, current: number | null) => void
  onHistory: (profile: KpiTargetPlanProfile) => void
}) {
  const { t } = useI18n()
  const copy = t.kpi.setTargets.editor
  const profiles = plan.profiles.filter((profile) => profile.kpi_ids.includes(kpi.id))
  const missionNames = new Map(plan.missions.map((mission) => [mission.id, mission.name]))

  if (plan.profiles.length === 0) {
    return (
      <div className="mt-4">
        <PanelEmpty icon={<ClipboardDocumentListIcon />} title={copy.profilesEmptyTitle} body={copy.profilesEmpty} />
      </div>
    )
  }

  if (profiles.length === 0) {
    return <p className="mt-4 rounded-lg bg-page-bg px-4 py-6 text-center text-body-sm text-text-secondary">{copy.noProfileForKpi}</p>
  }

  return (
    <div className="relative mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-left text-body-sm">
        <caption className="sr-only">{copy.profileCaption(kpi.name, plan.cycle.label)}</caption>
        <thead className="bg-section-bg text-caption font-semibold uppercase tracking-wide text-text-secondary">
          <tr>
            <th scope="col" className="px-3 py-2">
              {copy.columns.profile}
            </th>
            <th scope="col" className="px-3 py-2">
              {copy.columns.default(plan.cycle.label)}
            </th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">{copy.columns.history}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => {
            const key = draftKey('p', profile.id, kpi.id)
            const current = profile.defaults[kpi.id]?.value ?? null
            return (
              <tr key={profile.id} className="border-t border-border align-top">
                <th scope="row" className="px-3 py-2.5">
                  <span className="block font-semibold text-text-primary">{profile.name}</span>
                  <span className="block text-caption font-normal text-text-secondary">
                    {profile.mission_ids.length > 0 ? profile.mission_ids.map((id) => missionNames.get(id) ?? id).join(', ') : copy.noMissions}
                  </span>
                </th>
                <td className="px-3 py-2.5">
                  <TargetInput id={`default-${profile.id}-${kpi.id}`} label={copy.defaultInputLabel(profile.name, kpi.name)} draft={drafts[key]} current={current} editable={editable} onChange={(raw) => onChange(key, raw, current)} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  {profile.defaults[kpi.id] && (
                    <button type="button" onClick={() => onHistory(profile)} className="inline-flex items-center gap-1 whitespace-nowrap text-caption font-semibold text-info-soft-text hover:underline" aria-label={copy.historyFor(profile.name)}>
                      <ClockIcon aria-hidden="true" className="size-3.5" />
                      {copy.versions(profile.defaults[kpi.id].versions ?? 1)}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-caption text-text-secondary">{copy.profileNote}</p>
    </div>
  )
}

function TargetHistory({ target, locale }: { target: HistoryTarget; locale: string }) {
  const { t } = useI18n()
  const copy = t.kpi.setTargets.history
  const historyQuery = useQuery({
    queryKey: ['kpi', 'target-history', target.kpi.id, target.missionId ?? target.profileId],
    queryFn: () => getKpiTargetHistory({ kpi_definition_id: target.kpi.id, mission_id: target.missionId, kpi_profile_id: target.profileId }),
    retry: retryUnlessClientError,
  })

  if (historyQuery.isLoading) {
    return <p role="status" className="text-body-sm text-text-secondary">{copy.loading}</p>
  }
  if (historyQuery.isError || !historyQuery.data) {
    return <p role="alert" className="text-body-sm text-danger-soft-text">{copy.loadError}</p>
  }
  if (historyQuery.data.length === 0) {
    return <p className="text-body-sm text-text-secondary">{copy.empty}</p>
  }

  return (
    <div>
      <p className="text-body-sm text-text-secondary">{copy.subtitle}</p>
      <ol className="mt-4 space-y-3" data-testid="kpi-target-history">
        {historyQuery.data.map((version) => (
          <li key={version.id} className={`rounded-lg p-3 ring-1 ${version.in_force ? 'bg-success-soft/50 ring-success/30' : 'bg-page-bg ring-border'}`}>
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-body-sm font-semibold text-text-primary">
                {version.cycle_label} · <span className="font-mono">{formatKpiValue(version.value, locale)}</span>
              </span>
              {version.in_force ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-caption font-semibold text-success-soft-text">
                  <CheckCircleIcon aria-hidden="true" className="size-3.5" />
                  {copy.inForce}
                </span>
              ) : (
                <span className="rounded-full bg-section-bg px-2 py-0.5 text-caption font-semibold text-text-secondary">{copy.superseded}</span>
              )}
            </p>
            <p className="mt-1 text-caption text-text-secondary">{copy.setBy(version.set_by?.full_name ?? copy.unknown, version.set_at ? formatDateTime(version.set_at, locale) : '—')}</p>
            {version.note && <p className="mt-1 text-body-sm text-text-primary">“{version.note}”</p>}
          </li>
        ))}
      </ol>
    </div>
  )
}
