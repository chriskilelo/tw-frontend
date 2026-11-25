import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NarrativeEditor } from './NarrativeEditor'
import { renderRoute } from './reportTestUtils'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <h2 id="section-heading">Introduction</h2>
      <NarrativeEditor value={value} onChange={setValue} labelledBy="section-heading" />
    </>
  )
}

function renderEditor(initial?: string) {
  renderRoute('/editor', '/editor', <Harness initial={initial} />)
  return screen.getByRole('textbox', { name: 'Introduction' }) as HTMLTextAreaElement
}

describe('NarrativeEditor', () => {
  it('TC-FR-RPT-004-B: a bulleted list on an empty line keeps its marker when you type (ISS-009)', async () => {
    const user = userEvent.setup()
    const editor = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Bulleted list' }))
    await user.keyboard('First point')

    expect(editor.value).toBe('- First point')
  })

  it('TC-FR-RPT-004-C: a numbered list on an empty line keeps its number too', async () => {
    const user = userEvent.setup()
    const editor = renderEditor('Opening line\n')
    editor.setSelectionRange(editor.value.length, editor.value.length)

    await user.click(screen.getByRole('button', { name: 'Numbered list' }))
    await user.keyboard('First step')

    expect(editor.value).toBe('Opening line\n1. First step')
  })
})
