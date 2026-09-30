import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReportMarkdown } from './ReportMarkdown'
import { parseMarkdown } from './markdown'

describe('ReportMarkdown', () => {
  it('TC-FR-RPT-004-C: parses paragraphs, subheadings, both kinds of list and pipe tables', () => {
    const blocks = parseMarkdown('### Overview\nFirst line\nsecond line\n\n- one\n- two\n\n3. third\n4. fourth\n\n| Item | Value |\n| --- | --- |\n| Tea | 12 |')

    expect(blocks).toEqual([
      { type: 'heading', level: 3, text: 'Overview' },
      { type: 'paragraph', lines: ['First line', 'second line'] },
      { type: 'list', ordered: false, start: 1, items: ['one', 'two'] },
      { type: 'list', ordered: true, start: 3, items: ['third', 'fourth'] },
      { type: 'table', header: ['Item', 'Value'], rows: [['Tea', '12']] },
    ])
  })

  it('renders bold, italic, lists and tables as elements, nested under the section heading', () => {
    render(<ReportMarkdown source={'### Findings\n**Bold** and *italic* and ***both***\n\n1. first\n\n| Item | Value |\n| --- | --- |\n| Tea | 12 |'} headingLevel={2} />)

    expect(screen.getByRole('heading', { name: 'Findings', level: 5 })).toBeInTheDocument()
    expect(screen.getByText('Bold').tagName).toBe('STRONG')
    expect(screen.getByText('italic').tagName).toBe('EM')
    expect(screen.getByText('both').closest('strong')).not.toBeNull()
    expect(screen.getByRole('list').tagName).toBe('OL')
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: 'Value' })).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByRole('cell', { name: '12' })).toBeInTheDocument()
  })

  it('never turns typed markup into elements (XSS-safe)', () => {
    const { container } = render(<ReportMarkdown source={'<script>alert(1)</script>\n\n<b>not bold</b> <a href="javascript:alert(1)">x</a>'} />)

    expect(container.querySelector('script, b, a')).toBeNull()
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
  })

  it('leaves snake_case and lone asterisks alone', () => {
    render(<ReportMarkdown source="file_name_here costs 5 * 3" />)

    expect(screen.getByText('file_name_here costs 5 * 3')).toBeInTheDocument()
    expect(document.querySelector('em, strong')).toBeNull()
  })
})
