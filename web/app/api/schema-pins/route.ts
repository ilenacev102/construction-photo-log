import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createSchemaPinSchema, deleteSchemaPinSchema } from '@/lib/api/schemas'
import { requireProjectAccess, requireProjectMutate } from '@/lib/api/company-auth'
import { getSignedUrls, isProjectSchemaPath } from '@/lib/storage/signed-url'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

interface SchemaPinWithPhoto {
  id: string
  schema_id: string
  photo_id: string
  x: number
  y: number
  created_at: string
  photos: { image_url: string; taken_at: string | null; note: string | null; user_id: string } | null
}

interface SchemaPinWithSchema {
  id: string
  schema_id: string
  photo_id: string
  x: number
  y: number
  created_at: string
  site_schemas: { name: string | null; image_url: string } | null
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const schemaId = request.nextUrl.searchParams.get('schemaId')
    const photoId = request.nextUrl.searchParams.get('photoId')

    if (schemaId) {
      const admin = createAdminClient()
      const { data: schema } = await admin.from('site_schemas').select('project_id').eq('id', schemaId).single()
      if (!schema) return errorResponse('Schema not found', 404)
      await requireProjectAccess(admin, user.id, schema.project_id)

      const { data, error } = await admin
        .from('schema_photo_pins')
        .select('id, schema_id, photo_id, x, y, created_at, photos(image_url, taken_at, note, user_id)')
        .eq('schema_id', schemaId)
        .order('created_at', { ascending: false })

      if (error) return errorResponse(error.message, 500)
      // Postgrest infers to-one joins as arrays; the API contract is a
      // single object (or null), matching the SchemaPinWithPhoto interface.
      const rows = (data ?? []) as unknown as SchemaPinWithPhoto[]
      const uniquePaths = [...new Set(
        rows.map((pin) => pin.photos?.image_url ?? '').filter((p) => p.length > 0),
      )]
      const signedUrls = uniquePaths.length > 0 ? await getSignedUrls(admin, uniquePaths) : []
      const urlByPath = new Map(uniquePaths.map((p, i) => [p, signedUrls[i]] as const))
      const signedData = rows.map((pin) => ({
        ...pin,
        photos: pin.photos
          ? { ...pin.photos, image_url: urlByPath.get(pin.photos.image_url) ?? pin.photos.image_url }
          : null,
      }))
      return successResponse(signedData)
    }

    if (photoId) {
      const admin = createAdminClient()
      const { data: photo } = await admin.from('photos').select('project_id').eq('id', photoId).single()
      if (!photo) return errorResponse('Photo not found', 404)
      await requireProjectAccess(admin, user.id, photo.project_id)

      const { data, error } = await admin
        .from('schema_photo_pins')
        .select('id, schema_id, photo_id, x, y, created_at, site_schemas(name, image_url)')
        .eq('photo_id', photoId)

      if (error) return errorResponse(error.message, 500)
      // Postgrest infers to-one joins as arrays; the API contract is a
      // single object (or null), matching the SchemaPinWithSchema interface.
      const rows = (data ?? []) as unknown as SchemaPinWithSchema[]
      // P1-1: never sign a schema image_url that lives outside the photo's own
      // project schema folder — foreign paths are returned as null.
      const signablePaths = rows
        .map((pin) =>
          pin.site_schemas &&
          isProjectSchemaPath(pin.site_schemas.image_url, photo.project_id)
            ? pin.site_schemas.image_url
            : '',
        )
        .filter((p) => p.length > 0)
      const uniquePaths = [...new Set(signablePaths)]
      const signedUrls = uniquePaths.length > 0 ? await getSignedUrls(admin, uniquePaths) : []
      const urlByPath = new Map<string, string>()
      ;[...new Set(signablePaths)].forEach((p, i) => urlByPath.set(p, signedUrls[i]))
      const signedData = rows.map((pin) => ({
        ...pin,
        site_schemas: pin.site_schemas
          ? {
              ...pin.site_schemas,
              image_url: urlByPath.get(pin.site_schemas.image_url) ?? null,
            }
          : null,
      }))
      return successResponse(signedData)
    }

    return errorResponse('Missing schemaId or photoId')
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const schemaPinsRateLimit = checkRateLimit(`schema-pins:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!schemaPinsRateLimit.success) {
      return rateLimitResponse(schemaPinsRateLimit, 'Премногу барања за пинови на шеми. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, createSchemaPinSchema)
    if (validationError) return validationError
    const { schemaId, photoId, x, y } = body!
    if (!schemaId || !photoId || x == null || y == null) return errorResponse('Missing required fields')

    const admin = createAdminClient()
    const { data: schema } = await admin.from('site_schemas').select('project_id').eq('id', schemaId).single()
    if (!schema) return errorResponse('Schema not found', 404)
    await requireProjectMutate(admin, user.id, schema.project_id)

    const { data, error } = await admin
      .from('schema_photo_pins')
      .insert({ schema_id: schemaId, photo_id: photoId, x, y })
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

    const schemaPinsDeleteRateLimit = checkRateLimit(`schema-pins:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!schemaPinsDeleteRateLimit.success) {
      return rateLimitResponse(schemaPinsDeleteRateLimit, 'Премногу барања за пинови на шеми. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, deleteSchemaPinSchema)
    if (validationError) return validationError
    const { id } = body!
    if (!id) return errorResponse('Missing pin id')

    const admin = createAdminClient()
    const { data: spp } = await admin.from('schema_photo_pins').select('schema_id').eq('id', id).single()
    if (!spp) return errorResponse('Pin not found', 404)
    const { data: schema } = await admin.from('site_schemas').select('project_id').eq('id', spp.schema_id).single()
    if (!schema) return errorResponse('Schema not found', 404)
    await requireProjectMutate(admin, user.id, schema.project_id)

    const { error } = await admin.from('schema_photo_pins').delete().eq('id', id)
    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
