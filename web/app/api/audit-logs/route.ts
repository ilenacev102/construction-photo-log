import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { successResponse, forbiddenResponse } from '@/lib/api/errors'
import { getCompanyContext } from '@/lib/api/company-auth'

// Read-only by design. audit_logs is a compliance trail: rows are written by
// the server itself (users/route.ts, permissions/route.ts) using the
// service-role client, which is why there is no POST handler here — a
// client-supplied `action` would let any session forge history. RLS denies
// direct inserts too (20260801000003).

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
