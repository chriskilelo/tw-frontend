import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from '../../../components/Pagination'
import type { HqWorkspaceScope } from '../../../api/sdt'
import type en from '../../../i18n/en'
import { apiErrorMessages } from '../../../lib/apiErrors'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const WORKSPACE_TABS = ['alerts', 'inquiries', 'directives', 'reports'] as const
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

/** The URL keys a section owns; they are cleared when the user switches section. */
export const SECTION_KEYS = ['queue', 'status', 'q', 'sort', 'page', 'per_page', 'type', 'high_value', 'period', 'timeliness'] as const
export type SectionKey = (typeof SECTION_KEYS)[number]
type WorkspaceKey = 'tab' | 'scope' | 'mission' | SectionKey

export function oneOf<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return value !== null && (options as readonly string[]).includes(value) ? (value as T) : undefined
}

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * The workspace keeps its whole state in the URL (tab, scope, mission filter and the active
 * section's own filters), so a view can be bookmarked or shared and the back button works.
 * Values the API would refuse are dropped here, so a hand-edited URL never produces a 422.
 */
export function useWorkspaceParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawMission = searchParams.get('mission')
  const requestedPerPage = positiveInt(searchParams.get('per_page'))

  const params = {
    tab: oneOf(searchParams.get('tab'), WORKSPACE_TABS) ?? 'alerts',
    scope: oneOf<HqWorkspaceScope>(searchParams.get('scope'), ['portfolio', 'department']),
    missionId: rawMission && UUID_PATTERN.test(rawMission) ? rawMission : undefined,
    page: positiveInt(searchParams.get('page')) ?? 1,
    perPage: requestedPerPage && (PER_PAGE_OPTIONS as readonly number[]).includes(requestedPerPage) ? requestedPerPage : DEFAULT_PER_PAGE,
    q: (searchParams.get('q') ?? '').trim().slice(0, 100),
    get: (key: SectionKey) => searchParams.get(key),
  }

  function update(changes: Partial<Record<WorkspaceKey, string | null>>, resetPage = true) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value) {
            next.set(key, value)
          } else {
            next.delete(key)
          }
        }
        if (resetPage && !('page' in changes)) {
          next.delete('page')
        }
        return next
      },
      { replace: true },
    )
  }

  function switchTab(tab: WorkspaceTab) {
    const cleared = Object.fromEntries(SECTION_KEYS.map((key) => [key, null])) as Record<SectionKey, null>
    update({ ...cleared, tab: tab === 'alerts' ? null : tab })
  }

  return { params, update, switchTab }
}

export type WorkspaceParams = ReturnType<typeof useWorkspaceParams>

/** The message for <ActionNotice>, cleared a few seconds after it is set. */
export function useActionNotice(): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (message === null) {
      return
    }
    const timer = window.setTimeout(() => setMessage(null), 6000)
    return () => window.clearTimeout(timer)
  }, [message])

  return [message, setMessage]
}

/** "Issue a directive" pre-filled with a mission and a short reference to its source. */
export function issueDirectiveLink(missionId?: string | null, context?: string | null): string {
  const query = new URLSearchParams({ from: 'hq-workspace' })
  if (missionId) {
    query.set('mission_id', missionId)
  }
  if (context) {
    query.set('context', context)
  }
  return `/directives/new?${query.toString()}`
}

/**
 * The message for a row action the API refused: a plain explanation for a refusal (403, for
 * example after a reassignment) or a vanished record (404), the API's own words otherwise.
 */
export function rowActionError(error: unknown, t: typeof en): string {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === 403) {
    return t.sdt.hqWorkspace.actionForbidden
  }
  if (status === 404) {
    return t.sdt.hqWorkspace.actionGone
  }
  return apiErrorMessages(error, t.common.genericError).join(' ')
}
