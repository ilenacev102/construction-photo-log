import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse, forbiddenResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createProjectSchema } from '@/lib/api/schemas'
import { getCompanyContext, isAdminUser } from '@/lib/api/company-auth'

export async function GET() {
  try {
    const { user } = await requireAuth()

    const admin = createAdminClient()

    const ctx = await getCompanyContext(admin, user.id)

    if (isAdminUser(ctx)) {
      const { data, error } = await admin
        .from('projects')
        .select('id, name, address, client_name, user_id, company_name, trade, timezone, created_at')
        .order('created_at', { ascending: false })
      if (error) return errorResponse(error.message, 500)
      return successResponse(data ?? [])
    }

    const projectQuery = ctx
      ? admin.from('projects').select('id, name, address, client_name, user_id, company_name, trade, timezone, created_at').in('user_id', ctx.companyUserIds)
      : admin.from('projects').select('id, name, address, client_name, user_id, company_name, trade, timezone, created_at').eq('user_id', user.id)

    const { data, error } = await projectQuery.order('created_at', { ascending: false })
    if (error) return errorResponse(error.message, 500)

    const { data: crossAccess } = await admin
      .from('user_permissions')
      .select('permission_key')
      .eq('user_id', user.id)
      .ilike('permission_key', 'project.VIEW.%')
      .eq('granted', true)
    const crossProjectIds = crossAccess
      ?.map(p => p.permission_key.replace('project.VIEW.', ''))
      .filter(Boolean) ?? []

    if (crossProjectIds.length > 0) {
      const { data: crossProjects } = await admin
        .from('projects')
        .select('id, name, address, client_name, user_id, company_name, trade, timezone, created_at')
        .in('id', crossProjectIds)
        .order('created_at', { ascending: false })
      const existingIds = new Set(data?.map(p => p.id) ?? [])
      const merged = [...(data ?? [])]
      for (const cp of crossProjects ?? []) {
        if (!existingIds.has(cp.id)) merged.push(cp)
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return successResponse(merged)
    }

    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const projectsRateLimit = checkRateLimit(`projects:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!projectsRateLimit.success) {
      return rateLimitResponse(projectsRateLimit, 'Премногу барања за проекти. Обидете се повторно наскоро.')
    }

    const admin = createAdminClient()
    const ctx = await getCompanyContext(admin, user.id)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    // Project ownership establishes company-wide scope. It must never be
    // created by a client or field user merely because the UI hides the button.
    if (!isAdminUser(ctx) && profile?.role !== 'site_manager' && profile?.role !== 'admin') {
      return forbiddenResponse('Немате дозвола за креирање проекти')
    }
    const { data: body, error: validationError } = await validateBody(request, createProjectSchema)
    if (validationError) return validationError
    const { name, address, client_name } = body!

    const { data, error } = await admin
      .from('projects')
      .insert({ name, address, client_name, user_id: user.id })
      .select()
      .single()
    if (error) {
      // DB trigger (enforce_plan_limits) rejects with 403 semantics when the cap is hit
      const status = error.message.startsWith('PLAN_LIMIT_EXCEEDED') ? 403 : 500
      return errorResponse(error.message, status)
    }
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
