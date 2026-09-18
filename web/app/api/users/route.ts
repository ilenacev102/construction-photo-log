import { NextRequest } from 'next/server'
import { errorResponse, successResponse, forbiddenResponse, notFoundResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { updateUserRoleSchema } from '@/lib/api/schemas'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { VALID_ROLES, isAdmin as isAdminRole, canAssignRole } from '@/lib/auth/rbac'
import type { UserRole } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    // profiles RLS allows own-row reads only (admins read all), so company
    // roster and same-company lookups run on the admin client — authorization
    // is enforced below (admin bypass or same-company match).
    const admin = createAdminClient()

    const userId = request.nextUrl.searchParams.get('userId')

    // Single profile lookup — used by useRole hook
    if (userId) {
      // Only allow looking up own profile or profiles in the same company
      if (userId !== user.id) {
        const { data: callerProfile } = await admin
          .from('profiles')
          .select('role, company_name')
          .eq('id', user.id)
          .single()

        const isAdmin = callerProfile?.role === 'admin'
        // Non-admin users (including users without a company) can only see
        // profiles in their company
        if (!isAdmin) {
          const { data: targetProfile } = await admin
            .from('profiles')
            .select('company_name')
            .eq('id', userId)
            .single()
          if (!targetProfile || targetProfile.company_name !== callerProfile?.company_name) {
            return forbiddenResponse('Немате пристап до овој корисник')
          }
        }
      }

      const { data, error } = await admin
        .from('profiles')
        .select('id, role, company_name, full_name, avatar_url, phone, created_at, updated_at')
        .eq('id', userId)
        .single()
      if (error) return errorResponse(error.message, 500)
      return successResponse(data)
    }

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, company_name')
      .eq('id', user.id)
      .single()

    const isAdmin = callerProfile?.role === 'admin'
    const companyName = callerProfile?.company_name ?? null

    let data
    if (isAdmin) {
      const result = await admin
        .from('profiles')
        .select('id, role, company_name, full_name, avatar_url, phone, created_at, updated_at')
        .order('created_at', { ascending: false })
      data = result.data
    } else if (!companyName) {
      const result = await admin
        .from('profiles')
        .select('id, role, company_name, full_name, avatar_url, phone, created_at, updated_at')
        .eq('id', user.id)
      data = result.data
    } else {
      const result = await admin
        .from('profiles')
        .select('id, role, company_name, full_name, avatar_url, phone, created_at, updated_at')
        .eq('company_name', companyName)
        .order('created_at', { ascending: false })
      data = result.data
    }

    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const usersRateLimit = checkRateLimit(`users:${user.id || getClientIp(request)}`, { limit: 10, windowMs: 60 * 1000 })
    if (!usersRateLimit.success) {
      return rateLimitResponse(usersRateLimit, 'Премногу барања за корисници. Обидете се повторно наскоро.')
    }

    // RLS only allows own-profile reads/updates, so profile reads, the role
    // update, and the audit insert run on the admin client — authorization is
    // enforced below (user.manage RPC + role hierarchy + company match).
    const admin = createAdminClient()

    const { data: body, error: validationError } = await validateBody(request, updateUserRoleSchema)
    if (validationError) return validationError
    const { userId, role } = body!
    if (!VALID_ROLES.includes(role)) {
      return errorResponse(`Непозната улога: ${role}`)
    }

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, company_name')
      .eq('id', user.id)
      .single()

    if (!callerProfile) return forbiddenResponse()

    const callerRole = callerProfile.role as UserRole
    const isAdmin = isAdminRole(callerRole)

    const { data: hasPermission, error: rpcError } = await admin.rpc('user_has_permission', {
      target_user_id: user.id,
      perm_key: 'user.manage',
    })
    if (rpcError) return errorResponse(rpcError.message, 500)

    if (!hasPermission) {
      return forbiddenResponse('Немате дозвола за управување со корисници')
    }

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('role, company_name, email')
      .eq('id', userId)
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

    if (!canAssignRole(callerRole, role)) {
      return forbiddenResponse(
        'Не можете да доделите улога повисока или еднаква на вашата',
      )
    }

    const { data, error } = await admin
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)

    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'user.role.update',
      entity_type: 'user',
      entity_id: userId,
      metadata: {
        previous_role: targetProfile.role,
        new_role: role,
        target_company: targetProfile.company_name,
        target_email: targetProfile.email,
      },
    })

    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
