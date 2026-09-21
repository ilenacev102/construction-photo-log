import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/api/company-auth'

// DELETE /api/projects/[id]/comments/[commentId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { user } = await requireAuth()

    const commentDeleteRateLimit = checkRateLimit(`comments:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!commentDeleteRateLimit.success) {
      return rateLimitResponse(commentDeleteRateLimit, 'Премногу барања за коментари. Обидете се повторно наскоро.')
    }

    const { id: projectId, commentId } = await params
    const admin = createAdminClient()
    await requireProjectAccess(admin, user.id, projectId)

    // Fetch the comment to check ownership
    const { data: comment, error: fetchError } = await admin
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single()

    if (fetchError || !comment) {
      return errorResponse('Коментарот не е пронајден', 404)
    }

    // Only the comment author or project admin can delete
    if (comment.user_id !== user.id) {
      // Check if user is admin/manager
      const { data: member } = await admin
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single()

      if (!member || !['admin', 'site_manager'].includes(member.role)) {
        return errorResponse('Немате дозвола да го избришете овој коментар', 403)
      }
    }

    // Delete associated mentions first
    await admin.from('comment_mentions').delete().eq('comment_id', commentId)

    // Delete associated notifications
    await admin.from('notifications').delete().eq('comment_id', commentId)

    // Delete the comment
    const { error: deleteError } = await admin
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (deleteError) return errorResponse(deleteError.message, 500)

    return successResponse({ deleted: true })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
