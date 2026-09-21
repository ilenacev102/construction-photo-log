import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/api/company-auth'

// GET /api/projects/[id]/notifications?unreadOnly=true
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth()

    const { id: projectId } = await params
    const admin = createAdminClient()
    await requireProjectAccess(admin, user.id, projectId)

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    let query = admin
      .from('notifications')
      .select(`
        *,
        comment:comments(
          id,
          body,
          entity_type,
          entity_id,
          author:profiles!comments_user_id_fkey(full_name)
        )
      `)
      .eq('user_id', user.id)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50)

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
