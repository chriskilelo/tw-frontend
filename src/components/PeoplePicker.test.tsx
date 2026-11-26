import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PeoplePicker, type PersonOption } from './PeoplePicker'
import { I18nProvider } from '../i18n/context'

const PEOPLE: PersonOption[] = [
  { id: 'p1', name: 'Amina Wanjiru', detail: 'HQ Trade Officer', group: 'Berlin' },
  { id: 'p2', name: 'Brian Otieno', detail: 'HQ Trade Officer', group: 'Berlin', tags: [{ label: 'Holds the post', tone: 'success' }] },
  { id: 'p3', name: 'Carol Mwangi', detail: 'Director', group: 'London' },
  { id: 'p4', name: 'David Kariuki', detail: 'HQ Trade Officer', group: 'London' },
  { id: 'p5', name: 'Esther Njeri', detail: 'Director of External Trade', group: 'Paris' },
  { id: 'p6', name: 'Frank Ochieng', detail: 'HQ Trade Officer', group: 'Paris' },
]

// I18nProvider reads the signed-in user's language through React Query.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function Harness({
  mode,
  people = PEOPLE,
  onChange = () => {},
  leadLabel,
  isLoading,
}: {
  mode: 'single' | 'multiple'
  people?: PersonOption[]
  onChange?: (ids: string[]) => void
  leadLabel?: string
  isLoading?: boolean
}) {
  const [value, setValue] = useState<string[]>([])
  return (
    <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <PeoplePicker
        label="Choose people"
        description="Pick from the list."
        mode={mode}
        value={value}
        onChange={(ids) => {
          setValue(ids)
          onChange(ids)
        }}
        people={people}
        emptyMessage="Nobody can be chosen yet."
        leadLabel={leadLabel}
        isLoading={isLoading}
      />
    </I18nProvider>
    </QueryClientProvider>
  )
}

describe('PeoplePicker (K-02)', () => {
  it('lists people by name as radio buttons in single mode, grouped and tagged, and returns the chosen id', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness mode="single" onChange={onChange} />)

    const group = screen.getByRole('group', { name: 'Choose people' })
    expect(within(group).getAllByRole('radio')).toHaveLength(6)
    expect(within(group).getByText('Berlin')).toBeInTheDocument()
    expect(within(group).getByText('Holds the post')).toBeInTheDocument()

    await user.click(within(group).getByRole('radio', { name: /Carol Mwangi/ }))
    await user.click(within(group).getByRole('radio', { name: /Esther Njeri/ }))

    expect(onChange).toHaveBeenLastCalledWith(['p5'])
    expect(within(group).getByRole('radio', { name: /Esther Njeri/ })).toBeChecked()
    expect(within(group).getByRole('radio', { name: /Carol Mwangi/ })).not.toBeChecked()
  })

  it('keeps the order people are chosen in multiple mode, marks the lead, and can promote or remove', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness mode="multiple" onChange={onChange} leadLabel="Lead" />)

    await user.click(screen.getByRole('checkbox', { name: /David Kariuki/ }))
    await user.click(screen.getByRole('checkbox', { name: /Amina Wanjiru/ }))
    expect(onChange).toHaveBeenLastCalledWith(['p4', 'p1'])

    const chosen = screen.getByRole('group', { name: 'Selected people' })
    expect(within(chosen).getByText('Lead').parentElement).toHaveTextContent('David Kariuki')

    await user.click(within(chosen).getByRole('button', { name: 'Make Amina Wanjiru the lead' }))
    expect(onChange).toHaveBeenLastCalledWith(['p1', 'p4'])

    await user.click(within(chosen).getByRole('button', { name: 'Remove David Kariuki' }))
    expect(onChange).toHaveBeenLastCalledWith(['p1'])
    expect(screen.getByRole('checkbox', { name: /David Kariuki/ })).not.toBeChecked()
  })

  it('filters by name, role or group and says how many match', async () => {
    const user = userEvent.setup()
    render(<Harness mode="single" />)

    expect(screen.getByText('6 people')).toBeInTheDocument()
    const search = screen.getByRole('searchbox', { name: 'Search: Choose people' })

    await user.type(search, 'london')
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByText('Showing 2 of 6')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'external trade')
    expect(screen.getAllByRole('radio')).toHaveLength(1)

    await user.clear(search)
    await user.type(search, 'nobody here')
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.getByText('Nobody matches your search.')).toBeInTheDocument()
  })

  it('hides the search box for a short list', () => {
    render(<Harness mode="single" people={PEOPLE.slice(0, 3)} />)

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('shows the empty message when nobody is eligible, and a placeholder while loading', () => {
    const { rerender } = render(<Harness mode="single" people={[]} />)
    expect(screen.getByText('Nobody can be chosen yet.')).toBeInTheDocument()

    rerender(<Harness mode="single" people={[]} isLoading />)
    expect(screen.getByRole('list', { name: 'Loading people' })).toBeInTheDocument()
    expect(screen.queryByText('Nobody can be chosen yet.')).not.toBeInTheDocument()
  })
})
