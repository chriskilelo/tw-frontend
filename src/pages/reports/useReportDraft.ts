import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { saveSectionContent, saveSectionRows, type PeriodicReportDetail, type ReportSectionDetail } from '../../api/reports'
import { apiErrorMessages } from '../../lib/apiErrors'
import { rowsFromSection, rowsPayload, validateRows, type EditableRow } from './reportPresentation'

/** Save this long after the last keystroke... */
export const AUTOSAVE_DELAY_MS = 1500
/** ...but never let a change wait longer than this (FR-RPT-006: at most 60 seconds). */
export const AUTOSAVE_MAX_WAIT_MS = 30000
/** Back-off for saves that failed on the network; validation errors are not retried. */
export const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000]

export type SectionValue = { kind: 'narrative'; content: string } | { kind: 'table'; rows: EditableRow[] }

/**
 * saved: nothing pending; pending: a change waiting for its save; saving: in flight;
 * invalid: a table holds values the API would refuse (never sent); error: the save failed;
 * locked: the report was submitted, so nothing more can be saved.
 */
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'invalid' | 'error' | 'locked'

export interface SaveState {
  status: SaveStatus
  savedAt: number | null
  errors: string[]
  willRetry: boolean
}

const SAVED: SaveState = { status: 'saved', savedAt: null, errors: [], willRetry: false }

export function initialValue(section: ReportSectionDetail): SectionValue {
  return section.section_type === 'structured_table'
    ? { kind: 'table', rows: rowsFromSection(section) }
    : { kind: 'narrative', content: section.content ?? '' }
}

type Prepared = { key: string; send: () => Promise<PeriodicReportDetail> } | { invalid: true }

function prepare(reportId: string, section: ReportSectionDetail, value: SectionValue): Prepared {
  if (value.kind === 'narrative') {
    return { key: value.content, send: () => saveSectionContent(reportId, section.id, value.content) }
  }
  const columns = section.column_schema ?? []
  if (validateRows(columns, value.rows).length > 0) {
    return { invalid: true }
  }
  const payload = rowsPayload(columns, value.rows)
  return { key: JSON.stringify(payload), send: () => saveSectionRows(reportId, section.id, payload) }
}

function statusOf(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

/**
 * The report editor's working copy and its auto-save (FR-RPT-005, FR-RPT-006, UI-005). The
 * local values are the source of truth while the page is open, so moving between sections
 * never loses anything, even while a save is still in flight. Each section is saved on its
 * own: AUTOSAVE_DELAY_MS after the last change, at most AUTOSAVE_MAX_WAIT_MS after the first
 * unsaved one, and immediately on flush() — which the editor calls when the attache changes
 * section, before submitting, and when the page unmounts. A failed save keeps the text and is
 * retried; closing the tab with anything unsaved asks the browser to confirm.
 */
export function useReportDraft(report: PeriodicReportDetail, onSaved: (updated: PeriodicReportDetail) => void, onLocked: () => void) {
  const sectionsById = useMemo(() => new Map(report.sections.map((section) => [section.id, section])), [report.sections])
  const sectionsRef = useRef(sectionsById)
  const [values, setValues] = useState<Record<string, SectionValue>>(() =>
    Object.fromEntries(report.sections.map((section) => [section.id, initialValue(section)])),
  )
  const valuesRef = useRef(values)
  // The persisted snapshot starts as what the server sent.
  const [serverSnapshot] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      report.sections.map((section) => {
        const prepared = prepare(report.id, section, initialValue(section))
        return [section.id, 'key' in prepared ? prepared.key : '']
      }),
    ),
  )
  const persistedRef = useRef<Record<string, string>>(serverSnapshot)
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const dirtySinceRef = useRef<Record<string, number>>({})
  const inflightRef = useRef<Record<string, Promise<boolean> | undefined>>({})
  const attemptsRef = useRef<Record<string, number>>({})
  const lockedRef = useRef(false)
  const callbacksRef = useRef({ onSaved, onLocked })
  const [states, setStates] = useState<Record<string, SaveState>>({})

  useEffect(() => {
    sectionsRef.current = sectionsById
    callbacksRef.current = { onSaved, onLocked }
  })

  const setState = useCallback((sectionId: string, next: Partial<SaveState>) => {
    setStates((previous) => ({ ...previous, [sectionId]: { ...(previous[sectionId] ?? SAVED), ...next } }))
  }, [])

  const clearTimer = useCallback((sectionId: string) => {
    if (timersRef.current[sectionId]) {
      clearTimeout(timersRef.current[sectionId])
      delete timersRef.current[sectionId]
    }
  }, [])

  const isUnsaved = useCallback((sectionId: string): boolean => {
    const section = sectionsRef.current.get(sectionId)
    const value = valuesRef.current[sectionId]
    if (!section || !value) {
      return false
    }
    const prepared = prepare(report.id, section, value)
    return !('key' in prepared) || prepared.key !== persistedRef.current[sectionId]
  }, [report.id])

  const saveRef = useRef<(sectionId: string) => Promise<boolean>>(async () => true)

  const schedule = useCallback(
    (sectionId: string, delay?: number) => {
      clearTimer(sectionId)
      const now = Date.now()
      dirtySinceRef.current[sectionId] ??= now
      const waited = now - dirtySinceRef.current[sectionId]
      const wait = delay ?? Math.max(0, Math.min(AUTOSAVE_DELAY_MS, AUTOSAVE_MAX_WAIT_MS - waited))
      timersRef.current[sectionId] = setTimeout(() => {
        delete timersRef.current[sectionId]
        void saveRef.current(sectionId)
      }, wait)
    },
    [clearTimer],
  )

  const save = useCallback(
    async (sectionId: string): Promise<boolean> => {
      clearTimer(sectionId)
      const pending = inflightRef.current[sectionId]
      if (pending) {
        await pending
      }
      if (lockedRef.current) {
        return false
      }

      const section = sectionsRef.current.get(sectionId)
      const value = valuesRef.current[sectionId]
      if (!section || !value) {
        return true
      }

      const prepared = prepare(report.id, section, value)
      if (!('key' in prepared)) {
        setState(sectionId, { status: 'invalid', errors: [], willRetry: false })
        return false
      }
      if (prepared.key === persistedRef.current[sectionId]) {
        delete dirtySinceRef.current[sectionId]
        setState(sectionId, { status: 'saved', errors: [], willRetry: false })
        return true
      }

      setState(sectionId, { status: 'saving', errors: [], willRetry: false })

      const request = prepared
        .send()
        .then((updated) => {
          persistedRef.current[sectionId] = prepared.key
          attemptsRef.current[sectionId] = 0
          callbacksRef.current.onSaved(updated)
          if (isUnsaved(sectionId)) {
            setState(sectionId, { status: 'pending', savedAt: Date.now() })
            schedule(sectionId)
          } else {
            delete dirtySinceRef.current[sectionId]
            setState(sectionId, { status: 'saved', savedAt: Date.now(), errors: [] })
          }
          return true
        })
        .catch((error: unknown) => {
          const status = statusOf(error)
          const messages = apiErrorMessages(error, '')
          if (status === 403 || (status === 422 && messages.some((message) => message.includes('BR-009')))) {
            lockedRef.current = true
            setState(sectionId, { status: 'locked', errors: [], willRetry: false })
            callbacksRef.current.onLocked()
            return false
          }
          if (status === 422) {
            setState(sectionId, { status: 'error', errors: messages.filter(Boolean), willRetry: false })
            return false
          }
          const attempt = attemptsRef.current[sectionId] ?? 0
          attemptsRef.current[sectionId] = attempt + 1
          setState(sectionId, { status: 'error', errors: [], willRetry: true })
          schedule(sectionId, RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)])
          return false
        })
        .finally(() => {
          delete inflightRef.current[sectionId]
        })

      inflightRef.current[sectionId] = request
      return request
    },
    [clearTimer, isUnsaved, report.id, schedule, setState],
  )

  useEffect(() => {
    saveRef.current = save
  })

  const update = useCallback(
    (sectionId: string, value: SectionValue) => {
      valuesRef.current = { ...valuesRef.current, [sectionId]: value }
      setValues(valuesRef.current)
      if (lockedRef.current) {
        return
      }
      const section = sectionsRef.current.get(sectionId)
      if (section && !('key' in prepare(report.id, section, value))) {
        clearTimer(sectionId)
        setState(sectionId, { status: 'invalid', errors: [], willRetry: false })
        return
      }
      setState(sectionId, { status: inflightRef.current[sectionId] ? 'saving' : 'pending', errors: [] })
      schedule(sectionId)
    },
    [clearTimer, report.id, schedule, setState],
  )

  /** Saves one section now, or every section with something unsaved. Resolves true when all are saved. */
  const flush = useCallback(
    async (sectionId?: string): Promise<boolean> => {
      const ids = sectionId ? [sectionId] : Object.keys(valuesRef.current)
      const results = await Promise.all(
        ids.map((id) => (isUnsaved(id) || timersRef.current[id] || inflightRef.current[id] ? saveRef.current(id) : Promise.resolve(true))),
      )
      return results.every(Boolean)
    },
    [isUnsaved],
  )

  /** Adopts a section as the server now holds it (after carrying rows forward). */
  const resetSection = useCallback(
    (section: ReportSectionDetail) => {
      clearTimer(section.id)
      const value = initialValue(section)
      const prepared = prepare(report.id, section, value)
      persistedRef.current[section.id] = 'key' in prepared ? prepared.key : ''
      delete dirtySinceRef.current[section.id]
      valuesRef.current = { ...valuesRef.current, [section.id]: value }
      setValues(valuesRef.current)
      setState(section.id, { status: 'saved', savedAt: Date.now(), errors: [], willRetry: false })
    },
    [clearTimer, report.id, setState],
  )

  // Leaving the page within the app flushes; closing the tab with anything unsaved asks first.
  useEffect(() => {
    const timers = timersRef.current
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      const unsaved = Object.keys(valuesRef.current).some((id) => isUnsaved(id) || inflightRef.current[id])
      if (unsaved && !lockedRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload)
      for (const id of Object.keys(timers)) {
        clearTimeout(timers[id])
        void saveRef.current(id)
      }
    }
  }, [isUnsaved])

  const overall = useMemo<SaveState>(() => {
    const list = Object.values(states)
    const savedAt = list.reduce<number | null>((latest, state) => (state.savedAt && (!latest || state.savedAt > latest) ? state.savedAt : latest), null)
    for (const status of ['locked', 'error', 'invalid', 'saving', 'pending'] as SaveStatus[]) {
      const match = list.find((state) => state.status === status)
      if (match) {
        return { ...match, savedAt }
      }
    }
    return { ...SAVED, savedAt }
  }, [states])

  return {
    values,
    states,
    overall,
    setNarrative: (sectionId: string, content: string) => update(sectionId, { kind: 'narrative', content }),
    setRows: (sectionId: string, rows: EditableRow[]) => update(sectionId, { kind: 'table', rows }),
    flush,
    resetSection,
  }
}
