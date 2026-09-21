import { NextRequest } from 'next/server'
import { errorResponse, successResponse, forbiddenResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createLabelGroupSchema } from '@/lib/api/schemas'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { getCompanyContext } from '@/lib/api/company-auth'

export async function GET() {
  try {
    const { user, supabase } = await requireAuth()
    const ctx = await getCompanyContext(supabase, user.id)

    // Admins see all groups
    if (ctx?.isAdmin) {
      const { data, error } = await supabase
        .from('label_groups')
        .select('*, labels(*)')
        .order('sort_order')
      if (error) return errorResponse(error.message, 500)
      return successResponse(data ?? [])
    }

    // No company → nothing to scope to
    if (!ctx?.companyName) {
      return successResponse([])
    }

    // Look up company id from the company name
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('name', ctx.companyName)
      .single()

    if (!company) return successResponse([])

    const { data, error } = await supabase
      .from('label_groups')
      .select('*, labels(*)')
      .eq('company_id', company.id)
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

    const labelGroupsRateLimit = checkRateLimit(`label-groups:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!labelGroupsRateLimit.success) {
      return rateLimitResponse(labelGroupsRateLimit, 'Премногу барања за групи на етикети. Обидете се повторно наскоро.')
    }

    // Only site_manager and admin can create groups
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, role')
      .eq('id', user.id)
      .single()

    if (!['site_manager', 'admin'].includes(profile?.role ?? '')) {
      return forbiddenResponse('Само менаџери и администратори можат да креираат групи на етикети.')
    }

    if (!profile?.company_name) {
      return errorResponse('Немате доделена компанија.', 400)
    }

    // Resolve company_id from the user's company name
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('name', profile.company_name)
      .single()

    if (!company) {
      return errorResponse('Компанијата не е пронајдена.', 404)
    }

    const { data: body, error: validationError } = await validateBody(request, createLabelGroupSchema)
    if (validationError) return validationError
    const { name, slug, color, sort_order, selection_mode, required } = body!

    const { data, error } = await supabase
      .from('label_groups')
      .insert({
        company_id: company.id,
        name,
        slug,
        color,
        sort_order,
        selection_mode,
        required,
      })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
