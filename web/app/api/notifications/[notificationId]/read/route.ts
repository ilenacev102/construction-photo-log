import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'

// PATCH /api/notifications/[notificationId]/read — mark single notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { user } = await requireAuth()

    const notificationsRateLimit = checkRateLimit(`notifications:${user.id || getClientIp(request)}`, { limit: 60, windowMs: 60 * 1000 })
    if (!notificationsRateLimit.success) {
      return rateLimitResponse(notificationsRateLimit, 'Премногу барања за известувања. Обидете се повторно наскоро.')
    }

    const { notificationId } = await params
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    if (!data) return errorResponse('Not found', 404)

    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
