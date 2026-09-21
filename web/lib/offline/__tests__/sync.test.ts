import { describe, it, expect, vi } from 'vitest'
import { MemoryOutboxStore } from '@/lib/offline/outbox'
import { drainOutbox, uploadQueuedPhoto } from '@/lib/offline/sync'
import type { FetchImpl } from '@/lib/offline/sync'

function newPhoto(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'project-1',
    blob: new Blob(['fake-image-bytes'], { type: 'image/jpeg' }),
    fileName: 'test.jpg',
    mimeType: 'image/jpeg',
    note: null,
    takenAt: null,
    latitude: null,
    longitude: null,
    ...overrides,
  }
}

function okFetch(photoId = 'photo-1'): FetchImpl {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: { photoId } }),
  }) as unknown as FetchImpl
}

function failingFetch(status = 500): FetchImpl {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'boom' }),
  }) as unknown as FetchImpl
}

describe('uploadQueuedPhoto', () => {
  it('POSTs multipart form and resolves the photo id', async () => {
    const store = new MemoryOutboxStore()
    const item = await store.enqueue(newPhoto())
    const fetchMock = okFetch('photo-9')

    const photoId = await uploadQueuedPhoto(item, fetchMock)

    expect(photoId).toBe('photo-9')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    expect(url).toBe('/api/upload')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).body).toBeInstanceOf(FormData)
  })

  it('throws the server error message on non-OK responses', async () => {
    const store = new MemoryOutboxStore()
    const item = await store.enqueue(newPhoto())
    await expect(uploadQueuedPhoto(item, failingFetch())).rejects.toThrow('boom')
  })

  it('throws when the response has no photo id', async () => {
    const store = new MemoryOutboxStore()
    const item = await store.enqueue(newPhoto())
    const emptyFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: null }),
    }) as unknown as FetchImpl
    await expect(uploadQueuedPhoto(item, emptyFetch)).rejects.toThrow(
      'without a photo id',
    )
  })
})

describe('drainOutbox', () => {
  it('uploads pending items FIFO and removes them', async () => {
    const store = new MemoryOutboxStore()
    await store.enqueue(newPhoto({ fileName: 'a.jpg' }))
    await store.enqueue(newPhoto({ fileName: 'b.jpg' }))

    const result = await drainOutbox(store, okFetch())

    expect(result).toEqual({ uploaded: 2, failed: 0, skipped: 0 })
    expect(await store.list()).toEqual([])
  })

  it('marks failures retryable without removing them', async () => {
    const store = new MemoryOutboxStore()
    await store.enqueue(newPhoto())

    const result = await drainOutbox(store, failingFetch())

    expect(result).toEqual({ uploaded: 0, failed: 0, skipped: 1 })
    const remaining = await store.list()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].status).toBe('failed')
    expect(remaining[0].lastError).toBe('boom')
  })

  it('counts items exhausting MAX_ATTEMPTS during the drain as failed', async () => {
    const store = new MemoryOutboxStore()
    const item = await store.enqueue(newPhoto())
    // Nine prior failures: still pending (9 < MAX_ATTEMPTS), the tenth
    // failure inside the drain exhausts the budget.
    for (let n = 0; n < 9; n++) {
      await store.markUploading(item.id)
      await store.markFailed(item.id, 'down')
    }

    const result = await drainOutbox(store, failingFetch())

    expect(result.failed).toBe(1)
    expect((await store.listPending())).toEqual([])
  })

  it('drains an empty queue to zeros', async () => {
    const store = new MemoryOutboxStore()
    expect(await drainOutbox(store, okFetch())).toEqual({
      uploaded: 0,
      failed: 0,
      skipped: 0,
    })
  })
})
