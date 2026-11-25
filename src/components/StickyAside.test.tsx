import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StickyAside } from './StickyAside'

function renderAside(height: number) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height)
  render(
    <StickyAside className="grid gap-4" aria-label="Details">
      <p>Panel</p>
    </StickyAside>,
  )
  return screen.getByRole('complementary', { name: 'Details' })
}

describe('StickyAside', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('TC-UI-002-C: stays in view while it fits the window', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    const aside = renderAside(600)

    expect(aside).toHaveClass('grid', 'gap-4', 'min-[1200px]:sticky', 'min-[1200px]:top-5')
  })

  it('TC-UI-002-D: scrolls with the page when taller than the window, leaving no gap above it (ISS-008)', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
    const aside = renderAside(855)

    expect(aside).toHaveClass('grid', 'gap-4')
    expect(aside).not.toHaveClass('min-[1200px]:sticky')
  })
})
