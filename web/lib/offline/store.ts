/**
 * Singleton access to the photo outbox.
 *
 * Uses IndexedDB in the browser (persistent across reloads) and falls back
 * to memory outside the browser (SSR, tests). Sync is started at most once
 * per page load via ensureOutboxSyncStarted().
 */

import {
  IndexedDbOutboxStore,
  MemoryOutboxStore,
  type OutboxStore,
} from './outbox'
import { startOutboxSync, type SyncCallbacks } from './sync'

let store: OutboxStore | null = null
let syncStarted = false

export function getOutboxStore(): OutboxStore {
  if (!store) {
    store = IndexedDbOutboxStore.isSupported()
      ? new IndexedDbOutboxStore()
      : new MemoryOutboxStore()
  }
  return store
}

/** Test seam: replace the singleton (restored via resetOutboxStore). */
export function setOutboxStore(next: OutboxStore): void {
  store = next
}

export function resetOutboxStore(): void {
  store = null
  syncStarted = false
}

/** Start background draining once per page load. No-op on repeat calls. */
export function ensureOutboxSyncStarted(
  callbacks: SyncCallbacks = {},
): void {
  if (syncStarted || typeof window === 'undefined') return
  syncStarted = true
  startOutboxSync(getOutboxStore(), callbacks)
}
