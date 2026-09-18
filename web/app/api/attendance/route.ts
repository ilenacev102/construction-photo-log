import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import {
  errorResponse,
  successResponse,
  forbiddenResponse,
} from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { attendanceSchema } from '@/lib/api/schemas'
import {
  getAccessibleProjectIds,
  getCompanyContext,
  isAdminUser,
  requireProjectAccess,
  requireProjectMutate,
} from '@/lib/api/company-auth'
import { projectTz, todayStartInTz } from '@/lib/time'

/**
 * Resolve the IANA timezone for a project: projects.timezone ->
 * companies.timezone (of the project owner's company) -> DEFAULT_TZ.
 * Used to anchor the `today=true` filter at start-of-day in the project's
 * own timezone rather than UTC midnight.
 */
async function resolveProjectTz(
  db: SupabaseClient,
  projectId: string,
): Promise<string> {
  const { data: project } = await db
    .from('projects')
    .select('timezone, user_id')
    .eq('id', projectId)
    .single()

  if (project?.timezone) return projectTz(project)

  const { data: profile } = await db
    .from('profiles')
    .select('company_name')
    .eq('id', project?.user_id ?? '')
    .single()

  if (!profile?.company_name) return projectTz(project)

  const { data: company } = await db
    .from('companies')
    .select('timezone')
    .eq('name', profile.company_name)
    .single()

  return projectTz(project, company)
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const today = searchParams.get('today')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)

    const admin = createAdminClient()

    // No projectId → fetch all (admin dashboard)
    if (!projectId) {
      const ctx = await getCompanyContext(admin, user.id)
      let query = admin
        .from('attendance_logs')
        .select('id, project_id, user_id, check_in, check_out, duration_minutes, note, created_at')
        .order('check_in', { ascending: false })
        .limit(limit)
      if (!isAdminUser(ctx)) {
        const projectIds = await getAccessibleProjectIds(admin, user.id, ctx)
        if (projectIds.length === 0) return successResponse([])
        query = query.in('project_id', projectIds) as typeof query
      }
      const { data, error } = await query
      if (error) return errorResponse(error.message, 500)
      return successResponse(data ?? [])
    }

    await requireProjectAccess(admin, user.id, projectId)

    let query = admin
      .from('attendance_logs')
      .select('id, project_id, user_id, check_in, check_out, duration_minutes, note, created_at')
      .eq('project_id', projectId)
      .order('check_in', { ascending: false })
      .limit(limit)

    if (today === 'true') {
      const tz = await resolveProjectTz(admin, projectId)
      query = query.gte('check_in', todayStartInTz(tz).toISOString())
    }

    const { data, error } = await query

    if (error) return errorResponse(error.message, 500)
    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const attendanceRateLimit = checkRateLimit(`attendance:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!attendanceRateLimit.success) {
      return rateLimitResponse(attendanceRateLimit, 'Премногу барања за присутност. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, attendanceSchema)
    if (validationError) return validationError
    const { subAction } = body!

    if (subAction === 'checkIn') {
      const { projectId, note } = body!
      if (!projectId) return errorResponse('Missing projectId')

      const admin = createAdminClient()
      await requireProjectMutate(admin, user.id, projectId)

      const { data, error } = await admin
        .from('attendance_logs')
        .insert({ project_id: projectId, user_id: user.id, note: note ?? '' })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return successResponse(data)
    }

    if (subAction === 'checkOut') {
      const { logId } = body!
      if (!logId) return errorResponse('Missing logId')

      const admin = createAdminClient()

      const { data: existing } = await admin
        .from('attendance_logs')
        .select('project_id, user_id')
        .eq('id', logId)
        .single()

      if (!existing) return errorResponse('Attendance log not found', 404)

      // P2-5 ownership: only the log's owner may check it out. Defense-in-depth
      // — the service-role admin client bypasses RLS ("Users update own
      // check-out"), so the handler must re-assert ownership itself.
      if (existing.user_id !== user.id) {
        return forbiddenResponse('Немате пристап до оваа евиденција')
      }

      await requireProjectMutate(admin, user.id, existing.project_id)

      const { data, error } = await admin
        .from('attendance_logs')
        .update({ check_out: new Date().toISOString() })
        .eq('id', logId)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return successResponse(data)
    }

    return errorResponse('Unknown subAction')
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
