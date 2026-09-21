import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/api/company-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ defectId: string }> },
) {
  try {
    const { user } = await requireAuth()

    const { defectId } = await params
    const admin = createAdminClient()

    const { data: defect, error: defectError } = await admin
      .from('defects')
      .select('project_id')
      .eq('id', defectId)
      .single()

    if (defectError || !defect) return errorResponse('Defect not found', 404)

    await requireProjectAccess(admin, user.id, defect.project_id)

    const { data: links, error: linksError } = await admin
      .from('work_order_defects')
      .select('work_order_id')
      .eq('defect_id', defectId)

    if (linksError) return errorResponse(linksError.message, 500)

    const woIds = (links ?? []).map((l) => l.work_order_id)
    if (woIds.length === 0) return successResponse([])

    const { data: workOrders, error: woError } = await admin
      .from('work_orders')
      .select('id, project_id, title, description, location, assigned_to, assigned_by, priority, status, due_date, created_at, updated_at')
      .in('id', woIds)

    if (woError) return errorResponse(woError.message, 500)
    return successResponse(workOrders ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
