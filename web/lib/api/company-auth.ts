import type { SupabaseClient } from '@supabase/supabase-js'

interface CompanyContext {
  companyName: string
  companyUserIds: string[]
  isAdmin: boolean
}

export async function getCompanyContext(
  db: SupabaseClient,
  userId: string,
): Promise<CompanyContext | null> {
  const { data: profile } = await db
    .from('profiles')
    .select('company_name, role')
    .eq('id', userId)
    .single()

  if (!profile?.company_name) return null

  const isAdmin = profile.role === 'admin'

  // Admins bypass all company-scoped checks — return early, no companyUsers needed
  if (isAdmin) {
    return {
      companyName: profile.company_name,
      companyUserIds: [],
      isAdmin: true,
    }
  }

  const { data: companyUsers } = await db
    .from('profiles')
    .select('id')
    .eq('company_name', profile.company_name)

  return {
    companyName: profile.company_name,
    companyUserIds: companyUsers?.map((u) => u.id) ?? [],
    isAdmin: false,
  }
}

export async function hasProjectAccessViaPermission(
  db: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data } = await db
    .from('user_permissions')
    .select('granted')
    .eq('user_id', userId)
    .eq('permission_key', `project.VIEW.${projectId}`)
    .maybeSingle()

  return data?.granted === true
}

export function isAdminUser(ctx: CompanyContext | null): boolean {
  return ctx?.isAdmin === true
}

/**
 * Resolve the project IDs a non-admin user may see in global ("no projectId")
 * queries: their own projects, their company's projects, plus any explicit
 * cross-access grants. Returns [] when the user has no company and no grants —
 * never a free pass.
 */
export async function getAccessibleProjectIds(
  db: SupabaseClient,
  userId: string,
  ctx: CompanyContext | null,
): Promise<string[]> {
  const projectQuery = ctx
    ? db.from('projects').select('id').in('user_id', ctx.companyUserIds)
    : db.from('projects').select('id').eq('user_id', userId)
  const { data: scopedProjects, error: projectError } = await projectQuery
  if (projectError) throw projectError

  let projectIds = scopedProjects?.map((p) => p.id) ?? []

  // Company-less users can only reach projects through explicit grants.
  if (!ctx) {
    const { data: crossAccess } = await db
      .from('user_permissions')
      .select('permission_key')
      .eq('user_id', userId)
      .ilike('permission_key', 'project.VIEW.%')
      .eq('granted', true)
    const crossProjectIds =
      crossAccess
        ?.map((p) => p.permission_key.replace('project.VIEW.', ''))
        .filter(Boolean) ?? []
    projectIds = [...new Set([...projectIds, ...crossProjectIds])]
  }

  return projectIds
}

export async function requireProjectAccess(
  db: SupabaseClient,
  userId: string,
  projectId: string,
  opts?: { allowAdminBypass?: boolean },
): Promise<{ ctx: CompanyContext | null }> {
  const allowAdminBypass = opts?.allowAdminBypass ?? true
  const ctx = await getCompanyContext(db, userId)

  // Only a real admin bypasses the company-scoped check.
  if (ctx?.isAdmin) {
    if (allowAdminBypass) return { ctx }
    throw Object.assign(new Error('Немате пристап до овој проект'), { status: 403 })
  }

  // A null ctx means the user has no company — NOT a free pass. They can
  // access only their own projects or projects granted via user_permissions.
  if (!ctx) {
    const { data: project } = await db
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single()
    if (project?.user_id === userId) return { ctx: null }
    const hasCrossAccess = await hasProjectAccessViaPermission(db, userId, projectId)
    if (hasCrossAccess) return { ctx: null }
    throw Object.assign(new Error('Немате пристап до овој проект'), { status: 403 })
  }

  const { data: project } = await db
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (!project) {
    throw Object.assign(new Error('Немате пристап до овој проект'), { status: 403 })
  }

  const ownerInCompany = ctx.companyUserIds.includes(project.user_id)
  const hasCrossAccess = await hasProjectAccessViaPermission(db, userId, projectId)

  if (!ownerInCompany && !hasCrossAccess) {
    throw Object.assign(new Error('Немате пристап до овој проект'), { status: 403 })
  }

  return { ctx }
}

/**
 * Authorize a WRITE on a project. Stricter than requireProjectAccess:
 * an explicit VIEW grant (project.VIEW.<id> via user_permissions) is NOT
 * sufficient — a user must be the owner, in the owner's company, or an admin.
 * Prevents privilege escalation from read-only cross-access grants (P1-7).
 */
export async function requireProjectMutate(
  db: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<{ ctx: CompanyContext | null }> {
  const ctx = await getCompanyContext(db, userId)

  if (ctx?.isAdmin) return { ctx }

  const { data: project } = await db
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (!project) {
    throw Object.assign(new Error('Немате пристап до овој проект'), { status: 403 })
  }

  if (!ctx) {
    if (project.user_id === userId) return { ctx: null }
    throw Object.assign(new Error('Немате пристап до овој проект'), { status: 403 })
  }

  if (!ctx.companyUserIds.includes(project.user_id)) {
    throw Object.assign(new Error('Немате пристап до овој проект'), { status: 403 })
  }

  return { ctx }
}

/**
 * Manager-gated variant of requireProjectMutate: same company/ownership
 * checks, PLUS the caller must hold a manager role (site_manager | admin).
 * Use for manager-only mutations (create/delete/cancel work orders) where
 * plain project-mutate access (any company member) is too permissive.
 */
export async function requireProjectManager(
  db: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (!profile || !['site_manager', 'admin'].includes(profile.role ?? '')) {
    throw Object.assign(new Error('Само раководител може да го направи ова'), { status: 403 })
  }

  await requireProjectMutate(db, userId, projectId)
}

/** Non-throwing variant: true when the user may manage the project (manager role + access). */
export async function isProjectManager(
  db: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  try {
    await requireProjectManager(db, userId, projectId)
    return true
  } catch {
    return false
  }
}

/**
 * P2-4 defense-in-depth: verify a label group belongs to the caller's company
 * before any labels/label_groups write. RLS already enforces this
 * (20260730000001_create_labels.sql — policies join label_groups -> companies
 * via auth.uid()), so this turns a confused-role client's confusing RLS error
 * into a clean 403. Admins bypass. Throws { status: 403 } when the group is
 * foreign, missing, or the caller has no company.
 */
export async function requireLabelGroupAccess(
  db: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<void> {
  const ctx = await getCompanyContext(db, userId)
  if (ctx?.isAdmin) return

  if (!ctx?.companyName) {
    throw Object.assign(new Error('Немате пристап до групата на етикети.'), { status: 403 })
  }

  const { data: company } = await db
    .from('companies')
    .select('id')
    .eq('name', ctx.companyName)
    .single()

  const { data: group } = await db
    .from('label_groups')
    .select('company_id')
    .eq('id', groupId)
    .single()

  if (!company || !group || group.company_id !== company.id) {
    throw Object.assign(new Error('Немате пристап до групата на етикети.'), { status: 403 })
  }
}
