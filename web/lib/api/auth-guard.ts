import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/errors'
import { NextResponse } from 'next/server'
import { monitoring } from '@/lib/monitoring'

export interface AuthContext {
  user: { id: string; email?: string }
  supabase: Awaited<ReturnType<typeof createClient>>
}

/**
 * Authenticate the request — throws with { status } on 401.
 * Catches in the handler's try/catch and routes through apiErrorResponse.
 *
 * Returns the SSR Supabase client (anon key, RLS-active).
 * For auth admin operations (invite, list users, etc.), import
 * createAdminClient from '@/lib/supabase/admin' directly in the route.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw Object.assign(new Error('Немате пристап. Најавете се повторно.'), { status: 401 })
  }
  return {
    user: { id: user.id, email: user.email },
    supabase,
  }
}

/**
 * Central error handler — checks for errors with { status } first,
 * then falls back to 500. Use in every route's catch block.
 */
export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof Error && 'status' in err) {
    const status = (err as Error & { status: number }).status
    // 4xx errors carry user-facing messages (auth, validation, permissions).
    // 5xx errors must NOT leak internal details — log them, return generic.
    if (status < 500) {
      return errorResponse(err.message, status)
    }
  }
  monitoring.captureException(err)
  return errorResponse('Внатрешна грешка на серверот.', 500)
}
