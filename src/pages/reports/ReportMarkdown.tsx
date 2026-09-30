import type { ReactNode } from 'react'
import { parseMarkdown, renderInline } from './markdown'

function withLineBreaks(text: string, keyPrefix: string): ReactNode[] {
  return text.split('\n').flatMap((line, index) => (index === 0 ? renderInline(line, `${keyPrefix}-${index}`) : [<br key={`${keyPrefix}-br-${index}`} />, ...renderInline(line, `${keyPrefix}-${index}`)]))
}

const HEADING_CLASSES: Record<1 | 2 | 3, string> = {
  1: 'text-h3 text-primary',
  2: 'text-h4 text-primary',
  3: 'text-body font-semibold text-primary',
}

/**
 * FR-RPT-004: renders a narrative section, written in a small Markdown subset — **bold**,
 * *italic*, bulleted (- item) and numbered (1. item) lists, ### headings and basic pipe
 * tables — as React elements. It never builds HTML from the text (no
 * dangerouslySetInnerHTML), so anything an attache types is shown as text, however it looks.
 * Content written before the editor existed is plain paragraphs, which render as-is.
 * `headingLevel` is the HTML level of the section's own title, so subheadings nest beneath it.
 */
export function ReportMarkdown({ source, headingLevel = 2, className = '' }: { source: string; headingLevel?: number; className?: string }) {
  const blocks = parseMarkdown(source)

  return (
    <div className={`flex flex-col gap-3 text-[0.9375rem] leading-relaxed text-text-primary ${className}`}>
      {blocks.map((block, index) => {
        const key = `b${index}`
        switch (block.type) {
          case 'heading': {
            const Tag = `h${Math.min(6, headingLevel + block.level)}` as 'h3' | 'h4' | 'h5' | 'h6'
            return (
              <Tag key={key} className={`${HEADING_CLASSES[block.level]} mt-1`}>
                {renderInline(block.text, key)}
              </Tag>
            )
          }
          case 'list': {
            const items = block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{withLineBreaks(item, `${key}-${itemIndex}`)}</li>)
            return block.ordered ? (
              <ol key={key} start={block.start} className="list-decimal space-y-1 pl-6 marker:text-text-muted">
                {items}
              </ol>
            ) : (
              <ul key={key} className="list-disc space-y-1 pl-6 marker:text-text-muted">
                {items}
              </ul>
            )
          }
          case 'table':
            return (
              <div key={key} className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-body-sm">
                  <thead className="bg-section-bg">
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex} scope="col" className="px-3 py-2 text-left font-semibold text-text-secondary">
                          {renderInline(cell, `${key}-h${cellIndex}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 align-top">
                            {renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          default:
            return (
              <p key={key} className="wrap-break-word">
                {withLineBreaks(block.lines.join('\n'), key)}
              </p>
            )
        }
      })}
    </div>
  )
}
