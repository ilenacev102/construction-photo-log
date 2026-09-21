import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { linkDefectToWorkOrderSchema } from '@/lib/api/schemas'
import { requireProjectAccess, requireProjectMutate } from '@/lib/api/company-auth'

/**
 * GET /api/work-orders/[workOrderId]/defects
 * Returns all defects linked to this work order.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workOrderId: string }> },
) {
  try {
    const { user } = await requireAuth()

    const { workOrderId } = await params
    const admin = createAdminClient()

    const { data: wo, error: woError } = await admin
      .from('work_orders')
      .select('project_id')
      .eq('id', workOrderId)
      .single()

    if (woError || !wo) return errorResponse('Work order not found', 404)

    await requireProjectAccess(admin, user.id, wo.project_id)

    const { data: links, error: linksError } = await admin
      .from('work_order_defects')
      .select('defect_id')
      .eq('work_order_id', workOrderId)

    if (linksError) return errorResponse(linksError.message, 500)

    const defectIds = (links ?? []).map((l) => l.defect_id)
    if (defectIds.length === 0) return successResponse([])

    const { data: defects, error: defectsError } = await admin
      .from('defects')
      .select('id, project_id, created_by, assigned_to, title, description, severity, status, location, photo_ids, due_date, resolved_at, resolution_notes, created_at, updated_at')
      .in('id', defectIds)

    if (defectsError) return errorResponse(defectsError.message, 500)
    return successResponse(defects ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

/**
 * POST /api/work-orders/[workOrderId]/defects
 * Link a defect to a work order.
 * Body: { defectId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workOrderId: string }> },
) {
  try {
    const { user } = await requireAuth()

    const woLinkRateLimit = checkRateLimit(`wo-links:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!woLinkRateLimit.success) {
      return rateLimitResponse(woLinkRateLimit, 'Премногу барања за врски. Обидете се повторно наскоро.')
    }

    const { workOrderId } = await params
    const admin = createAdminClient()

    const { data: wo, error: woError } = await admin
      .from('work_orders')
      .select('project_id')
      .eq('id', workOrderId)
      .single()

    if (woError || !wo) return errorResponse('Work order not found', 404)

    await requireProjectMutate(admin, user.id, wo.project_id)

    const { data: body, error: validationError } = await validateBody(request, linkDefectToWorkOrderSchema)
    if (validationError) return validationError
    const { defectId } = body!
    if (!defectId) return errorResponse('Missing defectId')

    const { data: defect, error: defectError } = await admin
      .from('defects')
      .select('id')
      .eq('id', defectId)
      .single()

    if (defectError || !defect) return errorResponse('Defect not found', 404)

    const { error: insertError } = await admin
      .from('work_order_defects')
      .upsert(
        { work_order_id: workOrderId, defect_id: defectId },
        { onConflict: 'work_order_id,defect_id' },
      )

    if (insertError) return errorResponse(insertError.message, 500)
    return successResponse({ work_order_id: workOrderId, defect_id: defectId })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

/**
 * DELETE /api/work-orders/[workOrderId]/defects
 * Unlink a defect from a work order.
 * Body: { defectId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workOrderId: string }> },
) {
  try {
    const { user } = await requireAuth()

    const woUnlinkRateLimit = checkRateLimit(`wo-links:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!woUnlinkRateLimit.success) {
      return rateLimitResponse(woUnlinkRateLimit, 'Премногу барања за врски. Обидете се повторно наскоро.')
    }

    const { workOrderId } = await params
    const admin = createAdminClient()

    const { data: wo, error: woError } = await admin
      .from('work_orders')
      .select('project_id')
      .eq('id', workOrderId)
      .single()

    if (woError || !wo) return errorResponse('Work order not found', 404)

    await requireProjectMutate(admin, user.id, wo.project_id)

    const { data: body, error: validationError } = await validateBody(request, linkDefectToWorkOrderSchema)
    if (validationError) return validationError
    const { defectId } = body!
    if (!defectId) return errorResponse('Missing defectId')

    const { error: deleteError } = await admin
      .from('work_order_defects')
      .delete()
      .eq('work_order_id', workOrderId)
      .eq('defect_id', defectId)

    if (deleteError) return errorResponse(deleteError.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
