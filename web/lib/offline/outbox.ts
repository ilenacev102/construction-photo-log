/**
 * Offline outbox for field photo uploads.
 *
 * When the device has no signal, photos are enqueued here instead of being
 * POSTed to /api/upload. A sync engine (see sync.ts) drains the queue when
 * connectivity returns. Storage backends:
 * - MemoryOutboxStore: in-memory, used in tests and as a fallback.
 * - IndexedDbOutboxStore: persistent browser storage, survives reloads.
 */

export type OutboxStatus = 'queued' | 'uploading' | 'failed' | 'done'

export interface QueuedPhoto {
  /** Client-generated UUID (stable across retries of the same item). */
  id: string
  projectId: string
  /** Original image bytes as captured (compression happens at sync time). */
  blob: Blob
  fileName: string
  mimeType: string
  note: string | null
  takenAt: string | null
  latitude: number | null
  longitude: number | null
  createdAt: string
  attempts: number
  status: OutboxStatus
  lastError: string | null
}

export type NewQueuedPhoto = Pick<
  QueuedPhoto,
  | 'projectId'
  | 'blob'
  | 'fileName'
  | 'mimeType'
  | 'note'
  | 'takenAt'
  | 'latitude'
  | 'longitude'
> & { id?: string }

export interface OutboxStore {
  enqueue(item: NewQueuedPhoto): Promise<QueuedPhoto>
  list(): Promise<QueuedPhoto[]>
  /** Pending items in FIFO order (queued, then failed with attempts left). */
  listPending(): Promise<QueuedPhoto[]>
  markUploading(id: string): Promise<void>
  markDone(id: string): Promise<void>
  markFailed(id: string, error: string): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

export const MAX_ATTEMPTS = 10
const BASE_DELAY_MS = 2_000
const MAX_DELAY_MS = 5 * 60 * 1_000

/** Exponential backoff with cap: 2s, 4s, 8s, … capped at 5 minutes. */
export function nextRetryDelayMs(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS)
}

/** True when the item may be retried again. */
export function canRetry(item: Pick<QueuedPhoto, 'attempts'>): boolean {
  return item.attempts < MAX_ATTEMPTS
}

function nowIso(): string {
  return new Date().toISOString()
}

function toQueued(item: NewQueuedPhoto): QueuedPhoto {
  return {
    id: item.id ?? crypto.randomUUID(),
    projectId: item.projectId,
    blob: item.blob,
    fileName: item.fileName,
    mimeType: item.mimeType,
    note: item.note,
    takenAt: item.takenAt,
    latitude: item.latitude,
    longitude: item.longitude,
    createdAt: nowIso(),
    attempts: 0,
    status: 'queued',
    lastError: null,
  }
}

export class MemoryOutboxStore implements OutboxStore {
  private items = new Map<string, QueuedPhoto>()

  async enqueue(item: NewQueuedPhoto): Promise<QueuedPhoto> {
    const queued = toQueued(item)
    this.items.set(queued.id, queued)
    return queued
  }

  async list(): Promise<QueuedPhoto[]> {
    return [...this.items.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )
  }

  async listPending(): Promise<QueuedPhoto[]> {
    return (await this.list()).filter(
      (item) =>
        item.status === 'queued' ||
        (item.status === 'failed' && canRetry(item)),
    )
  }

  async markUploading(id: string): Promise<void> {
    const item = this.items.get(id)
    if (!item) return
    this.items.set(id, { ...item, status: 'uploading', attempts: item.attempts + 1 })
  }

  async markDone(id: string): Promise<void> {
    const item = this.items.get(id)
    if (!item) return
    this.items.set(id, { ...item, status: 'done', lastError: null })
  }

  async markFailed(id: string, error: string): Promise<void> {
    const item = this.items.get(id)
    if (!item) return
    this.items.set(id, { ...item, status: 'failed', lastError: error })
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id)
  }

  async clear(): Promise<void> {
    this.items.clear()
  }
}

const DB_NAME = 'construction-photo-log'
const STORE_NAME = 'photo-outbox'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('by-status', 'status', { unique: false })
        store.createIndex('by-created', 'createdAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const request = run(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Persistent browser store. All methods open/close the DB per call. */
export class IndexedDbOutboxStore implements OutboxStore {
  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined'
  }

  async enqueue(item: NewQueuedPhoto): Promise<QueuedPhoto> {
    const queued = toQueued(item)
    const db = await openDb()
    try {
      await tx(db, 'readwrite', (store) => store.add(queued))
    } finally {
      db.close()
    }
    return queued
  }

  async list(): Promise<QueuedPhoto[]> {
    const db = await openDb()
    try {
      const items = await tx(db, 'readonly', (store) => store.getAll())
      return (items as QueuedPhoto[]).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      )
    } finally {
      db.close()
    }
  }

  async listPending(): Promise<QueuedPhoto[]> {
    return (await this.list()).filter(
      (item) =>
        item.status === 'queued' ||
        (item.status === 'failed' && canRetry(item)),
    )
  }

  private async patch(id: string, patch: Partial<QueuedPhoto>): Promise<void> {
    const db = await openDb()
    try {
      const current = await tx(db, 'readonly', (store) => store.get(id))
      if (!current) return
      await tx(db, 'readwrite', (store) =>
        store.put({ ...(current as QueuedPhoto), ...patch }),
      )
    } finally {
      db.close()
    }
  }

  async markUploading(id: string): Promise<void> {
    const db = await openDb()
    try {
      const current = (await tx(db, 'readonly', (store) =>
        store.get(id),
      )) as QueuedPhoto | undefined
      if (!current) return
      await tx(db, 'readwrite', (store) =>
        store.put({ ...current, status: 'uploading', attempts: current.attempts + 1 }),
      )
    } finally {
      db.close()
    }
  }

  async markDone(id: string): Promise<void> {
    await this.patch(id, { status: 'done', lastError: null })
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.patch(id, { status: 'failed', lastError: error })
  }

  async remove(id: string): Promise<void> {
    const db = await openDb()
    try {
      await tx(db, 'readwrite', (store) => store.delete(id))
    } finally {
      db.close()
    }
  }

  async clear(): Promise<void> {
    const db = await openDb()
    try {
      await tx(db, 'readwrite', (store) => store.clear())
    } finally {
      db.close()
    }
  }
}
