import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createCommentSchema, insertNotificationSchema } from '@/lib/api/schemas'
import { requireProjectAccess } from '@/lib/api/company-auth'
import type { CompanyContext } from '@/lib/api/company-auth'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { extractMentions } from '@/lib/mentions'
import { monitoring } from '@/lib/monitoring'

/**
 * Comments are polymorphic: the URL carries a projectId, but the row that
 * actually gets read/written is keyed by entity_type + entity_id. Resolve the
 * entity's real project so authorization cannot be aimed at a different one.
 */
async function resolveEntityProject(
  admin: ReturnType<typeof createAdminClient>,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  const table = entityType === 'photo' ? 'photos' : entityType === 'defect' ? 'defects' : entityType === 'work_order' ? 'work_orders' : null
  if (!table) return null

  const { data } = await admin
    .from(table)
    .select('project_id')
    .eq('id', entityId)
    .maybeSingle()

  return (data as { project_id: string } | null)?.project_id ?? null
}

/** A mention may only notify someone who can actually reach the project. */
async function mentionableUserIds(
  admin: ReturnType<typeof createAdminClient>,
  candidates: string[],
  projectId: string,
  ctx: CompanyContext | null,
): Promise<string[]> {
  if (ctx?.isAdmin) return candidates
  if (ctx) return candidates.filter((id) => ctx.companyUserIds.includes(id))

  const { data: grants } = await admin
    .from('user_permissions')
    .select('user_id')
    .in('user_id', candidates)
    .eq('permission_key', `project.VIEW.${projectId}`)
    .eq('granted', true)

  return grants?.map((g) => g.user_id) ?? []
}

// GET /api/projects/[id]/comments?entityType=photo&entityId=xxx
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
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return errorResponse('entityType и entityId се задолжителни')
    }

    const entityProjectId = await resolveEntityProject(admin, entityType, entityId)
    if (!entityProjectId || entityProjectId !== projectId) {
      return errorResponse('Ентитетот не припаѓа на овој проект', 404)
    }

    const { data: comments, error } = await admin
      .from('comments')
      .select(`
        *,
        author:profiles!comments_user_id_profiles_fkey(id, full_name, avatar_url)
      `)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })

    if (error) return errorResponse(error.message, 500)

    const topLevel = comments ?? []
    const parentIds = topLevel.map((c) => c.id)

    // Batch-fetch ALL replies in a single query instead of one query per
    // comment (kills the N+1 round-trip pattern).
    const { data: replies, error: repliesError } =
      parentIds.length > 0
        ? await admin
            .from('comments')
            .select(`
              *,
              author:profiles!comments_user_id_profiles_fkey(id, full_name, avatar_url)
            `)
            .in('parent_id', parentIds)
            .order('created_at', { ascending: true })
        : { data: null, error: null }

    if (repliesError) return errorResponse(repliesError.message, 500)

    const repliesByParent = new Map<string, NonNullable<typeof replies>>()
    for (const reply of replies ?? []) {
      const pid = reply.parent_id
      if (!pid) continue
      const list = repliesByParent.get(pid) ?? []
      list.push(reply)
      repliesByParent.set(pid, list)
    }

    const commentsWithReplies = topLevel.map((comment) => ({
      ...comment,
      author: Array.isArray(comment.author) ? comment.author[0] : comment.author,
      replies: (repliesByParent.get(comment.id) ?? []).map((r) => ({
        ...r,
        author: Array.isArray(r.author) ? r.author[0] : r.author,
      })),
    }))

    return successResponse(commentsWithReplies)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

// POST /api/projects/[id]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth()

    // Rate limiting: 30 comments per 60 seconds per user / IP
    const commentsRateLimitKey = `comments:${user.id || getClientIp(request)}`
    const commentsRateLimit = checkRateLimit(commentsRateLimitKey, { limit: 30, windowMs: 60 * 1000 })
    if (!commentsRateLimit.success) {
      return rateLimitResponse(commentsRateLimit, 'Премногу барања за коментари. Обидете се повторно наскоро.')
    }

    const { id: projectId } = await params
    const admin = createAdminClient()
    const { ctx } = await requireProjectAccess(admin, user.id, projectId)

    const { data: parsed, error: validationError } = await validateBody(request, createCommentSchema)
    if (validationError) return validationError
    const { entityType, entityId, body, parentId } = parsed!

    if (!entityType || !entityId || !body?.trim()) {
      return errorResponse('entityType, entityId и body се задолжителни')
    }

    if (!['photo', 'defect', 'work_order'].includes(entityType)) {
      return errorResponse('Невалиден entityType')
    }

    // Authorize against the entity's project, not the URL's: the insert below
    // targets the body-supplied entity, and the admin client bypasses RLS.
    const entityProjectId = await resolveEntityProject(admin, entityType, entityId)
    if (!entityProjectId) return errorResponse('Ентитетот не постои', 404)
    if (entityProjectId !== projectId) {
      return errorResponse('Ентитетот не припаѓа на овој проект', 404)
    }

    // A reply must belong to the same entity, or threading crosses projects.
    if (parentId) {
      const { data: parent } = await admin
        .from('comments')
        .select('entity_type, entity_id')
        .eq('id', parentId)
        .maybeSingle()
      if (!parent || parent.entity_type !== entityType || parent.entity_id !== entityId) {
        return errorResponse('Невалиден parentId', 400)
      }
    }

    // Insert comment
    const { data: comment, error: insertError } = await admin
      .from('comments')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        body: body.trim(),
        parent_id: parentId || null,
      })
      .select()
      .single()

    if (insertError) return errorResponse(insertError.message, 500)

    // Process mentions
    const mentionNames = extractMentions(body)
    if (mentionNames.length > 0) {
      // Find mentioned users by name
      const { data: profiles } = await admin
        .from('profiles')
        .select('id')
        .in('full_name', mentionNames)

      const reachable = profiles
        ? await mentionableUserIds(admin, profiles.map((p) => p.id), projectId, ctx)
        : []

      if (reachable.length > 0) {
        const targets = profiles!.filter((p) => reachable.includes(p.id))

        const mentions = targets.map((p) => ({
          comment_id: comment.id,
          mentioned_user_id: p.id,
        }))

        const { error: mentionError } = await admin.from('comment_mentions').insert(mentions)
        if (mentionError) monitoring.captureException(new Error(mentionError.message), { extra: { route: 'comments', action: 'insertMentions' } })

        // Create notifications for mentioned users
        const notifications = targets
          .filter((p) => p.id !== user.id) // Don't notify yourself
          .map((p) => ({
            user_id: p.id,
            type: 'mention',
            comment_id: comment.id,
          }))

        if (notifications.length > 0) {
          const parsedNotifications = z.array(insertNotificationSchema).safeParse(notifications)
          if (parsedNotifications.success) {
            const { error: notificationError } = await admin.from('notifications').insert(parsedNotifications.data)
            if (notificationError) monitoring.captureException(new Error(notificationError.message), { extra: { route: 'comments', action: 'insertNotifications' } })
          } else {
            monitoring.captureException(parsedNotifications.error, { extra: { route: 'comments', action: 'parseNotifications' } })
          }
        }
      }
    }

    // If this is a reply, notify the parent comment author
    if (parentId) {
      const { data: parentComment } = await admin
        .from('comments')
        .select('user_id')
        .eq('id', parentId)
        .single()

      if (parentComment && parentComment.user_id !== user.id) {
        const parsedNotification = insertNotificationSchema.safeParse({
          user_id: parentComment.user_id,
          type: 'reply',
          comment_id: comment.id,
        })
        if (parsedNotification.success) {
          const { error: replyError } = await admin.from('notifications').insert(parsedNotification.data)
          if (replyError) monitoring.captureException(new Error(replyError.message), { extra: { route: 'comments', action: 'insertReplyNotification' } })
        } else {
          monitoring.captureException(parsedNotification.error, { extra: { route: 'comments', action: 'parseReplyNotification' } })
        }
      }
    }

    // Fetch author data for response
    const { data: author } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', user.id)
      .single()

    return successResponse({
      ...comment,
      author: author ?? { id: user.id, full_name: 'Unknown', avatar_url: null },
    })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
