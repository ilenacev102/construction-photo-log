/**
 * Sync engine for the offline photo outbox.
 *
 * Drains queued photos FIFO: marks each uploading, POSTs it to /api/upload,
 * removes it on success, records the failure (with exponential-backoff
 * awareness) otherwise. Runs on `online` events, app start, and when the
 * tab becomes visible again. Never runs two drains concurrently.
 */

import {
  canRetry,
  type OutboxStore,
  type QueuedPhoto,
} from './outbox'
import { monitoring } from '@/lib/monitoring'

export interface DrainResult {
  uploaded: number
  failed: number
  skipped: number
}

export type FetchImpl = typeof fetch

function buildUploadForm(item: QueuedPhoto): FormData {
  const formData = new FormData()
  formData.append(
    'file',
    new File([item.blob], item.fileName, { type: item.mimeType }),
  )
  formData.append('projectId', item.projectId)
  formData.append('note', item.note ?? '')
  formData.append('takenAt', item.takenAt ?? '')
  if (item.latitude != null) formData.append('latitude', String(item.latitude))
  if (item.longitude != null) formData.append('longitude', String(item.longitude))
  return formData
}

/** Upload a single queued photo. Resolves with the server photo id. */
export async function uploadQueuedPhoto(
  item: QueuedPhoto,
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  const res = await fetchImpl('/api/upload', {
    method: 'POST',
    body: buildUploadForm(item),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) detail = body.error
    } catch {
      // Non-JSON error body — keep the status detail.
    }
    throw new Error(detail)
  }
  const json = (await res.json()) as { data?: { photoId?: string } }
  const photoId = json.data?.photoId
  if (!photoId) throw new Error('Upload succeeded without a photo id')
  return photoId
}

export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine
  }
  return true
}

/**
 * Drain all pending items once, in FIFO order. Items that exhaust
 * MAX_ATTEMPTS stay `failed` for manual retry. Respects per-item backoff
 * only across drain runs (a drain never sleeps between items).
 */
export async function drainOutbox(
  store: OutboxStore,
  fetchImpl: FetchImpl = fetch,
): Promise<DrainResult> {
  const result: DrainResult = { uploaded: 0, failed: 0, skipped: 0 }
  const pending = await store.listPending()
  for (const item of pending) {
    await store.markUploading(item.id)
    try {
      await uploadQueuedPhoto(item, fetchImpl)
      await store.markDone(item.id)
      await store.remove(item.id)
      result.uploaded += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      await store.markFailed(item.id, message)
      monitoring.captureException(err, {
        extra: { component: 'outbox-sync', photoId: item.id, projectId: item.projectId },
      })
      if (!canRetry({ attempts: item.attempts + 1 })) {
        result.failed += 1
      } else {
        // Retryable: leave it `failed` for the next drain run, which
        // applies exponential backoff via nextRetryDelayMs before retrying.
        result.skipped += 1
      }
    }
  }
  return result
}

export interface SyncCallbacks {
  onDrainStart?: () => void
  onDrainEnd?: (result: DrainResult) => void
}

/**
 * Start background syncing. Returns a `stop()` that removes listeners.
 * Safe to call in a React effect; concurrent drains are coalesced.
 */
export function startOutboxSync(
  store: OutboxStore,
  callbacks: SyncCallbacks = {},
  fetchImpl: FetchImpl = fetch,
): () => void {
  let running = false
  let queued = false

  async function run(): Promise<void> {
    if (running) {
      queued = true
      return
    }
    running = true
    callbacks.onDrainStart?.()
    try {
      do {
        queued = false
        const result = await drainOutbox(store, fetchImpl)
        callbacks.onDrainEnd?.(result)
      } while (queued)
    } finally {
      running = false
    }
  }

  function onOnline(): void {
    void run()
  }

  function onVisibility(): void {
    if (document.visibilityState === 'visible' && isOnline()) void run()
  }

  // Initial drain on mount (covers app start with pending items).
  if (isOnline()) void run()

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
