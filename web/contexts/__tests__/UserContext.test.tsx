import { render, renderHook, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { UserProvider, useUser, type UseRoleReturn } from '@/contexts/UserContext'
import { useRole } from '@/hooks/useRole'
import type { Profile } from '@/types/database'

// ── Supabase mock ────────────────────────────────────────────────────────────

type SupabaseMock = ReturnType<typeof createClient>

function makeSupabaseMock(user?: { id: string } | null): SupabaseMock {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: user ?? null },
        error: user ? null : { message: 'not logged in' },
      }),
    },
  } as unknown as SupabaseMock
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => makeSupabaseMock(undefined)),
}))

import { createClient } from '@/lib/supabase/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_PROFILE: Profile = {
  id: 'user-1',
  role: 'admin',
  company_name: 'Acme',
  full_name: 'Ada Lovelace',
  avatar_url: '',
  phone: '',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

function wrapper({ children }: { children: React.ReactNode }): ReactElement {
  return <UserProvider>{children}</UserProvider>
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UserContext / useRole refactored context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no user authenticated
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock(null))
  })

  it('throws when useUser is called outside a Provider', () => {
    expect(() => renderHook(() => useUser())).toThrow(
      'useUser must be used within a <UserProvider>',
    )
  })

  it('starts with isLoading true then resolves to false when unauthenticated', async () => {
    const { result } = renderHook(() => useUser(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.profile).toBeNull()
    expect(result.current.role).toBeNull()
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isManager).toBe(false)
    expect(result.current.isForeman).toBe(false)
    expect(result.current.canWrite).toBe(false)
    expect(result.current.canManage).toBe(false)
  })

  it('fetches profile once and derives all role booleans for an authenticated admin', async () => {
    // Setup: authenticated user + /api/users returns admin profile
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ id: 'user-1' }),
    )

    const profileRes = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: null, data: ADMIN_PROFILE }),
    })
    global.fetch = profileRes as unknown as typeof fetch

    const { result } = renderHook(() => useUser(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Profile
    expect(result.current.profile).toEqual(ADMIN_PROFILE)
    expect(result.current.role).toBe('admin')

    // Role booleans (admin is the highest level)
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isManager).toBe(true)
    expect(result.current.isForeman).toBe(true)
    expect(result.current.canWrite).toBe(true)
    expect(result.current.canManage).toBe(true)

    // /api/users called exactly once
    expect(profileRes).toHaveBeenCalledTimes(1)
    expect(profileRes).toHaveBeenCalledWith(
      '/api/users?userId=user-1',
      { credentials: 'include' },
    )
  })

  it('useRole() thin wrapper returns the same context value as useUser()', async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ id: 'user-1' }),
    )

    const profileRes = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: null, data: ADMIN_PROFILE }),
    })
    global.fetch = profileRes as unknown as typeof fetch

    const { result: userResult } = renderHook(() => useUser(), { wrapper })
    const { result: roleResult } = renderHook(() => useRole(), { wrapper })

    await waitFor(() => {
      expect(userResult.current.isLoading).toBe(false)
    })

    // Both hooks resolve to identical values
    expect(roleResult.current.profile).toEqual(userResult.current.profile)
    expect(roleResult.current.role).toBe(userResult.current.role)
    expect(roleResult.current.isAdmin).toBe(userResult.current.isAdmin)
    expect(roleResult.current.isManager).toBe(userResult.current.isManager)
    expect(roleResult.current.isForeman).toBe(userResult.current.isForeman)
    expect(roleResult.current.canWrite).toBe(userResult.current.canWrite)
    expect(roleResult.current.canManage).toBe(userResult.current.canManage)
  })

  it('multiple consumers share the same fetch (no duplicate HTTP calls)', async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ id: 'user-1' }),
    )

    const profileRes = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: null, data: ADMIN_PROFILE }),
    })
    global.fetch = profileRes as unknown as typeof fetch

    // One provider, three consumers — all read the same context value
    const results: { current: UseRoleReturn[] } = { current: [] }
    function Consumers() {
      results.current = [useRole(), useRole(), useRole()]
      return null
    }

    render(
      <UserProvider>
        <Consumers />
      </UserProvider>,
    )

    await waitFor(() => {
      expect(results.current[0]?.isLoading).toBe(false)
    })

    // All three read the same context; /api/users was fetched once
    expect(profileRes).toHaveBeenCalledTimes(1)
    expect(results.current[1]?.profile).toEqual(ADMIN_PROFILE)
    expect(results.current[2]?.profile).toEqual(ADMIN_PROFILE)
  })

  it('resolves default null booleans when getUser rejects', async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error('network error')),
      },
    } as unknown as ReturnType<typeof createClient>)

    const { result } = renderHook(() => useUser(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.profile).toBeNull()
    expect(result.current.role).toBeNull()
    expect(result.current.isAdmin).toBe(false)
  })
})
