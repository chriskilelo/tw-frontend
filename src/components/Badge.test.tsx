import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders the text label', () => {
    render(<Badge variant="success" label="Acknowledged" />)
    expect(screen.getByText('Acknowledged')).toBeInTheDocument()
  })

  it('always pairs its colour with a non-text icon (CLAUDE.md Rule 9 / WCAG 1.4.1)', () => {
    const { container } = render(<Badge variant="atrisk" label="At risk" />)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('renders a caller-supplied icon instead of the default dot when given one', () => {
    render(<Badge variant="danger" label="Overdue" icon={<span data-testid="custom-icon" />} />)
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })
})
