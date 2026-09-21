import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { getCompanyContext, requireProjectAccess, isAdminUser } from '@/lib/api/company-auth'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const admin = createAdminClient()
    const projectId = request.nextUrl.searchParams.get('projectId')

    if (projectId) {
      await requireProjectAccess(admin, user.id, projectId)

      const { data: project } = await admin
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single()

      if (!project) return errorResponse('Project not found', 404)

      const { data: owner } = await admin
        .from('profiles')
        .select('id, role, company_name, full_name, avatar_url, phone, created_at, updated_at')
        .eq('id', project.user_id)
        .single()

      if (!owner?.company_name) return successResponse(owner ? [owner] : [])

      const { data: team } = await admin
        .from('profiles')
        .select('id, role, company_name, full_name, avatar_url, phone, created_at, updated_at')
        .eq('company_name', owner.company_name)

      return successResponse(team ?? [])
    }

    const ctx = await getCompanyContext(admin, user.id)

    if (isAdminUser(ctx)) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, role, company_name, full_name, avatar_url, phone, created_at, updated_at')
        .not('role', 'in', '("admin","site_manager")')
        .order('created_at', { ascending: false })

      if (error) return errorResponse(error.message, 500)
      return successResponse(data ?? [])
    }

    if (!ctx) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, role, company_name, full_name, avatar_url, phone, created_at, updated_at')
        .eq('id', user.id)

      if (error) return errorResponse(error.message, 500)
      return successResponse(data ?? [])
    }

    const { data, error } = await admin
      .from('profiles')
      .select('id, role, company_name, full_name, avatar_url, phone, created_at, updated_at')
      .not('role', 'in', '("admin","site_manager")')
      .eq('company_name', ctx.companyName)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 500)
    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
