import { NextRequest } from 'next/server'
import { errorResponse, successResponse, forbiddenResponse, notFoundResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { updateLabelItemSchema } from '@/lib/api/schemas'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { requireLabelGroupAccess } from '@/lib/api/company-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, supabase } = await requireAuth()
    const labelItemsIdRateLimit = checkRateLimit(`label-items:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!labelItemsIdRateLimit.success) {
      return rateLimitResponse(labelItemsIdRateLimit, 'Премногу барања за етикети. Обидете се повторно наскоро.')
    }
    const { id } = await params

    // Only site_manager and admin can update labels
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['site_manager', 'admin'].includes(profile?.role ?? '')) {
      return forbiddenResponse('Само менаџери и администратори можат да ажурираат етикети.')
    }

    // Verify label exists and fetch its group for the company re-check
    const { data: existing } = await supabase
      .from('labels')
      .select('id, group_id')
      .eq('id', id)
      .single()

    if (!existing) return notFoundResponse('Етикетата не е пронајдена.')

    // P2-4: defense-in-depth — the label's group must belong to the caller's company
    await requireLabelGroupAccess(supabase, user.id, existing.group_id)

    const { data: body, error: validationError } = await validateBody(request, updateLabelItemSchema)
    if (validationError) return validationError
    const { name, slug, color, sort_order } = body!

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (slug !== undefined) updates.slug = slug
    if (color !== undefined) updates.color = color
    if (sort_order !== undefined) updates.sort_order = sort_order

    const { data, error } = await supabase
      .from('labels')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, supabase } = await requireAuth()
    const labelItemsDeleteRateLimit = checkRateLimit(`label-items:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!labelItemsDeleteRateLimit.success) {
      return rateLimitResponse(labelItemsDeleteRateLimit, 'Премногу барања за етикети. Обидете се повторно наскоро.')
    }
    const { id } = await params

    // Only site_manager and admin can delete labels
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['site_manager', 'admin'].includes(profile?.role ?? '')) {
      return forbiddenResponse('Само менаџери и администратори можат да бришат етикети.')
    }

    // Verify label exists and fetch its group for the company re-check
    const { data: existing } = await supabase
      .from('labels')
      .select('group_id')
      .eq('id', id)
      .single()

    if (!existing) return notFoundResponse('Етикетата не е пронајдена.')

    // P2-4: defense-in-depth — the label's group must belong to the caller's company
    await requireLabelGroupAccess(supabase, user.id, existing.group_id)

    const { error } = await supabase.from('labels').delete().eq('id', id)
    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
