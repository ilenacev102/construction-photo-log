import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { getCompanyContext, isAdminUser } from '@/lib/api/company-auth'

export async function GET() {
  try {
    const { user } = await requireAuth()

    const admin = createAdminClient()
    const ctx = await getCompanyContext(admin, user.id)

    if (isAdminUser(ctx)) {
      const [users, projects, defects, photos] = await Promise.all([
        admin.from('profiles').select('*', { count: 'exact', head: true }),
        admin.from('projects').select('*', { count: 'exact', head: true }),
        admin.from('defects').select('*', { count: 'exact', head: true }),
        admin.from('photos').select('*', { count: 'exact', head: true }),
      ])
      return successResponse({
        totalUsers: users.count ?? 0,
        totalProjects: projects.count ?? 0,
        totalDefects: defects.count ?? 0,
        totalPhotos: photos.count ?? 0,
      })
    }

    // defects/photos have no user_id column - scope via project_id
    const projectQuery = ctx
      ? admin.from('projects').select('id').in('user_id', ctx.companyUserIds)
      : admin.from('projects').select('id').eq('user_id', user.id)
    const { data: scopedProjects, error: projectError } = await projectQuery
    if (projectError) return errorResponse(projectError.message, 500)
    const projectIds = scopedProjects?.map(p => p.id) ?? []

    const [users, projects, defects, photos] = await Promise.all([
      ctx
        ? admin
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_name', ctx.companyName)
        : admin.from('profiles').select('*', { count: 'exact', head: true }).eq('id', user.id),
      ctx
        ? admin
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .in('user_id', ctx.companyUserIds)
        : admin.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      admin.from('defects').select('*', { count: 'exact', head: true }).in('project_id', projectIds),
      admin.from('photos').select('*', { count: 'exact', head: true }).in('project_id', projectIds),
    ])

    return successResponse({
      totalUsers: users.count ?? 0,
      totalProjects: projects.count ?? 0,
      totalDefects: defects.count ?? 0,
      totalPhotos: photos.count ?? 0,
    })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
