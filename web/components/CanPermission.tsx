'use client'

import { usePermissions } from '@/hooks/usePermissions'

interface CanPermissionProps {
  /** The permission key to check (e.g. 'photo.upload', 'user.manage') */
  permission: string
  /** Content to render when the user has the permission */
  children: React.ReactNode
  /** Optional fallback to render when the user lacks the permission */
  fallback?: React.ReactNode
}

/**
 * Permission guard component.
 * Renders children only if the current user has the specified permission.
 * Shows fallback (or nothing) when the user lacks permission.
 * Handles loading state gracefully — renders nothing while loading
 * to prevent flash of unauthorized content.
 */
export default function CanPermission({
  permission,
  children,
  fallback = null,
}: CanPermissionProps) {
  const { hasPermission, isLoading } = usePermissions()

  if (isLoading) return null

  if (!hasPermission(permission)) return <>{fallback}</>

  return <>{children}</>
}
