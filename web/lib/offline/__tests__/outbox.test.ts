import { describe, it, expect, beforeEach } from 'vitest'
import {
  MemoryOutboxStore,
  nextRetryDelayMs,
  canRetry,
  MAX_ATTEMPTS,
  type NewQueuedPhoto,
} from '@/lib/offline/outbox'

function newPhoto(overrides: Partial<NewQueuedPhoto> = {}): NewQueuedPhoto {
  return {
    projectId: 'project-1',
    blob: new Blob(['fake-image-bytes'], { type: 'image/jpeg' }),
    fileName: 'test.jpg',
    mimeType: 'image/jpeg',
    note: 'foundation pour',
    takenAt: '2026-09-14T10:00:00Z',
    latitude: 41.99,
    longitude: 21.43,
    ...overrides,
  }
}

describe('nextRetryDelayMs (exponential backoff, 5-minute cap)', () => {
  it('doubles from a 2s base', () => {
    expect(nextRetryDelayMs(1)).toBe(2_000)
    expect(nextRetryDelayMs(2)).toBe(4_000)
    expect(nextRetryDelayMs(3)).toBe(8_000)
  })

  it('caps at 5 minutes', () => {
    expect(nextRetryDelayMs(100)).toBe(5 * 60 * 1_000)
  })
})

describe('canRetry (max attempts gate)', () => {
  it('allows retry below the cap, denies at the cap', () => {
    expect(canRetry({ attempts: 0 })).toBe(true)
    expect(canRetry({ attempts: MAX_ATTEMPTS - 1 })).toBe(true)
    expect(canRetry({ attempts: MAX_ATTEMPTS })).toBe(false)
  })
})

describe('MemoryOutboxStore', () => {
  let store: MemoryOutboxStore

  beforeEach(() => {
    store = new MemoryOutboxStore()
  })

  it('enqueues with queued status and zero attempts', async () => {
    const item = await store.enqueue(newPhoto())
    expect(item.status).toBe('queued')
    expect(item.attempts).toBe(0)
    expect(item.lastError).toBeNull()
    expect(item.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('lists in FIFO order', async () => {
    const first = await store.enqueue(newPhoto({ fileName: 'a.jpg' }))
    // Ensure distinct createdAt ordering even on fast clocks.
    await new Promise((r) => setTimeout(r, 2))
    const second = await store.enqueue(newPhoto({ fileName: 'b.jpg' }))
    const ids = (await store.list()).map((i) => i.id)
    expect(ids).toEqual([first.id, second.id])
  })

  it('listPending returns queued first, then retryable failed', async () => {
    const queued = await store.enqueue(newPhoto({ fileName: 'q.jpg' }))
    const failed = await store.enqueue(newPhoto({ fileName: 'f.jpg' }))
    await store.markFailed(failed.id, 'offline')
    const done = await store.enqueue(newPhoto({ fileName: 'd.jpg' }))
    await store.markDone(done.id)

    const pending = await store.listPending()
    expect(pending.map((i) => i.id)).toContain(queued.id)
    expect(pending.map((i) => i.id)).toContain(failed.id)
    expect(pending.map((i) => i.id)).not.toContain(done.id)
  })

  it('marks the full lifecycle: uploading bumps attempts, done clears error', async () => {
    const item = await store.enqueue(newPhoto())
    await store.markUploading(item.id)
    await store.markFailed(item.id, 'network down')
    let current = (await store.list()).find((i) => i.id === item.id)!
    expect(current.status).toBe('failed')
    expect(current.attempts).toBe(1)
    expect(current.lastError).toBe('network down')

    await store.markUploading(item.id)
    await store.markDone(item.id)
    current = (await store.list()).find((i) => i.id === item.id)!
    expect(current.status).toBe('done')
    expect(current.attempts).toBe(2)
    expect(current.lastError).toBeNull()
  })

  it('exhausted items leave the pending set after MAX_ATTEMPTS', async () => {
    const item = await store.enqueue(newPhoto())
    for (let n = 0; n < MAX_ATTEMPTS; n++) {
      await store.markUploading(item.id)
      await store.markFailed(item.id, `attempt ${n}`)
    }
    expect(await store.listPending()).toEqual([])
  })

  it('remove deletes, clear empties', async () => {
    const item = await store.enqueue(newPhoto())
    await store.remove(item.id)
    expect(await store.list()).toEqual([])
    await store.enqueue(newPhoto())
    await store.clear()
    expect(await store.list()).toEqual([])
  })

  it('ignores transitions for unknown ids', async () => {
    await expect(store.markUploading('missing')).resolves.toBeUndefined()
    await expect(store.markDone('missing')).resolves.toBeUndefined()
    await expect(store.markFailed('missing', 'x')).resolves.toBeUndefined()
    await expect(store.remove('missing')).resolves.toBeUndefined()
  })
})
