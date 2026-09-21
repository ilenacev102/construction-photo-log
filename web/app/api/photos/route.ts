import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { deletePhotoSchema } from '@/lib/api/schemas'
import { getCompanyContext, isAdminUser, requireProjectAccess, requireProjectMutate } from '@/lib/api/company-auth'
import { getSignedUrls } from '@/lib/storage/signed-url'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

const PHOTO_COLUMNS = 'id, project_id, image_url, thumbnail_path, taken_at, latitude, longitude, note, created_at, user_id'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const MAX_LABEL_SLUGS = 20

function parsePagination(searchParams: URLSearchParams) {
  const parsedLimit = parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10)
  const limit = Math.min(Math.max(1, Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : parsedLimit), MAX_LIMIT)
  const parsedOffset = parseInt(searchParams.get('offset') ?? '0', 10)
  const offset = Math.max(0, Number.isNaN(parsedOffset) ? 0 : parsedOffset)
  return { limit, offset }
}

async function getScopedProjectIds(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string[] | null> {
  const ctx = await getCompanyContext(admin, userId)
  if (isAdminUser(ctx)) return null

  const projectQuery = ctx
    ? admin.from('projects').select('id').in('user_id', ctx.companyUserIds)
    : admin.from('projects').select('id').eq('user_id', userId)

  const { data: scopedProjects, error: projectError } = await projectQuery
  if (projectError) throw new Error(projectError.message)

  let projectIds = scopedProjects?.map((p) => p.id) ?? []
  if (!ctx) {
    const { data: crossAccess } = await admin
      .from('user_permissions')
      .select('permission_key')
      .eq('user_id', userId)
      .ilike('permission_key', 'project.VIEW.%')
      .eq('granted', true)
    const crossProjectIds = crossAccess
      ?.map((p) => p.permission_key.replace('project.VIEW.', ''))
      .filter(Boolean) ?? []
    projectIds = [...new Set([...projectIds, ...crossProjectIds])]
  }
  return projectIds
}

async function getMatchedPhotoIds(
  admin: ReturnType<typeof createAdminClient>,
  labelSlugs: string,
): Promise<string[] | null> {
  const slugs = labelSlugs.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_LABEL_SLUGS)
  const { data: matchedLabels } = await admin.from('labels').select('id').in('slug', slugs)
  if (!matchedLabels || matchedLabels.length === 0) return []

  const labelIds = matchedLabels.map((l) => l.id)
  const { data: taggings } = await admin
    .from('taggings')
    .select('taggable_id')
    .eq('taggable_type', 'photo')
    .in('label_id', labelIds)

  return taggings?.map((t) => t.taggable_id) ?? []
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth()

    const photosRateLimit = checkRateLimit(`photos:${user.id || getClientIp(request)}`, { limit: 60, windowMs: 60 * 1000 })
    if (!photosRateLimit.success) {
      return rateLimitResponse(photosRateLimit, 'Премногу барања за фотографии. Обидете се повторно наскоро.')
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const { limit, offset } = parsePagination(searchParams)
    const admin = createAdminClient()

    let query = admin
      .from('photos')
      .select(PHOTO_COLUMNS)
      .order('taken_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (!projectId) {
      const projectIds = await getScopedProjectIds(admin, user.id)
      if (projectIds !== null) {
        if (projectIds.length === 0) return successResponse([])
        query = query.in('project_id', projectIds)
      }
    } else {
      await requireProjectAccess(admin, user.id, projectId)
      query = query.eq('project_id', projectId)

      const labelSlugs = searchParams.get('labelSlugs')
      if (labelSlugs) {
        const photoIds = await getMatchedPhotoIds(admin, labelSlugs)
        if (!photoIds || photoIds.length === 0) return successResponse([])
        query = query.in('id', photoIds)
      }
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 500)
    const photos = data ?? []
    const client = projectId ? supabase : admin
    // Rows with an empty image_url keep their position with an empty signed
    // URL instead of failing the whole batch inside getSignedUrls.
    const rawPaths = photos.map((p) =>
      typeof p.image_url === 'string' && p.image_url.length > 0 ? p.image_url : null,
    )
    const signedFlat = await getSignedUrls(
      client,
      rawPaths.filter((t): t is string => t !== null),
    )
    let signCursor = 0
    const signedUrls = rawPaths.map((p) => (p !== null ? signedFlat[signCursor++] : ''))
    const thumbPaths = photos.map((p) =>
      typeof p.thumbnail_path === 'string' && p.thumbnail_path.length > 0
        ? p.thumbnail_path
        : null,
    )
    const thumbSignedUrls = await getSignedUrls(
      client,
      thumbPaths.filter((t): t is string => t !== null),
    )
    let thumbCursor = 0
    const signedData = photos.map((photo, i) => {
      const thumbPath = thumbPaths[i]
      const thumbUrl = thumbPath !== null ? thumbSignedUrls[thumbCursor++] : signedUrls[i]
      return {
        ...photo,
        image_url: signedUrls[i],
        thumbnail_url: thumbUrl,
      }
    })
    return successResponse(signedData)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const photosDeleteRateLimit = checkRateLimit(`photos:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!photosDeleteRateLimit.success) {
      return rateLimitResponse(photosDeleteRateLimit, 'Премногу барања за фотографии. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, deletePhotoSchema)
    if (validationError) return validationError
    const { id } = body!
    if (!id) return errorResponse('Missing photo id')

    const admin = createAdminClient()

    const { data: photo } = await admin
      .from('photos')
      .select('project_id')
      .eq('id', id)
      .single()
    if (!photo) return errorResponse('Photo not found', 404)

    await requireProjectMutate(admin, user.id, photo.project_id)

    const { error } = await admin.from('photos').delete().eq('id', id)
    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
