import { NextRequest } from 'next/server'
import { errorResponse, successResponse, forbiddenResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createLabelItemSchema } from '@/lib/api/schemas'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { getCompanyContext, requireLabelGroupAccess } from '@/lib/api/company-auth'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth()
    const ctx = await getCompanyContext(supabase, user.id)

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    if (!groupId) {
      return errorResponse('groupId параметарот е задолжителен.')
    }

    // P1-10: labels are read by group_id — scope to the caller's company
    if (!ctx?.isAdmin) {
      if (!ctx?.companyName) return successResponse([])

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('name', ctx.companyName)
        .single()

      const { data: group } = await supabase
        .from('label_groups')
        .select('company_id')
        .eq('id', groupId)
        .single()

      if (!company || !group || group.company_id !== company.id) {
        return successResponse([])
      }
    }

    const { data, error } = await supabase
      .from('labels')
      .select('id, group_id, name, slug, color, sort_order, created_at')
      .eq('group_id', groupId)
      .order('sort_order')

    if (error) return errorResponse(error.message, 500)
    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth()

    const labelItemsRateLimit = checkRateLimit(`label-items:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!labelItemsRateLimit.success) {
      return rateLimitResponse(labelItemsRateLimit, 'Премногу барања за етикети. Обидете се повторно наскоро.')
    }

    // Only site_manager and admin can create labels
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['site_manager', 'admin'].includes(profile?.role ?? '')) {
      return forbiddenResponse('Само менаџери и администратори можат да креираат етикети.')
    }

    const { data: body, error: validationError } = await validateBody(request, createLabelItemSchema)
    if (validationError) return validationError
    const { group_id, name, slug, color, sort_order } = body!

    // P2-4: defense-in-depth — the target group must belong to the caller's company
    await requireLabelGroupAccess(supabase, user.id, group_id)

    const { data, error } = await supabase
      .from('labels')
      .insert({ group_id, name, slug, color, sort_order })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
