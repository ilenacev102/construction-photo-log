import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createSchemaSchema, updateSchemaSchema, deleteSchemaSchema } from '@/lib/api/schemas'
import { requireProjectAccess, requireProjectMutate } from '@/lib/api/company-auth'
import { getSignedUrls, isProjectSchemaPath } from '@/lib/storage/signed-url'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) return errorResponse('Missing projectId')

    const admin = createAdminClient()
    await requireProjectAccess(admin, user.id, projectId)

    const { data, error } = await admin
      .from('site_schemas')
      .select('id, project_id, name, image_url, width, height, sort_order, created_at')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })

    if (error) return errorResponse(error.message, 500)
    // P1-1: never sign an image_url that does not live in this project's own
    // schema folder (`schemas/{projectId}/...`). Foreign paths are returned as
    // null instead of minting a signed URL for another tenant's object.
    const signable = (data ?? []).filter((schema) =>
      isProjectSchemaPath(schema.image_url, schema.project_id),
    )
    const signablePaths = signable.map((schema) => schema.image_url)
    const signedUrls = signablePaths.length > 0 ? await getSignedUrls(admin, signablePaths) : []
    const urlByPath = new Map(signable.map((schema, i) => [schema.image_url, signedUrls[i]]))
    const signedData = (data ?? []).map((schema) => ({
      ...schema,
      image_url: urlByPath.get(schema.image_url) ?? null,
    }))
    return successResponse(signedData)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const schemasRateLimit = checkRateLimit(`schemas:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!schemasRateLimit.success) {
      return rateLimitResponse(schemasRateLimit, 'Премногу барања за шеми. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, createSchemaSchema)
    if (validationError) return validationError
    const { projectId, name, imageUrl, width, height } = body!
    if (!projectId || !name || !imageUrl) return errorResponse('Missing required fields')
    // P1-1: reject image_url outside the project's own schema folder before
    // it can be persisted (and later signed for another tenant's object).
    if (!isProjectSchemaPath(imageUrl, projectId)) {
      return errorResponse('imageUrl must point to the project schema folder', 400)
    }

    const admin = createAdminClient()
    await requireProjectMutate(admin, user.id, projectId)

    const { data, error } = await admin
      .from('site_schemas')
      .insert({ project_id: projectId, name, image_url: imageUrl, width, height })
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

    const schemasPatchRateLimit = checkRateLimit(`schemas:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!schemasPatchRateLimit.success) {
      return rateLimitResponse(schemasPatchRateLimit, 'Премногу барања за шеми. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, updateSchemaSchema)
    if (validationError) return validationError
    const { id, name, sort_order } = body!
    if (!id) return errorResponse('Missing schema id')

    const admin = createAdminClient()
    const { data: schema } = await admin.from('site_schemas').select('project_id').eq('id', id).single()
    if (!schema) return errorResponse('Schema not found', 404)
    await requireProjectMutate(admin, user.id, schema.project_id)

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (sort_order !== undefined) updates.sort_order = sort_order

    const { data, error } = await admin
      .from('site_schemas')
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

    const schemasDeleteRateLimit = checkRateLimit(`schemas:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!schemasDeleteRateLimit.success) {
      return rateLimitResponse(schemasDeleteRateLimit, 'Премногу барања за шеми. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, deleteSchemaSchema)
    if (validationError) return validationError
    const { id } = body!
    if (!id) return errorResponse('Missing schema id')

    const admin = createAdminClient()
    const { data: schema } = await admin.from('site_schemas').select('project_id').eq('id', id).single()
    if (!schema) return errorResponse('Schema not found', 404)
    await requireProjectMutate(admin, user.id, schema.project_id)

    const { error } = await admin.from('site_schemas').delete().eq('id', id)
    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
