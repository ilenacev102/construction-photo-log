import { NextRequest } from 'next/server'
import { errorResponse, successResponse, forbiddenResponse, notFoundResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { updateLabelGroupSchema } from '@/lib/api/schemas'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { requireLabelGroupAccess } from '@/lib/api/company-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, supabase } = await requireAuth()
    const labelGroupsIdRateLimit = checkRateLimit(`label-groups:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!labelGroupsIdRateLimit.success) {
      return rateLimitResponse(labelGroupsIdRateLimit, 'Премногу барања за групи на етикети. Обидете се повторно наскоро.')
    }
    const { id } = await params

    // Only site_manager and admin can update groups
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['site_manager', 'admin'].includes(profile?.role ?? '')) {
      return forbiddenResponse('Само менаџери и администратори можат да ажурираат групи на етикети.')
    }

    // Verify group exists
    const { data: existing } = await supabase
      .from('label_groups')
      .select('id')
      .eq('id', id)
      .single()

    if (!existing) return notFoundResponse('Групата на етикети не е пронајдена.')

    // P2-4: defense-in-depth — the group must belong to the caller's company
    await requireLabelGroupAccess(supabase, user.id, id)

    const { data: body, error: validationError } = await validateBody(request, updateLabelGroupSchema)
    if (validationError) return validationError
    const { name, slug, color, sort_order, selection_mode, required } = body!

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (slug !== undefined) updates.slug = slug
    if (color !== undefined) updates.color = color
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (selection_mode !== undefined) updates.selection_mode = selection_mode
    if (required !== undefined) updates.required = required

    const { data, error } = await supabase
      .from('label_groups')
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
    const labelGroupsDeleteRateLimit = checkRateLimit(`label-groups:${user.id || getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 })
    if (!labelGroupsDeleteRateLimit.success) {
      return rateLimitResponse(labelGroupsDeleteRateLimit, 'Премногу барања за групи на етикети. Обидете се повторно наскоро.')
    }
    const { id } = await params

    // Only site_manager and admin can delete groups
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['site_manager', 'admin'].includes(profile?.role ?? '')) {
      return forbiddenResponse('Само менаџери и администратори можат да бришат групи на етикети.')
    }

    // Verify group exists
    const { data: existing } = await supabase
      .from('label_groups')
      .select('id')
      .eq('id', id)
      .single()

    if (!existing) return notFoundResponse('Групата на етикети не е пронајдена.')

    // P2-4: defense-in-depth — the group must belong to the caller's company
    await requireLabelGroupAccess(supabase, user.id, id)

    const { error } = await supabase.from('label_groups').delete().eq('id', id)
    if (error) return errorResponse(error.message, 500)
    return successResponse(null)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
