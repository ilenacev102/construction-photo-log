import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createPinSchema, updatePinSchema, deletePinSchema } from '@/lib/api/schemas'
import { requireProjectAccess, requireProjectMutate } from '@/lib/api/company-auth'
import { PIN_UPDATE_FIELDS, filterAllowedFields } from '@/lib/api/field-whitelists'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const searchParams = request.nextUrl.searchParams
    const photoId = searchParams.get('photoId')
    if (!photoId) return errorResponse('Missing photoId')

    const admin = createAdminClient()

    const { data: photo } = await admin
      .from('photos')
      .select('project_id')
      .eq('id', photoId)
      .single()

    if (!photo) return errorResponse('Photo not found', 404)
    await requireProjectAccess(admin, user.id, photo.project_id)

    const { data, error } = await admin
      .from('drawing_pins')
      .select('id, photo_id, user_id, pin_type, x, y, width, height, color, label, drawing_data, created_at, updated_at')
      .eq('photo_id', photoId)
      .order('created_at')

    if (error) return errorResponse(error.message, 500)
    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const pinsRateLimit = checkRateLimit(`pins:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!pinsRateLimit.success) {
      return rateLimitResponse(pinsRateLimit, 'Премногу барања за пинови. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, createPinSchema)
    if (validationError) return validationError
    const { photo_id, pin_type, x, y, width, height, color, label, drawing_data } = body!

    const admin = createAdminClient()

    const { data: photo } = await admin
      .from('photos')
      .select('project_id')
      .eq('id', photo_id)
      .single()

    if (!photo) return errorResponse('Photo not found', 404)
    await requireProjectMutate(admin, user.id, photo.project_id)

    const { data, error } = await admin
      .from('drawing_pins')
      .insert({ photo_id, pin_type, x, y, width, height, color, label, drawing_data, user_id: user.id })
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

    const pinsPatchRateLimit = checkRateLimit(`pins:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!pinsPatchRateLimit.success) {
      return rateLimitResponse(pinsPatchRateLimit, 'Премногу барања за пинови. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, updatePinSchema)
    if (validationError) return validationError
    const { id, ...updates } = body!
    if (!id) return errorResponse('Missing id')

    const admin = createAdminClient()

    const { data: pin } = await admin
      .from('drawing_pins')
      .select('photo_id')
      .eq('id', id)
      .single()

    if (!pin) return errorResponse('Pin not found', 404)

    const { data: photo } = await admin
      .from('photos')
      .select('project_id')
      .eq('id', pin.photo_id)
      .single()

    if (!photo) return errorResponse('Photo not found', 404)
    await requireProjectMutate(admin, user.id, photo.project_id)

    const allowed = filterAllowedFields(updates, PIN_UPDATE_FIELDS)
    if (Object.keys(allowed).length === 0) return errorResponse('No updatable fields provided')

    const { data, error } = await admin
      .from('drawing_pins')
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

    const pinsDeleteRateLimit = checkRateLimit(`pins:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!pinsDeleteRateLimit.success) {
      return rateLimitResponse(pinsDeleteRateLimit, 'Премногу барања за пинови. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, deletePinSchema)
    if (validationError) return validationError
    const { id } = body!
    if (!id) return errorResponse('Missing id')

    const admin = createAdminClient()

    const { data: pin } = await admin
      .from('drawing_pins')
      .select('photo_id')
      .eq('id', id)
      .single()

    if (!pin) return errorResponse('Pin not found', 404)

    const { data: photo } = await admin
      .from('photos')
      .select('project_id')
      .eq('id', pin.photo_id)
      .single()

    if (!photo) return errorResponse('Photo not found', 404)
    await requireProjectMutate(admin, user.id, photo.project_id)

    const { error } = await admin
      .from('drawing_pins')
      .delete()
      .eq('id', id)

    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
