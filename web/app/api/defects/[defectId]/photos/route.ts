import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { updateDefectPhotoSchema } from '@/lib/api/schemas'
import { requireProjectMutate } from '@/lib/api/company-auth'

/**
 * PATCH /api/defects/[defectId]/photos
 *
 * Add or remove photo_ids from a defect.
 * Body: { action: 'add' | 'remove', photoId: string }
 *   - add:    pushes photoId into photo_ids if not already present
 *   - remove: filters photoId out of photo_ids
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ defectId: string }> },
) {
  try {
    const { user } = await requireAuth()

    const defectPhotosRateLimit = checkRateLimit(`defect-photos:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!defectPhotosRateLimit.success) {
      return rateLimitResponse(defectPhotosRateLimit, 'Премногу барања за фотографии на дефекти. Обидете се повторно наскоро.')
    }

    const { defectId } = await params
    const admin = createAdminClient()

    // Fetch defect to get project_id for auth check + current photo_ids
    const { data: defect, error: fetchError } = await admin
      .from('defects')
      .select('project_id, photo_ids')
      .eq('id', defectId)
      .single()

    if (fetchError || !defect) return errorResponse('Defect not found', 404)

    await requireProjectMutate(admin, user.id, defect.project_id)

    const { data: body, error: validationError } = await validateBody(request, updateDefectPhotoSchema)
    if (validationError) return validationError
    const { action, photoId } = body!

    if (!action || !photoId) return errorResponse('Missing action or photoId')
    if (action !== 'add' && action !== 'remove') {
      return errorResponse('action must be "add" or "remove"')
    }

    const currentIds: string[] = defect.photo_ids ?? []
    let updatedIds: string[]

    if (action === 'add') {
      if (currentIds.includes(photoId)) {
        // Already linked — return current state, not an error
        return successResponse({ photo_ids: currentIds })
      }
      updatedIds = [...currentIds, photoId]
    } else {
      updatedIds = currentIds.filter((id) => id !== photoId)
    }

    const { data, error } = await admin
      .from('defects')
      .update({ photo_ids: updatedIds })
      .eq('id', defectId)
      .select('photo_ids')
      .single()

    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
