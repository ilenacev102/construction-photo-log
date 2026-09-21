'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAdmin, isManager, isForeman, canWrite, canManage } from '@/lib/auth/rbac'
import type { UserRole, Profile } from '@/types/database'
import { monitoring } from '@/lib/monitoring'

export interface UseRoleReturn {
  profile: Profile | null
  role: UserRole | null
  isLoading: boolean
  isAdmin: boolean
  isManager: boolean
  isForeman: boolean
  canWrite: boolean
  canManage: boolean
}

const UserContext = createContext<UseRoleReturn | null>(null)

/**
 * Provider that fetches the current user's profile once at the app level.
 * All consumers share the same fetch — no duplicate HTTP calls per useRole() site.
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function loadProfile(userId: string) {
      try {
        const res = await fetch(
          `/api/users?userId=${encodeURIComponent(userId)}`,
          { credentials: 'include' },
        )
        const json = await res.json()
        if (cancelled) return
        if (!json.error && json.data) {
          setProfile(json.data as Profile)
        }
      } catch (err) {
        monitoring.captureException(err, { extra: { hook: 'useRole' } })
      }
    }

    supabase.auth
      .getUser()
      .then(async ({ data: { user }, error }) => {
        if (cancelled) return
        if (error || !user) {
          setIsLoading(false)
          return
        }
        await loadProfile(user.id)
        if (!cancelled) setIsLoading(false)
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })

    // Keep session state in sync across tabs and token refreshes. The
    // optional chaining keeps this safe for mocked clients in tests.
    const subscription = supabase.auth.onAuthStateChange?.((event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_OUT' || !session?.user) {
        setProfile(null)
        setIsLoading(false)
        return
      }
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        void loadProfile(session.user.id).then(() => {
          if (!cancelled) setIsLoading(false)
        })
      }
    })

    return () => {
      cancelled = true
      subscription?.data.subscription.unsubscribe()
    }
  }, [])

  const role = profile?.role ?? null

  const value = useMemo<UseRoleReturn>(
    () => ({
      profile,
      role,
      isLoading,
      isAdmin: isAdmin(role),
      isManager: isManager(role),
      isForeman: isForeman(role),
      canWrite: canWrite(role),
      canManage: canManage(role),
    }),
    [profile, role, isLoading],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

/**
 * Read the current user's role/permissions from the app-level context.
 * Throws if used outside a `UserProvider`.
 */
export function useUser(): UseRoleReturn {
  const context = useContext(UserContext)
  if (context === null) {
    throw new Error(
      'useUser must be used within a <UserProvider>. ' +
        'Wrap your component tree with <UserProvider> in the layout.',
    )
  }
  return context
}
