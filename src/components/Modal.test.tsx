import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders its title and content when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Record referral">
        <p>Modal body</p>
      </Modal>,
    )
    expect(screen.getByText('Record referral')).toBeInTheDocument()
    expect(screen.getByText('Modal body')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Record referral">
        <p>Modal body</p>
      </Modal>,
    )
    expect(screen.queryByText('Modal body')).not.toBeInTheDocument()
  })
})
