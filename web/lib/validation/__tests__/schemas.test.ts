import { describe, it, expect } from 'vitest'
import { uploadPhotoSchema, uploadSchemaSchema, validateFormData } from '../schemas'

describe('uploadPhotoSchema', () => {
  it('accepts valid photo data', () => {
    const result = uploadPhotoSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid projectId', () => {
    const result = uploadPhotoSchema.safeParse({
      projectId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional note', () => {
    const result = uploadPhotoSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      note: 'Test note',
    })
    expect(result.success).toBe(true)
  })

  it('rejects note over 2000 chars', () => {
    const result = uploadPhotoSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      note: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('parses string latitude to number', () => {
    const result = uploadPhotoSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      latitude: '41.9981',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.latitude).toBe(41.9981)
    }
  })

  it('rejects invalid latitude range', () => {
    const result = uploadPhotoSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      latitude: '200',
    })
    expect(result.success).toBe(false)
  })
})

describe('uploadSchemaSchema', () => {
  it('accepts valid schema data', () => {
    const result = uploadSchemaSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Floor Plan',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = uploadSchemaSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = uploadSchemaSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(false)
  })
})

describe('validateFormData', () => {
  it('extracts and validates form data fields', () => {
    const formData = new FormData()
    formData.append('projectId', '550e8400-e29b-41d4-a716-446655440000')
    formData.append('name', 'Floor Plan')

    const result = validateFormData(uploadSchemaSchema, formData, ['projectId', 'name'])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.projectId).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.data.name).toBe('Floor Plan')
    }
  })

  it('returns error for missing fields', () => {
    const formData = new FormData()
    const result = validateFormData(uploadSchemaSchema, formData, ['projectId', 'name'])
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
    }
  })
})
