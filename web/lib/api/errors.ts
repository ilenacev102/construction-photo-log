import { NextResponse } from 'next/server'

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ data: null, error: message }, { status })
}

export function successResponse(data: unknown) {
  return NextResponse.json({ data, error: null })
}

export function unauthorizedResponse(message = 'Немате пристап. Најавете се повторно.') {
  return errorResponse(message, 401)
}

export function forbiddenResponse(message = 'Немате пристап до овој ресурс') {
  return errorResponse(message, 403)
}

export function notFoundResponse(message = 'Ресурсот не е пронајден') {
  return errorResponse(message, 404)
}

/**
 * Parse a JSON request body, mapping malformed/empty bodies to a 400 error.
 * Throws an Error carrying `{ status: 400 }` so apiErrorResponse returns 400,
 * not the default 500 — malformed client input is a client error.
 */
export async function parseJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw Object.assign(new Error('Невалиден JSON во барањето.'), { status: 400 })
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('Невалиден JSON во барањето.'), { status: 400 })
  }
  return body as T
}
