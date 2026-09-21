import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateBody } from '@/lib/api/validate'
import { inviteActionSchema } from '@/lib/api/schemas'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { data: body, error: validationError } = await validateBody(request, inviteActionSchema)
    if (validationError) return validationError
    if (!body) return errorResponse('Невалиден JSON во барањето.')
    const { action } = body

    // ── Authenticate ──
    const cookieStore = await cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              )
            } catch { /* ignore — middleware refreshes sessions */ }
          },
        },
      }
    )

    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData.user) {
      return errorResponse('Немате пристап. Најавете се повторно.', 401)
    }

    const user = userData.user

    // Rate limiting: 10 invites per 60 seconds per user / IP (invite spam protection)
    const rateLimitKey = `invite:${user.id || getClientIp(request)}`
    const rateLimit = checkRateLimit(rateLimitKey, { limit: 10, windowMs: 60 * 1000 })
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit, 'Премногу барања за покани. Обидете се повторно наскоро.')
    }

    const admin = createAdminClient()

    // ── Get inviter's profile and role ──
    const { data: inviterProfile } = await admin
      .from('profiles')
      .select('company_name, role')
      .eq('id', user.id)
      .single()

    if (!inviterProfile?.company_name) {
      return errorResponse('Само корисници со доделена компанија можат да покануваат.', 403)
    }

    // Only site_manager and admin can invite
    if (!['site_manager', 'admin'].includes(inviterProfile.role ?? '')) {
      return errorResponse('Немате дозвола да поканувате корисници.', 403)
    }

    // Only the owning company (or a global admin) may manage a project's invitations
    const assertProjectInviteAccess = async (projectId: string): Promise<NextResponse | null> => {
      const { data: project } = await admin
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single()
      if (!project) return errorResponse('Проектот не е пронајден.', 404)

      if (inviterProfile.role === 'admin') return null

      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('company_name')
        .eq('id', project.user_id)
        .single()

      if (ownerProfile?.company_name !== inviterProfile.company_name) {
        return errorResponse('Немате пристап до овој проект.', 403)
      }
      return null
    }

    switch (action) {
      case 'getAvailableUsers': {
        // List users from OTHER companies that can be invited to a project
        const projectId = body.projectId as string | undefined
        if (!projectId) return errorResponse('Missing projectId')

        const denied = await assertProjectInviteAccess(projectId)
        if (denied) return denied

        // Fetch the project to get its owner's company
        const { data: project } = await admin
          .from('projects')
          .select('user_id')
          .eq('id', projectId)
          .single()
        if (!project) return errorResponse('Проектот не е пронајден.', 404)

        // Get project owner's company
        const { data: ownerProfile } = await admin
          .from('profiles')
          .select('company_name')
          .eq('id', project.user_id)
          .single()

        const projectCompany = ownerProfile?.company_name ?? inviterProfile.company_name

        // Get users from other companies (excluding same-company and already-invited)
        const { data: existingInvites } = await admin
          .from('user_permissions')
          .select('user_id')
          .eq('permission_key', `project.VIEW.${projectId}`)
          .eq('granted', true)

        const invitedIds = new Set(existingInvites?.map(i => i.user_id) ?? [])

        const { data: availableUsers } = await admin
          .from('profiles')
          .select('id, full_name, email, company_name, role')
          .not('company_name', 'eq', projectCompany)
          .not('role', 'eq', 'admin')
          .order('full_name', { ascending: true })

        const filtered = (availableUsers ?? []).filter(p => !invitedIds.has(p.id))

        return successResponse(filtered)
      }

      case 'inviteUser': {
        const { projectId, targetUserId } = body
        if (!projectId || !targetUserId) return errorResponse('Missing projectId or targetUserId')

        const denied = await assertProjectInviteAccess(projectId)
        if (denied) return denied

        // Verify target user is from a different company
        const { data: targetProfile } = await admin
          .from('profiles')
          .select('company_name, full_name, role')
          .eq('id', targetUserId)
          .single()

        if (!targetProfile) return errorResponse('Корисникот не е пронајден.', 404)
        if (targetProfile.role === 'admin') {
          return errorResponse('Администраторите не може да се покануваат.', 400)
        }
        if (targetProfile.company_name === inviterProfile.company_name) {
          return errorResponse('Корисниците од иста компанија веќе имаат пристап.', 400)
        }

        // Create or update the permission
        const { data, error } = await admin
          .from('user_permissions')
          .upsert(
            {
              user_id: targetUserId,
              permission_key: `project.VIEW.${projectId}`,
              granted: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id, permission_key' }
          )
          .select()
          .single()

        if (error) return errorResponse(error.message, 500)

        return successResponse({
          ...data,
          targetName: targetProfile.full_name,
        })
      }

      case 'revokeInvite': {
        const { projectId, targetUserId } = body
        if (!projectId || !targetUserId) return errorResponse('Missing projectId or targetUserId')

        const denied = await assertProjectInviteAccess(projectId)
        if (denied) return denied

        const { error } = await admin
          .from('user_permissions')
          .update({ granted: false, updated_at: new Date().toISOString() })
          .eq('user_id', targetUserId)
          .eq('permission_key', `project.VIEW.${projectId}`)

        if (error) return errorResponse(error.message, 500)
        return successResponse({ revoked: true })
      }

      case 'getInvitations': {
        // List all granted cross-company invitations for a project
        const projectId = body.projectId as string | undefined
        if (!projectId) return errorResponse('Missing projectId')

        const denied = await assertProjectInviteAccess(projectId)
        if (denied) return denied

        const { data, error } = await admin
          .from('user_permissions')
          .select('user_id, created_at, updated_at')
          .eq('permission_key', `project.VIEW.${projectId}`)
          .eq('granted', true)

        if (error) return errorResponse(error.message, 500)

        // Enrich with user details
        const userIds = (data ?? []).map(p => p.user_id)
        if (userIds.length === 0) return successResponse([])

        const { data: profiles } = await admin
          .from('profiles')
          .select('id, full_name, email, company_name')
          .in('id', userIds)

        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

        const enriched = (data ?? []).map(inv => ({
          ...inv,
          profile: profileMap.get(inv.user_id) ?? null,
        }))

        return successResponse(enriched)
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400)
    }
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
