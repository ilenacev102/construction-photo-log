import { NextRequest } from 'next/server'
import { errorResponse, successResponse, forbiddenResponse, notFoundResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { updatePermissionSchema } from '@/lib/api/schemas'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

const PROJECT_VIEW_RE = /^project\.VIEW\.[a-zA-Z0-9-]+$/

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth()

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    const userId = searchParams.get('userId')

    let data

    if (mode === 'role') {
      const result = await supabase.from('role_permissions').select('id, role, permission_key, created_at')
      data = result.data
    } else if (mode === 'effective') {
      const result = await supabase.rpc('get_user_permissions', { target_user_id: user.id })
      data = result.data
    } else if (mode === 'user') {
      const targetUserId = userId ?? user.id

      // Only allow looking up your own permissions, or (for managers/admins)
      // permissions of users in the same company. The RPC is SECURITY DEFINER,
      // so scoping must happen here in the app.
      if (targetUserId !== user.id) {
        const admin = createAdminClient()
        const { data: callerProfile } = await admin
          .from('profiles')
          .select('role, company_name')
          .eq('id', user.id)
          .single()

        const { data: targetProfile } = await admin
          .from('profiles')
          .select('company_name')
          .eq('id', targetUserId)
          .single()

        if (!targetProfile) return notFoundResponse('Корисникот не е пронајден')
        const isAdmin = callerProfile?.role === 'admin'
        if (!isAdmin && targetProfile.company_name !== callerProfile?.company_name) {
          return forbiddenResponse('Немате пристап до дозволите на овој корисник')
        }
      }

      const result = await supabase.rpc('get_user_permissions', { target_user_id: targetUserId })
      data = result.data
    } else {
      const result = await supabase
        .from('permissions')
        .select('key, name, description, category, created_at')
        .order('category', { ascending: true })
        .order('key', { ascending: true })
      data = result.data
    }

    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const permissionsRateLimit = checkRateLimit(`permissions:${user.id || getClientIp(request)}`, { limit: 10, windowMs: 60 * 1000 })
    if (!permissionsRateLimit.success) {
      return rateLimitResponse(permissionsRateLimit, 'Премногу барања за дозволи. Обидете се повторно наскоро.')
    }

    // RLS on profiles allows own-row reads only and audit_logs inserts only
    // via the service role, so the target profile read, the user_permissions
    // upsert, and the audit insert run on the admin client — authorization is
    // enforced below (user.manage RPC + company match).
    const admin = createAdminClient()

    const { data: body, error: validationError } = await validateBody(request, updatePermissionSchema)
    if (validationError) return validationError
    const { userId: targetUserId, permissionKey, granted } = body!

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, company_name')
      .eq('id', user.id)
      .single()
    if (!callerProfile) return forbiddenResponse()

    const isAdmin = callerProfile.role === 'admin'

    const { data: hasPermission, error: rpcError } = await admin.rpc('user_has_permission', {
      target_user_id: user.id,
      perm_key: 'user.manage',
    })
    if (rpcError) return errorResponse(rpcError.message, 500)
    if (!hasPermission) {
      return forbiddenResponse('Немате дозвола за управување со дозволи')
    }

    if (!PROJECT_VIEW_RE.test(permissionKey)) {
      return forbiddenResponse('Дозволено е менување само на project.VIEW.* дозволи')
    }

    const projectId = permissionKey.replace('project.VIEW.', '')

    const { data: project } = await admin
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single()
    if (!project) return notFoundResponse('Проектот не е пронајден')

    if (!isAdmin) {
      const { data: projectOwner } = await admin
        .from('profiles')
        .select('company_name')
        .eq('id', project.user_id)
        .single()
      if (!projectOwner?.company_name || projectOwner.company_name !== callerProfile.company_name) {
        return forbiddenResponse('Проектот не е во вашата компанија')
      }
    }

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('company_name, role')
      .eq('id', targetUserId)
      .single()
    if (!targetProfile) return notFoundResponse('Корисникот не е пронајден')

    if (!isAdmin) {
      if (!callerProfile.company_name) {
        return forbiddenResponse('Немате компанија')
      }
      if (!targetProfile.company_name) {
        return forbiddenResponse('Целниот корисник не е дел од компанија')
      }
      if (callerProfile.company_name !== targetProfile.company_name) {
        return forbiddenResponse('Корисникот не е во вашата компанија')
      }
    }

    if (!isAdmin && targetUserId === user.id) {
      return forbiddenResponse('Не можете сами да си менувате дозволи')
    }

    const { data, error } = await admin
      .from('user_permissions')
      .upsert(
        {
          user_id: targetUserId,
          permission_key: permissionKey,
          granted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, permission_key' }
      )
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)

    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'user.permission.upsert',
      entity_type: 'user_permission',
      entity_id: `${targetUserId}:${permissionKey}`,
      metadata: {
        target_user_id: targetUserId,
        permission_key: permissionKey,
        granted,
        target_company: targetProfile.company_name,
      },
    })

    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
