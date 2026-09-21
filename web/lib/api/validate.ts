import { ZodSchema, ZodError } from 'zod'
import { errorResponse } from './errors'
import { NextResponse } from 'next/server'

/**
 * Validate a parsed body against a Zod schema.
 * Returns { data, error } — if error is non-null, return it directly as the route response.
 * If data is non-null, it's the validated+typed body.
 *
 * Usage:
 *   const { data, error } = await validateBody(request, createProjectSchema)
 *   if (error) return error
 *   // data is fully typed
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T | null; error: NextResponse | null }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { data: null, error: errorResponse('Невалиден JSON во барањето.') }
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { data: null, error: errorResponse('Невалиден JSON во барањето.') }
  }

  try {
    const data = schema.parse(raw)
    return { data, error: null }
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.issues.map((i) => {
        const path = i.path.length > 0 ? `${i.path.join('.')}: ` : ''
        return `${path}${i.message}`
      })
      return { data: null, error: errorResponse(messages.join('; ')) }
    }
    return { data: null, error: errorResponse('Валидација не успеа.') }
  }
}
