import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { addMemberSchema, removeMemberSchema } from '@/lib/api/schemas'
import { requireProjectAccess } from '@/lib/api/company-auth'

const MEMBER_ROLES = ['photographer', 'foreman', 'site_manager', 'client'] as const

/**
 * Authorize a member-management WRITE (add/remove/change role).
 * Mirrors the project_members RLS management policy and the invite route's
 * role gate: only a site_manager or admin of the owning company may manage
 * members (admins bypass the company match). Anyone with project access may
 * read the member list.
 */
async function assertMemberManageAccess(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  projectId: string,
): Promise<NextResponse | null> {
  const { data: caller } = await admin
    .from('profiles')
    .select('company_name, role')
    .eq('id', userId)
    .single()

  if (!caller) return errorResponse('Профилот не е пронајден.', 404)
  if (caller.role === 'admin') return null
  if (caller.role !== 'site_manager' || !caller.company_name) {
    return errorResponse('Немате дозвола да управувате со членови.', 403)
  }

  const { data: project } = await admin
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()
  if (!project) return errorResponse('Проектот не е пронајден.', 404)

  const { data: owner } = await admin
    .from('profiles')
    .select('company_name')
    .eq('id', project.user_id)
    .single()

  if (owner?.company_name !== caller.company_name) {
    return errorResponse('Немате пристап до овој проект.', 403)
  }
  return null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth()

    const { id } = await params
    const admin = createAdminClient()
    await requireProjectAccess(admin, user.id, id)

    const { data, error } = await admin
      .from('project_members')
      .select('*, profiles(*)')
      .eq('project_id', id)
      .order('created_at', { ascending: true })
    if (error) return errorResponse(error.message, 500)

    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth()

    const { id } = await params
    const admin = createAdminClient()

    const denied = await assertMemberManageAccess(admin, user.id, id)
    if (denied) return denied

    const membersRateLimit = checkRateLimit(`members:${user.id || getClientIp(request)}`, { limit: 10, windowMs: 60 * 1000 })
    if (!membersRateLimit.success) {
      return rateLimitResponse(membersRateLimit, 'Премногу барања за членови. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, addMemberSchema)
    if (validationError) return validationError
    const { userId, role } = body!
    if (!userId || !role) return errorResponse('Missing userId or role')

    const normalizedRole = role as (typeof MEMBER_ROLES)[number]
    if (!MEMBER_ROLES.includes(normalizedRole)) {
      return errorResponse('Невалидна улога.', 400)
    }

    const { data: target } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single()
    if (!target) return errorResponse('Корисникот не е пронајден.', 404)
    if (target.role === 'admin') {
      return errorResponse('Администраторите не може да се додадат како членови.', 400)
    }

    const { data, error } = await admin
      .from('project_members')
      .upsert(
        {
          project_id: id,
          user_id: userId,
          role: normalizedRole,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id, user_id' },
      )
      .select('*, profiles(*)')
      .single()

    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth()

    const { id } = await params
    const admin = createAdminClient()

    const denied = await assertMemberManageAccess(admin, user.id, id)
    if (denied) return denied

    const membersDeleteRateLimit = checkRateLimit(`members:${user.id || getClientIp(request)}`, { limit: 10, windowMs: 60 * 1000 })
    if (!membersDeleteRateLimit.success) {
      return rateLimitResponse(membersDeleteRateLimit, 'Премногу барања за членови. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, removeMemberSchema)
    if (validationError) return validationError
    const { userId } = body!
    if (!userId) return errorResponse('Missing userId')

    const { error } = await admin
      .from('project_members')
      .delete()
      .eq('project_id', id)
      .eq('user_id', userId)
    if (error) return errorResponse(error.message, 500)

    return successResponse({ removed: true })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
