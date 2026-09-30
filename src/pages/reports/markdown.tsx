import type { ReactNode } from 'react'

/**
 * The Markdown subset narrative sections are written in (FR-RPT-004), parsed into blocks and
 * inline spans. Rendering (ReportMarkdown) turns these into React elements — never HTML.
 */

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; ordered: boolean; start: number; items: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*(\d{1,9})[.)]\s+(.*)$/
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|')
}

function splitCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim())
}

function startsBlock(line: string, next: string | undefined): boolean {
  return HEADING.test(line) || BULLET.test(line) || NUMBERED.test(line) || (isTableRow(line) && next !== undefined && TABLE_SEPARATOR.test(next))
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.trim() === '') {
      index += 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] })
      index += 1
      continue
    }

    if (isTableRow(line) && index + 1 < lines.length && TABLE_SEPARATOR.test(lines[index + 1])) {
      const header = splitCells(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && isTableRow(lines[index])) {
        const cells = splitCells(lines[index])
        rows.push(header.map((_, cellIndex) => cells[cellIndex] ?? ''))
        index += 1
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    const bullet = BULLET.exec(line)
    const numbered = NUMBERED.exec(line)
    if (bullet || numbered) {
      const ordered = Boolean(numbered) && !bullet
      const pattern = ordered ? NUMBERED : BULLET
      const items: string[] = []
      const start = ordered && numbered ? Number(numbered[1]) : 1
      while (index < lines.length && lines[index].trim() !== '') {
        const match = pattern.exec(lines[index])
        if (match) {
          items.push(ordered ? match[2] : match[1])
        } else if (!startsBlock(lines[index], lines[index + 1]) && items.length > 0) {
          items[items.length - 1] += `\n${lines[index].trim()}`
        } else {
          break
        }
        index += 1
      }
      blocks.push({ type: 'list', ordered, start, items })
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim() !== '' && (paragraph.length === 0 || !startsBlock(lines[index], lines[index + 1]))) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push({ type: 'paragraph', lines: paragraph })
  }

  return blocks
}

const INLINE = /\*\*\*(?=\S)([\s\S]*?\S)\*\*\*|\*\*(?=\S)([\s\S]*?\S)\*\*|\*(?=\S)([\s\S]*?\S)\*|(?<![\p{L}\p{N}])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}])/u

/** Bold (**), italic (* or _) and both (***) spans, recursively; every other character is text. */
export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  let counter = 0

  while (rest.length > 0) {
    const match = INLINE.exec(rest)
    if (!match) {
      nodes.push(rest)
      break
    }
    if (match.index > 0) {
      nodes.push(rest.slice(0, match.index))
    }
    const key = `${keyPrefix}-${counter}`
    counter += 1
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={key}>
          <em>{renderInline(match[1], key)}</em>
        </strong>,
      )
    } else if (match[2] !== undefined) {
      nodes.push(<strong key={key}>{renderInline(match[2], key)}</strong>)
    } else {
      nodes.push(<em key={key}>{renderInline(match[3] ?? match[4] ?? '', key)}</em>)
    }
    rest = rest.slice(match.index + match[0].length)
  }

  return nodes
}

