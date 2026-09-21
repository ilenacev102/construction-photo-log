import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'

// GET /api/notifications — global, user-scoped (for the bell icon)
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const countOnly = searchParams.get('countOnly') === 'true'

    if (countOnly) {
      const { count, error } = await admin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)

      if (error) return errorResponse(error.message, 500)
      return successResponse({ unreadCount: count ?? 0 })
    }

    let query = admin
      .from('notifications')
      .select(`
        *,
        comment:comments(
          id,
          body,
          entity_type,
          entity_id,
          project_id,
          author:profiles!comments_user_id_fkey(full_name)
        )
      `)
      .eq('user_id', user.id)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(30)

    if (error) return errorResponse(error.message, 500)

    // Flatten author data
    const notifications = (data ?? []).map((n) => {
      const comment = Array.isArray(n.comment) ? n.comment[0] : n.comment
      if (comment && Array.isArray(comment.author)) {
        comment.author = comment.author[0]
      }
      return { ...n, comment }
    })

    return successResponse(notifications)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
