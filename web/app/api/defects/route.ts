import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createDefectSchema, updateDefectSchema, deleteDefectSchema } from '@/lib/api/schemas'
import {
  getAccessibleProjectIds,
  getCompanyContext,
  isAdminUser,
  requireProjectAccess,
  requireProjectMutate,
} from '@/lib/api/company-auth'

const DEFECT_COLUMNS = 'id, project_id, created_by, assigned_to, title, description, severity, status, location, photo_ids, due_date, resolved_at, resolution_notes, created_at, updated_at'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function parsePagination(searchParams: URLSearchParams) {
  const parsedLimit = parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10)
  const limit = Math.min(Math.max(1, Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : parsedLimit), MAX_LIMIT)
  const parsedOffset = parseInt(searchParams.get('offset') ?? '0', 10)
  const offset = Math.max(0, Number.isNaN(parsedOffset) ? 0 : parsedOffset)
  return { limit, offset }
}

async function getMatchedDefectIds(
  admin: ReturnType<typeof createAdminClient>,
  labelSlugs: string,
): Promise<string[] | null> {
  const slugs = labelSlugs.split(',').map((s) => s.trim()).filter(Boolean)
  const { data: matchedLabels } = await admin.from('labels').select('id').in('slug', slugs)
  if (!matchedLabels || matchedLabels.length === 0) return []

  const labelIds = matchedLabels.map((l) => l.id)
  const { data: taggings } = await admin
    .from('taggings')
    .select('taggable_id')
    .eq('taggable_type', 'defect')
    .in('label_id', labelIds)

  return taggings?.map((t) => t.taggable_id) ?? []
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const statusFilter = searchParams.get('statusFilter')
    const { limit, offset } = parsePagination(searchParams)
    const admin = createAdminClient()

    let query = admin
      .from('defects')
      .select(DEFECT_COLUMNS)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (!projectId) {
      const ctx = await getCompanyContext(admin, user.id)
      if (!isAdminUser(ctx)) {
        const projectIds = await getAccessibleProjectIds(admin, user.id, ctx)
        if (projectIds.length === 0) return successResponse([])
        query = query.in('project_id', projectIds) as typeof query
      }
    } else {
      await requireProjectAccess(admin, user.id, projectId)
      query = query.eq('project_id', projectId)

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const labelSlugs = searchParams.get('labelSlugs')
      if (labelSlugs) {
        const defectIds = await getMatchedDefectIds(admin, labelSlugs)
        if (!defectIds || defectIds.length === 0) return successResponse([])
        query = query.in('id', defectIds)
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

    const defectsRateLimit = checkRateLimit(`defects:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!defectsRateLimit.success) {
      return rateLimitResponse(defectsRateLimit, 'Премногу барања за дефекти. Обидете се повторно наскоро.')
    }

    const admin = createAdminClient()
    const { data: body, error: validationError } = await validateBody(request, createDefectSchema)
    if (validationError) return validationError
    const { project_id, title, description, severity, assigned_to, location, photo_ids } = body!

    await requireProjectMutate(admin, user.id, project_id)

    const { data, error } = await admin
      .from('defects')
      .insert({ project_id, title, description, severity, assigned_to, location, photo_ids, created_by: user.id })
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

    const defectsPatchRateLimit = checkRateLimit(`defects:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!defectsPatchRateLimit.success) {
      return rateLimitResponse(defectsPatchRateLimit, 'Премногу барања за дефекти. Обидете се повторно наскоро.')
    }

    const admin = createAdminClient()
    const { data: body, error: validationError } = await validateBody(request, updateDefectSchema)
    if (validationError) return validationError
    const { id, status, resolutionNotes } = body!

    if (!id || !status) return errorResponse('Missing id or status')

    const { data: defect } = await admin
      .from('defects')
      .select('project_id')
      .eq('id', id)
      .single()
    if (!defect) return errorResponse('Defect not found', 404)
    await requireProjectMutate(admin, user.id, defect.project_id)

    const updates: Record<string, unknown> = { status }
    if (status === 'resolved' || status === 'closed') {
      updates.resolved_at = new Date().toISOString()
      if (resolutionNotes) updates.resolution_notes = resolutionNotes
    }
    const { data, error } = await admin
      .from('defects')
      .update(updates)
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

    const defectsDeleteRateLimit = checkRateLimit(`defects:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!defectsDeleteRateLimit.success) {
      return rateLimitResponse(defectsDeleteRateLimit, 'Премногу барања за дефекти. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, deleteDefectSchema)
    if (validationError) return validationError
    const { id } = body!
    if (!id) return errorResponse('Missing id')

    const admin = createAdminClient()

    const { data: defect } = await admin
      .from('defects')
      .select('project_id')
      .eq('id', id)
      .single()
    if (!defect) return errorResponse('Defect not found', 404)
    await requireProjectMutate(admin, user.id, defect.project_id)

    const { error } = await admin.from('defects').delete().eq('id', id)
    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
