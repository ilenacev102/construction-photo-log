import { describe, it, expect } from 'vitest'
import {
  updatePinSchema,
  updateLabelGroupSchema,
  updateLabelItemSchema,
  updateSchemaSchema,
  insertNotificationSchema,
} from '../schemas'

const UUID = '00000000-0000-4000-8000-000000000001'

/**
 * Regression lock for the passthrough-strip fix: the four update schemas used
 * to call .passthrough(), which let clients write protected columns (user_id,
 * created_at, ...) through PATCH endpoints. Zod's default behavior strips
 * unknown keys — these tests pin that behavior so it cannot regress.
 */
describe('update schemas strip unknown keys (no .passthrough())', () => {
  const cases = [
    { name: 'updatePinSchema', schema: updatePinSchema, valid: { id: UUID } },
    { name: 'updateLabelGroupSchema', schema: updateLabelGroupSchema, valid: { name: 'Group' } },
    { name: 'updateLabelItemSchema', schema: updateLabelItemSchema, valid: { name: 'Item' } },
    { name: 'updateSchemaSchema', schema: updateSchemaSchema, valid: { id: UUID, name: 'Schema' } },
  ] as const

  for (const { name, schema, valid } of cases) {
    it(`${name} strips unknown keys instead of passing them through`, () => {
      const result = schema.safeParse({
        ...valid,
        user_id: 'attacker-controlled',
        created_at: '2026-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('user_id')
        expect(result.data).not.toHaveProperty('created_at')
      }
    })
  }
})

describe('insertNotificationSchema', () => {
  it('accepts a valid mention notification', () => {
    const result = insertNotificationSchema.safeParse({
      user_id: UUID,
      type: 'mention',
      comment_id: UUID,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid reply notification', () => {
    const result = insertNotificationSchema.safeParse({
      user_id: UUID,
      type: 'reply',
      comment_id: UUID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown notification type', () => {
    const result = insertNotificationSchema.safeParse({
      user_id: UUID,
      type: 'like',
      comment_id: UUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-uuid user_id', () => {
    const result = insertNotificationSchema.safeParse({
      user_id: 'not-a-uuid',
      type: 'mention',
      comment_id: UUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-uuid comment_id', () => {
    const result = insertNotificationSchema.safeParse({
      user_id: UUID,
      type: 'mention',
      comment_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('strips unknown keys from notification rows', () => {
    const result = insertNotificationSchema.safeParse({
      user_id: UUID,
      type: 'mention',
      comment_id: UUID,
      admin: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('admin')
    }
  })
})