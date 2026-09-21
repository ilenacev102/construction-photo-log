'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRole } from '@/hooks/useRole'
import type { Permission } from '@/types/database'
import { monitoring } from '@/lib/monitoring'
import { apiGet } from '@/lib/supabase/queries'

interface UsePermissionsReturn {
  permissions: string[]
  allPermissions: Permission[]
  isLoading: boolean
  error: string | null
  hasPermission: (key: string) => boolean
  refresh: () => void
}

async function loadPermissionsData(userId?: string): Promise<{ catalog: Permission[]; userPerms: string[] }> {
  const [catalog, userPerms] = await Promise.all([
    apiGet<Permission[]>('/api/permissions'),
    userId
      ? apiGet<string[]>(`/api/permissions?mode=user&userId=${encodeURIComponent(userId)}`)
      : apiGet<string[]>('/api/permissions?mode=effective'),
  ])
  return { catalog: catalog ?? [], userPerms: userPerms ?? [] }
}

/**
 * Hook to fetch and check effective permissions for a user.
 * When no userId is provided, fetches the current user's effective permissions.
 * When userId is provided, fetches that specific user's granted permissions.
 * Also fetches the full permission catalog for reference.
 */
export function usePermissions(userId?: string): UsePermissionsReturn {
  const { isLoading: roleLoading } = useRole()
  const [permissions, setPermissions] = useState<string[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { catalog, userPerms } = await loadPermissionsData(userId)
      setAllPermissions(catalog)
      setPermissions(userPerms)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions')
      monitoring.captureException(err, { extra: { hook: 'usePermissions', userId } })
      setPermissions([])
      setAllPermissions([])
    }
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    if (roleLoading) return
    let ignore = false
    const run = async () => {
      try {
        const { catalog, userPerms } = await loadPermissionsData(userId)
        if (ignore) return
        setAllPermissions(catalog)
        setPermissions(userPerms)
        setError(null)
      } catch (err) {
        if (ignore) return
        setError(err instanceof Error ? err.message : 'Failed to load permissions')
        monitoring.captureException(err, { extra: { hook: 'usePermissions', userId } })
        setPermissions([])
        setAllPermissions([])
      }
      if (!ignore) setIsLoading(false)
    }
    void run()
    return () => { ignore = true }
  }, [roleLoading, userId])

  const hasPermission = useCallback(
    (key: string): boolean => permissions.includes(key),
    [permissions],
  )

  return { permissions, allPermissions, isLoading, error, hasPermission, refresh }
}
