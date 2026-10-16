import { useId, useRef, type ComponentType, type KeyboardEvent, type ReactNode, type SVGProps } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowPathIcon,
  BellAlertIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  MapPinIcon,
  PlusIcon,
  ShieldExclamationIcon,
  TagIcon,
} from '@heroicons/react/20/solid'
import { getHqWorkspace, type HqWorkspaceOverview, type HqWorkspaceScope } from '../../api/sdt'
import { Select } from '../../components/Select'
import { SegmentedControl } from '../../components/dashboard/layout'
import { StatTile } from '../../components/dashboard/visuals'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../i18n/context'
import { retryUnlessClientError } from '../../lib/apiErrors'
import { localeFor } from '../../lib/formatters'
import { formatNumber } from '../../lib/dashboardFormat'
import WorkspaceAlerts from './hqWorkspace/WorkspaceAlerts'
import WorkspaceDirectives from './hqWorkspace/WorkspaceDirectives'
import WorkspaceInquiries from './hqWorkspace/WorkspaceInquiries'
import WorkspaceReports from './hqWorkspace/WorkspaceReports'
import { SECTION_KEYS, WORKSPACE_TABS, issueDirectiveLink, useWorkspaceParams, type WorkspaceTab } from './hqWorkspace/workspaceState'

/** MinistryPolicy::viewHqWorkspace(). The page self-gates (UI-006); the API is the real guard. */
const HQ_OFFICER = 'Ministry HQ Officer'

const TAB_ICONS: Record<WorkspaceTab, ReactNode> = {
  alerts: <BellAlertIcon />,
  inquiries: <ChatBubbleLeftRightIcon />,
  directives: <ClipboardDocumentCheckIcon />,
  reports: <DocumentTextIcon />,
}

/**
 * FR-SDT-012 to 015 (TW-ARCH-001 L3-C-006): the HQ Trade Officer's workspace. It opens on the
 * officer's configured portfolio, with a switch to the whole department (FR-SDT-012); alerts
 * delegated to them are acknowledged and answered in place (FR-SDT-013); inquiries attaches
 * flagged for HQ are reviewed in place (FR-SDT-013, FR-INQ-009); directives are issued and
 * followed through from here (FR-SDT-014); and submitted reports are read here (FR-SDT-015).
 * Every count, list and row action comes from GET /sdt/hq-workspace and its section lists.
 */
export default function HqWorkspacePage() {
  const { t } = useI18n()
  const copy = t.sdt.hqWorkspace
  const { user, role, isLoading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const workspace = useWorkspaceParams()
  const { params, update, switchTab } = workspace
  const isOfficer = role?.name === HQ_OFFICER

  const overviewQuery = useQuery({
    queryKey: ['sdt', 'hq-workspace', 'overview', { scope: params.scope ?? null, mission: params.missionId ?? null }],
    queryFn: () => getHqWorkspace({ scope: params.scope, mission_id: params.missionId }),
    enabled: isOfficer,
    retry: retryUnlessClientError,
    placeholderData: keepPreviousData,
  })

  if (authLoading) {
    return (
      <PageShell>
        <WorkspaceSkeleton />
      </PageShell>
    )
  }

  if (!isOfficer) {
    return (
      <PageShell>
        <WorkspaceNotice icon={<ShieldExclamationIcon />} title={copy.forbiddenTitle} body={copy.forbiddenBody} />
      </PageShell>
    )
  }

  const overviewStatus = isAxiosError(overviewQuery.error) ? overviewQuery.error.response?.status : undefined
  if (overviewQuery.isError && !overviewQuery.data) {
    return (
      <PageShell>
        <h1 className="text-h1 text-primary">{copy.title}</h1>
        {overviewStatus === 403 ? (
          <WorkspaceNotice icon={<ShieldExclamationIcon />} title={copy.forbiddenTitle} body={copy.forbiddenBody} />
        ) : overviewStatus === 422 ? (
          <WorkspaceNotice
            icon={<ExclamationTriangleIcon />}
            title={copy.invalidFiltersTitle}
            body={copy.invalidFilters}
            action={
              <button type="button" onClick={() => update({ mission: null, scope: null })} className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary hover:bg-section-bg">
                {copy.filters.clear}
              </button>
            }
          />
        ) : (
          <WorkspaceNotice
            icon={<ExclamationTriangleIcon />}
            title={copy.loadErrorTitle}
            body={copy.loadError}
            action={
              <button type="button" onClick={() => void overviewQuery.refetch()} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-button text-white hover:bg-primary-light">
                <ArrowPathIcon aria-hidden="true" className="size-4" />
                {copy.retry}
              </button>
            }
          />
        )}
      </PageShell>
    )
  }

  const overview = overviewQuery.data
  const scope: HqWorkspaceScope = overview?.scope ?? 'department'
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['sdt', 'hq-workspace'] })
  }

  return (
    <PageShell>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-primary">{copy.title}</h1>
          <p className="mt-1 text-body text-text-secondary">
            {[user?.full_name, overview?.department?.name].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 max-w-2xl text-body-sm text-text-secondary">{copy.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/directives"
            className="inline-flex h-10 items-center gap-2 rounded border border-border bg-white px-4 text-button text-primary transition-colors hover:bg-section-bg"
          >
            <ClipboardDocumentListIcon aria-hidden="true" className="size-4" />
            {copy.openDirectiveList}
          </Link>
          <Link
            to={issueDirectiveLink(params.missionId)}
            className="inline-flex h-10 items-center gap-2 rounded bg-accent px-4 text-button text-accent-text shadow-sm transition-colors hover:bg-accent-light"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            {copy.issueDirective}
          </Link>
        </div>
      </header>

      {overview ? (
        <>
          <PortfolioPanel
            overview={overview}
            scope={scope}
            missionId={params.missionId}
            onScopeChange={(next) => update({ scope: next === 'portfolio' ? null : next })}
            onMissionChange={(next) => update({ mission: next })}
          />
          <AttentionTiles overview={overview} />
        </>
      ) : (
        <WorkspaceSkeleton />
      )}

      <WorkspaceTabs
        active={params.tab}
        overview={overview}
        onSelect={switchTab}
        renderPanel={(tab) => {
          switch (tab) {
            case 'alerts':
              return <WorkspaceAlerts workspace={workspace} overview={overview} scope={scope} onChanged={refresh} />
            case 'inquiries':
              return <WorkspaceInquiries workspace={workspace} overview={overview} />
            case 'directives':
              return <WorkspaceDirectives workspace={workspace} overview={overview} onChanged={refresh} />
            default:
              return <WorkspaceReports workspace={workspace} overview={overview} scope={scope} />
          }
        }}
      />
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-310 space-y-6 px-4 py-6 sm:px-7" data-testid="hq-workspace">
      {children}
    </div>
  )
}

function WorkspaceSkeleton() {
  const { t } = useI18n()
  return (
    <div role="status" aria-label={t.sdt.hqWorkspace.loading} className="space-y-4">
      <div className="h-32 animate-pulse rounded-xl border border-border bg-white motion-reduce:animate-none" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-white motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  )
}

function WorkspaceNotice({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-sm" data-testid="hq-workspace-notice">
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-section-bg text-text-secondary [&>svg]:size-6">
        {icon}
      </span>
      <p className="text-h3 text-primary">{title}</p>
      <p className="max-w-md text-body-sm text-text-secondary">{body}</p>
      {action}
    </div>
  )
}

/**
 * FR-SDT-012: what the portfolio holds, the switch between it and the whole department, and
 * a mission filter that applies to every section.
 */
function PortfolioPanel({
  overview,
  scope,
  missionId,
  onScopeChange,
  onMissionChange,
}: {
  overview: HqWorkspaceOverview
  scope: HqWorkspaceScope
  missionId?: string
  onScopeChange: (scope: HqWorkspaceScope) => void
  onMissionChange: (missionId: string | null) => void
}) {
  const { t } = useI18n()
  const copy = t.sdt.hqWorkspace.portfolio
  const headingId = useId()
  const { portfolio } = overview
  const missionOptions = overview.filter_options.missions.map((mission) => ({
    value: mission.id,
    label: mission.host_country ? `${mission.name} (${mission.host_country})` : mission.name,
  }))

  return (
    <section aria-labelledby={headingId} className="relative overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5" data-testid="hq-workspace-portfolio">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-primary to-primary-lightest" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="flex items-center gap-2 text-h4 text-primary">
            <BriefcaseIcon aria-hidden="true" className="size-5" />
            {copy.title}
          </h2>
          {portfolio.configured ? (
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <PortfolioList label={copy.missions} icon={MapPinIcon} items={portfolio.missions.map((mission) => mission.name)} emptyText={copy.noneOfKind} />
              <PortfolioList label={copy.countries} icon={GlobeAltIcon} items={portfolio.countries} emptyText={copy.noneOfKind} />
              <PortfolioList label={copy.sectors} icon={TagIcon} items={portfolio.sectors} emptyText={copy.noneOfKind} />
            </dl>
          ) : (
            <p className="mt-2 flex max-w-2xl items-start gap-2 text-body-sm text-text-secondary">
              <InformationCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
              {copy.none}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-stretch xl:flex-row xl:items-end">
          {portfolio.configured && (
            <div className="flex flex-col gap-1">
              <span className="text-body-sm font-semibold text-text-secondary">{copy.scopeLabel}</span>
              <SegmentedControl<HqWorkspaceScope>
                label={copy.scopeLabel}
                value={scope}
                onChange={onScopeChange}
                options={[
                  { value: 'portfolio', label: copy.scopePortfolio },
                  { value: 'department', label: copy.scopeDepartment },
                ]}
              />
            </div>
          )}
          <div className="min-w-56">
            <Select
              label={copy.missionFilter}
              value={missionId ?? ''}
              placeholder={copy.allMissions}
              onChange={(event) => onMissionChange(event.target.value || null)}
              options={missionOptions}
              className="w-full"
            />
          </div>
        </div>
      </div>
      {portfolio.configured && <p className="mt-3 border-t border-border pt-3 text-caption text-text-secondary">{copy.scopeHelp}</p>}
    </section>
  )
}

function PortfolioList({ label, icon: Icon, items, emptyText }: { label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; items: string[]; emptyText: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-text-muted">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        {label}
      </dt>
      <dd className="mt-1.5 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-body-sm text-text-muted">{emptyText}</span>
        ) : (
          items.map((item) => (
            <span key={item} className="rounded-full bg-primary/5 px-2.5 py-0.5 text-body-sm font-medium text-primary ring-1 ring-primary/10">
              {item}
            </span>
          ))
        )}
      </dd>
    </div>
  )
}

/** What needs the officer, at a glance; each tile opens its section. */
function AttentionTiles({ overview }: { overview: HqWorkspaceOverview }) {
  const { t, language } = useI18n()
  const copy = t.sdt.hqWorkspace.tiles
  const locale = localeFor(language)
  const { counts } = overview
  const latest = counts.reports.latest_period
  const location = useLocation()
  const tabLink = (tab: WorkspaceTab) => {
    const query = new URLSearchParams(location.search)
    for (const key of SECTION_KEYS) {
      query.delete(key)
    }
    if (tab === 'alerts') {
      query.delete('tab')
    } else {
      query.set('tab', tab)
    }
    const search = query.toString()
    return search ? `?${search}` : '?'
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="hq-workspace-tiles">
      <StatTile
        label={copy.alerts}
        value={formatNumber(counts.alerts.awaiting, locale)}
        icon={<BellAlertIcon />}
        tone={counts.alerts.awaiting > 0 ? 'accent' : 'success'}
        to={tabLink('alerts')}
        footnote={copy.alertsFootnote(counts.alerts.acknowledged)}
      />
      <StatTile
        label={copy.inquiries}
        value={formatNumber(counts.inquiries.open, locale)}
        icon={<ChatBubbleLeftRightIcon />}
        tone="info"
        to={tabLink('inquiries')}
        footnote={copy.inquiriesFootnote(counts.inquiries.high_value_open)}
        footnoteTone={counts.inquiries.high_value_open > 0 ? 'atrisk' : 'neutral'}
      />
      <StatTile
        label={copy.directives}
        value={formatNumber(counts.directives.attention, locale)}
        icon={<ClipboardDocumentCheckIcon />}
        tone={counts.directives.attention > 0 ? 'directive' : 'success'}
        to={tabLink('directives')}
        footnote={copy.directivesFootnote(counts.directives.awaiting_closure, counts.directives.overdue)}
        footnoteTone={counts.directives.overdue > 0 ? 'danger' : 'neutral'}
      />
      <StatTile
        label={copy.reports}
        value={formatNumber(counts.reports.submitted, locale)}
        icon={<DocumentTextIcon />}
        tone="success"
        to={tabLink('reports')}
        footnote={latest ? copy.reportsFootnote(latest.label, latest.submitted, latest.late) : copy.reportsNone}
        footnoteTone={latest && latest.late > 0 ? 'atrisk' : 'neutral'}
      />
    </div>
  )
}

/**
 * The four sections as a WAI-ARIA tab set: one tab stop, arrow keys move between tabs, and
 * each tab carries the count of what waits in it.
 */
function WorkspaceTabs({
  active,
  overview,
  onSelect,
  renderPanel,
}: {
  active: WorkspaceTab
  overview?: HqWorkspaceOverview
  onSelect: (tab: WorkspaceTab) => void
  renderPanel: (tab: WorkspaceTab) => ReactNode
}) {
  const { t } = useI18n()
  const copy = t.sdt.hqWorkspace
  const baseId = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const counts = overview?.counts
  const badge: Record<WorkspaceTab, { value?: number; urgent: boolean }> = {
    alerts: { value: counts?.alerts.awaiting, urgent: (counts?.alerts.awaiting ?? 0) > 0 },
    inquiries: { value: counts?.inquiries.open, urgent: false },
    directives: { value: counts?.directives.attention, urgent: (counts?.directives.attention ?? 0) > 0 },
    reports: { value: counts?.reports.submitted, urgent: false },
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: WORKSPACE_TABS.length - 1 - index }
    const step = keys[event.key]
    if (step === undefined) {
      return
    }
    event.preventDefault()
    const next = WORKSPACE_TABS[(index + step + WORKSPACE_TABS.length) % WORKSPACE_TABS.length]
    onSelect(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="space-y-4">
      <div role="tablist" aria-label={copy.tabsLabel} className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1.5 shadow-sm">
        {WORKSPACE_TABS.map((tab, index) => {
          const isActive = tab === active
          const count = badge[tab]
          return (
            <button
              key={tab}
              ref={(node) => {
                tabRefs.current[tab] = node
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab}`}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onClick={() => onSelect(tab)}
              data-testid={`hq-workspace-tab-${tab}`}
              className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-body-sm font-semibold transition-colors motion-reduce:transition-none [&_svg]:size-4 ${
                isActive ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:bg-section-bg hover:text-primary'
              }`}
            >
              <span aria-hidden="true" className="contents">
                {TAB_ICONS[tab]}
              </span>
              {copy.tabs[tab]}
              {count.value !== undefined && (
                <span
                  className={`min-w-6 rounded-full px-1.5 text-center font-mono text-[0.6875rem] font-bold ${
                    isActive ? 'bg-white/20 text-white' : count.urgent ? 'bg-accent text-accent-text' : 'bg-section-bg text-text-secondary'
                  }`}
                >
                  {count.value}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel-${active}`} aria-labelledby={`${baseId}-tab-${active}`} data-testid={`hq-workspace-panel-${active}`}>
        {renderPanel(active)}
      </div>
    </section>
  )
}
