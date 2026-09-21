import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse, forbiddenResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createAuditLogSchema } from '@/lib/api/schemas'
import { getCompanyContext, requireProjectAccess } from '@/lib/api/company-auth'
import { AUDIT_ACTIONS, ENTITY_TYPES } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const admin = createAdminClient()
    const ctx = await getCompanyContext(admin, user.id)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    const isManager = profile?.role === 'site_manager'

    // Only admin and site_manager can view audit logs
    if (!isAdmin && !isManager) {
      return forbiddenResponse('Немате пристап до логовите на аудитот')
    }

    const { searchParams } = new URL(request.url)
    // Clamp pagination: unbounded limit would pull the whole table into memory.
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 200)
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)
    const actionFilter = searchParams.get('actionFilter')
    const entityFilter = searchParams.get('entityFilter')

    let query = admin
      .from('audit_logs')
      .select('id, project_id, user_id, action, entity_type, entity_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Non-admin managers only see logs from their company. A manager with no
    // company context (null ctx) must NOT fall through to the unscoped query —
    // that would leak every company's audit logs (P2-3).
    if (!isAdmin && !ctx) {
      return successResponse([])
    }
    if (!isAdmin && ctx) {
      query = query.in('user_id', ctx.companyUserIds)
    }

    if (actionFilter) {
      query = query.ilike('action', `${actionFilter}%`)
    }

    if (entityFilter) {
      query = query.eq('entity_type', entityFilter)
    }

    const { data } = await query

    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const auditLogsRateLimit = checkRateLimit(`audit-logs:${user.id || getClientIp(request)}`, { limit: 60, windowMs: 60 * 1000 })
    if (!auditLogsRateLimit.success) {
      return rateLimitResponse(auditLogsRateLimit, 'Премногу барања за ревизија. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, createAuditLogSchema)
    if (validationError) return validationError
    const { projectId, auditAction, entityType, entityId, metadata } = body!

    // Server-side whitelist (P0-2): only the audited actions/entities the app
    // itself can emit are accepted — no client-forged actions.
    if (typeof auditAction !== 'string' || !(AUDIT_ACTIONS as readonly string[]).includes(auditAction)) {
      return errorResponse('Недозволена аудит акција')
    }
    if (typeof entityType !== 'string' || !(ENTITY_TYPES as readonly string[]).includes(entityType)) {
      return errorResponse('Недозволен тип на објект')
    }

    // Cap metadata size — a client can't stuff unbounded payloads into rows
    // that site_manager/admin will later render.
    const MAX_METADATA_BYTES = 8192
    if (metadata !== undefined && metadata !== null) {
      let size = 0
      try {
        size = Buffer.byteLength(JSON.stringify(metadata))
      } catch {
        return errorResponse('Неправилен metadata формат')
      }
      if (size > MAX_METADATA_BYTES) {
        return errorResponse('metadata е преголем')
      }
    }

    const admin = createAdminClient()

    // If the entry references a project, the caller must have access to it.
    if (typeof projectId === 'string' && projectId) {
      try {
        await requireProjectAccess(admin, user.id, projectId)
      } catch {
        return forbiddenResponse('Немате пристап до овој проект')
      }
    }

    const { data, error } = await admin
      .from('audit_logs')
      .insert({
        project_id: projectId ?? null,
        user_id: user.id,
        action: auditAction,
        entity_type: entityType,
        entity_id: entityId ?? null,
        metadata: metadata ?? {},
      })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)

    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
