import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { requireProjectAccess, requireProjectMutate } from '@/lib/api/company-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth()

    const { id } = await params
    const admin = createAdminClient()
    await requireProjectAccess(admin, user.id, id)

    const { data, error } = await admin
      .from('projects')
      .select('id, name, address, client_name, user_id, company_name, trade, timezone, created_at')
      .eq('id', id)
      .single()
    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth()

    const projectDeleteRateLimit = checkRateLimit(`projects:${user.id || getClientIp(request)}`, { limit: 10, windowMs: 60 * 1000 })
    if (!projectDeleteRateLimit.success) {
      return rateLimitResponse(projectDeleteRateLimit, 'Премногу барања за проекти. Обидете се повторно наскоро.')
    }

    const { id } = await params
    const admin = createAdminClient()
    await requireProjectMutate(admin, user.id, id)

    const { error } = await admin.from('projects').delete().eq('id', id)
    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
