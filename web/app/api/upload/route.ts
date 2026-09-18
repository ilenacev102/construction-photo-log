import { createServerClient } from '@supabase/ssr'
import { requireProjectMutate } from '@/lib/api/company-auth'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createResponsiveVariants } from '@/lib/image/compress'
import { uploadPhotoSchema, validateFormData } from '@/lib/validation/schemas'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { monitoring } from '@/lib/monitoring'
import { createHash } from 'node:crypto'
import exifr from 'exifr'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    // Rate limiting: 30 uploads per 60 seconds per user / IP
    const rateLimitKey = `upload:${user.id || getClientIp(request)}`
    const rateLimit = checkRateLimit(rateLimitKey, { limit: 30, windowMs: 60 * 1000 })
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit, 'Премногу барања за прикачување слики. Обидете се повторно наскоро.')
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    // Validate file
    if (!file) {
      return errorResponse('Missing file')
    }
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('File too large (max 20 MB)')
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return errorResponse(`Invalid file type: ${file.type}`)
    }

    // Validate form fields with Zod
    const parsed = validateFormData(uploadPhotoSchema, formData, [
      'projectId',
      'note',
      'takenAt',
      'latitude',
      'longitude',
    ])
    if (!parsed.success) {
      return errorResponse(parsed.error)
    }

    const { projectId, note, takenAt, latitude, longitude } = parsed.data

    const admin = createAdminClient()
    await requireProjectMutate(admin, user.id, projectId)

    // Build authenticated client for storage upload
    const cookieStore = await cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              )
            } catch { /* ignore — middleware refreshes sessions */ }
          },
        },
      }
    )

    const imageBuffer = Buffer.from(await file.arrayBuffer())
    const { full: compressed, thumbnail } = await createResponsiveVariants(imageBuffer)
    // Evidence: SHA-256 of the exact stored bytes. Verify recomputes this.
    const contentHash = createHash('sha256').update(compressed).digest('hex')
    const ts = Date.now()
    const fileName = `${user.id}/${projectId}/${ts}.jpg`
    const thumbName = `${user.id}/${projectId}/thumbs/${ts}.jpg`

    // Server-side EXIF is authoritative for capture time and GPS. The client
    // may send its own values, but they are only used as a fallback when the
    // server cannot extract EXIF from the compressed image.
    let serverExif: { takenAt: string | null; latitude: number | null; longitude: number | null } = {
      takenAt: null,
      latitude: null,
      longitude: null,
    }
    try {
      const exifData = await exifr.parse(compressed, {
        exif: true,
        gps: true,
        xmp: false,
        icc: false,
        iptc: false,
        tiff: false,
        interop: false,
      })
      if (exifData) {
        serverExif = {
          takenAt:
            exifData.DateTimeOriginal instanceof Date
              ? exifData.DateTimeOriginal.toISOString()
              : exifData.DateTimeOriginal
                ? new Date(exifData.DateTimeOriginal).toISOString()
                : null,
          latitude: exifData.latitude ?? null,
          longitude: exifData.longitude ?? null,
        }
      }
    } catch {
      // EXIF extraction failure is non-fatal — fall back to client values
    }

    const { error: uploadError } = await authClient.storage
      .from('construction-photos')
      .upload(fileName, compressed, { contentType: 'image/jpeg' })

    if (uploadError) {
      monitoring.captureException(uploadError)
      return errorResponse('Внатрешна грешка на серверот.', 500)
    }

    // Best-effort thumbnail upload — a missing thumbnail only means the
    // read path falls back to the full image (thumbnail_path stays null).
    let thumbUploadOk = false
    const { error: thumbError } = await authClient.storage
      .from('construction-photos')
      .upload(thumbName, thumbnail, { contentType: 'image/jpeg' })
    if (thumbError) {
      monitoring.captureException(thumbError, { extra: { op: 'thumbnail-upload' } })
    } else {
      thumbUploadOk = true
    }

    // Store the storage path, not a public URL.
    // Read routes (photos/route.ts) generate signed URLs on the fly.
    const { data, error: dbError } = await admin
      .from('photos')
      .insert({
        project_id: projectId,
        user_id: user.id,
        image_url: fileName,
        thumbnail_path: thumbUploadOk ? thumbName : null,
        content_hash: contentHash,
        taken_at: serverExif.takenAt ?? (takenAt || null),
        latitude: serverExif.latitude ?? latitude ?? null,
        longitude: serverExif.longitude ?? longitude ?? null,
        note: note || null,
      })
      .select('id')
      .single()

    if (dbError) {
      // DB trigger (enforce_plan_limits) rejects with 403 semantics when the cap is hit
      const status = dbError.message.startsWith('PLAN_LIMIT_EXCEEDED') ? 403 : 500
      // DB insert failed after the upload — remove the objects.
      await authClient.storage.from('construction-photos').remove([fileName, thumbName])
      return errorResponse(dbError.message, status)
    }

    return successResponse({ photoId: data.id })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
