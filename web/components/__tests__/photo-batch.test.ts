import { describe, it, expect } from 'vitest'
import { planRetry, retainAfterBatch } from '../photo-batch'

describe('retainAfterBatch', () => {
  it('drops every item when the whole batch succeeded', () => {
    const kept = retainAfterBatch([
      { id: 1, status: 'done' as const },
      { id: 2, status: 'queued' as const },
    ])
    expect(kept).toEqual([])
  })

  it('keeps only the failed item and preserves its photoId', () => {
    const failed = {
      id: 3,
      status: 'error' as const,
      photoId: 'photo-3',
      taggedLabelIds: ['label-a'],
    }
    const kept = retainAfterBatch([
      { id: 1, status: 'done' as const, photoId: 'photo-1' },
      { id: 2, status: 'done' as const, photoId: 'photo-2' },
      failed,
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({
      id: 3,
      photoId: 'photo-3',
      taggedLabelIds: ['label-a'],
    })
  })

  it('keeps items that never ran', () => {
    const kept = retainAfterBatch([
      { id: 1, status: 'done' as const },
      { id: 2, status: 'pending' as const },
      { id: 3, status: 'uploading' as const },
    ])
    expect(kept.map((i) => i.id)).toEqual([2, 3])
  })
})

describe('planRetry', () => {
  it('skips the upload when the photo is already stored', () => {
    const plan = planRetry({ photoId: 'photo-1' }, ['label-a', 'label-b'])
    expect(plan.upload).toBe(false)
    expect(plan.labelIds).toEqual(['label-a', 'label-b'])
  })

  it('re-uploads when no photo id is known', () => {
    expect(planRetry({}, ['label-a']).upload).toBe(true)
    expect(planRetry({ photoId: null }, ['label-a']).upload).toBe(true)
  })

  it('only retries taggings that were never applied', () => {
    const plan = planRetry(
      { photoId: 'photo-1', taggedLabelIds: ['label-a'] },
      ['label-a', 'label-b'],
    )
    expect(plan.upload).toBe(false)
    expect(plan.labelIds).toEqual(['label-b'])
  })
})
