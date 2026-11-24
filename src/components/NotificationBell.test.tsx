import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotificationBell } from './NotificationBell'
import { I18nProvider } from '../i18n/context'
import * as notificationsApi from '../api/notifications'
import type { Notification } from '../api/notifications'

vi.mock('../api/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/notifications')>()
  return { ...actual, listNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }
})

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    recipient_user_id: 'u-1',
    trigger_type: 'directive_issued',
    message: 'New directive from HQ: market brief on avocado exports.',
    link: '/directives/d-42',
    read_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <NotificationBell />
          <Routes>
            <Route path="/dashboard" element={<p>Dashboard page</p>} />
            <Route path="/directives/:id" element={<p>Directive page</p>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.mocked(notificationsApi.listNotifications).mockReset()
    vi.mocked(notificationsApi.markNotificationRead).mockReset().mockResolvedValue(notification({ read_at: 'now' }))
  })

  it('TC-FR-NOTIF-003: a notification opens its record and is marked read', async () => {
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({ items: [notification()], total: 1 })

    renderBell()
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    await userEvent.click(screen.getByRole('link', { name: /market brief on avocado exports/ }))

    expect(await screen.findByText('Directive page')).toBeInTheDocument()
    expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('n-1')
    // The popover closes once the record opens.
    expect(screen.queryByRole('link', { name: /market brief/ })).not.toBeInTheDocument()
  })

  it('TC-FR-NOTIF-003-B: notifications can be opened with the keyboard', async () => {
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({ items: [notification()], total: 1 })

    renderBell()
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    bell.focus()
    await userEvent.keyboard('{Enter}')
    const item = screen.getByRole('link', { name: /market brief on avocado exports/ })
    item.focus()
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByText('Directive page')).toBeInTheDocument()
  })

  it('TC-FR-NOTIF-001: the badge counts every unread notification, not just the page returned', async () => {
    const items = Array.from({ length: 25 }, (_, index) => notification({ id: `n-${index}`, message: `Update ${index}` }))
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({ items, total: 30 })

    renderBell()
    const bell = await screen.findByRole('button', { name: 'Notifications, 30 unread' })
    expect(within(bell).getByText('30')).toBeInTheDocument()

    await userEvent.click(bell)
    expect(screen.getAllByRole('link')).toHaveLength(5)
    expect(screen.getByText('Showing the latest 5 of 30 unread.')).toBeInTheDocument()
  })

  it('TC-FR-NOTIF-003-C: a link that leaves TradeWatch is not followed', async () => {
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      items: [notification({ link: '//example.com/phish', message: 'Odd link' })],
      total: 1,
    })

    renderBell()
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))

    expect(screen.queryByRole('link', { name: /Odd link/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mark read' }))
    expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('n-1')
  })

  it('TC-FR-AUTH-010-F: polls as a background request', async () => {
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({ items: [], total: 0 })

    renderBell()
    await screen.findByRole('button', { name: 'Notifications' })

    expect(notificationsApi.listNotifications).toHaveBeenCalledWith({ read: 0 }, { background: true })
  })
})
