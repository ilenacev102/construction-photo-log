/**
 * Allowed PATCH fields for daily_logs and drawing_pins (P1-9 mass-assignment
 * mitigation). Anything not listed here is silently dropped by
 * filterAllowedFields — callers can never write columns such as user_id,
 * project_id, created_at, etc. via the update path.
 */

export const DAILY_LOG_UPDATE_FIELDS = [
  'log_date',
  'work_description',
  'weather',
  'temperature',
  'notes',
] as const

export const PIN_UPDATE_FIELDS = [
  'pin_type',
  'x',
  'y',
  'width',
  'height',
  'color',
  'label',
  'drawing_data',
] as const

type AllowedField = string

/**
 * Return only the whitelisted subset of `updates`. Fields not in `allowed`
 * are dropped (never passed through to the DB update). Returns {} when no
 * whitelisted field is present or updates is empty.
 */
export function filterAllowedFields(
  updates: Record<string, unknown>,
  allowed: readonly AllowedField[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) result[key] = updates[key]
  }
  return result
}
