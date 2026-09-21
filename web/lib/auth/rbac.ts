/**
 * Single source of truth for role-based access control (RBAC).
 *
 * This module is intentionally pure — no Supabase imports, no React hooks,
 * no server-only code.  It can be imported safely from both client components
 * (via `useRole`) and server-side API routes.
 */

import type { UserRole } from '@/types/database'

// ---------------------------------------------------------------------------
// Role hierarchy (numeric level越高 = more privilege)
// ---------------------------------------------------------------------------

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  client: 0,
  photographer: 1,
  foreman: 2,
  site_manager: 3,
  admin: 4,
}

/** All valid role strings, derived from the hierarchy. */
export const VALID_ROLES: UserRole[] = Object.keys(ROLE_HIERARCHY) as UserRole[]

// ---------------------------------------------------------------------------
// Derived permission helpers
// ---------------------------------------------------------------------------

/** Only the top-level admin role. */
export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === 'admin'
}

/** site_manager and above. */
export function isManager(role: UserRole | null | undefined): boolean {
  return role === 'site_manager' || role === 'admin'
}

/** foreman and above. */
export function isForeman(role: UserRole | null | undefined): boolean {
  return role === 'foreman' || role === 'site_manager' || role === 'admin'
}

/** foreman and above can create/edit content. */
export function canWrite(role: UserRole | null | undefined): boolean {
  return isForeman(role)
}

/** site_manager and above can delete/manage users. */
export function canManage(role: UserRole | null | undefined): boolean {
  return isManager(role)
}

// ---------------------------------------------------------------------------
// Hierarchy comparison
// ---------------------------------------------------------------------------

/**
 * Returns the numeric level for a role, or -1 for unknown/undefined.
 */
export function roleLevel(role: UserRole | null | undefined): number {
  if (!role || !(role in ROLE_HIERARCHY)) return -1
  return ROLE_HIERARCHY[role]
}

/**
 * True when `assigner` is allowed to assign `targetRole` according to the
 * hierarchy: an admin may assign any role; a non-admin may only assign a
 * strictly lower-level role.
 */
export function canAssignRole(
  assignerRole: UserRole | null | undefined,
  targetRole: UserRole,
): boolean {
  if (isAdmin(assignerRole)) return true
  const assignerLevel = roleLevel(assignerRole)
  const targetLevel = roleLevel(targetRole)
  return assignerLevel > targetLevel
}
