import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createWorkOrderSchema, updateWorkOrderSchema, deleteWorkOrderSchema } from '@/lib/api/schemas'
import type { WorkOrderStatus } from '@/types/database'
import {
  getAccessibleProjectIds,
  getCompanyContext,
  isAdminUser,
  isProjectManager,
  requireProjectAccess,
  requireProjectManager,
} from '@/lib/api/company-auth'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const statusFilter = searchParams.get('statusFilter')

    const admin = createAdminClient()

    // No projectId → fetch all accessible (admin dashboard, worker "my orders")
    if (!projectId) {
      const ctx = await getCompanyContext(admin, user.id)
      let query = admin
        .from('work_orders')
        .select('id, project_id, title, description, location, assigned_to, priority, status, due_date, created_at')
        .order('created_at', { ascending: false })
      if (!isAdminUser(ctx)) {
        const projectIds = await getAccessibleProjectIds(admin, user.id, ctx)
        if (projectIds.length === 0) return successResponse([])
        query = query.in('project_id', projectIds) as typeof query
      }
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      const assignedTo = searchParams.get('assignedTo')
      if (assignedTo) {
        const assigneeId = assignedTo === 'me' ? user.id : assignedTo
        query = query.eq('assigned_to', assigneeId)
      }
      const { data, error } = await query
      if (error) return errorResponse(error.message, 500)
      return successResponse(data ?? [])
    }

    await requireProjectAccess(admin, user.id, projectId)

    const assignedTo = searchParams.get('assignedTo')

    let query = admin
      .from('work_orders')
      .select('id, project_id, title, description, location, assigned_to, priority, status, due_date, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }
    if (assignedTo) {
      const assigneeId = assignedTo === 'me' ? user.id : assignedTo
      query = query.eq('assigned_to', assigneeId)
    }
    const { data, error } = await query
    if (error) return errorResponse(error.message, 500)
    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const workOrdersRateLimit = checkRateLimit(`work-orders:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!workOrdersRateLimit.success) {
      return rateLimitResponse(workOrdersRateLimit, 'Премногу барања за работни налози. Обидете се повторно наскоро.')
    }

    const admin = createAdminClient()
    const { data: body, error: validationError } = await validateBody(request, createWorkOrderSchema)
    if (validationError) return validationError
    const { project_id, title, description, location, assigned_to, priority, due_date } = body!

    await requireProjectManager(admin, user.id, project_id)

    const { data, error } = await admin
      .from('work_orders')
      .insert({ project_id, title, description, location, assigned_to, priority, due_date, assigned_by: user.id })
      .select()
      .single()
    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const workOrdersPatchRateLimit = checkRateLimit(`work-orders:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!workOrdersPatchRateLimit.success) {
      return rateLimitResponse(workOrdersPatchRateLimit, 'Премногу барања за работни налози. Обидете се повторно наскоро.')
    }

    const admin = createAdminClient()
    const { data: body, error: validationError } = await validateBody(request, updateWorkOrderSchema)
    if (validationError) return validationError
    const { id, status, title, description, location, assigned_to, priority, due_date } = body!

    if (!id) return errorResponse('Missing id')

    const { data: workOrder } = await admin
      .from('work_orders')
      .select('project_id, assigned_to, status')
      .eq('id', id)
      .single()
    if (!workOrder) return errorResponse('Work order not found', 404)

    const isManager = await isProjectManager(admin, user.id, workOrder.project_id)

    // Manager: full rights (any status incl. cancelled, reassign, edit fields) —
    // even when the manager is also the assignee.
    if (isManager) {
      const updates: Record<string, unknown> = {}
      if (status !== undefined) updates.status = status
      if (title !== undefined) updates.title = title
      if (description !== undefined) updates.description = description
      if (location !== undefined) updates.location = location
      if (assigned_to !== undefined) updates.assigned_to = assigned_to
      if (priority !== undefined) updates.priority = priority
      if (due_date !== undefined) updates.due_date = due_date

      const { data, error } = await admin
        .from('work_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) return errorResponse(error.message, 500)
      return successResponse(data)
    }

    // Assignee (non-manager): may only move their own order strictly forward
    // (pending → in_progress → done); never backwards or cancelled.
    if (user.id === workOrder.assigned_to && status !== undefined) {
      const FORWARD: Record<string, WorkOrderStatus | undefined> = {
        pending: 'in_progress',
        in_progress: 'done',
        done: undefined,
        cancelled: undefined,
      }
      if (FORWARD[workOrder.status] !== status) {
        return errorResponse('Само раководител може да го промени статусот на овој начин', 403)
      }
      const { data, error } = await admin
        .from('work_orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
      if (error) return errorResponse(error.message, 500)
      return successResponse(data)
    }

    return errorResponse('Немате пристап до овој налог', 403)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const workOrdersDeleteRateLimit = checkRateLimit(`work-orders:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!workOrdersDeleteRateLimit.success) {
      return rateLimitResponse(workOrdersDeleteRateLimit, 'Премногу барања за работни налози. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, deleteWorkOrderSchema)
    if (validationError) return validationError
    const { id } = body!
    if (!id) return errorResponse('Missing id')

    const admin = createAdminClient()

    const { data: workOrder } = await admin
      .from('work_orders')
      .select('project_id')
      .eq('id', id)
      .single()
    if (!workOrder) return errorResponse('Work order not found', 404)
    await requireProjectManager(admin, user.id, workOrder.project_id)

    const { error } = await admin.from('work_orders').delete().eq('id', id)
    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
