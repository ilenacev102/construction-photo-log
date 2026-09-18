import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'

// PATCH /api/projects/[id]/notifications/[notificationId]/read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notificationId: string }> }
) {
  try {
    const { user } = await requireAuth()

    const projectNotificationsRateLimit = checkRateLimit(`notifications:${user.id || getClientIp(request)}`, { limit: 60, windowMs: 60 * 1000 })
    if (!projectNotificationsRateLimit.success) {
      return rateLimitResponse(projectNotificationsRateLimit, 'Премногу барања за известувања. Обидете се повторно наскоро.')
    }

    const { notificationId } = await params
    const admin = createAdminClient()

    // Verify ownership and update
    const { data, error } = await admin
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    if (!data) return errorResponse('Нотификацијата не е пронајдена', 404)

    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
