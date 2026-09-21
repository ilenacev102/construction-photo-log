import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export type Workspace = 'admin' | 'manager' | 'field' | 'client' | 'pending'

export const workspacePath: Record<Workspace, string> = {
  admin: '/admin',
  manager: '/dashboard/manager',
  field: '/dashboard/worker',
  client: '/projects',
  pending: '/dashboard/pending-access',
}

export function workspaceForRole(role: UserRole | null | undefined): Workspace {
  switch (role) {
    case 'admin': return 'admin'
    case 'site_manager': return 'manager'
    case 'foreman':
    case 'photographer': return 'field'
    case 'client': return 'client'
    default: return 'pending'
  }
}

/** Reads the authenticated user's own profile with the RLS-bound SSR client. */
export async function getCurrentWorkspace() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null, workspace: 'pending' as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile?.role ?? null) as UserRole | null
  return { user, role, workspace: workspaceForRole(role) }
}
