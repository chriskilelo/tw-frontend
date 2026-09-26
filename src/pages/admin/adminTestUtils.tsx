import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MeResponse } from '../../api/auth'
import type { ManagedUser } from '../../api/users'
import { I18nProvider } from '../../i18n/context'

/** Shared fixtures for the ADR-006 administration page tests. */
export function meAs(roleName: string, ministryId: string | null = 'ministry-1'): MeResponse {
  return {
    user: {
      id: 'admin-1',
      full_name: 'Admin Person',
      email: 'admin@sdt.go.ke',
      role_id: 'role-admin',
      mission_id: null,
      ministry_id: ministryId,
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
      ministry: ministryId ? { id: ministryId, name: 'State Department for Trade' } : null,
    },
    role: { id: 'role-admin', name: roleName, layer: '1', scope: ministryId ? 'ministry' : 'platform' },
    permissions: [],
  }
}

export function managedUser(overrides: Partial<ManagedUser> & { roleName?: string } = {}): ManagedUser {
  const { roleName = 'Ministry HQ Officer', ...rest } = overrides
  return {
    id: 'user-1',
    full_name: 'Jane Officer',
    email: 'jane@sdt.go.ke',
    status: 'active',
    role: { id: `role-${roleName}`, name: roleName, display_title: null },
    mission: null,
    ministry: { id: 'ministry-1', name: 'State Department for Trade' },
    home_ministry: null,
    language_preference: 'en',
    last_login_at: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...rest,
  }
}

export function renderAdminPage(path: string, routePath: string, element: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
            <Route path="*" element={<div>Navigated away</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}
