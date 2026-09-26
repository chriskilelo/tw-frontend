import { useQuery } from '@tanstack/react-query'
import { me, type MeResponse } from '../api/auth'

export const AUTH_QUERY_KEY = ['me'] as const

/**
 * Reads GET /api/v1/me from the React Query cache (CLAUDE.md Section 10, TDD-ADR-002
 * Sanctum SPA session). Session 20's AppLayout, NotificationBell, and role-based
 * navigation all read the current user through this hook rather than re-fetching.
 */
export function useAuth() {
  const query = useQuery<MeResponse>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: me,
    retry: false,
  })

  return {
    user: query.data?.user ?? null,
    role: query.data?.role ?? null,
    permissions: query.data?.permissions ?? [],
    isLoading: query.isLoading,
    isAuthenticated: !query.isError && Boolean(query.data),
    refetch: query.refetch,
  }
}

/** CLAUDE.md Section 4 Rule 2 / BR-020: the four structurally read-only mission governance roles. */
export const READ_ONLY_ROLE_NAMES = [
  'Head of Mission',
  'Deputy Head of Mission',
  'MFA HQ Officer',
  'MFA Principal Secretary',
] as const

export function isReadOnlyRole(roleName: string | undefined | null): boolean {
  if (!roleName) {
    return false
  }
  return (READ_ONLY_ROLE_NAMES as readonly string[]).includes(roleName)
}

/**
 * ADR-006: the two administrator roles. Compared by role name, never by the cosmetic
 * display title (FR-AUTH-025), which is free to change without affecting access.
 */
export const SYSTEM_ADMINISTRATOR = 'System Administrator'
export const MINISTRY_ADMINISTRATOR = 'Ministry Administrator'

export function isSystemAdministrator(roleName: string | undefined | null): boolean {
  return roleName === SYSTEM_ADMINISTRATOR
}

export function isMinistryAdministrator(roleName: string | undefined | null): boolean {
  return roleName === MINISTRY_ADMINISTRATOR
}
