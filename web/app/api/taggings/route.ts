import { NextRequest } from 'next/server'
import { errorResponse, successResponse, forbiddenResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createTaggingSchema } from '@/lib/api/schemas'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { requireProjectAccess, requireProjectMutate } from '@/lib/api/company-auth'
import { createAdminClient } from '@/lib/supabase/admin'

async function resolveTaggableProjectId(
  admin: ReturnType<typeof createAdminClient>,
  type: string,
  id: string,
): Promise<string | null> {
  if (type === 'photo') {
    const { data } = await admin.from('photos').select('project_id').eq('id', id).maybeSingle()
    return data?.project_id ?? null
  }
  if (type === 'defect') {
    const { data } = await admin.from('defects').select('project_id').eq('id', id).maybeSingle()
    return data?.project_id ?? null
  }
  if (type === 'daily_log') {
    const { data } = await admin.from('daily_logs').select('project_id').eq('id', id).maybeSingle()
    return data?.project_id ?? null
  }
  return null
}

const TAGGING_COLUMNS = 'id, taggable_id, taggable_type, label_id, labels(id, name, color, group_id, label_groups(id, name, selection_mode, required))'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const { searchParams } = new URL(request.url)
    const taggableType = searchParams.get('taggable_type')
    const taggableId = searchParams.get('taggable_id')
    const taggableIdsParam = searchParams.get('taggable_ids')

    const rawIds = taggableIdsParam
      ? taggableIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : taggableId
        ? taggableId.split(',').map((s) => s.trim()).filter(Boolean)
        : []

    if (!taggableType || rawIds.length === 0) {
      return errorResponse('taggable_type и taggable_id се задолжителни параметри.')
    }

    // P1-10: taggings have no project_id — scope reads via the taggable's project
    const admin = createAdminClient()
    const projectId = await resolveTaggableProjectId(admin, taggableType, rawIds[0])
    if (!projectId) return errorResponse('Целта не е пронајдена.', 404)
    await requireProjectAccess(admin, user.id, projectId)

    let query = admin
      .from('taggings')
      .select(TAGGING_COLUMNS)
      .eq('taggable_type', taggableType)

    if (rawIds.length === 1) {
      query = query.eq('taggable_id', rawIds[0])
    } else {
      query = query.in('taggable_id', rawIds)
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
    const { user, supabase } = await requireAuth()

    const taggingsRateLimit = checkRateLimit(`taggings:${user.id || getClientIp(request)}`, { limit: 120, windowMs: 60 * 1000 })
    if (!taggingsRateLimit.success) {
      return rateLimitResponse(taggingsRateLimit, 'Премногу барања за ознаки. Обидете се повторно наскоро.')
    }

    // Only foreman, site_manager, and admin can add tags
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['foreman', 'site_manager', 'admin'].includes(profile?.role ?? '')) {
      return forbiddenResponse('Немате дозвола за додавање на етикети.')
    }

    const { data: body, error: validationError } = await validateBody(request, createTaggingSchema)
    if (validationError) return validationError
    const { label_id, taggable_type, taggable_id } = body!

    const admin = createAdminClient()
    const projectId = await resolveTaggableProjectId(admin, taggable_type, taggable_id)
    if (!projectId) return errorResponse('Целта не е пронајдена.', 404)
    await requireProjectMutate(admin, user.id, projectId)

    // Single-mode validation: if the label's group has selection_mode = 'single',
    // remove any existing tagging from that group first
    const { data: label } = await supabase
      .from('labels')
      .select('group_id')
      .eq('id', label_id)
      .single()

    if (!label) {
      return errorResponse('Етикетата не е пронајдена.', 404)
    }

    const { data: group } = await supabase
      .from('label_groups')
      .select('selection_mode')
      .eq('id', label.group_id)
      .single()

    if (group?.selection_mode === 'single') {
      // Get all labels in the same group
      const { data: groupLabels } = await supabase
        .from('labels')
        .select('id')
        .eq('group_id', label.group_id)

      if (groupLabels && groupLabels.length > 0) {
        const groupLabelIds = groupLabels.map((l) => l.id)

        // Find existing taggings for this entity with any label from the same group
        const { data: existingTaggings } = await supabase
          .from('taggings')
          .select('id')
          .eq('taggable_type', taggable_type)
          .eq('taggable_id', taggable_id)
          .in('label_id', groupLabelIds)

        if (existingTaggings && existingTaggings.length > 0) {
          const taggingIds = existingTaggings.map((t) => t.id)
          await supabase.from('taggings').delete().in('id', taggingIds)
        }
      }
    }

    const { data, error } = await supabase
      .from('taggings')
      .insert({ label_id, taggable_type, taggable_id })
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
    const { user, supabase } = await requireAuth()

    const taggingsDeleteRateLimit = checkRateLimit(`taggings:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!taggingsDeleteRateLimit.success) {
      return rateLimitResponse(taggingsDeleteRateLimit, 'Премногу барања за ознаки. Обидете се повторно наскоро.')
    }

    // Only foreman, site_manager, and admin can remove tags
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['foreman', 'site_manager', 'admin'].includes(profile?.role ?? '')) {
      return forbiddenResponse('Немате дозвола за отстранување на етикети.')
    }

    const { data: body, error: validationError } = await validateBody(request, createTaggingSchema)
    if (validationError) return validationError
    const { label_id, taggable_type, taggable_id } = body!

    const admin = createAdminClient()
    const projectId = await resolveTaggableProjectId(admin, taggable_type, taggable_id)
    if (!projectId) return errorResponse('Целта не е пронајдена.', 404)
    await requireProjectMutate(admin, user.id, projectId)

    // Required-group validation: if the label's group has required = true, reject deletion
    const { data: label } = await supabase
      .from('labels')
      .select('group_id')
      .eq('id', label_id)
      .single()

    if (!label) {
      return errorResponse('Етикетата не е пронајдена.', 404)
    }

    const { data: group } = await supabase
      .from('label_groups')
      .select('required')
      .eq('id', label.group_id)
      .single()

    if (group?.required === true) {
      return errorResponse('Не можете да отстраните задолжителна етикета.')
    }

    const { error } = await supabase
      .from('taggings')
      .delete()
      .eq('label_id', label_id)
      .eq('taggable_type', taggable_type)
      .eq('taggable_id', taggable_id)

    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
