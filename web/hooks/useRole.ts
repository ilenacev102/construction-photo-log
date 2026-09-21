'use client'

import { useUser, type UseRoleReturn } from '@/contexts/UserContext'

export type { UseRoleReturn }

/**
 * Hook to access the current user's role and permissions.
 * Provides shorthand booleans for common permission checks.
 * Calls /api/users proxy to bypass RLS infinite recursion on profiles table.
 *
 * Role hierarchy logic lives in `lib/auth/rbac.ts` — update there only.
 *
 * Data is fetched once at the app level via `UserProvider` — every `useRole()`
 * call reads from the same shared context, eliminating duplicate HTTP requests.
 */
export function useRole(): UseRoleReturn {
  return useUser()
}
