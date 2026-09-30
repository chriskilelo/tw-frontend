import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { BoldIcon, H3Icon, ItalicIcon, ListBulletIcon, NumberedListIcon, TableCellsIcon } from '@heroicons/react/20/solid'
import { useI18n } from '../../i18n/context'
import { ReportMarkdown } from './ReportMarkdown'
import { SECTION_CONTENT_MAX, wordCount } from './reportPresentation'

type LineKind = 'bullet' | 'numbered' | 'heading'

const LINE_MARKER = /^(\s*(?:[-*+]|\d{1,9}[.)])\s+|#{1,3}\s+)/

interface NarrativeEditorProps {
  value: string
  onChange: (value: string) => void
  /** The id of the element that names this section (its heading). */
  labelledBy: string
  describedBy?: string
  /** HTML level of the section heading, so previewed subheadings nest beneath it. */
  headingLevel?: number
}

/**
 * FR-RPT-004: the narrative section editor — bold, italics, bulleted and numbered lists,
 * subheadings and basic tables — written as Markdown the toolbar inserts for the attache
 * (Ctrl/Cmd+B, Ctrl/Cmd+I), with a live preview rendered by ReportMarkdown.
 */
export function NarrativeEditor({ value, onChange, labelledBy, describedBy, headingLevel = 2 }: NarrativeEditorProps) {
  const { t } = useI18n()
  const copy = t.reports.editor.narrative
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectionRef = useRef<[number, number] | null>(null)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const baseId = useId()
  const helpId = `${baseId}-help`
  const countId = `${baseId}-count`

  useLayoutEffect(() => {
    const element = textareaRef.current
    const selection = selectionRef.current
    if (element && selection) {
      element.focus()
      element.setSelectionRange(selection[0], selection[1])
      selectionRef.current = null
    }
  }, [value])

  function edit(next: string, selectionStart: number, selectionEnd: number) {
    selectionRef.current = [selectionStart, selectionEnd]
    onChange(next.slice(0, SECTION_CONTENT_MAX))
  }

  function wrap(marker: string, sample: string) {
    const element = textareaRef.current
    if (!element) {
      return
    }
    const { selectionStart: start, selectionEnd: end } = element
    const selected = value.slice(start, end)
    const text = selected || sample
    const next = `${value.slice(0, start)}${marker}${text}${marker}${value.slice(end)}`
    edit(next, start + marker.length, start + marker.length + text.length)
  }

  function prefixLines(kind: LineKind) {
    const element = textareaRef.current
    if (!element) {
      return
    }
    const { selectionStart: start, selectionEnd: end } = element
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const nextBreak = value.indexOf('\n', end)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const lines = value.slice(lineStart, lineEnd).split('\n')
    const sample = kind === 'heading' ? copy.headingSample : copy.listSample
    const replaced = lines
      .map((line, index) => {
        const text = line.replace(LINE_MARKER, '')
        const marker = kind === 'bullet' ? '- ' : kind === 'numbered' ? `${index + 1}. ` : '### '
        return `${marker}${text || (lines.length === 1 ? sample : '')}`
      })
      .join('\n')
    const next = `${value.slice(0, lineStart)}${replaced}${value.slice(lineEnd)}`
    edit(next, lineStart, lineStart + replaced.length)
  }

  function insertTable() {
    const element = textareaRef.current
    if (!element) {
      return
    }
    const { selectionStart: start, selectionEnd: end } = element
    const before = value.slice(0, start)
    const after = value.slice(end)
    const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const trail = after === '' || after.startsWith('\n') ? '' : '\n\n'
    const next = `${before}${lead}${copy.tableTemplate}${trail}${after}`
    // Select the first header cell ("| Item |"), ready to be typed over.
    const firstCell = copy.tableTemplate.slice(2, copy.tableTemplate.indexOf(' |', 2))
    const cursor = before.length + lead.length + 2
    edit(next, cursor, cursor + firstCell.length)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'b') {
      event.preventDefault()
      wrap('**', copy.boldSample)
    } else if (key === 'i') {
      event.preventDefault()
      wrap('*', copy.italicSample)
    }
  }

  const tools: { key: string; label: string; icon: ReactNode; run: () => void; shortcut?: string }[] = [
    { key: 'bold', label: copy.bold, icon: <BoldIcon />, run: () => wrap('**', copy.boldSample), shortcut: 'Ctrl+B' },
    { key: 'italic', label: copy.italic, icon: <ItalicIcon />, run: () => wrap('*', copy.italicSample), shortcut: 'Ctrl+I' },
    { key: 'heading', label: copy.heading, icon: <H3Icon />, run: () => prefixLines('heading') },
    { key: 'bullets', label: copy.bullets, icon: <ListBulletIcon />, run: () => prefixLines('bullet') },
    { key: 'numbered', label: copy.numbered, icon: <NumberedListIcon />, run: () => prefixLines('numbered') },
    { key: 'table', label: copy.table, icon: <TableCellsIcon />, run: insertTable },
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white focus-within:border-info focus-within:ring-4 focus-within:ring-info-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-page-bg px-2 py-1.5">
        <div role="toolbar" aria-label={copy.toolbar} className="flex flex-wrap items-center gap-0.5">
          {tools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              onClick={tool.run}
              disabled={mode === 'preview'}
              aria-label={tool.label}
              title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
              className="grid size-8 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 [&>svg]:size-4"
            >
              {tool.icon}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label={copy.toolbar} className="flex rounded-lg bg-section-bg p-0.5 text-body-sm font-semibold">
          {(['write', 'preview'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`${baseId}-${tab}-tab`}
              aria-selected={mode === tab}
              aria-controls={`${baseId}-${tab}-panel`}
              onClick={() => setMode(tab)}
              className={`rounded-md px-3 py-1 transition-colors ${mode === tab ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-primary'}`}
            >
              {tab === 'write' ? copy.write : copy.preview}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id={`${baseId}-write-panel`} aria-labelledby={`${baseId}-write-tab`} hidden={mode !== 'write'}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-labelledby={labelledBy}
          aria-describedby={[describedBy, helpId, countId].filter(Boolean).join(' ')}
          placeholder={copy.placeholder}
          maxLength={SECTION_CONTENT_MAX}
          rows={14}
          className="block min-h-72 w-full resize-y border-0 bg-transparent px-4 py-3 font-sans text-[0.9375rem] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-preview-panel`}
        aria-labelledby={`${baseId}-preview-tab`}
        hidden={mode !== 'preview'}
        className="min-h-72 px-4 py-3"
        data-testid="narrative-preview"
      >
        {value.trim() ? (
          <ReportMarkdown source={value} headingLevel={headingLevel} />
        ) : (
          <p className="italic text-text-muted">{copy.previewEmpty}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-page-bg px-4 py-2 text-caption text-text-secondary">
        <span id={helpId}>{copy.help}</span>
        <span id={countId} className="font-mono text-[0.6875rem]">
          {copy.words(wordCount(value))} · {copy.characters(value.length, SECTION_CONTENT_MAX)}
        </span>
      </div>
    </div>
  )
}
