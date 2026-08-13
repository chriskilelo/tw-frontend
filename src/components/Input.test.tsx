import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('associates its label with the input via htmlFor/id', () => {
    render(<Input label="Country" />)
    expect(screen.getByLabelText('Country')).toBeInTheDocument()
  })

  it('accepts typed input', async () => {
    render(<Input label="Country" />)
    const input = screen.getByLabelText('Country')
    await userEvent.type(input, 'Kenya')
    expect(input).toHaveValue('Kenya')
  })

  it('shows an error message and marks the field invalid', () => {
    render(<Input label="Email address" error="Invalid credentials" />)
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true')
  })
})
