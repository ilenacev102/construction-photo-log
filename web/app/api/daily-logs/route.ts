import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { requireProjectAccess, requireProjectMutate } from '@/lib/api/company-auth'
import { DAILY_LOG_UPDATE_FIELDS, filterAllowedFields } from '@/lib/api/field-whitelists'
import { validateBody } from '@/lib/api/validate'
import { createDailyLogSchema, updateDailyLogSchema, deleteDailyLogSchema } from '@/lib/api/schemas'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    if (!projectId) return errorResponse('Missing projectId')

    const admin = createAdminClient()
    await requireProjectAccess(admin, user.id, projectId)

    const labelSlugs = searchParams.get('labelSlugs')

    let query = admin
      .from('daily_logs')
      .select('id, project_id, user_id, log_date, weather, temperature, work_description, notes, created_at')
      .eq('project_id', projectId)
      .order('log_date', { ascending: false })

    if (labelSlugs) {
      const slugs = labelSlugs.split(',').map((s) => s.trim()).filter(Boolean)
      const { data: matchedLabels } = await admin
        .from('labels')
        .select('id')
        .in('slug', slugs)
      if (matchedLabels && matchedLabels.length > 0) {
        const labelIds = matchedLabels.map((l) => l.id)
        const { data: taggings } = await admin
          .from('taggings')
          .select('taggable_id')
          .eq('taggable_type', 'daily_log')
          .in('label_id', labelIds)
        if (taggings && taggings.length > 0) {
          const logIds = taggings.map((t) => t.taggable_id)
          query = query.in('id', logIds)
        } else {
          return successResponse([])
        }
      } else {
        return successResponse([])
      }
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

    const dailyLogsRateLimit = checkRateLimit(`daily-logs:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!dailyLogsRateLimit.success) {
      return rateLimitResponse(dailyLogsRateLimit, 'Премногу барања за дневни извештаи. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, createDailyLogSchema)
    if (validationError) return validationError
    const { project_id, log_date, work_description, weather, temperature, notes } = body!

    const admin = createAdminClient()
    await requireProjectMutate(admin, user.id, project_id)

    const { data, error } = await admin
      .from('daily_logs')
      .insert({ project_id, log_date, work_description, weather, temperature, notes, user_id: user.id })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const dailyLogsPatchRateLimit = checkRateLimit(`daily-logs:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!dailyLogsPatchRateLimit.success) {
      return rateLimitResponse(dailyLogsPatchRateLimit, 'Премногу барања за дневни извештаи. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, updateDailyLogSchema)
    if (validationError) return validationError
    const { id, updates } = body!
    if (!id || !updates) return errorResponse('Missing id or updates')

    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('daily_logs')
      .select('project_id')
      .eq('id', id)
      .single()

    if (!existing) return errorResponse('Daily log not found', 404)
    await requireProjectMutate(admin, user.id, existing.project_id)

    const allowed = filterAllowedFields(updates, DAILY_LOG_UPDATE_FIELDS)
    if (Object.keys(allowed).length === 0) return errorResponse('No updatable fields provided')

    const { data, error } = await admin
      .from('daily_logs')
      .update(allowed)
      .eq('id', id)
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const dailyLogsDeleteRateLimit = checkRateLimit(`daily-logs:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!dailyLogsDeleteRateLimit.success) {
      return rateLimitResponse(dailyLogsDeleteRateLimit, 'Премногу барања за дневни извештаи. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, deleteDailyLogSchema)
    if (validationError) return validationError
    const { id } = body!
    if (!id) return errorResponse('Missing id')

    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('daily_logs')
      .select('project_id')
      .eq('id', id)
      .single()

    if (!existing) return errorResponse('Daily log not found', 404)
    await requireProjectMutate(admin, user.id, existing.project_id)

    const { error } = await admin
      .from('daily_logs')
      .delete()
      .eq('id', id)

    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
