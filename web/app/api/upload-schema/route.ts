import { createServerClient } from '@supabase/ssr'
import { requireProjectMutate } from '@/lib/api/company-auth'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadSchemaSchema, validateFormData } from '@/lib/validation/schemas'
import { monitoring } from '@/lib/monitoring'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    // Rate limiting: 30 uploads per 60 seconds per user / IP
    const rateLimitKey = `upload-schema:${user.id || getClientIp(request)}`
    const rateLimit = checkRateLimit(rateLimitKey, { limit: 30, windowMs: 60 * 1000 })
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit, 'Премногу барања за прикачување шеми. Обидете се повторно наскоро.')
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
    const parsed = validateFormData(uploadSchemaSchema, formData, ['projectId', 'name'])
    if (!parsed.success) {
      return errorResponse(parsed.error)
    }

    const { projectId, name } = parsed.data

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

    const fileExt = file.name.split('.').pop() ?? 'png'
    const fileName = `schemas/${projectId}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await authClient.storage
      .from('construction-photos')
      .upload(fileName, file)

    if (uploadError) {
      monitoring.captureException(uploadError)
      return errorResponse('Внатрешна грешка на серверот.', 500)
    }

    const { data: schema, error: dbError } = await admin
      .from('site_schemas')
      .insert({ project_id: projectId, name, image_url: fileName })
      .select()
      .single()

    if (dbError) {
      monitoring.captureException(dbError)
      return errorResponse('Внатрешна грешка на серверот.', 500)
    }

    return successResponse(schema)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
