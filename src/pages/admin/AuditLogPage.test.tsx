import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuditLogPage from './AuditLogPage'
import * as authApi from '../../api/auth'
import * as auditApi from '../../api/audit'
import type { AuditLogEntry } from '../../api/audit'
import { meAs, renderAdminPage } from './adminTestUtils'

vi.mock('../../api/auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/auth')>()), me: vi.fn() }))
vi.mock('../../api/audit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/audit')>()),
  listAuditLogs: vi.fn(),
}))

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'log-1',
    user_id: 'user-1',
    user_full_name: 'Jane Officer',
    user_email: 'jane.officer@tradewatch.go.ke',
    ministry_id: 'ministry-1',
    action: 'alert.updated',
    affected_entity_type: 'App\\Models\\Alert',
    affected_entity_id: 'alert-1234567890',
    changes: null,
    ip_address: '41.76.171.41',
    created_at: '2026-10-04T09:40:04Z',
    ...overrides,
  }
}

const meta = { current_page: 1, per_page: 25, total: 1, last_page: 1 }

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue(meAs('System Administrator', null))
  })

  it('shows the actor\'s name and email, and a System fallback when there is no actor', async () => {
    vi.mocked(auditApi.listAuditLogs).mockReset().mockResolvedValue({
      data: [entry(), entry({ id: 'log-2', user_id: null, user_full_name: null, user_email: null, action: 'user.login.failed' })],
      meta,
    })

    renderAdminPage('/admin/audit-logs', '/admin/audit-logs', <AuditLogPage />)

    expect(await screen.findByText('Jane Officer')).toBeInTheDocument()
    expect(screen.getByText('jane.officer@tradewatch.go.ke')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('shows the full before/after record, highlighting only the field that changed, when the row is expanded', async () => {
    const user = userEvent.setup()
    vi.mocked(auditApi.listAuditLogs).mockReset().mockResolvedValue({
      data: [
        entry({
          changes: {
            before: { sector: 'Agriculture', country: 'Kenya' },
            after: { sector: 'Manufacturing', country: 'Kenya' },
          },
        }),
      ],
      meta,
    })

    renderAdminPage('/admin/audit-logs', '/admin/audit-logs', <AuditLogPage />)

    await screen.findByText('Jane Officer')
    expect(screen.queryByText('Agriculture')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show what changed' }))

    expect(await screen.findByText('Agriculture')).toBeInTheDocument()
    expect(screen.getByText('Manufacturing')).toBeInTheDocument()
    // Unchanged fields are shown on both sides too, not only the ones that differ.
    expect(screen.getAllByText('Kenya')).toHaveLength(2)
    expect(screen.getByText(/41\.76\.171\.41/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide what changed' }))
    expect(screen.queryByText('Agriculture')).not.toBeInTheDocument()
  })

  it('marks a created entry as a new record with no before state', async () => {
    const user = userEvent.setup()
    vi.mocked(auditApi.listAuditLogs).mockReset().mockResolvedValue({
      data: [
        entry({
          action: 'alert.created',
          changes: { before: null, after: { country: 'Kenya' } },
        }),
      ],
      meta,
    })

    renderAdminPage('/admin/audit-logs', '/admin/audit-logs', <AuditLogPage />)

    await screen.findByText('Jane Officer')
    await user.click(screen.getByRole('button', { name: 'Show what changed' }))

    expect(await screen.findByText('Record did not exist before this action.')).toBeInTheDocument()
    expect(screen.getByText('Kenya')).toBeInTheDocument()
  })

  it('renders a flat {field: {from, to}} payload as a field-level diff', async () => {
    const user = userEvent.setup()
    vi.mocked(auditApi.listAuditLogs).mockReset().mockResolvedValue({
      data: [
        entry({
          action: 'user.promoted_to_ps',
          changes: { role_id: { from: 'role-officer', to: 'role-ps' } },
        }),
      ],
      meta,
    })

    renderAdminPage('/admin/audit-logs', '/admin/audit-logs', <AuditLogPage />)

    await screen.findByText('Jane Officer')
    await user.click(screen.getByRole('button', { name: 'Show what changed' }))

    expect(await screen.findByText('role-officer')).toBeInTheDocument()
    expect(screen.getByText('role-ps')).toBeInTheDocument()
  })

  it('shows a no-detail message and the IP for a login attempt with no recorded changes', async () => {
    const user = userEvent.setup()
    vi.mocked(auditApi.listAuditLogs).mockReset().mockResolvedValue({
      data: [entry({ action: 'user.login.succeeded', changes: null })],
      meta,
    })

    renderAdminPage('/admin/audit-logs', '/admin/audit-logs', <AuditLogPage />)

    await screen.findByText('Jane Officer')
    await user.click(screen.getByRole('button', { name: 'Show what changed' }))

    expect(await screen.findByText('No field-level detail was recorded for this action.')).toBeInTheDocument()
    expect(screen.getByText(/41\.76\.171\.41/)).toBeInTheDocument()
  })
})
